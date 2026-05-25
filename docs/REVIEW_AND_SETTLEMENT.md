# Review And Settlement

Phase 10 adds the confirmation layer between generated workflow output and canonical project state.

## Principles

- Generated manuscripts, audits, rewrites, and state updates remain proposals until accepted.
- Canonical manuscript changes always create manuscript versions.
- Story bible and memory changes never apply automatically.
- Blocking review cards prevent one-click canonical approval unless the user explicitly overrides the warning.
- Settlement items unsupported by the accepted manuscript evidence default to rejected.

## Review Cards

Review cards are stored in `review_cards` and displayed in the Chapter Workspace Review tab. Cards support:

- continuity audit findings
- webnovel rhythm scores and warnings
- revision-plan risks
- settlement/continuity risks

Cards include severity, issue, evidence, affected entity, suggested fix, human-judgment flag, status, and optional structured JSON. The renderer can accept, reject, or defer cards through `reviews.updateStatus`.

## Diff And Manuscript Acceptance

The Review tab supports:

- canonical manuscript vs generated draft/revision diff
- existing manuscript version diff
- word count and character count deltas
- saving a generated artifact as a non-canonical generated version
- saving a generated artifact and setting it canonical after confirmation
- copying generated text into the editor

Selected hunk application is intentionally deferred. Phase 10 implements full accept/reject and version creation first.

## Quality Gate

`ReviewSettlementService.qualityGate` blocks canonical approval when open blocking review cards exist. The renderer shows the required override checkbox:

`I understand the warnings and want to approve anyway.`

The same gate also protects the older workflow canonical endpoint so generated versions cannot bypass the Review tab.

Low ending-hook scores from rhythm-audit JSON produce a warning for the Review tab.

## Settlement Confirmation

Settlement proposals are grouped for review:

- Characters
- Timeline
- Foreshadowing
- Hooks
- World Facts
- Style/Reader
- Continuity Risks

Each item can be accepted, edited as JSON before applying, or rejected. Applying selected items is transactional and writes `state_update_applications` audit rows with generation run, entity type, entity id, update type, before/after JSON, applied user, and timestamp.

Supported Phase 10 application targets:

- unresolved hooks
- timeline events
- chapter summaries
- characters
- foreshadowing
- generic story bible/world fact entries

Unsupported or weakly evidenced facts remain rejected until the user edits or confirms them in a later workflow.

## IPC

New typed IPC families:

- `reviews.listByGenerationRun`
- `reviews.updateStatus`
- `reviews.rerunAudit`
- `reviews.qualityGate`
- `manuscript.diffVersions`
- `manuscript.diffArtifact`
- `manuscript.saveArtifactAsVersion`
- `settlement.preview`
- `settlement.applySelected`
- `settlement.rejectSelected`
- `settlement.editItem`
- `settlement.listByRun`
