# Epics & Stories — Todo Board App

## Epic: Database Schema & Migrations  (maps to PRD requirements: FR5, AC2)

### Story: Create SQLite/Postgres migrations for columns and notes tables
As a developer, I want database migrations that create `columns` and `notes` tables, so the backend can persist board data.
Acceptance criteria:
- [ ] AC1: Migration creates `columns` table with id, title, board_scope, created_at, updated_at
- [ ] AC2: Migration creates `notes` table with id, column_id (FK), title, body, created_at, updated_at
- [ ] AC3: Migration runs successfully on both SQLite and PostgreSQL
- [ ] AC4: Down-migration drops tables safely without errors
Dependencies: none
Estimate: S

---

## Epic: Backend — Columns API  (maps to PRD requirements: FR1, FR4)

### Story: REST columns endpoints with tests
As a frontend developer, I want CRUD operations for columns so the board can display and manage Kanban lanes.
Acceptance criteria:
- [ ] AC1: `GET /api/columns/` returns JSON array of column objects (id, title)
- [ ] AC2: `POST /api/columns/` with body `{title}` creates a column and returns 201 + the created object
- [ ] AC3: `PUT /api/columns/:id` updates column title; returns 404 if not found
- [ ] AC4: `DELETE /api/columns/:id` deletes column (cascades to notes); returns 404 if not found
- [ ] AC5: All endpoints tested with automated API tests (no untested code — per PRD AC6)
Dependencies: Story "Epic: Database Schema" above
Estimate: S

---

## Epic: Backend — Notes CRUD API  (maps to PRD requirements: FR2, FR4)

### Story: REST notes endpoints with tests
As a frontend developer, I want full CRUD on notes so users can create, edit, and delete sticky cards.
Acceptance criteria:
- [ ] AC1: `GET /api/notes/?column_id=:id` returns filtered notes array (or all if no column_id filter)
- [ ] AC2: `POST /api/notes/` with body `{title, body, columnId}` creates note and returns 201 + full object
- [ ] AC3: `PUT /api/notes/:id` updates title/body; returns 404 if not found
- [ ] AC4: `DELETE /api/notes/:id` removes note and returns 204
- [ ] AC5: All endpoints tested with automated API tests (no untested code — per PRD AC6)
Dependencies: Story "Epic: Database Schema" above
Estimate: S

---

## Epic: Backend — Move Note Endpoint + Health Check  (maps to PRD requirements: FR3, FR4, FR8)

### Story: POST /notes/:id/move endpoint and health check
As a frontend developer, I want a move-note API so the Kanban board can reassign cards between columns.
Acceptance criteria:
- [ ] AC1: `POST /api/notes/:id/move` with body `{columnId}` updates note's column_id and returns 200
- [ ] AC2: Returns 404 for non-existent note
- [ ] AC3: Returns 400 if `columnId` is missing from request body
- [ ] AC4: Move operation validated with API test
- [ ] AC5: `GET /health` returns `{"status":"ok"}` with HTTP 200
Dependencies: Story "Epic: Database Schema" above
Estimate: S

---

## Epic: Frontend — Board Rendering & Note Creation  (maps to PRD requirements: FR6, AC3)

### Story: Render Kanban board and create notes via frontend
As a user, I want to see all columns with their sticky-note cards so I can view and interact with my todo items.
Acceptance criteria:
- [ ] AC1: Board renders horizontal column layout fetched from `GET /api/columns/`
- [ ] AC2: Each column displays notes as draggable card components fetched from `GET /api/notes/?column_id=:id`
- [ ] AC3: New-note form per column (click "+" button) posts to `POST /api/notes/` and refreshes display
- [ ] AC4: Board auto-refreshes after new note creation
Dependencies: Backend stories above must be implemented first
Estimate: M

---

## Epic: Frontend — Drag-and-Drop, Edit & Delete  (maps to PRD requirements: FR6, AC3)

### Story: Drag-and-drop notes between columns; edit and delete notes in UI
As a user, I want to drag note cards between columns, click to edit them, and delete stale items so my board reflects reality.
Acceptance criteria:
- [ ] AC1: Note cards are draggable (via dnd-kit or equivalent) and drop into other columns
- [ ] AC2: During drag, visual highlight indicates valid drop zones
- [ ] AC3: On drop in a different column, frontend fires `POST /api/notes/:id/move` with new `columnId`
- [ ] AC4: Clicking a card opens inline edit form for title/body; save posts to `PUT /api/notes/:id`
- [ ] AC5: Edit button shows confirmation dialog that posts to `DELETE /api/notes/:id`
Dependencies: Story "Epic: Frontend — Board Rendering" above
Estimate: M

---

## Epic: Containerization & Documentation  (maps to PRD requirements: FR7, FR8, AC4, AC5, G3)

### Story: Docker-compose stack and README with BMAD artifact links
As a developer, I want the full stack running in one `docker-compose up` command so anyone can run the app locally.
Acceptance criteria:
- [ ] AC1: `docker-compose.yml` defines backend service (Go binary), frontend service (Nginx serving SPA), and database service (SQLite or Postgres)
- [ ] AC2: `docker-compose up -d` starts all services with no errors
- [ ] AC3: Board accessible at http://localhost in a browser after compose starts
- [ ] AC4: README documents architecture diagram, local setup steps, test execution commands, and links to all BMAD phase artifacts (this PRD, this backlog, architecture doc)
- [ ] AC5: Backend integration tests run inside container (`go test ./...` succeeds)
Dependencies: All backend and frontend stories must be implemented first
Estimate: S

---

## Epic Map Summary

| # | Epic | Stories | Status |
|---|------|---------|--------|
| 1 | Database Schema & Migrations | 1 (Story: schema migration) | 🔵 Not started |
| 2 | Backend Columns API | 1 (CRUD endpoints + tests) | 🔵 Not started |
| 3 | Backend Notes CRUD API | 1 (CRUD endpoints + tests) | 🔵 Not started |
| 4 | Backend Move Endpoint + Health | 1 (move API + health check) | 🔵 Not started |
| 5 | Frontend Board Rendering & Create | 1 (render board, add notes) | 🔵 Not started |
| 6 | Frontend Drag-Drop-Edit-Delete | 1 (DnD, edit, delete) | 🔵 Not started |
| 7 | Containerization + Docs | 1 (docker-compose, README) | 🔵 Not started |

**Execution order (critical path):** 1 → 2,3,4 (may parallelize) → → 5,6 (sequential due to DnD dependency on board rendering) → 7  
Total estimated scope: S+S+M+M+S = approximately 6-8 hours of dev time for a seasoned coding agent.

---

*Produced by Phase 2 Planning (John/BMAD). Ready for architecture review.*
