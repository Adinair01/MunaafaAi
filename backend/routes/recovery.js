const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const RecoveryCase = require('../models/RecoveryCase');
const { createRecoveryCase, executeRecoveryAction } = require('../services/recoveryEngine');

router.post('/create/:transactionId', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId).populate('customer');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (!transaction.customer) return res.status(400).json({ error: 'Transaction has no customer' });

    const recoveryCase = await createRecoveryCase(transaction, transaction.customer);
    res.json(recoveryCase);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// In DEMO_MODE, stream case creation slowly so the live feed is visible on
// camera. Production keeps the real LLM calls with no artificial pacing.
const IS_DEMO = process.env.DEMO_MODE === 'true';
const CASE_STAGGER_MS = IS_DEMO ? 200 : 0;

const EMPTY_CLASS_STATS = { count: 0, recovered: 0, amountRecovered: 0 };
const FAILURE_CLASSES = ['TIMING', 'TECHNICAL', 'FRICTION', 'INTENT'];

function emptyByFailureClass() {
  return Object.fromEntries(FAILURE_CLASSES.map(c => [c, { ...EMPTY_CLASS_STATS }]));
}

function computeSweepSummary(cases) {
  const byFailureClass = emptyByFailureClass();
  let totalAtRisk = 0;
  let totalRecovered = 0;
  let recoveredCount = 0;
  let economicWriteOffs = 0;
  let stoppingRulesTriggered = 0;
  let complianceEscalations = 0;

  for (const c of cases) {
    totalAtRisk += c.amountAtRisk || 0;
    totalRecovered += c.amountRecovered || 0;

    const cls = FAILURE_CLASSES.includes(c.aiFailureClass) ? c.aiFailureClass : null;
    if (cls) {
      byFailureClass[cls].count += 1;
      if (c.status === 'recovered') {
        byFailureClass[cls].recovered += 1;
      }
      byFailureClass[cls].amountRecovered += c.amountRecovered || 0;
    }

    if (c.status === 'recovered') recoveredCount += 1;

    const triggered = c.stoppingRuleTriggered || '';
    if (triggered.startsWith('Written off')) economicWriteOffs += 1;
    else if (triggered) stoppingRulesTriggered += 1;

    if (c.status === 'escalated') complianceEscalations += 1;
  }

  return {
    totalCases: cases.length,
    totalAtRisk,
    totalRecovered,
    recoveryRate: cases.length ? Math.round((recoveredCount / cases.length) * 1000) / 10 : 0,
    byFailureClass,
    economicWriteOffs,
    stoppingRulesTriggered,
    complianceEscalations
  };
}

router.post('/run-batch', async (req, res) => {
  const startedAt = Date.now();
  try {
    const eligibleTransactions = await Transaction.find({
      status: { $in: ['failed', 'abandoned', 'overdue'] }
    }).populate('customer');

    const results = [];
    for (const transaction of eligibleTransactions) {
      if (!transaction.customer) continue;
      try {
        const recoveryCase = await createRecoveryCase(transaction, transaction.customer);
        const row = {
          transactionId: transaction.transactionId,
          caseId: recoveryCase.caseId,
          diagnosis: recoveryCase.aiDiagnosis,
          failureClass: recoveryCase.aiFailureClass,
          action: recoveryCase.recommendedAction,
          confidence: recoveryCase.aiConfidence,
          economicReason: recoveryCase.economicReason,
          confidenceChange: recoveryCase.confidenceChange
        };

        // DEMO_MODE: execute each fresh case's first action right away so a
        // single sweep visibly recovers money (or escalates/writes off) live.
        if (IS_DEMO) {
          try {
            const outcome = await executeRecoveryAction(recoveryCase.caseId);
            row.action = outcome.action || row.action;
            row.status = outcome.status;
            row.amountRecovered = outcome.amountRecovered || 0;
          } catch (execErr) {
            row.status = 'open';
            row.executeError = execErr.message;
          }
        }
        results.push(row);
      } catch (err) {
        results.push({ transactionId: transaction.transactionId, error: err.message });
      }

      // Stagger (demo mode) so the live feed streams visibly on camera
      // instead of arriving in one burst.
      await sleep(CASE_STAGGER_MS);
    }

    const cases = await RecoveryCase.find().lean();
    const summary = computeSweepSummary(cases);
    summary.sweepDurationMs = Date.now() - startedAt;

    res.json({ ...summary, processed: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/execute/:caseId', async (req, res) => {
  try {
    const result = await executeRecoveryAction(req.params.caseId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/cases', async (req, res) => {
  try {
    const { status, caseType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (caseType) filter.caseType = caseType;

    const cases = await RecoveryCase.find(filter)
      .populate('transaction')
      .populate('customer')
      .sort({ createdAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cases/:caseId', async (req, res) => {
  try {
    const recoveryCase = await RecoveryCase.findOne({ caseId: req.params.caseId })
      .populate('transaction')
      .populate('customer');
    if (!recoveryCase) return res.status(404).json({ error: 'Case not found' });
    res.json(recoveryCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const cases = await RecoveryCase.find();
    const totalAtRisk = cases.reduce((sum, c) => sum + (c.amountAtRisk || 0), 0);
    const totalRecovered = cases.reduce((sum, c) => sum + (c.amountRecovered || 0), 0);
    const recoveredCount = cases.filter(c => c.status === 'recovered').length;
    const successRate = cases.length ? (recoveredCount / cases.length) * 100 : 0;

    res.json({
      totalCases: cases.length,
      totalAtRisk,
      totalRecovered,
      recoveredCount,
      successRate: Math.round(successRate * 10) / 10,
      activeCases: cases.filter(c => ['open', 'in_progress'].includes(c.status)).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
