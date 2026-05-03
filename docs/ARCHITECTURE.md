# Architecture

## Overview

Addup is a single-page React application backed by an Express API. All matching logic runs in the browser (no server round-trip during reconciliation). The server is used only for AI explanations and the waitlist database.

---

## Component map

```
Browser
  └── Engine page (engine.tsx)
        ├── UploadsView        -- file drag-drop, parse trigger
        ├── DashboardView      -- job summary stats
        ├── ReviewQueueView    -- item-by-item reconciliation review
        │     └── ReviewPanel  -- expanded row with AI explain panel
        ├── JobsView           -- job history (in-memory, not persisted)
        ├── AuditLogView       -- timestamped action log
        └── SettingsView       -- company name, column overrides

Engine module (src/engine/)
  ├── parser.ts      -- file I/O: CSV/XLSX -> raw rows -> Tx[]
  ├── normalizer.ts  -- text cleaning: raw desc -> canonical form
  ├── similarity.ts  -- Jaro-Winkler + token overlap -> [0,1]
  ├── matcher.ts     -- scorePair: (bank Tx, ledger Tx) -> scored candidate
  ├── reconciliation.ts -- runReconciliation: full greedy assignment
  └── utils.ts       -- formatters, STATUS_CFG, ACTION_LABELS

API server (artifacts/api-server/)
  ├── POST /api/explain    -- Grok AI SSE stream
  └── GET  /api/waitlist   -- waitlist read/write
```

---

## Data flow

```
User uploads two files
        |
        v
parseAnyFile() -- detect CSV vs XLSX, parse to raw rows
        |
        v
csvToTx()      -- validate + quality-check each row -> Tx[]
        |
        v
runReconciliation(bank[], ledger[])
  |
  |-- scorePair() for every (bank, ledger) combination  O(B x L)
  |      amount_score  (weight 0.45)
  |      date_score    (weight 0.25)
  |      description_score (weight 0.30)
  |        via normalizeDesc() -> computeDescScore()
  |
  |-- greedy assignment (sort by best final_score, pick available)
  |
  |-- classify each assignment: matched / possible / manual / unmatched
  |
  v
ReconRow[]     -- rendered in ReviewQueueView

User clicks "AI Explain"
        |
        v
POST /api/explain  (SSE stream)
        |
        v
OpenRouter (x-ai/grok-3-mini) -- streaming token response
        |
        v
ReviewPanel renders tokens as they arrive
```

---

## API contract

### `POST /api/explain`

**Request body**
```json
{
  "question": "Why is this a possible match and not confirmed?",
  "context":  "Bank: R 5,000 on 2026-04-01 | Ledger: R 5,000 on 2026-04-03 | Score: 82"
}
```

**Response**

`text/event-stream` — each event is a plain-text token chunk:

```
data: The two-day

data:  gap between

data:  dates is within...

data: [DONE]
```

---

## Vercel routing

```
vercel.json
  build: pnpm --filter @workspace/addup run build
  outputDirectory: artifacts/addup/dist/public

  /api/explain     -> api/explain.ts     (Edge Runtime, no timeout)
  /api/**          -> api/[...path].ts   (Node.js 20, 30s max)
  /**              -> dist/public/       (static SPA)
```

---

## Database schema

Defined in `lib/db/src/schema.ts`.

```
waitlist
  id          serial primary key
  email       text not null unique
  company     text
  created_at  timestamp default now()
```

Reconciliation results are **not** persisted to the database. They live only in React state for the current session. Persistence / multi-user job storage is a planned feature (see KNOWN_ISSUES.md).
