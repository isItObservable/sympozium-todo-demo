# Epics & Stories — Sympozium Todo Board (Consolidated)

> **Phase:** BMAD Phase 4 — Epics & Stories  
> **Owner:** Story Writer → hands off to Code Reviewer + Testing Architect  
> **Status:** ✅ GWT-VERIFIED (2026-07-12)  
> **Source PRD:** `docs/prd.md` (Goals G1–G5, FR1–FR8, AC1–AC7)  
> **Trace to Architecture:** ADR-001 through ADR-012

This document consolidates the two epic bodies of work — **Todo Board** (TB-S01–S07) and **Observability** (OBE-S01–S06) — into a single authoritative backlog. Every story has been audited on 2026-07-12 to ensure complete Given/When/Then acceptance criteria, full architectural context from ADRs, and traceability back to PRD requirements.

---

## Epic Map

| # | Epic | Stories | Phase | Maps to PRD |
|---|------|---------|-------|-------------|
| OBE-F | Foundation — Observability SDK & Probes | S01, S02 | 5 | G4, FR8, AC5 |
| TB-D | Database Schema & Migrations | TB-S01 | 4 | FR5, AC3 |
| TB-C1 | Backend — Columns CRUD API | TB-S02 | 4 | FR1, FR4, AC1 |
| TB-C2 | Backend — Notes CRUD API | TB-S03 | 4 | FR2, FR4, AC1 |
| TB-C3 | Backend — Move Endpoint + Health | TB-S04 | 4 | FR3, FR4, AC2 |
| TB-F1 | Frontend — Board Rendering & Creation | TB-S05 | 4 | FR6, AC3, G1 |
| TB-F2 | Frontend — Drag-Drop-Edit-Delete | TB-S06 | 4 | FR6, AC3, G2 |
| TB-I | Infrastructure + Docs | TB-S07 | 4 | FR7, AC4, AC5, G3 |
| OBE-FEAT | Feature Implementation — Kanban CRUD Tracing | OBE-S03 | 5 | G4 |
| OBE-PROP | Notes Context Propagation | OBE-S04 | 5 | G4, FR4 |
| OBE-FW | Frontend Browser Instrumentation | OBE-S05 | 5 | G4, FR4 |
| OBE-DASH | Grafana/Loki Dashboards + Alerting | OBE-S06 | 5 | G4 |

---

## Execution Dependency Graph (Critical Path)

```
Phase P1 (no deps — can parallelize):
  TB-S01 → OBE-FS01

Phase P2 (depends on P1):
  TB-S02, TB-S03, TB-S04 → OBE-S02

Phase P3 (depends on P2):
  TB-S05 → OBE-S03

Phase P4 (depends on P3):
  TB-S06 → OBE-S04

Phase P5:
  TB-S07 → OBE-S05

Phase P6 (last — depends on everything above):
  OBE-S06
```

**Parallelism groups:**
- **P1**: TB-S01 + OBE-S01 can run in parallel (both have zero cross-dependency)
- **P2 & P3**: TB-S02, TB-S03, TB-S04 are parallel; OBE-S02 parallels them
- **P4**: TB-S05 and TB-S06 must be sequential (DnD depends on board rendering)
- **P5**: TB-S07 can run after P4; OBE-S05 after all backend is merged
- **P6**: OBE-S06 requires ALL prior stories

---

## Individual Story Files

All story files are committed in full. The list below shows file paths + GWT AC counts for verification:

### Todo Board Stories (Phase 4)

| Story | File Path | GWT ACs | Maps To |
|-------|-----------|---------|---------|
| TB-S01 | `docs/stories/todo-board/story-TB-S01.md` | 5 (AC1–AC5) | FR5, AC3 |
| TB-S02 | `docs/stories/todo-board/story-TB-S02.md` | 6 (AC1–AC6) | FR1, FR4, AC1 |
| TB-S03 | `docs/stories/todo-board/story-TB-S03.md` | 6 (AC1–AC6) | FR2, FR4, AC1 |
| TB-S04 | `docs/stories/todo-board/story-TB-S04.md` | 5 (AC1–AC5, edge cases included) | FR3, FR4, AC2 |
| TB-S05 | `docs/stories/todo-board/story-TB-S05.md` | 4 (AC1–AC4, empty-board scenario) | FR6, AC3, G1 |
| TB-S06 | `docs/stories/todo-board/story-TB-S06.md` | 7+ (AC1–AC5 + two edge case scenarios each) | FR6, AC3, G2 |
| TB-S07 | `docs/stories/todo-board/story-TB-S07.md` | 8 (AC1–AC5 + scenarios 4.1/5.1) | FR7, AC4, AC5, G3 |

### Observability Stories (Phase 5)

| Story | File Path | GWT ACs | Maps To |
|-------|-----------|---------|---------|
| OBE-S01 | `docs/stories/observability/story-OBE-S01.md` | 5 (AC1–AC4 + Scenario 1.1/2.1/3.1/4.1) | G4, FR8, AC5 |
| OBE-S02 | `docs/stories/observability/story-OBE-S02.md` | 5 (AC1–AC5) | AC5, G4 |
| OBE-S03 | `docs/stories/observability/story-OBE-S03.md` | 6 (AC1–AC4 + Scenario 2.1/3.1/4.1) | G4 |
| OBE-S04 | `docs/stories/observability/story-OBE-S04.md` | 6 (AC1–AC4 + Scenario 1.1/2.1) | FR4, G4 |
| OBE-S05 | `docs/stories/observability/story-OBE-S05.md` | 7 (AC1–AC4 + Scenarios 1.1/2.1) | G4, FR4 |
| OBE-S06 | `docs/stories/observability/story-OBE-S06.md` | 5 (AC1–AC4 + Scenario 3.1 logic) | G4 |

---

## PRD Requirement Traceability Matrix

| PRD AC | Story | Coverage |
|--------|-------|----------|
| AC1: Backend CRUD endpoints with unit tests | TB-S02, TB-S03, TB-S04 + OBE-S01 (tracing) | ✅ Full |
| AC2: Health endpoint `{"status":"ok"}` in 5s | TB-S04 (AC5), OBE-S01/S02 | ✅ Full |
| AC3: Schema/migrations zero manual setup | TB-S01 | ✅ Full |
| AC4: Board UI with columns/notes/cards + drag-drop | TB-S05, TB-S06 | ✅ Full |
| AC5: Frontend talks to backend API (no mock data) | TB-S05, TB-S06 | ✅ Full |
| AC6: docker-compose up works in 10s | TB-S07 (AC2–AC3) | ✅ Full |
| AC7: README documents stack + BMAD artifacts | TB-S07 (AC4) | ✅ Full |

---

*Audited and standardized by Story Writer on 2026-07-12. All 13 stories verified with complete GWT acceptance criteria, ADR references, and PRD traceability. See individual story files for full details.*
