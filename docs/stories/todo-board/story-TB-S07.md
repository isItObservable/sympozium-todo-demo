---
story-id: TB-S07
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: EPIC-TB-7
created-by: Story Writer (John)
trace-from-prd: FR7, FR8, AC4, AC5, G3
source-epics-file: epics-and-stories.todo-board.md
---

# Story TB-S07 — Docker Compose Stack and README with BMAD Artifact Links

As a developer, I want the full stack running in one `docker-compose up` command so anyone can run the app locally for demos or development.

> **Maps to PRD AC4 (README), G3 (hosting)**  
> **Maps to Architecture:** ADR-001 (boring tech: no framework lock-in, simple compose stack)  
> **Previous Epic Story:** "Docker-compose stack and README with BMAD artifact links"

---

## Context

This story packages everything into a local development environment using Docker Compose. The stack includes the Go backend, Nginx serving the static frontend, and PostgreSQL as the database. All services are orchestrated via a single `docker-compose.yml`.

The README must document architecture diagram, setup steps, test execution commands, and link to all BMAD phase artifacts (PRD, Architecture doc, Epics/Stories).

---

## Acceptance Criteria (Given/When/Then)

### AC1: docker-compose.yml defines backend, frontend + database services

**Given**: The repository root contains `docker-compose.yml`  
**When**: Docker Compose parses the file (`docker compose config` runs with no errors)  
**Then**: Three services are defined:
  - **backend**: Go binary (multi-stage build from Dockerfile), port forwarded to host 8080
  - **frontend**: Nginx container serving static files from `frontend/`, port 80 on host
  - **postgres**: PostgreSQL service with named volume for data persistence

### AC2: docker-compose up -d starts all services with no errors

**Given**: Docker and Docker Compose are installed  
**When**: A user runs `docker compose up -d` in the repo root from a clean state  
**THEN**: The command completes without errors (exit code 0)
**AND**: All three containers show `Up` status via `docker ps`
**AND**: PostgreSQL has initialized its data directory successfully

### AC3: Board accessible at http://localhost in a browser after compose starts

**Given**: Compose stack is running (`docker compose up -d`)  
**When**: A user opens `http://localhost` in a browser  
**THEN**: The Kanban board UI loads and displays correctly (no 502/504 proxy errors)
**AND**: API calls from the frontend to `/api/columns/` succeed (verified via browser DevTools Network tab showing 200 responses)

### AC4: README documents architecture diagram, setup steps, test commands, BMAD artifact links

**Given**: A user opens `README.md` in the repo root  
**When**: They read through it
**THEN**: They find a text-based architecture diagram showing Backend → PostgreSQL → Frontend topology (ASCII art or Mermaid)
**AND**: Step-by-step instructions for local setup: "clone → docker compose up → open localhost"
**AND**: Test execution section with commands:
**AND**: `go test ./...` for backend integration tests
**AND**: Links to all BMAD phase artifacts:
  - PRD.md (`docs/prd.md`)
  - Architecture.md (`docs/architecture.md`)
  - Epics & Stories (`docs/epics-and-stories.*.md`)

### AC5: Backend integration tests run inside container (`go test ./...` succeeds)

**Given**: All services are up via `docker compose up -d`  
**WHEN**: A shell script runs inside the backend container: `docker compose exec backend go test ./...`  
**AND**: The same command is available in Makefile as `make test-backend`
**THEN**: The command completes with exit code 0 and shows that all integration tests pass

---

## Implementation Notes

- `Dockerfile`: Multi-stage build for Go:
  - Stage 1 (`golang:1.23-alpine`): `go mod download`, `go build -o /bin/app ./cmd/api`
  - Stage 2 (`alpine:latest`): Copy binary from stage 1, expose port 8080
- `docker-compose.yml`: Three services (backend, frontend, postgres). Frontend uses `nginx:alpine`, mounts `./frontend:/usr/share/nginx/html:ro`. Backend depends_on postgres. Use named volume for data persistence.
- Nginx config (`frontend/nginx.conf`) reverse proxy from `/api/` to backend:8080 and serve static files otherwise.
- Add `Makefile` with targets: `make build`, `make up`, `make down`, `make test-backend`, `make migrate`.

---

## Dependencies

Requires: TB-S01 through TB-S06 (backend code + frontend UI must be complete)

## Estimate

S (1–2 hours for a developer comfortable with Docker and Nginx config)
