const Client = require('../models/Client');
const Document = require('../models/Document');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { auth } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, JPEG, and PNG files are allowed'));
        }
    }
});

// Create client
exports.createClient = async (req, res) => {
    try {
        // Validate user
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const { name, beneficiary, domiciliation, currency, amount, reason, physicalDepositDate } = req.body;
        
        // Validate input
        if (!name || !beneficiary || !domiciliation || !currency || !amount || !reason || !physicalDepositDate) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Create new client
        const client = new Client({
            name,
            beneficiary,
            domiciliation,
            currency,
            amount,
            reason,
            physicalDepositDate: new Date(physicalDepositDate),
            createdBy: req.user._id
        });

        await client.save();

        res.status(201).json({
            message: 'Client created successfully',
            client
        });
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Upload document
exports.uploadDocument = upload.single('document');
exports.uploadDocumentHandler = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { clientId } = req.body;
        if (!clientId) {
            return res.status(400).json({ message: 'Client ID is required' });
        }

        // Validate user
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Create document record
        const document = new Document({
            fileName: req.file.originalname,
            filePath: req.file.path,
            fileType: req.file.mimetype,
            uploadedBy: req.user._id,
            client: clientId
        });

        await document.save();

        // Add document reference to client
        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        client.documents.push(document._id);
        await client.save();

        res.status(201).json({
            message: 'Document uploaded successfully',
            document
        });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all clients for current user
exports.getClients = async (req, res) => {
    try {
        const clients = await Client.find({ createdBy: req.user._id })
            .populate('documents')
            .sort({ createdAt: -1 });

        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get client by ID
exports.getClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id)
            .populate('documents')
            .populate('comments.createdBy', 'name email role')
            .populate('createdBy', 'name email role')
            .populate('lastModifiedBy', 'name email role');

        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        res.json(client);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Treasury OPS endpoints

// Get all Treasury Officers
exports.getTreasuryOfficers = async (req, res) => {
    try {
        // Only Treasury OPS can access this endpoint
        if (!req.user || !req.user.role || req.user.role !== 'Treasury OPS') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const officers = await User.find({
            role: 'Treasury Officer'
        }).select('-password');

        res.status(200).json({ officers });
    } catch (error) {
        console.error('Error getting Treasury Officers:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Download document
exports.downloadDocument = async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '../uploads', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        
        // Set appropriate headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stats.size);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ message: 'Error downloading file', error: error.message });
    }
};

// Get all clients waiting for review
exports.getWaitingClients = async (req, res) => {
    try {
        // Only Treasury OPS can access this endpoint
        if (!req.user || !req.user.role || req.user.role !== 'Treasury OPS') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get all clients with status 'waiting'
        const clients = await Client.find({ 
            status: 'waiting'
        })
        .populate('createdBy', 'email')
        .sort({ createdAt: -1 })
        .lean();

        // Add metadata about each client
        const clientsWithMetadata = clients.map(client => ({
            ...client,
            createdAt: client.createdAt.toISOString(),
            createdByEmail: client.createdBy?.email || 'Unknown',
            daysWaiting: Math.floor((new Date() - new Date(client.createdAt)) / (1000 * 60 * 60 * 24))
        }));

        res.status(200).json({
            clients: clientsWithMetadata,
            count: clients.length,
            message: 'Successfully retrieved waiting clients'
        });
    } catch (error) {
        console.error('Error getting waiting clients:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

// Send client back to Agent OPS with comment
exports.sendBackToAgent = async (req, res) => {
    try {
        // Only Treasury OPS can access this endpoint
        if (!req.user || !req.user.role || req.user.role !== 'Treasury OPS') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { clientId, comment } = req.body;
        if (!clientId || !comment) {
            return res.status(400).json({ message: 'Client ID and comment are required' });
        }

        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Remove client ownership check since Treasury OPS should be able to send back any client

        // Add comment
        client.comments.push({
            text: comment,
            createdBy: req.user._id
        });

        // Update status
        client.status = 'waiting';
        client.lastModifiedBy = req.user._id;

        await client.save();

        res.status(200).json({
            message: 'Client sent back to Agent successfully',
            client
        });
    } catch (error) {
        console.error('Error sending client back:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Forward client to Treasury Officer
exports.forwardToTreasuryOfficer = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Treasury OPS') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Treasury OPS can forward clients'
            });
        }

        const { clientId, treasuryOfficerId, comment } = req.body;
        
        // Validate required fields
        if (!clientId) {
            return res.status(400).json({ 
                message: 'Client ID is required',
                error: 'clientId is missing'
            });
        }
        if (!treasuryOfficerId) {
            return res.status(400).json({ 
                message: 'Treasury Officer ID is required',
                error: 'treasuryOfficerId is missing'
            });
        }
        if (!comment) {
            return res.status(400).json({ 
                message: 'Comment is required',
                error: 'comment is missing'
            });
        }

        // Validate client exists and is in waiting state
        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ 
                message: 'Client not found',
                error: `Client with ID ${clientId} does not exist`
            });
        }
        if (client.status !== 'waiting') {
            return res.status(400).json({ 
                message: 'Invalid client status',
                error: 'Client must be in waiting state to be forwarded'
            });
        }

        // Validate Treasury Officer exists
        const officer = await User.findById(treasuryOfficerId);
        if (!officer) {
            return res.status(404).json({ 
                message: 'Treasury Officer not found',
                error: `Treasury Officer with ID ${treasuryOfficerId} does not exist`
            });
        }
        if (officer.role !== 'Treasury Officer') {
            return res.status(400).json({ 
                message: 'Invalid Treasury Officer',
                error: 'Selected user is not a Treasury Officer'
            });
        }

        // Add comment to client history
        client.comments.push({
            text: comment,
            createdBy: req.user._id,
            createdAt: new Date()
        });

        // Update client status and assign to Treasury Officer
        client.status = 'processing';
        client.lastModifiedBy = treasuryOfficerId;
        client.updatedAt = new Date();

        // Save changes
        await client.save();

        res.status(200).json({
            message: 'Client forwarded to Treasury Officer successfully',
            client: {
                ...client.toObject(),
                _id: client.id
            }
        });
    } catch (error) {
        console.error('Error forwarding to Treasury Officer:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

// Treasury Officer endpoints

exports.getAssignedClients = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Treasury Officer') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const clients = await Client.find({
            lastModifiedBy: req.user._id,
            status: 'processing'
        }).populate('createdBy', 'name role')
           .populate('lastModifiedBy', 'name role');

        res.status(200).json({ clients });
    } catch (error) {
        console.error('Error getting assigned clients:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.changeClientStatus = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Treasury Officer') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { clientId, status, comment } = req.body;
        
        // Validate required fields
        if (!clientId || !status || !comment) {
            return res.status(400).json({ 
                message: 'All fields are required',
                error: 'clientId, status, and comment are required'
            });
        }

        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ 
                message: 'Client not found',
                error: `Client with ID ${clientId} does not exist`
            });
        }

        // Check if client is assigned to this user
        if (client.lastModifiedBy.toString() !== req.user._id) {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Client is not assigned to you'
            });
        }

        // Add comment
        client.comments.push({
            text: comment,
            createdBy: req.user._id,
            createdAt: new Date()
        });

        // Update status
        client.status = status;
        client.lastModifiedBy = req.user._id;
        client.updatedAt = new Date();

        await client.save();

        res.status(200).json({
            message: 'Client status updated successfully',
            client: {
                ...client.toObject(),
                _id: client.id
            }
        });
    } catch (error) {
        console.error('Error changing client status:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

// Trade Desk endpoints

// Get all completed clients for Trade Desk
exports.getTradeDeskCompletedClients = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Trade Desk') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Trade Desk users can access this endpoint'
            });
        }

        // Get all clients with status 'completed'
        const clients = await Client.find({
            status: 'completed'
        })
        .populate('createdBy', 'name role')
        .populate('lastModifiedBy', 'name role')
        .sort({ updatedAt: -1 });

        res.status(200).json({ 
            success: true,
            count: clients.length,
            clients 
        });
    } catch (error) {
        console.error('Error getting Trade Desk completed clients:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};


exports.getTradeDeskAssignedClients = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Trade Desk') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Trade Desk users can access this endpoint'
            });
        }

        // Get clients forwarded to Trade Desk
        const clients = await Client.find({
            status: 'waiting'
        })
        .populate('createdBy', 'name role')
        .populate('lastModifiedBy', 'name role');

        res.status(200).json({ clients });
    } catch (error) {
        console.error('Error getting Trade Desk assigned clients:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

exports.changeTradeDeskClientStatus = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Trade Desk') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Trade Desk users can change client status'
            });
        }

        const { clientId, status, comment } = req.body;
        
        // Validate required fields
        if (!clientId || !status || !comment) {
            return res.status(400).json({ 
                message: 'All fields are required',
                error: 'clientId, status, and comment are required'
            });
        }

        // Validate status
        if (status !== 'completed') {
            return res.status(400).json({
                message: 'Invalid status',
                error: 'Status must be "completed"'
            });
        }

        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ 
                message: 'Client not found',
                error: `Client with ID ${clientId} does not exist`
            });
        }

        // Add comment
        client.comments.push({
            text: comment,
            createdBy: req.user._id,
            createdAt: new Date()
        });

        // Update status
        client.status = status;
        client.lastModifiedBy = req.user._id;
        client.updatedAt = new Date();

        await client.save();

        res.status(200).json({
            message: 'Client status updated successfully',
            client: {
                ...client.toObject(),
                _id: client.id
            }
        });
    } catch (error) {
        console.error('Error changing Trade Desk client status:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

exports.deleteTradeDeskClient = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Trade Desk') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Trade Desk users can delete clients'
            });
        }

        const { clientId } = req.body;
        
        if (!clientId) {
            return res.status(400).json({ 
                message: 'Client ID is required',
                error: 'clientId is missing'
            });
        }

        // First check if client exists
        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ 
                message: 'Client not found',
                error: `Client with ID ${clientId} does not exist`
            });
        }

        // Delete the client
        await Client.deleteOne({ _id: clientId });

        // Return a success message without the client object
        res.status(200).json({
            message: 'Client deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting Trade Desk client:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

exports.addTradeDeskNote = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Trade Desk') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Trade Desk users can add notes'
            });
        }

        const { clientId, note } = req.body;
        
        if (!clientId || !note) {
            return res.status(400).json({ 
                message: 'All fields are required',
                error: 'clientId and note are required'
            });
        }

        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ 
                message: 'Client not found',
                error: `Client with ID ${clientId} does not exist`
            });
        }

        // Add note
        client.comments.push({
            text: note,
            createdBy: req.user._id,
            createdAt: new Date()
        });

        await client.save();

        res.status(200).json({
            message: 'Note added successfully',
            client: {
                ...client.toObject(),
                _id: client.id
            }
        });
    } catch (error) {
        console.error('Error adding Trade Desk note:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

exports.sendToCoreBanking = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Trade Desk') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Trade Desk users can send to Core Banking'
            });
        }

        const { clientId, comment } = req.body;
        
        if (!clientId || !comment) {
            return res.status(400).json({ 
                message: 'All fields are required',
                error: 'clientId and comment are required'
            });
        }

        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ 
                message: 'Client not found',
                error: `Client with ID ${clientId} does not exist`
            });
        }

        // Add comment
        client.comments.push({
            text: comment,
            createdBy: req.user._id,
            createdAt: new Date()
        });

        // Update status to sent
        client.status = 'sent';
        client.lastModifiedBy = req.user._id;
        client.updatedAt = new Date();

        await client.save();

        // Here you would typically integrate with your Core Banking System
        // This is a placeholder for the actual integration
        const coreBankingResponse = {
            success: true,
            message: 'Client sent to Core Banking System successfully',
            reference: `CORE-${Date.now()}`
        };

        res.status(200).json({
            message: 'Client sent to Core Banking System successfully',
            client: {
                ...client.toObject(),
                _id: client.id
            },
            coreBankingResponse
        });
    } catch (error) {
        console.error('Error sending to Core Banking:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};

exports.forwardFromTreasuryOfficer = async (req, res) => {
    try {
        // Validate user role
        if (!req.user || !req.user.role || req.user.role !== 'Treasury Officer') {
            return res.status(403).json({ 
                message: 'Access denied',
                error: 'Only Treasury Officer can forward clients'
            });
        }

        const { clientId, target, comment } = req.body;
        
        // Validate required fields
        if (!clientId) {
            return res.status(400).json({ 
                message: 'Client ID is required',
                error: 'clientId is missing'
            });
        }
        if (!target) {
            return res.status(400).json({ 
                message: 'Target is required',
                error: 'target is missing'
            });
        }
        if (!comment) {
            return res.status(400).json({ 
                message: 'Comment is required',
                error: 'comment is missing'
            });
        }

        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ 
                message: 'Client not found',
                error: `Client with ID ${clientId} does not exist`
            });
        }

        // Debug logging
        console.log('Forward request details:', {
            userId: req.user._id,
            userRole: req.user.role,
            clientId: clientId,
            clientLastModifiedBy: client.lastModifiedBy,
            clientStatus: client.status
        });

        // Convert IDs to strings for comparison
        const userIdStr = req.user._id.toString();
        const clientLastModifiedByStr = client.lastModifiedBy.toString();

        // Debug logging
        console.log('ID comparison:', {
            userIdStr,
            clientLastModifiedByStr,
            areEqual: userIdStr === clientLastModifiedByStr
        });

        // Check if client is assigned to this user
        if (userIdStr !== clientLastModifiedByStr) {
            console.error('Access denied - Client details:', {
                userId: userIdStr,
                clientLastModifiedBy: clientLastModifiedByStr
            });
            return res.status(403).json({ 
                message: 'Access denied',
                error: `Client is assigned to another Treasury Officer (ID: ${clientLastModifiedByStr})`
            });
        }

        // Validate target
        const validTargets = ['BEAC', 'Treasury OPS', 'Trade Desk'];
        if (!validTargets.includes(target)) {
            return res.status(400).json({ 
                message: 'Invalid target',
                error: `Invalid target: ${target}. Valid targets are: ${validTargets.join(', ')}`
            });
        }

        // Add comment with timestamp
        client.comments.push({
            text: comment,
            createdBy: req.user._id,
            createdAt: new Date()
        });

        // Update status based on target
        client.status = target === 'BEAC' ? 'completed' : 'waiting';
        client.lastModifiedBy = req.user._id;
        client.updatedAt = new Date();

        // Save changes
        await client.save();

        res.status(200).json({
            message: 'Client forwarded successfully',
            client: {
                ...client.toObject(),
                _id: client.id
            }
        });
    } catch (error) {
        console.error('Error forwarding from Treasury Officer:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message
        });
    }
};
