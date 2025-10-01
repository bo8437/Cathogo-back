const express = require('express');
const router = express.Router();
const TransferController = require('../controllers/transfer.controller');
const { getConnection } = require('../config/database');

/**
 * @route PUT /api/transfers/:id/status
 * @description Update transfer status
 * @body {string} status - New status ('Rejected', 'En Attente', 'Approved', 'Processing')
 * @body {string} [comment] - Comment for status change (required for rejection)
 */
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, comment } = req.body;
  const connection = await getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await TransferController.updateStatus(id, status, comment, connection);
    await connection.commit();
    res.json(result);
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  } finally {
    connection.release();
  }
});

/**
 * @route GET /api/transfers/:id
 * @description Get transfer details with status history and documents
 * @param {string} id - Transfer ID or 'rejected' to get all rejected transfers
 */
router.get('/:id', async (req, res) => {
  try {
    const data = await TransferController.getTransferDetails(req.params.id);
    
    // If it's an array (rejected transfers), return as is
    // If it's a single object (single transfer), wrap in data property for consistency
    const response = Array.isArray(data)
      ? { success: true, data }
      : { success: true, data: [data] };
      
    res.json(response);
  } catch (error) {
    const status = error.message === 'Transfer not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/transfers/:id/status-history
 * @description Get status history for a transfer
 */
router.get('/:id/status-history', async (req, res) => {
  try {
    const history = await TransferController.getStatusHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/transfers/approved
 * @description Get all approved transfers
 * @returns {Object} Object containing status and data array of approved transfers
 */
router.get('/approved', async (req, res) => {
  console.log('\n=== New Request to /api/transfers/approved ===');
  let connection;
  try {
    console.log('1. Getting database connection...');
    connection = await getConnection();
    
    console.log('2. Fetching approved transfers...');
    const approvedTransfers = await TransferController.getApprovedTransfers(connection);
    
    console.log(`3. Found ${approvedTransfers.length} approved transfers`);
    
    // If no approved transfers found, return empty array with 200 status
    const response = {
      status: 'success',
      data: approvedTransfers || []
    };
    
    console.log('4. Sending response:', JSON.stringify(response, null, 2));
    res.status(200).json(response);
    
  } catch (error) {
    console.error('!!! ERROR in /api/transfers/approved !!!');
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    
    // Special handling for no results
    if (error.message.includes('No approved transfers found') || 
        (Array.isArray(error) && error.length === 0)) {
      return res.status(200).json({
        status: 'success',
        data: []
      });
    }
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        status: 'error',
        message: 'Database connection failed. Please try again later.'
      });
    }
    
    // Other errors
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        stack: error.stack
      })
    });
    
  } finally {
    if (connection) {
      try {
        console.log('5. Releasing database connection...');
        await connection.release();
        console.log('6. Database connection released');
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
    console.log('=== End of request handling ===\n');
  }
});

module.exports = router;
