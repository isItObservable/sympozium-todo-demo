---
story-id: OBE-S02
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
parent-epic: OBE-EPIC-1 (Foundation — Observability Platform)
created-by: Story Writer (John)
trace-from-prd: AC5 (health endpoints), G4 (reliability)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S02 — Health Probes (`/livez` and `/readyz`) with Dependency Checks

## As a platform operator, I want each Kanban service to expose liveness and readiness probes that exercise real dependencies (database), so Kubernetes or Docker can distinguish infra failures from application-level degradation.

> **Maps to PRD AC5:** `GET /health` returns `{"status":"ok"}` with HTTP 200; `GET /readyz` returns HTTP 200 when DB connection is valid, 503 when it is not.  
> **Maps to PRD G4:** reliability / hosting.  
> **Maps to Architecture:** ADR-003-B (DB layer, conn-pool health), ADR-005 (three pillars of health probes).

---

## Context

This story adds two HTTP endpoints that Kubernetes (or Docker health checks) use for pod lifecycle management. Both must **exercise real dependencies** — they must NOT just return HTTP 200 because the Go process is alive:

1. **`/livez` (liveness probe):** Returns 503 if the underlying database store is unreachable or permanently broken. Checks only "can I still talk to my DB at all?"
2. **`/readyz` (readiness probe):** Returns 503 if the connection pool is exhausted or if any service dependency is down. The readiness check must actually probe the DB to prove it can acquire a connection (not just return 200 on other paths).

Both endpoints must be **public** — no authentication middleware may block them, since kubelet sends these probes directly.

The go.mod already pulls OpenTelemetry dependencies from OBE-S01; this story reuses the OTel `config.EnvEnv()` to align health-reporting with trace context headers.

---

## Acceptance Criteria (Given/When/Then)

### AC1: `/livez` returns healthy status when database is reachable

**Given:** The backend server is running  
**And:** The PostgreSQL or SQLite database is healthy and accepting queries  
**When:** a client sends `GET /livez` to the application's health port  
**Then:**
- The HTTP response status code is exactly **200 OK**
- The response body is valid JSON: `{"status":"ok","dependency":{"db":"healthy"}}`
- The Content-Type header is `application/json; charset=utf-8`

### AC2: `/livez` returns 503 with degraded dependency state when database is unreachable

**Given:** The backend starts with `DATABASE_URL` pointing to a non-existent host (e.g., `postgres://no-such-host:5432/foo`)  
**When:** a client sends `GET /livez` after the application has started  
**Then:**
- The HTTP response status code is exactly **503 Service Unavailable**
- The body contains: `{"status":"degraded","dependency":{"db":"unhealthy"}}`

### AC3: `/readyz` returns 200 when the database connection pool is healthy and accepting queries

**Given:** The backend server is running  
**And:** The PostgreSQL or SQLite database is healthy  
**When:** a client sends `GET /readyz` to the application's health port  
**Then:**
- The HTTP response status code is exactly **200 OK**
- The body contains: `{"status":"ok","dependency":{"db":"healthy"}}`
- The Content-Type header is `application/json; charset=utf-8`

### AC4: `/readyz` returns 503 when the database connection pool is exhausted or unreachable

**Given:** The backend server is running  
**And:** the database connection pool is full OR the database itself is unreachable  
**When:** a client sends `GET /readyz` to the application's health port  
**Then:**
- The HTTP response status code is exactly **503 Service Unavailable**
- The body contains: `{"status":"degraded","dependency":{"db":"unhealthy"}}`

### AC5: Health endpoints are accessible without authentication

**Given:** Any authenticated routes exist in the API  
**When:** a client sends `GET /livez` or `GET /readyz`  
**Then:**
- No 401 or 403 response is returned (the paths bypass auth middleware entirely)
- The endpoints are accessible to kubelet / Docker health probes

---

## Technical Implementation Notes

- **Location:** `/backend/internal/http/health_handler.go`
- Implement two handler functions: `HandleLivez(w, r *http.Request)` and `HandleReadyz(w, r *http.Request)` — both registered in `main.go` at the routes `/livez` and `/readyz` respectively.
  - `/livez` does a shallow DB "ping" (e.g., `db.Ping()`)
  - `/readyz` acquires a connection from the pool by executing a lightweight query (`SELECT 1`)
  - If either operation panics or returns an unrecoverable error, return HTTP 503 with `"dependency":{"db":"unhealthy"}`
- **Never add authentication** to these two handlers (they must be public for K8s probe access)
- Do NOT crash the application on health check failure — retry gracefully on every probe. If health checks fail repeatedly, Kubernetes will restart the pod; the Go app does not self-crash.

---

## Output / Deliverables

1. `internal/http/health_handler.go` with `/livez` and `/readyz` route handlers
2. Route registration in `main.go`: `http.HandleFunc("/livez", healthHandler.HandleLivez)` + `/readyz` equivalent
3. Test file: `tests/health_test.sh` or Go integration test verifying healthy/unhealthy probe scenarios under both SQLite and Postgres

## Dependencies

**Requires:** TB-S01 through TB-S04 (database migrations must exist and be running). Must be implemented after the database layer exists.  
Can be parallelized with OBE-S03.

## Estimate

S (1–2 hours for a Go developer)
