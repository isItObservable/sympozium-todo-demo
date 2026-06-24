# Architecture Document: sympozium-todo-demo

Produced by: Winston (Architect, BMAD Phase 3)
Date: 2025-06-24
Trace: traceparent `${TRACEPARENT:-derived from trace-context.json}`

## Decision Log

### ADR-001: Technology Stack — Boring Go Stdlib Server + Single HTML Frontend
**Status**: Accepted
**Why**: The demo is for observability demonstration, not technology exploration. Go's stdlib `net/http` eliminates framework dependencies, keeps container sizes small (~20MB alpine), and has built-in HTTP tracing support via `otelcontribco/otel-go-contrib`. The frontend uses vanilla HTML/CSS/JS — no build step needed, no webpack, no npm lock-in. This is the "boring technology" principle: pick what works today and avoids distraction from the true observability goals (G3).
**Trade-offs**: 
- No ORM boilerplate reduction → hand-written SQL/queries (fine for MVP scope)
- No frontend framework reactivity → manual DOM updates (acceptable for demo scale)
- No auto-swagger → explicit API docs in ADR-002

### ADR-002: RESTful API Contract — Uniform JSON, Standard Methods
**Status**: Accepted
**Why**: Everyone understands standard REST patterns. POST to create, GET to list/retrieve, PATCH to update status, DELETE by ID. Consistent error responses using RFC 7807 Problem Details where applicable.
**Endpoints**:

| Method | Path | Response 2xx Schema | Error Responses | Rate Limiting |
|--------|------|--------------------|-----------------|---------------|
| GET | `/` | HTML page (UI) | — | — |
| GET | `/health` | `{"status":"ok"}` | 503 if DB down | None needed |
| GET | `/api/todos` | `[Todo]` | 500 on error | — |
| POST | `/api/todos` | `{Todo}` (201) | 400 on bad input, 500 | Rate limit later |
| PATCH | `/api/todos/{id}/status` | `{Todo}` | 404 not found, 400 | — |
| DELETE | `/api/todos/{id}` | `{"deleted":true}` (204) | 404 not found | — |

**Todo schema**:
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "\"pending\" | \"completed\"",
  "created_at": "2025-06-24T10:00:00Z",
  "updated_at": "2025-06-24T10:00:00Z"
}
```

### ADR-003: Database — PostgreSQL (dockerized for demo)
**Status**: Accepted
**Why**: Relational data fits the todo domain exactly. One table, few columns. `pgx` Go driver provides connection pooling and transaction support without an ORM. For the demo phase, a PostgreSQL container is sufficient; future phases can externalize it.
**Schema**:
```sql
CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for filtering by status (used in list view)
CREATE INDEX idx_todos_status ON todos(status);
-- Index for updated_at ordering
CREATE INDEX idx_todos_updated_at ON todos(updated_at DESC);
```

**Migrations**: golang-migrate — one SQL file per migration. Migration runs once on startup; no version config UI yet.

### ADR-004: Project Structure Flat Layout — Backend + Frontend
**Status**: Accepted
**Why**: For a demo app, directory depth is unnecessary cognitive load. One backend module, one frontend directory in the same repo. This makes it easy for any agent to find and modify code during the BMAD implementation phase.

```
sympozium-todo-demo/
├── docs/                    # Architecture decisions, PRD
│   ├── architecture.md      # ← this file
│   └── prd.md               # Product Requirements Document
├── backend/                 # Go application
│   ├── go.mod
│   ├── cmd/
│   │   └── server/
│   │       └── main.go      # Entrypoint — wires up everything
│   ├── internal/
│   │   ├── config/          # Typed configuration struct
│   │   ├── db/              # Database connection, migration runner
│   │   ├── http/            # Routes, handlers, middleware
│   │   │   ├── handler.go   # Controller logic
│   │   │   └── middleware.go  # Tracing, logging, panic recovery
│   │   ├── model/           # Go structs (no ORM tags)
│   │   └── store/           # Repository layer — SQL queries
│   │       └── todo_store.go
│   └── migrations/          # golang-migrate migration files
│       ├── 001_create_todos.up.sql
│       └── 001_create_todos.down.sql
├── frontend/                # Static UI — no build step
│   ├── index.html           # Main board page
│   ├── styles.css           # Post-it visual styling
│   └── app.js               # Fetch calls, DOM updates, rendering
├── docker-compose.yml       # Local development orchestration
├── Dockerfile               # Backend image (multi-stage)
├── .env.example             # Configuration template
└── Makefile                 # Common commands (build, migrate, serve)
```

**Implementation readiness rationale**: This flat structure lets any implementation agent clone → `cd backend && go build` without guessing the package layout. The handler/store separation is the minimum boundary that makes testing possible per-story.

### ADR-005: Observability — Health Endpoints + Structured Log + Request Tracing
**Status**: Accepted
**Why**: Observability is the explicit episode goal (G3). These three pillars are sufficient for MVP and form a reusable baseline for any future demo app:
1. **Health endpoints** (`/health`, `/ready`) — k8s probes, load balancer health checks, CI smoke tests
2. **Structured JSON logging** — every HTTP request logged as structured fields (method, path, status, duration, req_id); logrus or slog JSON handler
3. **Request tracing** — OpenTelemetry propagating w3c `traceparent` headers across the frontend→backend call chain

**Implementation details**:
- `/health` (liveness): returns 200 if server process is alive; checks no panic recovery triggered
- `/ready` (readiness): returns 200 only if DB connection pool can reach PostgreSQL
- Structured logging: standard library `log/slog` with JSON handler → `{"ts":"...","level":"INFO","msg":"request","method":"GET","path":"/api/todos","status":200,"duration_ms":15.3,"req_id":"..."}`
- Tracing: go SDK + auto-instrumented HTTP middleware; each request generates a trace span with parent/child propagation (frontend can emit `traceparent` header via inline script if needed)

### ADR-006: Deployment — Docker Compose for Demo, Kubernetes Manifests Stretch
**Status**: Accepted
**Why**: The demo is live on-air; docker-compose is instantly runnable by any audience member. A single `docker compose up` brings everything online. Kubernetes manifests should be added as a stretch goal if time permits, but the MVP must work with just compose.

```yaml
# docker-compose.yml simplified outline
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
    restart: unless-stopped

  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://demo:demo@db:5432/todos?sslmode=disable
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    restart: unless-stopped

volumes:
  pgdata:
```

---

## Implementation Readiness Check

### Checklist (all must pass before Phase 5: Implementation)

- [x] **PRD exists**: `docs/prd.md` with binding acceptance criteria ✓
- [x] **Architecture decisions documented**: This ADR document covers all major choices ✓
- [x] **Technology stack unambiguous**: Go stdlib + PostgreSQL 16 + vanilla HTML/CSS/JS + docker-compose ✓
- [x] **API contract specified**: REST endpoints, request/response schemas in ADR-002 ✓
- [x] **Database schema defined**: todos table with index in ADR-003 ✓
- [x] **Project structure locked**: Flat layout in ADR-004 — agents know where to work ✓
- [x] **Deployment path exists**: docker-compose.yml ready for local dev; Dockerfile pattern ✓
- [x] **Observability baseline defined**: Health, logging, tracing architecture in ADR-005 ✓
- [x] **No open questions that block implementation**: All risks documented; no blockers remain ✓
- [ ] **Stories decomposed**: Pending — requires Epics & Stories phase (Phase 4)

### Readiness Verdict: READY to proceed to Phase 4 (Epics & Stories)

There are no architectural decisions left undecided. The API contract, schema, stack, and project layout are all specified. The bottleneck is now story decomposition — the next BMAD phase must cut this architecture into implementable stories with acceptance criteria matched to each binding AC from the PRD.

### Constraints For Story Writers and Coders
1. **One file per architectural layer** — handlers stay in `internal/http/`, store queries in `internal/store/`. No cross-layer imports.
2. **Database migrations run before any handler is called** — startup sequence matters.
3. **All responses must include `Content-Type` header** — frontend JSON parsing depends on this.
4. **Error responses use consistent format** — `{ "error": "human readable message" }`, not raw stack traces.
5. **Health endpoints return before app logic loads** — readiness checks DB in < 1s; panic recovery never suppresses /health.
