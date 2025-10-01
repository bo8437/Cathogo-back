const fs = require('fs').promises;
const path = require('path');

class Document {
  static async create(documentData, connection) {
    const { id, clientId, originalName, fileName, filePath, fileType, fileSize } = documentData;
    
    await connection.execute(
      `INSERT INTO documents 
       (id, client_id, original_name, file_name, file_path, file_type, file_size, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, clientId, originalName, fileName, filePath, fileType, fileSize]
    );

    const [document] = await connection.execute(
      'SELECT * FROM documents WHERE id = ?',
      [id]
    );

    return document[0];
  }

  static async findByClientId(clientId, connection) {
    const [rows] = await connection.execute(
      `SELECT 
        id,
        client_id as clientId,
        original_name as originalName,
        file_name as fileName,
        file_path as filePath,
        CONCAT('http://localhost:5000', file_path) as fileUrl,
        file_type as fileType,
        file_size as fileSize,
        uploaded_at as uploadedAt
      FROM documents 
      WHERE client_id = ? 
      ORDER BY uploaded_at DESC`,
      [clientId]
    );
    return rows;
  }

  static async findById(id, connection) {
    const [rows] = await connection.execute(
      `SELECT 
        id,
        client_id as clientId,
        original_name as originalName,
        file_name as fileName,
        file_path as filePath,
        CONCAT('http://localhost:5000', file_path) as fileUrl,
        file_type as fileType,
        file_size as fileSize,
        uploaded_at as uploadedAt
      FROM documents 
      WHERE id = ?`,
      [id]
    );
    return rows[0];
  }

  static async deleteByClientId(clientId, connection) {
    // First get all documents to delete their files
    const documents = await this.findByClientId(clientId, connection);
    
    // Delete the database records
    await connection.execute(
      'DELETE FROM documents WHERE client_id = ?',
      [clientId]
    );

    // Return documents with their file paths for cleanup
    return documents;
  }
}

module.exports = Document;
