# Workspace

## Overview

pnpm workspace monorepo using TypeScript. **Addup** — a financial reconciliation landing page with waitlist signup. Built with Vite + React frontend and Express backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite, Tailwind v4, Radix UI, shadcn/ui, framer-motion, wouter (routing), TanStack Query
- **API framework**: Express 5 with pino logging
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (for api-server)
- **Email**: Resend (optional — skipped gracefully if `RESEND_API_KEY` not set)

## Artifacts

- **artifacts/addup** — React + Vite landing page (preview path: `/`)
- **artifacts/api-server** — Express API server (preview path: `/api`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/addup run dev` — run frontend locally

## Workspace Packages

- `artifacts/addup` — landing page frontend (`@workspace/addup`)
- `artifacts/api-server` — Express API server (`@workspace/api-server`)
- `lib/api-spec` — OpenAPI spec (`lib/api-spec/openapi.yaml`)
- `lib/api-zod` — Zod validators generated from OpenAPI spec (`@workspace/api-zod`)
- `lib/api-client-react` — TanStack Query hooks generated from OpenAPI spec (`@workspace/api-client-react`)
- `lib/db` — Drizzle ORM schema + client (`@workspace/db`)

## Database Schema

- `waitlist` table — stores waitlist signups (id, email, company, role, created_at)

## API Endpoints

- `GET /api/healthz` — health check
- `POST /api/waitlist` — join waitlist (email required, company/role optional)
- `GET /api/waitlist/stats` — public waitlist count

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (provisioned automatically)
- `RESEND_API_KEY` — optional; enables waitlist confirmation emails
- `RESEND_FROM_EMAIL` — optional; sender address (defaults to `Addup <onboarding@resend.dev>`)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
