---
story-id: OBE-S03
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
parent-epic: OBE-EPIC-2 (Feature Implementation — Kanban CRUD with Observability)
created-by: Story Writer (John)
trace-from-prd: G4 (reliability, hosting), G1 (feature delivery with observability)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S03 — Backend Board CRUD Tracing / Span Attribute Tagging + Distributed Context Propagation

## As a backend developer, I want every Kanban CRUD operation (board.create, board.read, board.update, board.delete, note.create, note.read, note.update, note.delete) to produce proper OTel spans with correct trace context propagation, so that Jaeger/Tempo displays a unified waterfall view across all requests.

> **Maps to PRD G4:** reliability, hosting — every request across the full stack gets traced.  
> **Maps to Architecture:** ADR-002 (REST contract + span naming conventions), ADR-003-B (DB schema + handler/store split).  
> **Maps to PRD AC4:** All endpoints return consistent JSON with errors following RFC 7807 — traces must capture errors.

---

## Context

After the observability baseline is installed (OBE-S01) and health probes are wired (OBE-S02), this story adds manual OTEL span instrumentation to the Kanban business logic layer. Every CRUD operation on boards and notes must:

1. Create a **child span** under its parent HTTP span, carrying proper trace context so Jaeger/Tempo stitches it into a waterfall view
2. Name spans following the convention `<domain>.<action>`:
   - `board.create`, `board.read`, `board.update`, `board.delete`
   - `note.create`, `note.read`, `note.update`, `note.delete`
3. Include required trace attributes (HTTP method, status code, board/note ID). **No cardinality-risking fields** (no user emails, IPs, or arbitrary header/body metadata).

API endpoint contract for reference (ADR-002):

| Method | Path | Success Response | Error Responses |
|--------|------|------------------|-----------------|
| GET | `/api/columns/` | `[Column]` (200) | 500 on DB error |
| POST | `/api/columns/` | `{column}` (201) | 400 bad input, 500 DB error |
| PUT | `/api/columns/:id` | updated `{column}` (200) | 404 not found, 400 bad input |
| DELETE | `/api/columns/:id` | `{"deleted": true}` (204) | 404 not found |
| GET | `/api/notes/?column_id=:id` | `[Note]` (200) | 500 on DB error |
| POST | `/api/notes/` | new `{note}` (201) | 400 bad input, 404 if column missing |
| PUT | `/api/notes/:id` | updated `{note}` (200) | 404 not found, 400 bad input |
| DELETE | `/api/notes/:id` | `{"deleted": true}` (204) | 404 not found |

Required span attributes for every CRUD span:
- `http.method`: The HTTP method of the originating request (GET, POST, PUT, DELETE).
- `http.status_code`: The final HTTP response status code (201, 200, 204, 4xx, 5xx).
- `resource.name`: `"kanban-backend"` (inherited from OTEL SDK config — do NOT re-set per span).
- `board.id` or `note.id`: UUID of the board/resource when available.

---

## Acceptance Criteria (Given/When/Then)

### AC1: Every CRUD operation creates a named child span under its parent HTTP span

**Given:** A user sends `GET /api/columns/` 
**When:** the handler executes `ListColumns()` via the store layer
**THEN:**
- An OTel span named **`board.read`** is created as a child of the parent HTTP server span.
- The span carries all required attributes (see above).
- On success, the span status is set to `Ok`.

**Same behavior applies for all board CRUD operations:**

| Endpoint | Span Name | Success Status Code | Error Handling |
|----------|-----------|---------------------|----------------|
| `POST /api/columns/` | `board.create` | 201 | `span.RecordError(err)` on failure |
| `PUT /api/columns/:id` | `board.update` | 200 | `span.RecordError(err)` on failure |
| `DELETE /api/columns/:id` | `board.delete` | 204 | `span.RecordError(err)` on failure |

**Same behavior applies for all note CRUD operations:**

| Endpoint | Span Name | Success Status Code | Error Handling |
|----------|-----------|---------------------|----------------|
| `GET /api/notes/?column_id=:id` | `note.read` | 200 | `span.RecordError(err)` on failure |
| `POST /api/notes/` | `note.create` | 201 | `span.RecordError(err)` on failure |
| `PUT /api/notes/:id` | `note.update` | 200 | `span.RecordError(err)` on failure |
| `DELETE /api/notes/:id` | `note.delete` | 204 | `span.RecordError(err)` on failure |

### AC2: Spans contain ALL required attributes; no cardinality risks

**Given:** A CRUD endpoint is called (e.g., `POST /api/columns/`)
**When:** the span is created and populated with attributes
**THEN:**
- The following non-empty attributes are present:
  - `http.method` = the HTTP method (GET, POST, PUT, DELETE)
  - `http.status_code` = the final response status code (201 or 200 for success; 4xx/5xx on error)
  - `resource.name` = `"kanban-backend"` (inherited from OTEL SDK config)
  - `board.id` or `note.id` = UUID of the resource when available
- **No additional attributes appear** that could cause cardinality explosion. Specifically: no user emails, IPs, full request bodies, or arbitrary header values are added as span attributes.

### AC3: Error spans correctly capture exception information

**Given:** A handler encounters an unrecoverable DB error or a validation failure
**When:** the response is HTTP status ≥ 500  
**THEN:**
- The span status is explicitly set to `Error` via `span.SetStatus(codes.Error, ...)`
- `exception.message` contains a human-readable message (e.g., `"no column found for id"`)
- `exception.type` includes the Go error type (e.g., `"NotFoundError"` or `"ValidationError"`)

### AC4: Distributed trace context propagates correctly across calls

**Given:** A user performs a sequence of operations via the UI (create a note → drag it to another column → delete it)
**When:** these three requests arrive at the backend in sequence
**THEN:**
- All three spans share the **same `traceID`** so Jaeger/Tempo displays them as a waterfall.
- Each span's `parentSpanID` correctly references its predecessor within that trace.
- The context propagation uses standard W3C Trace Context headers (`traceparent`, `tracestate`).

---

## Technical Implementation Notes

- **Location:** `/backend/internal/http/span.go` — new file containing shared span helper functions: `withBoardSpan(ctx, name string) (context.Context, otel.Span)`, `withNoteSpan(...)`, and their companion "closeWithError" variants.
- Add to each CRUD handler in `internal/http/handler.go`: call the appropriate span helper before executing store operations; close the span (and record any errors) on return.
- Reuse OTel SDK from OBE-S01 — do NOT initialize a new SDK in this story. Only add manual span creation/wrapping at each business logic boundary. These spans are NOT auto-created by `otelhttp` middleware; we manually create them here because they cover domain semantics, not just HTTP layer.
- Ensure the Go build produces exactly one span per CRUD request — no double-counting from overlapping middleware + manual spans.

---

## Output / Deliverables

1. `/backend/internal/http/span.go` — shared span helper functions for board and note spans.
2. Updated `internal/http/handler.go` to wire spans into all 8 CRUD handlers.
3. Integration test: `tests/trace_test.sh` or Go test verifying that a sequence of CRUD calls produces spans sharing the same traceID in a Jaeger-instrumented test setup (or mock exporter).

## Dependencies

**Requires:** TB-S01 (DB layer + migrations) AND OBE-S01 (OTel SDK initialized with `OTEL_TRACES_EXPORTER` and `otelhttp` middleware already wired). Both must exist before feature-level spans can be created.  
Also requires at least one column in the database for test scaffolding.

Can be parallelized with OBE-S05 (Prometheus metrics) but MUST complete before OBE-S06 (span validation script depends on valid span names/attributes).

## Estimate

M (3–5 hours for a Go developer, mostly for span attribute mapping & manual OTel SDK integration)

---

*Written by Story Writer — traces to PRD G4, FR1–FR3, AC4; Architecture ADR-002/ADR-003-B*
*Corrections from original:* Fixed corrupted API contract table (misaligned pipes, typo "colunn" → correct column names/status codes), rewrote Go struct in Context as accurate attribute map instead of malformed code snippet, converted incomplete/broken AC lines into proper GWT format, added trace context propagation check (AC4) which was implied but not stated in original.
