const RecoveryCase = require('../models/RecoveryCase');
const AuditLog = require('../models/AuditLog');
const { diagnoseAndRecommend, generateRecoveryMessage } = require('./aiAgent');
const { v4: uuidv4 } = require('uuid');

const STOPPING_RULES = {
  payment_failure: { maxAttempts: 3, maxHours: 72 },
  checkout_abandonment: { maxAttempts: 2, maxHours: 48 },
  subscription_failure: { maxAttempts: 4, maxHours: 168 },
  invoice_overdue: { maxAttempts: 5, maxHours: 720 }
};

function mapTypeToCase(type) {
  const map = {
    payment: 'payment_failure',
    checkout: 'checkout_abandonment',
    subscription: 'subscription_failure',
    invoice: 'invoice_overdue'
  };
  return map[type] || 'payment_failure';
}

function getRetryDelay(attempt) {
  const delays = [2 * 3600000, 6 * 3600000, 24 * 3600000];
  return delays[Math.min(attempt - 1, delays.length - 1)];
}

function simulateRecoveryOutcome(action, recoveryCase) {
  const successRates = {
    RETRY_PAYMENT: 0.45,
    SWITCH_PAYMENT_METHOD: 0.60,
    SEND_RECOVERY_EMAIL: 0.35,
    SEND_SMS_REMINDER: 0.40,
    APPLY_DISCOUNT: 0.65,
    MANDATE_RETRY: 0.55,
    ESCALATE_TO_AGENT: 0.75,
    WRITE_OFF: 0
  };
  const rate = successRates[action] || 0.3;
  const decayFactor = 1 - (recoveryCase.attempts * 0.1);
  return Math.random() < (rate * decayFactor);
}

async function createRecoveryCase(transaction, customer) {
  const existing = await RecoveryCase.findOne({
    transaction: transaction._id,
    status: { $in: ['open', 'in_progress'] }
  });
  if (existing) return existing;

  const rules = STOPPING_RULES[mapTypeToCase(transaction.type)] || STOPPING_RULES.payment_failure;

  const aiResult = await diagnoseAndRecommend(transaction, customer, {
    attempt: 1,
    maxAttempts: rules.maxAttempts,
    previousActions: []
  });

  const recoveryCase = new RecoveryCase({
    caseId: `RC-${uuidv4().slice(0, 8).toUpperCase()}`,
    transaction: transaction._id,
    customer: customer._id,
    caseType: mapTypeToCase(transaction.type),
    status: 'open',
    amountAtRisk: transaction.amount,
    aiDiagnosis: aiResult.diagnosis,
    aiConfidence: aiResult.confidence,
    aiFailureClass: aiResult.failureClass,
    recommendedAction: aiResult.recommendedAction,
    economicReason: aiResult.economicReason,
    confidenceChange: aiResult.confidenceChange,
    complianceFlag: aiResult.complianceFlag || null,
    maxAttempts: rules.maxAttempts,
    nextRetryAt: new Date(Date.now() + 30 * 60 * 1000)
  });

  await recoveryCase.save();

  await AuditLog.create({
    caseId: recoveryCase.caseId,
    event: 'CASE_CREATED',
    details: {
      aiDiagnosis: aiResult.diagnosis,
      failureClass: aiResult.failureClass,
      recommendedAction: aiResult.recommendedAction,
      confidence: aiResult.confidence,
      economicReason: aiResult.economicReason
    },
    outcome: 'Recovery case opened'
  });

  return recoveryCase;
}

// Re-evaluate an open case before a later attempt: the agent sees what was
// tried, what happened, and updates its diagnosis, confidence and action.
async function reDiagnose(recoveryCase) {
  const nextAttempt = recoveryCase.attempts + 1;
  const previousActions = recoveryCase.executedActions.map(
    a => `${a.action} -> ${a.result}${a.message ? ` (${a.message})` : ''}`
  );
  const fresh = await diagnoseAndRecommend(recoveryCase.transaction, recoveryCase.customer, {
    attempt: nextAttempt,
    maxAttempts: recoveryCase.maxAttempts,
    previousActions
  });
  recoveryCase.aiDiagnosis = fresh.diagnosis;
  recoveryCase.aiConfidence = fresh.confidence;
  recoveryCase.aiFailureClass = fresh.failureClass;
  recoveryCase.recommendedAction = fresh.recommendedAction;
  recoveryCase.economicReason = fresh.economicReason;
  recoveryCase.confidenceChange = fresh.confidenceChange;
  recoveryCase.complianceFlag = fresh.complianceFlag || null;
  return recoveryCase;
}

async function executeRecoveryAction(caseId) {
  const recoveryCase = await RecoveryCase.findOne({ caseId })
    .populate('transaction')
    .populate('customer');

  if (!recoveryCase) throw new Error('Case not found');

  if (['recovered', 'closed_lost'].includes(recoveryCase.status)) {
    return { status: recoveryCase.status, reason: 'Case already closed' };
  }

  if (recoveryCase.attempts >= recoveryCase.maxAttempts) {
    recoveryCase.status = 'closed_lost';
    recoveryCase.stoppingRuleTriggered = `Max attempts (${recoveryCase.maxAttempts}) reached`;
    await recoveryCase.save();
    await AuditLog.create({
      caseId,
      event: 'STOPPING_RULE_TRIGGERED',
      details: { reason: recoveryCase.stoppingRuleTriggered },
      outcome: 'Case closed - max attempts reached'
    });
    return { status: 'stopped', reason: recoveryCase.stoppingRuleTriggered };
  }

  // From attempt 2 onwards the agent re-diagnoses with full attempt context
  // so its confidence and recommendation can change based on what happened.
  if (recoveryCase.attempts >= 1) {
    await reDiagnose(recoveryCase);
  }

  const action = recoveryCase.recommendedAction;

  // WRITE_OFF is a terminal economic decision, not an outreach attempt.
  if (action === 'WRITE_OFF') {
    recoveryCase.status = 'closed_lost';
    recoveryCase.stoppingRuleTriggered =
      `Written off: expected recovery below intervention cost (${recoveryCase.economicReason || 'no economic reason given'})`;
    recoveryCase.updatedAt = new Date();
    await recoveryCase.save();
    console.log(`[EXECUTE] case=${recoveryCase.caseId} action=${action} simulatedOutcome=false finalStatus=${recoveryCase.status} (write-off)`);
    await AuditLog.create({
      caseId,
      event: 'ACTION_EXECUTED',
      actor: 'AI_AGENT',
      details: { action, reason: recoveryCase.stoppingRuleTriggered, economicReason: recoveryCase.economicReason },
      outcome: 'Written off - case closed'
    });
    return {
      status: 'closed_lost',
      action,
      reason: recoveryCase.stoppingRuleTriggered,
      amountRecovered: 0
    };
  }

  const message = await generateRecoveryMessage(recoveryCase, recoveryCase.customer, action);

  const recovered = simulateRecoveryOutcome(action, recoveryCase);
  console.log(`[EXECUTE] case=${recoveryCase.caseId} action=${action} simulatedOutcome=${recovered} attemptsBefore=${recoveryCase.attempts}`);

  recoveryCase.attempts += 1;
  recoveryCase.status = 'in_progress';
  recoveryCase.executedActions.push({
    action,
    executedAt: new Date(),
    result: recovered ? 'SUCCESS' : 'PENDING',
    message,
    aiConfidence: recoveryCase.aiConfidence,
    confidenceChange: recoveryCase.confidenceChange
  });

  if (recovered) {
    recoveryCase.status = 'recovered';
    recoveryCase.amountRecovered = recoveryCase.amountAtRisk;
  } else {
    recoveryCase.escalationLevel = Math.min(recoveryCase.escalationLevel + 1, 4);

    // A compliance-sensitive case must go to a human once escalation is deep
    // enough — the AI stops acting autonomously from here.
    if (recoveryCase.complianceFlag && recoveryCase.escalationLevel >= 2) {
      recoveryCase.status = 'escalated';
    } else {
      recoveryCase.nextRetryAt = new Date(Date.now() + getRetryDelay(recoveryCase.attempts));

      if (recoveryCase.attempts >= recoveryCase.maxAttempts) {
        recoveryCase.status = 'closed_lost';
        recoveryCase.stoppingRuleTriggered = `Max attempts (${recoveryCase.maxAttempts}) reached after final action`;
      }
    }
  }

  recoveryCase.updatedAt = new Date();
  await recoveryCase.save();
  console.log(`[EXECUTE] case=${recoveryCase.caseId} action=${action} simulatedOutcome=${recovered} finalStatus=${recoveryCase.status} amountRecovered=${recoveryCase.amountRecovered}`);

  await AuditLog.create({
    caseId,
    event: 'ACTION_EXECUTED',
    actor: 'AI_AGENT',
    details: { action, message, attempt: recoveryCase.attempts, aiConfidence: recoveryCase.aiConfidence, confidenceChange: recoveryCase.confidenceChange },
    outcome: recovered ? `Recovered ₹${recoveryCase.amountAtRisk}` : 'Pending - scheduled retry'
  });

  return {
    status: recovered ? 'recovered' : recoveryCase.status,
    action,
    message,
    amountRecovered: recovered ? recoveryCase.amountAtRisk : 0,
    nextRetryAt: recoveryCase.nextRetryAt,
    aiConfidence: recoveryCase.aiConfidence,
    confidenceChange: recoveryCase.confidenceChange
  };
}

module.exports = { createRecoveryCase, executeRecoveryAction, mapTypeToCase, STOPPING_RULES };
