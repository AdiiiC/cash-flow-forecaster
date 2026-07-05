# Cash-Flow Forecaster

A full-stack, **anti-slop** cash-flow forecasting app. It projects weekly cash
inflows, outflows and runway with **honest, backtested** probabilistic intervals —
not a black box. Every number is grounded: mandatory naive baselines, walk-forward
(no-leakage) evaluation, MASE / pinball / coverage metrics, split-conformal
prediction intervals, and an LLM CFO briefing that is strictly grounded in the
computed numbers (falls back to a deterministic template with no API key).

## Features

- **Probabilistic forecasts** — P10/P50/P90 weekly inflow, outflow, net and balance.
- **Split-conformal intervals** — finite-sample calibrated; empirical coverage shown in a badge.
- **Backtested & honest** — naive baselines, walk-forward validation, MASE / pinball loss, model leaderboard.
- **Driver decomposition** — per-category contribution bars and a cash-bridge waterfall.
- **Scenario engine** — deterministic overlay (growth %, cost multiplier, one-off event) shown as an overlay, clearly *not* re-backtested.
- **Saved scenarios** — name and store what-if presets per user, then reload or delete them.
- **Alerts** — runway / min-balance / min-runway threshold alerts.
- **Slack notifications** — critical / warning alerts posted to a Slack channel (opt-in, de-duplicated).
- **Accounts & auth** — self-hosted JWT + bcrypt sign-in; run history and saved scenarios are private per user.
- **Runway & KPIs** — with optional display-only FX conversion (USD / INR).
- **Run history** — persisted runs (Postgres or SQLite) with CSV export, scoped to the signed-in user.
- **Live progress** — Server-Sent Events stream forecast progress per series.
- **Grounded LLM briefing** — Gemini / OpenAI / Anthropic, or deterministic template with no key.

## Tech stack

| Layer     | Stack                                             |
|-----------|---------------------------------------------------|
| Backend   | FastAPI, Python 3.9+, NumPy/pandas, SQLAlchemy    |
| Auth      | JWT (PyJWT, HS256) + bcrypt password hashing      |
| Database  | Postgres (Supabase/Neon) in prod, SQLite for local/dev |
| Frontend  | Next.js (App Router), TypeScript, Recharts        |
| ML        | Custom forecasting pipeline + split-conformal intervals |
| Notify    | Slack Incoming Webhooks                            |

## Project structure

```
Cash-Flow-Forecaster/
├── backend/          FastAPI service (app/, tests/)
│   ├── app/          routers, forecasting pipeline, analytics, store, service
│   └── tests/        pytest suite
└── frontend/         Next.js + TypeScript UI
```

## Local development

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# configure (optional LLM key; without one it uses the deterministic template)
cp .env.example .env

uvicorn app.main:app --host 127.0.0.1 --port 8000
```

API runs at `http://localhost:8000` (routes under `/api`).

Run the tests:

```bash
cd backend && source .venv/bin/activate && python3 -m pytest -q
```

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev
```

UI runs at `http://localhost:3000`.

## Configuration

| Variable              | Where            | Purpose                                             |
|-----------------------|------------------|-----------------------------------------------------|
| `LLM_PROVIDER`        | backend `.env`   | `auto` / `gemini` / `openai` / `anthropic` / `none` |
| `GEMINI_API_KEY` etc. | backend `.env`   | LLM key(s); omit to use the deterministic template  |
| `DATABASE_URL`        | backend `.env`   | Postgres URL for persistent history; empty = local SQLite |
| `JWT_SECRET`          | backend `.env`   | Signing secret for auth tokens (**set a strong value in prod**) |
| `JWT_EXPIRE_MINUTES`  | backend `.env`   | Access-token lifetime (default 7 days)              |
| `SLACK_WEBHOOK_URL`   | backend `.env`   | Slack Incoming Webhook for alerts; empty = disabled |
| `FRONTEND_ORIGIN`     | backend `.env`   | CORS origin(s) for the frontend (comma-separated)   |
| `FRONTEND_ORIGIN_REGEX`| backend `.env`  | CORS regex for preview/deploy origins (e.g. Vercel) |
| `NEXT_PUBLIC_API_BASE`| frontend `.env.local` | Base URL of the FastAPI backend                |

> Secrets live only in `.env` / `.env.local`, which are gitignored. Only the
> `*.example` templates are committed.

## Deployment

- **Frontend** — Vercel (root directory `frontend`, `NEXT_PUBLIC_API_BASE` pointing at the backend).
- **Backend** — Render (or Railway/Fly). Set `GEMINI_API_KEY`, `DATABASE_URL`, `JWT_SECRET`,
  `SLACK_WEBHOOK_URL`, and `FRONTEND_ORIGIN_REGEX` in the service environment.
- **Database** — Supabase/Neon Postgres via the session pooler URL; tables are created
  automatically on startup.

## Roadmap

Planned next additions (all free-tier):

- **Error tracking (Sentry)** — capture backend + frontend exceptions in production.
- **Password-reset email (Resend)** — self-service account recovery for the auth flow.
- **Email cash alerts (Resend)** — deliver threshold alerts by email alongside Slack.
- **Distributed cache / rate-limit (Upstash Redis)** — replace the in-process limiter when scaling out.
- **Alternate Postgres (Neon)** — evaluated as a drop-in `DATABASE_URL` alternative to Supabase.

## License

MIT (or your choice).
