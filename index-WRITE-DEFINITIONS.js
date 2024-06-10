/**
  Initiates the migration process by first migrating sorted definitions and then handles any deferred definitions. 
  This structure ensures that dependencies are respected during the migration.
 */
  import { migrateAllDefinitions } from './migrate-definitions.js'
  import { generateSortedDefinitionIds } from './dependency-graph.js'
  import { writeToConsoleFile } from './utils/console.js' // for testing
  
  const runMigration = async () => {
      try {
          const { sorted, deferred } = await generateSortedDefinitionIds()
          writeToConsoleFile('index', 'sorted', 'Migrating sorted definitions...', sorted)
          
          await migrateAllDefinitions(sorted)
  
          if (deferred.size > 0) {
              writeToConsoleFile('index', 'deferred', 'Migrating deferred definitions...', deferred)
              await migrateAllDefinitions(Array.from(deferred))
          }
  
          console.log('Migration completed successfully.')
      } catch (error) {
          console.error('Migration failed:', error)
      }
  }
  
  runMigration()
  