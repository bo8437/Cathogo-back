const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const UserController = require('../controllers/user.controller');

const router = express.Router();

// Protected route - only accessible by SUPER_ADMIN and ADMIN
router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'ADMIN'),
  UserController.getAllUsers
);

module.exports = router;
