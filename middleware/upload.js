const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created uploads directory at: ${uploadDir}`);
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${ext}. Only ${allowedTypes.join(', ')} files are allowed.`));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Max 10 files
    fieldNameSize: 200, // Max field name size
    fieldSize: 10 * 1024 * 1024 // Max field value size (10MB)
  }
});

// Middleware to handle file uploads
const handleUploads = (req, res, next) => {
  // Use multer upload instance
  upload.array('documents', 10)(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          status: 'error',
          message: 'File too large. Maximum file size is 10MB.'
        });
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          status: 'error',
          message: 'Too many files. Maximum 10 files allowed.'
        });
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          status: 'error',
          message: 'Unexpected field in file upload.'
        });
      } else if (err instanceof multer.MulterError) {
        // Other multer errors
        return res.status(400).json({
          status: 'error',
          message: 'File upload error',
          error: err.message
        });
      } else if (err) {
        // Other errors
        return res.status(500).json({
          status: 'error',
          message: 'Error processing file upload',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
    }
    
    // If no files were uploaded, proceed with empty files array
    if (!req.files) {
      req.files = [];
    }
    
    next();
  });
};

module.exports = handleUploads;
