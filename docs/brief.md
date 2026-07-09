# Research Brief: Observing Local LLM Models — Updated (v2)

**Produced by:** Mary (Business Analyst)  
**Phase:** BMAD Phase 1 — Analysis (UPDATED)  
**Date:** 2025-07-08 (original brief dated 2025-07-01)  
**Scope:** Evaluating observability for local self-hosted models within the Sympozium todo-board demo.  

---

## Changelog from v1 (Mary — this run)

| # | Change | Why |
|---|--------|-----|
| 1 | **OTel GenAI semantic conventions: moved repo** | The conventions no longer live at `opentelemetry.io/docs/specs/otel/semantic_conventions/llm-general/` (HTTP 404). They have migrated to a dedicated [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai) repository under `docs/gen-ai/gen-ai-spans.md`. |
| 2 | **Span attribute namespace: `gen_ai.*` (not just `llm.*`)** | The new conventions use `gen_ai.*` attributes for spans (e.g., `gen_ai.operation.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`). A parallel set of **metrics** uses `gen_ai.client.*` metrics. The previous brief's claim that OTel normalized everything to `llm.*` was incorrect — both naming families coexist, with span- and metric-level semantics diverging. |
| 3 | **OpenTelemetry status: GenAI conventions are in Development (not Stable)** | As of July 2025, all GenAI span/metric/event conventions are marked **[Development]** — not yet GA. This means the Go semantic-conventions package may change before finalization. |
| 4 | **Ollama API response fields: unchanged** | The Ollama `/api/generate` endpoint still returns `load_duration`, `prompt_eval_count`, `prompt_eval_duration`, `eval_count`, `eval_duration` as confirmed from the live docs at `https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion`. This was verified on this run. |
| 5 | **Ollama Go Client (`ollama/ollama-go`): confirmed** | Available at [`github.com/ollama/ollama-go`](https://github.com/ollama/ollama-go). The `GenerateResponse` struct maps directly onto Ollama's JSON response fields. |
| 6 | **No official Go OTel GenAI instrumentation library found** | After searching the Go ecosystem, no production-ready "otel-genai-go" library exists. Implementation will require manually mapping `gen_ai.*` attributes on spans and histograms — this is a risk item for Phase 5 implementation planning. |

---

## 1. Context & Problem Statement (unchanged)

The IsItObservable episode demonstrated a multi-agent BMAD crew building an observable todo board. The **local models scope** extends that foundation: once we serve LLM requests through our own API layer (proxying to Ollama), we need observability *for the AI inference layer* — not just for the standard CRUD backend. Traditional service mesh tools don't observe what happens inside a local model server, so we must layer instrumentation on top.

**Problem:** If a demo user interacts with the todo board and triggers an AI-powered feature (e.g., auto-suggesting todo text), the existing Three-Pillar observability design only captures HTTP latency — it doesn't capture inference quality, token throughput, or model loading delays.

---

## 2. Landscape of Local Model Serving Tools & Their Built-In Telemetry

### 2.1 Ollama (Primary Target) — verified on this run

**Evidence:** [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion)  

Ollama's `/api/generate` endpoint returns telemetry fields in **every response** — both streaming (final chunk with `done: true`) and non-streaming (`stream: false`):

| Field | Type | Unit | What It Tells You |
|-------|------|------|-------------------|
| `load_duration` | int64 | nanoseconds | How long the model took to load into VRAM/RAM |
| `prompt_eval_count` | int | count | Number of prompt tokens evaluated (context length) |
| `prompt_eval_duration` | int64 | nanoseconds | Time spent encoding the prompt |
| `eval_count` | int | count | Number of tokens generated in response |
| `eval_duration` | int64 | nanoseconds | Time spent generating the response |

**Derived metrics:** Tokens/second = `eval_count / eval_duration * 10^9`

**HTTP monitoring layer:** Ollama is already a local HTTP service on port 11434. Health check: `GET /api/tags` returns loaded models and available context window sizes.

**Gap identified (unchanged):** No built-in Prometheus metrics exporter, no OpenTelemetry tracing spans, no per-request trace IDs. We must instrument in our proxy layer.

### 2.2 llama.cpp + web-ui (Alternative — unchanged)

**Evidence:** [llama.cpp GitHub](https://github.com/ggerganov/llama.cpp?tab=readme-ov-file#inference-metrics)

Exposes per-request timing metrics (`prompt_per_second`, `predicted_per_second`) via streaming response field — same pattern as Ollama but fewer fields overall. Exclude from MVP scope.

### 2.3 vLLM (Server-Scale, Out of Scope — unchanged)

Exclude for this episode: requires NVIDIA GPUs and CUDA.

---

## 3. OpenTelemetry Semantic Conventions for LLM Observability — UPDATED

**Evidence:** 
- [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai) (dedicated repo for GenAI conventions, as of July 2025)
- `docs/gen-ai/gen-ai-spans.md` — spans and attributes
- `docs/gen-ai/gen-ai-metrics.md` — metrics

### Current State: Development Stage

**All GenAI conventions are marked [Development]** (not Stable). The namespace is `gen_ai.*`.

### Standard Span Attributes (per `gen-ai-spans.md`)

| Attribute | Required? | Maps To Ollama Field |
|-----------|-----------|---------------------|
| `gen_ai.operation.name` | **Required** | N/A — fixed value `"generate"` or `"chat"` per your endpoint |
| `gen_ai.provider.name` | **Required** | `"ollama"` (hardcoded) |
| `gen_ai.request.model` | Conditionally Required | `model` field from request body |
| `gen_ai.usage.input_tokens` | Recommended | → **NOT directly provided by Ollama** — use `prompt_eval_count` as a proxy |
| `gen_ai.usage.output_tokens` | Recommended | → **use `eval_count`** |
| `gen_ai.response.time_to_first_chunk` | Recommended (streaming) | Derive: time of first streaming chunk minus request start |
| `gen_ai.request.temperature` | Recommended | → pass through from request body parameter |
| `server.address` / `server.port` | Conditionally Required | `"localhost"`, `11434` |

### Standard Metrics (per `gen-ai-metrics.md`)

The new conventions define two key histogram metrics:

| Metric | Type | Attributes | Maps To Ollama Fields |
|--------|------|------------|---------------------|
| `gen_ai.client.token.usage` | Histogram | `gen_ai.operation.name`, `gen_ai.response.model`, `token.type` (input/output) | `prompt_eval_count` → input, `eval_count` → output |
| `gen_ai.client.operation.duration` | Histogram | `gen_ai.operation.name`, `gen_ai.request.model` | `total_duration` from Ollama response |

### Mapping Recommendation: Ollama Fields → OTel Attributes/Metrics

```
Ollama field              → OTel span attribute                    → OTel histogram metric
────────────────────      → ──────────────────────                 → ────────────────────────
model                     → gen_ai.request.model                   (gen_ai.client.operation.duration)
load_duration             → gen_ai.response.time_to_first_chunk*   — used for warm-up detection
prompt_eval_count         → gen_ai.usage.input_tokens              gen_ai.client.token.usage (token.type=input)
prompt_eval_duration      → span kind = INTERNAL, set trace event  — derive prompt phase latency
eval_count                → gen_ai.usage.output_tokens             gen_ai.client.token.usage (token.type=output)  
eval_duration             → set as span duration for child span    — derived from total_duration - load_duration
total_duration            → no direct mapping; use for histogram   gen_ai.client.operation.duration
```

\* `gen_ai.response.time_to_first_chunk` is for streaming mode. For non-streaming, fall back to using the final response timestamp minus request start.

---

## 4. Existing Patterns for Observing Local Models in Production Environments

### Pattern A: Sidecar Proxy with OTel Instrumentation (unchanged)
Build a lightweight Go HTTP proxy between your app and Ollama. Create OTel spans around each inference call, extract Ollama timing fields from response JSON, set as span attributes/metrics.

### Pattern B: Ollama-Native Prometheus Exporter (unchanged)
Poll `GET /api/stats` endpoint for model-server-side health metrics in background Goroutine, expose as `/metrics`. No trace correlation but valuable for server-level dashboards.

### Recommendation: Hybrid A + B (unchanged)

---

## 5. Benchmarking & Quality Metrics (unchanged)

| Metric | How to Capture | Why It Matters for Demo |
|--------|---------------|------------------------|
| Tokens/second throughput | `eval_count / eval_duration * 10^9` from Ollama response | Hardware capability baseline comparison |
| First-token latency (TTFT) | Time from request start to first streaming chunk (`done: false`) | UX — how long before text appears |
| Prompt token utilization | `prompt_eval_count` vs context window size (`ctx_size` from `/api/stats`) | Warnings near context limits |
| Model warmup time | `load_duration` on first request after idle period | Cache eviction detection |

---

## 6. Requirements — UPDATED FOR NEW OTel CONVENTIONS

### Functional Requirements
- **FR-LM1:** The Go backend's `/api/ai/chat` or `/api/ai/completion` endpoint MUST wrap every Ollama call in an OpenTelemetry span with `gen_ai.operation.name` ("generate" or "chat") and `gen_ai.provider.name` ("ollama").
- **FR-LM2:** ALL telemetry fields returned by Ollama (`load_duration`, `prompt_eval_count`, `eval_count`, `eval_duration`, `total_duration`) MUST be set as span attributes using the `gen_ai.*` namespace per [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/gen-ai-spans.md) — development-stage conventions.
  - Specifically: `gen_ai.usage.input_tokens = prompt_eval_count`, `gen_ai.usage.output_tokens = eval_count`.
- **FR-LM3:** The Go backend MUST use the official `github.com/ollama/ollama-go` client library for type-safe response parsing (not manual JSON).
- **FR-LM4:** Metrics (prometheus format) MUST include histograms for:
  - `gen_ai.client.token.usage` (input/output per request)
  - `gen_ai.client.operation.duration` (per-model)
  Exposed on `/metrics`.
- **FR-LM5:** The frontend UI MAY display inferred metrics as a tooltip or stats badge when showing AI-generated content.

### Open Questions (UPDATED)
- **OQ1 → RESOLVED:** Go has no native LangChain. Use raw `otelhttp` middleware (from `go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp`) + manual span creation for GenAI fields. No need to add a heavy dependency chain.
- **OQ2:** When running the demo on different hardware (CPU vs NVIDIA), instrument `ngl` (GPU layers attempted) from `/api/stats` → set as span attribute `gen_ai.context.quantization_level` or a custom `model_context.nvidia_gpu_layers` attribute (not part of current semconv).
- **NEW OQ3:** Since GenAI conventions are in Development, should we pin to the latest commit SHA of `open-telemetry/semantic-conventions-genai` rather than trusting published API surface?

---

## 7. Recommendations Summary

1. **Instrument at the HTTP proxy layer** — not inside Ollama, not in the frontend, but between them.
2. **Use `gen_ai.*` attribute namespace** from the latest commit of [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai), NOT the old `llm.*` naming. Pin to a known SHA for reproducibility.
3. **Capture ALL Ollama telemetry fields** — they provide unique value (model warmup, prompt vs generation split, throughput).
4. **Add `/api/stats` polling** from a background Goroutine to feed Prometheus.
5. **Surface minimal observability in the UI** — one subtle metrics tooltip per AI-generated element.

---

## 8. Sources (updated)

1. OTel GenAI Semantic Conventions (spans) — `https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-spans.md`
2. OTel GenAI Semantic Conventions (metrics) — `https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-metrics.md`
3. OpenTelemetry GenAI Semantic Conventions Repo — `https://github.com/open-telemetry/semantic-conventions-genai`
4. Ollama API Documentation (`/api/generate` response fields) — `https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion`
5. Ollama Go Client Library — `https://github.com/ollama/ollama-go`
6. OTel Overview & Signals Architecture — `https://opentelemetry.io/docs/specs/otel/overview/`
7. LangChain Python Observability (pattern validation) — `https://python.langchain.com/docs/guides/observability`
8. Ollama Source Code (`/api/stats` endpoint) — `https://github.com/ollama/ollama/blob/main/server/routes.go`
9. OpenAI-specific OTel GenAI conventions (for reference) — `https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/openai.md`

---

## 9. Next Steps for Product Manager (John)

This updated brief supplies the **validated** problem analysis and technical evidence needed for Phase 2/3 artifacts:

1. **Validate scope boundaries:** Sections 5–7 remain the same; only the OTel naming convention was updated.
2. **Convert FR-LM1 through FR-LM4** into binding acceptance criteria for the PRD — ensure `gen_ai.*` attribute names appear explicitly in stories (OBE-S03, OBE-S04).
3. **DECISION: Does FR-LM5 (UI tooltip) go into MVP?** This is a visible feature that touches the frontend stack — weigh against TB-S07 scope creep.
4. **DECISION on OQ3:** Pin GenAI conventions to a specific `open-telemetry/semantic-conventions-genai` commit SHA or follow main? Recommendation: pin to SHA for demo reproducibility.
5. **IMPLICATION for stories:** The existing Phase-5 stories (OBE-S01–OBE-S06) reference the old `llm.*` / `gen_ai.*` naming. They must be updated before implementation begins. Confirm whether Story Writer or Coding agent handles this doc change.

This brief maps to PRD `docs/prd.md` (FR8 — Observability & Testability) and Architecture `docs/architecture.md` (ADR-005, Three-Pillar + AI layer extension).

---

## HANDOFF
from: Marya (Analyst / BMAD Phase 1)
to: John (Product Manager)
phase: Phase 2 PRD update → Phase 3 Architecture refinement → Phase 4 story updates
artifact: docs/brief.md (branch `marya/local-models-observability-update` vs main; updated with OTel genai conventions repo migration, span attribute namespace changes, metric mapping table)
summary: Updated analysis brief with live verification of Ollama API fields. Critical finding: OTel GenAI semantic conventions migrated to open-telemetry/semantic-conventions-genai and moved from `llm.*` → `gen_ai.*` namespace (Development stage). Provided explicit Ollama field → OTel attribute/metric mapping table. No new requirements added — only corrections to existing ones.
next-action: Review the span-attribute mapping table, decide on FR-LM5 MVP vs deferred, and pick a pin SHA for GenAI conventions. Then update PRD ACs and notify Story Writer that OBE-S03/OBE-S04 stories need attribute name updates before Phase 5 implementation begins.
blockers: None from this run — awaiting PM decision on UI tooltip scope and OTel convention pinning.
