const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  if (!email || !password) {
    console.error('Please set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in environment variables');
    process.exit(1);
  }

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'Transfers_db',
    multipleStatements: true,
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Ensure users table exists
    await connection.execute(
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;`
    );

    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      console.log('SUPER_ADMIN already exists:', email);
      process.exit(0);
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute(
      'INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
      [id, email, passwordHash, name, 'SUPER_ADMIN']
    );

    console.log('SUPER_ADMIN created:', { email, name, role: 'SUPER_ADMIN' });
    process.exit(0);
  } catch (err) {
    console.error('Error seeding SUPER_ADMIN:', err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
})();
