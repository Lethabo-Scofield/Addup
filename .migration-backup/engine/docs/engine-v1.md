# Addup Engine v1

Purpose

Addup Engine v1 is a backend reconciliation engine that accepts two uploaded documents (bank and ledger), parses them (CSV support), normalizes transactions, validates data, saves job state, and returns a structured JSON payload for downstream steps.

Current scope

- Accept two uploaded CSV files: `bankFile` and `ledgerFile`.
- Parse CSV into raw rows.
- Normalize rows into a consistent `Transaction` shape.
- Validate transactions and surface issues.
- Generate deterministic `row_hash` for each row and file checksums.
- Create an in-memory reconciliation job state.

Upload pipeline

1. Receive uploaded files via `POST /api/reconciliation/upload`.
2. Detect file type (only CSV supported in v1).
3. Parse CSV rows.
4. Normalize rows into `Transaction` objects.
5. Validate transactions (date and amount required).
6. Generate `row_hash` and file checksums (sha256).
7. Create job state and return parsed response.

State model

- `uploaded` — files received (not yet parsed).
- `parsed` — CSV parsed into rows and checksums generated.
- `normalized` — rows normalized into `Transaction` objects.
- `validated` — validation issues produced.
- `matched_suggestions` — planned for future (not implemented).
- `user_reviewed` — planned for future.
- `final_report` — planned for future.

Transaction schema

Fields in `Transaction`:

- `id`: string
- `source`: "bank" | "ledger"
- `date`: YYYY-MM-DD
- `description`: string
- `amount`: number
- `debit?`: number
- `credit?`: number
- `reference?`: string
- `raw_row`: original parsed CSV row (preserved)
- `row_hash`: deterministic sha256 over canonicalized row data

Not included yet

- PDF parsing
- Excel parsing
- Automatic matching or reconciliation logic
- Frontend or user review UI

Next version plan (v2)

- Add Excel and PDF parsers.
- Implement matching suggestions engine.
- Add persistent job store and audit logs.
- Add user-review endpoints and final report generation.
