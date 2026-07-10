# IMPLEMENTATION PLAN — Phase 5 Execution Strategy

## Purpose

This document provides every coding agent a ready-to-execute battle card for implementing stories in Phase 5. It includes the full dependency graph, parallelism opportunities, risk assessment, and execution schedule.

---

## Dependency Graph (Detailed)

```
Phase 1: Foundational (can start simultaneously)
├── TB-S01 ──► DB schema migrations (SQLite + Postgres) ──┐
└── OBE-S01 ──► OTel SDK initialization                   │       Phase 2: Backend CRUD (parallel)
                                                               ├──→ TB-S02 ──► Columns CRUD API
                                                          ──→ ├──→ TB-S03 ──► Notes CRUD API
Phase 2.5: Backend extension                               │    └──→ TB-S04 ──► Move + /health
├── OBE-S02 ──► Health probes (/livez, /readyz)           │       Phase 3: Frontend (sequential on S5)
                                                              └──→ TB-S05 ──► Board rendering + create note
Phase 3 (continued):                                      │
├── OBE-S03 ──► CRUD span tracing/attribute tagging      │       Phase 4: DnD, Edit, Delete
├── OBE-S05 ──► Prometheus metrics                       └──→ TB-S06 ──► Drag-drop + edit + delete
                                                           Phase 4.5 (parallel):
Phase 5: Observability features                           ├──→ OBE-S03 (depends on TB-S01 + OBE-S01)
├── OBE-S04 ──► Structured logging middleware            │
├── OBE-S05 ──► Prometheus metrics                       └──→ OBE-S05 (depends on TB-S01 to S04 + OBE-S03)
                                                           Phase 5.x: Final observation
Phase 6: Observability validation                         ├──→ OBE-S06 ──► Span validation script
├── OBE-S06 depends on:                                  │
│   OBE-S03 + OBE-S05 (validates against valid spans)    └──→ TB-S07 ──► Docker-compose + README
                                                           Phase 7: Release (after all merged)
```

### Execution Order (Recommended Schedule)

| Stage | Stories to Implement | Must Complete Before → Next Stage | Parallelism Allowed |
|-------|---------------------|-----------------------------------|---------------------|
| **Stage 0** | TB-S01, OBE-S01 | — (no dependencies) | ✅ Yes: they are independent of each other but required by all subsequent stories |
| **Stage 1** | TB-S02, TB-S03, TB-S04, OBE-S02 | All Stage-0 stories must be merged first | ✅ Yes: all four can run in parallel — TB-S02/03/04 depend on TB-S01 migration; OBE-S02 depends on TB-S01+TB-S04 but not directly on TB-S02 or TB-S03 code (only the DB layer) |
| **Stage 2** | TB-S05, OBE-S03, OBE-S05 | All Stage-1 stories merged first; OBE-S03+OBE-S05 additionally need OBE-S01 merged | ✅ Yes: all three can run in parallel (no cross-dependencies between them) |
| **Stage 3** | TB-S06 | TB-S05 must be merged first (cards are draggable objects that don't exist without board rendering) | ❌ No — strictly sequential on S5 |
| **Stage 4** | OBE-S06, TB-S07 | OBE-S06 needs OBE-S03+OBE-S05; TB-S07 needs ALL backend and frontend stories | ✅ Yes: they can run in parallel once their prerequisites hit main |

---

## Parallelism Matrix (Who Can Start When)

| PR Merged | What Unlocks | Who Should Execute Next |
|-----------|-------------|------------------------|
| TB-S01 merged | TB-S02, TB-S03, TB-S04, OBE-S02 | **Three coding agents** can pick up TB-S02/TB-S03/TB-S04 in parallel. One picks up OBE-S02 separately. |
| OBE-S01 merged (in Stage 0) | — | Already merged alongside TB-S01; no new unlocks at this point alone. |
| TB-S02+TB-S03+TB-S04+OBE-S02 all merged | TB-S05, OBE-S03, OBE-S05 | **Three coding agents** can pick up these in parallel. TB-S06 must wait for S5 only. |
| TB-S05 merged | TB-S06 | One coding agent picks up TB-S06 (drag-drop, which is a M-story). |
| OBE-S03+OBE-S05 merged | OBE-S06 | Coding agent picks up OBE-S06. |
| ALL stories merged | Release verification with docker-compose up | QA/testing phase begins. |

---

## Risk Assessment (Pre-Merge)

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|------------|
| **SQLite ↔ PostgreSQL migration divergence** (column types incompatible between engines at runtime) | Medium | High | TB-S01 AC3 tests both engines explicitly; OBE-S02 AC4 also tests under both; TB-S07 AC5.6 validates parity. Story-writer flagged this in PRD risks table. **If the coding agent encounters an incompatibility, they must note it as a known gap and block merge until resolved.** |
| **UUID generation cross-DB compatibility** (SQLite has no `gen_random_uuid()` like PostgreSQL) | High | Medium | TB-S01 explicitly addresses this in its Context: "generate UUIDs in Go via `crypto/rand`, NOT rely on DB defaults". The coding agent must generate UUIDs server-side for both engines. |
| **dnd-kit CDN import breaks in production** (CDN availability, CORS, ESM vs UMD) | Medium | Medium | Story-tb-S06 recommends dnd-kit CDN via `<script>` tag; if this fails during testing, the coding agent should switch to importing directly from unpkg.com with explicit version pinning. |
| **OBE-S05 and OBE-S03 depend on same DB layer, creating merge conflicts** | Low | Medium | Both touch `internal/http/handler.go` (TB-S02/3 already own the CRUD handlers). The coding agent should rebase against latest main before start. If there are conflicts on `handler.go`, the code-reviewer must adjudicate the correct order of span insertion vs metric collection. |
| **OBE-S06 validation script depends on spans from OBE-S03+OBE-S05 being already merged and tested** | Medium | High — if run too early, it generates false negatives. Mitigations: only execute validation after OBE-S03+OBE-S05 PRs are MERGED to main, not on branch. |

---

## Coding Agent Checklist (Per Story)

Before opening the PR, every coding agent MUST verify:

| Item | Why |
|------|-----|
| All story ACs pass locally with **both** SQLite and PostgreSQL databases | Ensures no single-engine bias |
| `go test ./...` exits 0 | No regressions on other stories |
| OpenAPI/RFC 7807 error format is consistent across all endpoints | PRD FR4 mandates; TB-S02 AC5+TB-S03 AC5 enforce it |
| UUID generation happens in Go, NOT in DB defaults (ADR-003-B) | SQLite/Postgres compatibility |
| No new dependencies in go.mod without justification | "Boring technology" principle per PRD decision log |
| Each story's GWT acceptance criteria are explicitly tested | Phase 5 gate: untested code never merges |
| Story traces back to at least one PRD requirement (confirmed via TRACEABILITY-MATRIX) | No feature without PRD mandate |

---

## What "Done" Looks Like for Each Epic

| Epic | Done Criteria | How Verified |
|------|--------------|-------------|
| DB Schema & Migrations (TB-S01) | Both up+down migrations pass on SQLite file + Postgres container; migration runner logs version applied | TB-S01 AC3+AC4 run in CI |
| Columns CRUD (TB-S02) | All 4 endpoints return correct status codes + JSON bodies; RFC 7807 errors present; cascade works | TB-S02 AC5 automated test suite |
| Notes CRUD (TB-S03) | Same as above for notes endpoints + column existence validation | TB-S03 AC5 |
| Move Endpoint + Health (TB-S04) | `/api/notes/:id/move` moves card correctly; `/health` returns `{"status":"ok"}` | TB-S04 AC1-AC5; TB-S07 AC2 confirms compose integration |
| Board Rendering (TB-S05) | Browser at localhost shows horizontal columns + sticky notes fetched from API | TB-S05 AC1-AC4 visual verification |
| Drag/Drop/Edit/Delete (TB-S06) | Cards draggable between columns via dnd-kit; inline editor; delete confirmation | TB-S06 AC1-AC5 manual browser testing |
| Docker Stack + Docs (TB-S07) | `docker-compose up -d` starts all 3 services; board accessible at localhost; README has all 6 sections | TB-S07 AC1-AC6; verified by any agent on first pull |
| Observability Platform (OBE-S01 through OBE-S06) | Every CRUD call produces spans with correct naming/attributes; health probes work for kubelet; Prometheus scrapes metrics | OBE-S02–S06 ACs + Jaeger/Tempo visual verifier |

---

*Authored: Story Writer (John) — Phase 4 completion artifact. Read this BEFORE you pick a story to implement.*
