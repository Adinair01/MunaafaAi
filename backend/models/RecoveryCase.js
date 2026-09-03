const mongoose = require('mongoose');

const RecoveryCaseSchema = new mongoose.Schema({
  caseId: { type: String, unique: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  caseType: { type: String, enum: ['payment_failure', 'checkout_abandonment', 'subscription_failure', 'invoice_overdue'] },
  status: { type: String, enum: ['open', 'in_progress', 'recovered', 'escalated', 'closed_lost'], default: 'open' },
  amountAtRisk: Number,
  amountRecovered: { type: Number, default: 0 },
  aiDiagnosis: String,
  aiConfidence: Number,
  aiFailureClass: String,
  recommendedAction: String,
  economicReason: String,
  confidenceChange: String,
  complianceFlag: mongoose.Schema.Types.Mixed,
  executedActions: [{ action: String, executedAt: Date, result: String, message: String, aiConfidence: Number, confidenceChange: String }],
  escalationLevel: { type: Number, default: 0 },
  stoppingRuleTriggered: String,
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  nextRetryAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RecoveryCase', RecoveryCaseSchema);
