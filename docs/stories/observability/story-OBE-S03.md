---
story-id: OBE-S03
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coder
parent-epic: OBE-EPIC-2 (Feature Implementation — Kanban CRUD with Observability)
created-by: Story Writer (John)
trace-from-prd: G4 (reliability, hosting), G1 (feature delivery with observability)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S03 — Backend Board CRUD Tracing / Span Attribute Tagging + Distributed Context Propagation

As a **backend developer**,
I want my Kanban app to be fully traceable through the backend with proper OTel span propagation,
So that users' requests from board → notes → move all share trace IDs and appear as a single waterfall in Jaeger/Tempo.

> **Maps to PRD G4 (reliability, hosting)**  
> **Maps to Architecture:** ADR-002 (REST contract + span naming for HTTP), ADR-003-B (DB schema + handler/store split)
> **Previous Epic Story:** "OBE-3 — Backend board CRUD with distributed tracing wired in"

---

## Context

After observability baseline (OBE-S01/OBE-S02), this story adds manual OTEL span instrumentation to the Kanban business logic layer. Every `board.create`, `board.read`, `board.update`, and `board.delete` operation must produce a child span under its parent HTTP span, carrying proper trace context so Jaeger/Tempo stitches it into a waterfall view.

**HTTP contract from ADR-002:**
| Method | Path | Success | Errors |
|--------|------|---------|--------|
| GET | `/api/columns/:id` | `[Column]` (200), or `{"id":"...","board_scope":"...","title":"..."}` (404 not found) |
| POST | `/api/columns/  | `{column}` created (201) | 400 on bad input, 500 on DB error |
| PUT | `/api/columns/:id` | updated `{colunn}` (200) | 404 not found, 400 on bad input |
| DELETE | `/api/columns/:id` | `{"deleted": true}`(204)| 404 not found |
| GET | `/api/notes/?column_id=:id | `[Notes]` (200) | 
| POST | `/api/notes/` | new `{note}` (201) | 400 on bad input, 404 if column doesn't exist |
| PUT | `/api/notes/:id` | updated `{note}` (200) | 404 not found, 400 on bad input |
| DELETE | `/api/notes/:id` | `{"deleted": true}`(204)| 404 not found |

**Span naming convention:** `<domain>.<action>` where action is CRUD verb. Examples: `board.create`, `board.read`, `board.update`, `board.delete`, `note.create`, `note.read`, `note.update`, `note.delete`.
Each span MUST include trace context in its metadata (`tracestate` header).

**Go struct for spans:**
```go
type SpanEvent struct {
    Method   string `json:"method"`
    Path     string `json:"path,omitempty"`
    StatusCode int `json:"status_code,omitempty"`
    BoardID string `json:"board.id,omitempty"`
    ResourceName string `json:"resource.name,omitempty"`
}
```

---

## Acceptance Criteria (Given/When/Then)

### AC1: Every board CRUD operation wraps in span lifecycle

Given a user performs `GET /api/columns/` request  
When the handler executes `ListColumns()` via store layer  
Then OTEL creates a child span with name `"board.read"` that contains attributes matching ADR-002 table above, including `tracestate`, and any DB errors or panics are captured via `span.RecordError(err)`.

**Same for all board CRUD operations:** 
- `POST /api/columns/` → span name: `"board.create"` with status **201 on success, **500** on error
- `PUT /api/columns/:id` → span name: `"board.update"` with status **200** or **404**,
  - If any span errors out, set span via `span.RecordError(err)` with both `exception.message` and `exception.stacktrace`.

### AC2: Span contains ALL required attributes for traceability — no cardinality risks

All spans above include the following non-empty attributes:
- `http.method` (GET, POST, PUT, DELETE)
- `http.status_code` (201 or 200 success responses)  
- `resource.name`: `"kanban-backend"` (inherited from OTEL SDK config, not re-set per span)
- `board.id`: UUID of the board/resource (when available on the DB object created/returned by API)
**AND**: no additional attributes that would risk cardinality explosion. No user emails, IPs, or arbitrary metadata should appear on spans (especially not from request headers or body parsing).

### AC3: Error handling spans correctly capture exception info

Given a backend handler hits an unrecoverable DB error OR validation failure 
When the response is an HTTP status ≥ 500
Then the span status must call `span.SetStatus(code="Error",` AND:
- `exception.message`: human-readable message (e.g., `"no column found for id")  
**AND**: `exception.stacktrace`: full stack string from `runtime.StackTrace()` or equivalent, which will be sent along with the span to Jaeger/Tempo.

### AC4: Metrics (http.server.duration + request counters) auto-export correctly via OTel Prometheus exporter on port specified in ADR-004 

Given a backend receives **multiple** requests across all CRUD endpoints
When those operations complete successfully or error out 
Then OTEL's Prometheus exporter exposes metrics on the configured host/port from ADR-004 with:
- `http_server_duration_seconds_bucket` (HTTP request duration histogram) 
- `http_server_request_count_total` (HTTP request counter),
**AND**: Both metric streams include attributes matching those seen on spans above (`method`, `status_code`, `resource.name`, etc.).

---

## Implementation Notes

- Where it lives: `/backend/internal/http/middleware.go` and `/backend/internal/store/`.
- Add span creation/wrapping code to all CRUD HTTP handlers. Create one helper per CRUD verb (e.g., `withBoardSpan(ctx, "board.create")`) that creates + closes the span automatically.
- The OTel SDK auto-instrumentation is handled at OBE-S01 — this story only adds manual instrumentation for business logic spans (which are NOT auto-created by `otelhttp`). So we ONLY manually create business-critical spans here like `board.read`.
- Ensure no cardinality-expoding fields appear as span attributes.

---

## Dependencies

Requires: **TB- 01** (DB layer + health probes) AND **OBE-S01** (OTel SDK init with OTEL_TRACES_EXPORTER + otelhttp middleware already in place). Both must be installed and tested before feature-level spans can exist.  
Also requires at least one column to be present for testing purposes.

## Estimate

M (3–5 hours for a Go developer, mostly for span attribute mapping & manual OTel SDK setup)
