# Epics & Stories — Sympozium Todo Board (Consolidated)

> **Phase 4** | Owner: John (BMAD Planning)  
> Trace-to-PRD: `docs/prd.md`  
> Source of PRD ACs: G1–AC7

This artifact consolidates the previously disparate todo-board epics and observability epics/stories into a single authoritative backlog. Every story maps to one or more PRD requirements and acceptance criteria below each item's definition. Critical-path execution order is shown at the end.

## Epic: Foundation — Observability Platform (OBE-EPIC-1)
> **Maps to PRD Requirements:** G4, FR8, AC5  
> **Status:** 🟡 Ready → blocks all feature stories

### Story: OBE-S01 — Set Up OpenTelemetry Auto-Instrumentation for the Entire Service Mesh
**As a** DevOps / SRE engineer,  
**I want** automatic tracing, metrics, and logging from the collector with zero code changes in app code,  
**So that** I get observability coverage immediately without polluting business logic.

> **Maps to PRD:** G4 (hosting/serving reliability), FR8 (OTel auto-instrumentation)  
> **Acceptance linkage:** AC5 health probe + tracing correlation required before feature testing can produce observable traces.

**Acceptance criteria:**
- [ ] AC1: OTel Collector deployed as InProcess Sidecar with all three pipelines wired (traces → Jaeger/grpc, metrics → Prometheus remote write, logs → stdout/file with trace correlation via W3C TraceContext)
- [ ] AC2: Resource detectors detect service.name, deployment.environment, and pod.id automatically from Kubernetes env vars
- [ ] AC3: Semantic Conventions v1.20+ used across all exporters; span naming follows semconv http/spans convention
- [ ] AC4: OTel Collector config validated via `semconv.validate` against semantic-registry schema (no cardinality warnings)
- [ ] AC5: Span-to-log correlation demonstrable — a sample trace ID in the log matches the corresponding span's trace_id in the tracing backend

**Dependencies:** None  
**Estimate:** S  

---

### Story: OBE-S02 — Define Service Catalog and Health Probes for Every Endpoint
**As a** platform operator,  
**I want** each Kanban API endpoint to have health liveness/readiness checks + registered as a monitored entity in Dynatrace/OTel services map,  
**So that** I can instantly distinguish between infra failures vs app-level degradation.

> **Maps to PRD:** AC5 (health/probe endpoints), G4 (reliability)  
> **Acceptance linkage:** Directly implements AC5 health checks plus `/readyz` dependency check for DB.

**Acceptance criteria:**
- [ ] AC1: `/livez` (liveness — returns 503 if underlying store is unreachable) and `/readyz` (readiness — returns 503 if connection pool exhausted) endpoints exist on every service instance
- [ ] AC2: Dynatrace problem detection active for `http.server.duration` p99 > 1s on any backend → frontend path
- [ ] AC3: Kubernetes liveness/readiness probes use `/livez` and `/readyz` respectively (not just HTTP 200)

**Dependencies:** OBE-S01  
**Estimate:** S  

---

## Epic: Data Layer — Migration Infrastructure (TB-EPIC-D)
> **Maps to PRD Requirements:** FR5, AC3 (UUID generation), Schema constraints in ADR-003-B  
> **Status:** 🟡 Ready → critical path first story for feature work

### Story: TB-S01 — Database Schema and Migration Infrastructure
**As a** developer, I want database migrations that create `columns` and `notes` tables with full up/down support, so the application can persist board data across SQLite (dev) and PostgreSQL (prod).

> **Maps to PRD:** FR5 (PostgreSQL/SQLite parity via DATABASE_URL), Non-goals list  
> **Acceptance linkage:** Required before any CRUD story. Gaps in this epic cascade into feature failures.

**Acceptance criteria:**
- [ ] AC1: Migration creates `columns` table with id (UUID, Go-generated), title (varchar 255), board_scope (varchar 255 default 'default'), created_at, updated_at
- [ ] AC2: Migration creates `notes` table with id (UUID, Go-generated), column_id (FK → columns.id), title (varchar 255), body (text nullable), created_at, updated_at
- [ ] AC3: Index on `idx_notes_column_id` for query performance
- [ ] AC4: Migration runs successfully on both SQLite and PostgreSQL with identical schema output
- [ ] AC5: Down-migration drops tables safely without errors

**Dependencies:** None (feature-critical path first)  
**Estimate:** S  

---

## Epic: Backend — Columns CRUD API (TB-EPIC-1)
> **Maps to PRD Requirements:** FR1, FR4, AC4  
> **Status:** 🟡 Ready → parallel with notes epic once schema is merged

### Story: TB-S02 — REST Columns Endpoints with Tests
**As a** backend developer, I want full CRUD operations on the columns API so the Kanban frontend can display lanes and users can manage them.

> **Maps to PRD:** FR1 (columns CRUD endpoints), FR4 (consistent JSON + error format)  
> **Acceptance linkage:** AC4 endpoint consistency tested via automated API tests; AC6 board rendering needs this first.

**Acceptance criteria:**
- [ ] AC1: `GET /api/columns/` returns JSON array of column objects (id, title, board_scope)
- [ ] AC2: `POST /api/columns/` with body `{title}` creates a column and returns 201 + the created object
- [ ] AC3: `PUT /api/columns/:id` updates column title; returns 404 if not found
- [ ] AC4: `DELETE /api/columns/:id` deletes column (cascades to notes); returns 204
- [ ] AC5: All endpoints tested with automated API tests; errors follow RFC 7807 format
- [ ] AC6: Columns migration is referenced and validated by integration test against real DB

**Dependencies:** TB-S01  
**Estimate:** S  

---

## Epic: Backend — Notes CRUD API (TB-EPIC-2)
> **Maps to PRD Requirements:** FR2, FR4, AC4  
> **Status:** 🟡 Ready → parallel with columns epic

### Story: TB-S03 — REST Notes Endpoints with Tests
**As a** backend developer, I want full CRUD operations on the notes API so users can create, edit, and delete sticky notes in their Kanban columns.

> **Maps to PRD:** FR2 (notes CRUD), FR4 (consistent JSON responses)  
> **Acceptance linkage:** AC4 endpoint consistency plus AC2 UI needs note creation.

**Acceptance criteria:**
- [ ] AC1: `GET /api/notes/?column_id=:id` returns filtered notes array (or all if no filter); includes title, body, column_id
- [ ] AC2: `POST /api/notes/` with body `{title, body, columnId}` creates note and returns 201 + full object
- [ ] AC3: `PUT /api/notes/:id` updates title/body; returns 404 if not found
- [ ] AC4: `DELETE /api/notes/:id` removes note and returns 204
- [ ] AC5: All endpoints tested with automated API tests; errors follow RFC 7807 format

**Dependencies:** TB-S01  
**Estimate:** S  

---

## Epic: Backend — Move Endpoint + Health Check (TB-EPIC-3)
> **Maps to PRD Requirements:** FR3, AC5  
> **Status:** 🟡 Ready → parallel with columns and notes epics

### Story: TB-S04 — POST /api/notes/:id/move Endpoint and Health Check
**As a** frontend developer, I want an API endpoint that reassigns notes between columns (the core Kanban interaction), plus health check endpoint for operational monitoring.

> **Maps to PRD:** FR3 (move notes), AC5 (health endpoint)  
> **Acceptance linkage:** Directly implements AC3 move cards in UI and AC5 health probe requirement.

**Acceptance criteria:**
- [ ] AC1: `POST /api/notes/:id/move` with body `{columnId}` updates note's column_id and returns 200 + updated note object
- [ ] AC2: Returns 404 for non-existent note
- [ ] AC3: Returns 400 if columnId is missing from request body
- [ ] AC4: Move operation validated with API test; FK constraint ensures column exists (or returns 404)
- [ ] AC5: `GET /health` returns `{"status":"ok"}` with HTTP 200 when all services healthy

**Dependencies:** TB-S01  
**Estimate:** S  

---

## Epic: Frontend — Board Rendering & Note Creation (TB-EPIC-4)
> **Maps to PRD Requirements:** FR6, AC7, G1  
> **Status:** 🟡 Ready → depends on all backend stories below

### Story: TB-S05 — Render Kanban Board UI and Create Notes via Frontend
**As a** user, I want to see all columns with their sticky-note cards rendered on a visual board so I can view and interact with my todo items.

> **Maps to PRD:** FR6 (frontend SPA), AC1 (default columns visible on load), AC2 (create note via UI)  
> **Acceptance linkage:** Directly implements AC1, AC2, and first 80% of AC6 (docker stack up → board visible).

**Acceptance criteria:**
- [ ] AC1: Board renders horizontal column layout fetched from `GET /api/columns/`; default columns pre-seeded on init
- [ ] AC2: Each column displays notes as sticky-card components fetched from `GET /api/notes/?column_id=:id`
- [ ] AC3: New-note form per column (click "+" button) posts to `POST /api/notes/` and refreshes display without page reload
- [ ] AC4: Board auto-refreshes after new note creation

**Dependencies:** TB-S02, TB-S03  
**Estimate:** M  

---

## Epic: Frontend — Drag-and-Drop, Edit & Delete (TB-EPIC-5)
> **Maps to PRD Requirements:** FR6, AC3  
> **Status:** 🟡 Ready → depends on board rendering story above

### Story: TB-S06 — Drag-and-Drop Notes Between Columns; Edit and Delete Notes in UI
**As a** user, I want to drag note cards between columns, click to edit them, and delete stale items so my board reflects reality.

> **Maps to PRD:** FR6 (drag-and-drop via dnd-kit CDN), AC3 (move card in UI)  
> **Acceptance linkage:** Directly implements AC3 move behavior plus edit/delete interactions.

**Acceptance criteria:**
- [ ] AC1: Note cards are draggable via dnd-kit (CDN-loaded, no build step) and drop into other columns
- [ ] AC2: During drag, visual highlight indicates valid drop zones; dropped card animates into position
- [ ] AC3: On drop in a different column, frontend fires `POST /api/notes/:id/move` with new `columnId`
- [ ] AC4: Clicking a card opens inline edit form for title/body; save posts to `PUT /api/notes/:id`
- [ ] AC5: Delete button shows confirmation dialog that posts to `DELETE /api/notes/:id`

**Dependencies:** TB-S05  
**Estimate:** M  

---

## Epic: Containerization & Documentation (TB-EPIC-6)
> **Maps to PRD Requirements:** FR7, FR8, AC6, AC7, G3  
> **Status:** 🟡 Ready → depends on ALL feature stories above

### Story: TB-S07 — Docker Compose Stack and README with BMAD Artifact Links
**As a** developer, I want the full stack running in one `docker-compose up` command so anyone can run the app locally for demos or development.

> **Maps to PRD:** FR7, AC4 (docker-compose up), AC5/AC6 (README docs), G3  
> **Acceptance linkage:** Directly implements AC4 and AC7 — the last story on critical path.

**Acceptance criteria:**
- [ ] AC1: `docker-compose.yml` defines backend service (Go binary), frontend service (Nginx serving SPA), and database service (PostgreSQL)
- [ ] AC2: `docker-compose up -d` starts all services with no errors; healthchecks pass before compose reports "ready"
- [ ] AC3: Board accessible at http://localhost in a browser after compose starts
- [ ] AC4: README documents architecture diagram, local setup steps, test execution commands, and links to all BMAD phase artifacts (this PRD, this epics/stories doc, architecture doc)
- [ ] AC5: Backend integration tests run inside container (`go test ./...` succeeds with real Postgres via docker-compose override)

**Dependencies:** TB-S02, TB-S03, TB-S04, TB-S05, TB-S06  
**Estimate:** S  

---

## Epic: Frontend Observability (OBE-EPIC-2)
> **Maps to PRD Requirements:** G4, FR8  
> **Status:** 🟡 Ready → depends on features for context propagation verification

### Story: OBE-S03 — Backend Board CRUD Tracing + Context Propagation
**As a** backend developer, I want my Kanban app to be fully traceable through the backend with proper OTel span propagation, so users' requests from board → notes → move all share trace IDs and appear as a single waterfall in Jaeger/Tempo.

> **Maps to PRD:** G4 (reliability), FR8  
> **Acceptance linkage:** Observability overlay on TB story features; needs TB features implemented first.

**Acceptance criteria:**
- [ ] AC1: Each CRUD handler wraps logic in OTel spans with proper parent-child hierarchy (incoming HTTP spans as parents)
- [ ] AC2: Span attributes include only non-cardinality-bound fields: http.method, http.status_code, resource.name, board.id — NO user emails or IPs
- [ ] AC3: Error spans set span status to ERROR with exception.message when persistence fails
- [ ] AC4: Metrics (http.server.duration histograms + request counters) available via OTel Prometheus exporter

**Dependencies:** TB-S02, TB-S03, OBE-S01  
**Estimate:** M  

---

### Story: OBE-S04 — Backend Notes Context Propagation Across Services
**As a** backend developer, I want note operations to preserve trace context (W3C TraceContext) from board handlers to note handlers, so a user-created note traces across service boundaries in the distributed view.

> **Maps to PRD:** G4, FR8  
> **Acceptance linkage:** Complets distributed tracing coverage for the full request chain.

**Acceptance criteria:**
- [ ] AC1: All downstream HTTP calls between services use traceparent/tracestate headers from OTel Context API
- [ ] AC2: Incoming requests decode existing trace context and attach to any new spans created downstream
- [ ] AC3: Cross-service causal relationships visible in Jaeger/Tempo — parent span → child span links correct

**Dependencies:** OBE-S01, OBE-S03  
**Estimate:** S  

---

### Story: OBE-S05 — Frontend Browser-Based OTel Integration
**As a** frontend developer, I want browser-side OpenTelemetry JS instrumentation so the full request chain (HTML render → fetch calls to API) produces complete spans.

> **Maps to PRD:** G4  
> **Acceptance linkage:** Completing observability from UI to DB for demo purposes.

**Acceptance criteria:**
- [ ] AC1: @opentelemetry/sdk-web and propagation middleware installed; browser traces visible in Jaeger/Tempo
- [ ] AC2: Fetch calls include traceparent headers; backend receives context correctly
- [ ] AC3: Navigation timing spans included for board view and card interactions

**Dependencies:** TB-S05, OBE-S01  
**Estimate:** S  

---

### Story: OBE-S06 — Frontend Dashboard + Alerting Rules for Demo
**As a** demo operator, I want a simple Grafana/Loki dashboard showing the todo board's observability metrics with pre-configured alerting rules so the demo shows live telemetry at glance.

> **Maps to PRD:** G4, AC5  
> **Acceptance linkage:** The "show me" piece for the IsItObservable audience — dashboards that make observability tangible during the demo.

**Acceptance criteria:**
- [ ] AC1: Grafana dashboard panel showing active todo count, column distribution, and request rate
- [ ] AC2: Panel showing top error responses and latency percentiles (p50/p95/p99) over last 60 minutes
- [ ] AC3: Pre-configured alerting rule for `http.server.duration{p99 > 1s}` firing during demo

**Dependencies:** OBE-S05  
**Estimate:** M  

---

## Epic Map Summary

| # | Epic | Stories | Maps to PRD | Status |
|---|------|---------|-------------|--------|
| OBE-EPIC-1 | Foundation — Observability Platform | OBE-S01, OBE-S02 | G4, FR8, AC5 | 🟡 Ready |
| TB-EPIC-D | Data Layer — Schema & Migrations | TB-S01 | FR5 | 🟡 Ready → **CRITICAL PATH START** |
| TB-EPIC-1 | Backend — Columns CRUD | TB-S02 | FR1, FR4, AC4 | 🟡 Ready |
| TB-EPIC-2 | Backend — Notes CRUD | TB-S03 | FR2, FR4, AC4 | 🟡 Ready |
| TB-EPIC-3 | Backend — Move + Health | TB-S04 | FR3, AC5 | 🟡 Ready |
| TB-EPIC-4 | Frontend — Board Rendering & Create | TB-S05 | FR6, AC1, AC2 | 🟡 Ready |
| TB-EPIC-5 | Frontend — DnD, Edit, Delete | TB-S06 | FR6, AC3 | 🟡 Ready |
| TB-EPIC-6 | Containerization + Docs | TB-S07 | FR7, AC4, AC5, AC6, G3 | 🟡 Ready |
| OBE-EPIC-2 | Observability Overlay (Backend) | OBE-S03, OBE-S04 | G4, FR8 | 🟡 Ready |
| OBE-EPIC-3 | Observability Overlay (Frontend/Demo) | OBE-S05, OBE-S06 | G4, AC5 | 🟡 Ready |

---

## Execution Order — Critical Path

### Phase 5: Implementation Order (Critical Path Shown as →)

```
TB-EPIC-D (DB Schema)  ────► TB-EPIC-1,2,3 (Backend APIs in parallel) ────► TB-EPIC-4 (Frontend Board)
         │                                                        │
     OBE-S01 (OTel first!)                                  TB-EPIC-5 (DnD/Edit/Delete) → TB-EPIC-6 (Compose/Readme)
         │                                                        │
     OBE-S02 (Health Probes) ─────────────────────────► OBE-S03,4 (Backend tracing)
                                                          │
OBE-S05 (Frontend OTel) ──► OBE-S06 (Grafana/Demo Dashboard)
```

### Detailed Step Order
1. **TB-S01** — Database schema migrations (critical path start)
2. **OBE-S01** — OTel auto-instrumentation (blocks all observability work; must happen early)  
3. **OBE-S02** — Health probes + service catalog (depends on OBE-S01)
4. **TB-S02** (parallel) — Columns CRUD with tests  
5. **TB-S03** (parallel, alongside S02) — Notes CRUD with tests  
6. **TB-S04** (parallel, alongside S02/S03) — Move endpoint + health check
7. **OBE-S03** — Backend board tracing overlay (depends on TB-S02+03 + OBE-01)
8. **OBE-S04** — Context propagation between services (depends on OBE-S03)
9. **TB-S05** — Frontend board rendering + note creation (depends on TB-S02+03)  
10. **TB-S06** — DnD/edit/delete frontend (depends on TB-S05)
11. **OBE-S05** — Frontend browser OTel (depends on TB-S05 + OBE-01)
12. **OBE-S06** — Grafana dashboard + alerting (depends on OBE-S05)  
13. **TB-S07** — Docker compose stack + README (depends on ALL feature stories, goes last)

### Parallelization Opportunities
- **TB-S02 / TB-S03 / TB-S04**: Fully parallelizable once TB-S01 merges (all depend only on schema)
- **OBE-S01**: Must start early but is independent of feature code — a coder can work with a pre-seeded in-memory stub for development
- **OBE-S02 / OBE-S03**: Can begin after OBE-S01 without depending on TB features

### Total Estimation
| Epic | Estimate |
|------|----------|
| OBE-EPIC-1 (Foundation) | S + S = 4–6 hrs |
| TB-EPIC-D (Data Layer) | S = 2–3 hrs |
| TB-EPIC-1+2+3 (Backend APIs, parallel) | S × 3 = 6–9 hrs (parallel wall-clock: ~6 hrs) |
| OBE-EPIC-2 (Backend Tracing Overlay) | M + S = 4–7 hrs |
| TB-EPIC-4 (Frontend Board) | M = 4–5 hrs |
| TB-EPIC-5 (DnD/Edit/Delete) | M = 5–6 hrs |
| OBE-EPIC-3 (Frontend/Demo OTel) | S + M = 4–7 hrs |
| TB-EPIC-6 (Compose/Docs) | S = 2–3 hrs |

**Total dev effort: ~40–55 hours** across parallel agents  
**Critical path wall-clock: ~18–24 hours** sequential on a single agent

---

*Produced by Phase 2 Planning + Consolidation (John/BMAD). Maps to PRD `docs/prd.md`.*
*Ready for story-writer handoff (if stories need individual file creation) or directly to coding agents.*
*See PR #17 for the consolidated epics & stories artifact.*
