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
