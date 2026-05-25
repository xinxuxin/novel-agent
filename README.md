# WenForge Studio

WenForge Studio is a planned local-first desktop app for Chinese web novel generation. It will combine project and chapter management, story bible memory, multi-model agent workflows, live streaming generation, review and rewrite loops, and real-time token cost tracking in a secure Electron app.

The product direction is a dark command-center writing studio with a popover launcher mode and an expandable full studio mode. It is inspired by modern agent workbenches, but it must not use OpenAI/Codex logos, icons, names, or proprietary branding assets.

## Current Status

Phase 1 is implemented: a secure Electron + React + TypeScript desktop shell with Tailwind styling, a narrow preload bridge, strict TypeScript, unit tests, and an Electron smoke test. AI provider logic, persistence, credentials, and agent workflows are intentionally not implemented yet.

## Planned Stack

- Electron + electron-vite
- React + TypeScript
- Tailwind CSS
- shadcn/ui or Radix primitives
- Motion or Framer Motion
- Zustand
- TanStack Query where useful
- SQLite + better-sqlite3
- Drizzle ORM
- Zod
- TipTap or ProseMirror editor
- LangGraph.js

## Development Commands

Use pnpm for all development tasks:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:smoke
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

`pnpm test:smoke` launches the built Electron output, so run `pnpm build` first.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [AI Workflows](docs/AI_WORKFLOWS.md)
- [Security](docs/SECURITY.md)
- [Cost Tracking](docs/COST_TRACKING.md)
- [Database](docs/DATABASE.md)
- [UI Spec](docs/UI_SPEC.md)
- [Reference Repos](docs/REFERENCE_REPOS.md)
- [Fusion Plan](docs/FUSION_PLAN.md)
- [Workflow Comparison](docs/WORKFLOW_COMPARISON.md)
- [Prompt Asset Inventory](docs/PROMPT_ASSET_INVENTORY.md)
- [UI Reference Notes](docs/UI_REFERENCE_NOTES.md)
- [License Risk Register](docs/LICENSE_RISK_REGISTER.md)
