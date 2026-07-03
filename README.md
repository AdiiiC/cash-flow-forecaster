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
- **Alerts** — runway / min-balance / min-runway threshold alerts.
- **Runway & KPIs** — with optional display-only FX conversion (USD / INR).
- **Run history** — SQLite-persisted runs with CSV export.
- **Live progress** — Server-Sent Events stream forecast progress per series.
- **Grounded LLM briefing** — Gemini / OpenAI / Anthropic, or deterministic template with no key.

## Tech stack

| Layer     | Stack                                             |
|-----------|---------------------------------------------------|
| Backend   | FastAPI, Python 3.9+, NumPy/pandas, sqlite3 (stdlib) |
| Frontend  | Next.js (App Router), TypeScript, Recharts        |
| ML        | Custom forecasting pipeline + split-conformal intervals |

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
| `FRONTEND_ORIGIN`     | backend `.env`   | CORS origin for the frontend                         |
| `NEXT_PUBLIC_API_BASE`| frontend `.env.local` | Base URL of the FastAPI backend                |

> Secrets live only in `.env` / `.env.local`, which are gitignored. Only the
> `*.example` templates are committed.

## Deployment

See the **Hosting** notes below (frontend on Vercel, backend on Render/Railway/Fly).

## License

MIT (or your choice).
