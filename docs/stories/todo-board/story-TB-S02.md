---
story-id: TB-S02
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: EPIC-TB-2
created-by: Story Writer (John)
trace-from-prd: FR1, FR4, AC1
source-epics-file: epics-and-stories.todo-board.md
---

# Story TB-S02 — REST Columns CRUD Endpoints with Tests

As a backend developer, I want full CRUD operations on the columns API so the Kanban frontend can display lanes and users can manage them.

> **Maps to PRD FR1, FR4**  
> **Maps to Architecture:** ADR-002 (REST contract), ADR-003 (database layer)  
> **Previous Epic Story:** "REST columns endpoints with tests"

---

## Context

After database tables exist (TB-S01), the HTTP handlers layer exposes CRUD for `columns`. All responses use RFC 7807 Problem Details format for errors. The store layer uses `database/sql` with prepared statements to prevent SQL injection. UUIDs are generated server-side via `crypto/rand`.

**HTTP contract from ADR-002:**

| Method | Path | Success Response | Error Responses |
|--------|------|------------------|-----------------|
| GET | `/api/columns/` | `[Column]` (200) | 500 on DB error |
| POST | `/api/columns/` | `{Column}` (201) | 400 bad input, 500 |
| PUT | `/api/columns/:id` | `{Column}` (200) | 404, 400 |
| DELETE | `/api/columns/:id` | `{"deleted": true}` (204) | 404 |

**Column struct:**
```go
type Column struct {
    ID         uuid.UUID `json:"id"`
    BoardScope string    `json:"board_scope"`
    Title      string    `json:"title"`
    CreatedAt  time.Time `json:"created_at"`
    UpdatedAt  time.Time `json:"updated_at"`
}
```

**Error format (RFC 7807):**
```json
{"type":"about:blank","status":400,"title":"Bad Request","detail":"message","instance":"/api/columns/"}
```

---

## Acceptance Criteria (Given/When/Then)

### AC1: GET /api/columns/ returns JSON array of columns

**Given** the database contains N column records (N ≥ 0)  
**When** a client sends `GET /api/columns/`  
**THEN** the response HTTP status is 200  
**AND** the response `Content-Type` header is `application/json`  
**AND** the body is a valid JSON array where each element contains keys: `id`, `board_scope`, `title`, `created_at`, `updated_at`  
**AND** timestamps are in RFC 3339 format (e.g., `"2024-01-15T10:30:00Z"`)

### AC2: POST /api/columns/ creates a column and returns 201

**Given** the columns table is empty  
**When** a client sends `POST /api/columns/` with body `{"board_scope":"default","title":"To Do"}`  
**THEN** the response HTTP status is 201  
**AND** the response body contains a new column object with:
 - `id` set to a valid UUID v4 (follows RFC 4122 format)
 - `board_scope` = "default"
 - `title` = "To Do"
 - `created_at` and `updated_at` identical at creation time (both are current server timestamp)
**AND** a subsequent `GET /api/columns/` returns this new object in the array

### AC3: PUT /api/columns/:id updates title; returns 404 if not found

**Given** a column exists with `id = "a1b2c3d4-..."` and `title = "Old"`  
**When** a client sends `PUT /api/columns/a1b2c3d4-...` with body `{"title":"Updated"}`  
**THEN** the response HTTP status is 200
**AND** the response body contains the updated column with `title = "Updated"`
**AND** the `updated_at` timestamp is later than the original `created_at`

**Given** a non-existent UUID `"00000000-0000-0000-0000-000000000001"`  
**When** a client sends `PUT /api/columns/00000000-0000-0000-0000-000000000001` with body `{"title":"X"}`  
**THEN** the response HTTP status is 404  
**AND** the body follows RFC 7807 format with `"status":404`

### AC4: DELETE /api/columns/:id deletes column (cascades to notes) and returns 404 if not found

**Given** a column `col1` exists with two associated notes attached  
**When** a client sends `DELETE /api/columns/col1-uuid`  
**THEN** the response HTTP status is 204 (empty body)
**AND** `SELECT * FROM columns WHERE id='col1-uuid'` returns zero rows post-deletion
**AND** both associated notes rows are also removed from the `notes` table (orphan cascade confirmed)

**Given** a non-existent UUID  
**When** `DELETE /api/columns/00000000-0000-0000-0000-000000000001` is sent  
**THEN** the response HTTP status is 404 with RFC 7807 body

### AC5: All endpoints tested with automated API tests

**Given** a running backend server (via `./backend/test-fixtures/mock_server.sh`)  
**When** the test suite runs (`go test ./...` in `tests/column_api_test.sh`)  
**THEN** every endpoint is exercised: positive (valid inputs), negative (invalid IDs, missing fields), and cascade-delete verification
**AND** all 15+ individual assertions pass without errors

---

## Implementation Notes

- Register routes in `main.go` using Go stdlib `http.HandleFunc` or a simple router wrapper.
- Parse UUID from the URL path; return 400 if it fails to parse (not 404 — this is input validation).
- Store layer (`internal/store/columns.go`) contains functions: `ListColumns`, `CreateColumn`, `UpdateColumn`, `DeleteColumn`.
- Tests can use SQLite in-memory database to avoid external deps. Create `backend/internal/store/columns_test.go` using the test helper.
- Validate empty/whitespace-only title → return 400 (non-empty input required).
- Maximum title length: 255 characters (per DB schema); reject inputs longer with 400.

---

## Dependencies

Requires: **TB-S01** (database migrations must exist)

## Estimate

S (2–3 hours for Go developer writing handlers + tests)
