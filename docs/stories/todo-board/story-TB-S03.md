---
story-id: TB-S03
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: EPIC-TB-3 (Backend — Notes CRUD)
created-by: Story Writer
trace-from-prd: FR2, FR4
source-epics-file: epics-and-stories.todo-board.md
---

# Story TB-S03 — REST Notes CRUD Endpoints with Tests

As a backend developer, I want full CRUD operations on the notes API so users can create, edit, and delete sticky notes in their Kanban columns.

> **Maps to PRD FR2, FR4 (Notes stored + consistent JSON responses)**  
> **Maps to Architecture:** ADR-002 (REST contract: `GET/POST/PUT/DELETE /api/notes/*`),  
  ADR-003-B (notes schema with FK → columns)

## Context

After columns exist, the notes API provides full CRUD. Notes are scoped to a column via `column_id` FK. The store layer uses prepared statements; UUIDs generated in Go. Every response follows RFC 7807 Problem Details for errors.

**HTTP contract:**
| Method | Path | Success | Errors |
|--------|------|---------|--------|
| GET | `/api/notes/?column_id=UUID` | `[Note]` (200) | 500 on DB |
| POST | `/api/notes/` | `{Note}` (201) | 400 bad input, 404 if column doesn't exist |
| PUT | `/api/notes/:id` | `{Note}` (200) | 404, 400 |
| DELETE | `/api/notes/:id` | empty (204) | 404 |

**Go struct:**
```go
type Note struct {
    ID        uuid.UUID `json:"id"`
    ColumnID  uuid.UUID `json:"column_id"`
    Title     string    `json:"title"`
    Body      *string   `json:"body,omitempty"` // nullable → omitted if nil
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

## Acceptance Criteria (Given/When/Then)

### AC1: GET /api/notes/?column_id=UUID returns filtered notes or all

**Given:** the database has column "col-A" with 3 notes, and column "col-B" with 2 notes  
**When:** `GET /api/notes/?column_id=<col-A-id>` is sent  
**Then:** response status is 200, body is a JSON array of exactly 3 note objects, each with matching `column_id`  

**Given:** no `column_id` query parameter  
**When:** `GET /api/notes/` is sent  
**Then:** response is 200, body contains ALL notes from all columns

### AC2: POST /api/notes/ creates a note and returns 201

**Given:** column "col-A" exists  
**When:** `POST /api/notes/` with body `{"column_id":"<col-A-id>","title":"Hello World","body":"some details"}` is sent  
**Then:** response status is 201, body contains the new note object with a valid UUID v4 id, matching column_id, title "Hello World", and non-empty created_at/updated_at timestamps  
**And:** `SELECT count(*)` in the notes table has increased by 1

### AC3: PUT /api/notes/:id updates or returns 404

**Given:** note "note-1" exists with title="Old"  
**When:** `PUT /api/notes/note-1` with body `{"title":"Updated","body":"new body"}` is sent  
**Then:** response status is 200, body shows the updated note (title="Updated", body="new body"), and `updated_at > created_at`  

**Given:** UUID "00000000-0000-0000-0000-000000000001" does not exist  
**When:** `PUT /api/notes/<that-id>` is sent  
**Then:** response is 404 with RFC 7807 body `{"type":"about:blank","status":404,...}`

### AC4: DELETE /api/notes/:id removes and returns 204 or 404

**Given:** note "note-1" exists  
**When:** `DELETE /api/notes/note-1` is sent  
**Then:** response status is 204 (empty body), and row count for that UUID in the notes table is now 0  

**Given:** UUID "00000000-..." does not exist  
**When:** `DELETE /api/notes/<that-id>` is sent  
**Then:** response is 404 with RFC 7807 body

### AC5: API tests exercise every endpoint + edge cases

**Given:** a running backend (SQLite in-memory during test)  
**When:** `go test ./...` runs inside `backend/`  
**Then:** all 4 endpoints pass positive, negative, and input-validation paths  
**And:** no errors or panics occur  

## Implementation Notes

- Handler: `internal/http/note_handler.go` — parse UUIDs via `uuid.Parse()`, return 400 if invalid.
- Store: `internal/store/notes.go` — functions `ListByColumn`, `Create`, `Update`, `Delete`.
- Validation: title ≥1 char, ≤255 chars; column_id must reference existing column (check before INSERT; return 404 or 400? → ADR-002 says POST /api/notes on bad input returns 400. I recommend **403** since `column_id` being invalid is an input validation error).
- Tests: place in `backend/internal/store/note_test.go` using the SQLite-in-memory helper pattern (shared across TB-S02 and TB-DnD) with `t.Cleanup()` for teardown, or use `go test -v ./...`.

---

## Dependencies

**Requires:** TB-S01 (columns + notes tables + DB schema), TB-S02 (at least one column exists for testing FK constraint)

## Estimate

S (2–3 hours for a Go developer who knows `database/sql`)
