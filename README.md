# WenForge Studio

WenForge Studio is a planned local-first desktop app for Chinese web novel generation. It will combine project and chapter management, story bible memory, multi-model agent workflows, live streaming generation, review and rewrite loops, and real-time token cost tracking in a secure Electron app.

The product direction is a dark command-center writing studio with a popover launcher mode and an expandable full studio mode. It is inspired by modern agent workbenches, but it must not use OpenAI/Codex logos, icons, names, or proprietary branding assets.

## Current Status

Phases 1-14 are implemented through the local-first studio shell, SQLite data foundation, secure credential metadata, AI gateway, story bible memory, WenForge-native skill package, mock/provider workflow runtime, review and settlement flows, cost/eval dashboards, safe import/export/backup tooling, first-launch onboarding/palette/popover polish, and security/diagnostics/packaging preparation. Native signing and public release publishing remain planned follow-up work.

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
pnpm package
pnpm package:mac
pnpm package:win
pnpm package:linux
pnpm release:dry-run
pnpm providers:smoke
pnpm providers:report
pnpm test:smoke
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm providers:check
pnpm e2e:provider-chapter-check
```

`pnpm test:smoke` launches the built Electron output, so run `pnpm build` first.

Real provider connectivity checks are disabled by default. They require explicit local opt-in with `RUN_REAL_PROVIDER_CHECKS=true`, a small budget cap, and configured provider credentials. CI never runs real providers.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [AI Workflows](docs/AI_WORKFLOWS.md)
- [Security](docs/SECURITY.md)
- [Privacy](docs/PRIVACY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Real Provider Setup](docs/REAL_PROVIDER_SETUP.md)
- [Release Guide](docs/RELEASE.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Cost Tracking](docs/COST_TRACKING.md)
- [Database](docs/DATABASE.md)
- [Import And Export](docs/IMPORT_EXPORT.md)
- [Backup And Restore](docs/BACKUP_RESTORE.md)
- [Onboarding](docs/ONBOARDING.md)
- [UI Spec](docs/UI_SPEC.md)
- [Reference Repos](docs/REFERENCE_REPOS.md)
- [Fusion Plan](docs/FUSION_PLAN.md)
- [Workflow Comparison](docs/WORKFLOW_COMPARISON.md)
- [Prompt Asset Inventory](docs/PROMPT_ASSET_INVENTORY.md)
- [UI Reference Notes](docs/UI_REFERENCE_NOTES.md)
- [License Risk Register](docs/LICENSE_RISK_REGISTER.md)
