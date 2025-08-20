#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/database/db');
const logger = require('../src/utils/logger');

/**
 * Database migration script
 */
class DatabaseMigrator {
  constructor() {
    this.migrations = [
      {
        version: 1,
        description: 'Initial database schema',
        up: async () => {
          // This is handled by db.init() which creates all tables
          await db.init();
        }
      },
      {
        version: 2,
        description: 'Add indexes for better performance',
        up: async () => {
          const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_articles_engagement_score ON articles(engagement_score)',
            'CREATE INDEX IF NOT EXISTS idx_articles_source_date ON articles(source, published_date)',
            'CREATE INDEX IF NOT EXISTS idx_facebook_posts_article_id ON facebook_posts(article_id)',
            'CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON processing_queue(priority, created_at)'
          ];
          
          for (const sql of indexes) {
            await db.run(sql);
          }
        }
      },
      {
        version: 3,
        description: 'Add engagement metrics tracking',
        up: async () => {
          // Check if column exists
          const tableInfo = await db.all("PRAGMA table_info(facebook_posts)");
          const hasMetricsColumn = tableInfo.some(col => col.name === 'engagement_metrics');
          
          if (!hasMetricsColumn) {
            await db.run('ALTER TABLE facebook_posts ADD COLUMN engagement_metrics TEXT');
          }
        }
      }
    ];
  }

  /**
   * Get current database version
   */
  async getCurrentVersion() {
    try {
      // Create migrations table if it doesn't exist
      await db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await db.get('SELECT MAX(version) as version FROM migrations');
      return result.version || 0;
    } catch (error) {
      logger.error('Failed to get current database version', error);
      return 0;
    }
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration) {
    logger.info(`Applying migration ${migration.version}: ${migration.description}`);
    
    try {
      await db.beginTransaction();
      
      // Run the migration
      await migration.up();
      
      // Record the migration
      await db.run(
        'INSERT INTO migrations (version, description) VALUES (?, ?)',
        [migration.version, migration.description]
      );
      
      await db.commit();
      
      logger.info(`Migration ${migration.version} applied successfully`);
    } catch (error) {
      await db.rollback();
      logger.error(`Migration ${migration.version} failed`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    const currentVersion = await this.getCurrentVersion();
    const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Running ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }
    
    logger.info('All migrations completed successfully');
  }

  /**
   * Get migration status
   */
  async getStatus() {
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = Math.max(...this.migrations.map(m => m.version));
    const appliedMigrations = await db.all('SELECT * FROM migrations ORDER BY version');
    
    return {
      currentVersion,
      latestVersion,
      pendingCount: this.migrations.filter(m => m.version > currentVersion).length,
      appliedMigrations,
      allMigrations: this.migrations
    };
  }

  /**
   * Reset database (drop all tables)
   */
  async reset() {
    logger.warn('Resetting database - this will delete all data!');
    
    const tables = [
      'migrations',
      'processing_queue',
      'facebook_posts',
      'articles'
    ];
    
    for (const table of tables) {
      try {
        await db.run(`DROP TABLE IF EXISTS ${table}`);
        logger.info(`Dropped table: ${table}`);
      } catch (error) {
        logger.warn(`Failed to drop table ${table}`, error);
      }
    }
    
    logger.info('Database reset completed');
  }

  /**
   * Backup database
   */
  async backup() {
    const backupPath = `./data/backups/backup-${Date.now()}.db`;
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Copy database file
      const sourcePath = require('../src/utils/config').get('database.path');
      fs.copyFileSync(sourcePath, backupPath);
      
      logger.info(`Database backed up to: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error('Database backup failed', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const migrator = new DatabaseMigrator();
  
  try {
    switch (command) {
      case 'migrate':
        await migrator.migrate();
        break;
        
      case 'status':
        const status = await migrator.getStatus();
        console.log('\n📊 Migration Status:');
        console.log(`Current Version: ${status.currentVersion}`);
        console.log(`Latest Version: ${status.latestVersion}`);
        console.log(`Pending Migrations: ${status.pendingCount}`);
        
        if (status.appliedMigrations.length > 0) {
          console.log('\n✅ Applied Migrations:');
          status.appliedMigrations.forEach(m => {
            console.log(`  ${m.version}: ${m.description} (${m.applied_at})`);
          });
        }
        
        if (status.pendingCount > 0) {
          console.log('\n⏳ Pending Migrations:');
          status.allMigrations
            .filter(m => m.version > status.currentVersion)
            .forEach(m => {
              console.log(`  ${m.version}: ${m.description}`);
            });
        }
        break;
        
      case 'reset':
        const confirm = process.argv[3];
        if (confirm !== '--confirm') {
          console.log('⚠️  This will delete all data!');
          console.log('Use: npm run migrate reset -- --confirm');
          process.exit(1);
        }
        await migrator.reset();
        break;
        
      case 'backup':
        const backupPath = await migrator.backup();
        console.log(`✅ Database backed up to: ${backupPath}`);
        break;
        
      default:
        console.log('🗄️  Database Migration Tool\n');
        console.log('Available commands:');
        console.log('  migrate  - Run pending migrations');
        console.log('  status   - Show migration status');
        console.log('  reset    - Reset database (requires --confirm)');
        console.log('  backup   - Create database backup');
        console.log('\nUsage: npm run migrate <command>');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseMigrator;