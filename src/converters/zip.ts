import JSZip from "jszip";
import { extname, basename } from "node:path";
import type { Converter, ConversionResult, StreamInfo } from "../types.js";

const EXTENSIONS = [".zip"];
const MIMETYPES = ["application/zip", "application/x-zip-compressed"];

export class ZipConverter implements Converter {
  name = "zip";
  private parentConverters: Converter[];

  constructor(parentConverters: Converter[]) {
    this.parentConverters = parentConverters;
  }

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) return true;
    if (streamInfo.mimetype && MIMETYPES.some((m) => streamInfo.mimetype!.startsWith(m))) return true;
    return false;
  }

  async convert(input: Buffer, streamInfo: StreamInfo): Promise<ConversionResult> {
    const zip = await JSZip.loadAsync(input);
    const label = streamInfo.localPath || streamInfo.filename || "archive.zip";
    const sections: string[] = [`Content from \`${basename(label)}\`:`];

    for (const [path, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      const ext = extname(path).toLowerCase();
      const fileInfo: StreamInfo = {
        extension: ext,
        filename: basename(path),
      };

      const buffer = Buffer.from(await file.async("arraybuffer"));

      // Try each converter
      let converted = false;
      for (const converter of this.parentConverters) {
        if (converter.name === "zip") continue; // avoid recursion loops
        if (!converter.accepts(fileInfo)) continue;

        try {
          const result = await converter.convert(buffer, fileInfo);
          if (result.markdown.trim()) {
            sections.push(`## File: ${path}\n\n${result.markdown.trim()}`);
            converted = true;
            break;
          }
        } catch {
          // Try next converter
        }
      }

      if (!converted) {
        sections.push(`## File: ${path}\n\n*[binary file]*`);
      }
    }

    return { markdown: sections.join("\n\n").trim() };
  }
}
