# Workflow Comparison

## Pipeline Comparison

| Workflow Step | inkos | ai-novel-lab | chinese-novelist-skill | MaliangAINovalWriter | story-writing | LongWriter | WenForge Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Outline generation | Strong architect/planner flow | Manual/full-book outline | Planning phase with confirmation | Setting and outline generation | Chapter outline after brainstorm | Paragraph plan | Use book, volume, chapter, and scene outline layers |
| Scene cards | Implied in planning/runtime context | Chapter outline only | Chapter plan fields | Scene models and summaries | Not explicit | Paragraph steps | Add first-class scene cards |
| Draft generation | Writer agent | Agent writes Markdown chapters | Serial/parallel chapter writing | Editor/generation services | Write node streams final chapter | Stepwise long writing | Stream draft through main process |
| Audit/review | Continuity, validator, reviewer | Consistency checklist | Validation and repair | Observability/review/admin concepts | User feedback only | Quality evaluation scripts | Add continuity and webnovel rhythm audits |
| Rewrite | Reviser and patch tools | Manual rewrite procedure | Auto rewrite on failed checks | Editor versions and optimization | Edit branch creates a new chapter node | Regenerate paragraph chunks | Non-destructive rewrite proposals |
| Memory/state settlement | Runtime truth, memory sync, hook ledger | Summary file | Preference memory and plan JSON | Knowledge base, chunks, settings | Chapter graph and lineage summary | Accumulated text | Structured state-settlement proposals |
| Human gate | Review cycle concepts | Manual progress | Plan confirmation, then automation | Admin/review screens | User chooses edit/continue | None | Human approval before canonical overwrite |

## Best WenForge Workflow

WenForge should use a hybrid graph:

1. Preparation:
   - load chapter, manuscript, story bible, style guide, unresolved hooks, and route settings
   - retrieve memory through SQLite FTS
   - estimate input tokens and cost before calls

2. Planning:
   - generate or refine chapter outline
   - generate scene cards
   - show outline/scene cards when user requests manual review

3. Drafting:
   - write the chapter in streamed chunks
   - record live output token estimates
   - persist draft as a generated artifact, not canonical manuscript

4. Review:
   - run continuity audit
   - run webnovel rhythm audit
   - produce review cards with issue, evidence, severity, and suggested fix

5. Revision:
   - revise the draft according to selected audit findings
   - show diff against current canonical version or previous draft

6. Human gate:
   - accept as new canonical manuscript version
   - reject
   - request another rewrite
   - apply selected diff hunks

7. Settlement:
   - summarize chapter
   - propose story bible changes
   - propose timeline updates
   - propose new/resolved foreshadowing
   - flag continuity risks
   - require acceptance for canonical memory changes

## Why This Workflow

It takes the strongest production ideas from `inkos` and `MaliangAINovalWriter`, the safest orchestration path from LangGraph.js, the version-branch idea from `story-writing`, the progressive planning discipline from `chinese-novelist-skill`, and the long-output decomposition pattern from `LongWriter`. It avoids copying restricted source and turns each reference into a WenForge-native behavior.

