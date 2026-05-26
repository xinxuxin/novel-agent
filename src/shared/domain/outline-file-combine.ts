export interface ImportedOutlineSource {
  fileName: string;
  text: string;
}

export function combineImportedOutlineFiles(files: ImportedOutlineSource[]): ImportedOutlineSource {
  if (files.length === 0) {
    throw new Error("没有可导入文件");
  }
  return {
    fileName: files.map((file) => file.fileName).join(" + "),
    text: files
      .map((file, index) => `# 大纲文件 ${index + 1}: ${file.fileName}\n\n${file.text.trim()}`)
      .join("\n\n---\n\n")
  };
}
