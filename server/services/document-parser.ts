/**
 * Multi-format document parser supporting PDF, DOCX/DOC, and TXT files.
 */
// @ts-ignore — pdf-parse has no type declarations
import { PDFParse } from "pdf-parse";
// @ts-ignore
import mammoth from "mammoth";

export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const name = fileName.toLowerCase();
  const type = mimeType.toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    // pdf-parse v2: getText() returns { pages: [{ text, num }], total }
    return result.pages
      ? result.pages.map((p: any) => p.text).join("\n")
      : "";
  }

  if (
    type.includes("wordprocessingml") ||
    type.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  // Fallback: raw text
  return buffer.toString("utf8");
}
