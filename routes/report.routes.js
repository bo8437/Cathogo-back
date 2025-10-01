const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/report.controller');

// Download client report in Excel format
router.get('/clients/excel', (req, res) => {
    ReportController.downloadClientReport(req, res);
});

module.exports = router;
