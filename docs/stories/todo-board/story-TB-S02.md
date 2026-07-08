---
story-id: TB-S02
phase: 4
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
created: 2026-07-03
---

# Story TB-S02 — Columns CRUD API with Automated Tests

## As a frontend developer, I want complete REST CRUD operations for columns (list, create, update, delete), so the Kanban board can display and manage Kanban lanes programmatically.

**Maps to**: PRD FR1 (Columns structure), FR4 (REST endpoint contract)  
**Traces to PRD AC**: AC1 (endpoints with correct HTTP methods/status codes)  
**ADR References**: ADR-002 (RESTful API contract, RFC 7807 errors), ADR-004 (project structure: `internal/http/handler.go`, `internal/store/`)

## Background / Context

PRD FR1 requires multiple columns (at minimum "To Do", "Doing", "Done") that users can create, rename, and delete. The API contract in ADR-002 defines the exact HTTP methods, paths, and response schemas.

**Endpoints**:
| Method | Path | Status | Response Body |
|--------|------|--------|---------------|
| GET | `/api/columns/` | 200 | `[Column]` JSON array |
| POST | `/api/columns/` | 201 | `{Column}` created column |
| PUT | `/api/columns/:id` | 200 | `{Column}` updated column |
| DELETE | `/api/columns/:id` | 204 | Body: `{"deleted": true}` (or empty) |

**Error handling**: RFC 7807 Problem Details for all errors.

## Acceptance Criteria (Given/When/Then)

### AC1: `GET /api/columns/` returns a JSON array of column objects

**Given** the database has been initialized with at least one column  
**When** a client sends `GET /api/columns/`  
**THEN**:
- The response status is 200 OK
- The `Content-Type` header is `application/json`
- The body is a JSON array where each element has: `{id: string (UUID), board_scope: string, title: string, created_at: string (ISO8601), updated_at: string (ISO8601)}`

**Scenario 1.1: Empty database**
- **Given** zero columns in the database  
- **When** `GET /api/columns/` is called  
- **THEN** the response body is `[]` (empty array, not null)

### AC2: `POST /api/columns/` creates a column and returns 201 + the created object

**Given** no columns or existing columns in the database  
**When** a client sends `POST /api/columns/` with body `{"title": "New Column"}` (valid JSON)  
**THEN**:
- The response status is 201 Created
- The response body contains `{id: string (non-empty UUID), title: "New Column", board_scope: "default", created_at, updated_at}`
- The column EXISTS in the database and can be retrieved by `GET /api/columns/`
- `board_scope` defaults to `"default"` if not provided

**Scenario 2.1: Missing title**
- **Given** any columns in the database  
- **When** `POST /api/columns/` is sent with body `{}` (no title field)  
- **THEN** the response status is 400 Bad Request with RFC 7807 error (`title is required`)

**Scenario 2.2: Empty string title**
- **Given** any columns  
- **When** `POST /api/columns/` is sent with `{"title": ""}`  
- **THEN** the response status is 400 Bad Request

### AC3: `PUT /api/columns/:id` updates a column's title; returns 404 if not found

**Given** a column exists in the database (e.g., with id `"550e8400-e29b-41d4-a716-446655440000"`)  
**When** a client sends `PUT /api/columns/550e8400-e29b-41d4-a716-446655440000` with body `{"title": "Updated Title"}`  
**THEN**:
- The response status is 200 OK
- The response body contains the updated column (title is now `"Updated Title"`)
- The `updated_at` field has changed to the current timestamp

**Scenario 3.1: Column not found**
- **Given** no column exists with id `"nonexistent-uuid"`  
- **When** `PUT /api/columns/nonexistent-uuid` is sent  
- **THEN** the response status is 404 Not Found with RFC 7807 error (`column not found`)

### AC4: `DELETE /api/columns/:id` deletes a column and cascades to notes; returns 404 if not found

**Given** a column exists in the database  
**When** a client sends `DELETE /api/columns/<column-id>`  
**THEN**:
- The response status is 204 No Content (or 200 with `{"deleted": true}`)
- The column NO LONGER EXISTS in the database when queried via `GET /api/columns/`

**Scenario 4.1: Cascade to notes**
- **Given** a column exists AND has 3 associated notes  
- **When** the column is deleted  
- **THEN** all 3 notes are also removed from the database (FK cascade ON DELETE CASCADE)

**Scenario 4.2: Column not found**
- **Given** no column with id `"nonexistent-uuid"`  
- **When** `DELETE /api/columns/nonexistent-uuid` is sent  
- **THEN** the response status is 404 Not Found

### AC5: All endpoints have automated API tests covering every scenario

**Given** the application is running locally (backend + sqlite)  
**When** CI runs the endpoint tests for columns  
**THEN**:
- Tests hit `GET /api/columns/` and verify status=200, body-is-array
- Tests hit `POST /api/columns/` with valid and invalid bodies, verify 201/400 statuses
- Tests hit `PUT /api/columns/:id` with existing and non-existing ids, verify 200/404
- Tests hit `DELETE /api/columns/:id` with existing and non-existing ids, verify cascade behavior and 404
- All tests pass (exit code 0)

## Technical Implementation Notes

- Route registration in `internal/http/handler.go`: register all 4 routes under the `/api/columns/` prefix
- The store layer should use parameterized queries (prepared statements) — NO string concatenation for SQL
- UUID generation: generate in Go on `POST` using `crypto/rand`, pass it to the INSERT
- RFC 7807 errors: implement a helper like `respondProblem(ctx, w, status, typeURI, title, detail)` that serializes the correct JSON

## Output / Deliverables

1. CRUD handler functions in `internal/http/handler.go` (4 handlers)
2. Store layer methods in `internal/store/column_store.go` (4 queries + 1 cascade)
3. Automated API tests in `tests/column_api_test.sh` or Go test file: `tests/column_http_test.go`

## Dependencies: TB-S01 (database migrations must be complete and running)

## Estimate: S

---

*Written by Story Writer — traces to PRD FR1/FR4/AC1, Architecture ADR-002/ADR-003-B*
