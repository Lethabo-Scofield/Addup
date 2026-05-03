# Addup — AI-Powered Financial Reconciliation

Addup is a browser-based SaaS tool that reconciles bank statements against general ledger exports using a probabilistic matching engine and Grok AI explanations.

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Getting started](#getting-started)
5. [Environment variables](#environment-variables)
6. [Deployment](#deployment)
7. [Documentation index](#documentation-index)

---

## What it does

1. The user uploads a bank statement (CSV / XLSX) and a ledger export (CSV / XLSX).
2. The engine parses, normalises, and scores every possible (bank, ledger) pair across three dimensions: amount, date, and description similarity.
3. Each pair is classified as **Matched**, **Possible Match**, **Manual Review**, or **Unmatched**.
4. Reviewers work through flagged items in the review queue and can approve, reject, or escalate each one.
5. When a match is unclear, users can ask Grok AI to explain the discrepancy in plain language via a streaming chat panel.
6. Completed jobs can be exported as structured JSON or a formatted PDF report.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, shadcn/ui |
| Routing | Wouter |
| Animation | Framer Motion |
| PDF export | jsPDF |
| XLSX parsing | SheetJS (xlsx) |
| Backend API | Express 5, Node.js |
| Database | PostgreSQL via Drizzle ORM |
| AI | OpenRouter (x-ai/grok-3-mini) |
| Monorepo | pnpm workspaces |
| Deployment | Vercel (frontend + serverless) |

---

## Project structure

```
/
├── artifacts/
│   ├── addup/                  # React + Vite frontend
│   │   └── src/
│   │       ├── engine/         # Reconciliation engine (pure TypeScript, no UI)
│   │       │   ├── index.ts        public re-exports
│   │       │   ├── types.ts        all domain interfaces
│   │       │   ├── normalizer.ts   synonym map + normalizeDesc
│   │       │   ├── similarity.ts   jaroWinkler, tokenSim, computeDescScore
│   │       │   ├── parser.ts       CSV/XLSX parsing, csvToTx
│   │       │   ├── matcher.ts      scorePair — scores a single pair
│   │       │   ├── reconciliation.ts runReconciliation — full job
│   │       │   └── utils.ts        fmt, fmtDate, STATUS_CFG, ACTION_LABELS
│   │       └── pages/
│   │           └── engine.tsx  UI shell — imports from ../engine
│   └── api-server/             # Express 5 API
│       └── src/
│           ├── app.ts          Express app, route mounting
│           └── routes/
│               ├── explain.ts  SSE streaming AI explanation endpoint
│               └── waitlist.ts waitlist CRUD
├── api/                        # Vercel serverless functions
│   ├── explain.ts              Edge Runtime SSE (no timeout)
│   └── [...path].ts            Node.js Express catch-all
├── lib/
│   ├── db/                     Drizzle schema + client
│   └── integrations-openrouter-ai/  OpenRouter helper
├── vercel.json                 Vercel deployment config
├── .env.example                required environment variables
└── docs/
    ├── ARCHITECTURE.md         component and data-flow diagrams
    ├── ENGINE.md               matching algorithm reference
    └── KNOWN_ISSUES.md         open engineering problems
```

---

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Install

```bash
pnpm install
```

### Configure

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

### Run in development

```bash
# Frontend (Vite dev server on $PORT)
pnpm --filter @workspace/addup run dev

# API server (Express on $PORT)
pnpm --filter @workspace/api-server run dev
```

On Replit both workflows start automatically.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | Yes | OpenRouter API key for Grok AI |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | Yes | `https://openrouter.ai/api/v1` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |

See `.env.example` for full documentation.

---

## Deployment

Addup is configured for zero-config deployment on Vercel:

1. Connect the repo to a new Vercel project.
2. Set the three environment variables above in Vercel project settings.
3. Deploy — Vercel reads `vercel.json` and handles routing automatically.

The `/api/explain` route runs as an **Edge Function** (unlimited SSE duration). All other `/api/*` routes run as **Node.js serverless functions** wrapping the Express app.

See `docs/ARCHITECTURE.md` for more deployment detail.

---

## Documentation index

| Document | Contents |
|---|---|
| `docs/ARCHITECTURE.md` | Full component map, data flow, API contract |
| `docs/ENGINE.md` | Scoring matrix, classification thresholds, algorithm walkthrough |
| `docs/KNOWN_ISSUES.md` | Open engineering problems, root causes, recommended fixes |
