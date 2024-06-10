import dotenv from 'dotenv'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { recreateMetaobjects } from './migrate.js'

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN

// Kaenon Dev
const DEST_SHOPIFY_STORE_URL = process.env.DEST_SHOPIFY_STORE_URL
const DEST_SHOPIFY_ACCESS_TOKEN = process.env.DEST_SHOPIFY_ACCESS_TOKEN

const regex = /https:\/\/(.*?).myshopify.com/
const match = regex.exec(SHOPIFY_STORE_URL)
const storeName = match[1]

// Function to write data to a JSON file
const writeToJsonFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

// Function for fetchDefinitionDetails
const saveDefinitionDetails = (type, data) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const dirPath = path.join(__dirname, 'store', storeName, 'metaobjects_definitions', type)
  fs.mkdirSync(dirPath, { recursive: true })
  writeToJsonFile(path.join(dirPath, 'definition.json'), data)
}

// Function for fetchMetaobjects
const saveMetaobjects = (type, metaobjects) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const dirPath = path.join(__dirname, 'store', storeName, 'metaobjects_definitions', type, 'metaobjects')
  fs.mkdirSync(dirPath, { recursive: true })

  metaobjects.forEach(metaobject => {
    const filePath = path.join(dirPath, `${metaobject.handle}.json`)
    writeToJsonFile(filePath, metaobject)
  })
}

// Function for gatherMetaobjectData
const saveCompleteData = (type, data) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const dirPath = path.join(__dirname, 'store', storeName, 'complete')
  fs.mkdirSync(dirPath, { recursive: true })
  writeToJsonFile(path.join(dirPath, `${type}.json`), data)
}

const graphqlRequest = async (url, token, query, variables = {}) => {
  console.log(`Making GraphQL request to: ${url}`)
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
    console.error(errors)
    throw new Error('GraphQL query failed')
  }
  return data
}

/**
 * retrieves all available metaobject definitions in store
 * @returns {Promise<Array>}
 */
const fetchMetaobjectDefinitions = async () => {
  const query = `
    {
      metaobjectDefinitions(first: 50) {
        edges {
          node {
            id
            name
            type
          }
        }
      }
    }`

  const { metaobjectDefinitions } = await graphqlRequest(SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, query)
  return metaobjectDefinitions.edges.map(edge => edge.node)
}

/**
 * retrieves metaobject definition data and all fields
 * @param {string} type
 * @returns {Promise<Object>}
 */
const fetchDefinitionDetails = async (type) => {
  const query = `
    {
      metaobjectDefinitionByType(type: "${type}") {
        id
        name
        type
        description
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
            type
            value
          }
        }
        metaobjectsCount
      }
    }`

  const { metaobjectDefinitionByType } = await graphqlRequest(SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, query)
  saveDefinitionDetails(type, metaobjectDefinitionByType)
  return metaobjectDefinitionByType
}

/**
 * retrieve all metaobjects of definition, along with all key/value pairs of fields
 * @param {string} type
 * @param {number} count
 * @returns {Promise<Array>}
 */
const fetchMetaobjects = async (type, count) => {
  let allMetaobjects = []
  let hasNextPage = true
  let afterCursor = null
  const pageSize = 50 // Set based on Shopify's maximum limit

  while (hasNextPage && allMetaobjects.length < count) {
    const query = `
      {
        metaobjects(type: "${type}", first: ${pageSize}, after: ${afterCursor ? `"${afterCursor}"` : null}) {
          nodes {
            type
            capabilities {
              publishable {
                status
              }
            }
            displayName
            handle
            id
            fields {
              key
              value
              type
              definition {
                description
                key
                name
                required
                type {
                  category
                  name
                }
                validations {
                  name
                  type
                  value
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`

    const { metaobjects } = await graphqlRequest(SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, query)
    allMetaobjects = allMetaobjects.concat(metaobjects.nodes)

    hasNextPage = metaobjects.pageInfo.hasNextPage
    afterCursor = metaobjects.pageInfo.endCursor
  }

  saveMetaobjects(type, allMetaobjects)
  return allMetaobjects
}

const gatherMetaobjectData = async () => {
  const definitions = await fetchMetaobjectDefinitions()
  const result = []

  for (let def of definitions) {
    const details = await fetchDefinitionDetails(def.type)
    const metaobjects = await fetchMetaobjects(def.type, details.metaobjectsCount)

    const typeData = {
      [def.type]: {
        ...details,
        metaobjects
      }
    }

    result.push(typeData)
    saveCompleteData(def.type, typeData)
  }

  return result
}

gatherMetaobjectData().then(data => {
  console.log(JSON.stringify(data, null, 2))
}).catch(error => {
  console.error("An error occurred:", error)
})

/*
recreateMetaobjects().then(() => {
  console.log('Metaobjects recreation completed')
}).catch(error => {
  console.error('Error occurred:', error)
})
*/

