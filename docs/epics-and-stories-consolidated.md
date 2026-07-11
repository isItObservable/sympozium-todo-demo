# Epics & Stories — Sympozium Todo Board (Consolidated)

> **Phase:** BMAD Phase 4 — Epics & Stories  
> **Owner:** John (BMAD Planning/PM)  
> **Status:** 🟡 CONSOLIDATED (PR #25, pending merge)  
> **Source PRD:** `docs/prd-consolidated.md` (PR #25)  
> **Trace to Architecture:** ADR-001 through ADR-012

This artifact consolidates the previously disparate epics and individual story files from:
- `docs/epics-and-stories.md` (Phase 4 consolidated backlog)
- `docs/epics-and-stories.todo-board.md` (todo-board-specific epics)
- `docs/epics-and-stories.observability.md` (observability epics)
- `docs/stories/todo-board/story-TB-S*.md` (7 individual stories)
- `docs/stories/observability/story-OBE-S*.md` (6 individual stories)

**All 13 stories are preserved in full with their original acceptance criteria. This document is the single source of truth for Phase 5 implementation.**

---

## Epic: Foundation — Database Schema & Migrations (TB-EPIC-D)
> **Maps to PRD Requirements:** FR5, AC6  
> **Locked by ADR References:** ADR-003 (DB choice), ADR-003-B (schema/v1 migration), ADR-012 (UUID generation in Go)

### Story: TB-S01 — Database Schema and Migration Infrastructure

**As a** developer, **I want** database migrations that create `columns` and `notes` tables with full up/down support, so the application can persist board data across SQLite (dev) and PostgreSQL (prod).

> **Maps to PRD:** FR5 (PostgreSQL/SQLite parity via DATABASE_URL), ADR-012 (UUIDs in Go)  
> **Acceptance linkage:** Required before any CRUD story. Gaps in this epic cascade into feature failures.

**Acceptance criteria:**
- [ ] AC1: Migration creates `columns` table with id (UUID, Go-generated), title (varchar 255), board_scope (varchar 255 default 'default'), created_at, updated_at
- [ ] AC2: Migration creates `notes` table with id (UUID, Go-generated), column_id (FK → columns.id onDelete cascade), title (varchar 255), body (text nullable), created_at, updated_at
- [ ] AC3: Index on `idx_notes_column_id` for query performance
- [ ] AC4: Migration runs successfully on both SQLite file and PostgreSQL container with identical table structure
- [ ] AC5: Down-migration drops tables safely without errors

**Dependencies:** None (feature-critical path first)  
**Estimate:** S

---

## Epic: Foundation — Observability SDK & Probes (OBE-EPIC-F)
> **Maps to PRD Requirements:** G4, FR8, AC5  
> **Locked by ADR References:** ADR-005 (Three-Pillar Design), ADR-009 (probe naming), ADR-002 (endpoint contract)

### Story: OBE-S01 — Set Up OpenTelemetry Auto-Instrumentation for the Entire Stack

**As a** DevOps / SRE engineer,  
**I want** automatic tracing, metrics, and logging from OTel Collector — no code changes required in business logic —  
**So that** I get observability coverage immediately.

| AC | Criteria |
|----|----------|
| [ ] AC1 | OTel SDK initialized with all three signal pipelines: traces → Jaeger (grpc), metrics → Prometheus remote write, logs → stdout |
| [ ] AC2 | Resource detectors detect service.name, deployment.environment from env vars automatically |
| [ ] AC3 | Semantic Conventions v1.20+ used across all spans |
| [ ] AC4 | OTel config validated (no cardinality warnings) |

**Dependencies:** None  
**Estimate:** S

### Story: OBE-S02 — Define Health Probe Endpoints (/livez, /readyz)

**As a** platform operator, **I want** liveness and readiness check endpoints on every service instance, so I can distinguish infra failures from app-level degradation.

| AC | Criteria |
|----|----------|
| [ ] AC1 | `/livez` returns 200 when the process is alive; returns 503 if underlying store unreachable |
| [ ] AC2 | `/readyz` returns 200 when DB connection pool is healthy; returns 503 when not |
| [ ] AC3 | Both endpoints return proper JSON bodies: `{"status":"live"}` and `{"status":"ready","database":"ok/up"}` |
| [ ] AC4 | Tested under both SQLite (healthy + file-deleted) and PostgreSQL (container up + container down) |

**Dependencies:** TB-S01  
**Estimate:** S

---

## Epic: Backend — Columns CRUD API (TB-EPIC-1)
> **Maps to PRD Requirements:** FR1, FR4, AC4  
> **Locked by ADR References:** ADR-002 (RESTful contract), ADR-011 (RFC 7807 errors), ADR-012 (UUIDs)

### Story: TB-S02 — REST Columns Endpoints with Tests

**As a** backend developer, **I want** full CRUD operations on the columns API so the Kanban frontend can display lanes and users can manage them.

> **Maps to PRD:** FR1 (columns CRUD endpoints), FR4 (consistent JSON + RFC 7807 errors)  
> **Acceptance linkage:** AC4 endpoint consistency tested via automated API tests; AC6 board rendering needs this first.

| AC | Criteria |
|----|----------|
| [ ] AC1 | `GET /api/columns/` returns JSON array of column objects (id, title, board_scope) with HTTP 200 |
| [ ] AC2 | `POST /api/columns/` with `{title}` creates a column; returns 201 + created object |
| [ ] AC3 | `PUT /api/columns/:id` updates title; returns 404 if not found; RFC 7807 error otherwise |
| [ ] AC4 | `DELETE /api/columns/:id` deletes column (cascades notes); returns 204 on success |
| [ ] AC5 | All endpoints tested with automated API tests; errors follow RFC 7807 format (ADR-011) |

**Dependencies:** TB-S01  
**Estimate:** S

---

## Epic: Backend — Notes CRUD API (TB-EPIC-2)
> **Maps to PRD Requirements:** FR2, FR4, AC4  
> **Locked by ADR References:** ADR-002, ADR-011, ADR-012

### Story: TB-S03 — REST Notes Endpoints with Tests

**As a** backend developer, **I want** full CRUD operations on the notes API so users can create, edit, and delete sticky notes in their Kanban columns.

> **Maps to PRD:** FR2 (notes CRUD), FR4 (consistent JSON responses)  
> **Acceptance linkage:** AC4 endpoint consistency plus AC2 UI needs note creation.

| AC | Criteria |
|----|----------|
| [ ] AC1 | `GET /api/notes/?column_id=:id` returns filtered notes array (or all if no filter); sorted newest first |
| [ ] AC2 | `POST /api/notes/` with `{title, body, columnId}` creates note; returns 201 + full object |
| [ ] AC3 | `PUT /api/notes/:id` partially updates title/body; returns 404 if not found; RFC 7807 for validation errors |
| [ ] AC4 | `DELETE /api/notes/:id` removes note; returns 204 on success |
| [ ] AC5 | All endpoints tested with automated API tests; errors follow RFC 7807 format (ADR-011) |

**Dependencies:** TB-S01  
**Estimate:** S

---

## Epic: Backend — Move Endpoint + Health Check (TB-EPIC-3)
> **Maps to PRD Requirements:** FR3, AC5  
> **Locked by ADR References:** ADR-002 (move endpoint), ADR-011 (errors), ADR-009 (/livez, /readyz)

### Story: TB-S04 — POST /notes/:id/move Endpoint + Health Probe Alias

**As a** user, **I want** to reassign notes between columns AND have a health endpoint, so the Kanban board can display column moves and Docker/K8s can monitor service availability.

> **Maps to PRD:** FR3 (move notes), AC5 (health probe)  
> **Acceptance linkage:** Directly implements AC3 move cards in UI and AC5 health probe requirement.

| AC | Criteria |
|----|----------|
| [ ] AC1 | `POST /api/notes/:id/move` with `{columnId}` updates note's `column_id` and returns 200 + updated object |
| [ ] AC2 | Returns 404 for non-existent note ID |
| [ ] AC3 | Returns 400 if columnId is missing from request body; RFC 7807 error envelope |
| [ ] AC4 | Move operation validated with API test; FK constraint ensures column exists (or returns 404) |
| [ ] AC5 | `GET /health` returns `{"status":"ok"}` with HTTP 200 when process is alive (alias to `/livez` per ADR-009) |

**Dependencies:** TB-S01  
**Estimate:** S

---

## Epic: Frontend — Board Rendering (TB-EPIC-4, Part 1)
> **Maps to PRD Requirements:** FR6, AC1, G1  
> **Locked by ADR References:** ADR-001 (vanilla HTML/CSS/JS), ADR-010 (backend serves SPA)

### Story: TB-S05 — Render Kanban Board UI and Create Notes via Frontend

**As a** user, **I want** to see all columns with their sticky-note cards displayed in a horizontal Kanban layout so I can view and manage my todo items.

> **Maps to PRD:** FR6 (Frontend SPA), AC1 (board shows defaults)  
> **Acceptance linkage:** First frontend story; depends on all backend CRUD endpoints being live.

| AC | Criteria |
|----|----------|
| [ ] AC1 | Browser at `/` renders a horizontal flexbox row showing ALL columns fetched via `GET /api/columns/` (no static HTML content) |
| [ ] AC2 | Each column header shows its title; each note card displays title as heading and body as summary text |
| [ ] AC3 | The page fetches data from the backend API on load — no hardcoded columns or notes in JavaScript |
| [ ] AC4 | "Add Note" button in each column header posts `POST /api/notes/` with `{title, body, columnId}` and creates a card inline (no page reload) |

**Dependencies:** TB-S02 + TB-S03  
**Estimate:** M

---

## Epic: Frontend — Drag-and-Drop, Edit & Delete (TB-EPIC-4, Part 2)
> **Maps to PRD Requirements:** FR6, AC3  
> **Locked by ADR References:** ADR-007 (dnd-kit CDN), ADR-001 (HTML/CSS/JS)

### Story: TB-S06 — Drag-and-Drop Notes Between Columns, Inline Edit & Delete

**As a** user, **I want** to drag note cards between columns, click cards to edit title/body inline, and delete stale notes, so my board reflects real task management.

> **Maps to PRD:** FR6 (draggable cards per ADR-007), AC3 (all create/move/delete in UI)  
> **Acceptance linkage:** The core Kanban interaction — DnD is the feature that makes this a "Kanban board" not just a todo list.

| AC | Criteria |
|----|----------|
| [ ] AC1 | Note cards are draggable between columns using dnd-kit via CDN; visual highlight on valid drop zones |
| [ ] AC2 | Dropping a card into a column calls `POST /api/notes/:id/move` with `{columnId}` — UI updates to reflect the move |
| [ ] AC3 | Clicking a card opens an inline editor (contenteditable or form); editing title/body and saving calls `PUT /api/notes/:id` |
| [ ] AC4 | A delete button on the card calls `DELETE /api/notes/:id` — card disappears from DOM after 204 response |
| [ ] AC5 | All DnD interactions show brief visual feedback (opacity + shadow) while dragging; no page re-render mid-drag |

**Dependencies:** TB-S05  
**Estimate:** M

---

## Epic: Containerization, Tests & Documentation (TB-EPIC-C)
> **Maps to PRD Requirements:** FR7, FR8, FR6 (via ADR-010), G3, AC6, AC7

### Story: TB-S07 — Docker-Compose Stack, Backend Serves SPA + README with BMAD Links

**As a** user or reviewer, **I want** the full stack to start with one `docker-compose up` command and documented in a README linking to all BMAD artifacts, so anyone can run, test, and audit this project from zero.

> **Maps to PRD:** FR7 (containerization), FR8 (test docs), AC6 (docker-compose works), AC7 (README + BMAD links), ADR-010 (backend serves SPA)  
> **Acceptance linkage:** Must be merged last — it depends on all features being in the codebase.

| AC | Criteria |
|----|----------|
| [ ] AC1 | `docker-compose.yml` at project root defines the Go backend (static SPA served from ADR-004 flat structure) and PostgreSQL service |
| [ ] AC2 | Running `docker-compose up` starts services with no errors; board is accessible at `http://localhost` within 30s |
| [ ] AC3 | Health endpoint `curl localhost:<port>/health` returns `{"status":"ok"}` after stack stabilizes |
| [ ] AC4 | `README.md` includes all 6 sections: architecture diagram, local setup steps, API reference (FR1–FR8 endpoints), test execution commands, observability overview, and links to BMAD artifacts |
| [ ] AC5 | SQLite dev parity confirmed by running migrations + exercising one CRUD cycle against both engines |
| [ ] AC6 | All 13 stories' tests pass (`go test ./...`) on both SQLite and PostgreSQL before merge |

**Dependencies:** TB-S02 + TB-S03 + TB-S04 + TB-S05 + TB-S06 + OBE-S02 (all backend + frontend must be in the repo first)  
**Estimate:** S — L (depends on size of all completed features' test suites)

---

## Epic: Observability Deep-Dive (OBE-EPIC-3)
> **Maps to PRD Requirements:** G4, FR8  
> **Locked by ADR References:** ADR-005 (Three-Pillar Design), ADR-010 (single-process serving)

### Story: OBE-S03 — CRUD Span Tracing + Attribute Tagging

**As a** developer observant of the system, **I want** OpenTelemetry spans created for every CRUD API request, tagged with HTTP method, URL path, and DB query details, so I can trace requests end-to-end.

| AC | Criteria |
|----|----------|
| [ ] AC1 | Every `GET/POST/PUT/DELETE` of columns and notes creates an OTel http.server span |
| [ ] AC2 | Span attributes include `http.method`, `http.url`, `db.system`, `db.statement` (SQL), `component` value |
| [ ] AC3 | Trace propagates W3C TraceContext across the request chain (browser → Go server → DB) |
| [ ] AC4 | Spans visible in Jaeger with correct parent-child relationships |

**Dependencies:** TB-S01 + OBE-S01  
**Estimate:** M

### Story: OBE-S04 — Structured Logging with Trace ID Correlation

**As a** platform operator, **I want** every log line to include the trace ID from the request context, so I can correlate logs with specific API calls in Jaeger.

| AC | Criteria |
|----|----------|
| [ ] AC1 | Structured log lines contain `"trace_id"` field matching the OTel span's trace ID |
| [ ] AC2 | Log levels used appropriately: DEBUG for request start/end, INFO for CRUD operations, ERROR for failures |
| [ ] AC3 | Logs emitted by all CRUD endpoints (TB-S02, TB-S03, TB-S04) demonstrate consistent formatting |

**Dependencies:** TB-S01 + OBE-S01  
**Estimate:** M

### Story: OBE-S05 — Prometheus Metrics Export

**As a** platform operator, **I want** latency histograms and request-count counters for all API endpoints exported to Prometheus, so I can chart performance over time.

| AC | Criteria |
|----|----------|
| [ ] AC1 | `http_request_duration_seconds` histogram with `handler` label for each CRUD endpoint |
| [ ] AC2 | `http_request_total` counter with `method`, `status` labels |
| [ ] AC3 | Metrics scrape successfully on `/metrics` endpoint at standard Prometheus port (9090) |
| [ ] AC4 | Cardinality within budget: no high-cardinality labels (e.g., UUID IDs) attached to metrics |

**Dependencies:** TB-S01 + TB-S02 + TB-S03 + TB-S04 + OBE-S03  
**Estimate:** M

### Story: OBE-S06 — Span Validation Script

**As a** tester, **I want** an automated validation script that exercises all CRUD endpoints and confirms valid spans and metrics exist in the tracing/metrics backends, so I can verify observability is complete before any PR merges.

| AC | Criteria |
|----|----------|
| [ ] AC1 | Script exercises every CRUD endpoint (TB-S02 + TB-S03 + TB-S04 endpoints) with realistic payloads |
| [ ] AC2 | Queries Jaeger for spans produced during testing; confirms at least one trace per HTTP method used |
| [ ] AC3 | Queries Prometheus `/metrics` for non-zero `http_request_duration_seconds_bucket` counts per handler |
| [ ] AC4 | Script exits 0 only if all checks pass (CI gate) |

**Dependencies:** OBE-S03 + OBE-S05  
**Estimate:** S

---

## Critical Path Execution Order

```
Phase 1: Foundational (parallel, no deps)
├── TB-S01 (DB migrations)
└── OBE-S01 (OTel SDK init)

Phase 2: Backend CRUD + Health Probes (after Phase 1)
├── TB-S02 (Columns CRUD)     ─┐
├── TB-S03 (Notes CRUD)       ├── Phase 2 (all parallel)
├── TB-S04 (Move + /health)   ─┘
└── OBE-S02 (Probes)          ── depends on TB-S01

Phase 3: Frontend (after all Phase 2 merged)
├── TB-S05 (Board rendering)  ── needs TB-S02 + S03
├── OBE-S03 (CRUD tracing)    ── needs TB-S01 + OBE-S01
└── OBE-S05 (Prometheus)      ── needs TB-S01+S04 + OBE-S03

Phase 4: DnD / Edit / Delete (after S5)
├── TB-S06 (DnD, edit, delete) — needs TB-S05
└── OBE-S04 (Structured logs)   — parallel with OBE-S05/S5 area

Phase 5: Validation + Release
├── OBE-S06 (span validation)  — after OBE-S03 + OBE-S05
└── TB-S07 (compose + README)  — needs ALL stories merged
```

**Critical path:** `TB-S01 → (S2/S3/S4/OBE-S02 in parallel) → S5 → S6 → TBS07`  
**Observability parallel track:** `OBE-S01 → OBE-S03+OBE-S05 (after migrations) → OBE-S06`

---

## PRD Traceability Overview

| PRD Requirement | Story(s) Covering It |
|-----------------|---------------------|
| G1: MVP board at localhost after docker-compose | TB-S02, S03, S04, S05, S06, S07 |
| G2: Ticket-driven, tested, adversarial review | All 13 stories (one PR each) |
| G3: docker-compose + SQLite/Postgres parity | TB-S01 AC3+AC4, TB-S07 AC1–AC3 |
| G4: OTel spans every request, /livez, /readyz, Prometheus | OBE-S01 through OBE-S06 |
| G5: README with architecture + local setup + BMAD links | TB-S07 AC4–AC6 |
| FR1: Columns CRUD | TB-S02 (all ACs) |
| FR2: Notes CRUD | TB-S03 (all ACs) |
| FR3: Move notes | TB-S04 AC1–AC4 |
| FR4: REST contract + RFC 7807 errors | TB-S02 AC5, TB-S03 AC5, ADR-011 |
| FR5: DB persistence + migrations | TB-S01 (all ACs) |
| FR6: Frontend SPA with DnD | TB-S05 AC1–AC4, TB-S06 AC1–AC5 |
| FR7: Containerization | TB-S07 AC1–AC3 |
| FR8: Observability + tests | OBE-S01 through OBE-S06, TB-S07 AC5+AC6 |
| AC1: Board with 3 defaults via API | TB-S05 AC1+AC2 |
| AC2: Create note via UI → POST 201 | TB-S05 AC3–AC4 |
| AC3: Drag-and-drop between columns | TB-S06 AC1–AC2 |
| AC4: CRUD status codes + RFC 7807 errors | TB-S02 AC5, TB-S03 AC5 |
| AC5: /health + /readyz endpoints | TB-S04 AC5, OBE-S02 all |
| AC6: docker-compose up works | TB-S07 AC1–AC3 |
| AC7: README with BMAD artifact links | TB-S07 AC4–AC6 |

### ✅ Coverage Summary

| Category | Required | Covered | Gap |
|----------|----------|---------|-----|
| PRD Goals (G1–5) | 5 | 5 | ✅ None |
| Functional Requirements (FR1–8) | 8 | 8 | ✅ None |
| Binding Acceptance Criteria (AC1–7) | 7 | 7 | ✅ None |
| Observability Story Set (OBE-S01–S06) | 6 | 6 | ✅ All present |

---

*Consolidated by John (BMAD Planning). This supersedes `docs/epics-and-stories.md`, `docs/epics-and-stories.todo-board.md`, and `docs/epics-and-stories.observability.md`. Individual story files in `docs/stories/todo-board/` and `docs/stories/observability/` are preserved for reference but this consolidated document is the source of truth.*  
*Ready for Phase 5 Implementation handoff to coding agent.*
