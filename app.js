const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { testConnection, getConnection } = require('./config/database');
const healthRouter = require('./routes/health');
const clientRouter = require('./routes/client.routes');
const reportRouter = require('./routes/report.routes');
const transferRouter = require('./routes/transfer.routes');
const authRouter = require('./routes/auth.routes');
const userRouter = require('./routes/user.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!require('fs').existsSync(uploadsDir)) {
  require('fs').mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make database connection available in request object
app.use(async (req, res, next) => {
  try {
    const connection = await getConnection();
    req.app.set('databaseConnection', connection);
    next();
  } catch (error) {
    console.error('Failed to get database connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database connection error',
      error: error.message 
    });
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/health', healthRouter);
app.use('/api/clients', clientRouter);
app.use('/api/reports', reportRouter);
app.use('/api/transfers', transferRouter);

// Test database connection on startup with retries
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

const initializeApp = async (retryCount = 0) => {
  try {
    console.log(`Attempting to connect to database (Attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    const isConnected = await testConnection(3, 5000); // 3 retries with 5s delay
    
    if (!isConnected) {
      throw new Error('Failed to connect to database after multiple attempts');
    }
    
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`API Base URL: http://localhost:${PORT}/api`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });
    
  } catch (error) {
    if (retryCount < MAX_RETRIES - 1) {
      console.error(`Attempt ${retryCount + 1} failed: ${error.message}`);
      console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return initializeApp(retryCount + 1);
    } else {
      console.error('Max retries reached. Could not start the application.');
      console.error('Error details:', error);
      process.exit(1);
    }
  }
};

// Start the application
initializeApp();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    status: 'error',
    message: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

module.exports = app;
