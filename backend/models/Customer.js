const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true },
  phone: String,
  segment: { type: String, enum: ['consumer', 'smb', 'enterprise'], default: 'consumer' },
  totalSpend: { type: Number, default: 0 },
  riskScore: { type: Number, default: 0 },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', CustomerSchema);
