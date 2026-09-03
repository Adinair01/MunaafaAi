const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  caseId: String,
  event: String,
  actor: { type: String, default: 'AI_AGENT' },
  details: mongoose.Schema.Types.Mixed,
  outcome: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
