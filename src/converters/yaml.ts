import type { Converter, ConversionResult, StreamInfo } from "../types.js";

const EXTENSIONS = [".yaml", ".yml"];
const MIMETYPES = ["text/yaml", "application/x-yaml"];

export class YamlConverter implements Converter {
  name = "yaml";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) return true;
    if (streamInfo.mimetype && MIMETYPES.some((m) => streamInfo.mimetype!.startsWith(m))) return true;
    return false;
  }

  async convert(input: Buffer, streamInfo: StreamInfo): Promise<ConversionResult> {
    const text = new TextDecoder(streamInfo.charset || "utf-8").decode(input);
    return { markdown: `\`\`\`yaml\n${text}\n\`\`\`` };
  }
}
