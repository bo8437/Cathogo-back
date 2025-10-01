const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/client.controller');
const ReportController = require('../controllers/report.controller');
const { validateClient } = require('../middleware/validation');
const handleUploads = require('../middleware/upload');

// Create a new client with document uploads
router.post(
  '/',
  handleUploads, // Handle file uploads first
  (req, res, next) => {
    // Combine form fields and file info
    req.body = { ...req.body, files: req.files };
    next();
  },
  validateClient, // Then validate
  ClientController.createClient // Finally process
);
// Get all clients
router.get('/', ClientController.getAllClients);

// Get client statistics
router.get('/stats', ClientController.getClientStats);

// Get all pending clients
router.get('/pending', ClientController.getPendingClients);
// Get a specific client by ID
router.get('/:id', ClientController.getClient);
// Delete a client by ID
router.delete('/:id', ClientController.deleteClient);

// Update a client by ID with optional document uploads
router.put(
  '/:id',
  handleUploads, // Handle file uploads first
  (req, res, next) => {
    // Combine form fields and file info
    req.body = { ...req.body, files: req.files };
    next();
  },
  ClientController.updateClient
);

// Complete a transfer (mark as done)
router.post(
  '/:id/complete',
  handleUploads,
  (req, res, next) => {
    // Combine form fields and file info
    req.body = { ...req.body, files: req.files };
    next();
  },
  ClientController.completeTransfer
);

// Get all completed transfers
router.get('/completed/transfers', ClientController.getCompletedTransfers);

module.exports = router;
