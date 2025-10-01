const bcrypt = require('bcryptjs');

class UserModel {
  static async findByEmail(email, connection) {
    const [rows] = await connection.execute(
      `SELECT id, email, password_hash as passwordHash, name, role, is_active as isActive, created_at as createdAt, updated_at as updatedAt
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  static async findById(id, connection) {
    const [rows] = await connection.execute(
      `SELECT id, email, name, role, is_active as isActive, created_at as createdAt, updated_at as updatedAt
       FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async create({ email, password, name, role }, connection) {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [id, email, passwordHash, name || null, role]
    );
    // Return the generated UUID
    return id;
  }

  static async setActive(id, isActive, connection) {
    const [result] = await connection.execute(
      `UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?`,
      [isActive ? 1 : 0, id]
    );
    return result.affectedRows > 0;
  }

  static async updateRole(id, role, connection) {
    const [result] = await connection.execute(
      `UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?`,
      [role, id]
    );
    return result.affectedRows > 0;
  }

  // Refresh token storage (hashed)
  static async storeRefreshToken({ userId, tokenHash, userAgent, ip, expiresAt }, connection) {
    await connection.execute(
      `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, tokenHash, userAgent || null, ip || null, expiresAt]
    );
  }

  static async revokeRefreshToken({ userId, tokenHash }, connection) {
    await connection.execute(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND token_hash = ? AND revoked_at IS NULL`,
      [userId, tokenHash]
    );
  }

  static async isRefreshTokenValid({ userId, tokenHash }, connection) {
    const [rows] = await connection.execute(
      `SELECT id FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
      [userId, tokenHash]
    );
    return rows.length > 0;
  }
}

module.exports = UserModel;
