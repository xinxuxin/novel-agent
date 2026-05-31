# Focused Chapter Writer

`章节成文` is the default WenForge Studio workflow for daily drafting.

## What It Does

The workflow turns an active setting file and one confirmed chapter outline into one candidate chapter draft. It is not a fully automatic book pipeline, and it does not compare multiple drafts by default.

## User Flow

1. Pick a chapter in the left sidebar.
2. Import or paste the book setting file.
3. Import or paste the current chapter outline.
4. Click `确认当前细纲`.
5. Click `生成本章正文`.
6. Review the candidate in `终稿候选`.
7. Click `保存为版本`.
8. Click `设为正式正文` only after manual review.

## Safety Rules

- Generated drafts are non-canonical.
- Story Bible entries are never mutated automatically.
- The renderer never receives decrypted provider credentials.
- Provider calls happen only through main-process IPC.
- Real provider generation shows a route/cost preflight and requires confirmation.

## Fixed Chain

1. 写作简报
2. 正文起草
3. 细纲与正史核对
4. 润色去 AI 腔
5. 终检
6. 人工确认

The app records normal `llm_runs`, costs, artifacts, review cards, and workflow checkpoints for attempted model calls.
