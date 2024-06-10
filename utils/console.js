import fs from 'fs'
import path from 'path'

/**
 * Writes a payload to a JSON file in a specified directory within the console folder.
 * @param {string} folderName - The name of the folder within the console directory.
 * @param {string} fileName - The name of the JSON file (without extension).
 * @param {string} comment - A comment to include in the JSON file.
 * @param {Object} payload - The payload to write to the JSON file.
 */
const writeToConsoleFile = (folderName, fileName, comment, payload) => {
    const consoleDir = path.join(__dirname, 'console')
    const targetDir = path.join(consoleDir, folderName)

    // Ensure the target directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
    }

    const filePath = path.join(targetDir, `${fileName}.json`)
    const fileContent = {
        comment: comment,
        payload: payload
    }

    fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2), 'utf8')
}

export { writeToConsoleFile }
