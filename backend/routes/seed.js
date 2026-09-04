const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const RecoveryCase = require('../models/RecoveryCase');
const AuditLog = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------
// Deterministic PRNG (mulberry32). A fixed seed means every seed
// run produces the exact same customers, amounts and failure
// patterns — so demo numbers are stable and believable, never
// random on every refresh.
// ---------------------------------------------------------------
const SEED = 20260905;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fresh per seed call, so re-seeding always reproduces the same data.
function createRand() {
  return mulberry32(SEED);
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function randomAmount(min, max, rand) {
  // Round to a believable number (no random cents-looking values).
  const value = rand() * (max - min) + min;
  if (value >= 10000) return Math.round(value / 100) * 100;
  if (value >= 1000) return Math.round(value / 50) * 50;
  return Math.round(value / 10) * 10;
}

function randomPastDate(maxHoursAgo, rand) {
  return new Date(Date.now() - rand() * maxHoursAgo * 3600000);
}

// A transaction starts (checkout opened / attempt begins) and then fails some
// minutes later. Instant failures usually mean wrong details; delayed failures
// usually point at the bank/rail side.
function startedBefore(createdAt, minMinutesAgo, maxMinutesAgo, rand) {
  const minutes = minMinutesAgo + rand() * (maxMinutesAgo - minMinutesAgo);
  return new Date(createdAt.getTime() - minutes * 60000);
}

const INDIAN_NAMES = [
  'Aarav Sharma', 'Priya Iyer', 'Rohan Mehta', 'Ananya Reddy', 'Vikram Nair',
  'Sneha Kapoor', 'Karan Malhotra', 'Divya Rao', 'Arjun Singh', 'Neha Gupta'
];

const FAILURE_CODES = {
  card: ['CARD_DECLINED', 'INSUFFICIENT_FUNDS', 'CARD_EXPIRED', 'BANK_DECLINED'],
  upi: ['UPI_TIMEOUT', 'UPI_PIN_MISMATCH', 'INSUFFICIENT_FUNDS'],
  netbanking: ['BANK_SERVER_ERROR', 'SESSION_TIMEOUT'],
  wallet: ['INSUFFICIENT_BALANCE', 'WALLET_LIMIT_EXCEEDED'],
  emi: ['EMI_NOT_APPROVED', 'BANK_DECLINED']
};

const FAILURE_REASONS = {
  CARD_DECLINED: 'Card issuer declined the transaction',
  INSUFFICIENT_FUNDS: 'Insufficient funds in account',
  CARD_EXPIRED: 'Card has expired',
  BANK_DECLINED: 'Bank declined the authorization request',
  UPI_TIMEOUT: 'UPI request timed out waiting for approval',
  UPI_PIN_MISMATCH: 'Incorrect UPI PIN entered',
  BANK_SERVER_ERROR: 'Bank server unavailable during transaction',
  SESSION_TIMEOUT: 'Customer session expired before completion',
  INSUFFICIENT_BALANCE: 'Wallet balance too low',
  WALLET_LIMIT_EXCEEDED: 'Wallet transaction limit exceeded',
  EMI_NOT_APPROVED: 'EMI conversion not approved by bank'
};

router.post('/', async (req, res) => {
  const rand = createRand();
  try {
    await Customer.deleteMany({});
    await Transaction.deleteMany({});
    await RecoveryCase.deleteMany({});
    await AuditLog.deleteMany({});

    const segments = ['consumer', 'consumer', 'consumer', 'smb', 'smb', 'smb', 'enterprise', 'enterprise', 'consumer', 'smb'];
    const customers = [];
    for (let i = 0; i < 10; i++) {
      const name = INDIAN_NAMES[i];
      const segment = segments[i];
      const totalSpend =
        segment === 'enterprise' ? randomAmount(500000, 2000000, rand)
        : segment === 'smb' ? randomAmount(50000, 300000, rand)
        : randomAmount(2000, 50000, rand);
      const customer = await Customer.create({
        name,
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        phone: `+91${9000000000 + Math.floor(rand() * 99999999)}`,
        segment,
        totalSpend,
        riskScore: Math.floor(rand() * 100),
        metadata: { failureCount: Math.floor(rand() * 4) }
      });
      customers.push(customer);
    }

    const transactions = [];
    const paymentMethods = ['card', 'upi', 'netbanking', 'wallet', 'emi'];

    // 15 failed payments — the attempt starts, then fails minutes later.
    // Long gaps (bank/UPI timeouts, server errors) point at the rail side;
    // near-instant failures usually mean wrong or expired card details.
    for (let i = 0; i < 15; i++) {
      const method = pick(paymentMethods, rand);
      const code = pick(FAILURE_CODES[method], rand);
      const createdAt = randomPastDate(96, rand);
      const slowFailure = ['UPI_TIMEOUT', 'BANK_SERVER_ERROR', 'SESSION_TIMEOUT', 'BANK_DECLINED'].includes(code);
      transactions.push({
        transactionId: `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
        customer: customers[i % customers.length]._id,
        amount: randomAmount(1500, 350000, rand),
        type: 'payment',
        status: 'failed',
        failureReason: FAILURE_REASONS[code],
        failureCode: code,
        paymentMethod: method,
        startedAt: startedBefore(createdAt, slowFailure ? 2 : 0.05, slowFailure ? 30 : 1.5, rand),
        createdAt
      });
    }

    // 10 abandoned checkouts — the cart sat for a while (minutes to hours)
    // before the customer dropped off.
    for (let i = 0; i < 10; i++) {
      const createdAt = randomPastDate(72, rand);
      transactions.push({
        transactionId: `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
        customer: customers[(i * 2) % customers.length]._id,
        amount: randomAmount(800, 90000, rand),
        type: 'checkout',
        status: 'abandoned',
        paymentMethod: pick(paymentMethods, rand),
        startedAt: startedBefore(createdAt, 5, 240, rand),
        createdAt
      });
    }

    // 12 failed subscriptions
    for (let i = 0; i < 12; i++) {
      const method = pick(['card', 'upi'], rand);
      const code = pick(FAILURE_CODES[method], rand);
      const createdAt = randomPastDate(168, rand);
      transactions.push({
        transactionId: `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
        customer: customers[(i + 2) % customers.length]._id,
        amount: randomAmount(300, 30000, rand),
        type: 'subscription',
        status: 'failed',
        failureReason: FAILURE_REASONS[code],
        failureCode: code,
        paymentMethod: method,
        startedAt: startedBefore(createdAt, 0.05, 2, rand),
        createdAt
      });
    }

    // 8 overdue invoices — B2B, larger amounts, aged receivables.
    for (let i = 0; i < 8; i++) {
      const createdAt = randomPastDate(720, rand);
      transactions.push({
        transactionId: `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
        customer: customers[(i * 3 + 1) % customers.length]._id,
        amount: randomAmount(50000, 600000, rand),
        type: 'invoice',
        status: 'overdue',
        paymentMethod: pick(['netbanking', 'card'], rand),
        startedAt: startedBefore(createdAt, 720, 2160, rand),
        createdAt
      });
    }

    // 5 successful (baseline)
    for (let i = 0; i < 5; i++) {
      transactions.push({
        transactionId: `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
        customer: customers[(i * 5 + 3) % customers.length]._id,
        amount: randomAmount(500, 100000, rand),
        type: 'payment',
        status: 'success',
        paymentMethod: pick(paymentMethods, rand),
        createdAt: randomPastDate(48, rand)
      });
    }

    const inserted = await Transaction.insertMany(transactions);

    res.json({
      message: 'Seed complete',
      customers: customers.length,
      transactions: inserted.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
