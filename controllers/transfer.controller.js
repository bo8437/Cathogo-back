const { getConnection } = require('../config/database');
const Client = require('../models/client.model');

class TransferController {
  /**
   * Update transfer status
   * @param {string} clientId - The ID of the client/transfer
   * @param {string} status - New status ('Rejected', 'En Attente', 'Approved', 'Processing')
   * @param {string} comment - Comment for status change (required for rejection)
   * @param {object} connection - Database connection (optional)
   */
  static async updateStatus(clientId, status, comment = null, connection = null) {
    const shouldReleaseConnection = !connection;
    
    try {
      // If no connection was provided, get a new one
      if (!connection) {
        connection = await getConnection();
      }

      // Get current transfer
      const [transfers] = await connection.execute(
        'SELECT status FROM clients WHERE id = ?',
        [clientId]
      );

      if (transfers.length === 0) {
        throw new Error('Transfer not found');
      }

      const currentStatus = transfers[0].status;
      
      // Validate status transition
      this.validateStatusTransition(currentStatus, status, comment);

      // Update status
      await connection.execute(
        'UPDATE clients SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, clientId]
      );

      // Create a status change record
      if (status === 'Rejected' && comment) {
        await connection.execute(
          'INSERT INTO transfer_status_history (transfer_id, status, comment, created_at) VALUES (?, ?, ?, NOW())',
          [clientId, status, comment]
        );
      } else {
        await connection.execute(
          'INSERT INTO transfer_status_history (transfer_id, status, created_at) VALUES (?, ?, NOW())',
          [clientId, status]
        );
      }

      // If this is a new connection, commit the transaction
      if (shouldReleaseConnection) {
        await connection.commit();
      }

      return { success: true, message: `Status updated to ${status}` };
    } catch (error) {
      // If this is a new connection, rollback the transaction
      if (shouldReleaseConnection && connection) {
        await connection.rollback();
      }
      throw error;
    } finally {
      // If we created a new connection, release it
      if (shouldReleaseConnection && connection) {
        connection.release();
      }
    }
  }

  /**
   * Validate status transition
   * @private
   */
  static validateStatusTransition(currentStatus, newStatus, comment) {
    const validTransitions = {
      'En Attente': ['Approved', 'Rejected'],
      'Rejected': ['En Attente'],
      'Approved': ['Processing'],
      'Processing': ['Completed', 'Failed']
    };

    // Check if the transition is valid
    const allowedNextStatuses = validTransitions[currentStatus] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    // Require comment for rejection
    if (newStatus === 'Rejected' && !comment) {
      throw new Error('Comment is required when rejecting a transfer');
    }
  }

  /**
   * Get transfer status history
   * @param {string} transferId - The ID of the transfer
   */
  static async getStatusHistory(transferId) {
    const [history] = await (await getConnection()).execute(
      'SELECT status, comment, created_at as timestamp ' +
      'FROM transfer_status_history ' +
      'WHERE transfer_id = ? ' +
      'ORDER BY created_at DESC',
      [transferId]
    );
    
    return history;
  }

  /**
   * Get transfer details with current status and documents
   * If transferId is 'rejected' or 'approved', returns all transfers with that status
   * @param {string} transferId - The ID of the transfer or 'rejected'/'approved' to filter by status
   */
  static async getTransferDetails(transferId) {
    const connection = await getConnection();
    try {
      // Handle request for transfers by status
      const statusFilter = transferId.toLowerCase();
      if (statusFilter === 'rejected' || statusFilter === 'approved') {
        const [filteredTransfers] = await connection.execute(
          'SELECT * FROM clients WHERE status = ?',
          [statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)]
        );

        // Get documents and history for all filtered transfers
        const transfersWithDetails = await Promise.all(
          filteredTransfers.map(async (transfer) => {
            const [documents] = await connection.execute(
              'SELECT id, original_name as originalName, file_name as fileName, ' +
              'file_path as filePath, file_type as fileType, file_size as fileSize, ' +
              'uploaded_at as uploadedAt ' +
              'FROM documents WHERE client_id = ?',
              [transfer.id]
            );
            
            const history = await this.getStatusHistory(transfer.id);
            
            return {
              ...transfer,
              statusHistory: history,
              documents: documents || []
            };
          })
        );

        return transfersWithDetails;
      }
      
      // Handle request for a single transfer by ID
      const [transfers] = await connection.execute(
        'SELECT * FROM clients WHERE id = ?',
        [transferId]
      );

      if (transfers.length === 0) {
        throw new Error('Transfer not found');
      }

      const transfer = transfers[0];
      const history = await this.getStatusHistory(transferId);
      
      const [documents] = await connection.execute(
        'SELECT id, original_name as originalName, file_name as fileName, ' +
        'file_path as filePath, file_type as fileType, file_size as fileSize, ' +
        'uploaded_at as uploadedAt ' +
        'FROM documents WHERE client_id = ?',
        [transferId]
      );

      return {
        ...transfer,
        statusHistory: history,
        documents: documents || []
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Get all approved transfers
   * @param {object} connection - Database connection (optional)
   * @returns {Promise<Array>} - List of approved transfers
   */
  static async getApprovedTransfers(connection = null) {
    let shouldReleaseConnection = false;
    
    try {
      console.log('Starting getApprovedTransfers...');
      
      // Get a new connection if none was provided
      if (!connection) {
        console.log('Acquiring new database connection...');
        connection = await getConnection();
        shouldReleaseConnection = true;
      }

      // Verify the connection is still alive
      await connection.ping();
      console.log('Database connection verified');

      console.log('Executing simplified query to debug...');
      
      // First, let's check if the clients table exists and has data
      const [tables] = await connection.query("SHOW TABLES LIKE 'clients'");
      console.log('Tables found:', tables);
      
      if (tables.length === 0) {
        console.error('clients table does not exist');
        return [];
      }
      
      // Check if there are any approved transfers
      const [statusCheck] = await connection.query(
        'SELECT status, COUNT(*) as count FROM clients GROUP BY status'
      );
      console.log('Status counts:', statusCheck);
      
      // Simplified query to get approved transfers
      const [transfers] = await connection.query(
        'SELECT * FROM clients WHERE status = ?',
        ['Approved']
      );
      
      console.log('Raw query result:', JSON.stringify(transfers, null, 2));
      console.log(`Found ${transfers.length} approved transfers`);
      
      // For now, just return the basic transfer data without document counts
      const transfersWithDocuments = transfers.map(transfer => ({
        ...transfer,
        documentCount: 0 // We'll add document counting back once we confirm the basic query works
      }));

      return transfersWithDocuments;
    } catch (error) {
      console.error('Error in getApprovedTransfers:', {
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage,
        stack: error.stack
      });
      
      // Handle common Docker/connection issues
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Database connection failed. Please check if the database container is running and accessible.');
      }
      
      if (error.code === 'PROTOCOL_CONNECTION_LOST') {
        throw new Error('Database connection was closed. Please try again.');
      }
      
      throw new Error('Failed to fetch approved transfers: ' + (error.sqlMessage || error.message));
    } finally {
      if (shouldReleaseConnection && connection) {
        console.log('Releasing database connection...');
        try {
          await connection.release();
        } catch (releaseError) {
          console.error('Error releasing connection:', releaseError);
        }
      }
    }
  }
}

module.exports = TransferController;
