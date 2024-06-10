import { getMetaobjectDefinitionIdByKey } from './migrate-definitions.js'
import { getDefinitionType, getMetaobjectDefinitionIdByType } from './migrate-utils.js'
import util from 'util'

// CreateMetaobjectDefinition
// This formatter will simplify the type field and remove empty validations arrays:
const formatCreateMetaobjectDefinition = async (definition) => {
    let formattedDefinition = { ...definition }
    delete formattedDefinition.id // Remove the id field
    delete formattedDefinition.metaobjectsCount // Remove the metaobjectsCount field

    // Object to store field definitions to be added later, indexed by the parent definition type
    let deferredFields = {}

    const processFieldDefinitions = async (field) => {
        console.log(`field definition key being evaluated: ${field.key}`)
        let formattedField = { ...field, type: field.type.name }
        let deferField = false // Flag to determine if the field should be deferred
        let excludeField = false // Flag to determine if the field should be excluded

        if (formattedField.type === "metaobject_reference" || formattedField.type === "list.metaobject_reference") {
            let validations = []
            for (let validation of field.validations ?? []) {
                if (validation.name === "metaobject_definition_id") {
                    const originalType = await getDefinitionType(validation.value)
                    if (!originalType) {
                        console.error(`No type found for ID '${validation.value}' in the source store. Deferring field '${field.key}'`)
                        excludeField = true // Mark field for exclusion
                        break // exclude
                    }
                    const metaobjectDefinitionId = await getMetaobjectDefinitionIdByType(originalType)
                    console.log(`at key: ${field.key} with original type: ${originalType} has metaobject definition ID: ${metaobjectDefinitionId}`)
                    if (!metaobjectDefinitionId) {
                        console.error(`No ID found for type '${originalType}' in the target store.`)
                        deferField = true
                        break // exclude
                    }
                    validations.push({
                        name: "metaobject_definition_id",
                        value: metaobjectDefinitionId
                    })
                } else {
                    validations.push(validation)
                }
            }
            // Update the field's validations if not marked for exclusion
            if (!excludeField) formattedField.validations = validations

        } else if (field.validations && field.validations.length > 0) {
            // Handle validations for fields that are not metaobject_reference types
            console.log(`${field.key} validations that are not 'metaobject_reference' type: ${JSON.stringify(field.validations)}`)
            formattedField.validations = field.validations.map(validation => ({
                name: validation.name,
                value: typeof validation.value === 'object' ? JSON.stringify(validation.value) : validation.value,
            }))
        } else {
            console.log(`delete validations for ${field.key} if not applicable: ${formattedField.validations}`)
            // For fields without validations or with empty validations array
            delete formattedField.validations
        }

        // If the field should be deferred, store it under the parent definition's type
        if (deferField) {
            if (!deferredFields[definition.type]) {
                deferredFields[definition.type] = []
            }
            deferredFields[definition.type].push(formattedField)
            return null // exclude
        }

        return excludeField ? null : formattedField
    }

    // Process all field definitions and filter out any that are deferred
    formattedDefinition.fieldDefinitions = (await Promise.all(definition.fieldDefinitions.map(processFieldDefinitions))).filter(field => field !== null)

    console.log(`formattedDefinition: ${util.inspect(formattedDefinition, { depth: null, colors: true })}`)
    console.log(`Deferred fields to be added later: ${util.inspect(deferredFields, { depth: null, colors: true })}`)

    // Return both the formattedDefinition and the deferredFields for later processing
    return { formattedDefinition, deferredFields }
}

// metaobjectCreate
// This formatter will remove fields with null values and displayName
const formatMetaobjectCreate = (json) => {
    if (json.metaobject) {
        delete json.metaobject.displayName // Remove displayName
        if (json.metaobject.fields) {
            json.metaobject.fields = json.metaobject.fields.filter(field => field.value !== null)
        }
    }
    return json
}

// metaobjectUpsert
// This formatter follows similar rules as metaobjectCreate, removing fields with null values and displayName, 
// and additionally removing the type from fields object:
const formatMetaobjectUpsert = (json) => {
    if (json.metaobject) {
        delete json.metaobject.displayName // Remove displayName
        if (json.metaobject.fields) {
            json.metaobject.fields = json.metaobject.fields.filter(field => field.value !== null).map(field => {
                delete field.type // Remove type from each field
                return field
            })
        }
    }
    return json
}

export {
    formatCreateMetaobjectDefinition,
    formatMetaobjectCreate,
    formatMetaobjectUpsert,
}
