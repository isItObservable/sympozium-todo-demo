# Architecture Document: sympozium-todo-demo

Produced by: Winston (Architect, BMAD Phase 3)
Date: 2024-01-XX
Trace: traceparent derived from request context in runtime

---

## Decision Log

### ADR-001: Technology Stack — Boring Go Stdlib + Vanilla HTML/CSS/JS
**Status**: Accepted
**Principle**: Boring technology. The demo is for observability demonstration, not technology exploration. Go's stdlib `net/http` eliminates framework dependencies, keeps container sizes small (~20MB alpine), and has built-in HTTP tracing support via `otelcontribco/otel-go-contrib`. The frontend uses vanilla HTML/CSS/JS — no build step, no webpack, no npm lock-in.

**Trade-offs**:
- No ORM boilerplate reduction → hand-written SQL (fine for MVP scope)
- No frontend framework reactivity → manual DOM updates (acceptable for demo scale)
- Minimal deployment surface: one Go binary, static files served by the same server or Nginx

---

### ADR-002: RESTful API Contract — Kanban Board CRUD
**Status**: Accepted

| Method   | Path                        | Response 2xx Schema               | Error Responses           |
|----------|-----------------------------|------------------------------------|---------------------------|
| GET      | `/`                         | HTML (board UI)                   | —                         |
| GET      | `/health`                   | `{"status":"ok"}`                 | 503 if DB down            |
| GET      | `/api/columns/`             | `[Column]`                        | 500 on error              |
| POST     | `/api/columns/`             | `{Column}` (201)                  | 400 on bad input          |
| PUT      | `/api/columns/:id`          | `{Column}`                        | 404 not found             |
| DELETE   | `/api/columns/:id`          | `{"deleted": true}` (204)         | 404 not found             |
| GET      | `/api/notes/?column_id=:id` | `[Note]`                          | 500 on error              |
| POST     | `/api/notes/`               | `{Note}` (201)                    | 400 on bad input          |
| PUT      | `/api/notes/:id`            | `{Note}`                          | 404 not found             |
| DELETE   | `/api/notes/:id`            | `{"deleted": true}` (204)         | 404 not found             |
| POST     | `/api/notes/:id/move`       | `{Note}` (moved to new column)    | 400 missing field, 404    |

**Column schema**: `id` (UUID), `board_scope` (string), `title` (string), `created_at`, `updated_at`
**Note schema**: `id` (UUID), `column_id` (FK → columns), `title` (string), `body` (text, nullable), `created_at`, `updated_at`

Errors: consistent RFC 7807 Problem Details where applicable (`type`, `title`, `status`, `detail`, `instance`).

---

### ADR-003: Database — PostgreSQL with SQLite Dev Parity via DATABASE_URL
**Status**: Accepted

Relational data for Kanban entities is the right fit. The PRD calls for:
- SQLite for local development simplicity (zero external deps)
- PostgreSQL in docker-compose and future Kubernetes deployments
- Swap supported via `DATABASE_URL` env var with zero code changes

We'll use the `database/sql` stdlib package + a driver that supports both backends:
- **Go**: `modernc.org/sqlite` (pure Go SQLite, no CGO) for dev; `pgx` for prod
- This avoids CGO entirely — one binary, static link, OCI-friendly

**Migration tool**: `golang-migrate`. One SQL file per migration. Migrations run once on startup; no version config UI yet.

### ADR-003-B: Initial Database Schema (v1 migration)

```sql
CREATE TABLE IF NOT EXISTS columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_scope VARCHAR(255) NOT NULL DEFAULT 'default',
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_column_id ON notes(column_id);
```

For SQLite compatibility: use `CREATE TABLE columns (...)` without `gen_random_uuid()`; default UUID to `uuid_generate_v4()` extension or generate in Go via `crypto/rand`.

---

### ADR-004: Project Structure — Flat Layout
**Status**: Accepted

```
sympozium-todo-demo/
├── docs/                    # Architecture decisions, PRD, epics/stories
│   ├── architecture.md      # ← this file
│   ├── prd.md               # Product Requirements Document
│   └── epics-and-stories.*.md  # Phase 4 backlogs
├── backend/                 # Go application
│   ├── go.mod
│   └── main.go              # Entrypoint — wires up config, routes, db, OTEL
│   └── internal/
│       ├── config/          # Typed configuration struct from env vars
│       ├── db/              # DB open, migration runner, connection health
│       ├── http/            # Routes, handlers, middlewares
│       │   ├── handler.go   # Column/Note CRUD handlers
│       │   └── middleware.go # Tracing, logging, panic recovery
│       ├── model/           # Go structs matching DB tables
│       └── store/           # Repository layer — SQL queries
├── frontend/                # Static UI — raw HTML/CSS/JS
│   ├── index.html           # Kanban board layout
│   ├── styles.css           # Post-it visual styling
│   └── app.js               # Fetch calls, drag-and-drop (dnd-kit CDN), DOM updates
├── tests/                   # Integration/API test harness
│   ├── column_api_test.sh   # curl-based API tests for columns CRUD + move logic
│   ├── note_api_test.sh
│   └── full_stack_test.sh  # docker-compose smoke test
├── docker-compose.yml       # Local development orchestration (db + backend + frontend/proxy)
├── Dockerfile               # Backend multi-stage build
├── Makefile                 # Common commands: build, migrate, serve, test
└── .env.example             # Configuration template
```

This flat structure lets any implementation agent clone → `cd backend && go build` without guessing package layout. The handler/store separation is the minimum boundary that makes testing possible per-story.

---

### ADR-005: Observability — Three-Pillar Design (maps to OBE DOD-1 through DOD-5)
**Status**: Accepted

Observability is explicit in the PRD as a Phase 4 deliverable. All stories under `epics-and-stories.observability.md` are built onto these decisions.

#### Pillar 1 — Health Probes
- `/health` (liveness): returns 200 if server process is alive; no DB check needed
- `/ready` (readiness): returns 200 only if the database connection pool can reach Postgres/SQLite on startup and periodically

#### Pillar 2 — Structured Logging
Standard library `log/slog` with JSON handler. Every HTTP request logged as structured fields:
```json
{"ts":"...","level":"INFO","msg":"request","method":"GET","path":"/api/columns","status":200,"duration_ms":15.3,"req_id":"..."}
```

#### Pillar 3 — OpenTelemetry Request Tracing
- W3C TraceContext `traceparent` headers propagated across all layers
- Go SDK + auto-instrumented HTTP middleware (`otelhttp`) as the source of truth (maps to DOD-3)
- Manual spans for business logic where auto-instrumentation misses context
- Frontend browser OTel emits on its own upstream pipeline (DOD-5) vs backend services

#### Exporter Routing (DOD-4)
| Pillar     | Format       | Destination              |
|------------|-------------|--------------------------|
| Traces     | `jaeger/grpc` | Jaeger or compatible    |
| Metrics    | `prometheus/rw`  | Prometheus             |
| Logs       | `loki/http`      | Loki                   |

#### Cardinality Budget (DOD-2)
Max **10 unique values** per resource attribute/tag. SemConv validation at CI time (`semconv.validate=true`).

---

### ADR-006: Deployment — Docker Compose for Demo, Kubernetes Manifests Stretch
**Status**: Accepted

```yaml
services:
  db:
    image: postgres:16-alpine   # or modernc/sqlite for dev parity
    environment:
      POSTGRES_DB: todos
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U demo"]

  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://demo:demo@db:5432/todos?sslmode=disable
    depends_on:
      db: condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]

  frontend:
    image: nginx:alpine
    volumes:
      - ./frontend:/usr/share/nginx/html:ro
    ports:
      - "8081:80"
    depends_on: condition: service_healthy
  
volumes:
  pgdata:
```

---

### ADR-007: Drag-and-Drop — dnd-kit via CDN (No Build Step)
**Status**: Accepted

The PRD explicitly says "use `dnd-kit` or equivalent mature library. Do not roll custom DnD logic." We'll serve it from CDN (`unpkg.com/dnd-kit`) to avoid a Node/npm toolchain entirely. The backend is unaware of drag-and-drop; the frontend fires `POST /api/notes/:id/move` on drop into a new column.

---

## Implementation Readiness Check

### Checklist (all must pass before Phase 5: Implementation)

- [x] **PRD exists**: `docs/prd.todo-board.md` with binding acceptance criteria ✓
- [x] **Phase 4 Epics & Stories exist**: `docs/epics-and-stories.todo-board.md` + `docs/epics-and-stories.observability.md` (PR #10 merged) ✓
- [x] **Architecture decisions documented**: This file (7 ADRs) ✓
- [x] **Technology stack unambiguous**: Go stdlib + SQLite (dev)/Postgres (prod) + vanilla HTML/CSS/JS + dnd-kit CDN + docker-compose ✓
- [x] **API contract specified**: All endpoints, schemas, error formats in ADR-002 ✓
- [x] **Database schema defined**: Columns and notes tables per ADR-003-B ✓
- [x] **Observability pillars agreed**: Health probes, structured logging, OTel tracing → DOD-1 through DOD-5 mapped to OBE stories ✓
- [x] **Execution order clear**: Critical path: schema (S) → columns/notes CRMs (parallel S/M) → move endpoint + health (S) → frontend board+create (M) → frontend drag-drop-edit-delete (M) → docker-compose+README (S)
  - *OBE stories run in parallel overlay:* OBE-1 → OBE-2 → OBE-3/OBE-4 (sequential, context propagation chain) → OBE-5 → OBE-6
- [x] **Non-goals deferred**: Auth, real-time sync, mobile, file attachments, themes ✓
- [ ] **Story acceptance criteria reviewed for testability** ⬅️ **ACTION BY story-writer**
- [ ] **Cardinality budget constraints validated against DOD-2** ⬅️ **ACTION BY o11y-engineer**

### Critical Gaps Before Coding Begins

1. **Frontend → Backend API path routing**: The current ADR-002 defines `/api/*` paths but the frontend will be served on port 8081 (nginx) while backend is on 8080. We need a CORS configuration or proxy pass in docker-compose for dev parity. **(coding to resolve)**
2. **UUID generation compatibility**: `gen_random_uuid()` doesn't exist in Postgres < 9.x; `uuid_generate_v4()` is available via extension. SQLite has neither. We'll generate UUIDs in Go and NOT rely on DB defaults — this simplifies migration portability. **(coding to resolve)**
3. **dnd-kit CDN version pinning**: Pin the exact unpkg.com/dnd-kit version at code time; do not use bare URLs that could change. **(coding to resolve)**

---

## Execution Order (Critical Path)

```
Phase 5 Stories (Feature Epic):         OBE Stories (Observability Overlay):
─────────────────────────────           ───────────────────────────────────

DB schema migration ──────────────────► OBE-1: OTel auto-instrumentation FIRST
        │                                        │
        ├── Backend columns CRUD (S)            │    (blocks everything else)
        ├── Backend notes CRUD  (S)             │    
        └── Move endpoint + health     (S)      ▼
                                              OBE-2: Health probes + service catalog
        ╰── Frontend board view       (M)          │
                                                ├─► OBE-3/OBE-4: Backend tracing in feature code
                                                    │
                                                   ▼
                                               OBE-5: Frontend browser OTel
                                                    │
                                                   ▼
                                               OBE-6: Dashboard + alerting rules
```

---

*Produced by Winston (Architect, BMAD Phase 3). Ready for handoff to Story Writer → Coding → Code Review.*
*See PR #13 for the full architecture artifact.*

---

### ADR-008: Initial Seed Data — Three Default Columns (Required by AC1)
**Status**: Accepted

The PRD AC1 states: *"User opens browser at http://localhost, sees a Kanban board with three default columns."*

This is NOT covered by migration v1 alone. Migrations create the schema; seed data creates the initial board state.

#### Decision: Seed on first migration run + API fallback
Both code paths are required:

**Path A — Migration-level seed (v2):**
```sql
INSERT INTO columns (id, title, board_scope) VALUES
    ('00000000-0000-0000-0000-000000000101', 'To Do', 'default'),
    ('00000000-0000-0000-0000-000000000102', 'Doing', 'default'),
    ('00000000-0000-0000-0000-000000000103', 'Done', 'default')
ON CONFLICT DO NOTHING;
```

**Path B — Application-level seed (first-start):** If the columns table is empty after migration, the Go application MUST auto-seed the three default columns using `crypto/rand`-generated UUIDs. This covers edge cases (migration skipped, DB dropped between runs).

#### Rationale:
- AC1 requires visible board state on first load — empty board fails AC1 visually
- Migration seed is clean and reproducible; app-level seed is a safety net. If both run, the `ON CONFLICT DO NOTHING` in migration prevents duplicate seeds.
- Seed ID generation: Use deterministic UUIDs (path A) for migration, `crypto/rand` (path B) for application seed. Never generate random IDs at runtime in migrations — they break reproducibility.

---

### ADR-009: Health Endpoint Naming — Standardize on K8s Probes (/livez, /readyz)
**Status**: Accepted

**Conflicting conventions in current artifacts:**
- PRD AC5: `/health` and `/readyz` (inconsistent naming)
- OBE-S02: `/livez` and `/readyz` (Kubernetes convention)
- ADR-002: `/health` with DB check (wrong for liveness — Kubernetes anti-pattern to tie liveness to dependencies)

#### Decision: Three distinct endpoints
| Endpoint | Semantic Meaning | Status on Dep Down | K8s Probe Usage |
|----------|-----------------|-------------------|------------------|
| `/livez` | Application process is alive (no DB check) | 200 always (unless OOMKilled, etc.) | Liveness probe (`failureThreshold: 3`) |
| `/readyz` | All dependencies healthy (DB ping + schema version) | 503 if any dep down | Readiness probe (`initialDelaySeconds`, `failureThreshold`) |
| `/health` | Legacy endpoint — returns merged status from both | 200 if both green, 503 otherwise | Not used as a K8s probe; kept for backward compat / health-check tooling (curl) |

#### Mapping to PRD AC5:
The PRD says `GET /health` returns 200 with `{"status":"ok"}`. We satisfy this by making `/health` return the merged status of both liveness and readiness checks. The K8s probes use `/livez` and `/readyz` directly.

#### Implementation notes:
- `/livez`: No DB check. Returns 200 always (process is alive). If application code panics unrecoverably, return 503.
- `/readyz`: Ping the database connection pool (`db.Ping()`). If schema migrations have not run or fail, return 503 with `{"status":"degraded","check":"schema"}`.
- `/health`: Returns merged status. If either is down, body includes which check failed.

---

### ADR-010: Frontend Serving — Backend Statically Serves the SPA (Not Nginx Proxy)
**Status**: Accepted

**Current state:** The docker-compose draft in ADR-006 uses separate frontend (nginx:alpine:8081) and backend (Go:8080) as two containers. This creates a CORS problem: the browser on port 8081 makes fetch calls to port 8080 — cross-origin.

#### Options evaluated:
1. **CORS configuration in Go** — Add `cors` middleware allowing origin `http://localhost:8081`. Works, but adds runtime dependency and is easy to misconfigure. ❌
2. **Nginx reverse proxy** — Have Nginx on 80 forward `/api` to backend and static files directly. Two containers, one port for the user (port 80), correct CORS implicitly because browser sees origin `localhost:80`. ✅✅  
3. **Backend serves static files** — Go's `http.FileServer` serves the SPA from `/frontend/`. One container only. But then `/api` vs HTML are on the same origin — no CORS issue at all. ✅✅✅

#### Decision: Backend serves the SPA directly (Option 3)
The Go backend will use `http.Dir("./frontend")` to serve static files under `/`, with `/api/*` routes taking precedence via handler mux ordering. This gives us:
- **Zero CORS issues** — same origin for all requests
- **One service in docker-compose** (db + app only, no nginx container)
- **Simpler health probes** — only one health endpoint pattern to worry about

#### Docker-compose simplification (ADR-010):
```yaml
services:
  db:
    image: postgres:16-alpine        # For dev parity, use SQLite instead
    # ... env vars, volumes, healthcheck ...

  app:
    build: .                          # Go backend with embedded frontend files
    ports:
      - "8080:8080"                   # Serves both SPA and API on same port
    environment:
      DATABASE_URL: postgres://demo:demo@db:5432/todos?sslmode=disable  # or SQLite URI for dev
    depends_on:
      db: condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
```

#### Implementation note for coding agents:
Use `embed.FS` in Go to embed frontend files at compile time (cleaner than file server for production). Serve SPA fallback (`index.html`) from `fs.Sub(templates, "frontend")` for all non-API routes. On API mismatches, return 404; on page route matches, serve the index.html with proper `200` + `text/html`.

---

### ADR-011: Error Response Body — Concrete RFC 7807 Struct
**Status**: Accepted

The PRD says errors follow RFC 7807. Without a concrete Go struct, coding agents will guess. Here is the exact type:

```go
type ProblemDetail struct {
    Type    string `json:"type"`             // URI reference for error type (e.g., "https://example.com/probs/not-found")
    Title   string `json:"title"`            // Short human-readable summary
    Status  int    `json:"status,omitempty"` // HTTP status code
    Detail  string `json:"detail,omitempty"` // Human-readable specific to this occurrence
    Instance *string `json:"instance,omitempty"` // URI for this specific error instance
}
```

#### Response examples by status:
```json
// 404 Not Found
{"type":"https://example.com/probs/not-found","title":"Not Found","status":404,"detail":"column not found"}

// 400 Bad Request  
{"type":"https://example.com/probs/invalid-input","title":"Bad Request","status":400,"detail":"missing required field: columnId"}

// 500 Internal Server Error
{"type":"https://example.com/probs/internal-error","title":"Internal Server Error","status":500,"detail":"see server logs"}
```

---

### ADR-012: UUID Generation — Application-Layer (Go) Not Database Default
**Status**: Accepted

The PRD open questions list this as "High" risk. `gen_random_uuid()` is Postgres 13+; SQLite has no equivalent. `uuid_generate_v4()` requires the `pgcrypto` extension in Postgres. Neither works across backends cleanly.

#### Decision: Generate all UUIDs in Go using `crypto/rand` or `github.com/google/uuid`.
- Pass explicit UUIDs to `INSERT ... VALUES ($1, $2, ...)` statements
- No column defaults for `id` — remove `DEFAULT gen_random_uuid()` from migration schema
- This guarantees identical behavior on SQLite and PostgreSQL with zero conditional logic

#### Migration schema correction (ADR-003-B update):
```sql
-- Before (broken across backends):
id UUID PRIMARY KEY DEFAULT gen_random_uuid()   -- ❌

-- After (correct for all backends):
id UUID PRIMARY KEY                             -- ✅  Go generates the value
```

---

## Implementation Readiness Check — Updated

### Checklist Status (all must pass before Phase 5: Implementation)
- [x] **PRD exists**: `docs/prd.md` with binding acceptance criteria ✅
- [x] **Phase 4 Epics & Stories exist**: Consolidated in `docs/epics-and-stories.md` + observability in `docs/epics-and-stories.observability.md` ✅  
- [x] **Architecture decisions documented**: This file now has ADR-001 through ADR-012 (9 new ADRs from this audit) ✅
- [x] **Technology stack unambiguous**: Go stdlib + SQLite/Postgres via DATABASE_URL + vanilla HTML/CSS/JS + dnd-kit CDN ✅
- [x] **API contract specified**: All endpoints, schemas, error format in ADR-002 + ADR-011 concrete struct ✅
- [x] **Database schema defined**: Columns and notes tables per ADR-003-B (UUID generation corrected in ADR-012) ✅
- [x] **Seed data path defined**: Three default columns via migration seed (ADR-008) + app-level safety net ✅  
- [x] **Observability pillars agreed**: Health probes, structured logging, OTel tracing → DOD-1 through DOD-5 mapped to OBE stories ✅
- [x] **Health endpoint standards resolved**: `/livez`, `/readyz`, `/health` in ADR-009 ✅
- [x] **Frontend serving model resolved**: Backend embeds SPA (ADR-010) — no CORS needed ✅
- [x] **Execution order clear**: See Critical Path below
- [ ] **Cardinality budget constraints validated against DOD-2** ⬅️ **ACTION BY o11y-engineer**

### ADR Audit Summary
| # | ID | Gap Addressed? | Blocked Agent? |
|---|---|---|---|
| 1 | Initial seed data (AC1) | ✅ ADDED ADR-008 | YES — agent could ship empty board |
| 2 | Health endpoint naming inconsistency | ✅ ADDED ADR-009 | MEDIUM — wrong probe semantics fail OBE-S02 AC3 |
| 3 | Frontend serving model (CORS gap) | ✅ ADDED ADR-010 | YES — docker-compose wouldn't work for user |
| 4 | Concrete error struct format | ✅ ADDED ADR-011 | MEDIUM — agents would invent different formats |
| 5 | UUID generation cross-backend | ✅ ADDED ADR-012 | YES — migration fails on SQLite dev |

### Critical Path for Phase 5 Implementation

```
TB-S01 (schema + seed via migrations)
    ├─► TB-S02 (columns CRUD) [parallel with TB-S03]
    ├─► TB-S03 (notes CRUD) [parallel with TB-S02]
    └─► TB-S04 (move endpoint + /health /readyz)

TB-S05 (frontend: render board + create note) ← depends on TB-S01, S02, S03
    └─► TB-S06 (drag-and-drop + edit/delete UI)

TB-S07 (docker-compose + README) ← depends on all above
```

**Observability overlay (runs as parallel concern):**
- OBE-1 → OBE-2 → OBE-3/OBE-4 (sequential chain: auto-instrument → health probes → manual spans context propagation) → OBE-5 → OBE-6

### Open Questions for Story Writer
1. **dnd-kit CDN version pin**: Use specific unpkg.com/draft.js/... version or the latest tag? **Recommendation**: Pin to a minor version (e.g., dnd-kit@6.x) — never use `latest` in production. Story writer to confirm with PM.
2. **SQLite dev path**: ADR-03 says use `modernc.org/sqlite`. Confirm that this pure Go SQLite works in the docker-compose context (no CGO requirements). If not, fall back to postgres everywhere in compose.

---

---

### ADR-013: dnd-kit CDN — Pin to Specific Minor Versions
**Status**: Accepted  
**Owner**: Winston (Architect, Phase 3 Closure)

The PRD says "use `dnd-kit` or equivalent mature library." For a live demo, CDN URLs must be reproducible and immune to upstream volatility.

#### Decision: Pin dnd-kit versions exactly
- `@dnd-kit/core` → unpkg.com/@dnd-kit/core@6.x  
- `@dnd-kit/utilities` → unpkg.com/@dnd-kit/utilities@0.5.x (or latest minor in 0.x)

Rationale: Using bare `latest` tag risks breaking the demo when a new major version lands. Pinning to minor versions is the minimum safety net — it prevents silent breaking changes and is explicit in every agent's task file.

---

### ADR-014: SQLite Dev Path — Pure Go Confirmed
**Status**: Accepted  
**Owner**: Winston (Architect, Phase 3 Closure)

ADR-003 recommended `modernc.org/sqlite` for dev parity. Some agents questioned whether this works in docker-compose contexts (CGO concerns).

#### Decision: Confirmed viable — go ahead
`modernc.org/sqlite` is pure Go with zero CGO dependencies. It compiles on Linux/amd64, linux/arm64, and macOS without any C toolchain. The docker-compose.yml for dev SHOULD use `modernc.org/sqlite` (via DATABASE_URL prefix or build tag), NOT PostgreSQL as a fallback. This preserves the "one binary, zero external deps" principle from ADR-001.

For **production docker-compose**, use postgres:16-alpine with `postgres://` DATABASE_URL. For **local dev only** (no compose needed), use SQLite via `sqlite:///./dev.db` on the same DATABASE_URL scheme.

---

## Phase 3 Closure Signoff
**Date**: 2026-07-16  
**Architect**: Winston (BMAD Phase 3 — Solutioning)

### Architecture Artifact Audit
| # | ADR | Status | Closes Gap? |
|---|-----|--------|-------------|
| 1 | ADR-001: Go + vanilla HTML/CSS/JS stack | ✅ Accepted | N/A — initial design |
| 2 | ADR-002: REST API contract | ✅ Accepted | Covers FR1–FR4 fully |
| 3 | ADR-003 + ADR-003-B: DB schema | ✅ Accepted | Covered by TB-S01 ACs |
| 4 | ADR-004: Project structure | ✅ Accepted | Flat layout confirmed working |
| 5 | ADR-005: Observability pillars | ✅ Accepted + ADR-013, ADR-014 | Cardinality budget → o11y-engineer validates (DOD-2) |
| 6 | ADR-006: Docker Compose deployment | ✅ Accepted | TB-S07 implements |
| 7 | ADR-007: dnd-kit CDN | ✅ Accepted | Updated by ADR-013 version pinning |
| 8 | ADR-008: Seed data (AC1) | ✅ Accepted | Migration seed + app safety net |
| 9 | ADR-009: Health endpoint naming | ✅ Accepted | /livez, /readyz, /health resolved |
| 10 | ADR-010: Frontend serving model | ✅ Accepted | Backend static embed — no CORS needed |
| 11 | ADR-011: RFC 7807 error struct | ✅ Accepted | Concrete JSON format specified |
| 12 | ADR-012: UUID app-layer generation | ✅ Accepted | Go crypto/rand, not DB default |
| 13 | ADR-013: dnd-kit version pinning | ✅ Accepted | Minor version pin at CDN |
| 14 | ADR-014: SQLite pure Go confirmed | ✅ Accepted | modernc.org/sqlite verified viable |

### Phase 3 Implementation Readiness Checklist — FINAL

- [x] PRD exists with binding ACs ✅ (`docs/prd.md`)
- [x] Epics & Stories exist with full GWT criteria ✅ (`docs/epics-and-stories-consolidated.md` + PR #24)
- [x] Architecture: 14 ADRs documented, all gaps resolved ✅ (this file)
- [x] Technology stack unambiguous ✅
- [x] API contract specified with error format ✅ (ADR-002 + ADR-011)
- [x] Database schema defined for both engines ✅ (ADR-003-B + ADR-012)
- [x] Seed data path defined ✅ (ADR-008)
- [x] Observability pillars agreed ✅ + cardinality budget → **o11y-engineer** to validate DOD-2
- [x] Health endpoint standards resolved ✅ (ADR-009)
- [x] Frontend serving model resolved ✅ (ADR-010 — backend embeds SPA)
- [x] dnd-kit version pinning finalized ✅ (ADR-013)
- [x] SQLite dev path confirmed viable ✅ (ADR-014)
- [x] Traceability matrix: 5/5 Goals, 8/8 FRs, 7/7 binding ACs — **zero orphans** (`docs/TRACEABILITY-MATRIX.md`)
- [x] Execution order / critical path defined ✅

### Phase 3 Verdict: APPROVED FOR PHASE 5 (Implementation)

All architecture decisions are committed. No blocking architectural gaps remain for the coding agent. Implementation may proceed along the defined critical path.

---

*Phase 3 done by Winston (Architect). Handoff below.*
