const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const log4js = require('log4js');
const { initDatabase, getPool } = require('./db');
require('dotenv').config();

// Configure log4js
log4js.configure({
  appenders: {
    console: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: '%d{ISO8601} [%p] %c - %m'
      }
    },
    jsonConsole: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: '%m'
      }
    }
  },
  categories: {
    default: { appenders: ['console'], level: 'info' },
    userActivity: { appenders: ['jsonConsole'], level: 'info' }
  }
});

const logger = log4js.getLogger('default');
const userActivityLogger = log4js.getLogger('userActivity');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Authentication middleware
async function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT t.*, u.id as user_id, u.email, u.username FROM tokens t JOIN users u ON t.user_id = u.id WHERE t.token = ?',
      [token]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    const tokenData = rows[0];

    // Check if token has expired (if expires_at is set)
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Token expired' });
    }

    req.user = {
      id: tokenData.user_id,
      email: tokenData.email,
      username: tokenData.username
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Routes

// Register new user
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;

  // Validation
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const pool = getPool();

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)',
      [email, username, passwordHash]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const pool = getPool();

    // Find user by username or email
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = uuidv4();

    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Store token in database
    await pool.query(
      'INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    // Log user activity in JSON format
    const ipAddress = req.headers['x-forwarded-for'] ||
                      req.headers['x-real-ip'] ||
                      req.connection.remoteAddress ||
                      req.socket.remoteAddress;

    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      action: 'login',
      ipAddress: ipAddress,
      email: user.email
    };

    userActivityLogger.info(JSON.stringify(logEntry));

    res.json({
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', authenticateToken, async (req, res) => {
  const token = req.headers['authorization'];

  try {
    const pool = getPool();

    // Delete token from database
    await pool.query('DELETE FROM tokens WHERE token = ?', [token]);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user (protected route example)
app.get('/api/me', authenticateToken, async (req, res) => {
  res.json({
    user: req.user
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
