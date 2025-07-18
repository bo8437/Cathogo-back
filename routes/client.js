const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Treasury OPS routes
router.get('/waiting', clientController.getWaitingClients);
router.post('/send-back', clientController.sendBackToAgent);
router.post('/forward', clientController.forwardToTreasuryOfficer);

// Treasury Officer routes
router.get('/treasury-officers', clientController.getTreasuryOfficers);
router.get('/treasury-officer/assigned', clientController.getAssignedClients);
router.post('/treasury-officer/change-status', clientController.changeClientStatus);
router.post('/treasury-officer/forward', clientController.forwardFromTreasuryOfficer);

// Routes for client management
router.post('/', clientController.createClient);
router.post('/upload', clientController.uploadDocument, clientController.uploadDocumentHandler);
router.get('/', clientController.getClients);
router.get('/:id', clientController.getClient);

// Trade Desk routes
router.get('/trade-desk/assigned', clientController.getTradeDeskAssignedClients);
router.post('/trade-desk/change-status', clientController.changeTradeDeskClientStatus);
router.post('/trade-desk/delete', clientController.deleteTradeDeskClient);
router.post('/trade-desk/note', clientController.addTradeDeskNote);
router.post('/trade-desk/send-to-core', clientController.sendToCoreBanking);
router.get('/document/download/:filename', clientController.downloadDocument);

module.exports = router;
