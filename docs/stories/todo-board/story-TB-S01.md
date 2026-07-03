---
story-id: TB-S01
phase: 4
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
created: 2026-07-03
---

# Story TB-S01 — Database Schema Migrations with Cross-Engine Support

## As a backend developer, I want database migrations that create `columns` and `notes` tables on both SQLite and PostgreSQL, so the application can persist board data from day one.

**Maps to**: PRD FR5 (Database Persistence), FR2/FR4 (CRUD endpoints need persistent storage)  
**Traces to PRD AC**: AC1 (endpoints work — depends on migrations), AC2 (migrations run on both SQLite and Postgres)  
**ADR References**: ADR-003 (PostgreSQL with SQLite dev parity via DATABASE_URL), ADR-003-B (initial schema v1)

## Background / Context

The PRD requires zero-code swapping between SQLite (local/dev) and PostgreSQL (prod). We use:
- `modernc.org/sqlite` (pure Go, no CGO) for both engines to produce one static binary
- `golang-migrate/migrate` — one SQL file per migration, migrations run once on startup
- Connection via standard `DATABASE_URL` env var

**ADR-003-B schema** (the target state):
```sql
-- For PostgreSQL:
CREATE TABLE IF NOT EXISTS columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_scope VARCHAR(255) NOT NULL DEFAULT 'default',
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_column_id ON notes(column_id);

-- For SQLite: use uuid_generate_v4() or Go crypto/rand for UUIDs.
-- Note: gen_random_uuid() is not available in SQLite.
```

## Acceptance Criteria (Given/When/Then)

### AC1: Migration creates `columns` table with all required columns

**Given** a fresh database and DATABASE_URL pointing to either PostgreSQL or SQLite  
**When** the application starts and runs pending migrations  
**Then** the `columns` table EXISTS with exactly these columns:
- `id TEXT PRIMARY KEY` (UUID string)
- `board_scope TEXT NOT NULL DEFAULT 'default'`
- `title TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL` (auto-set to current timestamp)
- `updated_at TIMESTAMPTZ NOT NULL` (auto-set to current timestamp)

**Scenario 1.1: PostgreSQL**
- **Given** an empty PostgreSQL database  
- **When** migration is applied on startup  
- **Then** the table has all columns and a default of `'default'` on `board_scope`

**Scenario 1.2: SQLite**
- **Given** an empty `.db` file in memory or on disk  
- **When** migration is applied  
- **THEN** the same table structure exists (SQLite-compatible syntax)

### AC2: Migration creates `notes` table with FK constraint and index

**Given** a database that has already had the columns table created (same v1 migration)  
**When** the application starts  
**Then** the `notes` table EXISTS with:
- `id TEXT PRIMARY KEY` (UUID)
- `column_id TEXT NOT NULL` → FOREIGN KEY REFERENCES columns(id) ON DELETE CASCADE
- `title TEXT NOT NULL`
- `body TEXT` (nullable)
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- A GIN or BTREE index on `column_id` (`idx_notes_column_id`)

### AC3: Migration runs successfully on both SQLite and PostgreSQL

**Given** a fresh PostgreSQL 15+ container with DATABASE_URL set correctly  
**When** the Go application calls `migrate.Up()`  
**Then** it returns `nil` error and both tables exist with data

**Given** an empty SQLite in-memory or file store with DATABASE_URL pointing there  
**When** the same `migrate.Up()` is called  
**THEN** it returns `nil` error and both tables exist with data identically

### AC4: Down-migration drops tables safely without errors

**Given** a database that has migrations applied (v1)  
**When** the application calls `migrate.Down()`  
**Then**:
- Both `columns` and `notes` tables are dropped
- No error is returned
- A second call to `Down()` on already-down state returns gracefully (idempotent or a known non-fatal error that does not crash)

### AC5: Migration runner logs which version was applied

**Given** migrations run at startup  
**When** the application starts  
**Then** the log contains a structured info-level entry like:
```json
{"ts":"...","level":"INFO","msg":"migrations completed","applied_version":1,"db":"sqlite"}
```
or for PostgreSQL:
```json
{"ts":"...","level":"INFO","msg":"migrations completed","applied_version":1,"db":"postgres"}
```

## Technical Implementation Notes

- In `internal/db/migrate.go`: use `golang-migrate` with embedded SQL files via `fsmig` or `go:embed`
- Two migration files in `internal/db/migrations/`:
  - `001_create_columns_and_notes.up.sql`
  - `001_create_columns_and_notes.down.sql`
- For SQLite UUID generation: use `gen_uuid()` if the extension is loaded, or generate UUIDs in Go via `crypto/rand` and pass as strings — this avoids `gen_random_uuid()` which is PostgreSQL-only
- The migration runner runs **exactly once** at application startup (not per-request)

## Output / Deliverables

1. Migration SQL files (up + down) in `internal/db/migrations/`
2. Migration runner in `internal/db/migrate.go` that:
   - Reads DATABASE_URL env var
   - Runs pending migrations on startup
   - Returns an error to main if schema cannot be created (application fails open)

## Dependencies: none

## Estimate: S

---

*Written by Story Writer — traces to PRD FR5/AC2, Architecture ADR-003/ADR-003-B*
