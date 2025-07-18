const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            console.error('No token provided');
            return res.status(401).json({ message: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId);
            
            if (!req.user) {
                console.error(`User not found for ID: ${decoded.userId}`);
                return res.status(401).json({ 
                    message: 'User not found',
                    error: 'Invalid user ID in token'
                });
            }

            console.log('Authenticated user:', {
                id: req.user._id,
                role: req.user.role
            });
            
            next();
        } catch (jwtError) {
            console.error('JWT verification failed:', jwtError);
            return res.status(401).json({ 
                message: 'Invalid token',
                error: jwtError.message
            });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ 
            message: 'Authentication failed',
            error: error.message
        });
    }
};

const roleCheck = (allowedRoles) => {
    return (req, res, next) => {
        console.log('Checking role:', {
            currentRole: req.user.role,
            allowedRoles: allowedRoles
        });
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'Access denied',
                error: `Role ${req.user.role} is not allowed. Allowed roles: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
};

module.exports = { auth, roleCheck };
