import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import type {
  BackupRecord,
  BackupSettings,
  ExportFile,
  ImportResult
} from "@contracts/import-export";
import type { BookRecord, ProjectRecord } from "@contracts/data";

interface DataPortabilityPanelProps {
  book: BookRecord | null;
  project: ProjectRecord | null;
}

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackup: "off",
  backupLocation: null,
  retentionCount: 10
};

export function DataPortabilityPanel({ book, project }: DataPortabilityPanelProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Secrets are excluded from every export by default.");
  const [preview, setPreview] = useState("");
  const [files, setFiles] = useState<ExportFile[]>([]);
  const [importText, setImportText] = useState("# 新章\n正文从这里开始。");
  const [jsonImportText, setJsonImportText] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(DEFAULT_BACKUP_SETTINGS);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);

  const canExportBook = Boolean(book);
  const canExportProject = Boolean(project);
  const statusText = useMemo(() => {
    if (!project) return "Select a project to enable package export and backups.";
    if (!book) return "Select a book to enable manuscript import/export.";
    return `${project.name} / ${book.title}`;
  }, [book, project]);

  useEffect(() => {
    void refreshBackups();
  }, []);

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setMessage("Working...");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshBackups(): Promise<void> {
    const [records, settings] = await Promise.all([
      window.wenforge.backup.list(),
      window.wenforge.backup.getSettings()
    ]);
    setBackups(records);
    setBackupSettings(settings);
  }

  async function exportBookMarkdown(): Promise<void> {
    if (!book) return;
    const result = await window.wenforge.export.bookMarkdown({
      bookId: book.id,
      frontMatter: true
    });
    setFiles(result.files);
    setPreview(
      result.files.map((file) => `## ${file.relativePath}\n\n${file.content}`).join("\n\n")
    );
    setMessage(
      `Prepared ${result.files.length} markdown file(s). API keys and credentials excluded.`
    );
  }

  async function exportBookTxt(): Promise<void> {
    if (!book) return;
    const result = await window.wenforge.export.bookTxt({ bookId: book.id });
    setFiles([{ relativePath: result.filename, content: result.content }]);
    setPreview(result.content);
    setMessage("Prepared combined TXT export without secrets.");
  }

  async function exportProjectJson(): Promise<void> {
    if (!project) return;
    const result = await window.wenforge.export.projectJson({
      projectId: project.id,
      includeManuscriptVersions: true,
      includeCostLogs: true
    });
    setFiles([{ relativePath: `${project.name}.json`, content: JSON.stringify(result, null, 2) }]);
    setPreview(JSON.stringify(result, null, 2));
    setMessage("Prepared JSON package. Provider credentials were excluded.");
  }

  async function exportWenForgePackage(): Promise<void> {
    if (!project) return;
    const result = await window.wenforge.export.projectPackage({
      projectId: project.id,
      includeManuscriptVersions: true,
      includeCostLogs: true
    });
    setFiles([{ relativePath: result.filename, content: `${result.entryCount} zipped entries` }]);
    setPreview(result.bytesBase64.slice(0, 1200));
    setMessage("Prepared .wenforge.zip package as base64 preview. No API keys included.");
  }

  async function exportCosts(): Promise<void> {
    const result = await window.wenforge.export.costCsv({ projectId: project?.id });
    setFiles([{ relativePath: result.filename, content: result.content }]);
    setPreview(result.content);
    setMessage("Prepared redacted cost CSV.");
  }

  async function importMarkdown(): Promise<void> {
    if (!book) return;
    const result = await window.wenforge.import.markdown({
      bookId: book.id,
      files: [{ relativePath: "pasted/import.md", content: importText }],
      conflictStrategy: "skip_duplicates"
    });
    setImportResult(result);
    setMessage(
      `Imported ${result.importedChapters} chapter(s); skipped ${result.skippedChapters}.`
    );
  }

  async function importProjectJson(): Promise<void> {
    const result = await window.wenforge.import.projectJson({
      payload: JSON.parse(jsonImportText) as unknown,
      conflictStrategy: "create_new_project"
    });
    setImportResult(result);
    setMessage(`Imported ${result.importedProjects} project(s) from validated JSON.`);
  }

  async function createBackup(): Promise<void> {
    const record = await window.wenforge.backup.create({ reason: "manual" });
    await refreshBackups();
    setMessage(`Created backup at ${record.path}`);
  }

  async function updateBackupSettings(): Promise<void> {
    const next = await window.wenforge.backup.updateSettings(backupSettings);
    setBackupSettings(next);
    setMessage("Backup settings saved.");
  }

  async function restoreBackup(record: BackupRecord): Promise<void> {
    if (!restoreConfirmed) {
      setMessage("Check the restore confirmation box before restoring.");
      return;
    }
    if (!window.confirm("Restore this backup? A pre-restore backup will be created first.")) {
      return;
    }
    const result = await window.wenforge.backup.restore({ id: record.id, confirmed: true });
    await refreshBackups();
    setRestoreConfirmed(false);
    setMessage(
      `Restored ${result.restoredBackupId}; pre-restore backup ${result.preRestoreBackupId}.`
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <section className="rounded-lg border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-forge-blue">Data portability</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Import, Export, Backup</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                Imported payloads are treated as untrusted input. Exports omit decrypted secrets,
                encrypted credentials, Authorization headers, and provider API keys.
              </p>
            </div>
            <StatusPanel busy={busy} message={message} />
          </div>
          <p className="mt-3 text-xs text-slate-500">{statusText}</p>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-lg border border-white/10 bg-graphite-900/70 p-5">
            <h3 className="text-sm font-semibold text-white">Export Wizard</h3>
            <p className="mt-1 text-sm text-slate-500">
              Prepare local files for review before saving.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <ActionButton
                disabled={!canExportBook || busy}
                onClick={() => run(exportBookMarkdown)}
              >
                Book Markdown
              </ActionButton>
              <ActionButton disabled={!canExportBook || busy} onClick={() => run(exportBookTxt)}>
                Book TXT
              </ActionButton>
              <ActionButton
                disabled={!canExportProject || busy}
                onClick={() => run(exportProjectJson)}
              >
                Project JSON
              </ActionButton>
              <ActionButton
                disabled={!canExportProject || busy}
                onClick={() => run(exportWenForgePackage)}
              >
                WenForge Package
              </ActionButton>
              <ActionButton disabled={busy} onClick={() => run(exportCosts)}>
                Cost CSV
              </ActionButton>
            </div>
            <ExportPreview files={files} preview={preview} />
          </section>

          <section className="rounded-lg border border-white/10 bg-graphite-900/70 p-5">
            <h3 className="text-sm font-semibold text-white">Import Wizard</h3>
            <p className="mt-1 text-sm text-slate-500">
              Markdown is sanitized before it becomes an imported manuscript version.
            </p>
            <label
              className="mt-4 block text-xs font-medium text-slate-400"
              htmlFor="markdown-import"
            >
              Markdown chapter
            </label>
            <textarea
              className="mt-2 min-h-36 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-200 outline-none focus:border-forge-blue/50"
              id="markdown-import"
              onChange={(event) => setImportText(event.target.value)}
              value={importText}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton disabled={!canExportBook || busy} onClick={() => run(importMarkdown)}>
                Import Markdown
              </ActionButton>
            </div>

            <label className="mt-5 block text-xs font-medium text-slate-400" htmlFor="json-import">
              JSON project package
            </label>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-forge-blue/50"
              id="json-import"
              onChange={(event) => setJsonImportText(event.target.value)}
              placeholder='{"schemaVersion":1,...}'
              value={jsonImportText}
            />
            <div className="mt-3">
              <ActionButton
                disabled={!jsonImportText.trim() || busy}
                onClick={() => run(importProjectJson)}
              >
                Import Project JSON
              </ActionButton>
            </div>
            {importResult ? (
              <p className="mt-4 rounded-md border border-forge-blue/20 bg-forge-blue/10 p-3 text-sm text-slate-300">
                Imported projects {importResult.importedProjects}, books{" "}
                {importResult.importedBooks}, chapters {importResult.importedChapters}; skipped{" "}
                {importResult.skippedChapters}.
              </p>
            ) : null}
          </section>
        </div>

        <section className="rounded-lg border border-white/10 bg-graphite-900/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Backup & Restore</h3>
              <p className="mt-1 text-sm text-slate-500">
                Restores create a pre-restore backup first. Provider credentials stay out of
                backups.
              </p>
            </div>
            <ActionButton disabled={busy} onClick={() => run(createBackup)}>
              Manual Backup
            </ActionButton>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_140px_auto]">
            <label className="text-xs text-slate-400">
              Auto backup
              <select
                className="mt-2 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-slate-200"
                onChange={(event) =>
                  setBackupSettings((current) => ({
                    ...current,
                    autoBackup: event.target.value as BackupSettings["autoBackup"]
                  }))
                }
                value={backupSettings.autoBackup}
              >
                <option value="off">Off</option>
                <option value="daily">Daily</option>
                <option value="on_app_close">On app close</option>
                <option value="before_destructive_operations">Before destructive actions</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Backup location
              <input
                className="mt-2 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-slate-200"
                onChange={(event) =>
                  setBackupSettings((current) => ({
                    ...current,
                    backupLocation: event.target.value.trim() || null
                  }))
                }
                placeholder="Default userData backups directory"
                value={backupSettings.backupLocation ?? ""}
              />
            </label>
            <label className="text-xs text-slate-400">
              Retention
              <input
                className="mt-2 w-full rounded-md border border-white/10 bg-black/20 p-2 text-sm text-slate-200"
                min={1}
                onChange={(event) =>
                  setBackupSettings((current) => ({
                    ...current,
                    retentionCount: Number(event.target.value) || 1
                  }))
                }
                type="number"
                value={backupSettings.retentionCount}
              />
            </label>
            <div className="flex items-end">
              <ActionButton disabled={busy} onClick={() => run(updateBackupSettings)}>
                Save Settings
              </ActionButton>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm text-slate-300">
            <input
              checked={restoreConfirmed}
              onChange={(event) => setRestoreConfirmed(event.target.checked)}
              type="checkbox"
            />
            I understand restore replaces local project data after creating a pre-restore backup.
          </label>

          <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
            {backups.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No backups yet.</p>
            ) : (
              backups.map((backup) => (
                <div
                  className="grid gap-3 border-b border-white/10 p-3 text-sm text-slate-300 last:border-b-0 md:grid-cols-[1fr_140px_120px_auto]"
                  key={backup.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{backup.id}</p>
                    <p className="truncate text-xs text-slate-500">{backup.path}</p>
                  </div>
                  <span>{backup.reason}</span>
                  <span>{Math.ceil(backup.sizeBytes / 1024)} KB</span>
                  <ActionButton disabled={busy} onClick={() => run(() => restoreBackup(backup))}>
                    Restore
                  </ActionButton>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-forge-blue/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusPanel({ busy, message }: { busy: boolean; message: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
      <span className={busy ? "text-forge-blue" : "text-slate-300"}>
        {busy ? "Running" : "Ready"}
      </span>
      <span className="mx-2 text-slate-600">/</span>
      {message}
    </div>
  );
}

function ExportPreview({ files, preview }: { files: ExportFile[]; preview: string }): JSX.Element {
  if (files.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">Exports will appear here as local previews.</p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <span
            className="rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-400"
            key={file.relativePath}
          >
            {file.relativePath}
          </span>
        ))}
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-300">
        {preview}
      </pre>
    </div>
  );
}
