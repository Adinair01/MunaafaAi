# MunaafaAI

**Razorpay Buildathon — Track 03: Revenue Recovery**  
Built by Aditya.

An AI-powered revenue recovery platform. MunaafaAI watches failed payments, abandoned checkouts, failed subscriptions, and overdue invoices, then uses a Groq-hosted LLM to diagnose the root cause of each revenue loss and recommend a bounded recovery action — with hard stopping rules and a full audit trail so nothing runs unchecked.

## Key Features

- **Authenticated access** — email/password signup and login, JWT-protected API, bcrypt password hashing. No data is reachable without a valid session.
- **AI diagnosis engine** — an LLM (via Groq) analyzes each failed transaction + customer profile and returns a structured diagnosis, confidence score, recovery probability, and one recommended action.
- **Bounded action set** — the AI can only choose from 8 predefined actions (retry, switch method, email, SMS, discount, escalate, mandate retry, write-off). It cannot invent new actions.
- **Stopping rules** — every case type has a max-attempts / max-age ceiling. Cases automatically close as `closed_lost` once exhausted, so recovery attempts never run forever.
- **Batch recovery sweep** — process every open failed/abandoned/overdue transaction in one call, with a live front-end feed of each diagnosis as it completes.
- **Full audit trail** — every case creation, action execution, and stopping-rule trigger is written to an immutable audit log.
- **Dashboard** — real ₹ at risk, ₹ recovered, recovery rate, and activity charts, all computed from live data (no hardcoded numbers).

## Security

- Passwords hashed with bcrypt (12 rounds) — never stored or logged in plaintext.
- JWT (`HS256`) issued on login/signup, verified on every protected request; server refuses to boot without a `JWT_SECRET`.
- `helmet` for standard HTTP security headers.
- Rate limiting: 20 requests / 15 min on `/api/auth/*` (brute-force protection), 300 requests / 15 min globally on `/api/*`.
- CORS locked to a single configured `FRONTEND_URL` origin — not wildcard.
- Request body size capped at 100kb; all auth input validated server-side with `express-validator`.
- Every non-auth route requires a valid `Authorization: Bearer <token>` header.

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐         ┌─────────────────┐
│   React + Tailwind SPA  │  JWT    │   Express API (Node.js)  │  HTTPS  │   Groq API       │
│  Login/Signup guarded   │ ◄─────► │  auth → recoveryEngine   │ ◄─────► │  (LLM diagnosis  │
│  Dashboard/Txns/Cases…  │  :5001  │       → aiAgent          │         │   + messages)    │
└─────────────────────────┘         └───────────┬──────────────┘         └─────────────────┘
                                                 │
                                                 ▼
                                     ┌──────────────────────────┐
                                     │        MongoDB            │
                                     │  User / Customer /        │
                                     │  Transaction / Recovery-  │
                                     │  Case / AuditLog          │
                                     └──────────────────────────┘
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) or a connection string to a hosted instance
- A Groq API key ([console.groq.com](https://console.groq.com))

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set GROQ_API_KEY and a long random JWT_SECRET
npm run dev
```

The API runs on `http://localhost:5001` (port 5000 is reserved on macOS by AirPlay Receiver).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`. The dev server proxies `/api` to the backend on port 5001.

### 3. Create an account and seed data

1. Go to `/signup`, create an account (name, email, password ≥ 8 characters).
2. Once logged in, seed sample data:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"you@example.com","password":"yourpassword"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
   curl -X POST http://localhost:5001/api/seed -H "Authorization: Bearer $TOKEN"
   ```
   This creates 10 customers and 50 transactions (15 failed payments, 10 abandoned checkouts, 12 failed subscriptions, 8 overdue invoices, 5 successful baseline).

## How AI Recovery Works

1. **Trigger** — a recovery case is created for a failed/abandoned/overdue transaction, either individually (Transactions page) or in a batch sweep (Run Recovery page).
2. **Diagnose** — `services/aiAgent.js` sends the transaction + customer context to the LLM (Groq), which returns a root-cause diagnosis, a confidence score, a recovery probability, and exactly one recommended action from a fixed list.
3. **Bound** — `services/recoveryEngine.js` attaches a stopping rule (max attempts + max age) based on the case type before any action is taken.
4. **Execute** — hitting "Execute Action" generates a short recovery message (via the LLM) and simulates the outcome. A success closes the case as `recovered`; a miss schedules the next retry with backoff (2h → 6h → 24h) and increments the attempt counter.
5. **Stop** — once `attempts >= maxAttempts`, the case is force-closed as `closed_lost` and the reason is logged — the agent never retries indefinitely.
6. **Audit** — every step (`CASE_CREATED`, `ACTION_EXECUTED`, `STOPPING_RULE_TRIGGERED`) is written to the audit log with actor, details, and outcome, giving a complete compliance trail.

## Project Structure

```
backend/
  models/       User, Customer, Transaction, RecoveryCase, AuditLog
  middleware/   auth.js (JWT verification)
  services/     aiAgent.js (Groq LLM calls), recoveryEngine.js (stopping rules, execution)
  routes/       auth, transactions, recovery, dashboard, seed, audit
  server.js
frontend/
  src/api/         axios client with JWT interceptor
  src/context/     AuthContext, ToastContext
  src/components/  Sidebar, MetricCard, RecoveryCaseCard, StatusBadge, AuditTimeline, ProtectedRoute
  src/pages/       Login, Signup, Dashboard, Transactions, RecoveryCases, RunRecovery, AuditLog
```

## Notes

- `.env` is git-ignored — never commit real API keys or the JWT secret.
- All figures on the dashboard are computed live from MongoDB; nothing is hardcoded in the frontend.
- Recovery outcomes (success/pending) are simulated with weighted probabilities per action type, since this environment has no live Razorpay integration. Swapping `simulateRecoveryOutcome` in `recoveryEngine.js` for a real Razorpay API call is the only change needed to go live.
- The Groq model is configurable via `GROQ_MODEL` in `.env` (defaults to `openai/gpt-oss-120b`).
