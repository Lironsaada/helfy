const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initializeDatabase() {
  console.log('Starting database initialization...');

  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 4000,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'authdb'
    });

    console.log('Connected to database');

    // Check if default user already exists
    const [users] = await connection.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      ['admin', 'admin@example.com']
    );

    if (users.length > 0) {
      console.log('Default user already exists');
      await connection.end();
      return;
    }

    // Create default user
    const defaultEmail = 'admin@example.com';
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';

    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await connection.query(
      'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)',
      [defaultEmail, defaultUsername, passwordHash]
    );

    console.log('Default user created successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Email: admin@example.com');

    await connection.end();
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

initializeDatabase();
