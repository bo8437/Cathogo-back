const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  // Respect environment variables (Docker Compose will inject mysql-db:3306)
  // Defaults are set for local development (host: localhost, port: 3307)
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Transfers_db',
    multipleStatements: true,
    connectTimeout: 10000, // 10 seconds
  };

  console.log('Connecting to database with config:', {
    ...dbConfig,
    password: dbConfig.password ? '***' : '(empty)'
  });

  let connection;
  let retries = 5;
  let lastError;

  // Try to connect with retries
  while (retries > 0) {
    try {
      connection = await mysql.createConnection(dbConfig);
      await connection.connect();
      console.log('Successfully connected to database');
      break;
    } catch (error) {
      lastError = error;
      retries--;
      console.log(`Connection failed, ${retries} retries left. Error: ${error.message}`);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
      }
    }
  }

  if (!connection) {
    console.error('Failed to connect to database after multiple attempts. Last error:', lastError);
    process.exit(1);
  }

  try {
    console.log('Connected to database. Running migrations...');
    
    // Create migrations table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of applied migrations
    const [appliedMigrations] = await connection.execute('SELECT name FROM migrations');
    const appliedMigrationNames = new Set(appliedMigrations.map(m => m.name));

    // Read migration files
    const migrationFiles = (await fs.readdir(path.join(__dirname, 'migrations')))
      .filter(file => file.endsWith('.sql') && file.startsWith('0'))
      .sort();

    // Apply pending migrations
    for (const file of migrationFiles) {
      if (!appliedMigrationNames.has(file)) {
        console.log(`Applying migration: ${file}`);
        const migrationSQL = await fs.readFile(path.join(__dirname, 'migrations', file), 'utf8');
        await connection.query(migrationSQL);
        await connection.execute('INSERT INTO migrations (name) VALUES (?)', [file]);
        console.log(`✓ Applied migration: ${file}`);
      }
    }

    console.log('All migrations applied successfully!');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
