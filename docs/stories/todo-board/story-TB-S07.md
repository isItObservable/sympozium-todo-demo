---
story-id: TB-S07
phase: 4
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
created: 2026-07-03
updated: 2026-07-12
---

# Story TB-S07 — Docker-Compose Stack, Multi-Stage Backend Build & README with BMAD Artifact Links

## As a developer or reviewer, I want the full stack (backend + database + frontend) to start with one `docker-compose up` command and documented in a README that links to all BMAD phase artifacts, so anyone can run and verify the app from zero.

**Maps to**: PRD FR7 (Containerization & Local Stack), FR8 (Observability & Testability — test execution docs), AC4 (`docker-compose up` works), AC5 (README documents architecture, local setup, tests, BMAD links), G3 (single-command stack), G4 (tests 80%+ line coverage confirmed)  
**ADR References**: ADR-004 (project structure including docker-compose.yml, Dockerfile, Makefile)

## Background / Context

PRD requires: "Each service (backend, database, frontend) MUST be containerized. A `docker-compose.yml` at the project root starts the full stack with one command."

The README serves as both onboarding and BMAD artifact manifest — anyone examining repo history must see Phase 1→4 deliverables linked.

## Acceptance Criteria (Given/When/Then)

### AC1: `docker-compose.yml` defines exactly three services

**Given** the project root contains `.env` or `.env.example` with DATABASE_URL and other config  
**When** a user examines the top-level `docker-compose.yml`  
**Then** the file defines these exact services:
- **backend**: built from `Dockerfile`, depends on `db`, ports 8080 mapped (or same port for single-container setup), environment variables from `.env`: `{DATABASE_URL, OTEL_EXPORTER_JAEGER_ENDPOINT?, OTEL_EXPORTER_PROMETHEUS_ENDPOINT?}`
- **db**: using either `postgres:15-alpine` image or `sqlite` volume mount (configurable via env): `POSTGRES_DB=todo`, `POSTGRES_USER=todo`, `POSTGRES_PASSWORD=todo`
- **frontend** or **nginx**: serving `frontend/` static files on port 80, proxying `/api/*` to the backend service

**Scenario 1.1: Configurable database backend**  
**Given** DATABASE_URL is set in `.env`  
**When** compose starts  
**Then**:
- If DATABASE_URL starts with `postgres://`, uses the Postgres service
- If it starts with `file:` or is empty, runs SQLite in-memory or file-backed in the same container

### AC2: `docker-compose up -d` starts all services with no errors within 30 seconds

**Given** Docker and docker-compose are installed  
**When** a user runs `docker-compose up -d` from the project root  
**Then**:
- All three services transition to "healthy" or "running" state within 30 seconds
- No error output appears in `docker-compose logs`
- Services start in the correct order (db first, then backend depends-on-db, then frontend)

### AC3: The Kanban board is accessible in a browser at `http://localhost`

**Given** `docker-compose up -d` completed successfully  
**When** a user opens `http://localhost` in their browser  
**Then**:
- The board renders horizontally with columns and notes (at minimum, the "To Do" column is visible)
- No HTTP 404 or blank page errors are returned from the container
- The browser console shows no unhandled JS fetch errors

### AC4: README documents architecture diagram, local setup, test commands, and BMAD artifact links

**Given** `README.md` exists at the project root  
**When** a human reads it  
**Then** it contains ALL of these sections:
1. **Architecture Diagram** (text-based or Mermaid) showing backend → db and frontend flow
2. **Local Setup**: step-by-step `docker-compose up` instructions + `.env` configuration
3. **Test Execution**: how to run unit tests (`go test ./...`) and API integration tests locally
4. **API Endpoints**: a table listing all REST endpoints (from ADR-002) with sample curl commands
5. **BMAD Phase Artifacts** — clickable links to: this PRD, Architecture doc (all ADRs), this Epic/Stories backlog
6. **Folder Layout** explanation matching ADR-004

**Scenario 4.1: README renders correctly in GitHub**  
**Given** the `README.md` file is in the repo root  
**When** viewing it on GitHub's web UI  
**Then**:
- The Mermaid or ASCII diagram renders (no broken formatting)
- All relative links resolve correctly

### AC5: Backend integration tests run inside a Docker container successfully

**Given** the backend service image is built via `docker-compose build`  
**When** a user runs `docker-compose run --rm backend go test ./...` or `make test`  
**Then**:
- All unit and API tests pass (exit code 0)
- Tests use the same SQLite backend as development (no external mocks of the database driver)

**Scenario 5.1: Test against PostgreSQL**  
**Given** the Postgres service is started via compose  
**When** `DATABASE_URL=postgres://todo:todo@db:5432/todo go test ./...` runs in the container  
**Then** the same tests pass on PostgreSQL (not only SQLite)

## Technical Implementation Notes

- `Dockerfile` for backend uses multi-stage build:
  - Stage 1: `golang:1.22-alpine` builder — `go mod download`, `go build -o bin/server`
  - Stage 2: `alpine:3.19` — copy binary, non-root user
- `docker-compose.yml`: use `depends_on` with health check condition to ensure db starts before backend
- For frontend: either a separate nginx image (`nginx:alpine`) serving `./frontend:/usr/share/nginx/html:ro`, or serve frontend from the Go backend via a single Dockerfile using the same binary (since ADR-001 allows one binary — use Go's `http.FileServer` to serve `/` and the static folder)
- `.env.example` contains placeholder values for all configuration variables

## Output / Deliverables

1. Top-level `docker-compose.yml`
2. Top-level `Dockerfile` (multi-stage backend build)
3. `.env.example` with DATABASE_URL and optional OTEL config
4. Top-level `Makefile` with targets: `build`, `migrate-up`, `serve`, `test`, `db-start`, `stop`
5. Updated `README.md` at project root (with architecture, setup, tests, BMAD links)

## Dependencies: All backend stories (TB-S01 through TB-S06) must be implemented first

## Estimate: S

---

*Written by Story Writer — traces to PRD FR7/FR8/AC4/AC5/G3/G4, Architecture ADR-004/ADR-007*
*Updated 2026-07-12: GWT formatting standardized; "THEN" → "then" for consistency.*
