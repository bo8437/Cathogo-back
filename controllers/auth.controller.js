const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getConnection } = require('../config/database');
const User = require('../models/user.model');

const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || '7d';

const isProd = process.env.NODE_ENV === 'production';
function errorResponse(res, httpCode, userMessage, err, context = {}) {
  const payload = { success: false, message: userMessage };
  if (!isProd && err) {
    payload.error = { name: err.name, message: err.message, ...context };
  }
  return res.status(httpCode).json(payload);
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAME_SITE || (isProd ? 'Lax' : 'Lax');
  const secure = (process.env.COOKIE_SECURE || (isProd ? 'true' : 'false')) === 'true';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
  };
}

class AuthController {
  static async register(req, res) {
    const { email, password, name, role } = req.body;
    if (!email || !password || !role) {
      console.warn('[AUTH][REGISTER] Missing required fields', { email: !!email, role: !!role });
      return res.status(400).json({ success: false, message: 'email, password and role are required' });
    }

    // Only admins can register new users - case-insensitive check
    const allowedRoles = ['super_admin', 'admin'];
    if (!req.user || !allowedRoles.includes(req.user.role?.toLowerCase())) {
      console.warn('[AUTH][REGISTER] Forbidden - role:', req.user?.role);
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let connection;
    try {
      connection = await getConnection();
      const existing = await User.findByEmail(email, connection);
      if (existing) {
        console.warn('[AUTH][REGISTER] User exists', { email });
        return res.status(409).json({ success: false, message: 'User already exists' });
      }

      // Create user; model handles hashing and works for AUTO_INCREMENT or UUID schemas
      const createdId = await User.create({ email, password, name, role }, connection);
      const created = await User.findByEmail(email, connection);
      const id = created?.id ?? createdId;
      console.log('[AUTH][REGISTER] Created user', { id, email, role });
      res.status(201).json({ success: true, message: 'User created', data: { id, email, name, role } });
    } catch (err) {
      console.error('[AUTH][REGISTER] Error:', err);
      return errorResponse(res, 500, 'Internal server error', err);
    } finally {
      if (connection) connection.release();
    }
  }

  static async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      console.warn('[AUTH][LOGIN] Missing email or password');
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    let connection;
    try {
      if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
        console.error('[AUTH][LOGIN] Missing JWT secrets');
        return errorResponse(res, 500, 'Server configuration error', new Error('Missing JWT secrets'));
      }

      connection = await getConnection();
      console.log('[AUTH][LOGIN] Finding user by email', { email });
      const user = await User.findByEmail(email, connection);
      if (!user || !user.isActive) {
        console.warn('[AUTH][LOGIN] User not found or inactive', { email, isActive: user?.isActive });
        return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'USER_NOT_FOUND_OR_INACTIVE' });
      }

      console.log('[AUTH][LOGIN] Comparing password hash');
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        console.warn('[AUTH][LOGIN] Invalid password');
        return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'BAD_PASSWORD' });
      }

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);
      const tokenHash = hashToken(refreshToken);

      // Persist refresh token
      const ua = req.headers['user-agent'];
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const expiresAt = new Date(Date.now() + parseDurationToMs(REFRESH_TOKEN_EXPIRES));
      await User.storeRefreshToken({ userId: user.id, tokenHash, userAgent: ua, ip, expiresAt }, connection);

      // Set cookie
      res.cookie('refresh_token', refreshToken, { ...cookieOptions(), expires: expiresAt });

      res.json({
        success: true,
        data: {
          accessToken,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        }
      });
    } catch (err) {
      console.error('[AUTH][LOGIN] Error:', err);
      return errorResponse(res, 500, 'Internal server error', err);
    } finally {
      if (connection) connection.release();
    }
  }

  static async me(req, res) {
    // Requires authenticate middleware to set req.user
    console.log('[AUTH][ME] Returning user', { id: req.user?.id, email: req.user?.email, role: req.user?.role });
    res.json({ success: true, data: req.user });
  }

  static async refresh(req, res) {
    const token = req.cookies?.refresh_token;
    if (!token) {
      console.warn('[AUTH][REFRESH] No refresh token cookie');
      return res.status(401).json({ success: false, message: 'No refresh token', code: 'NO_REFRESH_COOKIE' });
    }

    let connection;
    try {
      console.log('[AUTH][REFRESH] Verifying refresh token');
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      connection = await getConnection();

      const user = await User.findById(payload.sub, connection);
      if (!user || !user.isActive) {
        console.warn('[AUTH][REFRESH] Invalid user', { userExists: !!user, isActive: user?.isActive });
        return res.status(401).json({ success: false, message: 'Invalid user', code: 'INVALID_USER' });
      }

      const tokenHash = hashToken(token);
      const valid = await User.isRefreshTokenValid({ userId: user.id, tokenHash }, connection);
      if (!valid) {
        console.warn('[AUTH][REFRESH] Stored token not found or expired');
        return res.status(401).json({ success: false, message: 'Invalid refresh token', code: 'REFRESH_NOT_FOUND' });
      }

      // Rotate refresh token
      await User.revokeRefreshToken({ userId: user.id, tokenHash }, connection);

      const newAccess = signAccessToken(user);
      const newRefresh = signRefreshToken(user);
      const newHash = hashToken(newRefresh);
      const ua = req.headers['user-agent'];
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const expiresAt = new Date(Date.now() + parseDurationToMs(REFRESH_TOKEN_EXPIRES));
      await User.storeRefreshToken({ userId: user.id, tokenHash: newHash, userAgent: ua, ip, expiresAt }, connection);

      res.cookie('refresh_token', newRefresh, { ...cookieOptions(), expires: expiresAt });
      res.json({ success: true, data: { accessToken: newAccess } });
    } catch (err) {
      console.error('[AUTH][REFRESH] Error:', err);
      return errorResponse(res, 401, 'Could not refresh token', err);
    } finally {
      if (connection) connection.release();
    }
  }

  static async logout(req, res) {
    const token = req.cookies?.refresh_token;
    if (!token) {
      console.log('[AUTH][LOGOUT] No refresh token cookie');
      return res.json({ success: true });
    }

    let connection;
    try {
      connection = await getConnection();
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      const tokenHash = hashToken(token);
      await User.revokeRefreshToken({ userId: payload.sub, tokenHash }, connection);
    } catch (err) {
      // Ignore errors during logout
      console.warn('[AUTH][LOGOUT] Warning:', err.message);
    } finally {
      if (connection) connection.release();
    }

    res.clearCookie('refresh_token', { ...cookieOptions(), expires: new Date(0) });
    res.json({ success: true });
  }
}

function parseDurationToMs(str) {
  // Supports formats like '15m', '7d', '1h'
  const match = String(str).match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

module.exports = AuthController;
