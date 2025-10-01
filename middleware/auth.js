const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  try {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = auth.substring(7);
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    // Convert both stored and requested roles to lowercase for case-insensitive comparison
    const userRole = req.user.role?.toLowerCase();
    const allowedRoles = roles.map(role => role.toLowerCase());
    
    if (roles.length && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
