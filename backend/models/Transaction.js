const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  type: { type: String, enum: ['payment', 'subscription', 'invoice', 'checkout'], required: true },
  status: { type: String, enum: ['success', 'failed', 'pending', 'abandoned', 'overdue'], required: true },
  failureReason: String,
  failureCode: String,
  paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'emi'] },
  startedAt: Date,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
