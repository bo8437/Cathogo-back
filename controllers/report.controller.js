const excel = require('exceljs');
const path = require('path');
const fs = require('fs');
const Client = require('../models/client.model');

class ReportController {
    async downloadClientReport(req, res) {
      try {
        const connection = req.app.get('databaseConnection');
        const filePath = path.join(process.cwd(), 'reports', 'clients_report.xlsx');
        const dirPath = path.dirname(filePath);
  
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
  
        const [clients] = await connection.execute(`
          SELECT 
            c.id,
            c.order_giver_name as orderGiverName,
            c.amount,
            c.transfer_reason as transferReason,
            c.status,
            c.created_at as createdAt,
            GROUP_CONCAT(d.original_name SEPARATOR ', ') as documentNames
          FROM clients c
          LEFT JOIN documents d ON c.id = d.client_id
          GROUP BY c.id, c.order_giver_name, c.amount, c.transfer_reason, c.status, c.created_at
        `);
  
        let workbook = new excel.Workbook();
        let worksheet = workbook.addWorksheet('Clients');
  
        // Define columns
        worksheet.columns = [
          { header: 'Nom', key: 'orderGiverName', width: 30 },
          { header: 'Montant', key: 'amount', width: 15 },
          { header: 'Raison du Transfert', key: 'transferReason', width: 40 },
          { header: 'Documents', key: 'documentNames', width: 50 },
          { header: 'Statut', key: 'status', width: 20 },
          { header: 'Date de Création', key: 'createdAt', width: 25 }
        ];
  
        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;
  
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1A237E' } // Dark blue
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
  
        // Add client rows with styling
        clients.forEach((client, index) => {
          const row = worksheet.addRow({
            orderGiverName: client.orderGiverName,
            amount: client.amount,
            transferReason: client.transferReason,
            documentNames: client.documentNames || 'Aucun document',
            status: client.status,
            createdAt: new Date(client.createdAt)
          });
  
          // Alternate row shading
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            if (index % 2 === 0) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F9F9F9' } // Light gray
              };
            }
          });
  
          // Format amount column as currency
          row.getCell('amount').numFmt = '#,##0.00 [$€-fr-FR]';
  
          // Format date
          row.getCell('createdAt').numFmt = 'dd/mm/yyyy hh:mm';
  
          // Conditional formatting for status
          const statusCell = row.getCell('status');
          let statusColor = '000000'; // Default black
          if (client.status.toLowerCase().includes('approuvé')) statusColor = '008000'; // green
          else if (client.status.toLowerCase().includes('rejet')) statusColor = 'FF0000'; // red
          else statusColor = 'FFA500'; // orange for pending/other
  
          statusCell.font = { color: { argb: statusColor }, bold: true };
        });
  
        // Save and send response
        await workbook.xlsx.writeFile(filePath);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=clients_report.xlsx');
        await workbook.xlsx.write(res);
      } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).json({
          success: false,
          message: 'Error generating report',
          error: error.message
        });
      }
    }
  }
  
  module.exports = new ReportController(); 