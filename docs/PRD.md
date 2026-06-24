# PRD: Todo / Virtual Post-It Board

## Problem
The IsItObservable episode needs a live demo of a Kanban-style todo board application. The BMAD crew is practicing the full workflow — this product is both the demo artifact and the vehicle for exercising every BMAD phase. We need a tight, testable MVP that demonstrates proper feature development from PRD through adversarial review.

## Goals (measurable)
- **G1**: Users can create boards with columns (To Do / Doing / Done) — verified by API response + UI rendering in < 1s.
- **G2**: Users can create, edit, delete, and drag-move sticky notes across columns — all CRUD operations tested via unit tests and confirmed in-browser.
- **G3**: The full stack (DB + backend + frontend) runs locally via a single `docker-compose up` — verified by successful health endpoint check within 10s of startup.
- **G4**: Every story has unit/integration tests covering all acceptance criteria — 80%+ line coverage confirmed by CI post each PR merge.

## Functional Requirements
- **FR1**: Backend MUST expose a REST/JSON API with: `GET/POST/PUT/DELETE /boards`, `GET/POST/PUT/DELETE /columns`, `GET/POST/PUT/DELETE /notes`, `PATCH /notes/{id}/move`.
- **FR2**: Backend MUST include a health endpoint (`GET /health`) returning HTTP 200 with `{"status": "ok"}`.
- **FR3**: Backend MUST persist all data to an embedded database (SQLite for MVP; Postgres swappable via env config).
- **FR4**: Backend MUST be containerized (Dockerfile) and run on port 8080.
- **FR5**: Frontend MUST render a board with three columns in a kanban layout, allow creating notes via button or drag-and-drop, and update the display after each operation without full page reload.
- **FR6**: Frontend MUST communicate with the backend API for all state changes (no hard-coded data).
- **FR7**: README MUST document how to run the full stack locally including docker-compose instructions, env vars, and API endpoints.

## Non-goals (deferred)
- User authentication / multi-board support
- Real-time WebSocket sync between clients
- Mobile app or native build
- File attachments on notes
- Theme/customization options

## Acceptance Criteria (binding)
- [ ] **AC1**: Backend exposes CRUD for boards, columns, and notes plus `PATCH /notes/{id}/move` — all with unit tests and verified in CI.
- [ ] **AC2**: Backend health endpoint responds HTTP 200 `{"status":"ok"}` within 5s of container start.
- [ ] **AC3**: Database schema and migrations create boards, columns, and notes tables/records on first run (zero manual setup).
- [ ] **AC4**: Frontend renders the board UI with three columns, displays notes as sticky cards, and allows create/move/delete via drag-and-drop (or click-to-move fallback).
- [ ] **AC5**: Frontend talks to the backend API for all operations — no mock/static data.
- [ ] **AC6**: `docker-compose up` brings up DB + backend + frontend; running `curl localhost:<port>/health` returns `{"status":"ok"}` within 10s.
- [ ] **AC7**: README in repo root explains how to run the stack, API endpoints, and folder layout.

## Risks & Open Questions
- Tech stack preference? (Node/Express + SQLite vs Python/FastAPI + SQLite — TBD by architect)
- Should the frontend be a raw HTML/JS SPA or something like React/Vue? Architect's call.
- CI: do we need GitHub Actions for lint/tests on every PR, or just local verification?
