# PureCycle — Equipment Cleaning Log

A small full-stack slice of a pharmaceutical manufacturing system: equipment is cleaned
between production runs, every cleaning is logged, and **every change to a cleaning
record is captured in a field-level audit trail** (who, when, and each field's old → new
value) so the log is defensible in a regulatory audit.

| Layer     | Stack                                                          |
| --------- | -------------------------------------------------------------- |
| Database  | PostgreSQL 16, Prisma migrations + seed                          |
| API       | Node.js, TypeScript, Express 4, Zod validation, JWT auth        |
| Front-end | React 18, TypeScript, Vite, TanStack Query                      |
| Tests     | Vitest + Supertest (69 tests: unit + integration against Postgres) |

---

## Quick start — Docker (one command)

Requires Docker with Compose v2.

```bash
git clone https://github.com/Pulkit8121/leucine-home-assessment.git
cd leucine-home-assessment
docker compose up --build
```

This starts Postgres, runs the migrations, seeds the database, and serves the UI.

- Front-end: <http://localhost:5173>
- API: <http://localhost:4000> (health check at `/health`)
- Postgres: `localhost:5433` (published on 5433 so it cannot collide with a Postgres
  you already run on 5432)

Sign in with either seeded account:

| Email                     | Password      |
| ------------------------- | ------------- |
| `operator@cleen.test`     | `password123` |
| `supervisor@cleen.test`   | `password123` |

Stop with `docker compose down`, or `docker compose down -v` to also drop the data.

---

## Local development (without Docker for the app)

### 1. Start the database

The compose file's `db` service is the least-effort option and also creates the separate
`cleen_test` database used by the test suite:

```bash
docker compose up -d db
```

If you prefer your own Postgres instance, create two databases and point
`DATABASE_URL` at them:

```sql
CREATE DATABASE cleen;
CREATE DATABASE cleen_test;
```

### 2. API

```bash
cd api
cp .env.example .env            # adjust DATABASE_URL if you are not using compose
cp .env.test.example .env.test  # used by the test suite
npm install
npm run prisma:generate
npm run migrate:dev             # creates the schema
npm run seed                    # 4 machines, 29 cleaning records, full audit history
npm run dev                     # http://localhost:4000
```

### 3. Front-end

In a second terminal:

```bash
cd web
cp .env.example .env            # VITE_API_URL, defaults to http://localhost:4000
npm install
npm run dev                     # http://localhost:5173
```

### 4. Tests

```bash
cd api
npm test
```

The suite applies the migrations to the `cleen_test` database, then runs unit tests for
the audit-diff and cursor logic plus integration tests that exercise the real HTTP layer
and a real Postgres. It truncates its tables between tests, so it never touches your
development data.

Other useful scripts:

```bash
npm run typecheck      # api
npm run build          # api: compile to dist/
npm run test:watch     # api
npm run build          # web: typecheck + production bundle
```

---

## API reference

All responses are JSON. Collections that are paginated return
`{ data, pageInfo, total }`; everything else returns `{ data }`. Errors return
`{ error: { code, message, details? } }`.

Mutating endpoints require `Authorization: Bearer <token>`; reads are open.

### Auth

| Method | Path              | Notes                                        |
| ------ | ----------------- | -------------------------------------------- |
| POST   | `/api/auth/login` | `{ email, password }` → `{ token, user }`    |
| GET    | `/api/auth/me`    | Current user for the supplied token           |

### Equipment

| Method | Path                   | Notes                                          |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/api/equipment`       | Query: `status=ACTIVE\|RETIRED`, `search=<text>` |
| GET    | `/api/equipment/:id`   |                                                |
| POST   | `/api/equipment`       | `{ name, code, status? }` — auth required       |
| PATCH  | `/api/equipment/:id`   | Partial update — auth required                  |
| DELETE | `/api/equipment/:id`   | Cascades to its records — auth required         |

### Cleaning records

| Method | Path                                            | Notes                                          |
| ------ | ----------------------------------------------- | ---------------------------------------------- |
| GET    | `/api/equipment/:equipmentId/cleaning-records`   | Paginated + filterable (see below)              |
| POST   | `/api/equipment/:equipmentId/cleaning-records`   | Creates the record **and** its CREATE audit entry |
| GET    | `/api/cleaning-records/:recordId`                |                                                 |
| PATCH  | `/api/cleaning-records/:recordId`                | Creates an UPDATE audit entry for changed fields |
| GET    | `/api/cleaning-records/:recordId/audit`          | Field-level history, newest first, paginated     |

**Listing cleaning records**

```
GET /api/equipment/:equipmentId/cleaning-records?limit=10&status=PENDING&cursor=<opaque>
```

```jsonc
{
  "data": [ /* CleaningRecord[] */ ],
  "pageInfo": { "nextCursor": "eyJzb3J0...", "hasNextPage": true, "limit": 10 },
  "total": 26          // count for the current filter, ignoring the cursor
}
```

Pagination is **keyset (cursor) based**, ordered by `cleanedAt DESC, id DESC`. Pass the
`nextCursor` from one response as `cursor` on the next request. The cursor is opaque
(base64url) — do not parse it. `hasNextPage` is `false` on the last page.

**Audit history**

```jsonc
{
  "data": [
    {
      "id": "…",
      "action": "UPDATE",
      "actor": { "id": "…", "name": "Marcus Vogel", "email": "supervisor@cleen.test" },
      "createdAt": "2026-02-01T11:04:22.310Z",
      "changes": [
        { "field": "notes",  "oldValue": "Batch changeover #1000", "newValue": "Verified against SOP-CLN-014" },
        { "field": "status", "oldValue": "PENDING",                "newValue": "VERIFIED" }
      ]
    }
  ],
  "pageInfo": { "nextCursor": null, "hasNextPage": false, "limit": 10 }
}
```

### Errors

| Status | Code               | When                                              |
| ------ | ------------------ | ------------------------------------------------- |
| 400    | `BAD_REQUEST`      | Malformed cursor, invalid JSON body                |
| 401    | `UNAUTHORIZED`     | Missing, malformed or expired token                |
| 404    | `NOT_FOUND`        | Unknown equipment or record                        |
| 409    | `CONFLICT`         | Duplicate equipment code                           |
| 422    | `VALIDATION_ERROR` | Failed validation; `details` lists field + message |

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "cleanedAt", "message": "cleanedAt cannot be in the future" }]
  }
}
```

---

## Data model

```
User ──────────────┐
  id, email, name  │ (cleanedById, actorId — nullable snapshots)
                   │
Equipment          │        CleaningRecord                   AuditEntry              AuditChange
  id               │          id                               id                      id
  name             └────────► equipmentId ────────────────────► cleaningRecordId ─────► auditEntryId
  code (unique)               cleanedBy   (text snapshot)       action (CREATE|UPDATE)  field
  status (ACTIVE|RETIRED)     cleanedById (nullable FK)         actorName/actorEmail    oldValue
                              cleanedAt                         actorId (nullable FK)   newValue
                              method                            createdAt
                              notes (nullable)
                              status (PENDING|VERIFIED)
```

The schema lives in [`api/prisma/schema.prisma`](api/prisma/schema.prisma) with the
generated SQL under `api/prisma/migrations/`.

---

## Project layout

```
api/
  prisma/schema.prisma          data model + migrations
  prisma/seed.ts                idempotent seed with audit history
  src/lib/audit-diff.ts         pure field-level diffing  ← the core of the audit trail
  src/lib/pagination.ts         cursor encode/decode + page building
  src/modules/<domain>/         routes / service / Zod schemas per domain
  tests/unit/                   audit-diff + pagination (pure logic)
  tests/integration/            HTTP + Postgres via supertest
web/
  src/api/                      typed fetch client and endpoint wrappers
  src/components/               equipment list, records table, form, audit trail
  src/hooks/useKeysetPagination.ts   forward/back navigation over opaque cursors
```

See [NOTES.md](NOTES.md) for the design decisions, trade-offs, and what was deliberately
left out.
