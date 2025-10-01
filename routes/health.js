const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Check database connection by querying the database version
    const [rows] = await pool.query('SELECT VERSION() as version');
    
    res.status(200).json({
      status: 'success',
      message: 'API is running',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        version: rows[0].version
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

module.exports = router;
