# TRACEABILITY MATRIX — Phase 4 Stories ↔ PRD Requirements

## Purpose

This document maps every PRD requirement (Goals, Functional Requirements, Binding Acceptance Criteria) to specific story files and verified GWT AC line references. **Zero orphan requirements** confirmed. If a requirement has no arrow (→ below), it is NOT covered by any story — that is a phase-4 blocker until resolved.

---

## 1. PRD Goals ↔ Stories

| PRD Goal | Story(s) Covering It | Verification Evidence (File: AC #) |
|----------|---------------------|------------------------------------|
| **G1**: Ship MVP Kanban board with CRUD, drag-and-drop, viewable via browser at `http://localhost` after `docker-compose up` | TB-S02, TB-S03, TB-S04, TB-S05, TB-S06, TB-S07 PRD FR1+FR2+FR3 → all CRUD stories. PRD FR6 → TB-S05 AC1-AC2 + TB-S06 AC1-AC2 (drag-drop). | `docs/stories/todo-board/story-TB-S02.md:AC1-AC5`, `story-TB-S03.md:AC1-AC5`, `story-TB-S04.md:AC1-AC4`, `story-TB-S05.md:AC1-AC4`, `story-TB-S06.md:AC1-AC5` |
| **G2**: Ticket-driven implementation (one story per PR), every feature tested, adversarial review before merge | Structural — all 13 stories are independently implementable with tests defined. | Each story AC# section ending in "automated API tests" (TB-S02:AC5, TB-S03:AC5, TB-S04:AC4) + OBE-EPIC scope |
| **G3**: Full stack runs locally via `docker-compose up` with PostgreSQL via `DATABASE_URL` swap, zero additional setup | TB-S01 (SQLite dev parity), TB-S07 AC1-AC6 | `story-TB-S01.md:AC3`, `story-TB-S07.md:AC1-AC2` |
| **G4**: `/health` + `/readyz` + structured logging + OTel tracing spans every request across full stack | OBE-S01 (OTel SDK), OBE-S02 (probes), OBE-S03 (CRUD spans), OBE-S05 (Prometheus metrics), TB-S04 AC5 (basic /health) | `story-OBE-S01.md:AC1-AC4`, `story-OBE-S02.md:AC1-AC5`, `story-OBE-S03.md:AC1-AC4`, `story-OBE-S05.md:AC1-AC4` |
| **G5**: README documents architecture, local setup, test execution, links to all BMAD phase artifacts | TB-S07 AC4 | `story-TB-S07.md:AC4` (explicit: 6 required sections) |

### ✅ GOAL COVERAGE: 5/5 — NO ORPHANS

---

## 2. PRD Functional Requirements ↔ Stories

| PRD FR | Requirement Summary | Story(s) & Verified GWT AC Lines |
|--------|-------------------|----------------------------------|
| **FR1** | Columns CRUD: `GET /api/columns/`, `POST /api/columns/`, `PUT /api/columns/:id`, `DELETE /api/columns/:id` with RFC 7807 errors, proper status codes (200/201/204/404) | **TB-S02** — All ACs: `story-TB-S02.md:AC1(200+array)`, `AC2(201+JSON body)`, `AC3(200 or 404 PUT)`, `AC4(204 cascade+404)`, `AC5(all automated tests)` |
| **FR2** | Notes CRUD: `GET /api/notes/?column_id=:id`, `POST /api/notes/`, `PUT /api/notes/:id`, `DELETE /api/notes/:id` with RFC 7807 errors, proper status codes (200/201/204/404) | **TB-S03** — All ACs: `story-TB-S03.md:AC1(filtered + unfiltered GET)`, `AC2(201+create validation)`, `AC3(PUT 200 or 404)`, `AC4(DELETE 204)`, `AC5(all automated tests)` |
| **FR3** | Move Notes Between Columns: `POST /api/notes/:id/move` with `{columnId}` → 200, 404 for non-existent note, 400 if columnId missing | **TB-S04** — AC1(200 moved), AC2(404 note not found), AC3(400 missing columnId) |
| **FR4** | REST endpoint contract: consistent JSON responses, RFC 7807 error format (`type`, `title`, `status`, `detail`, `instance`), health endpoint returns `{"status":"ok"}` HTTP 200 (or 503 with dependency details) | **TB-S04 AC5** (/health); **TB-S02 AC5, TB-S03 AC5** (RFC 7807 enforced in tests); **OBE-S02 AC1-AC5** (full health probe contract) |
| **FR5** | Database persistence with SQLite dev / Postgres prod via `DATABASE_URL`, specific schema for columns/notes tables, UUIDs, timestamps, indexes | **TB-S01** — All ACs: `story-TB-S01.md:AC1(columns table)`, `AC2(notes table+FK+index)`, `AC3(both engines pass migration)`, `AC4(down-migration drops safely)` |
| **FR6** | Frontend SPA: horizontal columns and sticky-note cards, create notes inline, drag-and-drop between columns via dnd-kit CDN, click to edit inline, no static HTML for column data | **TB-S05** — AC1(horizontal layout from API), AC2(card rendering from API, not hardcoded), AC3(create note form posts to real API), AC4(DOM update without reload); **TB-S06** — AC1-AC5 (all DnD+edit+delete interactions) |
| **FR7** | Containerization: each service containerized; `docker-compose.yml` at project root starts full stack in one command | **TB-S07** — All ACs: `story-TB-S07.md:AC1(3 services defined)`, `AC2(start with no errors)`, `AC3(board accessible at http://localhost)` |
| **FR8** | Observability + Testability: OTel auto-instrumentation (tracing+metrics+logging), liveness/readiness probes, tests covering all CRUD endpoints, README documents test execution | **OBE-S01** (OTel SDK), **OBE-S02** (probes), **OBE-S03** (CRUD span tagging), **OBE-S05** (Prometheus metrics), **TB-S07** (test docs + integration) |

### ✅ FR COVERAGE: 8/8 — NO ORPHANS

---

## 3. Binding PRD Acceptance Criteria ↔ Stories

| PRD AC # | Binding Criteria Summary | Story(s) Proving It | GWT Line Reference |
|----------|------------------------|---------------------|-------------------|
| **AC1** | Board at `http://localhost` shows 3 default columns, rendered via API (no static HTML content) | **TB-S02 AC1-AC2** (columns POST/GET + initial data exists), **TB-S05 AC1-AC2** (board renders horizontally with 3 default columns from API responses) | `story-TB-S05.md:AC1(3 defaults in flexbox row)`, `story-TB-S02.md:AC2(column created via POST)` |
| **AC2** | User creates note via UI (+ button), types title & body, clicks save → POST `/api/notes/` returns 201; card appears without page reload | **TB-S03 AC2** (POST API produces 201 + correct object), **TB-S05 AC3-AC4** ("+" button posts to real API, DOM updates inline) | `story-TB-S05.md:AC3(+)`, `story-TB-S05.md:AC4(no reload)` |
| **AC3** | User drags note card between columns; backend move endpoint responds with correct status; UI updates visually | **TB-S06 AC1-AC2** (DnD via dnd-kit, visual highlights for drop zones), **TB-S04 AC1** (`POST /notes/:id/move` succeeds with 200) | `story-TB-S06.md:AC1(drag between columns)`, `story-TB-S04.md:AC1(verify move API)` |
| **AC4** | All CRUD endpoints return valid JSON + proper HTTP status codes; errors follow RFC 7807 format. Verified by automated API tests. | **TB-S02 AC5, TB-S03 AC5** (both cover every CRUD endpoint with RFC 7807 enforcement in tests) | `story-TB-S02.md:AC5(all verified via automated tests)`, `story-TB-S03.md:AC5(all verified via automated tests)` |
| **AC5** | `GET /health` returns `{"status":"ok"}` HTTP 200; `GET /readyz` returns HTTP 200 when DB valid, 503 when not | **TB-S04 AC5** (basic /health), **OBE-S02 AC1-AC4** (full /livez + /readyz contract with both healthy/unhealthy paths) | `story-TB-S04.md:AC5(health returns ok+200)`, `story-OBE-S02.md:AC1/AC3(/livez 200 or 503, /readyz 200 or 503)` |
| **AC6** | `docker-compose up` starts full stack; board accessible at `http://localhost` with one command, no manual intervention | **TB-S07 AC1-AC3** (compose defines all 3 services, starts with zero errors, board renders on localhost) | `story-TB-S07.md:AC2(docker-compose up -d success)`, `story-TB-S07.md:AC3(board at http://localhost)` |
| **AC7** | README includes architecture diagram, local setup steps, test execution commands, and links to all BMAD phase artifacts | **TB-S07 AC4** (explicitly lists all 6 required sections + BMAD artifact links) | `story-TB-S07.md:AC4(all 6 sections present)` |

### ✅ BINDING AC COVERAGE: 7/7 — NO ORPHANS

---

## 4. Summary of Coverage

| Category | Total Required | Covered | Gap |
|----------|---------------|---------|-----|
| PRD Goals (G1-5) | 5 | 5 | ✅ None |
| Functional Requirements (FR1-8) | 8 | 8 | ✅ None |
| Binding ACs (AC1-7) | 7 | 7 | ✅ None |

### Verification Methodology

- Every PRD requirement was examined line-by-line for mandatory verbs ("MUST", "SHALL").
- Each story file was cross-referenced: does its GWT AC header contain a scenario that directly asserts the PRD requirement?
- Where the PRD says "user action at UI level" (AC1, AC2, AC3), both API layer and UI layer stories were verified as complementary evidence.
- Where the PRD requires test coverage (FR4 AC4 clause "verified by automated API tests"), dedicated test ACs in the relevant stories explicitly define `go test ./...` or equivalent.

**Result: Zero gaps confirmed.** All 20 requirements have at least one story file with an unambiguous GWT assertion covering them.

---

*Authored: Story Writer (John) — Phase 4 completion artifact | Commit reference to be appended on merge.*
