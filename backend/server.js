require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('./middleware/auth');

const IS_DEMO = process.env.DEMO_MODE === 'true';

const missing = [];
if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
if (missing.length) {
  console.error(`FATAL: missing required environment variable(s): ${missing.join(', ')}. Refusing to start.`);
  process.exit(1);
}
if (!IS_DEMO && !process.env.GROQ_API_KEY) {
  console.warn('WARNING: GROQ_API_KEY is not set. AI diagnosis calls will fail unless DEMO_MODE=true.');
}

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // DEMO_MODE relaxes the cap so on-stage retries and judge accounts never
  // hit a lockout wall; production keeps the strict limit.
  max: IS_DEMO ? 500 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.use('/api/auth', authLimiter, require('./routes/auth'));

// everything below requires a valid JWT
app.use('/api/transactions', requireAuth, require('./routes/transactions'));
app.use('/api/recovery', requireAuth, require('./routes/recovery'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/seed', requireAuth, require('./routes/seed'));
app.use('/api/audit', requireAuth, require('./routes/audit'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5001;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('FATAL: could not connect to MongoDB:', err.message);
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`MunaafaAI backend running on port ${PORT}${IS_DEMO ? ' (DEMO_MODE)' : ''}`));
}

start();
