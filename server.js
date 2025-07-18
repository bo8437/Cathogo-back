require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const { auth, roleCheck } = require('./middleware/auth');

const app = express();

// CORS middleware
app.use(cors({
    origin: ['http://localhost:5173'], // Vite default port
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


// Middleware
app.use(express.json());
app.use(express.static('uploads')); // Serve uploaded files

console.log('Server starting up...');

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);

// Client routes protected by authentication
app.use('/api/client', auth, clientRoutes);

// Apply role-based access control at the route level
clientRoutes.use('/document/download', auth); // Protect the download route
clientRoutes.use('/waiting', roleCheck(['Treasury OPS']));
clientRoutes.use('/waiting', roleCheck(['Treasury OPS']));
clientRoutes.use('/send-back', roleCheck(['Treasury OPS']));
clientRoutes.use('/forward', roleCheck(['Treasury OPS']));

// Apply role-based access control for Treasury Officer routes<<
clientRoutes.use('/treasury-officer/assigned', roleCheck(['Treasury Officer']));
clientRoutes.use('/treasury-officer/change-status', roleCheck(['Treasury Officer']));
clientRoutes.use('/treasury-officer/forward', roleCheck(['Treasury Officer']));

// Apply role-based access control for Trade Desk routes
clientRoutes.use('/trade-desk/assigned', roleCheck(['Trade Desk']));
clientRoutes.use('/trade-desk/completed', roleCheck(['Trade Desk']));
clientRoutes.use('/trade-desk/change-status', roleCheck(['Trade Desk']));
clientRoutes.use('/trade-desk/delete', roleCheck(['Trade Desk']));
clientRoutes.use('/trade-desk/note', roleCheck(['Trade Desk']));
clientRoutes.use('/trade-desk/send-to-core', roleCheck(['Trade Desk']));

// Apply role-based access control for other endpoints
clientRoutes.use('/', roleCheck(['Agent OPS']));
clientRoutes.use('/upload', roleCheck(['Agent OPS']));
clientRoutes.use('/:id', roleCheck(['Agent OPS']));

// Basic route
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Test route working' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Try accessing http://localhost:5000/test to verify server is running');
});
