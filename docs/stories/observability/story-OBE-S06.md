---
story-id: OBE-S06
phase: 5
status: READY_FOR_IMPLEMENTATION
artifact-type: story
owner: coding-agent
parent-epic: OBE-EPIC-3 (Frontend Integration — Observable UI)
created-by: Story Writer (John)
trace-from-prd: G4 (monitoring/alerting), AC5 (health endpoint for reliability)
source-epics-file: epics-and-stories.observability.md
---

# Story OBE-S06 — Grafana/Loki Dashboards and Alerting on P0 + P1 Metrics

As a **platform operator / reliability engineer**,  
I want **pre-built Grafana dashboards for request rates, error budgets, latency percentiles, saturation across the Kanban app services, plus a Loki log view showing trace-correlated logs with W3C TraceContext**,  
So that **I can immediately see what's working and what's broken without hunting through raw data**.

> **Maps to PRD G4 (reliability, hosting),** FR5 (health / monitoring), All (one-time OTEL collector export)  
> **Also:** ADR-002 (API contracts + span naming conventions for Grafana dashboards + Loki log views with W3C TraceContext)  
> **Previous Epic Story:** "OBE-6 — Dashboard and alerting on P0 + P1 metrics"

---

## Context

This is the final observability story. After all services (backend OTel auto-instrumentation + frontend browser instrumentation) are instrumented, we need dashboards and alerts so operators can actually see the telemetry:

**Grafana dashboards for:**
- Request rates per endpoint (`http_server_request_count_total`)
- Error percentages (5xx / total ratios per route)
- Latency percentiles (p50, p95, p99) from `http_server_duration_seconds_bucket`
- Saturation metrics from backend (Goroutine count, DB connection pool usage if exposed via OTel process metrics)
- A Loki/LogQL view where logs are filtered by trace ID matching the W3C TraceContext span correlation headers

**Alerts to configure:**
- http.server.duration p99 > 1s on any backend → frontend path (per OBE-2 AC2 + P0 status)
- 5xx error rate > 5% sustained over 5 minutes
- HTTP server active connections approaching collector capacity (e.g., p99 duration spike > expected threshold)

---

## Acceptance Criteria (Given/When/Then)

### AC1: Grafana dashboards cover all P0/P1 metrics listed in the epic

**Given:** The OTel collector is exporting all telemetry described in OBE-S01 through OBE-S05  
**And:** A Grafana instance is running connected to Prometheus (for metrics) and Loki (for logs)  
**When:** an operator opens the Kanban app dashboards in Grafana  
**Then:** they see ALL of:
- **Request rate per endpoint**: `http_server_request_count_total` with dimension labels for `method`, `endpoint`, `resource.name`, `http.status_code` grouped as bar chart or line graph across time
- **Error ratio per route**: `sum by (status_code, http.method) / total requests by (status_code, http.method)` displayed as a line chart
- **Latency percentiles (p50/p95/p99)**: from `http_server_duration_seconds_bucket` — histogram-based p50, p95, p99 time-series lines per endpoint
- **Saturation metrics** from OTel process (Goroutine count if available via `process_` metrics)
- A Loki/LogQL query showing logs correlated by `trace_id` — filtering a single trace ID in Grafana instantly shows all related backend + frontend log entries for that trace

### AC2: P0/P1 alerts are configured for high-severity conditions

**Given:** The Grafana/Loki dashboard environment is running  
**When:** a user configures alert rules via Grafana Alerting or Prometheus rule groups  
**Then:** alerts exist for ALL three of these critical scenarios:
- **P0:** `http.server.duration p99 > 1s on any backend → frontend HTTP path` (duration alert)
- P1: 5xx error rate > 5% sustained over 5 minutes
- P2: HTTP server active connections approaching collector capacity (active connection metrics threshold, e.g., approaching exporter maximum concurrent connections or queue depth)

### AC3: Loki log view shows trace-correlated logs matching W3C TraceContext

**Given:** The OTel collector configures W3C TraceContext correlation headers in all log entries (e.g., `traceparent-<version>-<trace-id>-<span-id>`)  
**And:** Loki is configured with a parser that extracts these fields as labels  
**When:** an operator searches Loki logs by `TraceId: <hex-trace-id>` from any Grafana dashboard  
**Then:**
- It returns all log entries from both backend AND frontend that share the same trace context
- No false positives appear (other traces do NOT match)

### AC4: Dashboards and alerts are reproducible as code (no manual config)

**Given:** The repo contains a `monitoring/` directory with JSON/YAML files  
**When:** someone runs `make grafana-import` or copies those JSON files into Grafana's provisioning folder  
**Then:**
- The exact same dashboards and alert rules appear in Grafana without clicking through any UI wizards
- Dashboard JSON files are committed to git as source-of-truth (not hand-made via the Grafana web UI)

---

## Implementation Notes

- **Where it lives:** `/monitoring/` directory:
- `dashboards/kanban-overview.json` — single-page Grafana dashboard combining all P0/P1 metrics
- `alerts/prometheus-rules.yml` — Prometheus alert rules file (rules.yaml format)
- `loki-queries/log-trace-correlated.logql` — example Loki queries for trace correlation logs
- Use `make grafana-import` as a convenience target that loads JSON files into Grafana via API (curl calls to `/api/dashboards/db`).
- Alert thresholds are illustrative only — the actual operator team will tune them post-deployment. For now, p99 > 1s and >5% error rate are reasonable P0 thresholds for a demo app.

---

## Dependencies

**Requires:** TB-S01 through TB-S07 (all services deployed), OBE-S01 through OBE-S05 (telemetry must be flowing before dashboards have data), and Prometheus/Grafana/Loki stack running as part of docker-compose or external. Must be the last observability story implemented.

## Estimate

M (3–5 hours — Grafana provisioning requires dashboard JSON, Loki queries, alert rule YAML)
