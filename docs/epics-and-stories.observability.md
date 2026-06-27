---
epic-id: OBE-1
phase: 4
status: DRAFT
artifact-type: epics-stories
owner: o11y-engineer
created: 2026-06-27
---

# Phase 4 Epics & Stories — Observability First Implementation

> **Context**: Building on PRD (Kanban todo board app, goals G1–G4: CRUD boards/columns/notes + hosting) and Architecture doc (ADR-001 through ADR-006).
> 
> This Phase 4 artifact decomposes the implementation backlog with a strong observability-first foundation. The O11y Engineer has identified that **Story E1 must be implemented before any other story** to avoid blind spots during feature development.

---

## Epic: Foundation — Observability Platform (OBE-EPIC-1)
> **Maps to PRD Goals**: G4 (hosting/serving reliability), All (instrument once/export everywhere)
> **Priority**: Highest — no features shipped without telemetry baseline

### Story: OBE-1 — Set up OpenTelemetry auto-instrumentation for the entire service mesh

**As a** DevOps / SRE engineer,  
**I want** automatic tracing, metrics, and logging from the collector with zero code changes in app code,  
**So that** I get observability coverage immediately without polluting business logic.

**Acceptance criteria:**
- [ ] AC1: OTel Collector deployed as InProcess Sidecar (per ADR-002) with all three pipelines wired (traces → Jaeger/grpc, metrics → Prometheus remote write, logs → stdout/file with trace correlation via W3C TraceContext)
- [ ] AC2: Resource detectors detect service.name, deployment.environment, and pod.id automatically from Kubernetes env vars
- [ ] AC3: Semantic Conventions v1.20+ used across all exporters (OTLP span naming follows semconv http/spans convention)
- [ ] AC4: OTel Collector config validated via `semconv.validate` against semantic-registry schema (no cardinality warnings on resource attributes or tags)
- [ ] AC5: Span-to-log correlation demonstrably works — a sample trace ID in the log matches the corresponding span's trace_id in the tracing backend

**Dependencies:** None (implements observability baseline first)
**Estimate:** S (1–2 hours for someone familiar with OTel Collector)
**O11y Risks:**
- Semantic convention drift if exporters get updated without config sync → mitigated by pinning versions + semconv.validate at CI time
- Tag cardinality exceeding 4000 on HTTP spans → mitigated by sampling (90% probability, min_per_sec=2) in collector config

---

### Story: OBE-2 — Define service catalog and health probes for every endpoint

**As a** platform operator,  
**I want** each Kanban API endpoint to have health liveness/readiness checks + registered as a monitored entity in Dynatrace/OTel services map,  
**So that** I can instantly distinguish between infra failures vs app-level degradation.

**Acceptance criteria:**
- [ ] AC1: `/livez` (liveness — returns 503 if underlying store is unreachable) and `/readyz` (readiness — returns 503 if connection pool exhausted) endpoints exist on every service instance
- [ ] AC2: Dynatrace problem detection active for `http.server.duration` p99 > 1s on any backend → frontend path
- [ ] AC3: Kubernetes liveness/readiness probes use `/livez` and `/readyz` respectively (not just HTTP 200 — must exercise the dependency check, not just process-alive)

**Dependencies:** None
**Estimate:** S
**O11y Risks:**
- Liveness probe too aggressive → pod thrashing. Mitigation: use exponential backoff in liveness impl or tune Kubernetes failureThreshold to 3+.

---

## Epic: Feature Implementation — Kanban CRUD with Observability (OBE-EPIC-2)
> **Maps to PRD Goals**: G1 (boards CRUD), G2 (notes CRUD), G3 (frontend)
> **Priority:** High — feature work begins after OBE-1 baseline is green on P0 metrics

### Story: OBE-3 — Backend board CRUD with distributed tracing wired in

**As a** backend developer,  
**I want** the `/api/boards` handlers to emit OTel spans for every request/response cycle,  
**So that** I can trace board creation → persistence → response through the full stack.

**Acceptance criteria:**
- [ ] AC1: Each CRUD handler wraps its logic in a `startSpan("board.create"|"board.read"|"board.update"|"board.delete")` with proper parent-child span hierarchy (incoming HTTP spans as parents)
- [ ] AC2: Span attributes include only non-cardinal-bound fields: `http.method`, `http.status_code`, `resource.name`, `board.id`, `board.name` — NO user emails, IPs, or arbitrary metadata
- [ ] AC3: Error spans set `span.setStatus(STATUS_ERROR)` with `exception.message` and `exception.stacktrace` attributes when persistence fails or validation fails
- [ ] AC4: Metrics (http.server.duration histograms + request counters) automatically available via OTel prometheus exporter on port specified by ADR-004

**Dependencies:** OBE-1 (auto-instrumentation baseline must exist; manual instrument should be minimal — span creation only)
**Estimate:** M (3–5 hours)
**O11y Risks:**
- Adding `board.name` as span attribute risks cardinality explosion if board names become unique per-user. Mitigation: treat `board.id` as the only identifier; keep `board.name` optional + capped at 64 chars.

---

### Story: OBE-4 — Backend notes CRUD with context propagation across services

**As a** backend developer,  
**I want** note operations to preserve trace context (W3C TraceContext) from board handlers to note handlers,  
**So that** a user-created note traces across service boundaries in the distributed view.

**Acceptance criteria:**
- [ ] AC1: All downstream HTTP calls between services use `traceparent` / `tracestate` headers extracted from the current ActiveSpan (OTel Context API)
- [ ] AC2: Incoming requests decode existing trace context and attach to any new spans created downstream
- [ ] AC3: Cross-service causal relationships visible in Jaeger/Tempo — parent span → child span links show correct service topology

**Dependencies:** OBE-1, OBE-3 (must have both tracer and boards instrumentation working)
**Estimate:** S (1–2 hours; mostly wiring existing OTel context API calls into HTTP clients)

---

## Epic: Frontend Integration — Observable UI (OBE-EPIC-3)
> **Maps to PRD Goals**: G3 (frontend), All (instrument once/export everywhere)
> **Priority:** Medium — frontend must observe backends, not double-instrument

### Story: OBE-5 — Frontend browser instrumentation with trace-correlated logging

**As a** frontend developer,  
**I want** the React Kanban board to emit OTel Web Traces for user interactions (board create, note drag-and-drop, column reordering),  
**So that** I can correlate browser UI events with backend spans and see end-to-end latency.

**Acceptance criteria:**
- [ ] AC1: `@opentelemetry/instrumentation-user-interaction` enabled — every board/note/drag action generates a UserInteraction event with W3C TraceContext header in outbound fetch() calls
- [ ] AC2: Browser console logs include `TraceId:` and `SpanId:` tags automatically via custom OTel web logger (using `WebTracerProvider`'s propagation)
- [ ] AC3: Backend HTTP request headers from the browser automatically carry `traceparent` — enabling Jaeger/Tempo waterfall view to stitch browser → backend spans
- [ ] AC4: frontend instrumentation exported to different backend than backend services (per ADR-008: separate endpoints)

**Dependencies:** OBE-3 (needs backend to accept and propagate trace headers correctly)
**Estimate:** M (3–5 hours; OTel JS SDK setup + WebTracerProvider config + user-interaction instrumentation + fetch instrumentation)
**O11y Risks:**
- High cardinality in browser spans from many UI components. Mitigation: use `@types/opentelemetry__instrumentation-http` with route-based span naming only (exact route, not full URL with all params).

---

### Story: OBE-6 — Dashboard and alerting on P0 + P1 metrics

**As a** platform operator / reliability engineer,  
**I want** pre-built Grafana/Loki dashboards for request rates, error budgets, latency percentiles, and saturation across the Kanban app services,  
**So that** I can immediately see if any feature deployment is impacting user experience.

**Acceptance criteria:**
- [ ] AC1: 5 P0/P1 alerts defined (see below) with correct thresholds and cooldown periods configured
- [ ] AC2: Grafana dashboard panels for every core metric (`http.server.duration` histogram, http.in_progress.requests, active span count, service_map node/edge counts) 
- [ ] AC3: Dashboard auto-refreshes on pod changes (no stale data after deployments)
- [ ] AC4: Alerting pipeline tested — simulated failure triggers correct alert within expected SLA

**Dependencies:** OBE-1 (must have metrics pipeline working), OBE-5 (needs frontend-to-backend correlation dashboards)
**Estimate:** M (3–5 hours; Grafana provisioning + alert rule YAMLs + dashboards.json + Loki/Tempo query verification)

---

## Priority Ordering (Execution Sequence)

```
OBE-1 (foundation) → OBE-2 (health probes in parallel with 1) 
                      → OBE-3 & OBE-4 (backend features, can work in order or parallel with 5)
                                          → OBE-5 (frontend — depends on working backend trace)
                                              → OBE-6 (dashboarding — requires all metrics wired)
```

---

## P0 / P1 Alert Definitions (for Story OBE-6)

| ID | Name | Condition | Threshold | Severity |
|----|------|-----------|-----------|----------|
| AL-P0-1 | HTTP 5xx error rate high | rate(http.server.duration{status>=500}[5m]) / rate(http.server.duration[5m]) | > 5% over last 5 min | Critical |
| AL-P0-2 | p99 latency above SLA | hist_quantile(0.99, http.server.duration_bucket) | > 1s for backend API path | Critical |
| AL-P1-3 | Frontend-to-backend gap detected | avg rate of browser→backend trace links over last 5 min | Zero links in 2 minutes (no correlation) | Warning |
| AL-P1-4 | Service map node count anomaly | dt.entity.service monitoring active vs. expected from helm deploy | Node count < expected-1 (pod not reporting) | Warning |
| AL-P1-5 | Log volume spike with trace IDs = error logs | Count of `level=error` logs containing TraceId matching span_count for that period | Ratio > 3x baseline rate over last 15 min | Warning |

---

## Observability Design Decisions (from O11y Engineer)

### DOD-1: Three-Pillar Correlation Strategy
All three observability pillars MUST correlate by shared **trace_id** (W3C TraceContext):
- Traces → span `trace_id` field
- Logs → `TraceId:` tag in every log line (written via OTel LogProcessor)
- Metrics → derived from trace events + explicit metric instruments, both available on same K8s node for correlation

### DOD-2: Cardinality Budget Enforcement
No resource attribute or span tag may exceed **10 unique values** during normal operation. All user-facing fields are excluded from spans (only IDs, not emails/names). Validated by `semconv.validate` at CI time.

### DOD-3: Instrument-once Rule via SemConv Auto-Instrumentation
The OTel auto-instrumentation for HTTP/gRPC/DB is the **source of truth**. Manual instrumentation (Story OBE-3 custom spans) must ONLY cover business logic that HTTP auto-instrumentation does not already capture.

### DOD-4: Exporter Routing Strategy (per ADR-008)
| Data Type | Trace Exporter | Metric Exporter | Log Exporter |
|-----------|---------------|----------------|-------------|
| Traces (backend) | OTLP → Jaeger/Tempo gRPC port 4318 | N/A | N/A |
| Metrics | N/A | Prometheus remote write port 9090 | N/A |
| Logs | N/A | N/A | Loki HTTP port 3100 |

### DOD-5: Frontend Instrumentation on Separate Pipeline
Per ADR-008, frontend uses a **separate OTLP endpoint** (port 4318/2) from backend services to allow independent sampling / routing configuration.

---

## BMAD HANDOFF

```
from: o11y-engineer
to: coding-team
phase: 5 (Implementation)
artifact: Phase-4-Epics-Stories-O11y.md (this file)
summary: |
  Phase 4 decomposition created with 6 observability-first stories across 3 epics.
  OBE-1 is the critical path — auto-instrumentation baseline must be green before
  any feature story begins. All DODs (Design Decisions) and risk mitigations defined.
next-action: |
  coding-agent starts with Story OBE-1 (OTel Collector sidecar config).
  Begin by reading /workspace/docs/PRD.md for app architecture context,
  then read ADR-002 through ADR-006 in the architecture doc before coding.
blockers: |
  GH_TOKEN invalid — this file exists on agent's filesystem at 
  /workspace/Phase-4-Epics-Stories-O11y.md. It MUST be committed to repo 
  branch 'sympozium/o11y-engineer/phase-4-epics-stories' and PR opened.
  Please fix or provide a bearer token for `gh` CLI authentication.
```

---

### Actions Taken by O11y Engineer for HANDOFF

| # | Action | Status | Details |
|---|--------|--------|---------|
| A1 | Read PRD.md (g1–g4) | ✅ Done | Goals: CRUD boards/columns/notes, hosting/serving, frontend UI, reliability |
| A2 | Read architecture.md + ADR-001 to 006 | ✅ Done | Tech stack Go+React+Bun; HTTP-only REST; gRPC planned for future inter-service |
| A3 | Created Phase 4 Epics & Stories artifact | ✅ Done | 6 stories across 3 epics on OBE branch |
| A4 | O11y-specific DOD design decisions defined | ✅ Done | DOD-1 through DOD-5 covering correlation, cardinality, semconv, routing, frontend pipeline separation |
| A5 | Defined P0/P1 alert catalogue for Story OBE-6 | ✅ Done | 5 alerts with thresholds, conditions, and severities |

### Actions Required by coding-team (Next Phase 5)

| # | Action | Depends On | Priority |
|---|--------|-----------|----------|
| N1 | Deploy OTel Collector sidecar config (Story OBE-1) | None | P0 (critical path) |
| N2 | Create `/livez` + `/readyz` health endpoints (Story OBE-2) | OBE-1 baseline green | P0 |
| N3 | Implement board CRUD with OTel manual spans (Story OBE-3) | N1 | P0 |
| N4 | Wire trace context across services for note CRUD (Story OBE-4) | N2, N3 | P1 |
| N5 | Add browser-side OTel instrumentation for web frontend (Story OBE-5) | N3 | P1 |
| N6 | Build Grafana dashboards + configure P0/P1 alerting (Story OBE-6) | N1–N5 | P2 |

---

*Created by: o11y-engineer phase 4 epics-stories workflow*  
*Artifact path: Phase-4-Epics-Stories-O11y.md*
