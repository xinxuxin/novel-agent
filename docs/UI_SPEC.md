# UI Spec

## Direction

WenForge Studio is a from-scratch fiction command center. It can borrow general interaction patterns from command-center agent tools, but it must not copy OpenAI/Codex names, logos, icons, screenshots, wording, or proprietary visual identity.

The first screen is the usable studio, not a landing page.

## Visual Language

- Dark graphite surfaces with restrained contrast.
- Subtle blue/violet accent glows for focus, active generation, and cost alerts.
- Frosted panels and thin borders used sparingly.
- High-readability manuscript typography with a serif option for long-form editing.
- Motion that supports attention: token streaming, workflow step progress, diff transitions, and popover expansion.
- No copied reference assets or provider logos unless licenses are reviewed later.

## Primary Layout

Top command bar:

- global search
- command palette
- quick generation actions
- active run status
- session cost
- provider/route health summary

Left sidebar:

- projects, books, volumes, chapters
- chapter status badges
- quick create controls
- collapsed popover-friendly navigation

Center workspace:

- chapter thread
- TipTap manuscript editor
- generation stream
- task timeline
- review/diff mode
- version history and rollback controls

Right panel:

- story bible and memory context
- continuity warnings
- cost meter
- model route card
- agent review cards
- settlement proposals

Popover mode:

- compact floating launcher
- recent projects and chapters
- quick generation actions
- current run status
- expand to full studio

## Core Screens

- Studio home with project tree and active chapter.
- Chapter editor with manuscript, stream, and review tabs.
- Story bible with accepted facts and proposed updates.
- Model router with task presets and provider/model selection.
- Cost dashboard with run, chapter, project, session, and monthly views.
- Provider settings with encrypted credential status and safe health checks.
- Prompt/skill settings for WenForge-native templates.

## Phase 3 Settings Workspace

The current Settings workspace is reachable from the top command bar and uses six tabs:

- Providers: encrypted credential save/list/delete/status controls, redacted key labels only.
- Models: editable model profile catalog with enabled state and custom model entry.
- Pricing: editable price registry, effective dates, source notes, and stale price warnings.
- Routing: task route matrix across task types and quality modes with credential/price readiness chips.
- Privacy: prompt, response, manuscript logging, recent chapter, context budget, and debug logging settings.
- Advanced: stale price threshold, missing price policy, and diagnostics.

The Settings workspace is part of the studio shell. It must keep the same dark graphite command-center language and must not expose decrypted credentials, encrypted secret bytes, or complete prompts/manuscripts.

## Interaction Rules

- Generated text, audits, rewrites, and state updates are visibly marked as draft/proposed.
- Destructive actions use confirmation dialogs.
- Review cards include severity, issue, evidence summary, suggested fix, and accept/reject actions.
- Cost estimates appear before generation and update during streaming.
- Provider errors are redacted and actionable.
- Decrypted secrets are never displayed.

## Accessibility And Responsiveness

- Keyboard-first command palette and common actions.
- Visible focus states and no color-only status indicators.
- Reduced motion support.
- Text must not overlap or clip at desktop or compact popover sizes.
- Panels collapse predictably on narrow widths.

## Reference UI Policy

- `inkos`, `MaliangAINovalWriter`, `ai-novel-lab`, and `story-writing` may inform information architecture only.
- OpenAI/Codex may inform broad command-center patterns only.
- No UI source, screenshots, logos, image assets, distinctive copy, or branding may be copied in this phase.
