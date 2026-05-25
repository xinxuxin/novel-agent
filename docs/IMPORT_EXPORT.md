# Import And Export

Phase 12 adds safe local data portability for WenForge Studio. All import/export work runs in the Electron main process behind typed IPC; the renderer never receives filesystem privileges or decrypted provider credentials.

## Export Formats

- **Book Markdown**: one Markdown file per chapter plus a combined book Markdown file. Chapters are ordered by `chapter_index`; optional front matter can include title, chapter index, and summary.
- **Book TXT**: one combined plain-text file for Chinese manuscript export.
- **Project JSON**: project, books, volumes, chapters, story bible entries, structured story bible records, style guides, reader positioning, safe settings, optional manuscript versions, and optional cost summaries.
- **WenForge Package**: `.wenforge.zip` containing `metadata.json`, `project.json`, `chapters/*.md`, `story-bible/entries.json`, and optional cost CSV.
- **Cost CSV**: redacted `llm_runs` report suitable for spreadsheet review.

## Secret Exclusion

Exports never include:

- decrypted API keys
- encrypted credential blobs
- `Authorization` headers
- plaintext provider secrets
- provider credential rows

Cost exports redact key-like strings in error messages before content reaches the renderer. Project JSON exports include only safe app settings and omit keys whose names imply secrets, tokens, credentials, or API keys.

## Import Rules

Imported files are untrusted input:

- relative import paths are validated and must not traverse outside the intended package path
- absolute paths and `..` path segments are rejected
- Markdown is sanitized before being saved as an imported manuscript version
- JSON packages are validated with Zod before creating records
- duplicate chapter titles can be skipped by `skip_duplicates`
- overwrite support requires explicit UI confirmation before use

Imported manuscript text becomes a versioned record with `source_type = imported`; it does not bypass manuscript versioning.

## Renderer UX

The Data workspace exposes:

- export buttons for Markdown, TXT, JSON, WenForge package, and cost CSV
- import text areas for pasted Markdown and JSON project package content
- backup controls and restore warnings
- clear status messages explaining that credentials are excluded

Future file-picker polish should keep the same rule: renderer-selected files are passed as validated payloads to main-process services, not opened through arbitrary renderer filesystem access.
