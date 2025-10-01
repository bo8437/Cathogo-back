const { body, validationResult } = require('express-validator');

// Simple validation for required fields
const requiredField = (field, name) => {
  return body(field)
    .trim()
    .notEmpty().withMessage(`${name} is required`)
    .isLength({ max: 255 }).withMessage(`${name} is too long`);
};

const validateClient = [
  // Required fields
  requiredField('orderGiverName', 'Order giver name'),
  requiredField('orderGiverAccount', 'Order giver account'),
  requiredField('orderGiverAddress', 'Order giver address'),
  requiredField('beneficiaryName', 'Beneficiary name'),
  requiredField('beneficiaryAccount', 'Beneficiary account'),
  requiredField('beneficiaryAddress', 'Beneficiary address'),
  requiredField('beneficiaryBankName', 'Beneficiary bank name'),
  requiredField('beneficiaryBankSwift', 'Bank SWIFT code'),
  requiredField('amountInWords', 'Amount in words'),
  requiredField('transferReason', 'Transfer reason'),
  requiredField('transferType', 'Transfer type'),
  requiredField('amount', 'Amount'),
  
  // Process the validation
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Please check your input',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateClient
};
