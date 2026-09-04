const express = require('express');
const { Parser } = require('json2csv');
const router = express.Router();
const AuditLog = require('../models/AuditLog');

router.get('/', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(500);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 });
    const rows = logs.map(log => ({
      timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : '',
      caseId: log.caseId || '',
      event: log.event || '',
      actor: log.actor || '',
      outcome: log.outcome || '',
      details: JSON.stringify(log.details ?? '')
    }));

    const fields = ['timestamp', 'caseId', 'event', 'actor', 'outcome', 'details'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="munaafaai-audit.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
