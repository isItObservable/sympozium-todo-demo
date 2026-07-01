---
story-id: OBE-S05
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: OBE-EPIC-3 (Frontend Integration — Observable UI)
created-by: Story Writer (John)
trace-from-prd: G4 (reliability, hosting), FR4, G1/G2/G3 (UI features with full traceability)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S05 — Frontend Browser Instrumentation with Trace-Correlated Logging

As a **frontend developer**,  
I want the Kanban board's browser client to emit OTel Web Traces for all user interactions and include trace IDs in logs,  
So that **I can correlate UI events with backend spans end-to-end in Jaeger/Tempo**.

> **Maps to PRD G4 (observability across all layers),** FR4 (headers carry traceparent → enable Jaeger waterfall view stitching browser → backend spans).  
> **Also:** ADR-002 (HTTP contract + W3C TraceContext header propagation rules), ADR-008 (backend services and frontend use separate OTel export endpoints).
> **Previous Epic Story:** "OBE-5 — Frontend browser instrumentation with trace-correlated logging"

---

## Context

This story adds browser-side OTEL Web Tracing to the vanilla HTML/CSS/JS frontend. It uses `@opentelemetry/instrumentation-user-interaction` and `@opentelemetry/sdk-trace-web` to auto-instrument:
- Every board/note/drag action generates a `UserInteraction` event with W3C TraceContext header in outbound fetch() calls.
- Browser console logs include `TraceId:` and `SpanId:` via custom OTel WebTracerProvider propagation (a custom web logger that wraps `console.log/console.warn/console.error`).
- Backend HTTP requests from the browser automatically carry `traceparent` — so Jaeger/Tempo waterfall view stitches browser → backend spans.

**Key architectural decision:** Per ADR-008, frontend instrumentation uses a **separate OTel endpoint** than backend services (different exporter URL / collector target). This prevents metric/cardinality confusion between frontend and backend telemetry.

---

## Acceptance Criteria (Given/When/Then)

### AC1: Browser emits UserInteraction events for every board/note/drag action

**Given:** `@opentelemetry/instrumentation-user-interaction` is enabled via `<script>` tag or ESM import in the frontend bundle (`frontend/app.js`)
**AND:** a user performs any of the following actions:
- Creates a new note (clicks "+" → types title → presses Enter)
- Drags a note card to another column
- Edits or deletes an existing note  
**When** those interactions happen in the browser console/DevTools  
**Then:** OTEL Web Traces emit a `UserInteraction` span/event with:
 - Span name format: `"ui.<action>.<target>"` (e.g., `ui.note.create`, `ui.note.move`, `ui.column.add`)
 **AND**: W3C TraceContext (`traceparent` / `tracestate`) headers embedded in the event metadata

### AC2: Browser console logs include TraceId: and SpanId: tags automatically

**Given:** A custom OTel web logger is configured using `WebTracerProvider`'s context propagation (a `console.log` wrapper that extracts current span context via `spanContext().toString()`)
**WHEN:** the frontend emits any log message to the browser console (`console.log()` or `console.warn()` or `console.error()`) from app code  
**THEN**: the logged line includes a `[TraceId: <hex-trace-id>] [SpanId: <hex-span-id>]` prefix (not just one — both must be present)
**AND:** the trace ID and span ID match the corresponding active span in OTEL Web Traces at that time

### AC3: Backend HTTP requests from browser carry `traceparent` enabling full waterfall tracing

**Given:** A user initiates a UI action (e.g., click "+", drag card to column, submit edit form)  
**When:** the frontend makes its outbound `fetch()` call to `/api/notes/`, `/api/columns/`, etc.
**THEN**: the outgoing HTTP request includes both:
- `traceparent` W3C TraceContext header (format `"01-<trace-id>-<span-id>-01"`)
- `tracestate` if applicable (for trace sampling or downstream service info)
 **AND**: These headers originate from OTel's WebTracerProvider context (not a hand-written append — the OTel fetch instrumentation handles it)
**AND:** When Jaeger/Tempo displays the full cascade, backend spans show this `traceparent` as incoming context stitching → creating a single waterfall entry spanning browser → backend API call

### AC4: Frontend OTel exports to a separate endpoint from backend services (ADR-008 compliance)

**Given:** Backend OTEL SDK uses one collector endpoint (e.g., `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`)
**AND:** the frontend is configured with a different export target for its traces (per ADR-008: `"separate endpoints"`)
**WHEN:** the browser emits user-interaction traces via OTel Web Traces
**THEN:** they target a different URL than backend service traces — e.g., `http://otel-collector-frontend:4317` (or a separate collector pod/service for frontend traffic)
 **AND**: metrics from the frontend are NOT blended with backend metric streams in Prometheus or Grafana

---

## Implementation Notes

- **Where it lives:** `/frontend/app.js` — add OTEL Web Tracing setup at module level. Import `@opentelemetry/sdk-trace-web` via CDN or npm bundle if needed (keep vanilla JS, so CDN `<script>` references are fine for the demo).
- Add a custom web logger function that wraps `window.console`: e.g., `function traceLog(msg: string): void { log('TraceId:' + ...) + console.log(...)}`.
- Use `fetch instrumentation from OTel Web SDK: `@opentelemetry/instrumentation-fetch`. This automatically injects `traceparent` into all fetch() calls.

---

## Dependencies

Requires: **TB-S01 through TB-S07** (must have a fully functional board UI to interact with), and **OBE-S01** + OBE-S04 must exist first so backend can accept and propagate trace headers from the frontend.  
Also requires that OTel collector endpoints are configured for both frontend and backend exporters.

## Estimate

M (3–5 hours — OTel JS SDK setup, WebTracerProvider config, fetch instrumentation + user-interaction instrumentation is more involved than backend)