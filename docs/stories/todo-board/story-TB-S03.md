---
story-id: TB-S03
phase: 4
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
created: 2026-07-03
---

# Story TB-S03 — Notes CRUD API with Automated Tests

## As a frontend developer, I want full CRUD operations on note cards (list by column, create, update, delete), so users can manage sticky notes on the Kanban board.

**Maps to**: PRD FR2 (Notes entity), FR4 (REST endpoint contract)  
**Traces to PRD AC**: AC1 (endpoints work correctly — tested via API harness)  
**ADR References**: ADR-002 (RESTful API contract, response schemas, RFC 7807 errors), ADR-004 (handler/store separation in `internal/http/` and `internal/store/`)

## Background / Context

PRD FR2 requires notes with: unique ID, column reference, title, body text, timestamps. Notes are created/edited/deleted within a specific column context.

**Endpoints** (from ADR-002 table):
| Method | Path | Status | Response Body |
|--------|------|--------|---------------|
| GET | `/api/notes/?column_id=:id` | 200 | `[Note]` (filtered or all) |
| POST | `/api/notes/` | 201 | `{Note}` just created |
| PUT | `/api/notes/:id` | 200 | `{Note}` updated |
| DELETE | `/api/notes/:id` | 204 | `{"deleted": true}` |

**Note schema**: id (UUID), column_id (FK → columns.id), title (string), body (text nullable), created_at, updated_at.

## Acceptance Criteria (Given/When/Then)

### AC1: `GET /api/notes/?column_id=:id` returns filtered notes array; works without filter

**Given** the database has notes in multiple columns  
**When** a client sends `GET /api/notes/?column_id=<column-uuid>`  
**THEN**:
- The response status is 200 OK with `Content-Type: application/json`
- The body contains ONLY notes where `column_id` equals the requested UUID
- Each note object has fields: `{id, column_id, title, body?, created_at, updated_at}`

**Scenario 1.1: No filter parameter**
- **Given** notes exist in at least one column  
- **When** `GET /api/notes/` is sent (no query params)  
- **THEN** all notes across ALL columns are returned

**Scenario 1.2: Empty column results**
- **Given** a column exists that has zero notes  
- **When** `GET /api/notes/?column_id=<that-column-id>`  
- **THEN** response body is `[]` (empty array, not null)

### AC2: `POST /api/notes/` creates a note and returns 201 + full object

**Given** at least one column exists in the database  
**When** a client sends `POST /api/notes/` with body `{"title": "Task A", "body": "Do this first", "columnId": "<valid-column-id>"}`  
**THEN**:
- The response status is 201 Created
- The response body contains the full note object: `{id (UUID), column_id ("<valid-column-id>"), title, body, created_at, updated_at}`
- The note EXISTS in the database and `GET /api/notes/?column_id=<that-id>` returns it

**Scenario 2.1: Invalid columnId (does not exist)**
- **Given** a valid column exists  
- **When** `POST /api/notes/` is sent with `"columnId": "<nonexistent-uuid>"`  
- **THEN** the response status is 400 Bad Request (`invalid column_id`)

**Scenario 2.2: Missing title field**
- **Given** a valid column exists  
- **When** `POST /api/notes/` is sent with `{}`  
- **THEN** the response status is 400 Bad Request (`title is required`)

### AC3: `PUT /api/notes/:id` updates title/body; returns 404 if note not found

**Given** a note exists in the database created by Story TB-S03's own setup code (or prior tests)  
**When** a client sends `PUT /api/notes/<note-id>` with body `{"title": "Updated Title", "body": "Updated body text"}`  
**THEN**:
- The response status is 200 OK
- The note's title and body are updated to the new values
- The `updated_at` timestamp has changed

**Scenario 3.1: Partial update (only title)**
- **Given** a note exists with an existing body  
- **When** `PUT /api/notes/<note-id>` sends `{"title": "New Title Only"}`  
- **THEN** the title is updated, the body remains its previous value unchanged

**Scenario 3.2: Note not found**
- **Given** no note matches id `<nonexistent-uuid>`  
- **When** `PUT /api/notes/<nonexistent-uuid>` is sent  
- **THEN** response status is 404 with RFC 7807 error (`note not found`)

### AC4: `DELETE /api/notes/:id` removes note and returns 204

**Given** a note exists in the database  
**When** a client sends `DELETE /api/notes/<note-id>`  
**THEN**:
- The response status is 204 No Content (or 200 with `{"deleted": true}`)
- The note NO LONGER appears in any `GET /api/notes/` query

**Scenario 4.1: Note not found**
- **Given** no note matches `<nonexistent-uuid>`  
- **When** `DELETE /api/notes/<nonexistent-uuid>` is sent  
- **THEN** response status is 404 (`note not found`)

### AC5: All note endpoints have automated API tests covering every scenario

**Given** the application is running with backend + sqlite  
**When** the CI test harness runs `tests/note_api_test.sh` or equivalent  
**THEN**:
- Tests verify GET with and without column_id filter → status 200
- Tests verify POST with/create notes, invalid columnId → 201/400
- Tests verify PUT (full + partial update) → 200
- Tests verify DELETE → 204 + verify gone on subsequent GET
- All test scenarios pass (exit code 0)

## Technical Implementation Notes

- The store layer method `GetNotesByColumnID(columnUUID)` returns `[]Note{}` for empty results
- POST body must validate existence of the referenced column before inserting (FK constraint, but also application-level validation for better error messages)
- Parameterized queries throughout — use `sql.Stmt` or equivalent Go prepared statements

## Output / Deliverables

1. CRUD handlers in `internal/http/handler.go` (4 more endpoints)
2. Store methods in `internal/store/note_store.go`
3. Automated API tests for all note scenarios

## Dependencies: TB-S01 (migrations + DB runner), TB-S02 (columns must exist to reference notes)

## Estimate: S

---

*Written by Story Writer — traces to PRD FR2/FR4/AC1, Architecture ADR-002/ADR-003-B*
