# UI Reference Notes

## Reference UI Ideas

### inkos

Useful ideas:

- Studio shell with sidebar, chat/workbench, service configuration, logs, analytics, chapter reader, and truth-file views.
- SSE-backed activity updates.
- Sidebar cards for summary, characters, progress, chapters, and foundation data.
- Review and artifact surfaces.

Do not copy:

- AGPL source, component code, styling, or assets.

### MaliangAINovalWriter

Useful ideas:

- Rich editor surface with AI tools nearby.
- Prompt management, prompt marketplace/admin concepts, knowledge base screens, model pricing management, LLM observability, and analytics charts.
- Provider icons and model config screens indicate useful information architecture, but assets should not be copied.

Do not copy:

- Flutter UI code or image assets without explicit attribution and review.

### ai-novel-lab

Useful ideas:

- Reader preferences: theme, font size, bookmarks, reading progress.
- Chapter list with word counts.
- Static manuscript preview mode.

Do not copy:

- Novel content.

### story-writing

Useful ideas:

- Chapter version navigation.
- Current, previous, and next chapter selectors.
- Run status messages for summary, brainstorm, outline, and write phases.

Do not copy:

- Streamlit implementation or prompt text.

### openai/codex

Useful ideas:

- Dense command-center feel.
- Thread/task event model.
- Approval flow for consequential actions.
- Skills/tooling mental model.

Do not copy:

- Product name, logos, splash images, screenshots, proprietary visual identity, or branded interaction language.

## WenForge UI Direction

WenForge should be dark, calm, and professional, with fiction-specific warmth in the manuscript surfaces. The app is not a landing page; it opens directly into a working studio.

First viewport in full studio:

- top command bar
- left project/chapter tree
- center active chapter workspace
- right story/cost/model panel

Primary visual language:

- graphite surfaces
- precise borders
- subtle blue/violet focus glow
- frosted panels
- monospace metadata where useful
- serif or high-readability manuscript font option for editor content

Motion:

- streaming token shimmer
- agent activity lane progress
- diff card transitions
- popover expand/collapse

Do not overdo animation. Writing needs stillness.

## Core UI Components To Build

- Command palette.
- Popover launcher.
- Project tree.
- Chapter workspace tabs: thread, manuscript, stream, timeline.
- TipTap editor.
- Story bible entity panel.
- Continuity warning cards.
- Cost meter.
- Model route editor.
- Agent review cards.
- Diff/accept/reject controls.
- Settings panels for providers, logging, model prices, app data, and security.

## UI Safety

- Every destructive button must show a confirmation.
- Decrypted secrets must never be displayed.
- Provider errors should be redacted.
- Prompt/manuscript logging settings should be visible and off by default.
- Generated state changes should be visually separate from accepted canon.

