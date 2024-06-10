import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { writeToConsoleFile } from './utils/console.js' // for testing
import { getDefinitionType, graphqlRequest } from './migrate-utils.js' // Assuming you have a utility function for making GraphQL requests
import { formatCreateMetaobjectDefinition } from './json-formatters.js'
import { generateSortedDefinitionIds } from './dependency-graph.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_STORE_DIR = path.join(__dirname, 'store', 'olukai-store-dev', 'metaobjects_definitions')

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
const DEST_SHOPIFY_STORE_URL = process.env.DEST_SHOPIFY_STORE_URL
const DEST_SHOPIFY_ACCESS_TOKEN = process.env.DEST_SHOPIFY_ACCESS_TOKEN

/**
 * Reads and formats a metaobject definition from a JSON file.
 * @param {string} definitionId The ID of the metaobject definition
 * @returns {Object} Formatted metaobject definition
 */
const readAndFormatDefinition = async (definitionId) => {
    const definitionPath = path.join(SRC_STORE_DIR, definitionId, 'definition.json')

    console.log(`readAndFormatDefinition - Reading and formatting definition: ${definitionId}`)
    console.log(`readAndFormatDefinition - Definition path: ${definitionPath}`)

    if (fs.existsSync(definitionPath)) {
        const definition = JSON.parse(fs.readFileSync(definitionPath, 'utf8'))
        console.log(`readAndFormatDefinition - Definition: ${JSON.stringify(definition)}`)
        const { formattedDefinition, deferredFields } = await formatCreateMetaobjectDefinition(definition)
        console.log(`readAndFormatDefinition - Formatted definition: ${JSON.stringify(formattedDefinition)}`)
        return { definitionData: formattedDefinition, deferredFields }
    } else {
        console.log(`readAndFormatDefinition - Definition file not found for ID: ${definitionId}`)
        return null
    }
}

/**
 * Migrates a single metaobject definition to the destination store.
 * @param {Object} definitionData Formatted metaobject definition data
 */
const migrateDefinition = async (definitionData) => {
    console.log(`migrateDefinition - Migrating definition data: ${JSON.stringify(definitionData)}`)
    const mutation = `
        mutation metaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
            metaobjectDefinitionCreate(definition: $definition) {
                metaobjectDefinition {
                    id
                    name
                    type
                    fieldDefinitions {
                        key
                        name
                        description
                        required
                        type {
                            category
                            name
                        }
                    }
                    metaobjectsCount
                }
                userErrors {
                    field
                    message
                }
            }
        }`

    const variables = { definition: definitionData }
    const response = await graphqlRequest(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, mutation, variables)
    console.log(`migrateDefinition - Migration response: ${JSON.stringify(response)}`)
}

/**
 * Reintegrates deferred fields into the corresponding metaobject definitions.
 * @param {Object} allDeferredFields The deferred fields to reintegrate
 */
const reintegrateDeferredFields = async (allDeferredFields) => {
    for (const [definitionType, fieldsToAdd] of Object.entries(allDeferredFields)) {
        const definitionId = await getMetaobjectDefinitionIdByType(definitionType)
        if (!definitionId) {
            console.error(`Could not find definition ID for type '${definitionType}' to add deferred fields.`)
            continue
        }

        const fieldDefinitionsInput = fieldsToAdd.map(field => ({
            create: {
                key: field.key,
                name: field.name,
                description: field.description,
                required: field.required,
                type: field.type,
                validations: field.validations.map(validation => ({
                    name: validation.name,
                    value: validation.value,
                })),
            }
        }))

        await updateMetaobjectDefinitionWithFields(definitionId, fieldDefinitionsInput)
    }
}

/**
 * Migrates all metaobject definitions in the sorted order defined by the dependency graph.
 */
const migrateAllDefinitions = async () => {
    let allDeferredFields = {}
    try {
        const { sorted, deferred } = await generateSortedDefinitionIds()
        console.log(`migrateAllDefinitions - Sorted Definitions: ${sorted.join(', ')}`)
        console.log(`migrateAllDefinitions - Deferred Definitions: ${Array.from(deferred).join(', ')}`) // Convert Set to Array and join

        const handleMigration = async (definitionId) => {
            console.log(`handleMigration - Migrating definition: ${definitionId}`)
            const { definitionData, deferredFields } = await readAndFormatDefinition(definitionId)
            console.log(`handleMigration - Definition data: ${JSON.stringify(definitionData)}`)
            writeToConsoleFile('migrate-definitions', `handleMigration-${definitionId.split('/').pop()}`, 'handleMigration - definition...', definitionData)
            if (definitionData) {
                await migrateDefinition(definitionData)
                console.log(`handleMigration - Successfully migrated definition: ${definitionId}`)
            } else {
                console.log(`handleMigration - Definition not found for ID: ${definitionId}`)
            }

            if (deferredFields && Object.keys(deferredFields).length > 0) {
                Object.assign(allDeferredFields, deferredFields)
            }
        }

        for (const definitionId of sorted) {
            await handleMigration(definitionId)
        }

        for (const definitionId of deferred) {
            await handleMigration(definitionId)
        }

        if (Object.keys(allDeferredFields).length > 0) {
            await reintegrateDeferredFields(allDeferredFields)
        }

        console.log('migrateAllDefinitions - Migration completed successfully.')
    } catch (error) {
        console.error(`migrateAllDefinitions - Error during migration: ${error.message}`)
    }
}

/**
 * Retrieves the ID of a metaobject definition by its key.
 * @param {string} key The key of the metaobject definition
 * @returns {Promise<string>} The ID of the metaobject definition
 */
const getMetaobjectDefinitionIdByKey = async (key) => {
    console.log(`getMetaobjectDefinitionIdByKey - Fetching definition ID for key: ${key}`)
    const query = `
    {
        metaobjectDefinitionByType(type: "${key}") {
            id
        }
    }`

    try {
        const response = await graphqlRequest(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, query)
        const definitionId = response.data.metaobjectDefinitionByType.id
        console.log(`getMetaobjectDefinitionIdByKey - Definition ID for key '${key}': ${definitionId}`)
        return definitionId
    } catch (error) {
        console.log(`getMetaobjectDefinitionIdByKey - Error fetching definition ID for key ${key}:`, error)
        throw error
    }
}

/**
 * Retrieves the ID of a metaobject definition by its type.
 * @param {string} type The type of the metaobject definition
 * @returns {Promise<string>} The ID of the metaobject definition
 */
const getMetaobjectDefinitionIdByType = async (type) => {
    const query = `
    {
        metaobjectDefinitionByType(type: "${type}") {
            id
        }
    }`

    try {
        const response = await graphqlRequest(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, query)
        const definitionId = response.metaobjectDefinitionByType?.id
        console.log(`Found ID for type '${type}': ${definitionId}`)
        return definitionId // Return the found ID
    } catch (error) {
        console.error(`Error fetching definition ID for type '${type}':`, error)
        return null // Return null in case of an error
    }
}

/**
 * Updates a metaobject definition with new fields.
 * @param {string} definitionId The ID of the metaobject definition to update
 * @param {Array} fieldDefinitionsInput The field definitions to add
 */
const updateMetaobjectDefinitionWithFields = async (definitionId, fieldDefinitionsInput) => {
    console.log(`Updating metaobject definition ID ${definitionId} with new fields...`)
    console.log(`Field definitions input: ${JSON.stringify(fieldDefinitionsInput)}`)
    const mutation = `
        mutation metaobjectDefinitionUpdate($definition: MetaobjectDefinitionUpdateInput!, $id: ID!) {
            metaobjectDefinitionUpdate(definition: $definition, id: $id) {
                metaobjectDefinition {
                    id
                    name
                    type
                    fieldDefinitions {
                        key
                        name
                        description
                        required
                        type {
                            category
                            name
                        }
                        validations {
                            name
                            value
                        }
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }`

    const variables = {
        id: definitionId,
        definition: {
            fieldDefinitions: fieldDefinitionsInput,
            resetFieldOrder: true,
        },
    }

    try {
        const data = await graphqlRequest(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, mutation, variables)
        if (data.metaobjectDefinitionUpdate && data.metaobjectDefinitionUpdate.metaobjectDefinition) {
            console.log(`Successfully updated metaobject definition ID ${definitionId} with new fields.`)
        } else if (data.metaobjectDefinitionUpdate.userErrors.length > 0) {
            console.error(`Failed to update metaobject definition ID ${definitionId}. Errors:`, data.metaobjectDefinitionUpdate.userErrors)
        }
    } catch (error) {
        console.error(`Error updating metaobject definition ID ${definitionId}:`, error)
    }
}

export { 
    migrateAllDefinitions,
    getMetaobjectDefinitionIdByKey,
    updateMetaobjectDefinitionWithFields
}
