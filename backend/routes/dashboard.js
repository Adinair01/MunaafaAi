const express = require('express');
const router = express.Router();
const RecoveryCase = require('../models/RecoveryCase');
const Transaction = require('../models/Transaction');

router.get('/metrics', async (req, res) => {
  try {
    const cases = await RecoveryCase.find();
    const totalAtRisk = cases.reduce((sum, c) => sum + (c.amountAtRisk || 0), 0);
    const totalRecovered = cases.reduce((sum, c) => sum + (c.amountRecovered || 0), 0);
    const recoveredCount = cases.filter(c => c.status === 'recovered').length;
    const activeCases = cases.filter(c => ['open', 'in_progress'].includes(c.status)).length;
    const recoveryRate = cases.length ? Math.round((recoveredCount / cases.length) * 1000) / 10 : 0;

    res.json({ totalAtRisk, totalRecovered, recoveryRate, activeCases, totalCases: cases.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const days = 7;
    const now = Date.now();
    const buckets = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now - i * 86400000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const cases = await RecoveryCase.find({
        updatedAt: { $gte: dayStart, $lt: dayEnd }
      });

      const recovered = cases.filter(c => c.status === 'recovered').reduce((sum, c) => sum + (c.amountRecovered || 0), 0);
      const casesOpened = await RecoveryCase.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } });

      buckets.push({
        date: dayStart.toISOString().split('T')[0],
        recovered,
        casesOpened
      });
    }

    res.json(buckets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-failure-class', async (req, res) => {
  try {
    const breakdown = await RecoveryCase.aggregate([
      {
        $group: {
          _id: '$aiFailureClass',
          count: { $sum: 1 },
          recovered: {
            $sum: { $cond: [{ $eq: ['$status', 'recovered'] }, 1, 0] }
          },
          amountRecovered: { $sum: '$amountRecovered' },
          amountAtRisk: { $sum: '$amountAtRisk' }
        }
      }
    ]);
    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-type', async (req, res) => {
  try {
    const breakdown = await RecoveryCase.aggregate([
      {
        $group: {
          _id: '$caseType',
          count: { $sum: 1 },
          amountAtRisk: { $sum: '$amountAtRisk' },
          amountRecovered: { $sum: '$amountRecovered' }
        }
      }
    ]);
    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
