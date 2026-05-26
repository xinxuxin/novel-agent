# Release Guide

WenForge Studio is prepared for local packaging with `electron-builder`. Release publishing is not automated yet; packaging commands currently use `--publish never`.

## Build Outputs

Package artifacts are written to `release/`.

Supported targets:

- macOS: `dmg`, `zip`
- Windows: `nsis`
- Linux: `AppImage`, `deb`

Placeholder build assets live in `build/`. Final product icons should replace the placeholder before public distribution.

## Commands

```bash
pnpm build
pnpm package
pnpm package:mac
pnpm package:win
pnpm package:linux
pnpm release:dry-run
```

`pnpm release:dry-run` builds an unpacked directory target and is useful for checking included files without producing installer artifacts.

## Packaging Boundaries

Packaged app files include:

- compiled Electron output in `out/**`
- the original WenForge skill package under `skills/wenforge-webnovel-writer/**`
- `package.json`

Packaged app files exclude:

- `references/**`
- `references/repos/**`
- `docs/**`
- `tests/**`
- `src/**`
- `test-results/**`
- TypeScript build info

Runtime data is stored under Electron `userData`, not inside the application install directory. Local SQLite databases, backups, logs, and encrypted secrets are not packaged.

## CI

GitHub Actions run install, lint, typecheck, tests, and build. CI must not require provider API keys and must not call real model providers. Mock/fake providers remain the only automated test path.

## Signing And Publishing

Code signing, notarization, update feeds, and public release publishing are deferred. Before public release, add:

- macOS Developer ID signing and notarization.
- Windows signing certificate.
- Linux package metadata review.
- Final icons and installer branding.
- Release notes and checksums.
- A clean third-party notice audit for all bundled runtime dependencies.
