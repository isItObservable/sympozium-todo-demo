# Phase 4 Stories — Consolidated Backlog Summary

## The Kanban Board MVP — 13 Implementation-Ready Stories

This directory (`docs/stories/`) contains **13 independently implementable stories** decomposed from the PRD and epics document. Each story is:

- ✅ In GWT (Given/When/Then) acceptance criteria format
- ✅ Fully traceable to its source PRD requirement(s)
- ✅ Self-contained with background context, technical notes, and exact deliverables
- ✅ Sized for a single coding agent run (S or M)
- ✅ Explicitly tagged with its dependencies on other stories

### Execution Dependency Graph (Critical Path)

```
  TB-S01 (Migrations) ──┬──→ TB-S02 (Columns CRUD)
                        ├──→ TB-S03 (Notes CRUD)
                        └──→ TB-S04 (Move + Health)

  TB-S02, TB-S03, TB-S04 ──→ TB-S05 (Board Rendering)
                                      │
                                      ▼
                                  TB-S06 (DnD + Edit + Delete)

  TB-S01 → OBE-S01 (Telemetry SDK) ← OBE-S02 (Health Probes)
                                              │
    TB-S01 + OBE-S01 ──→ OBE-S03 (CRUD Tracing) ←── OBE-S05 (Prometheus)
                                              │
                                              ▼
                                          OBE-S06 (Span Validation)

  ALL stories ──→ TB-S07 (Docker + README)
```

**Critical path:** `TB-S01 → TB-S02/TB-S03/TB-S04 → TB-S05 → TB-S06 → TB-S07`

### Stories by Epic

#### Epic 1: Database & Foundation (TB-S01, OBE-S01)
| Story | File | Depends On | Estimate | Status |
|-------|------|------------|----------|--------|
| TB-S01 | `docs/stories/todo-board/story-TB-S01.md` | *none* | S | ✅ READY |
| OBE-S01 | `docs/stories/observability/story-OBE-S01.md` | *none* | S | ✅ READY |

#### Epic 2: Backend CRUD (TB-S02, TB-S03, TB-S04)
| Story | File | Depends On | Estimate | Status |
|-------|------|------------|----------|--------|
| TB-S02 | `docs/stories/todo-board/story-TB-S02.md` | TB-S01 | S | ✅ READY |
| TB-S03 | `docs/stories/todo-board/story-TB-S03.md` | TB-S01, TB-S02 | S | ✅ READY |
| TB-S04 | `docs/stories/todo-board/story-TB-S04.md` | TB-S01, TB-S02, TB-S03 | S | ✅ READY |

#### Epic 3: Frontend (TB-S05, TB-S06)
| Story | File | Depends On | Estimate | Status |
|-------|------|------------|----------|--------|
| TB-S05 | `docs/stories/todo-board/story-TB-S05.md` | TB-S02–S04 | M | ✅ READY |
| TB-S06 | `docs/stories/todo-board/story-TB-S06.md` | TB-S05 | M | ✅ READY |

#### Epic 4: Observability (OBE-S02, OBE-S03, OBE-S04, OBE-S05, OBE-S06)
| Story | File | Depends On | Estimate | Status |
|-------|------|------------|----------|--------|
| OBE-S02 | `docs/stories/observability/story-OBE-S02.md` | TB-S01–S04 | S | ✅ READY |
| OBE-S03 | `docs/stories/observability/story-OBE-S03.md` | TB-S01, OBE-S01 | M | ✅ READY |
| OBE-S04 | `docs/stories/observability/story-OBE-S04.md` | *see file* | M | ✅ READY |
| OBE-S05 | `docs/stories/observability/story-OBE-S05.md` | TB-S01–S04, OBE-S03 | M | ✅ READY |
| OBE-S06 | `docs/stories/observability/story-OBE-S06.md` | OBE-S03, OBE-S05 | S | ✅ READY |

#### Epic 5: Containerization & Docs (TB-S07)
| Story | File | Depends On | Estimate | Status |
|-------|------|------------|----------|--------|
| TB-S07 | `docs/stories/todo-board/story-TB-S07.md` | ALL backend + frontend stories | S | ✅ READY |

---

## PRD Traceability Overview (Quick Reference)

Every PRD requirement is covered. See [TRACEABILITY-MATRIX.md](../TRACEABILITY-MATRIX.md) for the complete mapping with verified GWT AC line references.

| PRD Requirement | Stories Covering It |
|-----------------|---------------------|
| FR1 — Columns CRUD API | TB-S02 (AC1–AC5) |
| FR2 — Notes CRUD API | TB-S03 (AC1–AC5) |
| FR3 — Move Notes Between Columns | TB-S04 (AC1–AC4) |
| FR4 — REST Contract + RFC 7807 Errors | TB-S02 AC5, TB-S03 AC5, TB-S04 (all) |
| FR5 — DB Persistence & Migrations | TB-S01 (all ACs), TB-S07 (docker parity) |
| FR6 — Frontend SPA Board View | TB-S05 (AC1–AC4), TB-S06 (all ACs) |
| FR7 — Containerization & docker-compose | TB-S07 all (AC1–AC5) |
| FR8 — Observability + Tests | OBE-S01–S06 (full coverage) |
| AC1 (Board with 3 columns) | TB-S02 AC1, TB-S05 AC1 |
| AC2 (Create note via UI + API) | TB-S03 AC2, TB-S05 AC3–AC4 |
| AC3 (Drag-and-drop between columns) | TB-S06 AC1–AC2 |
| AC4 (CRUD with RFC 7807 errors) | TB-S02 AC5, TB-S03 AC5 |
| AC5 (/health + /readyz endpoints) | TB-S04 AC5, OBE-S02 all ACs |
| AC6 (docker-compose up works) | TB-S07 AC1–AC3 |
| AC7 (README with BMAD links) | TB-S07 AC4 |

---

## GWT Quality Gate

Before any coding agent begins implementation, verify:

- [ ] Every story has its own section for **Context/Background** explaining *what* and *why*
- [ ] Every story has **Given/When/Then acceptance criteria** — no bullet-point-only ACs
- [ ] Each GWT scenario covers at least one negative/error path (not just the "happy path")
- [ ] Dependencies between stories are explicitly named (not inferred)
- [ ] All PRD requirements map to ≥1 story with ≥1 verified GWT AC

📖 **Read these docs in order:**
1. [PRD](../prd.md) — product definition (G1–G5, FR1–FR8, AC1–AC7)
2. [Architecture](../architecture.md) — ADR-001 through ADR-007 + all sub-ADRs
3. [TRACEABILITY-MATRIX.md](../TRACEABILITY-MATRIX.md) — requirement → story mappings
4. [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — dependency graph, risks, parallelism
5. **Pick one ready story** and implement it → open a PR

---

*Phase 4 artifact set, delivered by Story Writer (John). Ready for Phase 5 Implementation.*
