const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'articles.db');

console.log('🔧 Starting complete database schema fix...');

// Delete the corrupted database
if (fs.existsSync(dbPath)) {
    console.log('📦 Backing up existing database...');
    fs.copyFileSync(dbPath, dbPath + '.corrupted-backup');
    fs.unlinkSync(dbPath);
    console.log('✅ Old database backed up and removed');
}

// Create new database with proper schema
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error creating database:', err.message);
        process.exit(1);
    }
    console.log('✅ New database created');
});

// Create tables with proper schema
const queries = [
    // Articles table with all required columns
    `CREATE TABLE articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        url TEXT UNIQUE,
        summary TEXT,
        content TEXT,
        source TEXT,
        published_at TEXT,
        published_date TEXT,
        image_url TEXT,
        tags TEXT,
        engagement_score REAL,
        is_processed INTEGER DEFAULT 0,
        is_duplicate INTEGER DEFAULT 0,
        processed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Facebook posts table with proper schema
    `CREATE TABLE facebook_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        media_url TEXT,
        scheduled_time TEXT,
        status TEXT DEFAULT 'pending',
        facebook_post_id TEXT,
        article_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        processed INTEGER DEFAULT 0,
        engagement_metrics TEXT,
        FOREIGN KEY (article_id) REFERENCES articles (id)
    )`,
    
    // Processing queue table
    `CREATE TABLE processing_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER,
        processor_type TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT,
        error_message TEXT,
        FOREIGN KEY (article_id) REFERENCES articles (id)
    )`
];

async function createTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            queries.forEach((query, index) => {
                db.run(query, (err) => {
                    if (err) {
                        console.error(`❌ Error creating table ${index + 1}:`, err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Table ${index + 1} created successfully`);
                    }
                });
            });
            
            // Verify the schema
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('📋 Created tables:', tables.map(t => t.name).join(', '));
                    resolve();
                }
            });
        });
    });
}

async function verifySchema() {
    return new Promise((resolve, reject) => {
        console.log('\n🔍 Verifying database schema...');
        
        // Check articles table
        db.all("PRAGMA table_info(articles)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            
            const columnNames = columns.map(col => col.name);
            console.log('📝 Articles table columns:', columnNames.join(', '));
            
            const requiredColumns = ['id', 'title', 'url', 'created_at', 'processed'];
            const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
            
            if (missingColumns.length > 0) {
                console.error('❌ Missing columns in articles table:', missingColumns.join(', '));
                reject(new Error('Articles table missing required columns'));
                return;
            }
            
            // Check facebook_posts table
            db.all("PRAGMA table_info(facebook_posts)", (err, fbColumns) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const fbColumnNames = fbColumns.map(col => col.name);
                console.log('📝 Facebook_posts table columns:', fbColumnNames.join(', '));
                
                const fbRequiredColumns = ['id', 'article_id', 'created_at', 'processed'];
                const fbMissingColumns = fbRequiredColumns.filter(col => !fbColumnNames.includes(col));
                
                if (fbMissingColumns.length > 0) {
                    console.error('❌ Missing columns in facebook_posts table:', fbMissingColumns.join(', '));
                    reject(new Error('Facebook_posts table missing required columns'));
                    return;
                }
                
                console.log('✅ All required columns present in both tables');
                resolve();
            });
        });
    });
}

async function testOperations() {
    return new Promise((resolve, reject) => {
        console.log('\n🧪 Testing database operations...');
        
        // Test inserting an article
        const testArticle = {
            title: 'Test Article',
            url: 'https://test.com/article1',
            summary: 'Test summary',
            content: 'Test content',
            source: 'Test Source'
        };
        
        db.run(
            `INSERT INTO articles (title, url, summary, content, source) VALUES (?, ?, ?, ?, ?)`,
            [testArticle.title, testArticle.url, testArticle.summary, testArticle.content, testArticle.source],
            function(err) {
                if (err) {
                    console.error('❌ Error inserting test article:', err.message);
                    reject(err);
                    return;
                }
                
                const articleId = this.lastID;
                console.log('✅ Test article inserted with ID:', articleId);
                
                // Test selecting articles with created_at
                db.all("SELECT id, title, created_at, processed FROM articles WHERE id = ?", [articleId], (err, rows) => {
                    if (err) {
                        console.error('❌ Error selecting articles:', err.message);
                        reject(err);
                        return;
                    }
                    
                    console.log('✅ Article retrieved:', rows[0]);
                    
                    // Test inserting facebook post
                    db.run(
                        `INSERT INTO facebook_posts (content, article_id, status) VALUES (?, ?, ?)`,
                        ['Test post content', articleId, 'pending'],
                        function(err) {
                            if (err) {
                                console.error('❌ Error inserting facebook post:', err.message);
                                reject(err);
                                return;
                            }
                            
                            console.log('✅ Test facebook post inserted with ID:', this.lastID);
                            
                            // Test selecting posts with processed column
                            db.all("SELECT id, article_id, processed, created_at FROM facebook_posts WHERE article_id = ?", [articleId], (err, posts) => {
                                if (err) {
                                    console.error('❌ Error selecting facebook posts:', err.message);
                                    reject(err);
                                    return;
                                }
                                
                                console.log('✅ Facebook post retrieved:', posts[0]);
                                
                                // Clean up test data
                                db.run("DELETE FROM facebook_posts WHERE article_id = ?", [articleId], (err) => {
                                    if (err) {
                                        console.error('❌ Error cleaning up facebook posts:', err.message);
                                        reject(err);
                                        return;
                                    }
                                    
                                    db.run("DELETE FROM articles WHERE id = ?", [articleId], (err) => {
                                        if (err) {
                                            console.error('❌ Error cleaning up articles:', err.message);
                                            reject(err);
                                            return;
                                        }
                                        
                                        console.log('✅ Test data cleaned up');
                                        resolve();
                                    });
                                });
                            });
                        }
                    );
                });
            }
        );
    });
}

async function main() {
    try {
        await createTables();
        await verifySchema();
        await testOperations();
        
        console.log('\n🎉 Database schema fix completed successfully!');
        console.log('📊 Database is now ready for use');
        
        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err.message);
                process.exit(1);
            } else {
                console.log('✅ Database connection closed');
                process.exit(0);
            }
        });
        
    } catch (error) {
        console.error('\n❌ Database fix failed:', error.message);
        
        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err.message);
            }
            process.exit(1);
        });
    }
}

main();
