# Cost Dashboard

Phase 11 turns raw `llm_runs`, price rows, and budget policies into an explicit studio analytics surface.

## Goals

- Show live and historical spend without provider dashboards.
- Distinguish estimated usage from provider-reported usage.
- Surface stale or missing price data before routing decisions become expensive.
- Keep cost exports local and redacted.

## Dashboard Metrics

The dashboard summarizes:

- active run live cost
- session cost
- today cost
- current project cost
- month-to-date cost
- cost by provider
- cost by model
- cost by task type
- cost by workflow node
- cost by chapter
- estimated-only vs provider-reported usage
- average cost per approved chapter
- average cost per 1k Chinese characters
- stale price warnings

Workflow node cost currently groups by `llm_runs.task_type`, which matches the persisted model-call node for WenForge chapter generation. A later graph-inspection pass can map task types to friendlier node display labels.

## Charts

The renderer uses lightweight HTML bars rather than a charting dependency:

- spend over time
- spend by model
- cost per chapter
- cost by task type

This keeps the dashboard cheap, local, and easy to test.

## Budget Controls

The dashboard exposes the same budget policy edited in Settings:

- per-call budget cap
- per-workflow budget cap
- daily budget cap
- project budget cap
- warning threshold percent
- exceed behavior: `warn`, `pause`, or `abort`

Daily and project caps are visible now. Full spend-window enforcement remains a later runtime-control pass.

## Pricing Tools

The dashboard includes:

- price registry JSON export
- price registry JSON import
- mark-visible-prices-stale action
- inline input/output price edits
- inline effective-date edits
- enabled/disabled toggle
- route warnings for missing or stale prices

Imported price JSON is validated with Zod before it updates `model_prices`.

## Export

`costs.exportCsv` produces local CSV text. It does not include prompts, responses, decrypted credentials, or manuscript text. Provider error messages are redacted for key-like strings and authorization bearer values before export.

## IPC

- `costs.getSummary`
- `costs.getByProject`
- `costs.getByBook`
- `costs.getByChapter`
- `costs.getByRun`
- `costs.getByModel`
- `costs.exportCsv`
- `pricing.importJson`
- `pricing.exportJson`
- `pricing.markStale`
- `pricing.routeWarnings`
