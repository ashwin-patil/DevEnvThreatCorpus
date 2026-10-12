# OpenTelemetry reference and instrumentation design

Checked 11 October 2026. The application links the authoritative sources. GenAI documentation is pinned to commit `6fd0d763a092db245a54104fc1124031eb3c51d2`; the source register records document hashes.

## Standard, convention and proposal

| Layer | What is defined | Status / source |
|---|---|---|
| Core log model | Timestamps, severity, payload, resource, scope, attributes and trace correlation | Stable: [Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/) |
| Trace operations | Operation identity, parent/child context, attributes, events and status | [Tracing API](https://opentelemetry.io/docs/specs/otel/trace/api/) |
| GenAI agent/tool conventions | Agent and tool operation names and associated attributes | Development: [GenAI agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/6fd0d763a092db245a54104fc1124031eb3c51d2/docs/gen-ai/gen-ai-agent-spans.md) |
| MCP conventions | Protocol request/notification and session correlation | Development: [MCP semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/6fd0d763a092db245a54104fc1124031eb3c51d2/docs/gen-ai/mcp.md) |
| Content events | GenAI event conventions | Development reference: [GenAI events](https://github.com/open-telemetry/semantic-conventions-genai/blob/6fd0d763a092db245a54104fc1124031eb3c51d2/docs/gen-ai/gen-ai-events.md) |
| Corpus security extension | Definition fingerprints, approval version, sensitive-data class and install linkage | LLM-proposed `devthreat.*` namespace; no adopted standard or deployed emitter |

Standard definitions do not establish a particular coding harness's support. Measure its emitted signals, SDK/exporter configuration and trace propagation before claiming coverage.

## LogRecord fields

| Field | Logical type | Purpose |
|---|---|---|
| Timestamp / ObservedTimestamp | uint64 nanoseconds | Event time / observation time |
| TraceId / SpanId / TraceFlags | Identifiers / flags | Optional trace correlation |
| SeverityNumber / SeverityText | Integer / string | Severity |
| Body | AnyValue | Redacted payload |
| Resource | Attributes | Originating service or host |
| InstrumentationScope | Scope metadata | Emitting instrumentation |
| Attributes | Key/value collection | Standard and custom event context |
| EventName | String | Event class |

The application examples use an illustrative logical JSON representation. Timestamp integers are displayed as strings to preserve uint64 precision; IDs appear as hex. They are **not** an OTLP network payload. Use the SDK and exporter to encode actual transport. For transport requirements, consult [OpenTelemetry Protocol](https://opentelemetry.io/docs/specs/otel/protocol/).

## Which signal to use

- A span describes a timed tool, agent or protocol operation.
- A standalone log can record a security-relevant transition, such as a changed definition or denied sensitive action.
- A span event annotates an operation at a point in time.
- A metric counts or summarizes activity; it cannot preserve the evidence lineage of an individual action.

A real MCP `tools/list` operation can be represented with the applicable MCP conventions. A security event comparing an old and new definition fingerprint is a custom proposal. Do not invent an official MCP security-change event name.

## Selected development attributes

The pinned references define attributes including `gen_ai.operation.name`, `gen_ai.tool.name`, `gen_ai.tool.call.id`, `mcp.method.name` and `mcp.session.id`. Follow the relevant operation's full requirement levels rather than treating this selected list as a conformance profile. For example, an MCP protocol request and a logical GenAI tool execution are different operations and can have distinct spans.

## Synthetic example

This illustrates a **custom** security event. It is not recovered incident evidence, a complete exporter payload or a claim that a harness emits it.

```json
{
  "EventName": "devthreat.tool_definition.changed",
  "TraceId": "11111111111111111111111111111111",
  "SpanId": "2222222222222222",
  "SeverityNumber": 9,
  "SeverityText": "INFO",
  "Body": "Synthetic redacted metadata-change event",
  "Resource": {"service.name": "developer-agent-demo"},
  "Attributes": {
    "devthreat.synthetic": true,
    "devthreat.tool.definition.previous_sha256": "synthetic-old-digest",
    "devthreat.tool.definition.sha256": "synthetic-new-digest",
    "devthreat.approval.version": "synthetic-approval-1"
  }
}
```

The library also includes a synthetic logical MCP client-span example in `otel-reference.json` and behavior-specific custom LogRecord examples in `otel.json`. All are labeled synthetic.

## Correlation with regular security telemetry

Keep EDR process ancestry, network connections, identity audit, repository changes and package provenance as separate sensor records. A SIEM adapter maps their real field names to the corpus's logical requirements. OTEL traces add runtime context when available. Join by host/process identity, authenticated principal, tool/session identity and time, with clock-skew and retention constraints documented.

A network flow cannot prove secret content. A process launch cannot prove model success. Environment reads may not appear in file auditing. An attacker-side agent session is generally unavailable to victim defenders. OTEL collection does not automatically close those gaps.

Avoid full prompts, secret values and full tool arguments/results by default. Prefer redacted data class, provenance, result, policy decision and destination metadata. Content collection requires a deliberate access, retention and redaction design. No collector, exporter or production harness integration is implemented by this prototype.
