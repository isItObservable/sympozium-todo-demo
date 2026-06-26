# PRD: Sympozium Todo Demo Board App

## Problem

The IsItObservable team needs a live-demo Kanban / virtual post-it board application that showcases the BMAD development methodology in action. The app is both a product demo and a teaching vehicle — it must be small enough to build quickly through the full BMAD pipeline while being observable, testable, and deployable.

**The real user need:** Demonstrate BMAD end-to-end (analysis → PRD → architecture → epics/stories → implementation → review) on a concrete product, with clean telemetry showing each phase's deliverables.

## Goals (measurable)

- **G1:** Ship an MVP Kanban board that supports CRUD for columns and notes, with drag-and-drop column moves, in ≤ 2 days of dev time.
- **G2:** Every feature must have tests that cover all acceptance criteria — no untested code.
- **G3:** Stack runs locally via `docker-compose` with a single command.
- **G4:** README documents the architecture, local setup, and BMAD phase artifacts so any agent team can resume work at any phase boundary.

## Non-goals (deferred)

- Authentication / multi-user collaboration
- Real-time sync between clients (WebSocket/SSE)
- Mobile responsiveness (desktop-first MVP)
- Custom themes, note colors, labels, attachments
- Pagination for large boards
- Persistent undo/redo
- Production deployment beyond local `docker-compose`

## Functional Requirements

### FR1: Columns — The Kanban Board Structure
The system MUST support multiple columns (at minimum: "To Do", "Doing", "Done") that a user can create, rename, and delete. Columns are board-scoped.

### FR2: Notes — Sticky-Card Entity
The system MUST allow creating, editing (title + body), and deleting sticky-note cards within a column. Each note has a unique ID, column reference, title, body text, and timestamps.

### FR3: Move Notes Between Columns
The system MUST support reassigning a note from one column to another (API endpoint `POST /notes/:id/move` with `columnId` parameter). This is the core "Kanban" behavior.

### FR4: REST Endpoint Contract
- `GET    /api/columns/` — list all columns
- `POST   /api/columns/` — create a column (body: `{title}`)
- `PUT    /api/columns/:id` — update a column title
- `DELETE /api/columns/:id` — delete a column (cascades notes or moves them)
- `GET    /api/notes/?column_id=:id` — list notes filtered by column
- `POST   /api/notes/` — create a note (body: `{title, body, columnId}`)
- `PUT    /api/notes/:id` — update a note
- `DELETE /api/notes/:id` — delete a note
- `POST   /api/notes/:id/move` — move note to different column (`{columnId}`)
- `GET    /health` — health check returning `{"status":"ok"}`

### FR5: Database Persistence
The system MUST persist columns, notes, and their associations in a relational database using migrations. SQLite is chosen for local-dev simplicity; Postgres is supported with zero code changes via a connection string swap (standard `DATABASE_URL` env var).

### FR6: Frontend — Single-Page Board View
The frontend MUST render a horizontal Kanban board showing all columns and their notes as draggable cards. Users can:
- Create new notes inline per column
- Drag-and-drop note cards between columns
- Click to edit a note's title/body
- Delete notes from within the card editor

### FR7: Containerization & Local Stack
Each service (backend, database, frontend) MUST be containerized. A `docker-compose.yml` at the project root starts the full stack with one command.

### FR8: Observability & Testability
The backend MUST include an integrated test suite (unit + integration) covering all CRUD and move operations. The README MUST describe how to run tests locally.

## Acceptance Criteria (binding)

- [ ] **AC1:** Backend exposes all endpoints listed in FR4 with correct HTTP methods and status codes, verified by automated API tests (`curl` or client test harness).
- [ ] **AC2:** Database migrations create the required tables (columns, notes) and run successfully on both SQLite and Postgres.
- [ ] **AC3:** Frontend renders columns and notes, and all create/move/delete actions in the UI successfully update data via the API.
- [ ] **AC4:** `docker-compose up` starts the full stack (frontend proxy + backend + database) and the board is accessible at `http://localhost`.
- [ ] **AC5:** README documents architecture, local setup steps, test execution, and links to BMAD phase artifacts.
- [ ] **AC6:** Every PR that delivers a feature includes tests for all its acceptance criteria; untested code will not be merged.

## Risks & Open Questions
| Risk | Mitigation |
|------|-----------|
| "Just another Kanban app" — no competitive differentiation | The value is the BMAD process, not product novelty. This is a demo, not a startup. Accept this upfront. |
| Scope creep (auth, collaboration, real-time) | Strict non-goals list. PM enforces during review — any PR with feature creep is rejected immediately. |
| Frontend drag-and-drop complexity | Use `dnd-kit` or equivalent mature library. Do not roll custom DnD logic. |
| SQLite → Postgres compatibility issues early on | Start with SQLite, write integration tests against both databases in CI before any production push. |

## Technology Choices (non-binding — architect may revise)
- Backend: Go (fiber) — fast iteration, simple deployment as single binary
- Database: SQLite (dev) / PostgreSQL (prod), connected via `DATABASE_URL`
- Frontend: SolidJS + TypeScript, served via Nginx; drag-and-drop via `dnd-kit`
- Containerization: Docker Compose for local dev; deployable to Kubernetes

---

*Produced by Phase 2 Planning (John/BMAD). Approved for architecture handoff.*
*See issue #1 on isItObservable/sympozium-todo-demo for source context.*
