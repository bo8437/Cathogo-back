const { getConnection } = require('../config/database');
const User = require('../models/user.model');

class UserController {
  /**
   * Get all users with their email, name, and role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllUsers(req, res) {
    let connection;
    try {
      connection = await getConnection();
      
      // Query to get all users with required fields
      const [users] = await connection.execute(
        `SELECT id, email, name, role, is_active as isActive, 
                created_at as createdAt, updated_at as updatedAt 
         FROM users 
         ORDER BY created_at DESC`
      );

      return res.status(200).json({
        success: true,
        data: users,
        count: users.length
      });

    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      if (connection) {
        try {
          await connection.release();
        } catch (e) {
          console.error('Error releasing connection:', e);
        }
      }
    }
  }
}

module.exports = UserController;
