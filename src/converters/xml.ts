import type { Converter, ConversionResult, StreamInfo } from "../types.js";

const EXTENSIONS = [".xml", ".svg"];
const MIMETYPES = ["text/xml", "application/xml"];

export class XmlConverter implements Converter {
  name = "xml";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) return true;
    if (streamInfo.mimetype && MIMETYPES.some((m) => streamInfo.mimetype!.startsWith(m))) return true;
    return false;
  }

  async convert(input: Buffer, streamInfo: StreamInfo): Promise<ConversionResult> {
    const text = new TextDecoder(streamInfo.charset || "utf-8").decode(input);
    const ext = streamInfo.extension?.slice(1) || "xml";
    return { markdown: `\`\`\`${ext}\n${text}\n\`\`\`` };
  }
}
