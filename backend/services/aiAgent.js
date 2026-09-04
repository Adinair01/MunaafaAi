const OpenAI = require('openai');
const Transaction = require('../models/Transaction');

const IS_DEMO = process.env.DEMO_MODE === 'true';

// Lazy: the client is only constructed when a real (non-demo) call is made,
// so the server can boot in DEMO_MODE without a GROQ_API_KEY configured.
let client = null;
function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      timeout: 15000,
      maxRetries: 1
    });
  }
  return client;
}

const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

const VALID_ACTIONS = [
  'RETRY_PAYMENT',
  'SWITCH_PAYMENT_METHOD',
  'SEND_RECOVERY_EMAIL',
  'SEND_SMS_REMINDER',
  'APPLY_DISCOUNT',
  'ESCALATE_TO_AGENT',
  'MANDATE_RETRY',
  'WRITE_OFF'
];

const VALID_FAILURE_CLASSES = ['INTENT', 'TECHNICAL', 'TIMING', 'FRICTION'];

// intervention cost per action type, in INR
const INTERVENTION_COSTS = {
  RETRY_PAYMENT: 0,
  SWITCH_PAYMENT_METHOD: 0,
  SEND_RECOVERY_EMAIL: 0,
  SEND_SMS_REMINDER: 2,
  APPLY_DISCOUNT: 0,
  ESCALATE_TO_AGENT: 150,
  MANDATE_RETRY: 0,
  WRITE_OFF: 0
};

function costLine() {
  return Object.entries(INTERVENTION_COSTS)
    .map(([action, cost]) => `${action}=₹${cost}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// DEMO_MODE: deterministic, instant "diagnoses" so a live demo never waits on
// the LLM. The pool is keyed on failureCode + paymentMethod, so the same
// transaction always yields the same diagnosis — deterministic, not random.
// ---------------------------------------------------------------------------
const DEMO_DIAGNOSES = [
  {
    failureClass: 'TECHNICAL',
    recommendedAction: 'SWITCH_PAYMENT_METHOD',
    confidence: 86,
    recoveryProbability: 64,
    actionReason: 'Repeated declines on this payment rail point to a method-level issue; switching methods avoids the broken rail entirely.',
    diagnosis: 'The {method} payment was declined by the issuing side despite the customer being active. This looks like a method/rail-specific technical issue rather than a lack of intent — switching to an alternate instrument is the fastest path to recovery.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹0 (SWITCH_PAYMENT_METHOD), so the action is profitable',
    stoppingRule: 'stop after 2 attempts or 48 hours',
    urgency: 'high',
    complianceFlag: null
  },
  {
    failureClass: 'TIMING',
    recommendedAction: 'MANDATE_RETRY',
    confidence: 74,
    recoveryProbability: 58,
    actionReason: 'Failure code suggests a transient money-timing problem; a scheduled retry lets funds land before the next attempt.',
    diagnosis: 'The {method} failure happened near a salary/pay-cycle window, which usually indicates temporary fund availability. A delayed retry in 24-48h gives the customer time to fund the account.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹0 (MANDATE_RETRY), so the action is profitable',
    stoppingRule: 'stop after 3 attempts or 72 hours',
    urgency: 'medium',
    complianceFlag: null
  },
  {
    failureClass: 'FRICTION',
    recommendedAction: 'SEND_RECOVERY_EMAIL',
    confidence: 68,
    recoveryProbability: 44,
    actionReason: 'The checkout was abandoned mid-flow, suggesting confusion or distraction; a clear email with a fresh payment link removes the friction.',
    diagnosis: 'Customer abandoned this {method} checkout before completion. Low friction on their side — a gentle nudge with a direct payment link usually converts these at low cost.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹0 (SEND_RECOVERY_EMAIL), so the action is profitable',
    stoppingRule: 'stop after 2 attempts or 48 hours',
    urgency: 'medium',
    complianceFlag: null
  },
  {
    failureClass: 'TECHNICAL',
    recommendedAction: 'RETRY_PAYMENT',
    confidence: 80,
    recoveryProbability: 55,
    actionReason: 'The failure code is a transient network/bank hiccup; a plain retry succeeds a large share of the time.',
    diagnosis: 'The {method} attempt hit a transient processing error on the bank or network side. Customer history is healthy, so a straightforward retry is likely to clear.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹0 (RETRY_PAYMENT), so the action is profitable',
    stoppingRule: 'stop after 3 attempts or 72 hours',
    urgency: 'high',
    complianceFlag: null
  },
  {
    failureClass: 'TIMING',
    recommendedAction: 'SEND_SMS_REMINDER',
    confidence: 61,
    recoveryProbability: 39,
    actionReason: 'High-risk customer with a money-timing failure; a cheap SMS reminder at the right moment is the most economical lever.',
    diagnosis: 'This looks like a temporary funds-timing issue for a higher-risk customer. An SMS reminder costs almost nothing and lands where this customer actually reads messages.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹2 (SEND_SMS_REMINDER), so the action is profitable',
    stoppingRule: 'stop after 3 attempts or 72 hours',
    urgency: 'medium',
    complianceFlag: null
  },
  {
    failureClass: 'FRICTION',
    recommendedAction: 'APPLY_DISCOUNT',
    confidence: 72,
    recoveryProbability: 66,
    actionReason: 'Price or UX hesitation at checkout; a small discount changes the economics in the customer\'s favor and closes the sale.',
    diagnosis: 'Customer reached the {method} payment step but hesitated. A targeted discount converts price-sensitive abandonment that retries alone will not.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹0 (APPLY_DISCOUNT), so the action is profitable',
    stoppingRule: 'stop after 1 attempt or 24 hours',
    urgency: 'low',
    complianceFlag: null
  },
  {
    failureClass: 'TECHNICAL',
    recommendedAction: 'ESCALATE_TO_AGENT',
    confidence: 55,
    recoveryProbability: 71,
    actionReason: 'Repeated technical failures on a high-value transaction justify human intervention to resolve the underlying issue.',
    diagnosis: 'High-value {method} payment blocked by an unresolved technical issue that self-service retries will not fix. Worth a human agent for a big-ticket customer.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹150 (ESCALATE_TO_AGENT), so the action is profitable',
    stoppingRule: 'stop after 1 escalation or 24 hours',
    urgency: 'high',
    complianceFlag: null
  },
  {
    failureClass: 'FRICTION',
    recommendedAction: 'SEND_RECOVERY_EMAIL',
    confidence: 64,
    recoveryProbability: 47,
    actionReason: 'A failed subscription mandate needs a clear, low-pressure email so the customer can re-authorise without calling support.',
    diagnosis: 'The subscription mandate on {method} lapsed during renewal. This is a silent-revenue churn risk — a short email with one tap to re-authorise recovers the recurring stream.',
    economicReason: 'Expected recovery ₹X > intervention cost ₹0 (SEND_RECOVERY_EMAIL), so the action is profitable',
    stoppingRule: 'stop after 4 attempts or 7 days',
    urgency: 'high',
    complianceFlag: null
  }
];

function stableHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickDemoDiagnosis(transaction, customer, options) {
  const key = `${transaction.failureCode || transaction.type || 'none'}|${transaction.paymentMethod || 'none'}`;
  const template = DEMO_DIAGNOSES[stableHash(key) % DEMO_DIAGNOSES.length];
  const amount = transaction.amount || 0;
  const expected = Math.round(amount * template.recoveryProbability / 100);
  const diagnosis = template.diagnosis.replace('{method}', transaction.paymentMethod || 'the selected');
  const economicReason = template.economicReason.replace('₹X', `₹${expected.toLocaleString('en-IN')}`);
  const attempt = options.attempt || 1;
  return {
    failureClass: template.failureClass,
    diagnosis,
    confidence: template.confidence,
    recoveryProbability: template.recoveryProbability,
    recommendedAction: template.recommendedAction,
    actionReason: template.actionReason,
    economicReason,
    confidenceChange: attempt >= 2
      ? `-${8 + (attempt % 5)} from attempt 1 (previous outreach did not convert)`
      : '+0 (first assessment)',
    stoppingRule: template.stoppingRule,
    complianceFlag: template.complianceFlag,
    urgency: template.urgency
  };
}

const DEMO_MESSAGES = {
  SWITCH_PAYMENT_METHOD: 'Your payment couldn\'t go through on the method you chose. Try paying with another card or UPI here — it takes under a minute: [PAYMENT_LINK]',
  RETRY_PAYMENT: 'Your recent payment needs a quick retry — the first attempt hit a temporary glitch. Complete it here: [PAYMENT_LINK]',
  MANDATE_RETRY: 'We noticed your payment needs attention. A retry is scheduled automatically; you can also pay now: [PAYMENT_LINK]',
  SEND_RECOVERY_EMAIL: 'A payment on your account couldn\'t go through. Tap here to complete it in one step: [PAYMENT_LINK]',
  SEND_SMS_REMINDER: 'Your payment needs attention. Complete it in one tap: [PAYMENT_LINK]',
  APPLY_DISCOUNT: 'We saved a small discount for you. Complete your payment to keep your service active: [PAYMENT_LINK]',
  ESCALATE_TO_AGENT: 'A specialist is reviewing your payment issue and will reach out shortly to sort it out.',
  WRITE_OFF: 'This case was closed after an economic review.'
};

function pickDemoMessage(customer, action) {
  const base = DEMO_MESSAGES[action] || DEMO_MESSAGES.SEND_RECOVERY_EMAIL;
  if (customer.segment === 'enterprise') {
    return 'Your dedicated account manager is looking into this and will call you to arrange the payment — no action needed on your side right now.';
  }
  if (customer.segment === 'smb') {
    return `${base} Keeping your services running without interruption is our priority.`;
  }
  return base;
}

// All dates below are computed in India Standard Time (UTC+5:30) so the
// model sees the real local context regardless of where the server runs.
function istShifted(date) {
  return new Date(new Date(date).getTime() + 5.5 * 3600000);
}

function hourLabel(hour) {
  if (hour < 6) return 'early morning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'evening';
  return 'night';
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function occurrenceContext(date) {
  if (!date) return 'not recorded';
  const shifted = istShifted(date);
  const hour = shifted.getUTCHours();
  const day = shifted.getUTCDate();
  const weekday = WEEKDAYS[shifted.getUTCDay()];
  const weekend = shifted.getUTCDay() === 0 || shifted.getUTCDay() === 6;
  return `${weekday}, day ${day} of month, ~${String(hour).padStart(2, '0')}:xx IST (${hourLabel(hour)}${weekend ? ', weekend' : ''})`;
}

// How long between the attempt starting and it failing/being abandoned.
// Near-instant suggests wrong/expired details; a long gap suggests the
// bank/rail/checkout side stalled.
function attemptGapContext(transaction) {
  if (!transaction.startedAt || !transaction.createdAt) return null;
  const gapMinutes = (new Date(transaction.createdAt) - new Date(transaction.startedAt)) / 60000;
  if (!isFinite(gapMinutes) || gapMinutes < 0) return null;
  if (gapMinutes < 1) return `failed <1 minute after the attempt started (instant - likely wrong/expired details)`;
  if (gapMinutes < 60) return `failed ~${Math.round(gapMinutes)} minutes after the attempt started (delayed - likely bank/rail/checkout side)`;
  return `lasted ~${Math.round(gapMinutes / 60)} hours before failing/being abandoned`;
}

// Real query: how has this customer fared with this exact payment method before?
async function methodHistory(customerId, paymentMethod, excludeTransactionId) {
  if (!paymentMethod || !customerId) return { successes: 0, failures: 0 };
  const docs = await Transaction.find({
    customer: customerId,
    paymentMethod,
    status: { $in: ['success', 'failed'] },
    _id: { $ne: excludeTransactionId }
  }).select('status').lean();
  return {
    successes: docs.filter(d => d.status === 'success').length,
    failures: docs.filter(d => d.status === 'failed').length
  };
}

function sanitizeDiagnosis(raw) {
  const action = VALID_ACTIONS.includes(raw.recommendedAction) ? raw.recommendedAction : 'SEND_RECOVERY_EMAIL';
  const failureClass = VALID_FAILURE_CLASSES.includes(raw.failureClass) ? raw.failureClass : 'TECHNICAL';
  return {
    failureClass,
    diagnosis: String(raw.diagnosis || 'Unable to determine root cause').slice(0, 300),
    confidence: Math.max(0, Math.min(100, Number(raw.confidence) || 50)),
    recoveryProbability: Math.max(0, Math.min(100, Number(raw.recoveryProbability) || 30)),
    recommendedAction: action,
    actionReason: String(raw.actionReason || '').slice(0, 300),
    economicReason: String(raw.economicReason || '').slice(0, 300),
    confidenceChange: String(raw.confidenceChange || '+0 (first assessment)').slice(0, 200),
    stoppingRule: String(raw.stoppingRule || 'stop after 3 attempts or 72 hours').slice(0, 200),
    complianceFlag: raw.complianceFlag || null,
    urgency: ['high', 'medium', 'low'].includes(raw.urgency) ? raw.urgency : 'medium'
  };
}

async function diagnoseAndRecommend(transaction, customer, options = {}) {
  const attempt = options.attempt || 1;
  const maxAttempts = options.maxAttempts || 3;
  const previousActions = options.previousActions || [];

  if (IS_DEMO) {
    return pickDemoDiagnosis(transaction, customer, options);
  }

  const ageHours = Math.floor((Date.now() - new Date(transaction.createdAt)) / 3600000);
  const history = await methodHistory(customer._id, transaction.paymentMethod, transaction._id);
  const previousActionsText = previousActions.length
    ? previousActions.join('; ')
    : 'none (first attempt)';
  const gapText = attemptGapContext(transaction);

  const prompt = `You are MunaafaAI, a revenue recovery agent trained on Indian fintech payment patterns. Analyze this failed transaction and respond with ONLY a valid JSON object, no other text.

TRANSACTION:
- ID: ${transaction.transactionId}
- Amount: ₹${transaction.amount}, Type: ${transaction.type}, Status: ${transaction.status}
- Failure Code: ${transaction.failureCode || 'N/A'}, Reason: ${transaction.failureReason || 'N/A'}
- Payment Method: ${transaction.paymentMethod || 'N/A'}
- Occurred: ${occurrenceContext(transaction.createdAt)}, ${ageHours} hours ago
- Timing signal: ${gapText || 'no attempt-duration data recorded'}

CUSTOMER:
- Segment: ${customer.segment}, Risk score: ${customer.riskScore}/100, Lifetime spend: ₹${customer.totalSpend}
- Prior failures (all methods): ${customer.metadata?.failureCount ?? history.failures}
- History with ${transaction.paymentMethod || 'this method'}: ${history.successes} success(es), ${history.failures} failure(s)

ATTEMPT CONTEXT:
- This will be attempt ${attempt} of ${maxAttempts}
- Previous actions tried: ${previousActionsText}

DIAGNOSE the failure class as EXACTLY one of:
- INTENT: customer can't or won't pay (lost interest, no funds intent, churn risk)
- TECHNICAL: bank/UPI/network/method issue, customer is willing (declines, timeouts, bank server errors)
- TIMING: temporary money timing (insufficient funds, salary not credited, month-end crunch) — revisit later
- FRICTION: customer confused or checkout UX issue (abandoned mid-flow, session timeout)

Consider: time of day and day-of-month (salary-day failures around the 1st/5th/10th differ from mid-month), whether this customer has EVER succeeded with this payment method before, and how the case evolved across attempts.

RECOVERY ECONOMICS — compute before choosing an action:
- Expected recovery value = amountAtRisk (₹${transaction.amount}) × recoveryProbability / 100
- Intervention cost: ${costLine()}
- If expected recovery < intervention cost, recommendedAction MUST be WRITE_OFF and economicReason must say so.

Pick recommendedAction from EXACTLY one of: ${VALID_ACTIONS.join(', ')}.

confidenceChange: if attempt >= 2, explain numerically with sign how/why confidence changed versus the first attempt (e.g. "+5 (customer opened previous email)" or "-15 (second UPI failure same day)"). For attempt 1 use "+0 (first assessment)".

Return ONLY this JSON shape:
{"failureClass":"INTENT|TECHNICAL|TIMING|FRICTION","diagnosis":"one specific sentence","confidence":0-100,"recoveryProbability":0-100,"recommendedAction":"...","actionReason":"why this action for this failure class","economicReason":"Expected recovery ₹X > intervention cost ₹Y, so action is profitable","confidenceChange":"...","stoppingRule":"when to stop","complianceFlag":null,"urgency":"high|medium|low"}`;

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set but DEMO_MODE=false');
  }
  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 350,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.choices[0].message.content.trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    parsed = { recommendedAction: 'SEND_RECOVERY_EMAIL' };
  }
  return sanitizeDiagnosis(parsed);
}

const SEGMENT_MESSAGE_RULES = {
  consumer: `- consumer: conversational, warm and empathetic; light Hinglish is fine; VERY SHORT (2 sentences max). Include [PAYMENT_LINK].`,
  smb: `- smb: professional but warm; mention business continuity / keeping their service running; medium length (2-3 sentences). Include [PAYMENT_LINK].`,
  enterprise: `- enterprise: formal and polished; reference their dedicated account manager; offer a callback from the account manager instead of pushing a link.`
};

const segmentRules = (segment) => {
  if (segment === 'smb') return SEGMENT_MESSAGE_RULES.smb;
  if (segment === 'enterprise') return SEGMENT_MESSAGE_RULES.enterprise;
  return SEGMENT_MESSAGE_RULES.consumer;
};

async function generateRecoveryMessage(caseData, customer, action) {
  if (IS_DEMO) {
    return sanitizeMessage(pickDemoMessage(customer, action));
  }

  const prompt = `Write a SHORT, professional payment recovery message for ${customer.name} (${customer.segment} customer). Amount: ₹${caseData.amountAtRisk}. Recommended action: ${action}. Root cause: ${caseData.aiDiagnosis || 'N/A'}.

Follow the tone rules for this segment:
${segmentRules(customer.segment)}

STRICT WRITING RULES:
- NEVER use the word "failed". Say the payment "couldn't go through" or "needs attention" instead.
- NEVER open with "Dear ..." or "Hi [name] ...". Open with a warm, natural first line about the payment needing attention.
- 2-3 sentences maximum.
- Sound human, not like an automated bank notice.
Return ONLY the message text, no quotes, no labels.`;

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set but DEMO_MODE=false');
  }
  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 150,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }]
  });

  return sanitizeMessage(response.choices[0].message.content);
}

function sanitizeMessage(text) {
  let msg = String(text || '').trim();
  // Strip accidental greeting openers that violate the rules.
  msg = msg.replace(/^(Dear|Hi|Hello)\s+[^,]*,\s*/i, '');
  // Never let the word "failed" appear in customer-facing copy.
  msg = msg.replace(/\bfailed\b/gi, "couldn't go through");
  return msg.trim();
}

module.exports = { diagnoseAndRecommend, generateRecoveryMessage, VALID_ACTIONS, VALID_FAILURE_CLASSES };
