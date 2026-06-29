---
story-id: TB-S04
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: EPIC-TB-4
created-by: Story Writer (John)
trace-from-prd: FR3, FR4, FR8, AC1
source-epics-file: epics-and-stories.todo-board.md
---

# Story TB-S04 — POST /api/notes/:id/move Endpoint + Health Check

As a frontend developer, I want an API endpoint that reassigns notes between columns (the core Kanban interaction), plus a health check endpoint for operational monitoring.

> **Maps to PRD FR3, FR4, FR8**  
> **Maps to Architecture:** ADR-002 (REST contract: `POST /api/notes/:id/move` returns moved note object with 200)  
> **Previous Epic Story:** "POST /notes/:id/move endpoint and health check"

---

## Context

The move operation is the heart of the Kanban board — allowing cards to flow between columns. This story adds two things:

1. **Move endpoint**: `POST /api/notes/:id/move` updates a note's `column_id` FK, returns the updated note object.
2. **Health endpoint**: Simple `GET /health` returning `{"status":"ok"}` — serves as basic readiness check for ops/tooling (liveness/readiness `/livez`/`/readyz` are covered in OBE-2).

**HTTP contract from ADR-002:**
| Method | Path | Success Response | Error Responses |
|--------|------|------------------|-----------------|
| POST | `/api/notes/:id/move` | `{Note}` (moved to new column) 200 | 400 missing field, 404 not found |

---

## Acceptance Criteria (Given/When/Then)

### AC1: Move a note to a different column successfully

**Given** a note `note-1` currently belongs to column `col-A`  
**AND** column `col-B` exists in the database  
**WHEN** a client sends `POST /api/notes/note-1/move` with body `{"column_id":"<col-B-uuid>"}`  
**THEN** the response HTTP status is 200
**AND** the response body contains the updated note object where:
 - `column_id` value equals `<col-B-uuid>` (the target column)
 - `updated_at` is later than the original timestamp (confirmed via DB query)
**AND** a subsequent `GET /api/notes/?column_id=<col-B-uuid>` includes this note in its results  
**AND** a subsequent `GET /api/notes/?column_id=<col-A-uuid>` no longer includes this note

### AC2: Returns 404 for non-existent note

**Given** no note exists with UUID `"00000000-0000-0000-0000-000000000001"`  
**WHEN** a client sends `POST /api/notes/00000000-0000-0000-0000-000000000001/move` with body `{"column_id":"<col-A-uuid>"}`  
**THEN** the response HTTP status is 404
**AND** the body follows RFC 7807 format: `{"type":"about:blank","status":404,"title":"Not Found","detail":"note-not-found","instance":"/api/notes/.../move"}`

### AC3: Returns 400 if columnId is missing from request body

**Given** a valid note `note-1` exists  
**WHEN** a client sends `POST /api/notes/note-1/move` with an empty body `{}` or body without the `"column_id"` key  
**THEN** the response HTTP status is 400
**AND** the body follows RFC 7807 format: `{"type":"about:blank","status":400,"title":"Bad Request","detail":"missing column_id field","instance":"/api/notes/note-1/move"}`

### AC4: Move operation validated with API test

**Given** a running backend server  
**WHEN** the integration test `tests/note_move_test.sh` runs (or equivalent inline Go test)  
**THEN** the test verifies: successful move between two columns, verification of before/after state via DB query
**AND**: 404 for invalid note ID, 400 for missing column_id, and cascade-delete confirmation

### AC5: GET /health returns {"status":"ok"} with HTTP 200

**Given** the server is running  
**WHEN** a client sends `GET /health`  
**THEN** the response HTTP status is 200
**AND** the body is exactly `{"status":"ok"}` with `Content-Type: application/json`
**AND**: no authentication or authorization is required to access this endpoint (it is public for healthcheck probes)

---

## Implementation Notes

- The move handler in `internal/http/handler.go`: parse UUID from path, parse column_id from JSON body, then call `store.UpdateNoteColumn(noteID, newColumnID)`.
- Use a single SQL update: `UPDATE notes SET column_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *` — all in one transaction to prevent partial state.
- Validate that the target `column_id` exists before executing the update (SELECT 1 FROM columns WHERE id=target COLL). If it doesn't exist → return 404 or 400? Per ADR-002 contract: "returns 400 missing field" for bad input. I recommend returning 404 if `column_id` does not reference a valid column (FK constraint violation at the HTTP layer).
- The `/health` endpoint is simplest handler in the codebase — just one line writing JSON and status 200 to the response header.

---

## Dependencies

Requires: **TB-S01** (notes table with FK), **TB-S03** (at least two columns exist for move testing)

## Estimate

S (1–2 hours for Go developer)
