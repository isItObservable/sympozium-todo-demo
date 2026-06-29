---
story-id: OBE-S02
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: OBE-EPIC-1 (Foundation — Observability Platform)
created-by: Story Writer (John)
trace-from-prd: G4 (hosting/serving reliability), AC5 (health endpoint requirement)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S02 — Health Probes (/livez and /readyz with dependency checks

As a **platform operator**,  
I want **each Kanban API endpoint to have liveness/readiness health checks + registered as a monitored entity in Dynatrace/OTel services map**,  
So that **I can instantly distinguish between infra failures vs. app-level degradation**.

> **Maps to PRD AC5 (health endpoint):** "A health endpoint GET /health on each service returns {status:'ok'} with HTTP 200"
> **Also maps to:** PRD G4 (reliability)  
> **Maps to Architecture:** ADR-003-B (DB layer, conn-pool health), ADR-005 (Observability: three pillars of health probes, structured logging, request tracing)  
> **Previous Epic Story:** "OBE-2 — Define service catalog and health probes for every endpoint"

---

## Context

This story adds two endpoints that Kubernetes uses for pod lifecycle management. These must **exercise real dependencies** — not just return HTTP 200 because the Go process is alive:

1. `/livez` (liveness): Returns 503 if the underlying database store is unreachable or permanently broken. This checks only "can I still talk to my DB at all?"
2. `/readyz`: Returns 503 if the connection pool is exhausted, or if any service dependency is down. The readiness check must actually probe the DB to prove it can acquire a connection (not just return 200 on every other path).

Additionally, these endpoints register themselves with the OTel/Dynatrace service catalog so they appear in the services map automatically.

---

## Acceptance Criteria (Given/When/Then)

### AC1: /livez returns status checks and dependency states correctly

**Given:** The backend server is running
**And:** The PostgreSQL/SQLite database is healthy and accepting queries  
**When:** `GET /livez` is sent  
**THEN:** response status is 200 with body `{"status":"ok","dependency":{"db":"healthy"}}`  
 
 **AND**: Content-Type header is `application/json; charset=utf-8`, and expires headers are present

 **Given:** The database is down or unreachable (e.g., `DATABASE_URL=postgres://no-such-host:5432/foo`)
**When:** a fresh start of the backend triggers `/livez`  
**THEN:** response status is 503 with body `{"status":"degraded","dependency":{"db":"unhealthy"}}`

 **Given:** The database recovers (becomes healthy again)
**And:** at least one previous request returned 503 from /livez  
**When:** `GET /livez` is sent again after recovery  
**THEN:** response returns to status 200 with body indicating both the db dependency state

### AC2: All HTTP endpoints have liveness / readiness checks configured

**Given:** The OTel service catalog or Dynatrace services map is accessible from backend config (e.g., `SERVICE_CATALOG_URL` env var is set).
**WHEN:** any `/api/columns/*` or `/api/notes/*` endpoint is registered in `main.go`  
**AND**: those endpoints register themselves via the OTel/Dynatrace service catalog API (automatic per ADR-005) 
 **THEN**: they immediately appear in the Dynatrace services map as monitored entities under the kanban-backend service

### AC3: Kubernetes liveness/readiness probes use /livez and /readyz

**Given:** The Dockerfile or docker-compose.yaml defines container port `412` and exposes `/livez` and
**And**: The OTEl config file has entries for `/livez` and `/readyz` routes  
**THEN**: these endpoints are not blocked by authentication middleware (must be public for health probes)

 **AND**: If the database connection pool becomes full, the readiness probe MUST reflect that: a request to `/readyz` when `pool_exhausted=true` returns 503.

### AC4: Database error handling in health checks is graceful

 **Given:** The backend is connected to a healthy PostgreSQL
**WHEN:** `GET /livez` arrives at exactly the moment a brief DB connection fails (e.g., network blip) 
**AND:** the handler returns 503 with `"dependency":{"db":"unhealthy"}` 

**AND:** this does NOT crash or restart the Go process — it retries gracefully on every probe.

---

## Implementation Notes

- **Where it lives**: `/backend/internal/http/health_handler.go`
- Implement functions: `HandleLivez(w, r)`, `HandleReadyz(w,r). Use db conn-pool to determine state.
- Do NOT add authentication to these handlers (they must be public for K8s probe access).
- Test: `HealthHandler test (e.g., via go test -v` in `tests/health_test.sh`. 

## Dependencies

**Requires:** TB-S01 through TB-S07, OBE-S01 (database migrations must exist; OTel SDK must be init'ed). Must be implemented after database layer exists. 

## Estimate

S (1–2 hours for a Go developer)