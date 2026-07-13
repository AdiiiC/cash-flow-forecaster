# Cash-Flow Forecaster

A full-stack, production-grade cash-flow forecasting platform. Projects weekly cash inflows, outflows, and runway with **honest, backtested** probabilistic intervals — not a black box. Every number is grounded: mandatory naive baselines, walk-forward (no-leakage) evaluation, MASE / pinball / coverage metrics, split-conformal prediction intervals, and a grounded LLM CFO briefing.

## What it does

### Core forecasting engine
- **Three VaR methods** — Monte Carlo (Gaussian), Historical Simulation, Student-t fat-tail. P10/P50/P90 weekly inflow, outflow, net cash flow, MRR, and projected balance.
- **Split-conformal intervals** — finite-sample calibrated; 85% nominal coverage band; empirical coverage shown in a badge (~84–87%).
- **Walk-forward validation** — no leakage; MASE / pinball / coverage per series; model selection leaderboard.
- **Kupiec + Christoffersen backtesting** — POF test + independence test + Basel traffic-light across 90%/95%/99%.
- **Scenario engine** — revenue growth %, cost multiplier, one-off events; up to 5 parallel stress-test scenarios with probability-weighted blended outcome.
- **Options Greeks** — Delta, Gamma, Theta, Vega, Rho; dividend-adjusted BSM; IV smile; Greeks ladder across expiries.

### B2B business intelligence

| Module | What it covers |
|---|---|
| **Working Capital** | DSO · DPO · Cash Conversion Cycle · AR Aging (4 buckets) · AP schedule |
| **Burn Rate & Headcount** | Gross/net burn · burn multiple · burn by category · employee roster · hiring plan |
| **Financial Health** | Liquidity score 0–100 · 7 ratio cards (current/quick, gross margin, Rule of 40, LTV/CAC, payback) · break-even |
| **ARR Waterfall** | MRR movement (new/expansion/contraction/churn) · revenue recognition · deferred revenue |
| **Board Report** | One-screen CFO pack: KPIs · risks · CapEx + FCF · tax schedule · HHI concentration · financing pipeline |
| **Customer MRR** | Per-customer ARR · churn risk · contract expiry alerts |
| **Budget vs Forecast** | Annual budget by category · CSV import · variance vs forecast + actuals |
| **Actuals Reconciliation** | Bank statement CSV upload · weekly variance · auto reforecast prompt at >15% drift |

### Platform features
- **Multi-tenancy** — organisations, member roles (admin/member/viewer), email invitations
- **MFA / 2FA** — TOTP (Google Authenticator / Authy) + email OTP + 8 backup codes
- **Cross-border invoices (ExIm)** — GARCH FX forecast at payment due date; P10/P50/P90 base-currency amounts
- **Recurring items** — payroll, rent, subscriptions folded into forecast on real due dates
- **AR/AP invoices** — overdue flags; counterparty names encrypted at rest
- **Financing timeline** — planned raises with probability; base/expected/best-case runway
- **CapEx + Free Cash Flow** — depreciation schedule; FCF chart
- **Quarterly tax estimates** — safe-harbor calc; payment schedule
- **Scheduled forecasts** — weekly/monthly auto-run configs
- **Outbound webhooks** — HMAC-SHA256 signed; 3× retry; delivery log; 8 event types
- **Slack alerts** — critical/warning; de-duplicated
- **Email digest** — weekly/monthly via Resend
- **Notification preferences** — per-user email/Slack/webhook toggles
- **Audit log** — every auth event, data change; transparent to the user

## Tech stack

| Layer | Stack |
|---|---|
| **Backend** | FastAPI 0.128 · Python 3.13 · uvicorn 0.39 |
| **Data** | pandas 2.3 · NumPy 2.0 · scikit-learn 1.6 |
| **Database** | SQLAlchemy 2.0 · Postgres (Supabase/Neon) · SQLite (local) · psycopg3 |
| **Auth** | JWT HS256 (PyJWT 2.13) · bcrypt 5 · TOTP (pyotp) |
| **Crypto** | cryptography 49 · Fernet field encryption |
| **LLM** | google-genai 1.47 (Gemini 2.5 Flash) · openai 2.45 (GPT-4o) · anthropic 0.116 (Claude) |
| **HTTP client** | httpx 0.28 — all outbound calls |
| **Notifications** | Resend · Slack Incoming Webhooks · outbound webhooks |
| **QR codes** | segno 1.6 |
| **Frontend** | Next.js 16 · React 19 · TypeScript 5.5 |
| **Charts** | Recharts 3.9 |
| **CI/CD** | GitHub Actions keepalive · Render (backend) · Vercel (frontend) |

## Project structure

```
Cash-Flow-Forecaster/
├── backend/
│   ├── app/
│   │   ├── forecasting/      walk-forward pipeline, baselines, metrics
│   │   ├── analytics/        category decomposition, drivers
│   │   ├── data/             CSV ingest, aggregation, synthetic data
│   │   ├── llm/              multi-provider LLM + grounding
│   │   ├── notifications/    email (Resend), Slack, outbound webhooks
│   │   ├── routers/          30+ API route modules
│   │   ├── security/         Fernet field encryption
│   │   ├── actuals/          deterministic projection (customers/suppliers/GST/ExIm)
│   │   ├── main.py           FastAPI app + lifespan + rate limiter
│   │   ├── store.py          SQLAlchemy Core; 20+ tables
│   │   └── service.py        orchestration, caching, parallel forecasts
│   ├── tests/                68 pytest tests
│   ├── requirements.txt
│   ├── pyproject.toml        ruff + mypy + pytest config
│   └── .python-version       3.13.4
└── frontend/
    ├── app/
    │   ├── page.tsx           Landing (/)
    │   ├── dashboard/         Executive view + 4 B2B sub-pages
    │   ├── forecast/          Technical forecaster (dev-key gated)
    │   ├── actuals/           Reconciliation + ExIm/config
    │   ├── customers/         Customer MRR
    │   ├── budget/            Budget vs forecast
    │   ├── settings/          Team + security/notifications
    │   └── dev/               Debug panel (dev-key gated)
    ├── components/            50+ components; BizNav sidebar
    ├── proxy.ts               Next.js 16 proxy (dev-key gate)
    ├── .nvmrc                 Node 26
    └── tsconfig.json          strict + noUncheckedIndexedAccess
```

## Local development

### Prerequisites
- Python 3.13 (`pyenv install 3.13.4`)
- Node 26 (`nvm use` — reads `.nvmrc`)

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in JWT_SECRET; LLM keys optional

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

```bash
python3 -m pytest -q   # 68 tests, ~30s
```

### 2. Frontend

```bash
cd frontend
npm install
# .env.local:
#   NEXT_PUBLIC_API_BASE=http://localhost:8000
#   DEV_ACCESS_KEY=dev_access_key_060203

npm run dev
```

UI at `http://localhost:3000`.

### Unlock dev access

```
http://localhost:3000/unlock?key=<DEV_ACCESS_KEY>
```

Lands on `/dev` (debug panel). Also unlocks `/forecast`, `/actuals/config`, `/docs`.  
Keyboard shortcut: `Ctrl+Alt+D` → type key when prompted. See `DEV_ACCESS.local.md`.

## Configuration

### Backend `.env`

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | **Required in prod.** Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `JWT_EXPIRE_MINUTES` | Token lifetime in minutes (default `10080` = 7 days) |
| `LLM_PROVIDER` | `auto` / `gemini` / `openai` / `anthropic` / `none` |
| `GEMINI_API_KEY` | google-genai key (Gemini 2.5 Flash, 2.0 Flash) |
| `OPENAI_API_KEY` | OpenAI key (GPT-4o, GPT-4.1) |
| `ANTHROPIC_API_KEY` | Anthropic key (Claude Opus, Sonnet) |
| `DATABASE_URL` | Postgres URL; empty = SQLite (`runs.db`) |
| `DATA_ENCRYPTION_KEY` | Fernet key for field encryption. Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |
| `RESEND_API_KEY` | Resend API key for email (OTP codes, invites, digest) |
| `EMAIL_FROM` | Sender address matching verified Resend domain |
| `TOTP_ISSUER` | Name shown in authenticator apps (e.g. `ClearCash`) |
| `FRONTEND_ORIGIN` | CORS allowed origin(s), comma-separated |
| `FRONTEND_ORIGIN_REGEX` | CORS regex for Vercel preview URLs |

### Frontend `.env.local`

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Backend URL (e.g. `http://localhost:8000`) |
| `DEV_ACCESS_KEY` | Unlocks `/forecast`, `/dev`, `/docs`, `/actuals/config` |

## Routes

### Public
`/` · `/dashboard` · `/privacy`

### Authenticated
`/actuals` · `/customers` · `/budget` · `/settings/team` · `/settings/notifications`  
`/dashboard/working-capital` · `/dashboard/burn-rate` · `/dashboard/financial-health` · `/dashboard/board-report`

### Dev-key gated
`/forecast` · `/actuals/config` · `/dev` · `/docs`

## Deployment

### Backend — Render

```yaml
buildCommand: pip install uv && uv pip install --system -r requirements.txt
startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
PYTHON_VERSION: 3.13.4
```

Required env vars: `JWT_SECRET` · `DATABASE_URL` · `DATA_ENCRYPTION_KEY` · `FRONTEND_ORIGIN_REGEX`  
Optional: `GEMINI_API_KEY` · `SLACK_WEBHOOK_URL` · `RESEND_API_KEY` · `TOTP_ISSUER`

### Frontend — Vercel
Root dir: `frontend`. Required: `NEXT_PUBLIC_API_BASE`.

### Database
Supabase or Neon Postgres via the session pooler URL. All 20+ tables are created automatically on startup — no migration step needed.

### Keepalive (free tier)
`.github/workflows/keepalive.yml` pings `/api/health` every 10 minutes to prevent Render free-tier spin-down. Set the `BACKEND_URL` repository variable if the URL changes.

## License

MIT
