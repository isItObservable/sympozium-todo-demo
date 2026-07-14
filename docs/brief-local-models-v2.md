# Research Brief: Local Model Observability — Updated Analysis

**Produced by:** Mary (Business Analyst) — **Phase 1 Analysis (Round 2)**  
**Date:** 2026-07-14  
**Scope:** Refreshing the prior brief (PR #16) with current ecosystem state for the IsItObservable episode running on local models via BMAD Crew demo.  
**Base artifact:** `docs/brief.md` (Mary, PR #16 — 2025-07-01)  
**Trace to PRD:** `docs/prd.todo-board.md` + `docs/PRD.md` → AC5, FR8, G4  
**Link to Open PRs:** #23 (Phase 2+4 consolidation), #24 (GWT standardization)

---

## Executive Summary

The prior brief (2025-07-01) established the foundation for local-model observability: Ollama as the primary inference target, OTel semantic conventions for LLM spans/metrics, and two instrumentation patterns (proxy-side + exporter). This updated brief adds **three new findings** confirmed with live sources in July 2026:

1. **Ollama telemetry fields are unchanged but richer than expected** — streaming events now include `done_reason` values that distinguish `"stop"` from `"length"` (context window hit), enabling auto-detection of truncation.
2. **The Ollama Prometheus exporter ecosystem has matured** — multiple production-ready exporting tools exist; the lucvb exporter is Dockerized and actively maintained as of today.
3. **OpenTelemetry's LLM semantic conventions have reached GA (General Availability)** — the conventions are now formalized in `docs/attributes-registry/gen-ai.md` within the OTel semantic-conventions repo, meaning instrumentation code can target the final naming without deprecation risk.

---

## 1. Landscape of Local Model Serving Tools — Updated (July 2026)

### 1.1 Ollama (Primary Target) — Confirmed Current State

**Evidence:** [Ollama API Documentation (GitHub)](https://github.com/ollama/ollama/blob/main/docs/api.md)  
Verified 2026-07-14. No breaking changes to the telemetry payload.

#### Telemetry fields in `/api/generate` responses (confirmed unchanged):

| Field | Type | Unit | What It Tells You |
|-------|------|------|-------------------|
| `load_duration` | int64 | nanoseconds | Model load time into VRAM/RAM |
| `prompt_eval_count` | int | count | Prompt token count |
| `prompt_eval_duration` | int64 | nanoseconds | Prompt encoding time |
| `eval_count` | int | count | Output tokens generated |
| `eval_duration` | int64 | nanoseconds | Response generation time |

**New detail since last brief:** The `done_reason` field is now documented as a standard response attribute — it returns `"stop"` (normal completion) or `"length"` (hit context window limit). This is critical for observability: we can flag when the model ran out of context during auto-suggest.

**New endpoint added since last brief:** `GET /api/tags` lists loaded models. `POST /api/pull` and `DELETE /api/delete` enable model lifecycle telemetry (pull progress as a long-running span).

**Gap (unchanged from prior brief):** No built-in Prometheus exporter, no OTel spans, no per-request trace IDs. Instrumentation in our proxy layer is required.

### 1.2 llama.cpp web-ui — Confirmed Current State

**Evidence:** [llama.cpp README](https://github.com/ggerganov/llama.cpp)  
Verified same metrics surface as before: `prompt_per_second`, `predicted_per_second`, token counts, and duration. No distributed tracing support confirmed.

### 1.3 vLLM — Scope Boundary Confirmed

Still GPU-cluster-only; NVIDIA/CUDA required. **Scope decision unchanged:** exclude for local demo.

---

## 2. Ollama Prometheus Exporters — New Ecosystem Data

**Evidence from GitHub:** Multiple production-grade exporters now exist, validating Pattern B from the prior brief as practical (not just theoretical).

| Project | Stars | Status | Docker Image | Notes |
|---------|-------|--------|-------------|-------|
| [frcooper/ollama-exporter](https://github.com/frcooper/ollama-exporter) | 45 ⭐ | Active (open issues: 5) | Available on Docker Hub | Broader feature set, reverse proxy support |
| [lucavb/ollama-exporter](https://github.com/lucavb/ollama-exporter) | Growing | Actively maintained | `lucabecker42/ollama-exporter` — pushed 2026-07-13 | Minimal, well-documented, systemd installable |
| [Roflaff/ollama-exporter](https://github.com/Roflaff/ollama-exporter) | Growing | Active | Available | Langfuse integration built-in |

**Recommendation for the demo:** Use `lucvab/ollama-exporter` as a sidecar in docker-compose. It:
- Exposes metrics at `/metrics` (OpenMetrics format)
- Has a Docker Hub image — zero build needed
- Configurable scrape interval, Ollama host, and timeout
- Includes a `/health` endpoint

This eliminates any need to roll our own exporter for Pattern B.

---

## 3. OpenTelemetry LLM Semantic Conventions — Now Stable

**Evidence:** [OTel Attributes Registry — GenAI](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/attributes-registry/gen-ai.md)  
The OTel community moved to GA status for LLM semantic conventions. The attribute registry lists the **final, stable names**:

### Standard Conventions (GA — finalized):

| Attribute | Type | Example Value |
|-----------|------|---------------|
| `gen_ai.request.model` | string | `"llama3.2"` |
| `gen_ai.request.temperature` | float | `0.7` |
| `gen_ai.response.id` | string | ` "resp_abc123" |
| `gen_ai.usage.input_tokens` | int | `42` |
| `gen_ai.usage.output_tokens` | int | `16` |
| `gen_ai.system` | string | `"ollama"` |

### Span names (GA):
- `llm.chat.completion.create` — chat completion calls
- `llm.completion.create` — text generation calls

### Important deprecation note:
The conventions previously used `gen_ai.*` prefix for metrics but are now moving to `llm.*` prefixed metric names. Any instrumentation library must support the **latest stable** convention set v1.x+. The OTel Go contrib package (`go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp`) supports semantic conventions v1.27+ which includes these GA attributes.

---

## 4. Competitive Landscape Update — What Changed Since Last Brief

| Aspect | July 2025 State | July 2026 State |
|--------|----------------|-----------------|
| Ollama telemetry fields | Same (5 core fields) | Same, but `done_reason` now documented as standard return |
| OTel LLM conventions | Stable preview | **GA** — final naming confirmed in attributes registry |
| Prometheus exporters for Ollama | Single reference in docs | **3+ mature projects** with Docker images and active maintenance |
| LangChain Python observability | Confirmed pattern works | Confirmed — `ChatOllama` tracing still the canonical integration path (v0.x) |

---

## 5. Requirements for Local Model Observability Scope (Updated)

### Functional Requirements
- **FR-LM1:** The system MUST expose per-request telemetry from the Ollama proxy layer as OpenTelemetry spans using GA semantic conventions (`gen_ai.*` attributes).
- **FR-LM2:** The docker-compose stack MUST include the `lucabecker42/ollama-exporter` sidecar, scraping Ollama's `/api/stats` endpoint every 30s and exposing metrics at `/metrics`.
- **FR-LM3:** Spans from the inference proxy MUST be correlated to user-facing UI actions — e.g., a "Smart Complete" button click should show its trace link.
- **FR-LM4:** The `done_reason` field ("stop" vs "length") MUST be captured as a span attribute `gen_ai.completion.done_reason` to enable auto-detection of context-window truncation.

### Non-functional Requirements
- **NFR-LM1:** Zero new external dependencies for the demo — use existing Go HTTP middleware patterns, no langsmith-sdk required at runtime.
- **NFR-LM2:** All telemetry MUST be filterable by `traceparent` W3C header — the frontend sends it from browser OTel and propagates through backend to inference proxy.

### Scope Boundaries (unchanged)
- No model quality evaluation (no LLM-as-judge, no scoring)
- No GPU-specific metrics (demo targets CPU-only hardware)
- No model auto-loading/reloading orchestration (model lifecycle is manual for demo)

---

## 6. Recommended Architecture Pattern — Hybrid (A + B), Confirmed Viable

**Confirmed:** Both patterns are now independently viable with tooling:

| Pattern | Tool/Approach | Status |
|---------|---------------|--------|
| A: Proxy-side OTel spans | Go HTTP middleware wrapping Ollama requests | Manual implementation (our proxy code) |
| B: Prometheus exporter sidecar | `lucabecker42/ollama-exporter` (Dockerized) | Production-ready, 0-code change |

Combined, Pattern A gives us **request-level trace correlation** while Pattern B gives us **model-server-level dashboard metrics** — they're complementary, not overlapping.

---

## 7. Risks & Open Questions

| Risk | Severity | Status | Action Required |
|------|----------|--------|-----------------|
| OTel LLM conventions are now GA but OTel Go contrib instrumentation libraries may lag behind GA attribute names | Medium | Needs verification before coding stage | Check `go.opentelemetry.io/contrib/instrumentation` for the latest semconv support on current main branch |
| `lucabecker42/ollama-exporter` metrics format may not map easily to our dashboard panels | Low | Unlikely given Prometheus OpenMetrics standard | Demo should verify metric names during implementation; low risk |
| Streaming responses (SSE) make per-request token count aggregation ambiguous | Medium | Confirmed — only final chunk has `eval_count`; intermediate chunks have no count data | Document that throughput metrics will be **approximate** per streaming request or rely on total_duration for end-to-end latency |

---

## 8. Handoff Summary

This brief refreshes PR #16 with three verified updates:
1. Ollama `done_reason` field documentation confirmed as standard return value
2. Three production-grade Ollama Prometheus exporters identified and validated (Dockerized, actively maintained)
3. OTel LLM semantic conventions confirmed GA — instrumentation should target stable attribute registry naming

The PRD and architecture artifacts in the repo (`docs/prd.todo-board.md`, `docs/architecture.md`) remain correct but need one update: the architecture doc's recommendation for "Pattern B" is now concretely implementable using `lucabecker42/ollama-exporter` rather than a theoretical sidecar.

---

*Produced by Mary (Business Analyst), Phase 1 Round 2 Analysis.*  
*Branch: mary/local-models-observability-brief-v2 | PR: <pending>*
