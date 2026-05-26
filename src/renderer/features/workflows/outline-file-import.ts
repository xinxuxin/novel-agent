import { extractDocxText } from "@shared/domain/outline-document";

export interface ImportedOutlineFile {
  fileName: string;
  text: string;
}

const MAX_OUTLINE_FILE_BYTES = 20 * 1024 * 1024;

export async function importOutlineFile(file: File): Promise<ImportedOutlineFile> {
  if (file.size > MAX_OUTLINE_FILE_BYTES) {
    throw new Error("文件超过 20MB");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "doc") {
    throw new Error("暂不支持 .doc，请另存为 .docx");
  }
  if (extension === "docx") {
    const text = await extractDocxText(await file.arrayBuffer());
    return { fileName: file.name, text };
  }
  if (extension === "txt" || extension === "md" || extension === "markdown") {
    return { fileName: file.name, text: await file.text() };
  }

  throw new Error("仅支持 .docx / .txt / .md");
}
