import fs from 'fs'
import path from 'path'
import { getDefinitionType } from './migrate-utils.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_STORE_DIR = path.join(__dirname, 'store', 'olukai-store-dev', 'metaobjects_definitions')

/**
 * Generates a sorted list of metaobject definition IDs based on their dependencies.
 * @returns {Promise<{sorted: string[], deferred: Set<string>}>} The sorted and deferred metaobject definition IDs
 */
const generateSortedDefinitionIds = async () => {
    const definitionDirs = fs.readdirSync(SRC_STORE_DIR)
    const dependencies = new Map()
    const sorted = []
    const deferred = new Set()

    for (const definitionDir of definitionDirs) {
        const definitionPath = path.join(SRC_STORE_DIR, definitionDir, 'definition.json')
        if (fs.existsSync(definitionPath)) {
            const definition = JSON.parse(fs.readFileSync(definitionPath, 'utf8'))
            const definitionType = await getDefinitionType(definition.id)
            dependencies.set(definitionType, new Set())

            for (const field of definition.fieldDefinitions) {
                if (field.validations) {
                    for (const validation of field.validations) {
                        if (validation.name === 'metaobject_definition_id') {
                            const dependencyType = await getDefinitionType(validation.value)
                            if (dependencyType) {
                                dependencies.get(definitionType).add(dependencyType)
                            }
                        }
                    }
                }
            }
        }
    }

    const visited = new Set()
    const visit = (type) => {
        if (!visited.has(type)) {
            visited.add(type)
            for (const dep of dependencies.get(type) || []) {
                visit(dep)
            }
            sorted.push(type)
        }
    }

    for (const type of dependencies.keys()) {
        if (!visited.has(type)) {
            visit(type)
        }
    }

    for (const type of dependencies.keys()) {
        if (!sorted.includes(type)) {
            deferred.add(type)
        }
    }

    return { sorted, deferred }
}

export { generateSortedDefinitionIds }
