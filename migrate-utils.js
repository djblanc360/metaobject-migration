import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_STORE_DIR = path.join(__dirname, 'store', 'olukai-store-dev', 'metaobjects_definitions')

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
const DEST_SHOPIFY_STORE_URL = process.env.DEST_SHOPIFY_STORE_URL
const DEST_SHOPIFY_ACCESS_TOKEN = process.env.DEST_SHOPIFY_ACCESS_TOKEN

/**
 * Reads and parses a JSON file.
 * @param {string} filePath The path to the JSON file
 * @returns {Object} Parsed JSON data
 */
const readJsonFile = (filePath) => {
    const fileData = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(fileData)
}

/**
 * Makes a GraphQL request to Shopify.
 * @param {string} query The GraphQL query
 * @param {Object} variables The variables for the GraphQL query
 * @returns {Promise<Object>} The response data
 */
const graphqlRequest = async (url, token, query, variables = {}) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
    })

    const { data, errors } = await response.json()
    if (errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(errors)}`)
    }
    return data
}

/**
 * Reads and returns all metaobject types from the source store.
 * @returns {Array<Object>} Array of metaobject types
 */
const readMetaobjectTypes = () => {
    const completeDirPath = path.join(SRC_STORE_DIR, 'complete')
    return fs.readdirSync(completeDirPath).map((fileName) => {
        const filePath = path.join(completeDirPath, fileName)
        return readJsonFile(filePath)
    })
}

/**
 * Utility function to retrieve the type for a given definition ID
 * @param {string} definitionId The ID of the metaobject definition
 * @returns {Promise<string>} The type of the metaobject definition
 */
const getDefinitionType = async (definitionId) => {
    console.log(`getDefinitionType - Fetching definition type for ID: ${definitionId}`)
    const query = `
    {
        metaobjectDefinition(id: "${definitionId}") {
            type
        }
    }`

    try {
        const { metaobjectDefinition } = await graphqlRequest(SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, query)
        // console.log(`getDefinitionType - Definition type: ${metaobjectDefinition?.type}`)
        return metaobjectDefinition?.type
    } catch (error) {
        console.log(`getDefinitionType - Error fetching definition type for ID ${definitionId}:`, error)
        return null
    }
}

/**
 * Retrieves the ID of a metaobject definition by its type from the Shopify store.
 * @param {string} type The type of the metaobject definition to find.
 * @returns {Promise<string|null>} The ID of the metaobject definition if found, otherwise null.
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

// This formatter removes fields with null values and displayName
const formatMetaobjectCreate = (json) => {
    if (json.metaobject) {
        delete json.metaobject.displayName // Remove displayName
        if (json.metaobject.fields) {
            json.metaobject.fields = json.metaobject.fields.filter(field => field.value !== null)
        }
    }
    return json
}

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
    readJsonFile,
    graphqlRequest,
    readMetaobjectTypes,
    getDefinitionType,
    getMetaobjectDefinitionIdByType,
    formatMetaobjectCreate,
    formatMetaobjectUpsert
}
