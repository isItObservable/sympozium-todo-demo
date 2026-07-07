# PRD: sympozium-todo-demo — Virtual Post-it (Kanban) Board

## Problem

The IsItObservable episode needs a live demo application showing how BMAD multi-agent crews can iteratively build observable software. The team builds this app *through* the BMAD pipeline (Analysis → Planning → Solutioning → Implementation → Review) rather than around it. The real user need is to **demonstrate the BMAD method itself** using a small, relatable Kanban board app where every phase produces observable artifacts and health signals visible throughout the demo.

## Goals (measurable)

- **G1**: Ship an MVP Kanban board supporting CRUD for columns and notes with drag-and-drop column moves — usable via browser at `http://localhost` after `docker-compose up`.
- **G2**: Every feature implemented ticket-driven: one story per PR, each passing adversarial review before merge. No feature without tests.
- **G3**: Full stack runs locally via `docker-compose up` with zero additional setup. PostgreSQL (with SQLite dev parity) is the backing database.
- **G4**: All service boundaries have `/health` and `/readyz` endpoints; structured logging and OTel tracing span every request across the full stack (frontend → backend → DB).
- **G5**: README documents architecture, local setup, test execution, and links to all BMAD phase artifacts so any agent crew can resume work at any phase boundary.

## Non-goals (deferred)

- Authentication / user accounts (single-user demo only)
- Real-time collaboration / WebSocket updates
- Mobile responsiveness (desktop-first MVP)
- Custom themes, note colors, labels, attachments, pagination
- Production deployment beyond local `docker-compose`
- CI/CD pipeline automation (demonstration only)

## Functional Requirements

### FR1 — Columns API
The system MUST support full CRUD for Kanban columns via REST:
- `GET    /api/columns/` — list all columns
- `POST   /api/columns/` — create a column (`{title}`) → 201
- `PUT    /api/columns/:id` — update title → 404 if not found
- `DELETE /api/columns/:id` — delete (cascades to notes)

### FR2 — Notes API
The system MUST support full CRUD for sticky-note cards within columns:
- `GET    /api/notes/?column_id=:id` — list notes (optionally filtered by column)
- `POST   /api/notes/` — create note (`{title, body, columnId}`) → 201
- `PUT    /api/notes/:id` — update title/body → 404 if not found
- `DELETE /api/notes/:id` — delete → 204

### FR3 — Move Notes Between Columns
The system MUST support reassigning a note:
- `POST   /api/notes/:id/move` with body `{columnId}` → 200 (moved notes)
- Returns 404 for non-existent note, 400 if columnId is missing

### FR4 — REST Endpoint Contract + Error Handling
All HTTP endpoints MUST return consistent JSON responses. Errors follow RFC 7807 Problem Details (`type`, `title`, `status`, `detail`, `instance`). Health endpoint returns `{"status":"ok"}` with HTTP 200 (or 503 with dependency-down details).

### FR5 — Database Persistence & Migrations
Data persists in a relational database. SQLite for local dev, PostgreSQL via `DATABASE_URL` env var swap at zero code change cost. Schema:
- **columns**: id (UUID), board_scope (varchar), title (varchar), created_at, updated_at
- **notes**: id (UUID), column_id (FK → columns.id), title (varchar), body (text, nullable), created_at, updated_at

### FR6 — Frontend — Single-Page Board View
The frontend MUST render columns and notes as draggable sticky-card components. Users can:
- View all columns and their notes horizontally
- Create new notes inline per column
- Drag-and-drop cards between columns (via dnd-kit CDN)
- Click cards to edit title/body inline

### FR7 — Containerization & Local Stack
Each service (backend, database, frontend) MUST be containerized. A `docker-compose.yml` at project root starts the full stack with one command.

### FR8 — Observability & Testability
The backend MUST include:
- OpenTelemetry auto-instrumentation for tracing + metrics + logging
- Liveness (`/livez`) and readiness (`/readyz`) probes
- Tests covering all CRUD endpoints; untested code not merged
- README documenting test execution

## Acceptance Criteria (binding)

- [ ] **AC1**: User opens browser at http://localhost, sees a Kanban board with three default columns. Board is rendered via API calls — no static HTML content for column data.
- [ ] **AC2**: User can create a note via UI (+ button per column), type a title and body, click save → POST `POST /api/notes/` returns 201; the card appears on the board immediately without page reload.
- [ ] **AC3**: User can drag a note card from one column to another. Backend responds to `POST /api/notes/:id/move` with correct status; UI updates visually to reflect the move.
- [ ] **AC4**: All CRUD endpoints (FR1–FR3) return valid JSON with proper HTTP status codes; errors follow RFC 7807 format. Verified by automated API tests.
- [ ] **AC5**: `GET /health` returns `{"status":"ok"}` (HTTP 200); `GET /readyz` returns HTTP 200 when DB connection is valid, 503 when it is not.
- [ ] **AC6**: `docker-compose up` starts the full stack; board accessible at http://localhost without manual intervention beyond that one command.
- [ ] **AC7**: README includes architecture diagram, local setup steps, test execution instructions, and links to all BMAD phase artifacts (this PRD, epics/stories doc, architecture doc).

## Risks & Open Questions

| Risk | Impact | Mitigation |
|------|--------|-----------|
| "Just another Kanban app" — no competitive differentiation | Low; this is a method demo | Accept and document upfront. The BMAD process *is* the value proposition. |
| Scope creep (auth, collaboration, real-time) | Medium | Strict non-goals list enforced during adversarial review |
| Frontend drag-and-drop complexity | Medium | dnd-kit via CDN — use a mature library; do not roll custom DnD logic |
| SQLite ↔ PostgreSQL compatibility across migrations | Medium | Test against both DBs in CI before any branch merge |
| UUID generation cross-DB portability (gen_random_uuid vs uuid_generate_v4) | High | Generate UUIDs in Go code, NOT rely on DB defaults |

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Backend: Go stdlib `net/http` | Boring tech, ~20MB container, built-in tracing via otelcontribco/otel-go-contrib |
| Frontend: vanilla HTML/CSS/JS + dnd-kit CDN | No build step, no npm/webpack — demonstrates that BMAD works without framework lock-in |
| Database: PostgreSQL prod / SQLite dev parity via DATABASE_URL | Single binary change (driver swap), migration files identical for both |
| Migration tool: golang-migrate | Simple, SQL-based, one file per migration |
| Observability: OpenTelemetry Collector sidecar pattern | Zero code changes in app instrumentation; spans → Jaeger/Tempo, metrics → Prometheus |

---

*Produced by Phase 2 Planning (John/BMAD). Consolidates `docs/prd.md` and `docs/prd.todo-board.md`.*
*Ready for architecture review and story-writer handoff. See PR #17.*
