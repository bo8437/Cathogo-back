const { getConnection } = require('../config/database');
const Client = require('../models/client.model');
const Document = require('../models/document.model');
const path = require('path');
const fs = require('fs').promises;

class ClientController {
  static async createClient(req, res) {
    let connection;
    
    try {
      // Get database connection and start transaction
      connection = await getConnection();
      await connection.beginTransaction();
      
      // Prepare client data from form fields
      const clientData = {
        id: require('uuid').v4(),
        orderGiverName: req.body.orderGiverName,
        orderGiverAccount: req.body.orderGiverAccount,
        orderGiverAddress: req.body.orderGiverAddress,
        beneficiaryName: req.body.beneficiaryName,
        beneficiaryAccount: req.body.beneficiaryAccount,
        beneficiaryAddress: req.body.beneficiaryAddress,
        beneficiaryBankName: req.body.beneficiaryBankName,
        beneficiaryBankSwift: req.body.beneficiaryBankSwift,
        amount: req.body.amount,
        amountInWords: req.body.amountInWords,
        transferReason: req.body.transferReason,
        transferType: req.body.transferType
      };
      
      // Create client
      const clientId = await Client.create(clientData, connection);
      let documents = [];
      
      // Handle file uploads if any
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const doc = await Document.create({
            id: require('uuid').v4(),
            clientId,
            originalName: file.originalname,
            fileName: file.filename,
            filePath: `uploads/${file.filename}`,
            fileType: path.extname(file.originalname).toLowerCase(),
            fileSize: file.size
          }, connection);
          
          documents.push({
            id: doc.id,
            originalName: doc.originalName,
            filePath: doc.filePath,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            uploadedAt: doc.uploadedAt
          });
        }
      }
      
      // Commit the transaction
      await connection.commit();
      
      // Get the created client with all details
      const createdClient = await Client.findById(clientId, connection);
      
      // Get all documents for the client
      const clientDocuments = await Document.findByClientId(clientId, connection);
      
      // Send success response with all details
      res.status(201).json({
        status: 'success',
        data: {
          ...createdClient,
          documents: clientDocuments
        }
      });
      
    } catch (error) {
      // Rollback on error
      if (connection) await connection.rollback();
      
      console.error('Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
      });
      
    } finally {
      // Always release connection
      if (connection) await connection.release();
    }
  }
  
  static async getClient(req, res) {
    let connection;
    
    try {
      connection = await getConnection();
      
      // Get client by ID
      const client = await Client.findById(req.params.id, connection);
      if (!client) {
        return res.status(404).json({ status: 'error', message: 'Client not found' });
      }
      
      // Get client's documents
      const documents = await Document.findByClientId(req.params.id, connection);
      
      // Format response
      res.json({
        status: 'success',
        data: { ...client, documents }
      });
      
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to fetch client' 
      });
    } finally {
      if (connection) await connection.release();
    }
  }
  
  /**
   * Get all clients with status 'En Attente'
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPendingClients(req, res) {
    let connection;
    
    try {
      connection = await getConnection();
      
      // Get all clients with status 'En Attente'
      const clients = await Client.findByStatus('En Attente', connection);
      
      // Get document count for each client
      const clientsWithDocCount = await Promise.all(
        clients.map(async (client) => {
          const [documents] = await connection.execute(
            'SELECT COUNT(*) as count FROM documents WHERE client_id = ?',
            [client.id]
          );
          
          return {
            ...client,
            documentCount: documents[0].count || 0
          };
        })
      );
      
      res.status(200).json({
        status: 'success',
        data: clientsWithDocCount
      });
      
    } catch (error) {
      console.error('Error getting pending clients:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve pending clients',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      if (connection) {
        await connection.release();
      }
    }
  }

  static async getAllClients(req, res) {
    let connection;
    
    try {
      connection = await getConnection();
      
      // Get all clients
      const clients = await Client.findAll(connection);
      
      // Get document counts for each client
      const clientsWithCounts = await Promise.all(
        clients.map(async client => {
          const [result] = await connection.query(
            'SELECT COUNT(*) as count FROM documents WHERE client_id = ?',
            [client.id]
          );
          return { ...client, documentCount: result[0].count };
        })
      );
      
      res.json({ 
        status: 'success', 
        data: clientsWithCounts 
      });
      
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to fetch clients' 
      });
    } finally {
      if (connection) await connection.release();
    }
  }
  
  static async deleteClient(req, res) {
    let connection;
    
    try {
      connection = await getConnection();
      await connection.beginTransaction();
      
      const clientId = req.params.id;
      
      // Check if client exists
      const client = await Client.findById(clientId, connection);
      if (!client) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Client not found' 
        });
      }
      
      // Get client's documents to delete associated files
      const documents = await Document.findByClientId(clientId, connection);
      
      // Delete client's documents from database and get the documents that were deleted
      const deletedDocs = await Document.deleteByClientId(clientId, connection);
      
      // Delete the client
      await Client.delete(clientId, connection);
      
      // Commit the transaction
      await connection.commit();
      
      // Delete the actual files from the filesystem
      const deletePromises = deletedDocs.map(async (doc) => {
        try {
          // Get the relative path from the URL (removes the base URL part if present)
          let relativePath = doc.filePath;
          
          // Remove the base URL part if it exists (e.g., 'http://localhost:5000')
          const urlMatch = relativePath.match(/\/uploads\/.*/);
          if (urlMatch) {
            relativePath = urlMatch[0]; // This gives us '/uploads/filename.ext'
          }
          
          // Remove leading slash for path joining
          const pathWithoutLeadingSlash = relativePath.startsWith('/') 
            ? relativePath.substring(1) 
            : relativePath;
          
          // Construct the full file path - using the uploads volume directly
          // This works because we have the uploads volume mounted in docker-compose.yml
          const filePath = path.join(process.cwd(), pathWithoutLeadingSlash);
          
          // Check if file exists before trying to delete
          try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            console.log(`Successfully deleted file: ${filePath}`);
            return { success: true, file: relativePath };
          } catch (err) {
            if (err.code === 'ENOENT') {
              console.warn(`File not found, skipping: ${filePath}`);
              // Try alternative path (in case the file is in a different location)
              const altPath = path.join(process.cwd(), 'public', pathWithoutLeadingSlash);
              try {
                await fs.access(altPath);
                await fs.unlink(altPath);
                console.log(`Successfully deleted file from alternative path: ${altPath}`);
                return { success: true, file: relativePath, fromAlternativePath: true };
              } catch (altErr) {
                console.warn(`File not found in alternative location either: ${altPath}`);
                return { success: false, file: relativePath, error: 'File not found in any location' };
              }
            }
            throw err;
          }
        } catch (error) {
          console.error(`Error deleting file ${doc.filePath}:`, error);
          return { success: false, file: doc.filePath, error: error.message };
        }
      });
      
      // Wait for all file deletions to complete
      const deleteResults = await Promise.allSettled(deletePromises);
      
      // Count successful and failed deletions
      const results = {
        total: deleteResults.length,
        successful: deleteResults.filter(r => r.status === 'fulfilled' && r.value.success).length,
        failed: deleteResults.filter(r => r.status === 'rejected' || !r.value.success).length,
        details: deleteResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
      };
      
      res.status(200).json({
        status: 'success',
        message: 'Client and associated documents deleted successfully',
        data: {
          clientId: clientId,
          documentsDeleted: documents.length,
          filesDeleted: results
        }
      });
      
    } catch (error) {
      // Rollback on error
      if (connection) await connection.rollback();
      
      console.error('Error deleting client:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete client',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
      
    } finally {
      if (connection) await connection.release();
    }
  }

  static async updateClient(req, res) {
    let connection;
    
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Client ID is required' });
      }

      // Get database connection and start transaction
      connection = await getConnection();
      await connection.beginTransaction();
      
      // Check if client exists
      const existingClient = await Client.findById(id, connection);
      if (!existingClient) {
        await connection.rollback();
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Prepare client data from form fields
      const clientData = {
        orderGiverName: req.body.orderGiverName || existingClient.orderGiverName,
        orderGiverAccount: req.body.orderGiverAccount || existingClient.orderGiverAccount,
        orderGiverAddress: req.body.orderGiverAddress || existingClient.orderGiverAddress,
        beneficiaryName: req.body.beneficiaryName || existingClient.beneficiaryName,
        beneficiaryAccount: req.body.beneficiaryAccount || existingClient.beneficiaryAccount,
        beneficiaryAddress: req.body.beneficiaryAddress || existingClient.beneficiaryAddress,
        beneficiaryBankName: req.body.beneficiaryBankName || existingClient.beneficiaryBankName,
        beneficiaryBankSwift: req.body.beneficiaryBankSwift || existingClient.beneficiaryBankSwift,
        amount: req.body.amount || existingClient.amount,
        amountInWords: req.body.amountInWords || existingClient.amountInWords,
        transferReason: req.body.transferReason || existingClient.transferReason,
        transferType: req.body.transferType || existingClient.transferType,
        status: req.body.status || existingClient.status
      };
      
      // Update client
      const isUpdated = await Client.update(id, clientData, connection);
      
      if (!isUpdated) {
        await connection.rollback();
        return res.status(500).json({ error: 'Failed to update client' });
      }
      
      let documents = [];
      
      // Handle file uploads if any
      if (req.files && req.files.length > 0) {
        // First, delete existing documents if needed
        if (req.body.replaceDocuments === 'true') {
          const existingDocs = await Document.findByClientId(id, connection);
          for (const doc of existingDocs) {
            try {
              // Use the correct path in the container
              const filePath = path.join(__dirname, '..', doc.filePath);
              if (await fs.access(filePath).then(() => true).catch(() => false)) {
                await fs.unlink(filePath);
                console.log(`Deleted file: ${filePath}`);
              }
            } catch (err) {
              console.error('Error deleting file:', err);
              // Continue even if file deletion fails
            }
            await Document.delete(doc.id, connection);
          }
        }
        
        // Upload new documents
        for (const file of req.files) {
          const doc = await Document.create({
            id: require('uuid').v4(),
            clientId: id,
            originalName: file.originalname,
            fileName: file.filename,
            filePath: `uploads/${file.filename}`,
            fileType: path.extname(file.originalname).toLowerCase(),
            fileSize: file.size
          }, connection);
          
          documents.push({
            id: doc.id,
            originalName: doc.originalName,
            fileName: doc.fileName,
            filePath: doc.filePath,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            createdAt: doc.createdAt
          });
        }
      }
      
      await connection.commit();
      
      res.status(200).json({
        message: 'Client updated successfully',
        clientId: id,
        documents: documents.length > 0 ? documents : undefined
      });
      
    } catch (error) {
      console.error('Error updating client:', error);
      if (connection) await connection.rollback();
      res.status(500).json({ 
        error: 'Failed to update client',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      if (connection) {
        try {
          await connection.release();
        } catch (err) {
          console.error('Error releasing connection:', err);
        }
      }
    }
  }

  /**
   * Get client statistics (approved, pending, rejected, total)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getClientStats(req, res) {
    let connection;
    try {
      connection = await getConnection();
      
      // Get count of approved clients
      const [approved] = await connection.query(
        'SELECT COUNT(*) as count FROM clients WHERE status = ?',
        ['Approved']
      );

      // Get count of pending clients
      const [pending] = await connection.query(
        'SELECT COUNT(*) as count FROM clients WHERE status = ?',
        ['En Attente']
      );

      // Get count of rejected clients
      const [rejected] = await connection.query(
        'SELECT COUNT(*) as count FROM clients WHERE status = ?',
        ['Rejected']  
      );

      // Get total number of clients
      const [total] = await connection.query('SELECT COUNT(*) as count FROM clients');

      res.status(200).json({
        success: true,
        data: {
          approved: approved[0].count,
          pending: pending[0].count,
          rejected: rejected[0].count,
          total: total[0].count
        }
      });
    } catch (error) {
      console.error('Error fetching client stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching client statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      if (connection) {
        try {
          await connection.release();
        } catch (err) {
          console.error('Error releasing connection:', err);
        }
      }
    }
  }

  /**
   * Complete a transfer (mark as done)
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  static async completeTransfer(req, res) {
    const { id } = req.params;
    const { completionType, comment } = req.body;
    const files = req.files || [];
    let connection;

    if (!completionType || (completionType === 'below' && !comment)) {
      return res.status(400).json({
        success: false,
        message: 'Completion type and comment are required for transfers below 10m'
      });
    }

    if (completionType === 'above' && (!files || files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Document upload is required for transfers above 10m'
      });
    }

    try {
      connection = await getConnection();
      await connection.beginTransaction();

      // Get the client/transfer to verify status
      const [transfers] = await connection.execute(
        'SELECT status, amount FROM clients WHERE id = ?',
        [id]
      );

      if (transfers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Transfer not found'
        });
      }

      const transfer = transfers[0];

      // Verify transfer is approved
      if (transfer.status !== 'Approved') {
        return res.status(400).json({
          success: false,
          message: 'Only approved transfers can be marked as done'
        });
      }

      // Update transfer status to Done
      await connection.execute(
        'UPDATE clients SET status = ?, updated_at = NOW() WHERE id = ?',
        ['Done', id]
      );

      // Handle document upload if this is an above-10m transfer
      let documents = [];
      if (completionType === 'above' && files && files.length > 0) {
        for (const file of files) {
          const doc = await Document.create({
            id: require('uuid').v4(),
            clientId: id,
            originalName: file.originalname,
            fileName: file.filename,
            filePath: `uploads/${file.filename}`,
            fileType: path.extname(file.originalname).toLowerCase(),
            fileSize: file.size,
            documentType: 'completion_document'
          }, connection);
          documents.push(doc);
        }
      }

      // Create status history record
      const statusComment = completionType === 'below' 
        ? `Marked as done (Below 10m): ${comment}`
        : `Marked as done (Above 10m) with ${files.length} document(s)`;

      await connection.execute(
        'INSERT INTO transfer_status_history (transfer_id, status, comment, created_at) VALUES (?, ?, ?, NOW())',
        [id, 'Done', statusComment]
      );

      await connection.commit();

      // Get the updated transfer
      const [updatedTransfer] = await connection.execute(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      );

      res.status(200).json({
        success: true,
        message: 'Transfer marked as done successfully',
        data: { 
          status: 'Done',
          documents,
          transfer: updatedTransfer[0]
        }
      });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error completing transfer:', error);
      res.status(500).json({
        success: false,
        message: 'Error completing transfer',
        error: error.message
      });
    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * Get all completed transfers (status = 'Done')
   */
  static async getCompletedTransfers(req, res) {
    let connection;
    try {
      connection = await getConnection();
      
      console.log('Fetching completed transfers...');
      
      // First, get all transfers with status 'Done'
      const [transfers] = await connection.execute(
        `SELECT 
          c.id,
          c.order_giver_name as orderGiverName,
          c.order_giver_account as orderGiverAccount,
          c.order_giver_address as orderGiverAddress,
          c.beneficiary_name as beneficiaryName,
          c.beneficiary_account as beneficiaryAccount,
          c.beneficiary_address as beneficiaryAddress,
          c.beneficiary_bank_name as beneficiaryBankName,
          c.beneficiary_bank_swift as beneficiaryBankSwift,
          c.amount,
          c.amount_in_words as amountInWords,
          c.transfer_reason as transferReason,
          c.transfer_type as transferType,
          c.status,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          (SELECT tsh.status 
           FROM transfer_status_history tsh 
           WHERE tsh.transfer_id = c.id 
           ORDER BY tsh.created_at DESC 
           LIMIT 1) as currentStatus
        FROM clients c
        WHERE c.status = 'Done'
        ORDER BY c.updated_at DESC`
      );

      console.log(`Found ${transfers.length} completed transfers`);
      
      // Get documents and status history for each transfer
      for (const transfer of transfers) {
        try {
          // Get documents
          console.log(`Fetching documents for transfer ${transfer.id}`);
          const [documents] = await connection.execute(
            `SELECT 
              id, 
              original_name as originalName, 
              file_name as fileName, 
              file_type as fileType, 
              file_size as fileSize, 
              uploaded_at as createdAt 
            FROM documents 
            WHERE client_id = ?`,
            [transfer.id]
          );
          transfer.documents = documents || [];
          console.log(`Found ${documents.length} documents for transfer ${transfer.id}`);

          // Get status history
          console.log(`Fetching status history for transfer ${transfer.id}`);
          const [statusHistory] = await connection.execute(
            `SELECT 
              id, 
              status, 
              comment, 
              created_at as createdAt 
            FROM transfer_status_history 
            WHERE transfer_id = ? 
            ORDER BY created_at DESC`,
            [transfer.id]
          );
          transfer.statusHistory = statusHistory || [];
          console.log(`Found ${statusHistory.length} status history entries for transfer ${transfer.id}`);
          
        } catch (error) {
          console.error(`Error processing transfer ${transfer.id}:`, error);
          transfer.documents = [];
          transfer.statusHistory = [];
        }
      }

      res.json(transfers);
    } catch (error) {
      console.error('Error fetching completed transfers:', error);
      res.status(500).json({ message: 'Failed to fetch completed transfers', error: error.message });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
}

module.exports = ClientController;
