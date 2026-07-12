---
story-id: OBE-S04
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
parent-epic: OBE-EPIC-2 (Feature Implementation — Kanban CRUD with Observability)
created-by: Story Writer (John)
trace-from-prd: G3 (all HTTP endpoints return consistent JSON responses), FR4, G4 (reliability, hosting)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S04 — Backend Notes CRUD with Distributed Tracing Context Propagation

As a **backend developer**,  
I want **note operations to preserve W3C TraceContext across all downstream HTTP calls from board → notes → store**,  
So that **a user-created note traces seamlessly through the full stack in Jaeger/Tempo**.

> **Maps to PRD Goals:** FR4 (consistent response schema), G4 (observability across service boundaries)  
> **Maps to Architecture:** ADR-002 (REST contract with W3C TraceContext header propagation rules), ADR-005 (Observability: span correlation via W3C TraceContext, context propagation from upstream → downstream HTTP calls)  
> **Previous Epic Story:** "OBE-4 — Backend notes CRUD with distributed tracing wired in"

---

## Context

After OBE-S01 (baseline OTel) and OBE-S03 (board CRUD spans), the note handlers must propagate trace context from any incoming request into newly created spans for note operations. This means every HTTP call between services carries `traceparent` / `tracestate` headers — and the downstream service decodes it to continue the same trace.

Key scenarios covered:
1. **Board → notes**: Board handler creates a note (POST `/api/notes/`) — the generated span must carry `traceparent` from the parent board HTTP request into the outbound call.
2. **Notes → notes** (move): When `POST /api/notes/:id/move` is called, trace context continues across both operations.
3. **Note read via store layer**: If a note handler fetches related data from another service or internal microstore function chain, that span also inherits parent context.

All downstream calls must use `otelhttp.NewClient()` — the OTel HTTP client — which automatically injects `traceparent` into outbound requests and extracts incoming `traceparent` headers to continue existing traces.

---

## Acceptance Criteria (Given/When/Then)

### AC1: Downstream HTTP calls carry traceparent / tracestate headers extracted from ActiveSpan

**Given:** OBE-S01 is installed (OTel SDK initialized with `otelhttp.NewServerHandler()`)  
**And:** a user sends a request `POST /api/notes/`  
**When:** the handler executes an outbound HTTP call to another service or internal HTTP client function  
**Then:** that call's outgoing request includes:
- The `traceparent` header injected via `otelhttp.NewClient()` which adds `traceparent` (W3C TraceContext) headers into the outgoing request
**And:** the headers follow W3C format: `traceparent-<version>-trace-id-span-ID` (e.g., `"01-4bf92f3577b34da6a3ce933d0c38a9a4-00f067aa0bac94d7-01"`)

**Scenario 1.1: No tracestate when no downstream services configured**  
**Given:** The deployment uses only a single collector endpoint (no chained downstream OTel services)  
**When:** an outbound HTTP call is made  
**Then:** the `tracestate` header may be absent (it's optional when there are zero consumer entries)

### AC2: Incoming requests decode existing trace context and attach to newly created spans

**Given:** An upstream service sends a request with a valid `traceparent` header  
**And:** the Kanban backend receives that request  
**When:** a span is created inside the handler (e.g., for note.create or move operation)  
**Then:**
- The new span's trace_id matches the value provided by the `traceparent`
- The parent_span_id is set correctly from the header  
**And:** if no existing `traceparent` exists, a NEW trace is started — this prevents errors or panics

**Scenario 2.1: Malformed traceparent header**  
**Given:** An upstream service sends `traceparent` with an invalid format (e.g., missing fields)  
**When:** the Kanban backend receives the request  
**Then:** the span starts a NEW independent trace (the malformed header is ignored gracefully; no panic or crash)

### AC3: Cross-service causal relationships visible in Jaeger/Tempo

**Given:** Both backend services and upstream/downstream services have OTel SDK configured  
**And:** the full workflow is exercised (board.create → note.create → note.move)  
**When:** a developer looks at the trace in Jaeger or Tempo  
**Then:**
- A complete waterfall shows the incoming HTTP span as the parent node, with spans from the note handler rendered as child spans
- Each service topology is correctly rendered with distinct service names (kanban-backend → kanban-note-svc, etc.)
- No orphaned or disconnected spans exist — all are linked via trace relationships

### AC4: Span attributes for note CRUD follow ADR-005 cardinality rules (max tag budget)

**Given:** Any note-create span exists in Jaeger/Tempo  
**When:** a developer reads its span attributes  
**Then:** only non-cardinality-risking fields appear on note spans exactly as follows:
- `http.method` (GET, POST, PUT, DELETE)
- `http.status_code` (201 or 200 success responses)
- `resource.name` = "kanban-backend"
- `note.id` UUID of the target resource  
**And:** no additional or cardinality-expanding attributes appear — NO user emails, IPs, request headers body content

---

## Implementation Notes

- Where it lives: `/backend/internal/http/note_handler.go`, `/backend/internal/store/notes_store.go`
- Create a store method `withNotesSpan(ctx context.Context, name string) (context.Context, trace.Span)` — wraps every operation in a span. If the passed `ctx` has no active span yet, creates one as root; otherwise continues from parent: `otelhttp.CreateHttpClient()` on downstream HTTP calls automatically injects `traceparent`.
- Downstream client creation MUST use `otelhttp.NewClient(...)` or equivalent `otelhttp.Transport()`. 
- Ensure both POST and GET operations carry trace metadata (e.g., `GET /api/notes/?column_id=:id`).
- Validate that no new cardinality issues emerge by running same test suite with simulated traffic.

---

## Dependencies

Requires: **TB-S01** through TB-S04 (all CRUD backend endpoints working), and **OBE-S01** + OBE-S03 (OTel baseline + OTel SDK must be initialized)  
Also requires at least one board / column to exist for testing scope.

## Estimate

S (1–2 hours for a Go developer familiar with the OTel HTTP client propagation chain)
