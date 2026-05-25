import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { JSX } from "react";
import React, { useEffect } from "react";

import type { ManuscriptStats } from "./manuscript-utils";

interface ManuscriptEditorProps {
  value: string;
  stats: ManuscriptStats;
  onChange: (value: string) => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plaintextToHtml(value: string): string {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return "<p></p>";
  }

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function ManuscriptEditor({ value, stats, onChange }: ManuscriptEditorProps): JSX.Element {
  const editor = useEditor({
    extensions: [StarterKit],
    content: plaintextToHtml(value),
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] outline-none text-[17px] leading-8 text-slate-100 selection:bg-forge-blue/30"
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getText({ blockSeparator: "\n\n" }));
    }
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const currentText = editor.getText({ blockSeparator: "\n\n" }).trim();
    if (currentText !== value.trim()) {
      editor.commands.setContent(plaintextToHtml(value), { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/25">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex gap-1">
          <button
            aria-label="Bold"
            className={`h-8 w-8 rounded-md border text-sm font-semibold transition ${
              editor?.isActive("bold")
                ? "border-forge-blue/40 bg-forge-blue/15 text-forge-blue"
                : "border-white/10 text-slate-300 hover:border-forge-blue/35"
            }`}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            type="button"
          >
            B
          </button>
          <button
            aria-label="Italic"
            className={`h-8 w-8 rounded-md border text-sm italic transition ${
              editor?.isActive("italic")
                ? "border-forge-violet/40 bg-forge-violet/15 text-forge-violet"
                : "border-white/10 text-slate-300 hover:border-forge-violet/35"
            }`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            type="button"
          >
            I
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>{stats.characters} chars</span>
          <span>{stats.chineseCharacters} Chinese</span>
          <span>{stats.paragraphs} paragraphs</span>
          <span>{stats.estimatedTokens} est. tokens</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}
