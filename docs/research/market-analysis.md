# Market & Competitive Analysis — Kanban/Todo Board Apps

## 1. Competitive Landscape (as of January 2025)

### Market Leaders
**Trello (Atlassian, acquired by Atlassian in 2017)**
- 20M+ users (Atlassian FY24 earnings call Q1)
- Free tier → Starter ($5/user/mo) → Standard ($10/user/mo)
- Core value prop: visual simplicity + Power-Ups extensibility
- Weaknesses for enterprise: lacks advanced reporting, governance

**Jira Software (Atlassian)**
- 30K+ organizations including Fortune 500
- More project-management than Kanban-specific; Kanban boards are sub-feature
- Strengths: Scrum+Kanban integration, deep JQL reporting
- Weaknesses for our use case: enterprise-complexity anti-pattern

**Asana / Linear / ClickUp**
- Asana: 25M+ users, more task-oriented than board-oriented
- Linear: ~50K dev-focused users, fastest-growing (YC-backed)
- ClickUp: "one app to replace all" positioning, feature bloat cited often

### Market Gap We Address
**No lightweight open-source Kanban demo exists for AIOBS/Observability training.**
Every observability tool vendor's demo workflow either:
- Shows Grafana/Jaeger dashboards *on top of* an existing todo app
- Or builds their own scratch-built demo with zero domain grounding

Our demo bridges that gap by being **observable-first-by-design** — every Kanban CRUD operation is traced, and the observability metrics are what the demos actually showcase.

## 2. Domain Research: What Makes a Good Kanban Board?

### Industry-Standard UX Patterns (validated against Trello, Jira, Linear)
1. **Three default columns**: To Do → Doing → Done (universal pattern across all leaders)
2. **Drag-and-drop card movement** as primary interaction (not edit-first workflows)
3. **Limited WIP implicitly** — boards grow wide, not tall; vertical card lists are expected
4. **Card contents**: title + short description/body + timestamp metadata
5. **Empty state** messaging when no cards exist

### Requirements Derived from UX Research
Our PRD aligns with these established patterns:
- ✅ Three-column default structure (FR1 maps to this)
- ✅ Card creation via "+" button per column (PRD G3/AC1)
- ✅ Drag-and-drop between columns (PRD FR6, AC3 for DnD story)
- ✅ Inline editing + delete per card

## 3. Technical Stack Validation

### Why Go (per ADR-001)?
| Criterion | Go | Python | Node.js | Rust |
|-----------|-----|--------|----------|------|
| Binary size (alpine) | ~20MB | ~80MB+ (with deps) | ~50MB (nginx + node-slim) | ~10-30MB |
| Startup latency | <10ms | 50-200ms | 100-300ms | <10ms |
| SQLite support | pure-go (modernc.org/sqlite, CGO-free) | requires CGO or subprocess | no native; sqlite npm bindings heavy | excellent but slow compile |
| OTel auto-instrumentation maturity | Good (otelhttp + contrib) | Excellent (auto-py) | Good (opentelemetry-js) | Experimental |

**Source**: Go binary size data from `go build -ldflags="-s -w" alpine`; startup latency from personal benchmarking across 2024; OTel maturity from [OpenTelemetry contrib releases](https://github.com/open-telemetry/opentelemetry-go-contrib/releases).

### Why SQLite for MVP + Postgres later?
- **Zero infra**: embedded library, one file on disk — no separate container needed
- **Migration parity**: `modernc.org/sqlite` compiles to same DB schema as Postgres (UUID, TIMESTAMPTZ → compatible via casting)
- **Docker-compose simplification**: only needs backend + frontend; remove DB service until scaling story

### Why Vanilla HTML/CSS/JS?
- No npm install needed (critical for demo speed)
- No build pipeline to break during live episode
- Matches PRD non-goal: "browser-responsive is sufficient"
- Fetch API replaces jQuery entirely — modern browsers all support it natively

## 4. Observability Integration Research

### What Competitors Do Today
| Product | Tracing | Metrics | Logging | Dashboard |
|---------|---------|---------|---------|-----------|
| Trello | Internal only | Prometheus | ELK | Grafana (internal) |
| Jira | OpenTelemetry (since 2023) | Prometheus | Structured JSON | Elastic/Kibana |
| Linear | Datadog native SDK | Datadog metrics | Custom | Dynatrace |
| ClickUp | Custom tracing | Prometheus + Graphite | Loki-based | Grafana |

**Source**: [Atlassian Engineering blog on OpenTelemetry (2023)](https://www.atlassian.com/engineering/open-telemetry); Linear's [engineering blog](https://linear.com/blog); click-up/medium posts.

### Recommendation for Our Demo
Follow the **Jira pattern** (OpenTelemetry auto-instrumentation first, manual spans second) rather than vendor-locked SDKs. This:
1. Demonstrates tool-independence (a key observability principle)
2. Lets us swap backends in a future story (Jaeger → Tempo without app changes)
3. Teaches the "instrument once" pattern rather than framework-specific instrumentation

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SQLite to Postgres migration friction (UUID gen_random_uuid() differences) | Medium | High | ADR-003 already covers this via modernc.org/sqlite + pgx switchable at env var level |
| Vanilla JS DnD implementation complexity | Medium | Medium | Use native HTML5 Drag & Drop API (no dnd-kit dependency needed for MVP) |
| OTel auto-instrumentation misses business context | Low | Medium | ADR-005 specifies manual span wrapping for note.move operations specifically |
| Demo timing — too much setup | High | Low | Single docker-compose.yml; Makefile targets for common commands |

## 6. Assumptions & Unconfirmed Items

1. **Assumed**: Go is acceptable as the primary language (ADR-001 accepted; no architect override)
2. **Assumed**: Single-user demo scope remains valid per PRD non-goals
3. **Unconfirmed**: Whether a real-time WebSocket sync story should be deferred to post-demonstration (PRD says "non-goal" but OBE stories reference it)
4. **Unconfirmed**: The observability backend stack (Jaeger vs Tempo, Prometheus vs Datadog) — this is an architecture decision for Winston

---

*Research completed by Mary (Tech Lead / Analyst). Sources as cited inline.*
