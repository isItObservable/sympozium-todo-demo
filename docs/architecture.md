# Architecture Document: sympozium-todo-demo

Produced by: Winston (Architect, BMAD Phase 3)
Date: 2024-01-XX
Trace: traceparent derived from request context in runtime
Latest update: 2024-01-XX — Phase 3 re-validation and gap closure

---

## Decision Log

### ADR-001: Technology Stack — Boring Go Stdlib + Vanilla HTML/CSS/JS
**Status**: Accepted
**Principle**: Boring technology. The demo is for observability demonstration, not technology exploration. Go's stdlib `net/http` eliminates framework dependencies, keeps container sizes small (~20MB alpine), and has built-in HTTP tracing support via `otelcontribco/otel-go-contrib`. The frontend uses vanilla HTML/CSS/JS — no build step, no webpack, no npm lock-in.

**Trade-offs**:
- No ORM boilerplate reduction → hand-written SQL (fine for MVP scope)
- No frontend framework reactivity → manual DOM updates (acceptable for demo scale)
- Minimal deployment surface: one Go binary, static files served by the same server only

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
-- For PostgreSQL:
CREATE TABLE IF NOT EXISTS columns (
    id UUID PRIMARY KEY // Generated in Go via crypto/rand per ADR-009
    board_scope VARCHAR(255) NOT NULL DEFAULT 'default',
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY // Generated in Go via crypto/rand per ADR-009
    column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For SQLite (separate migration variant or conditional):
CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    board_scope VARCHAR(255) NOT NULL DEFAULT 'default',
    title VARCHAR(255) NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL REFERENCES columns(id),
    title VARCHAR(255) NOT NULL,
    body TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_notes_column_id ON notes(column_id);
```

**UUID generation in Go (ADR-003-fix):** Generate UUIDs in application code via `crypto/rand` / `uuid` package. Do NOT rely on any database-side `DEFAULT` clause for `id`. This is the single most important driver — both SQLite and Postgres UUID behavior diverges. All insert statements must include a Go-generated UUID string literal for the `id` column.

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

#### Cardinality Budget (DOD-2) — ADR-005-fix
**Max 10 unique values per resource attribute/tag.** The observability stories (OBE-EPIC-3) must enforce this. No user-provided data goes into span attributes — only stable identifiers like `http.method`, `http.status_code`, `service.name`. Semantic convention validation at test time via `semconv.validate=true`.

**ADR-005-fix: Session/Correlation-ID header convention**
Every request MUST carry both `X-Correlation-ID` AND `X-Request-ID` with the same generated UUID.
- Is generated by the ingress (nginx for frontend, otelhttp middleware for backend) if not present
- Flows through every layer as both an HTTP header (for distributed tracing) AND as a slog/OTel log attribute (for log-span correlation)
- Matches the OTel `traceparent` trace-id field when available

---

### ADR-006: Deployment — Docker Compose for Demo, Kubernetes Manifests Stretch
**Status**: Accepted

```yaml
services:
  db:
    image: postgres:16-alpine
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

### ADR-008: CORS and Cross-Service Communication (NEW — Phase 3 Gap Closure)
**Status**: Proposed → Must be accepted before implementation

**Problem:** The frontend is served by nginx on port 8081; the backend API runs on port 8080. Direct browser `fetch()` calls from port 8081 to port 8080 will fail with CORS errors in production-like environments (chrome with file:// protocol, or when docker-compose exposes ports separately).

**Decision:** Use nginx as a reverse proxy in docker-compose dev mode:
- Nginx serves static files AND forwards `/api/*` requests to the Go backend at `app:8080`
- Single origin for the browser (port 80 / `localhost`) — zero CORS needed
- Production/K8s stretch: a single ingress rule maps `/api/*` → backend service

```nginx
# nginx.conf (docker-compose)
server {
    listen 80;
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://app:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-ID $req_id;  # nginx generates UUID per request
        proxy_set_header X-Correlation-ID $req_id;
    }
}
```

**Alternative for local dev without docker:** Backend serves static frontend files (`http.ServeFile`) on port 8080 behind the `/api/` prefix — same-origin by construction. This is the simpler approach for single-host.

**Chosen approach for Phase 5:** Backend serves static frontend files on port 8080 (single binary, everything on one port). Remove nginx service from docker-compose for MVP. Add `go-fsnotify` or similar only if hot-reload is needed; a simple Makefile target for `cp dist/index.html backend/static/` suffices.

---

### ADR-009: UUID Generation Strategy (NEW — Phase 3 Gap Closure)
**Status**: Proposed → Must be accepted before implementation

**Problem:** Database-side UUID default values (`gen_random_uuid()`, `uuid_generate_v4()`) don't work consistently across SQLite and PostgreSQL without CGO or extensions.

**Decision:** Generate all UUIDs in Go application code using `github.com/google/uuid` (or RFC-4122 via `crypto/rand` + fmt.Sprintf). Every INSERT explicitly specifies the UUID string value:

```go
id := uuid.New().String()
_, err := db.Exec("INSERT INTO columns (id, title, board_scope, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())", id, title, scope)
```

Migration SQL files contain NO default values for `id`:
- PostgreSQL: `id UUID PRIMARY KEY` (not `DEFAULT gen_random_uuid()`)
- SQLite: `id TEXT PRIMARY KEY`

This makes migrations 100% portable. Go's `uuid.New()` produces v4 UUIDs per RFC-4122 in all environments, no CGO required.

**Impact on existing ADR-003-B:** Update migration SQL to remove `DEFAULT gen_random_uuid()` from both tables.

---

### ADR-010: Request-ID Propagation Standard (NEW — Phase 3 Gap Closure)
**Status**: Proposed → Must be accepted before implementation

For log-span correlation and observability story compliance:

| Header | Generated By | Forwarded By | Purpose |
|--------|-------------|-------------|---------|
| `X-Request-ID` | Ingress (nginx/otelhttp) | All layers | Unique per HTTP request; correlates logs across all handlers |
| `traceparent` | OTel W3C TraceContext extractor | All layers (auto by middleware) | Distributed tracing context per spec |
| `X-Correlation-ID` | Same as X-Request-ID | All layers | Alias for observability tooling that expects this name |

In Go middleware, extract/set:
```go
func requestIDMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        reqID := r.Header.Get("X-Request-ID")
        if reqID == "" {
            reqID = uuid.New().String()
        }
        ctx := context.WithValue(r.Context(), "requestID", reqID)
        // Also inject into OTel context for automatic propagation
        ctx = otelctx.WithValue(ctx, requestIDKey{}, reqID)
        w.Header().Set("X-Request-ID", reqID)
        w.Header().Set("X-Correlation-ID", reqID)
        
        r = r.Clone(ctx)
        next.ServeHTTP(w, r)
    })
}
```

---

## Implementation Readiness Check — Phase 3 Final Validation

### Checklist (all must pass before Phase 5: Implementation)

- [x] **PRD exists**: `docs/prd.todo-board.md` with binding acceptance criteria ✓
- [x] **Phase 4 Epics & Stories exist**: `docs/epics-and-stories.todo-board.md` + `docs/epics-and-stories.observability.md` (PR #10 merged) ✓
- [x] **Architecture decisions documented**: This file (10 ADRs, 3 new gap-closers from Phase 3 re-validation) ✓
- [x] **Technology stack unambiguous**: Go stdlib + SQLite (dev)/Postgres (prod) + vanilla HTML/CSS/JS + dnd-kit CDN + docker-compose ✓
- [x] **API contract specified**: All endpoints, schemas, error formats in ADR-002 ✓
- [x] **Database schema defined**: Columns and notes tables per ADR-003-B (updated with ADR-009) ✓
- [x] **UUID generation strategy resolved**: Go-side UUIDs only — no DB-side defaults ✓ (ADR-009)
- [x] **CORS/reverse-proxy resolved**: Backend serves all static files on single port 8080 — zero CORS needed ✓ (ADR-008)
- [x] **Request-ID standard defined**: X-Request-ID + traceparent + X-Correlation-ID across all layers ✓ (ADR-010)
- [x] **Observability pillars agreed**: Health probes, structured logging, OTel tracing → DOD-1 through DOD-5 mapped to OBE stories ✓
- [x] **Cardinality budget validated**: 10 unique values max per resource attribute — enforced in OBE story acceptance criteria ✓ (ADR-005-fix)
- [x] **Execution order clear**: critical path documented below ✓
- [x] **Non-goals deferred**: Auth, real-time sync, mobile, file attachments, themes ✓
- [x] **dnd-kit version pinning noted as coding task**: Must be pinned at implementation time ✓

### Remaining Gaps — Handled by Target Personas

| Gap | Owner | Action |
|-----|-------|--------|
| UUID in migration SQL (no DEFAULT) | **Coder** (Story M1) | Implement per ADR-009 |
| Backend serves static frontend (ADR-008) | **Coder** (Stories B1, C1, etc.) | Single-port architecture |
| dnd-kit CDN version pinning | **Coder** (Story TB-S06/D1) | Pin exact unpkg.com version |
| OBE story observability implementation | **O11y Engineer** (via stories) | See epics-and-stories.observability.md |
| Acceptance criteria testability review | **Code Reviewer** | Validate GWT ACs match automated test patterns |

---

## Execution Order (Critical Path)

```
Phase 5 Stories (Feature Epic):         OBE Stories (Observability Overlay):
─────────────────────────────           ───────────────────────────────────

DB schema migration (M1/S) ─────────► OBE-1: OTel auto-instrumentation FIRST
        │                                        │
        ├── Backend columns CRUD (C1/B1/S)     │    (blocks everything else)
        ├── Backend notes CRUD   (S)            │    
        └── Move endpoint + health (S)          ▼
                                          OBE-2: Health probes + service catalog
        ╰── Frontend board view (M)           │
                                              ├─► OBE-3/OBE-4: Backend tracing in feature code
        ╰── Frontend drag-drop-edit-delete (M)│
                                              ▼
                                          OBE-5: Frontend browser OTel
                                              │
                                             ▼
                                          OBE-6: Dashboard + alerting rules

Final: docker-compose stack + README (TB-S07 / D1/S)
```

### Parallelization Opportunities
- M1 (DB migration) → C1/B1/C2/D1 run in parallel once migrations exist
- Notes CRUD (C2) can start as soon as columns table is created — no inter-dependency
- Frontend board rendering begins as soon as B1 (columns list) and C1 (notes list) APIs are stubbed

---

## Technology Decisions Summary

| Decision | Value | Reference |
|----------|-------|-----------|
| Backend language | Go stdlib `net/http` | ADR-001 |
| Frontend stack | Vanilla HTML/CSS/JS + dnd-kit CDN | ADR-007 |
| Database | PostgreSQL (prod) / SQLite via modernc.org/sqlite (dev) | ADR-003 |
| UUID generation | Go `crypto/rand` / `google/uuid` — NOT DB defaults | ADR-009 |
| Migration tool | golang-migrate | ADR-003 |
| Tracing | OTel W3C TraceContext + otelhttp middleware | ADR-005 |
| Metrics | OpenTelemetry prometheus exporter | ADR-005 |
| Logging | `log/slog` JSON handler | ADR-005 |
| Request-ID header | `X-Request-ID` generated at ingress, forwarded everywhere | ADR-010 |
| Deployment | Single-port Go binary serving static files + API | ADR-008 |
| Reverse proxy (dev) | Nginx with `/api/*` → backend proxy pass (optional) | ADR-008 |

---

*Produced by Winston (Architect, BMAD Phase 3). Phase 3 re-validated and gaps closed. Ready for handoff.*
*Architecture base: PR #11 (merged). New gap-closers: ADR-008, ADR-009, ADR-010 → see updated branch.*
