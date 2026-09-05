# MunaafaAI — Buildathon Pitch Kit

> Built for Razorpay Buildathon · Track 03: Revenue Recovery
> Stack: React 19 + Tailwind · Node/Express · MongoDB · Groq-hosted LLM

---

## 1. One-line pitch

**MunaafaAI is an AI revenue-recovery engine for fintech: it reads every failed payment, abandoned checkout, failed subscription and overdue invoice — uses an LLM to diagnose *why* money didn't come in, proposes one bounded recovery action per case, and executes it under hard stopping rules with a full audit trail, so no rupee is ever written off without being chased — and no customer is ever chased without limits.**

Even shorter: **"Don't let failed payments stay failed. MunaafaAI diagnoses why, recovers what's recoverable, and knows when to stop."**

---

## 2. The problem (why this matters)

- At the moment a card/UPI/NetBanking transaction fails, the money is **not lost yet** — it's *recoverable revenue*. Most of it is currently written off silently.
- Real-world leakage happens in four recurring shapes:
  - **Failed payments** (card declined, insufficient funds, expired card…)
  - **Abandoned checkouts** (session timeout, UPI PIN mis-entry, second thoughts)
  - **Failed subscriptions** (recurring mandates die silently → ongoing MRR loss)
  - **Overdue invoices** (B2B receivables)
- The status quo is blunt: a generic "please try again" email, or nothing at all.
- **The hidden problems with naive recovery:**
  1. **No diagnosis** — a declined card and an expired card need totally different actions, but rules-based dunning treats them the same.
  2. **No sense of the customer** — a VIP who hit a timeout is not the same as a risky repeat-failure.
  3. **No stopping rules** — automated dunning that runs forever is harassment, and in fintech that's a **compliance and reputational risk**.
  4. **No audit trail** — finance teams can't justify automated actions they can't reconstruct.

**The gap:** tools that know *who* owes money, and tools that know *why* — nobody was putting an LLM in between, bounded by hard rules a finance team can sign off on.

---

## 3. What MunaafaAI does (system overview)

A complete, authenticated web platform (login → dashboard → operations):

| Page | What it does |
|---|---|
| **Signup / Login** | JWT-secured auth, bcrypt-hashed passwords |
| **Dashboard** | Live ₹ at risk, ₹ recovered, recovery rate, active cases, 7-day recovery chart, breakdown by case type, recent activity |
| **Transactions** | Full ledger of payments with status/type/method/age filters + search; one-click "Create Recovery Case" on any failed/abandoned/overdue row |
| **Recovery Cases** | Every AI-diagnosed case as a card: ₹ at risk, AI diagnosis, confidence, recommended action, attempts `n/max`, next retry time, **Execute Action** button |
| **Run Recovery** | One-click **full AI sweep** across every recoverable transaction with a **live streaming feed** of each diagnosis as it completes |
| **Audit Log** | Immutable chronological timeline of `CASE_CREATED`, `ACTION_EXECUTED`, `STOPPING_RULE_TRIGGERED` events with actor, details and outcome |

### The 4 case types MunaafaAI watches
`payment_failure` · `checkout_abandonment` · `subscription_failure` · `invoice_overdue`

### The 8 bounded actions MunaafaAI may choose
`RETRY_PAYMENT` · `SWITCH_PAYMENT_METHOD` · `SEND_RECOVERY_EMAIL` · `SEND_SMS_REMINDER` · `APPLY_DISCOUNT` · `ESCALATE_TO_AGENT` · `MANDATE_RETRY` · `WRITE_OFF`

The AI **cannot invent new actions** — it picks exactly one from this whitelist, with a reasoning, a confidence score, and an urgency level.

---

## 4. How it works — end to end

```
Failed txn / abandoned checkout / overdue invoice
        │
        ▼
1. DIAGNOSE   LLM (Groq) gets: transaction (amount, type, failure code, method,
              age) + customer (segment, risk score, lifetime spend, prior failures)
              → returns ONLY structured JSON: root-cause diagnosis, confidence,
              recovery probability, recommended action + reason, urgency
        │
        ▼
2. BOUND     deterministic engine attaches per-type stopping rule
             (attempt ceiling + max-age window) BEFORE anything happens
        │
        ▼
3. EXECUTE   "Execute Action" → LLM writes a short, empathetic, segment-aware
             recovery message (₹ + [PAYMENT_LINK]) → outcome simulated with a
             per-action success probability that decays with each attempt
        │
        ▼
4. ESCALATE  miss → escalation level rises, next retry scheduled with real
             backoff (2h → 6h → 24h)
        │
        ▼
5. STOP      attempts ≥ ceiling → case auto-closed as `closed_lost`,
             reason written to the audit log. The agent NEVER retries forever.
```

**The key architectural idea — "AI proposes, the engine disposes":**
There are **two separate engines**:
- `aiAgent.js` — the *stochastic* brain (LLM diagnosis + message writing)
- `recoveryEngine.js` — the *deterministic* spine (stopping rules, backoff, escalation, outcome simulation)

The LLM is never trusted with control. It diagnoses and recommends inside a sandbox; a deterministic engine decides what is actually allowed. **That split is the product's whole trust story.**

---

## 5. Tech stack & architecture

```
┌────────────────────────┐  JWT   ┌─────────────────────────┐   HTTPS   ┌────────────┐
│ React 19 + Tailwind SPA│ ◄────► │ Express API (Node.js)   │ ◄───────► │  Groq LLM  │
│ Recharts dashboards    │        │ auth → recoveryEngine    │           │ (JSON-mode │
│ guarded routes         │        │        → aiAgent         │           │ diagnosis) │
└────────────────────────┘        └───────────┬─────────────┘           └────────────┘
                                              ▼
                                      MongoDB (Mongoose)
                              User · Customer · Transaction ·
                              RecoveryCase · AuditLog
```

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind + Recharts | fast dev, dark finance-grade UI, live charts |
| Backend | Express + Mongoose | clean route/service split, fast iteration |
| LLM | Groq-hosted model via OpenAI SDK (`GROQ_MODEL`, default `qwen/qwen3.8-27b`) | **speed + cost at scale** — diagnosis per txn must be near-instant and cheap, or the product doesn't scale |
| Output control | `response_format: json_object` + a `sanitizeDiagnosis()` clamp layer | model output is *always* valid + bounded even if the model misbehaves (defense in depth) |
| Auth | JWT (HS256, 7d) + bcrypt(12) | standard, session per user, `auth/me` restore |
| Hardening | helmet, rate limiting, locked CORS, express-validator, 100kb body cap, refuses to boot without `JWT_SECRET` | revenue software must look production-grade, not hackathon-grade |
| Data | Indian-first seed: ₹ amounts, UPI/card/wallet/EMI methods, real failure codes (`UPI_TIMEOUT`, `EMI_NOT_APPROVED`, `CARD_EXPIRED`…), consumer/SMB/enterprise segments | **this is a Razorpay-shaped problem — the demo data speaks the judges' language** |

**Everything on the dashboard is computed live from MongoDB** — zero hardcoded numbers. Whatever a judge sees on screen is real, queryable, and reproducible in front of them.

---

## 6. Key design decisions — and why we made them

Judges reward *why*, not just *what*. These are the decisions we defend:

**D1 — LLM diagnosis over rules-based dunning.**
A rule engine can say "send a reminder." Only an LLM can read `CARD_DECLINED, ₹18,500, netbanking, VIP customer who failed once in 2 years` and say *"card issuer soft-declined a high-value SMB payment; suggest switching to UPI/another card via a short WhatsApp-style nudge."* Every case gets a **root cause, not a template.**

**D2 — AI proposes, deterministic engine disposes.**
We refused to let an LLM hold the steering wheel. Diagnosis and copy are stochastic; attempts, ceilings, backoff and closure are hard-coded rules. This is what makes the system **safe enough for real money**.

**D3 — Bounded action set (8), enforced twice.**
The model is told to pick from 8 actions *and* the sanitizer silently replaces anything out-of-set with a safe default. The AI can't surprise you.

**D4 — Per-type stopping rules because not all money churns equally.**
- `checkout_abandonment`: 2 attempts / 48h window — carts decay fastest, don't nag.
- `payment_failure`: 3 attempts / 72h.
- `subscription_failure`: 4 attempts / 7 days — a dead mandate is *silent recurring loss*; it deserves the longest, most persistent chase.
- `invoice_overdue`: 5 attempts / 30 days — large B2B receivables, high-touch, slow cycle.

**D5 — Escalation ladder + real backoff, not identical retries.**
Attempt 1 ≠ attempt 3. Misses raise an escalation level (0→4, capping at agent hand-off) and schedule the next touch at 2h → 6h → 24h — mimicking how a great human collections rep actually works.

**D6 — Honest outcome modeling.**
Each action has a distinct success probability (`SWITCH_PAYMENT_METHOD` 60%, `APPLY_DISCOUNT` 65%, `SEND_RECOVERY_EMAIL` 35%…), and every attempt decays your odds by ~10% — because later attempts *are* harder. Our dashboards don't show fantasy numbers; the simulation respects reality. (And swapping the simulator for a real Razorpay call is a one-function change — see §10.)

**D7 — Segment-aware, India-first communication.**
The recovery message adapts to customer segment and context, and for Indian consumer customers the LLM may write **light Hinglish** — because recovery copy that feels human outperforms corporate English, and this buildathon's judges know that audience better than anyone.

**D8 — Audit-first design.**
Every lifecycle event is written to an immutable log with case ID, actor, details and outcome, and the Audit page highlights compliance-relevant events. For fintech, *provability* is a feature.

**D9 — Security treated as a feature, not an afterthought.**
Rate-limited auth (20/15 min), global rate limits, CORS locked to one origin, server that refuses to boot without a secret, validation on every input, no plaintext passwords anywhere. In revenue tech, trust is the product.

---

## 7. What makes us NOVEL / UNIQUE (say these out loud)

1. **Root-cause diagnosis per failed transaction** — not "retry," but *why*: expired card vs declined vs timeout each get different actions. Rules engines can't do this; generic AI wrappers don't bother.
2. **Human-in-the-loop autonomy with hard guardrails** — the AI recommends, a human clicks execute, and even the human can't exceed the stopping rules. "Autonomous but accountable."
3. **The trust architecture:** two engines (stochastic brain / deterministic spine) + bounded action whitelist + per-type ceilings + immutable audit log. We're not selling magic; we're selling **AI that finance can audit**.
4. **Solves the exact four loss shapes** a payments business has — payments, checkouts, subscriptions, invoices — with rules tuned per shape.
5. **India-native problem modeling** — UPI timeouts, EMI not approved, wallet limits, Hinglish recovery copy, ₹ dashboards. It's not a US dunning tool reskinned; it's built for this market.
6. **No fake numbers** — all metrics computed live; outcome probabilities decay per attempt so the model of reality stays credible.
7. **Live demo theatre** — the full AI sweep streams each diagnosis into the UI in real time. It *feels* like watching an agent work.

**The one-sentence differentiator:**
> *"Most recovery tools tell you a payment failed. MunaafaAI tells you WHY it failed, what to do about it, when to stop — and proves every step it took."*

---

## 8. Demo script (~90 seconds)

1. **Open with the problem** (5s): "Failed payments are recoverable money. Right now most of it is written off silently."
2. **Seed** (skip if data present): run the seed — 10 customers, 50 transactions, 45 recoverable (₹ in the lakhs).
3. **Dashboard** (10s): point at ₹ At Risk → ₹ 0 recovered. "This is money sitting on the table."
4. **Transactions** (10s): filter to failed/abandoned/overdue. Pick one interesting transaction (e.g., a UPI timeout). **Click "Create Recovery Case."**
5. **Recovery Cases** (15s): show the fresh case — read the AI diagnosis out loud, show confidence and recommended action. "The model actually read this transaction and this customer."
6. **Execute Action** (15s): click it. Show the generated message, the recovered amount appearing, and the escalation/scheduling logic if it misses.
7. **Run Recovery → full sweep** (15s): run the batch and let the **live feed** stream diagnoses — this is the wow moment.
8. **Audit Log** (10s): "Every one of those steps was logged. If a regulator or a finance head asks what the AI did — here's the answer."
9. **Close** (10s): "Rules engines send emails. MunaafaAI runs a bounded, auditable recovery operation. And swapping simulation for live Razorpay is a one-function change."

**Demo tips:**
- Run the sweep *before* you present so you have real recovered data on the dashboard, then re-run it live for theatre.
- Create one case from a single transaction first (controlled), then batch (chaos + wow).
- Read the AI diagnosis aloud — it proves the LLM is actually reasoning.

---

## 9. What's the real impact (metrics to quote)

- Recovery rate is computed live (recovered ÷ total cases) — quote the number on *your* screen.
- Per-action success rates and attempt decay make the numbers defensible.
- Frame the economics: even a 10–20% recovery on written-off failures is a **direct bottom-line lift with no new customers acquired** — recovery is the cheapest revenue there is (you already paid to acquire that customer and ran the transaction).

---

## 10. Roadmap / path to production (answers "so what now?")

- **Live payment execution** — replace `simulateRecoveryOutcome()` with real Razorpay APIs (retry via Payment Link, mandate retry, etc.) + webhooks. The architecture isolates this to one function.
- **Real channels** — wire `SEND_RECOVERY_EMAIL` / `SEND_SMS_REMINDER` to email/SMS providers; the LLM already writes the copy.
- **Background sweeper** — cron/scheduler that executes due `nextRetryAt` cases automatically (the guardrails already make unattended mode safe).
- **Multi-tenant per business**, per-business model tuning.
- **A/B recovery copy**, discount budget caps, and learning from outcomes to tune success probabilities from real data instead of priors.
- **Full regulatory posture** — e.g., channels/cadence constraints per region so automated outreach stays compliant.

---

## 11. Q&A prep (tough questions + honest answers)

**Q: How is this different from existing dunning/recovery tools?**
A: Existing tools are rule-based and channel-first — they schedule emails. We are diagnosis-first: an LLM reads every failed transaction in context and recommends *one* of 8 bounded actions with reasoning and confidence. Rules decide what's allowed; the AI decides what's smart. And we can prove both halves.

**Q: Why let an LLM anywhere near payments? What if it's wrong?**
A: The LLM is *not* in the control path. It can only choose from a fixed action set, its output is sanitized server-side, every action needs execution approval, and hard attempt ceilings + escalation caps mean even a wrong recommendation can't cause runaway behavior. Wrongness is contained and logged.

**Q: Aren't the recovery outcomes simulated?**
A: Yes — deliberately, and we say so. This environment has no live Razorpay credentials, so we model each action's success probability and attempt decay to keep metrics honest. The code path is structured so swapping the simulator for live Razorpay calls + webhooks is a one-function change — the entire product around it is real.

**Q: What data would you need to make probabilities real?**
A: Outcome history per action and channel — which is exactly what our audit log starts collecting from day one. The sim priors become learned posteriors.

**Q: Isn't automated dunning risky for a brand?**
A: That's the opposite of our bet — unconstrained dunning is the risk. Our whole differentiator is that MunaafaAI *stops*: per-type ceilings, backoff, escalation to humans, closed-lost write-offs, and a full audit trail for compliance.

---

## 12. Winning checklist (before you present)

- [ ] Rebrand check: no "RecoverAI" anywhere; brand is MunaafaAI in sidebar, login, signup, title.
- [ ] Run seed → run one batch sweep → run a few executions so the dashboard shows recovered ₹ and a chart line.
- [ ] Have a "single case" (fresh, unexecuted) ready for the controlled part of the demo.
- [ ] Rehearse reading one AI diagnosis out loud.
- [ ] Know your live numbers: ₹ at risk, ₹ recovered, recovery rate.
- [ ] Memorize: the 8 actions, the 4 case types, the 3 stopping-rule examples, the "AI proposes, engine disposes" line.

---

*MunaafaAI — diagnosis-first, guardrail-bounded, fully audited revenue recovery.*
