const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    beneficiary: {
        type: String,
        required: true,
        trim: true
    },
    domiciliation: {
        type: String,
        required: true,
        trim: true
    },
    currency: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: String,
        required: true,
        trim: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    physicalDepositDate: {
        type: Date,
        required: true
    },
    systemRegistrationDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        default: 'waiting',
        enum: ['waiting', 'processing', 'completed', 'rejected']
    },
    comments: [{
        text: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual property for document count
clientSchema.virtual('documentCount').get(function() {
    return this.documents.length;
});

// Update updatedAt field on save
clientSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const Client = mongoose.model('Client', clientSchema);
module.exports = Client;
