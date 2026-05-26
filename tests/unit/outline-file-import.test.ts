import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import {
  extractDocxText,
  wordDocumentXmlToText
} from "@shared/domain/outline-document";
import { combineImportedOutlineFiles } from "@shared/domain/outline-file-combine";

describe("outline file import", () => {
  it("extracts readable text from Word document XML", () => {
    expect(
      wordDocumentXmlToText(
        '<w:document><w:body><w:p><w:r><w:t>第一场：雨夜公交站</w:t></w:r></w:p><w:p><w:r><w:t>章末：同样符号</w:t></w:r></w:p></w:body></w:document>'
      )
    ).toBe("第一场：雨夜公交站\n章末：同样符号");
  });

  it("extracts a minimal docx outline", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      '<w:document><w:body><w:p><w:r><w:t>第二场：倒计时</w:t></w:r></w:p></w:body></w:document>'
    );
    const buffer = await zip.generateAsync({ type: "uint8array" });

    await expect(extractDocxText(buffer)).resolves.toBe("第二场：倒计时");
  });

  it("combines multiple outline files in a stable project-ready order", async () => {
    expect(
      combineImportedOutlineFiles([
        { fileName: "01-opening.md", text: "第一幕：觉醒\n关键设定：雨夜符号" },
        { fileName: "02-chase.txt", text: "第二幕：追捕\n章末钩子：门后有人" }
      ])
    ).toEqual({
      fileName: "01-opening.md + 02-chase.txt",
      text: [
        "# 大纲文件 1: 01-opening.md",
        "",
        "第一幕：觉醒\n关键设定：雨夜符号",
        "",
        "---",
        "",
        "# 大纲文件 2: 02-chase.txt",
        "",
        "第二幕：追捕\n章末钩子：门后有人"
      ].join("\n")
    });
  });
});
