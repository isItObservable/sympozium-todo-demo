# Test Plan: sympozium-todo-demo

**Produced by**: Testing Architect (BMAD Phase 5)  
**Date**: 2025-06-24  
**Trace**: `traceparent 00-cafe2406cafe2406cafe2406cafe2406-b3f87e69d7705e16-01`

---

## Framework Selection

| Layer | Language | Testing Framework | Rationale |
|-------|----------|-------------------|-----------|
| Unit (business logic) | Go | `testing` stdlib + `github.com/stretchr/testify/assert` | Per ADR-001, boring tech stack; testify for cleaner assertions |
| HTTP API test harness | Go | `net/http/httptest` | Standard library — no deps. Table-driven tests per Go convention (ADR-005) |
| Database integration | Go | `github.com/DATA-DOG/go-sqlmock` + real PG in CI | Unit: mock the DB conn. Integration: real PG via docker-compose or Testcontainers |
| E2E | Vanilla JS/HTML | Playwright (PWS) | No npm lock-in at project root but headless browser testing is essential for frontend flow |
| Container / deploy test | Docker + Bash | `curl` + assert exit code in makefile test target | Tests that compose stack actually starts and responds on `/health` |

### Coding conventions for tests (Go)

- **Table-driven tests** exclusively — one test function, multiple cases via table struct.
- Test names follow: `Test<Function>_<Scenario>_ReturnsExpected`.
- Helper functions tagged with `t.Helper()`.
- Database tests in `_test.go` files co-located with their package; CI uses `--tags=integration`.
- **Never** rely on wall-clock ordering — all timestamps compared after normalising to the same second (or using delta assertions within tolerance).

---

## Story B1: POST /api/todos + GET /api/todos

### Acceptance Criteria → Test Cases

#### AC B1.1: Create Todo Returns 201 with Complete Object
| # | Test Name | Input | Expected | Why |
|---|-----------|-------|----------|-----|
| T-B1-01 | `test_api_create_pending_todo` | `{title:"Buy groceries",description:"Milk, eggs",status:""}` (POST body) | HTTP 201; response JSON contains id (UUID v4 format), title="Buy groceries", description="Milk, eggs", status="pending", created_at ∈ last 1s, updated_at = created_at | Proves happy-path creation with all fields present |
| T-B1-02 | `test_api_create_todo_minimal` | `{title:"x"}` (no description) | HTTP 201; result.description = "" (empty string, not null); status="pending"; valid timestamps | Per FR2: description field is TEXT and nullable — zero-value must be empty string |
| T-B1-03 | `test_api_create_todo_uuid_format` | `{title:"Test"}` | HTTP 201; id matches `[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (v4 variant) | ADR-003 confirms `gen_random_uuid()`; Go side must validate UUID on deserialization round-trip |
| T-B1-04 | `test_api_create_concurrent_todos` | 2 parallel POST requests `{title:"A"}`, `{title:"B"}` | Total count increases by 2; no duplicate UUIDs; both return different timestamps | Race condition check — B1 creates new rows, two goroutines must not conflict at DB level |

#### AC B1.2: List Todos Returns Newest-First
| # | Test Name | Input | Expected | Why |
|---|-----------|-------|----------|-----|
| T-B1-05 | `test_api_list_empty` | GET /api/todos (no todos in DB) | HTTP 200; response body is `[]` not `null`; status=200; Content-Type=application/json | Empty collection = empty JSON array, not null. Common Go ORM gotcha |
| T-B1-06 | `test_api_list_single` | Pre-insert 1 todo, then GET | HTTP 200; array length = 1; returned object matches input | Simple round-trip verification |
| T-B1-07 | `test_api_list_three_ordered_newest_first` | Pre-insert todos A (T-5s), B (T-3s), C (T-1s) in that order, then GET | HTTP 200; array length = 3; result[0].id == C.id; result[1].id == B.id; result[2].id == A.id | ADR-002 spec: `ORDER BY updated_at DESC` (newest-first). Verify ordering explicitly |
| T-B1-08 | `test_api_list_pagination_huge_table` | Pre-insert 10000 rows, GET /api/todos | HTTP 200; array length = 10000; response time < 2s under test conditions; memory usage doesn't exceed 512MB | Performance boundary: large collections must not cause OOM or unbounded allocs. No pagination on MVP yet so fetch all (known limitation) |

#### AC B1.3: Missing/Empty Title Returns 400
| # | Test Name | Input | Expected | Why |
|---|-----------|-------|----------|-----|
| T-B1-09 | `test_api_create_empty_title` | `{title:""}` | HTTP 400; response body contains status=400 + error message mentioning "title" | ADR-002: empty string is explicitly invalid per schema (title: VARCHAR(255) NOT NULL) |
| T-B1-10 | `test_api_create_missing_title` | `{}` (no title field at all) | HTTP 400; response contains status=400 + error mentioning "title required" or similar | Missing field should be caught by JSON bind with validation or explicit check |
| T-B1-11 | `test_api_create_whitespace_only_title` | `{title:"   \t\n  "}` | HTTP 400 (or strip to "" → then 400) — title must fail when trimmed to empty | Leading/trailing whitespace is not acceptable input; trim before validation check |
| T-B1-12 | `test_api_create_null_title` | Raw JSON body `{\"title\":null}` | HTTP 400; null string should be rejected as missing, not stored as literal "null" | Go json.Unmarshal with *string pointer vs required field — must handle both nil and empty string paths |
| T-B1-13 | `test_api_create_title_boundary_256_chars` | `{title: "<256 spaces>"}` (exactly 256 chars) | HTTP 400 (exceeds VARCHAR(255)); response mentions max length constraint | ADR-003 schema: title is VARCHAR(255) — validation before DB insert avoids partial writes |
| T-B1-14 | `test_api_create_title_boundary_255_chars` | `{title: "<exactly 255 chars>"}` | HTTP 201; title stored exactly as provided (length verified in response) | Boundary test — 255 should succeed, 256 should fail. Test both edges |

### Backend Package-Level Unit Tests (store layer)
| # | Test Name | Input/Setup | Expected | Why |
|---|-----------|-------------|----------|-----|
| T-B1u-01 | `TestTodoStore_Create_row_inserted` | Mock DB returns pgx result with 1 →, then query back | Store.Create() returned nil err; row exists in mock queries log | Verify repository layer correctly builds INSERT SQL with correct named parameters |
| T-B1u-02 | `TestTodoStore_List_orderClause_newestFirst` | Insert via store: A(T1), B(T3), C(T2); then List() | First result has updated_at=T3 (latest) | Directly tests repository ORDER BY logic without HTTP layer |
| T-B1u-03 | `TestTodoStore_Create_nilTitle_returnedError` | Store.Create with title="" | Error returned; not nil, contains "title" substring | Repository layer should validate before passing to DB |

---

## Story B2: PATCH /api/todos/{id}/status + DELETE /api/todos/{id}

### Acceptance Criteria → Test Cases

#### PATCH /api/todos/{id}/status
| # | Test Name | Input | Expected | Why |
|---|-----------|-------|----------|-----|
| T-B2-01 | `test_api_patch_status_pendingToCompleted` | POST first with title="Task1"; GET ID back; PATCH `{status:"completed"}` | HTTP 200; result.status = "completed"; updated_at changed > created_at; body returns complete todo obj | Happy path for status transition |
| T-B2-02 | `test_api_patch_status_completedToPending` | Same as T-B2-01 but PATCH `{status:"pending"}` | HTTP 200; result.status = "pending"; updated_at changed | Bidirectional status transitions must both work |
| T-B2-03 | `test_api_patch_status_invalidValue` | PATCH `{status:"deleted"}` or `{status:"InProgress"}` (non-standard values) | HTTP 400; error mentions valid status values ("pending" / "completed") | Enum validation — only two allowed values per PRD schema |
| T-B2-04 | `test_api_patch_status_notFound` | PATCH on UUID that was never created | HTTP 404; body = RFC 7807 Problem Details: `{type:"...", title:"Not Found", status:404, detail:"..."}` | Standardized error format per ADR-002. Must use `application/problem+json` content type |
| T-B2-05 | `test_api_patch_status_missingId_inPath` | PATCH /api/todos//status (malformed URL) or /api/todos/abc/status (invalid UUID) | HTTP 400; error mentions "invalid id" or "invalid uuid" | Invalid UUID format must be rejected before DB query to avoid panics from pgx |
| T-B2-06 | `test_api_patch_status_emptyBody` | PATCH with Content-Type application/json and body `{}` (no status field) | HTTP 400; error mentions "status required" | Partial update requires at least one field; empty payload = no-op rejected |
| T-B2u-01 | `TestTodoStore_UpdateStatus_found` | Mock DB returns affected row, query back verifies fields | Store.UpdateStatus(id,"completed") updates the row; updated_at is NOW() | Repository layer SQL generation + return verification |
| T-B2u-02 | `TestTodoStore_UpdateStatus_notFound_affectedRowsZero` | Mock DB returns rowsAffected=0 | Returns NotFound error (not a generic "update failed" — must distinguish) | Differentiate "no row" from "db error" for correct HTTP status code |

### DELETE /api/todos/{id}
| # | Test Name | Input | Expected | Why |
|---|-----------|-------|----------|-----|
| T-B2d-01 | `test_api_delete_success` | POST first; GET ID; DELETE {id} | HTTP 204 (no body, per spec); subsequent GET returns 404 | Happy path — verify soft/hard delete actually removes row |
| T-B2d-02 | `test_api_delete_notFound` | DELETE UUID that was never created | HTTP 404; RFC 7807 Problem Details body (same format as PATCH) | Consistent error handling across endpoints |
| T-B2d-03 | `test_api_delete_invalidId` | DELETE /api/todos/invalid-id-here | HTTP 400; error mentions invalid uuid | Invalid UUID must be caught on parse, not from DB error |
| T-B2d-04 | `test_api_delete_doubleDelete` | POST first; GET ID; DELETE {id}; DELETE {id} again | Second DELETE returns 404 (first succeeded and removed, second finds nothing) | Idempotency check — delete of already-deleted should be 404 not 500 |
| T-B2d-05 | `test_api_delete_listsRefreshAfterDelete` | DELETE then GET /api/todos | Result array no longer contains the deleted item; length decreases by 1 | End-to-end data integrity check across endpoints |

---

## Story O1: Health/Ready + Structured Logging + Request Tracing

| # | Test Name | Input/Setup | Expected | Why |
|---|-----------|-------------|----------|-----|
| T-O1-01 | `test_health_returns200` | GET /health (server up, DB connected) | HTTP 200; body: `{"status":"ok"}`; Content-Type: application/json | Per PRD AC5 + ADR-005 liveness check |
| T-O1-02 | `test_health_dbDisconnected` | Disconnect DB pool (no active conns); GET /health | HTTP 200 still (liveness ≠ readiness) — server process is alive, even if unhealthy. ADR-005 defines `/health` as liveness-only | Distinguish from /ready for proper k8s probe semantics |
| T-O1-03 | `test_ready_returns200_HealthyStack` | DB connected and healthy; GET /ready | HTTP 200; body: `{"status":"ok"}` or similar with DB health details | Per ADR-005 readiness check — must verify DB pool can reach PostgreSQL |
| T-O1-04 | `test_ready_dbNotFound` | Stop/disable DB; GET /ready | HTTP 503; error mentions readiness/DB failure | k8s liveness probe will restart pod on `/health`; readiness probe routes traffic away via 503 |
| T-O1-05 | `test_structuredLog_request_loggedJSON` | POST /api/todos with {title:"log-me"}; capture log output | Structured JSON line contains: method="POST", path="/api/todos", status=201 or 400, duration_ms > 0, req_id set | Verifies slog + JSON handler is configured correctly for observability (FR5/G3) |
| T-O1-06 | `test_tracing_traceparent_propagated` | Client sends `traceparent: 00-abc...def-traceid-spanid-01`; server logs/metrics capture it | Trace ID from request header stored in span context; response includes X-Trace-Id header or trace is recorded on the server side | End-to-end tracing chain must be visible for demo purposes (G3) |
| T-O1-07 | `test_log_level_config` | Set env LOG_LEVEL=debug then INFO; make requests at each level; check output | At INFO: no trace-level logs emitted. At DEBUG: all request details logged | Config-based log level must work via env var (ADR-005) |
| T-O1-08 | `test_contentTypes_allEndpoints` | POST to /api/todos and any other endpoint with Content-Type: text/plain (malformed JSON), text/html, etc. | 400 or 415; never panics with nil pointer deref from json.Unmarshal on bad input | Malformed Content-Type + bad payload combo is a crash vector — must be caught gracefully |

### Middleware layer tests
| # | Test Name | Input/Setup | Expected | Why |
|---|-----------|-------------|----------|-----|
| T-O1m-01 | `TestRecovery_panickingHandler` | Inject panic into handler; middleware wraps it | Returns 500 (or 200 if just recovery, depends on implementation); log contains "panic recovered" message | Panic recovery must not crash the server. Per ADR-005, panic recovery is a requirement for liveness |
| T-O1m-02 | `TestRecovery_noPanic` | Normal handler (no panic) | Returns expected 2xx or 4xx/5xx; no extra log lines | Recovery middleware must not add noise on normal execution |

---

## Story F1: Frontend Post-it Board UI

### E2E Tests (Playwright — headless Chrome/Firefox)
| # | Test Name | Description | Expected |
|---|-----------|-------------|----------|
| T-F1-01 | `test_emptyBoard_withAddButton` | Open `/`; verify empty state renders with visible "Add" button | Board area present, "Add" or "+" button visible and clickable; no error in console |
| T-F1-02 | `test_addTodo_createsPostIt` | Click "Add"; type title "Buy milk"; confirm/submit | New post-it appears on board with text "Buy milk", correct CSS class (post-it/yellow), status indicator for pending |
| T-F1-03 | `test_markComplete_strikethroughVisual` | Click completed checkbox on todo; verify visual change | Post-it visually distinguishes as complete: line-through text, different color (grey/white), or checkmark icon |
| T-F1-04 | `test_deleteTodo_removesFromBoard` | Add then delete a todo via UI | Post-it removed from board list AND server-side record deleted (GET /api/todos confirms) |
| T-F1-05 | `test_add_todoWithVeryLongTitle_wrapsOrTruncates` | Enter title of 300 chars; click save / submit or rely on server validation that enforces ≤255 and displays error | UI handles gracefully: either truncates with ellipsis at 255 char limit, OR shows client-side preview showing it would be rejected. Server must still enforce via API (not just UX) |
| T-F1-06 | `test_fetchError_displays_message` | Stop backend server; click Add or any action that calls API | Frontend displays user-friendly error message instead of blank screen or console error |

### Frontend Edge Cases
| # | Test Name | Description | Expected |
|---|-----------|-------------|----------|
| T-F1e-01 | `test_browserBackButton_afterAdd` | Add a todo (which POSTs to API), then hit browser back button. Navigate forward by clicking Refresh board or re-entering page. | Board still shows the added todo — page is stateless/refresh-based so no history issues |
| T-F1e-02 | `test_resizeResponsive_onMobileViewport` | Resize browser simulating Mobile 375px viewport; interact with add flow | Layout remains functional on narrow screens; button accessible; post-it not truncated off-screen |

---

## Story D1: Dockerfile + docker-compose.yml + Makefile

### Container & Deployment Tests
| # | Test Name | Expected | Why |
|---|-----------|----------|-----|
| T-D1-01 | `test_dockerCompose_up_stack` | `docker compose up -d`; `docker compose ps` shows `db` and `app` both healthy; `curl localhost:8080/health` returns 200 | Basic deploy verification — docker-compose must actually start both services as per ADR-006 design |
| T-D1-02 | `test_dockerCompose_down_clean` | `docker compose down -v`; volume wiped; subsequent `up` starts fresh with no leftover data | Ensure cleanup works for CI/CD and local dev reset |
| T-D1-03 | `test_makefile_build_target_runs_goCompile` | `make build` (if implemented) → exits 0; binary created. Verify binary has correct Go version | Makefile target must execute correctly with the right Go toolchain |
| T-D1-04 | `test_makefile_migrateUp_appliesSchema` | `make migrate-up` → creates todos table; `psql -c "SELECT * FROM inform ... "` confirms `todos` table exists with correct columns | Per ADR-003: golang-migrate runs 001_create_todos on startup or via makefile target |
| T-D1-05 | `test_dockerSize_binaryLessThan70MB` | After build and Docker image layers, total image size < 70 MB (alpine base + compiled Go binary only) | ADR-001 goal: small container sizes (~20MB alpine). Verify actual built image stays small |

---

## Integration / Cross-Story E2E Test

| # | Test Name | Description | Expected |
|---|-----------|-------------|----------|
| T-INT-01 | `test_fullLifecycle` | 1. Start docker-compose stack. 2. POST `{"title":"Life Cycle Item"}`. 3. GET and confirm it appears. 4. PATCH to completed. 5. GET confirms status=completed. 6. DELETE. 7. GET confirms 404. 8. Check all HTTP status codes are correct (201, 200, 200, 204, 404). | Full CRUD lifecycle verified end-to-end through Dockerized stack — the "golden path" for demo purposes (PRD AC1-AC5) |
| T-INT-02 | `test_healthChecksAllPass` | After compose up: GET /health returns 200; GET /ready returns 200; check docker logs of both containers contain NO panic/fatal messages within first 60s | Both health/ready pass (PRD AC5); no panics in logs during initial startup window |

---

## Test Matrix Summary

| Story | Unit Tests | API Tests | E2E Tests | Integration Tests |
|-------|-----------|-----------|-----------|-------------------|
| B1 | 3 (T-B1u-01 to T-B1u-03) | 6 (T-B1-01 to T-B1-08, minus duplicates) | 0 (frontend-only domain) | T-INT-01 (shared) |
| B2 | 2 (T-B2u-01 to T-B2u-02) | 6 (T-B2-01 to T-B2d-05) | 0 | T-INT-01 (shared) |
| O1 | 0 (infra) | 8 (T-O1-01 to T-O1m-02) | 0 | T-INT-02 (shared) |
| F1 | 0 (client-side) | 0 (server-side domain) | 6 (T-F1-01 to T-F1e-02) | N/A |
| D1 | N/A | N/A | N/A | 5 (T-D1-01 to T-D1-05) |

**Total planned test cases**: 39+ (including boundary and error cases across all layers)

---

## Expected Coverage Report Format (to be filled when implementation exists)

```
STORY COVERED: <story-id>
COVERAGE GAPS: <list of ACs not covered, or "none">
TESTS ADDED: <count> | PASSING: 100% (if all pass; otherwise X% / total)
FRAMEWORK: Go testing + httptest / Playwright / curl
```

---

## Risks & Limitations (Known at This Time)

1. **No code to test yet** — this is a planning document, not an execution report per se. Actual test results require first implementing the stories in order B1 → B2 → O1/F1/D1.
2. **Determinism of UUIDs & timestamps** – tests MUST compare idempotent fields (status, title), not exact timestamp values (only within a 1-second window).  
3. **Random DB port allocation in compose test** — `docker compose` uses dynamic ports for internal networking; must use explicit service names or fixed ports.
4. **No real Playwright installed yet** – the E2E tests are scaffolded but require `@playwright/test` to be added as a dev dependency once frontend is available.
5. **Integration test requires Docker socket** — T-D1 series tests need docker-in-docker or host-mounted Docker socket to execute.

---

## Next Steps for BMAD Crew

1. **Coding agent** implements Story B1 (foundation API).  
2. **Testing Architect** fills in the actual Go test code matching the specs above (T-B1-01–T-B1-14 etc.) during implementation review or post-merge patch.
3. **Code Reviewer** runs adversarial review, checking that every AC listed here is satisfied by test + code diff.
4. **O11y Engineer** verifies O1's health/ready/log/tracing behavior against this test matrix as well.

---

*Documented at BMAD Phase 5 pre-implementation. Will be superseded by actual coverage reports once B1, B2, O1, F1, D1 are each merged.*
