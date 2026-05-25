# Budgets

Phase 9 adds local budget policy enforcement around provider-backed workflow calls.

## Policy Record

`budget_policies` stores the editable default policy:

- `per_call_budget_cap`
- `per_workflow_budget_cap`
- `daily_budget_cap`
- `project_budget_cap`
- `warning_threshold_percent`
- `on_budget_exceeded`: `warn`, `pause`, or `abort`
- `currency`

The first policy is created lazily when requested. Current enforcement covers per-call preflight, per-workflow preflight, and live overrun action. Daily and project caps are persisted for the next reporting/enforcement pass.

## Preflight

Before a provider workflow starts, the main process resolves every chapter workflow model node through `ModelRouter`, estimates input/output tokens, and sums the route cost ranges. Missing credentials or blocked prices stop provider mode before a `generation_run` is created.

The renderer also shows a provider preflight confirmation with selected models and estimated max cost. Mock mode remains available for tests and local demos without credentials.

## Live Behavior

`WorkflowModelExecutor` compares actual provider-call final cost against the preflight max plus the configured warning threshold.

- `warn`: record the action and continue.
- `pause`: record a budget pause action for the workflow UI.
- `abort`: raise a safe workflow error after recording the model attempt.

Provider errors and budget failures are recorded as workflow events and `llm_runs`; canonical manuscript and story memory are never mutated automatically.

## IPC And UI

Typed IPC endpoints:

- `budgets.getPolicies`
- `budgets.updatePolicies`
- `providerHealth.list`
- `providerHealth.reset`
- `modelRoutes.resolvePreview`
- `generation.resumeAfterBudgetWarning`

Settings includes a Budgets tab for caps, threshold, exceeded action, currency, and provider health reset.
