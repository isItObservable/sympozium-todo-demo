---
story-id: TB-S01
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: EPIC-TB-1
created-by: Story Writer (John)
trace-from-prd: AC2, G1
source-epics-file: epics-and-stories.todo-board.md
---

# Story TB-S01 — Database Schema & Migration Infrastructure

As a developer, I want database migrations that create `columns` and `notes` tables with full up/down support, so the application can persist board data across SQLite (dev) and PostgreSQL (prod) environments.

> **Maps to PRD Goal:** G1  
> **Maps to Architecture:** ADR-003 (PostgreSQL/SQLite via DATABASE_URL), ADR-001  
> **Previous Epic Story:** "Create SQLite/Postgres migrations for columns and notes tables"

---

## Context

The Kanban board needs two persistent tables: `columns` and `notes`. The system MUST support database swapping via a single `DATABASE_URL` environment variable with zero code changes. For development, SQLite (via `modernc.org/sqlite`, pure Go, no CGO) runs inside the same binary. Production uses PostgreSQL (`pgx/v5`). Migrations are run once on application startup using `golang-migrate/migrate`.

**Column schema:**
```
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
board_scope VARCHAR(255) NOT NULL DEFAULT 'default'
title       VARCHAR(255) NOT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Note schema:**
```
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
column_id   UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE
title       VARCHAR(255) NOT NULL
body        TEXT
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

For SQLite compatibility, generate UUIDs in Go via `crypto/rand` and use raw `CREATE TABLE ...` without relying on DB-generated IDs.

---

## Acceptance Criteria (Given/When/Then)

### AC1: Columns table creation — PostgreSQL

**Given** a running PostgreSQL database with empty schema  
**When** the application starts with `DATABASE_URL=postgres://user@host/db` and no migrations have been applied  
**Then** migration 001 up is executed automatically and the `columns` table becomes visible in `\dt` output  
**And** all five columns (id, board_scope, title, created_at, updated_at) exist with correct types and constraints
**AND** the primary key on `id` is present

### AC2: Notes table creation

**Given** migration 001 has been applied (`columns` table exists)  
**When** migration 002 up runs  
**Then** the `notes` table becomes visible in `\dt` output  
**And** all six columns (id, column_id, title, body, created_at, updated_at) are correctly declared
**AND** a foreign key constraint exists: `(column_id REFERENCES columns(id) ON DELETE CASCADE)`
**AND** an index `idx_notes_column_id` is visible in `\di` output

### AC3: Migration works on SQLite

**Given** no SQLite database file exists  
**When** the application starts with `DATABASE_URL=sqlite:///board.db` (or `file::memory:?cache=shared`)  
**Then** both migrations 001+002 execute without errors
**And** `SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name;` reveals `columns` and `notes` tables with structures equivalent to the PG schemas
**And** UUIDs can be inserted successfully from Go (generated via `crypto/rand`)

### AC4: Down-migration drops tables safely

**Given** migrations 001+002 are applied (on either PG or SQLite)  
**When** down-migrations run in reverse order (`002.down.sql` then `001.down.sql`)  
**Then** no errors are returned from the migration runner
**And** the `\dt` output (PG) or `sqlite_master` table confirm both tables have been dropped
**AND** subsequent re-application of up-migrations recreates the exact same structure

### AC5: Idempotent startup — no duplicate migrations on restart

**Given** all migrations are already applied  
**When** the application is stopped and started three consecutive times with the same `DATABASE_URL`
**Then** no errors occur during migration steps
**And** the database state after each start contains exactly one set of tables (no duplicates or conflicts)

---

## Implementation Notes

- Use `golang-migrate/migrate/v4` — call `migrate.Up()` once during server startup in `main.go`.
- Migration SQL files live at: `backend/migrations/001_create_columns.up.sql`, `.down.sql`, `002_create_notes.up.sql`, `.down.sql`.
- For SQLite, the `.db` file is auto-created on first `sql.Open("sqlite", ...)`. Ensure parent directory exists before migration.
- Use `github.com/google/uuid` for consistent UUID generation across both drivers; pass via `INSERT` statements (not default values).
- Write a shared helper `func SetupDB(url string) (*sql.DB, error)` in `internal/db/db.go` that handles the database URL switch logic and runs migrations.
- Test both backends: add a file `backend/internal/db/db_test.go` with test helpers that create databases from temporary paths or use `testify/mocks`.

---

## Dependencies

**None.** This story is foundational — no other code depends on it, but all subsequent stories do.

## Estimate

S (1–2 hours for a Go developer familiar with `database/sql`)
