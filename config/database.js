const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const pool = mysql.createPool({
  // Connection details
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Pool settings
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 50,
  queueLimit: 100,
  waitForConnections: true,
  
  // Timeouts
  connectTimeout: 10000,      // 10 seconds to connect
  acquireTimeout: 30000,      // 30 seconds to get a connection
  timeout: 60000,             // 60 seconds query timeout
  idleTimeout: 600000,        // 10 minutes idle timeout
  
  // Connection validation
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 seconds
  
  // Connection lifecycle
  maxIdle: 10,                // Max idle connections to keep in pool
  minIdle: 2,                 // Min idle connections to maintain
  
  // Debugging and monitoring
  debug: process.env.NODE_ENV === 'development',
  
  // Type casting
  typeCast: function(field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1'; // Convert TINYINT(1) to boolean
    }
    return next();
  },
  
  // Connection settings
  charset: 'utf8mb4',
  timezone: 'local',
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
  trace: process.env.NODE_ENV === 'development',
  stringifyObjects: false,
  multipleStatements: false   // Disabled for security
});

// Handle connection events
pool.on('acquire', (connection) => {
  console.log('Connection %d acquired', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('Connection %d released', connection.threadId);
});

pool.on('enqueue', () => {
  console.log('Waiting for available connection slot');
});

// Add periodic ping to prevent timeouts
setInterval(() => {
  pool.query('SELECT 1').catch(err => {
    console.error('Database ping failed:', err);
  });
}, 30000); // Every 30 seconds

// Test the connection with retry logic
async function testConnection(retries = 5, delay = 5000) {
  let connection;
  for (let i = 0; i < retries; i++) {
    try {
      connection = await pool.getConnection();
      console.log('Successfully connected to the database');
      
      // Check if tables exist, if not create them
      await createTablesIfNotExist(connection);
      
      return true;
    } catch (error) {
      console.error(`Database connection attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        console.error('Max retries reached. Could not connect to the database.');
        return false;
      }
      
      console.log(`Retrying in ${delay/1000} seconds... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } finally {
      if (connection) await connection.release();
    }
  }
  return false;
}

async function createTablesIfNotExist(connection) {
  try {
    // Check if clients table exists
    const [tables] = await connection.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name IN ('clients', 'documents', 'transfer_status_history')`
    );

    const existingTables = tables.map(row => row.table_name);
    let needsMigration = false;

    // Run initial schema migration if needed
    if (!existingTables.includes('clients') || !existingTables.includes('documents')) {
      console.log('Running initial database migration...');
      const initialMigration = require('fs').readFileSync(
        path.join(__dirname, '../migrations/001_initial_schema.sql'),
        'utf8'
      );
      
      // Split the SQL file into individual statements
      const statements = initialMigration
        .split(';') // Split by semicolon
        .map(statement => statement.trim()) // Trim whitespace
        .filter(statement => statement.length > 0); // Remove empty statements
      
      // Execute each statement separately
      for (const statement of statements) {
        if (statement.length > 0) {
          try {
            await connection.query(statement);
          } catch (error) {
            console.error('Error executing migration statement:', error);
            console.error('Statement:', statement);
            throw error;
          }
        }
      }
      
      console.log('Initial database migration completed');
      needsMigration = true;
    }

    // Check if status column exists in clients table
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM information_schema.columns 
       WHERE table_schema = DATABASE() 
       AND table_name = 'clients' 
       AND column_name = 'status'`
    );

    // Run status column migration if needed
    if (columns.length === 0) {
      console.log('Adding status column to clients table...');
      const statusMigration = require('fs').readFileSync(
        path.join(__dirname, '../migrations/002_add_status_to_clients.sql'),
        'utf8'
      );
      
      // Split the SQL file into individual statements
      const statements = statusMigration
        .split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
      
      // Execute each statement separately
      for (const statement of statements) {
        if (statement.length > 0) {
          try {
            await connection.query(statement);
          } catch (error) {
            console.error('Error executing status migration statement:', error);
            console.error('Statement:', statement);
            throw error;
          }
        }
      }
      
      console.log('Status column migration completed');
      needsMigration = true;
    }

    // Run transfer status history migration if needed
    if (!existingTables.includes('transfer_status_history')) {
      console.log('Creating transfer status history table...');
      const statusHistoryMigration = require('fs').readFileSync(
        path.join(__dirname, '../migrations/003_add_transfer_status_history.sql'),
        'utf8'
      );
      
      // Split the SQL file into individual statements
      const statements = statusHistoryMigration
        .split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
      
      // Execute each statement separately
      for (const statement of statements) {
        if (statement.length > 0) {
          try {
            await connection.query(statement);
          } catch (error) {
            console.error('Error executing status history migration statement:', error);
            console.error('Statement:', statement);
            throw error;
          }
        }
      }
      
      console.log('Transfer status history migration completed');
      needsMigration = true;
    }
    
    return needsMigration;
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

// Get a connection with transaction support and enhanced error handling
async function getConnection() {
  const connection = await pool.getConnection();
  
  // Store the original release method
  const originalRelease = connection.release.bind(connection);
  let released = false;
  
  // Override the release method to ensure it's only called once
  connection.release = () => {
    if (!released) {
      released = true;
      console.log(`Releasing connection ${connection.threadId}`);
      originalRelease();
    }
  };

  // Set a timeout to force release the connection after a certain period
  const timeout = setTimeout(() => {
    if (!released) {
      console.warn(`Connection ${connection.threadId} was not properly released, forcing release`);
      connection.release();
    }
  }, 60000); // 60 seconds timeout

  // Clean up the timeout when the connection is released
  const release = connection.release;
  connection.release = () => {
    clearTimeout(timeout);
    return release();
  };

  // Add error handler to prevent crashing on connection errors
  connection.on('error', (err) => {
    console.error('Database connection error:', {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage
    });
    
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.');
    } else if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('Database connection timed out.');
    }
    
    // Ensure the connection is released on error
    if (!released) {
      connection.release();
    }
  });

  return connection;
}

module.exports = {
  pool,
  getConnection,
  testConnection
};
