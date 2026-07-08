---
story-id: TB-S04
phase: 4
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
created: 2026-07-03
---

# Story TB-S04 — Move Note Endpoint + Health Check

## As a frontend developer, I want an API endpoint to reassign notes between columns AND a health probe endpoint, so the Kanban board can display column moves and Kubernetes/docker can monitor service availability.

**Maps to**: PRD FR3 (Move Notes Between Columns), FR4 (Health endpoint)  
**Traces to PRD AC**: AC1 (correct HTTP methods/status codes for move), AC2 (health returns `{"status":"ok"}` within 5s of container start), AC6 (`docker-compose up` health check works)  
**ADR References**: ADR-002 (move endpoint contract), ADR-005 Pillar 1 (Health Probes: `/livez`, `/ready`)

## Background / Context

The move note API is the core "Kanban" behavior — it reassigns a note from one column to another. The health endpoint is required by PRD G3 and AC6 for `docker-compose up` verification.

**Move endpoint contract (ADR-002)**:
| Method | Path | Status | Response Body |
|--------|------|--------|---------------|
| POST | `/api/notes/:id/move` | 200 | `{Note}` (moved to new column) |
| — | — | 400 | `columnId is missing from request body` |
| — | — | 404 | note not found, or column doesn't exist |

**Health endpoint contract**:
- `GET /health` → HTTP 200, body: `{"status":"ok"}`
- On PRD FR2 + AC2 requirement: response must be within 5s of container start

## Acceptance Criteria (Given/When/Then)

### AC1: `POST /api/notes/:id/move` reassigns the note and returns 200

**Given** a note exists in column A (the source column)  
**When** a client sends `POST /api/notes/<note-id>/move` with body `{"columnId": "<valid-uuid-of-column-B>"}` where column B is a different valid, existing column  
**THEN**:
- The response status is 200 OK
- The note's `column_id` in the database is now equal to `<column-B-uuid>`
- The response body contains the full updated note with the new `column_id`
- A subsequent `GET /api/notes/?column_id=<column-A-id>` does NOT include this note
- A subsequent `GET /api/notes/?column_id=<column-B-id>` DOES include this note

### AC2: Move returns 404 for a non-existent note id

**Given** no note exists with id `<nonexistent-uuid>`  
**When** `POST /api/notes/<nonexistent-uuid>/move` is sent with body `{"columnId": "<valid-column-id>"}`  
**THEN**:
- The response status is 404 Not Found
- The RFC 7807 error body includes `'note not found'`

### AC3: Move returns 400 if columnId is missing from request body

**Given** a valid note exists  
**When** `POST /api/notes/<valid-note-id>/move` is sent with body `{}` or without a JSON body (or no `columnId` key)  
**THEN**:
- The response status is 400 Bad Request
- The RFC 7807 error body includes `'columnId is required'` or equivalent validation message

### AC4: Move operation validated with automated API test

**Given** the application is running locally  
**When** `tests/note_move_test.sh` (or Go integration test) executes  
**THEN**:
- It verifies: successful move returns status 200 + note appears in target column
- It verifies: non-existent note returns 404
- It verifies: missing columnId returns 400
- All tests pass (exit code 0)

### AC5: `/health` endpoint returns `{"status":"ok"}` with HTTP 200

**Given** the application is running (Docker container started or local binary)  
**When** a client sends `GET /health`  
**THEN**:
- The response status is exactly HTTP 200
- The `Content-Type` header includes `application/json`
- The body is `{"status":"ok"}` with no extra fields or whitespace issues that break JSON parsing

**Scenario 5.1: Health during startup (within first 10 seconds)**  
- **Given** the docker container has just been started via `docker-compose up -d`  
- **When** `curl -s http://localhost:<backend-port>/health` is called within 10 seconds post-startup  
- **THEN** it returns HTTP 200 with `{"status":"ok"}` (the backend starts fast enough that DB init has completed)

## Technical Implementation Notes

- The move endpoint is a transaction: verify note exists → verify destination column exists → UPDATE note set `column_id = ?` where `id = ?`
- No FK constraint violation occurs because we validate the target column before the update (returns 400, not a DB error)
- Health check at `/health` is a separate route from readiness probes (`/ready`, `/livez` per ADR-005 — those are Phase 5 OBE-S01/S02 additions; this story only needs the basic PRD AC2 health endpoint)

## Output / Deliverables

1. Move handler in `internal/http/handler.go` (`handleNoteMove`)
2. Store method to update column_id: `UpdateNoteColumnID(noteUUID, targetColumnUUID) error`
3. Health check route `/health` returning `{"status":"ok"}` 
4. API test file: `tests/note_move_test.sh` or Go equivalent

## Dependencies: TB-S01 (migrations), TB-S02+TB-S03 (columns and notes endpoints must work to provide valid IDs for move tests)

## Estimate: S

---

*Written by Story Writer — traces to PRD FR3/FR4/AC1/AC2/AC6, Architecture ADR-002/ADR-005-Pillar1*
