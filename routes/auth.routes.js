const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

// Authenticated
router.post('/logout', AuthController.logout);
router.get('/me', authenticate, AuthController.me);

// Admin-only
router.post('/register', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), AuthController.register);

module.exports = router;
