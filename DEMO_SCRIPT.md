# MunaafaAI — Local Run Guide + 3–4 Minute Presentation Script

> Hand this whole file to your AI helper. It contains: (A) exact commands to run the system locally, (B) a minute-by-minute presentation script with the EXACT things to say on each screen, (C) delivery coaching, (D) Q&A prep, (E) a judge shortlist checklist.

---

# PART A — HOW TO RUN THE WHOLE SYSTEM (LOCAL)

## A1. What you need (check once)
| Requirement | How to check |
|---|---|
| Node.js 18+ | `node -v` |
| MongoDB running | `lsof -nP -iTCP:27017 -sTCP:LISTEN` — should show `mongod` |
| Port 5001 free | `lsof -nP -iTCP:5001 -sTCP:LISTEN` — should show NOTHING |
| `backend/.env` exists | `cat backend/.env` (keys: MONGODB_URI, GROQ_API_KEY, JWT_SECRET, DEMO_MODE, PORT) |

**IMPORTANT:** `.env` must have `DEMO_MODE=true`. In demo mode the AI is instant + deterministic and the app works with **no internet, no Groq API key**. That is your safety net on stage.

If MongoDB is installed but not running (macOS Homebrew):
```bash
brew services start mongodb-community
```

## A2. Start order (this is the only thing that matters)

**Terminal 1 — BACKEND (port 5001):**
```bash
cd backend
npm run dev
```
You must see:
```
MongoDB connected
MunaafaAI backend running on port 5001 (DEMO_MODE)
```
Keep this terminal OPEN. If you close it, the frontend loses its API and shows "Cannot reach the server on port 5001."

**Terminal 2 — FRONTEND (port 3000):**
```bash
cd frontend
npm run dev
```
Open **http://localhost:3000**

## A3. Sanity check (before judges arrive)
```bash
curl http://localhost:5001/api/health
# → {"status":"ok",...}
```

## A4. Prepare the data BEFORE presenting (~1 minute of quiet prep)
1. Open http://localhost:3000/signup and create an account (or sign in to your existing one).
2. Seed the data. Do it with curl in the backend terminal (fastest) OR via UI:
   ```bash
   # in Terminal 1 while server runs — grab a token first:
   TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
   curl -X POST http://localhost:5001/api/seed -H "Authorization: Bearer $TOKEN"
   ```
3. Run ONE sweep so the dashboard has live recovered numbers:
   ```bash
   curl -X POST http://localhost:5001/api/recovery/run-batch -H "Authorization: Bearer $TOKEN" -o /dev/null
   ```
4. Execute 3–4 recovery actions so there are `recovered` cases + a meaningful recovery rate:
   ```bash
   # list open cases, pick 4 caseIds, execute each:
   curl -s http://localhost:5001/api/recovery/cases -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).filter(c=>["open","in_progress"].includes(c.status)).slice(0,4).map(c=>c.caseId).join(" ")' | while read ids; do for id in $ids; do curl -s -X POST http://localhost:5001/api/recovery/execute/$id -H "Authorization: Bearer $TOKEN" > /dev/null; done; done
   ```
5. Refresh the dashboard. Now it shows real recovered ₹, a recovery rate, and chart data.
6. Keep 1–2 cases OPEN and un-executed so you can show "Execute Action" live on stage.

> ⚠️ **Do the sweep BEFORE going live.** On camera you want the dashboard rich. You can still re-run a sweep live as the "wow moment" — it takes ~10s in demo mode.

## A5. If something breaks on the day
| Symptom | Fix |
|---|---|
| "Cannot reach server on 5001" | Backend terminal closed/crashed → restart `npm run dev` in `backend/` |
| "MongoDB not connected" | Start Mongo (`brew services start mongodb-community`) |
| Port 5001 in use | `kill` the process from `lsof -nP -iTCP:5001 -sTCP:LISTEN` |
| Dashboard all zeros | Run seed + one sweep again (Part A4) |
| Signup "already exists" | Use the "Sign in instead" link, or a fresh email |
| Internet died mid-demo | Nothing happens — DEMO_MODE=true means zero live-LLM dependency |

---

# PART B — THE 3–4 MINUTE PRESENTATION (SCREEN BY SCREEN)

**Total: ~3:45.** Four beats: PROBLEM → PROOF (single case) → POWER (sweep) → TRUST (audit + close).

## ⏱ Timing map
| Time | Screen | Beat |
|---|---|---|
| 0:00–0:20 | Dashboard (loaded, live) | Hook + stakes |
| 0:20–1:10 | Dashboard deep-dive | The 4 loss shapes + failure classes |
| 1:10–2:00 | Transactions → one case | "Watch it reason" (Wow 1) |
| 2:00–2:35 | Recovery Cases → Execute | Money actually moves |
| 2:35–3:15 | Run Recovery → live sweep | Scale + summary modal (Wow 2) |
| 3:15–3:45 | Audit Log + close | Trust + why we win |

---

## BEAT 1 — Hook + stakes (Dashboard, 0:00–1:10)

**You say (0:00–0:20), while the dashboard is already on screen, cursor on the ₹ At Risk card:**
> "Every failed payment is a second chance most companies never take. The moment a transaction fails — a declined card, an abandoned checkout, a dead subscription — the money doesn't vanish. It becomes write-off that nobody chased. MunaafaAI is an AI recovery agent for fintech: it reads WHY each payment failed, decides what to do about it, knows exactly when to stop, and proves every step it took. This is a live dashboard — everything you see came out of real queries on real transactions in the last minute."

**Then 0:20–1:10, move the cursor across the four metric cards, slowly:**
> "This business has ₹XX lakh at risk right now — failed payments, abandoned checkouts, lapsed subscriptions, overdue invoices. Four loss shapes, one engine. We've already recovered ₹XX lakh at a XX% recovery rate, and every case is classified by root cause."

**Pause on the donut (failure classes) and say:**
> "Here's the part rules-based dunning can't do — we don't just see 'a payment failed.' The AI classifies WHY: technical — the bank or UPI rail blocked it; timing — salary day, funds hadn't landed; friction — the customer got confused at checkout; intent — they've stopped wanting to pay. Different causes need different recovery plays. Watch what happens when I open one."

> **Delivery coaching:** speak slowly here. Pause after the hook line. Judges decide in the first 20 seconds whether this is "another dashboard" or a real product — the failure-class sentence is what separates you.

---

## BEAT 2 — Watch it reason (Transactions → one case, 1:10–2:00)

**Action:** Click **Transactions** in the sidebar. Filter Status = **Failed** (or Abandoned). Pick one row with a real failure code — ideally UPI or card. Click **+ Create Case**.

**You say (while it loads — say nothing for the 2 seconds it takes, silence sells):**
> "Let's take one real transaction. ₹XX,XXX — UPI payment that timed out. One click — the AI reads this transaction in full context. It's not a template — watch the diagnosis."

**Read the diagnosis ALOUD, word for word** (on the Recovery Case card or in the feed):
> "It says: [READ the aiDiagnosis line]. And it's telling us this is a TECHNICAL failure — not that the customer doesn't want to pay. Confidence XX%. And look at this — the economics: 'Expected recovery ₹XX,XXX versus intervention cost ₹0 — so the action is profitable.' Every recommendation is justified against its cost."

**Point at the recommended action badge:**
> "From 8 bounded actions — retry, switch payment method, recovery email, SMS, discount, escalate to a human, mandate retry, or write off — the AI picked exactly one: [ACTION]. It can't invent new actions. That's the safety rail."

> **Delivery coaching:** this is your "not a wrapper" proof. The diagnosis text is on screen — reading it aloud word-for-word proves the model reasoned about THIS transaction, not a canned string.

---

## BEAT 3 — Money actually moves (Recovery Cases → Execute, 2:00–2:35)

**Action:** Click **Recovery Cases**. On a case whose status is `open`/`in_progress` and attempts show `0/3`, click **▶ Execute Action**.

**You say:**
> "The AI proposes — but a human clicks execute, and the ENGINE decides what's allowed. This is the architectural bet: AI proposes, deterministic rules dispose. Watch the money move."

**When the toast fires / card updates:**
> "Attempt 1 of 3. If it recovers, the case closes and the rupee is back. If it misses, the engine doesn't spam — escalation level goes up, the next touch is scheduled with real backoff — 2 hours, then 6, then 24 — and the case is capped. This case can never be chased more than 3 times. Ever. That's the stopping rule — no harassment, no runaway automation."

> **Delivery coaching:** if the execute misses (shows in_progress), that's FINE — even better: you then explain the escalation ladder naturally: "see, it scheduled the next attempt instead of spamming." Either outcome tells your story.

---

## BEAT 4 — Scale: the full sweep (Run Recovery, 2:35–3:15) — the WOW

**Action:** Click **Run Recovery**. Pause. Click the big **▶ Run Full AI Recovery Sweep** button.

**You say (before clicking):**
> "One transaction is a demo. The real problem is scale — hundreds of failures a day. So we built the sweep. One click — every failed transaction in the business, diagnosed live, on camera."

**Let ~8–12 rows stream into the Live Feed. Say (quietly, like a commentator):**
> "There it is — each row is a real transaction being read and diagnosed in real time. Failure class, action, economic justification — every one."

**When the summary modal pops (~10s in demo):**
> "And here's the sweep summary. ₹XX lakh recovered in a single pass at a XX% recovery rate. Look at the breakdown by failure class — TIMING recovered X, TECHNICAL recovered Y... And these three numbers are the ones finance teams care about: write-offs — cases where the economics said the chase costs more than the money, so the AI stopped; stopping rules triggered; escalations — cases a human needs to touch. The AI knows when to stop and when to hand off."

> **Delivery coaching:** let the feed fill the screen for a few seconds without talking. The modal is your money shot — pause on "Total Recovered" in the big green mono font.

---

## BEAT 5 — Trust + close (Audit Log, 3:15–3:45)

**Action:** Click **Audit Log**. Scroll slowly through the timeline.

**You say:**
> "This is what makes an AI agent legal to run on real money. Every diagnosis, every executed action, every time the system stopped itself — logged with the case ID, the actor, and the outcome. Finance teams don't ask 'does it work', they ask 'what did it do and why'. This is the answer. And with one click you can export the entire trail as CSV — that's the compliance artifact."

**Move to close (3:35–3:45), cursor anywhere calm, look at the judges:**
> "To summarize: rules engines send reminders. Generic AI is unsafe to leave alone with money. MunaafaAI sits in between — an LLM that reasons about why revenue leaked, a deterministic engine that bounds every action, and an audit trail that proves it. Autonomous but accountable. In production, swapping our simulator for live Razorpay execution is a one-function change — the entire recovery operation around it is already real. Thank you."

---

# PART C — DELIVERY COACHING (general)
- **Speed:** slow when reading diagnosis/numbers; normal when narrating. Nerves speed you up — deliberately slow down 20%.
- **Eye contact:** memorize the arc, don't read slides. The screen is your prop.
- **Cursor discipline:** move the mouse slowly and deliberately. Never wiggle.
- **Silence is a tool:** pause 1.5s after the hook and after the sweep modal opens.
- **Numbers:** never read a number you haven't checked. The dashboard is live — quote what YOU see. Pre-rehearse once so you know roughly what to expect (seed is deterministic, outcomes are simulated but stable-ish).
- **Don't apologize** if an outcome misses — narrate it as the feature (backoff + stopping rule).
- **If a screen errors:** do not say "it's broken." Say "let me show you the resilience path" and reload / fall back to Audit Log, which always has content.

# PART D — JUDGE Q&A (memorize these)
**Q: How is this different from existing dunning tools?**
A: Dunning schedules emails on rules. We diagnose root cause per transaction — declined ≠ expired ≠ timeout — and pick one of 8 actions with an economic justification. Rules decide what's allowed; the AI decides what's smart. And we prove both halves in the audit log.

**Q: Why trust an LLM with payments?**
A: We don't. The LLM is in a sandbox — a fixed action set, server-side output sanitization, human-approved execution, and hard attempt ceilings. Wrongness is contained, logged, and stoppable. The engine is deterministic; only the reasoning is AI.

**Q: Outcomes look simulated?**
A: Yes — honestly. No live Razorpay credentials in a buildathon, so we model per-action success probabilities that decay per attempt to keep the numbers credible. The architecture isolates the simulator to one function; plugging in live webhooks is a one-function change.

**Q: Where do you get real data?**
A: Razorpay webhooks give you exactly the fields our model reads — failure code, payment method, timestamps, attempt duration. Our seed data mirrors that shape so the same pipeline works on live payloads unchanged.

**Q: How is this safe/compliant?**
A: Per-type stopping rules (2–5 attempts max, time-bounded), escalation caps, a human-execute step, and an immutable audit log with CSV export. No harassment, no runaway automation, full provability.

# PART E1 — SECTION-BY-SECTION PLAYBOOK (what each page does + exactly what to do/say)

This is the "inside every section" guide. For each screen: WHAT IT DOES (one line for you), WHAT TO DO (exact clicks in order), and WHAT TO SAY (word-for-word lines).

---

## 1. Login screen
**What it does:** Authenticates you; nothing is reachable without a valid session (JWT).
**What to do:** Nothing live — you should already be logged in before judges arrive. If you must log in on camera, type fast and don't comment on it.
**What to say (if forced to log in live):** "Quickly signing into the operator console — every recovery action is tied to an authenticated user, so there's a human accountable for everything the AI does."

## 2. Signup screen
**What it does:** Creates an operator account (name, email, password ≥ 8 chars).
**What to do:** Only during prep. During the demo, never create an account on camera (it burns 30 seconds and adds nothing).
**What to say (if asked why there's auth):** "Because this system executes money actions, we enforce identity from day one — bcrypt-hashed passwords, JWT sessions, rate-limited auth endpoints."

## 3. Dashboard — the "stakes" screen (spend ~1 minute here)
**What it does:** Live position — 4 metric cards, 7-day activity line, cases-by-type bars, failure-class donut, recent activity feed. All numbers are computed from MongoDB, never hardcoded.
**What to do, in order:**
1. Hover the **₹ Total At Risk** card → pause.
2. Glide across **Recovered** and **Recovery Rate**.
3. Point at the **Cases by Failure Class donut** (this is your differentiator).
4. Briefly wave at the **line chart** to show it's live history, not static.
**What to say:**
- "This business has ₹[AT RISK] at risk right now — failed payments, abandoned checkouts, lapsed subscriptions, overdue invoices."
- "We've already pulled back ₹[RECOVERED] at a [RATE]% recovery rate — every case classified by root cause."
- "Rules engines see 'payment failed.' We see WHY: TECHNICAL — the bank or UPI rail blocked it; TIMING — salary day, funds not landed yet; FRICTION — the customer got confused at checkout; INTENT — they've stopped wanting to pay. Different causes need different recovery plays — that's what the AI decides."
**Do NOT:** read every chart. You have 60 seconds here; the donut sentence is the one that matters.

## 4. Transactions — the "pick one and prove it" screen (spend ~45–60s)
**What it does:** Full payment ledger with filters (status/type) + search. Every failed/abandoned/overdue row has a **+ Create Case** button.
**What to do, in order:**
1. Click **Transactions** in the sidebar.
2. Set the **Status filter → Failed** (or Abandoned).
3. Scroll to one row with a meaningful failure code — prefer UPI or card. Check the Amount is mid-size (₹5k–₹50k reads best).
4. Click **+ Create Case** on that row.
5. Wait ~2 seconds in silence while it diagnoses.
6. Click into **Recovery Cases** (or read the card that appears if the page navigates there).
**What to say:**
- Before clicking: "Let's take one real transaction — ₹[AMOUNT], a [UPI/card] payment that [failed/timed out]. One click, and the AI reads this transaction in full context."
- After the diagnosis card appears, READ THE DIAGNOSIS OUT LOUD, then: "TECHNICAL failure — not that the customer doesn't want to pay. Confidence [X]%. And the economics: 'Expected recovery ₹[X] vs intervention cost ₹[Y] — profitable.' It justifies every recommendation against its cost."
- Point at the action badge: "From 8 bounded actions it picked exactly one: [ACTION]. It cannot invent new actions — that's the safety rail."

## 5. Recovery Cases — the "execute and watch money move" screen (spend ~40s)
**What it does:** Every AI-diagnosed case as a card: at-risk amount, failure class, confidence, diagnosis, economic reason, recommended action, attempts n/max, next retry time, and an **▶ Execute Action** button. Escalated cases show red styling + compliance reason.
**What to do, in order:**
1. Find a card with status **Open** (or In Progress) and attempts like **0/3**.
2. Click **▶ Execute Action**.
3. React to the toast + card change (status becomes Recovered OR In Progress with attempt 1/3 and a scheduled retry).
**What to say:**
- Before: "The AI proposes — a human clicks execute. The engine decides what's allowed. This is the bet: AI proposes, deterministic rules dispose."
- If it RECOVERS: "Attempt 1 of 3 — recovered. Case closed, the rupee is back."
- If it MISSES (in_progress): "Attempt 1 of 3 — it scheduled the next touch instead of spamming. Escalation level went up, next retry in [2h/6h/24h]. This case can never be chased more than 3 times. Ever."

## 6. Run Recovery — the "wow / scale" screen (spend ~45s)
**What it does:** One-click full sweep across every recoverable transaction. In DEMO_MODE it auto-executes each case, streams a live diagnosis feed, then shows a summary modal (total recovered, per-failure-class breakdown, write-offs, stopping rules, escalations).
**What to do, in order:**
1. Click **Run Recovery** in the sidebar.
2. Pause. Click the big **▶ Run Full AI Recovery Sweep**.
3. Let ~8–12 rows stream into the Live Feed. Stay silent.
4. When the **summary modal** appears, pause on **Total Recovered** (big green mono number).
5. Point at the write-offs / stopping rules / escalations tiles.
6. Click **Close**.
**What to say:**
- Before clicking: "One transaction is a demo. The real problem is scale — hundreds of failures a day. So: one click, every failed transaction in the business, diagnosed live."
- During the feed (quiet, like a commentator): "Each row is a real transaction being read in real time — failure class, action, economic justification."
- On the modal: "Here's the sweep summary — ₹[RECOVERED] recovered in a single pass at a [RATE]% rate. And the three numbers finance cares about: write-offs — where the economics said the chase costs more than the money, so the AI stopped itself; stopping rules triggered; escalations — cases that need a human. The AI knows when to stop and when to hand off."

## 7. Audit Log — the "trust / compliance" screen (spend ~30s)
**What it does:** Immutable chronological timeline of every event (CASE CREATED → ACTION EXECUTED → STOPPING RULE TRIGGERED) with case ID, actor, outcome. Compliance badge counts stopping-rule events. **Export CSV** downloads the whole trail.
**What to do, in order:**
1. Click **Audit Log** in the sidebar.
2. Scroll slowly through the timeline.
3. (Optional but strong) Click **Export CSV** and let the download appear.
**What to say:**
- "This is what makes an AI agent legal to run on real money. Every diagnosis, every executed action, every time the system stopped itself — logged with case ID, actor, and outcome."
- "Finance teams don't ask 'does it work?' — they ask 'what did it do and why?' This is the answer — and one click exports the whole compliance trail as CSV."

## 8. Sidebar (background element — used on every screen)
**What it does:** Navigation + operator identity (name, "System live" indicator) + Sign out.
**What to do:** Only use it to move between sections; don't narrate it.
**What to say (if someone notices the green 'live' dot):** "Every screen is reading live from the recovery engine — there are no mock numbers anywhere."

---

## Section one-liners (for your own memory card)
| Section | One line | Key click | Key line to say |
|---|---|---|---|
| Dashboard | The stakes | none | "₹[X] at risk — and here's WHY it failed" |
| Transactions | Proof it reasons | + Create Case | "Read the diagnosis aloud" |
| Recovery Cases | Money moves | Execute Action | "AI proposes, engine disposes" |
| Run Recovery | Scale + wow | Run Full Sweep | "One click, every failure, live" |
| Audit Log | Trust + compliance | Export CSV | "What did it do and why — here's the answer" |

---

# PART E — SHORTLIST CHECKLIST (before you submit/speak)
- [ ] Backend running in Terminal 1 showing `(DEMO_MODE)`
- [ ] Frontend open at localhost:3000, logged in
- [ ] Seed + one sweep + 4 executions done → dashboard shows ₹ recovered, recovery rate, chart data
- [ ] 1–2 cases left `open` for the live Execute demo
- [ ] Practice the sweep once so you know the ~timing and modal
- [ ] Know your live numbers (At Risk, Recovered, Recovery Rate) from YOUR screen
- [ ] Memorize: 8 actions · 4 failure classes · "AI proposes, engine disposes" · "autonomous but accountable"
- [ ] Rehearse reading one diagnosis out loud — the single highest-impact 15 seconds of the demo
