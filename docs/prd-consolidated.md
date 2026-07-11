# PRD: sympozium-todo-demo — Virtual Post-it (Kanban) Board

> **Phase:** BMAD Phase 2 — Planning  
> **Owner:** John (BMAD Planning/PM)  
> **Status:** 🟡 CONSOLIDATED (PR #25, pending merge)  
> **Aligned to ADRs:** ADR-001 through ADR-012 (locked decisions in Phase 3 architecture)

---

## Problem

The IsItObservable team needs a live-demo Kanban / virtual post-it board application to showcase the BMAD development methodology in action. This app is both a product demo and a teaching vehicle — it must be small enough to build through the full BMAD pipeline (Analysis → Planning → Solutioning → Implementation → Review) while being observable, testable, and easily deployable locally via Docker Compose.

**The real user need:** Demonstrate BMAD end-to-end on a concrete product with clean telemetry showing each phase's deliverables — not build another Kanban tool. The BMAD process *is* the value proposition.

---

## Goals (measurable)

- **G1**: Ship an MVP Kanban board supporting full CRUD for columns and notes with drag-and-drop column moves — viewable via browser at `http://localhost` after a single `docker-compose up`.
- **G2**: Every feature implemented ticket-driven: one story per PR, each passing adversarial review before merge. No untested code merged.
- **G3**: Full stack (backend + database + frontend) runs locally via `docker-compose up` with zero additional setup. SQLite for dev, PostgreSQL via `DATABASE_URL` swap at zero code change cost.
- **G4**: Every request spans OpenTelemetry tracing from browser through backend to DB. Health (`/livez`), readiness (`/readyz`) probes return proper status codes. Prometheus metrics scraped for latency/count.
- **G5**: README documents architecture, local setup, test execution commands, and links to all BMAD phase artifacts so any agent crew can resume work at any phase boundary.

---

## Non-goals (deferred)

- Authentication / multi-user accounts (single-user demo only)
- Real-time collaboration / WebSocket / SSE updates
- Mobile responsiveness (desktop-first MVP)
- Custom themes, note colors, labels, attachments, pagination
- Production deployment beyond local `docker-compose`
- CI/CD pipeline automation (demonstration project only)
- Undo / redo on moves or edits

---

## Functional Requirements

### FR1 — Columns API (CRUD)

The system MUST support full CRUD for Kanban columns via REST, as defined in **ADR-002**:

| Method | Endpoint | Request Body | Status codes |
|--------|----------|-------------|--------------|
| `GET`    | `/api/columns/` | — | 200 → JSON array (empty = `[]`) |
| `POST`   | `/api/columns/` | `{ "title": string }` | 201 → created object; 400 on validation error (RFC 7807) |
| `PUT`    | `/api/columns/:id` | `{ "title": string }` | 200 → updated object; 404 if not found; 400 |
| `DELETE` | `/api/columns/:id` | — | 204 (no body) on success; 404 if not found |

Columns have: `id` (UUID, Go-generated per ADR-012), `title`, `board_scope`, `created_at`, `updated_at`.

### FR2 — Notes API (CRUD)

The system MUST support full CRUD for sticky-note cards within columns, as defined in **ADR-002**:

| Method | Endpoint | Request Body | Status codes |
|--------|----------|-------------|--------------|
| `GET`    | `/api/notes/?column_id=:id` | Optional filter | 200 → JSON array sorted to show newest first |
| `POST`   | `/api/notes/` | `{ "title": string, "body": string|null, "columnId": UUID }` | 201 → created object; 400 if columnId missing or empty title |
| `PUT`    | `/api/notes/:id` | `{ "title": string?, "body": string? }` | 200 → updated object (partial update); 404 if not found |
| `DELETE` | `/api/notes/:id` | — | 204 on success; 404 if not found |

Notes have: `id` (UUID, Go-generated per ADR-012), `column_id` (FK → columns.id), `title`, `body` (nullable text), `created_at`, `updated_at`.

### FR3 — Move Notes Between Columns

The system MUST support reassigning a note to a different column:

| Method | Endpoint | Request Body | Status codes |
|--------|----------|-------------|--------------|
| `POST` | `/api/notes/:id/move` | `{ "columnId": UUID }` | 200 → updated object; 404 if note not found or column doesn't exist; 400 if body missing |

### FR4 — REST Endpoint Contract + Error Handling

All HTTP endpoints MUST return consistent JSON responses. Errors follow **RFC 7807 Problem Details** per **ADR-011**:

```json
{
  "type":   "https://example.com/errors/not-found",
  "title":  "Column not found",
  "status": 404,
  "detail": "No column with id a1b2c3...",
  "instance": "/api/columns/a1b2c3..."
}
```

### FR5 — Database Persistence & Migrations

Per **ADR-003** and **ADR-003-B**:

| Table | Columns | Constraints |
|-------|---------|-------------|
| `columns` | `id` (UUID), `board_scope` (varchar 255, default `'default'`), `title` (varchar 255), `created_at`, `updated_at` | PK on `id`; index on `board_scope` |
| `notes` | `id` (UUID), `column_id` (FK → columns.id onDelete cascade), `title` (varchar 255), `body` (text nullable), `created_at`, `updated_at` | FK enforces column existence; index `idx_notes_column_id` on `column_id` |

- UUIDs generated in Go via `crypto/rand` or `google/uuid` per **ADR-012** (NOT database defaults like `gen_random_uuid()` or `uuid_generate_v4()`)
- SQLite for local dev, PostgreSQL for staging — migrations identical for both engines (tested by TB-S01 AC3)

### FR6 — Frontend — Single-Page Board View

Per **ADR-001** and **ADR-007**:

- The frontend is vanilla HTML/CSS/JS (no build step, no npm) served via `dnd-kit` CDN for drag-and-drop
- Backend statically serves the SPA per **ADR-010** (all three tiers — frontend, API, DB — in one Go binary + docker-compose stack)
- Users can:
  - View all columns and their notes horizontally (flexbox layout)
  - Create new notes inline per column (+ button per column header)
  - Drag-and-drop cards between columns (dnd-kit CDN)
  - Click cards to edit title/body inline

### FR7 — Containerization & Local Stack

Per **ADR-006** and **ADR-010**:

- Single Go binary serves frontend SPA files *and* REST API on one port
- `docker-compose.yml` at project root starts the full stack (Go app + PostgreSQL, SQLite dev mode)
- `docker-compose up` requires zero manual intervention to get board accessible at `http://localhost`

### FR8 — Observability & Testability

Per **ADR-005** (Three-Pillar Design):

| Pillar | What it provides | How verified |
|--------|------------------|--------------|
| Health Probes | `/livez` (liveness: 200 or 503), `/readyz` (readiness: db connection healthy?) | TB-S04 AC5, OBE-S02 AC1-AC4 |
| Structured Logging | Log lines include trace ID correlation (W3C TraceContext) | OBE-S04 |
| OpenTelemetry Request Tracing | Spans from browser → Go HTTP handler → DB query for every request | OBE-S01 + OBE-S03 + OBE-S06 |
| Prometheus Metrics | Latency histogram, request count — scraped by collector | OBE-S05 |
| Tests (all CRUD) | Every story has automated tests; no untested code merges | TB-S02 AC5, TB-S03 AC5, OBE-EPIC tests |

---

## Acceptance Criteria (binding)

- [ ] **AC1**: User opens browser at `http://localhost`, sees a Kanban board with three default columns. Board is rendered via API calls — no static HTML content for column data.
- [ ] **AC2**: User can create a note via UI (+ button per column), type title and body, click save → POST `/api/notes/` returns 201; the card appears on the board immediately without page reload.
- [ ] **AC3**: User can drag a note card from one column to another. Backend responds to `POST /api/notes/:id/move` with correct status; UI updates visually.
- [ ] **AC4**: All CRUD endpoints (FR1–FR3) return valid JSON with proper HTTP status codes; errors follow RFC 7807 format (ADR-011). Verified by automated API tests.
- [ ] **AC5**: `GET /livez` returns healthy/unhealthy based on store access; `GET /readyz` returns 200 when DB connection is valid, 503 when not. Both return proper status codes (OBE-S02).
- [ ] **AC6**: `docker-compose up` starts the full stack; board accessible at `http://localhost` without manual intervention.
- [ ] **AC7**: README includes architecture diagram, local setup steps, test execution instructions, and links to all BMAD phase artifacts (this PRD, epics/stories doc, architecture doc ADR-001–ADR-012).

---

## Risks & Open Questions

| Risk | Impact | Mitigation |
|------|--------|-----------|
| "Just another Kanban app" — no competitive differentiation | Low; this is a method demo | Accept and document upfront. The BMAD process *is* the value proposition. |
| Scope creep (auth, collaboration, real-time) | Medium | Strict non-goals list enforced during adversarial review — any PR introducing features outside scope rejected immediately. |
| Frontend drag-and-drop complexity | Medium | Use `dnd-kit` via CDN per ADR-007; do not roll custom DnD logic. |
| SQLite ↔ PostgreSQL compatibility across migrations | Medium | TB-S01 AC3 tests both engines explicitly; TB-S07 AC5.6 validates parity end-to-end. |
| UUID generation cross-DB portability (gen_random_uuid vs uuid_generate_v4) | High | Generate UUIDs in Go code per ADR-012, NOT rely on DB defaults. |

---

## Locked Technology Decisions (from Phase 3 Architecture — do not revise)

Per BMAD rules, Phase 3 architecture decisions are **locked**. Any implementation must respect these:

| Decision | ADR Reference | What it means for coding |
|----------|---------------|-------------------------|
| Backend: **Go stdlib `net/http`** (NOT Fiber, NOT Gin, NOT Node) | ADR-001 | No third-party router framework — `http.HandleFunc`, or a minimal `mux` package only if absolutely necessary. Tracing via `otelcontribco/otel-go-contrib`. |
| Frontend: **vanilla HTML/CSS/JS** (NOT React, NOT SolidJS, NOT Vue) | ADR-001 | No build step, no npm/webpack/deno — just `.html` / `.css` / `.js` files. |
| Drag-and-drop: **dnd-kit via CDN** (NOT custom implementation) | ADR-007 | Use `<script>` import from unpkg.com with explicit version pinning. |
| Database: **PostgreSQL prod / SQLite dev**, single migration set | ADR-003 | `DATABASE_URL` env var; one driver swap in Go code (no schema changes). |
| Project structure: **flat layout** | ADR-004 | No nested sub-packages — `cmd/server`, `internal/`, etc. on a flat hierarchy. |
| Observability: **Three-Pillar Design** | ADR-005 | Health Probes + Structured Logging + OTel Request Tracing are not optional — every endpoint must produce spans and structured logs with trace ID. |
| Deployment: **backend serves SPA; docker-compose only** | ADR-006, ADR-010 | One Go process serves static frontend AND API. No Nginx container. Kubernetes manifests are stretch. |
| UUIDs: **application-generated in Go** | ADR-012 | `crypto/rand` or `google/uuid` — never rely on DB default functions like `gen_random_uuid()` / `uuid_generate_v4()`. |
| Error format: **RFC 7807 Problem Details struct** | ADR-011 | Consistent error envelope across all endpoints — not ad-hoc. |

---

## Open Questions (to hand into Phase 3+5)

1. **Health probe naming**: Should we standardize on Kubernetes probe names (`/livez`, `/readyz`) or HTTP-level names (`/health`)? ADR-009 recommends K8s probe names + one legacy alias. *(Resolved in ADR-009: three endpoints — `/livez`, `/readyz`, and `/health` as a legacy alias to `/livez`.)*
2. **Initial seed data**: When does the default "To Do / Doing / Done" columns get created? During migration or on first app start? *(Resolved in ADR-008: seed on first migration run + API fallback for post-migration re-initialization.)*
3. **Maximum note body length**: Is there a practical limit on `body` text size that PostgreSQL's `text` type doesn't enforce but the UI should warn about? *(Open — coding agent to add reasonable frontend max (e.g., 5000 chars) with soft warning at 4000.)*

---

*Produced by Phase 2 Planning (John/BMAD). This PRD consolidates `docs/prd.md`, `docs/PRD.md`, and `docs/prd.todo-board.md` into ONE canonical source of truth, aligned to locked ADR-001 through ADR-012 decisions.*  
*Ready for Phase 5 Implementation. See PR #25.*
