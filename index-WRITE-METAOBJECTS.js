import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import util from 'util'
import { graphqlRequest } from './migrate-utils.js'

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
const DEST_SHOPIFY_STORE_URL = process.env.DEST_SHOPIFY_STORE_URL
const DEST_SHOPIFY_ACCESS_TOKEN = process.env.DEST_SHOPIFY_ACCESS_TOKEN

// utility function to read `sequence.json` to get migration order of metaobject definitions
const readSequence = (storeName) => {
    const sequencePath = path.join(__dirname, 'store', storeName, 'sequence.json')
    const sequenceData = fs.readFileSync(sequencePath, 'utf8')
    return JSON.parse(sequenceData)
}

// Utility function to get the definition type from the old store
const getDefinitionType = async (url, token, definitionId) => {
    console.log(`getDefinitionType - Fetching definition type for ID: ${definitionId}`)
    const query = `
    {
        metaobjectDefinition(id: "${definitionId}") {
            type
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        // console.log(`getDefinitionType - Definition type: ${data.metaobjectDefinition?.type}`)
        return data.metaobjectDefinition?.type
    } catch (error) {
        console.log(`getDefinitionType - Error fetching definition type for ID ${definitionId}:`, error)
        return null
    }
}

// Utility function to get the definition ID from the new store by type
const getMetaobjectDefinitionIdByType = async (url, token, type) => {
    const query = `
    {
        metaobjectDefinitionByType(type: "${type}") {
            id
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        const definitionId = data.metaobjectDefinitionByType?.id
        console.log(`Found ID for type '${type}' at ${url}: ${definitionId}`)
        return definitionId
    } catch (error) {
        console.error(`Error fetching definition ID for type '${type}' from ${url}:`, error)
        return null
    }
}

// Utility function to get the product handle by product ID
const getProductHandleById = async (url, token, productId) => {
    const query = `
    {
        product(id: "${productId}") {
            handle
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        // console.log(`Product handle for ID ${productId}: ${data.product?.handle}`)
        return data.product?.handle
    } catch (error) {
        console.error(`Error fetching product handle for ID ${productId}:`, error)
        return null
    }
}

// Utility function to get the product ID by product handle
const getProductIdByHandle = async (url, token, handle) => {
    const query = `
    {
        productByHandle(handle: "${handle}") {
            id
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        // console.log(`Product ID for handle '${handle}' at ${url}: ${data.productByHandle?.id}`)
        return data.productByHandle?.id
    } catch (error) {
        console.error(`Error fetching product ID for handle '${handle}' from ${url}:`, error)
        return null
    }
}

// Utility function to get the collection handle by collection ID
const getCollectionHandleById = async (url, token, collectionId) => {
    const query = `
    {
        collection(id: "${collectionId}") {
            handle
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        // console.log(`Collection handle for ID ${collectionId}: ${data.collection?.handle}`)
        return data.collection?.handle
    } catch (error) {
        console.error(`Error fetching collection handle for ID ${collectionId}:`, error)
        return null
    }
}

// Utility function to get the collection ID by collection handle
const getCollectionIdByHandle = async (url, token, handle) => {
    const query = `
    {
        collectionByHandle(handle: "${handle}") {
            id
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        // console.log(`Collection ID for handle '${handle}' at ${url}: ${data.collectionByHandle?.id}`)
        return data.collectionByHandle?.id
    } catch (error) {
        console.error(`Error fetching collection ID for handle '${handle}' from ${url}:`, error)
        return null
    }
}

// Utility function to get the media alt text by media ID
const getMediaAltById = async (url, token, mediaId) => {
    const query = `
    {
        file(id: "${mediaId}") {
            altText
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        console.log(`Media ALT Text for ID ${mediaId}: ${data.file.altText}`)
        return data.file.altText
    } catch (error) {
        console.error(`Error fetching media ALT text for ID ${mediaId}:`, error)
        return null
    }
}

// Utility function to get the media ID by alt text
const getMediaIdByAlt = async (url, token, altText) => {
    const query = `
    {
        files(first: 1, query: "alt_text:'${altText}'") {
            edges {
                node {
                    id
                }
            }
        }
    }`

    try {
        const data = await graphqlRequest(url, token, query)
        if (data.files.edges.length > 0) {
            const mediaId = data.files.edges[0].node.id
            console.log(`Found Media ID for ALT text '${altText}': ${mediaId}`)
            return mediaId
        }
        console.error(`No media found with ALT text '${altText}'`)
        return null
    } catch (error) {
        console.error(`Error fetching media ID for ALT text '${altText}' from ${url}:`, error)
        return null
    }
}

// Processes metaobject fields to update references to use the new store's IDs
const processMetaobjectFields = async (fields) => {
    const processedFields = []

    for (const field of fields) {
        if (field.type === "product_reference" || field.type === "list.product_reference") {
            const productHandle = await getProductHandleById(SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, field.value)
            if (!productHandle) {
                console.error(`No handle found for product ID ${field.value}`)
                continue
            }
            const newProductId = await getProductIdByHandle(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, productHandle)
            if (!newProductId) {
                console.error(`No new product ID found for handle ${productHandle}`)
                continue
            }
            field.value = newProductId // Update the reference to use the new store's product ID
            processedFields.push(field)
        } else if (field.type === "collection_reference" && field.value !== null) {
            const collectionHandle = await getCollectionHandleById(SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, field.value)
            if (!collectionHandle) {
                console.error(`No handle found for collection ID ${field.value}`)
                continue
            }
            const newCollectionId = await getCollectionIdByHandle(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, collectionHandle)
            if (!newCollectionId) {
                console.error(`No new collection ID found for handle ${collectionHandle}`)
                continue
            }
            field.value = newCollectionId // Update the reference to use the new store's collection ID
            processedFields.push(field)
        } else if (field.type === "media_reference" && field.value !== null) {
            const altText = await getMediaAltById(SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, field.value)
            if (!altText) {
                console.error(`No alt text found for media ID ${field.value}`)
                continue
            }
            const newMediaId = await getMediaIdByAlt(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, altText)
            if (!newMediaId) {
                console.error(`No new media ID found for alt text ${altText}`)
                continue
            }
            field.value = newMediaId // Update the reference to use the new store's media ID
            processedFields.push(field)
        } else if (field.value !== null) {
            processedFields.push(field)
        } else {
            console.log(`Field with key ${field.key} has a null value and is not a reference type, excluding from processing.`)
        }
    }

    return processedFields
}

/**
 * Reads and upserts all metaobjects from the source store to the destination store.
 */
const upsertMetaobject = async (url, token, definition, metaobject) => {
    const fields = await processMetaobjectFields(metaobject.fields)

    const mutation = `
        mutation metaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
            metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
                metaobject {
                    id
                    handle
                    fields {
                        key
                        value
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }`

    const variables = {
        handle: {
            handle: metaobject.handle,
            type: metaobject.type
        },
        metaobject: {
            fields: fields
        }
    }

    try {
        console.log(`Upserting type ${definition} - metaobject: ${metaobject.handle}`, `${util.inspect(variables.handle)}`, `${util.inspect(variables.metaobject.fields)}`)
        const result = await graphqlRequest(url, token, mutation, variables)
        console.log("GraphQL Response:", JSON.stringify(result, null, 2))
        if (result.userErrors && result.userErrors.length > 0) {
            console.error('Errors occurred:', result.userErrors)
        } else {
            console.log(`Successfully upserted type ${definition} - metaobject: ${metaobject.handle}: ${result.metaobject.id}`)
        }
        return result
    } catch (error) {
        console.error(`Error performing GraphQL mutation on type ${definition} - metaobject: ${metaobject.handle}`, error)
        throw error  // Consider how you want to handle errors - propagate them, handle them silently, etc.
    }
}

/**
 * Reads and upserts all metaobjects from the source store to the destination store.
 * @param {*} storeName 
 * @param {*} definitionType 
 */
const readAndUpsertMetaobjects = async (storeName, definitionType) => {
    const metaobjectsDir = path.join(__dirname, 'store', storeName, 'metaobjects_definitions', definitionType, 'metaobjects')
    const files = fs.readdirSync(metaobjectsDir)
    console.log('Reading metaobjects from:', metaobjectsDir)

    for (const fileName of files) {
        const filePath = path.join(metaobjectsDir, fileName)
        const metaobjectData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        try {
            const upsertResult = await upsertMetaobject(DEST_SHOPIFY_STORE_URL, DEST_SHOPIFY_ACCESS_TOKEN, definitionType, metaobjectData)
            console.log('Upsert result:', upsertResult)
        } catch (error) {
            console.error('Error upserting metaobject:', error)
        }
    }
}

/**
 * Migrates all metaobjects from the source store to the destination store.
 * @param {*} storeName 
 */
const migrateMetaobjects = async (storeName) => {
    const sequence = readSequence(storeName)
    console.log('Migration sequence:', sequence)
    for (let definitionType of sequence) {
        await readAndUpsertMetaobjects(storeName, definitionType)
    }
}

migrateMetaobjects('olukai-store-dev')  // Example store name
