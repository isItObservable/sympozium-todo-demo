---
story-id: OBE-S01
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: OBE-EPIC-1 (Foundation — Observability Platform)
created-by: Story Writer (John)
trace-from-prd: G4 (hosting/serving reliability, instrument once/export everywhere)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S01 — Set Up OpenTelemetry Auto-Instrumentation for the Entire Service

As a **DevOps / SRE engineer**,  
I want **automatic tracing, metrics, and logging from the collector with zero code changes in app code**,  
So that **I get observability coverage immediately without polluting business logic**.

> **Maps to PRD Goals:** G4 (hosting/serving reliability), All (instrument once/export everywhere)  
> **Maps to Architecture:** ADR-003-B (DB schema + HTTP handler layer), ADR-002 (API contracts with span naming conventions),  
  ADR-005 (Observability: OTel auto-instrumentation via `otelhttp` middleware with resource detectors, cardinality-safe sampling)  
> **Previous Epic Story:** "OBE-1 — Set up OpenTelemetry auto-instrumentation for the entire service mesh"

---

## Context

This foundational story installs three pillars of observability into the Go backend before any feature code ships:

1. **OpenTelemetry SDK initialization** in `main.go` using `otelhttp.NewServerHandler()` as middleware so every HTTP request automatically creates server spans.
2. **Resource detection** via `resourcedetector.ContainerDetector` and env-var detectors: pulls `service.name`, `deployment.environment`, and `pod.id` from environment with no manual tagging.
3. **Semantic Conventions v1.20+** pinned in go.mod to avoid drift — HTTP span names follow `http/server` convention (semconv 1.20) exactly, attribute key naming matches spec. Sampling at production-safe levels (90% probability, min_per_sec=2) so downstream systems aren't overwhelmed.

This story is **THE first priority** per the epic backlog: no features ship without telemetry baseline.

---

## Acceptance Criteria (Given/When/Then)

### AC1: SDK and middleware are wired in `main.go` with zero business-logic impact

**Given:** A developer reads `/backend/main.go`
**AND:** The codebase compiles (`go build ./...` succeeds)  
**When:** the application starts via `go run .`  
**Then:** OTEL SDK initializes successfully using `config.EnvEnv()` env vars (OTEL_SERVICE_NAME, OTEL_TRACES_EXPORTER, etc.)  
**And:** `otelhttp.NewServerHandler()` wraps all HTTP routes and automatically creates spans for every incoming request  
**AND:** no manual span instrumentation appears in any business logic (`internal/store`, `internal/http/handler.go`) — this is purely middleware-level auto-instrumentation
**AND:** the server still serves `/api/columns/` correctly (no regression)

### AC2: Resource detectors inject correct attributes on every span and metric

**Given:** The application runs with these environment variables set:  
- `OTEL_SERVICE_NAME=kanban-backend`  
- `DEPLOYMENT_ENVIRONMENT=dev`  
- `POD_ID=test-pod-01`  
**When:** any span is created (e.g., on first request to `/api/columns/`)  
**Then:** the span's resource attributes include:  
 - `service.name = "kanban-backend"`  
 - `deployment.environment = "dev"`  
 - `pod.id = "test-pod-01"`  
**AND:** these same attributes appear on the OpenTelemetry metric (e.g., `http.server.duration`) in the exported data

### AC3: Semantic conventions follow semconv 1.20+ exactly

**Given:** go.mod pins `go.opentelemetry.io/otel/semconv/v1.20.0` (or later)  
**When:** an HTTP request creates a span (e.g., `GET /api/columns/`)  
**Then:** the span attribute key is `"http.method"` (NOT `"http_method"`) per semconv 1.20+  
**AND:** the span name follows the convention `"<METHOD> <path_template>"` (e.g., `"GET /api/columns/"`, not a unique URL path)
**AND:** no cardinality-exploding attributes appear automatically, such as full query strings or user IPs

### AC4: Cardinality-safe sampling is active and validated at CI time

**Given:** the collector config includes a sampler (90% probability, min_per_sec=2 minimum)  
**When:** a CI check runs (`make validate-semconv` or equivalent pre-commit hook)  
**THEN:** no errors or warnings appear from `semconv.validate()` on the exported resource attributes / span tags
**AND:** the validation script rejects configs that add high-cardinality attributes (e.g., `"http.full_url"`, custom user fields as span attrs)

---

## Implementation Notes

- **Where it lives:** `/backend/main.go` — setup OTEL SDK, configure `otelhttp.NewServerHandler()`, wire into standard `gin` router.
- Environment variable: `OTEL_TRACES_EXPORTER=otlp`, `OTEL_METRICS_EXPORTER=prometheus`.
- No database connection needed; this is purely an HTTP middleware story.
- Test: add `/backend/internal/otelsetup/otel_test.go` with a mock server to verify attributes appear correctly.

---

## Dependencies

**None.** Must be implemented first — everything else depends on this telemetry baseline.

## Estimate

S (1–2 hours for someone familiar with OTEL SDK)
