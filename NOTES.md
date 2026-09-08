# Notes — decisions, trade-offs, and what I left out

## The audit trail

**Diffing is a pure function, deliberately.** `api/src/lib/audit-diff.ts` knows nothing
about Prisma, Express or HTTP: it takes a *before* and an *after* snapshot and returns
the fields that changed. That is what makes the regulatory behaviour cheap to test
exhaustively (14 unit tests) without a database, and it means the same logic is reused by
the seed script.

Three rules it encodes, each of which is a real bug if you get it wrong:

1. **Values are normalised to text before comparison.** A `Date` from Postgres and a
   `Date` parsed from JSON are different objects for the same instant; comparing them
   with `!==` produces a phantom "changed" entry on every save. Normalising to ISO-8601
   also makes the stored trail readable and stable if a column type changes later.
2. **Only keys present in the patch are considered.** `PATCH { status }` means "leave
   `notes` alone", not "set `notes` to undefined". Diffing `Object.keys(after)` rather
   than the full row is what makes that true.
3. **`undefined` and `null` both normalise to `null`.** So *clearing* `notes` is a real
   change (`"text" → null`) while *omitting* it is not a change at all.

**An audit entry is written in the same transaction as the change it describes.**
`recordAudit` takes the transaction client as a parameter rather than reaching for the
global one. A cleaning record that exists without a trail is an audit finding, not a bug
you can quietly repair later, so the two writes must commit or fail together.

**A no-op update writes nothing.** If a PATCH changes no values, the service returns the
existing row without touching the database and without an audit entry — saving a form
without editing it is not an event worth recording. This is covered by a test.

**Identity is snapshotted as text.** `cleanedBy`, `actorName` and `actorEmail` are stored
as strings alongside a nullable FK to `users`. A cleaning log has to still read correctly
in five years if an account is renamed or deleted; a JOIN that returns NULL would destroy
the record's meaning. The FK is kept for the cases where you *do* want the live user.

**The trail is append-only by construction.** Nothing in the API updates or deletes an
`audit_entries` row.

## Pagination

**Keyset (cursor), not OFFSET** — the stretch goal, chosen because it is genuinely the
right call here rather than for the sake of it:

- A cleaning log is append-heavy and read newest-first. With `OFFSET`, a row inserted
  while someone is paging shifts every later page by one, so rows are silently skipped or
  repeated. `tests/integration/pagination.test.ts` has a test that inserts a newer record
  mid-pagination and asserts page 2 still contains no row from page 1 — that test fails
  under offset pagination.
- `OFFSET n` still makes Postgres walk and discard `n` rows, so page 50 costs 50× page 1.
  A keyset predicate is an index range scan with constant cost.

The sort key is `(cleanedAt DESC, id DESC)`. The `id` tie-breaker is not decorative: two
cleanings recorded at the same timestamp would otherwise have an unstable order and could
be skipped or duplicated across a page boundary (also covered by a test). There is a
matching composite index per filter shape.

Prisma has no row-value comparison, so `(cleanedAt, id) < (?, ?)` is expressed as an
explicit `OR`; it plans to the same index scan.

**Cursors are opaque.** Base64url-encoded JSON, validated on the way in — a malformed
cursor is a 400, not a 500. Keeping it opaque means the sort key can change without
breaking clients.

**`total` is still returned.** Counting is the one thing keyset pagination does not give
for free, and the UI wants "showing 11–20 of 26". It is a separate count against the
unpaginated filter, so it never constrains the page query.

**Going backwards** is a client concern: the browser keeps a stack of the cursors it has
already used (`useKeysetPagination`) and pops it for "Previous". The server stays
forward-only, which keeps its contract small.

## Other decisions

- **Prisma over raw SQL.** The value here is the typed client and migrations, and the
  data model is simple relational work with no query the ORM makes awkward. Raw
  parameterised SQL would have been a defensible alternative; the audit logic is
  ORM-agnostic either way because it is a pure function over snapshots.
- **Enums in the database** rather than check constraints or plain text, so invalid
  states are unrepresentable at the storage layer as well as in the Zod schemas.
- **Zod at the edge, types inside.** Every route parses `params`, `query` and `body`
  through a schema; validation failures become a 422 with a per-field `details` array
  that the front-end renders next to the offending input. Nothing downstream of a route
  handler deals in `unknown`.
- **JWT auth (stretch goal).** Not because the exercise needs sessions, but because
  without a real "current user" the audit trail's *who* would be a client-supplied string
  — which defeats the purpose. Login compares against a dummy hash when the email is
  unknown so a wrong email and a wrong password are indistinguishable in both response
  and timing.
- **Reads are public, writes require auth.** A deliberate simplification for the
  exercise; see below.
- **Routes are split by URL shape**: collection operations are nested under
  `/equipment/:equipmentId/cleaning-records`, but a single record is addressed directly
  at `/cleaning-records/:recordId` since its id is globally unique and repeating the
  parent adds nothing.
- **`equipment` is not paginated.** A plant has tens of assets, not millions. The
  unbounded collection is the cleaning records, and those are paginated.
- **Errors are centralised.** One middleware turns `ApiError`s and known Prisma codes
  (P2002 → 409, P2025 → 404, P2003 → 400) into one response shape; anything else is
  logged server-side and returned as an opaque 500.
- **No UI framework.** One screen and a handful of components — a design system would
  have cost more than it saved. TanStack Query is in because cache invalidation after a
  mutation is exactly the problem it solves, and hand-rolling it is where staleness bugs
  live.
- **The DB is published on port 5433** in compose so it cannot collide with a Postgres
  already running locally on 5432.

## Tests

69 tests, weighted towards the two things the brief calls out.

- `tests/unit/audit-diff.test.ts` (14) — normalisation, PATCH semantics, clearing vs
  omitting a field, equal-instant dates, the field allow-list, create diffs.
- `tests/unit/pagination.test.ts` (9) — cursor round-trip, rejection of malformed and
  structurally-wrong cursors, over-fetch trimming, the exactly-full-final-page edge case.
- `tests/integration/audit-trail.test.ts` (9) — real HTTP + Postgres: CREATE and UPDATE
  entries, changed-fields-only, no entry for a no-op, clearing a field, attribution to
  the right actor, no orphan entry when validation rejects an update, history pagination.
- `tests/integration/pagination.test.ts` (11) — walking every page with no gaps or
  duplicates, **stability when a row is inserted mid-pagination**, filters applied to
  both page and total, timestamp ties, limit ceiling, malformed cursor.
- `tests/integration/equipment.test.ts` (9) and `cleaning-records.test.ts` (13) — CRUD,
  validation, conflicts, cascades.
- `tests/integration/auth.test.ts` (4).

Integration tests run against a real Postgres (`cleen_test`) rather than mocks, because
the things most likely to break — transaction rollback, cascade deletes, the keyset
predicate, index ordering — are exactly the things a mocked database cannot tell you
about. They truncate between tests and run serially.

## What I would do with more time

- **Optimistic concurrency on updates.** Two supervisors editing the same record today
  produce two valid audit entries, last write winning. A version column with an
  `If-Match`-style check would turn that into a 409 the UI can surface.
- **Front-end component tests.** The API is well covered; the React layer is verified by
  typechecking and manual walkthrough only. I would add React Testing Library tests for
  the form's dirty-field handling and the cursor stack in `useKeysetPagination`.
- **Roles.** `operator` vs `supervisor` exist as seeded people but not as permissions —
  verifying a cleaning ought to require a different role from recording it, and a real
  GxP system would need an e-signature (re-authentication) on the verify step.
- **Soft delete / retirement instead of hard delete.** `DELETE /api/equipment/:id`
  currently cascades and destroys history, which no regulated system would allow. It is
  in because the brief asked for CRUD; retirement via `status: RETIRED` is the path a
  real system would use.
- **Structured logging and a request id** on every response, so an audit entry can be
  traced back to the request that produced it.
- **Generated API types for the front-end.** The wire types in `web/src/api/types.ts` are
  hand-written and could drift; an OpenAPI document generated from the Zod schemas would
  remove that class of bug.
- **Rate limiting and refresh tokens.** Login is unthrottled and tokens are long-lived
  (12h) with no revocation.

## Deliberately left out

- **Pagination on `/api/equipment`** — bounded collection, as above.
- **Auditing equipment changes.** The brief asks for an audit trail on cleaning records;
  the same `diffFields` function would extend to equipment unchanged, but building it now
  would be speculative.
- **Diffing of `equipmentId`.** A cleaning record cannot be moved between machines, so it
  is not in the audited field list.
- **A production auth story** — no refresh tokens, no password reset, no lockout.
- **Delete for cleaning records.** Cleaning records are never deleted, only superseded by
  an update, which is the correct behaviour for a regulatory log.

## Assumptions

- `cleanedBy` is free text defaulting to the signed-in user's name, so a supervisor can
  enter a record on behalf of a night-shift operator; the account that actually entered it
  is preserved separately in `cleanedById` and in the audit entry's actor.
- `cleanedAt` may not be in the future (with a 60-second tolerance for clock skew) — you
  cannot log a cleaning that has not happened.
- Equipment `code` is unique and normalised to uppercase.
- The audit trail displays the stored values verbatim (e.g. `PENDING → VERIFIED`) rather
  than prettified labels, since what it must show is what was recorded.
