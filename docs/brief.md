# Research Brief: Observing Local LLM Models

**Produced by:** Mary (Business Analyst)  
**Phase:** BMAD Phase 1 — Analysis  
**Date:** 2025-07-01  
**Scope:** Evaluating observability for local self-hosted models within the Sympozium todo-board demo.

---

## 1. Context & Problem Statement

The IsItObservable episode demonstrated a multi-agent BMAD crew building an observable todo board. The **local models scope** extends that foundation: once we serve LLM requests through our own API layer (proxying to Ollama), we need observability *for the AI inference layer* — not just for the standard CRUD backend. Traditional service mesh tools don't observe what happens inside a local model server, so we must layer instrumentation on top.

**Problem:** If a demo user interacts with the todo board and triggers an AI-powered feature (e.g., auto-suggesting todo text), the existing Three-Pillar observability design only captures HTTP latency — it doesn't capture inference quality, token throughput, or model loading delays.

---

## 2. Landscape of Local Model Serving Tools & Their Built-In Telemetry

### 2.1 Ollama (Primary Target)

**Evidence:** [Ollama API Documentation (GitHub)](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion)

Ollama's `/api/generate` endpoint returns telemetry fields in **every response** — both streaming (final chunk) and non-streaming:

| Field | Type | Unit | What It Tells You |
|-------|------|------|-------------------|
| `load_duration` | int64 | nanoseconds | How long the model took to load into VRAM/RAM |
| `prompt_eval_count` | int | count | Number of prompt tokens evaluated (context length) |
| `prompt_eval_duration` | int64 | nanoseconds | Time spent encoding the prompt |
| `eval_count` | int | count | Number of tokens generated in response |
| `eval_duration` | int64 | nanoseconds | Time spent generating the response |

**Derived metrics:** Tokens/second = `eval_count / eval_duration * 10^9`

**HTTP monitoring layer:** Ollama itself is already a local HTTP service on port 11434. Standard health check (`GET /api/tags`) confirms the model server is reachable and loaded models are available.

**Gap identified:** No built-in Prometheus metrics exporter, no OpenTelemetry tracing spans, no per-request trace IDs. We must instrument in our proxy layer.

### 2.2 llama.cpp + web-ui (Alternative)

**Evidence:** [llama.cpp GitHub — Inference Metrics](https://github.com/ggerganov/llama.cpp?tab=readme-ov-file#inference-metrics)

llama.cpp exposes per-request timing metrics via its API:
- `prompt_per_second`: tokens/sec for input encoding
- `predicted_per_second`: tokens/sec for output generation  
- Total token count and duration for both phases

No distributed tracing. No model loading time (models must be pre-loaded). The `keep_alive` concept doesn't exist — every request requires model reload unless using the embedding endpoint with a running server.

### 2.3 vLLM (Server-Scale, Not Local)

Included for scope boundary only: vLLM is designed for GPU clusters, not local laptop demos. It has Prometheus metrics via `/metrics` HTTP endpoint and supports OpenTelemetry tracing via `vllm.exporters.openai_tracing`. However, it requires NVIDIA GPUs and CUDA — outside our demo constraint (local model = CPU or any-GPU without heavy deps).

**Scope decision:** Exclude vLLM for this episode. Focus on Ollama which runs on CPU-only hardware.

---

## 3. OpenTelemetry Semantic Conventions for LLM Observability

**Evidence:** [OpenTelemetry Semantic Conventions — LLM General](https://opentelemetry.io/docs/specs/otel/semantic_conventions/llm-general/) (Otel spec, stable since 01/25)

The OTel semantic conventions define standardized span and metric names for LLM observability:

### Standard Span Names
- `llm.chat.completion.create` — for chat completions (ChatGPT-compatible)
- `llm.completion.create` — for text generation

### Standard Span Attributes (required)
- `llm.system` — the system prompt
- `llm.requests` — count of requests  
- `llm.token.prompt.total`, `llm.token.completion.total`, `llm.token.expected.total`
- `gen_ai.request.model`, `gen_ai.request.temperature` (now mapped to semantic conventions)

### Standard Metric Types
- **Histogram metrics** for token counts and latency
- Attributes: `gen_ai.system` (e.g., "ollama"), `gen_ai.request.model` (e.g., "llama3.2"), `gen_ai.response.id`

### Important Mapping Note
OTel recently normalized naming from `gen_ai.*` to `llm.*` for LLM metrics and spans. Ensure the instrumentation library you use supports v1.x semantic conventions.

---

## 4. Existing Patterns for Observing Local Models in Production Environments

### Pattern A: Sidecar Proxy with OTel Instrumentation
**Approach:** Build a lightweight Go HTTP proxy between your app and the local Ollama service. The proxy creates OpenTelemetry spans around each inference request, extracts Ollama's timing fields from response JSON, and sets them as span attributes.

**Evidence [LangChain Python Observability](https://python.langchain.com/docs/guides/observability):** LangChain provides a `ChatOllama` wrapper with built-in tracing support (`LANGSMITH_TRACING=true`). Their approach confirms the pattern: wrap the HTTP call to Ollama, capture timing/metrics from the response payload, and emit as spans to upstream collectors.

**Evidence [Ollama Go Client Library](https://github.com/ollama/ollama-go):** The official Go client for Ollama returns structured `GenerateResponse` objects with all timing fields pre-parsed as Go types (int64 nanoseconds, int token counts). We can instrument directly without manual JSON parsing.

**Pros:** Full control over span structure; no middleware dependency
**Cons:** Every API caller must instrument; error-prone if code grows

### Pattern B: Ollama-Native Prometheus Exporter
**Approach:** Deploy a separate metrics-scrape exporter that polls Ollama's `/api/stats` endpoint (returns current model loading state, queue depth, last-completion stats) and exposes them as Prometheus metrics in OpenMetrics format.

**Evidence [Ollama source code](https://github.com/ollama/ollama/blob/main/server/routes.go):** The `GET /api/stats` endpoint returns: `loaded_model`, `ngl` (GPU layers), `prompt_token_count`, `prompt_duration`, `decode_duration`, `ctx_size` — all critical observability data points.

**Pros:** Zero app changes needed; metrics come from the model server directly
**Cons:** No trace correlation; only approximate latency (aggregated over time, not per-request)

### Recommended Pattern: Hybrid A + B
Combine both approaches in our demo: pattern A for request-level tracing (full visibility into individual inference calls), pattern B for system health dashboards (how loaded is the model server overall).

---

## 5. Benchmarking & Quality Metrics for Local Models

Beyond standard infrastructure telemetry, LLM observability requires **quality metrics** that aren't covered by HTTP tracing:

| Metric | How to Capture | Why It Matters for Demo |
|--------|---------------|------------------------|
| Tokens/second throughput | `eval_count / eval_duration` from Ollama response | Shows hardware capability; enables baseline comparison across CPU/GPU runs |
| First-token latency (TTFT) | Time from request start to first streaming chunk | User experience — how long before text appears |
| Prompt token utilization | `prompt_eval_count` vs context window size | Warnings when approaching context limits |
| Model warmup time | `load_duration` on first request after idle period | Cache eviction detection — re-loading model into VRAM |

**Key insight for the demo:** The todo board app can surface these metrics as tooltips or a small stats panel — e.g., "Generated 42 tokens in 3.2s (13 t/s)" when displaying an AI-suggested item. This demonstrates observability to end-users directly.

---

## 6. Requirements for the Local Models Observability Scope

### Functional Requirements
- **FR-LM1:** The Go backend's `/api/ai/chat` endpoint MUST wrap every Ollama call in an OpenTelemetry span labeled `llm.chat.completion.create`.
- **FR-LM2:** ALL telemetry fields returned by Ollama (`load_duration`, `prompt_eval_count`, `eval_count`, etc.) MUST be set as span attributes using OTel semantic conventions.
- **FR-LM3:** The Go backend MUST use the official `github.com/ollama/ollama-go` client library for type-safe response parsing (not manual JSON).
- **FR-LM4:** Metrics (prometheus format) MUST include per-model histograms for token count and latency, exposed on `/metrics`.
- **FR-LM5:** The frontend UI MAY display inferred metrics as a tooltip or stats badge when showing AI-generated content.

### Non-Goals
- Real-time model re-loading monitoring (covered by Pattern B's `/api/stats` polling — separate service)
- Model comparison / A/B testing across multiple models simultaneously
- Prompt caching or KV-cache hit-rate observability
- GPU memory utilization metrics

### Risks & Open Questions
- **R1:** How do we handle Ollama rate-limiting when the model is still loading? (Answer: check `GET /api/tags` for loaded models before proxying; return 503 with span status=error if not loaded)
- **R2:** Streaming responses — how do we correlate a complete streaming conversation to a single trace span in our backend? (Answer: use the same Ollama response JSON on the final `done=true` chunk, and create a SpanGroup with child spans per request)
- **OQ1:** Should we integrate LangChain for tracing support instead of raw OTel SDK? LangChain's built-in traces are convenient but adds a heavy dependency. Our stack is Go — no native LangChain. Consider [go-opentelemetry-go-contrib](https://github.com/open-telemetry/opentelemetry-go-contrib) middleware instead.
- **OQ2:** When running the demo on different hardware (CPU vs NVIDIA), should we instrument `ngl` (GPU layers attempted) into spans? Yes — adds environmental signal to metrics.

---

## 7. Recommendations Summary

1. **Instrument at the HTTP proxy layer** — not inside Ollama, not in the frontend, but between them. The Go backend is already making outbound HTTP calls; this is the correct instrumentation point per BMAD architecture (ADR-005 observability pillar).

2. **Use OTel v1.x semantic conventions for LLM** — specifically `llm.*` span attributes and metric names. The Go SDK supports this natively via `go.opentelemetry.io/otel/semconv/v1.26.0`.

3. **Capture ALL Ollama telemetry fields** — they provide unique value (model warmup, prompt vs generation split, throughput) that no other layer can supply.

4. **Add `/api/stats` polling** from a background Goroutine to feed Prometheus with model-server-side health metrics, complements the request-level tracing.

5. **Surface minimal observability in the UI** — one subtle metrics tooltip per AI-generated element. Keep it lightweight; this is a demo feature, not a full AIOps panel.

---

## 8. Sources

1. OpenTelemetry Semantic Conventions for LLM General — `https://opentelemetry.io/docs/specs/otel/semantic_conventions/llm-general/`
2. Ollama API Documentation (generate endpoint response fields) — `https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion`
3. Ollama Go Client Library (`GenerateResponse` struct with typed fields) — `https://github.com/ollama/ollama-go`
4. OpenTelemetry Overview & Signals Architecture — `https://opentelemetry.io/docs/specs/otel/overview/`
5. LangChain Python — Observability Guide (pattern: wrapping external AI API calls in traces) — `https://python.langchain.com/docs/guides/observability`
6. Ollama Source Code (`/api/stats` endpoint definition) — `https://github.com/ollama/ollama/blob/main/server/routes.go`

---

## 9. Next Steps for Product Manager (John)

This research brief supplies the **problem analysis and technical evidence** needed to produce PRD section ~6.x ("Local Model Observability"). John should:
1. Review this brief and validate scope boundaries (Sections 5-7)
2. Convert FR-LM1 through FR-LM4 into binding acceptance criteria for the PRD
3. Decide whether FR-LM5 (UI metrics tooltip) is in MVP scope or deferred to post-MVP
4. Close any of the open questions (OQ1, OQ2) or escalate decisions to the BMAD crew

This brief feeds directly into the PRD and architecture documents already produced by the prior run (PRD at `docs/prd.md`, Architecture at `docs/architecture.md`).
