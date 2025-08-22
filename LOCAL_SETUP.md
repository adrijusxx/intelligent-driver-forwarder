# Local Setup Instructions

If you're getting the error `SQLITE_ERROR: no such column: processed` when running on your local computer, follow these steps:

## Quick Fix

1. **Stop the application** if it's running (Ctrl+C)

2. **Run the database fix script**:
   ```bash
   npm run fix-db
   ```
   
   OR directly:
   ```bash
   node fix-local-db.js
   ```

3. **Start the application again**:
   ```bash
   npm start
   ```

## What this fixes

The database fix script adds the missing `processed` column to both the `articles` and `facebook_posts` tables. This column is required for the cron jobs to track which articles and posts have been processed.

## Expected Output

When you run `npm run fix-db`, you should see:
```
🔧 Fixing database schema for local environment...
📁 Database: C:\Users\Adrian\Documents\intelligent-driver-forwarder\data\articles.db
➕ Adding processed column to articles table...
✅ Added processed column to articles table
📋 Creating facebook_posts table...
✅ Created facebook_posts table with processed column
🎉 Database schema fix completed successfully!

You can now run: npm start
```

## Troubleshooting

If you still get errors after running the fix:

1. **Delete the database file** and let it recreate:
   ```bash
   rm data/articles.db
   npm start
   ```

2. **Check your Node.js version**:
   ```bash
   node --version
   ```
   Make sure you're using Node.js 14 or higher.

3. **Reinstall dependencies**:
   ```bash
   npm install
   ```

## Configuration

Make sure your `config/default.json` has the correct Facebook credentials:
- `facebook.accessToken` - Your Facebook page access token
- `facebook.pageId` - Your Facebook page ID
- `facebook.appId` - Your Facebook app ID
- `facebook.appSecret` - Your Facebook app secret
