import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";
import type { Converter, ConversionResult, StreamInfo } from "./types.js";
import { PdfConverter } from "./converters/pdf.js";
import { DocxConverter } from "./converters/docx.js";
import { PptxConverter } from "./converters/pptx.js";
import { XlsxConverter } from "./converters/xlsx.js";
import { EpubConverter } from "./converters/epub.js";
import { IpynbConverter } from "./converters/ipynb.js";
import { HtmlConverter } from "./converters/html.js";
import { WikipediaConverter } from "./converters/wikipedia.js";
import { RssConverter } from "./converters/rss.js";
import { CsvConverter } from "./converters/csv.js";
import { JsonConverter } from "./converters/json.js";
import { YamlConverter } from "./converters/yaml.js";
import { XmlConverter } from "./converters/xml.js";
import { ZipConverter } from "./converters/zip.js";
import { PlainTextConverter } from "./converters/plain-text.js";

export class Mill {
  private converters: Converter[] = [];

  constructor() {
    // Order matters: specific formats first, generic last.
    // URL-specific converters (Wikipedia) before generic HTML.
    // ZIP converter gets a reference to other converters for recursive conversion.
    const specific: Converter[] = [
      new PdfConverter(),
      new DocxConverter(),
      new PptxConverter(),
      new XlsxConverter(),
      new EpubConverter(),
      new IpynbConverter(),
      new WikipediaConverter(),
      new RssConverter(),
      new CsvConverter(),
      new JsonConverter(),
      new YamlConverter(),
    ];

    const generic: Converter[] = [
      new XmlConverter(),
      new HtmlConverter(),
    ];

    // ZIP gets all other converters for recursive extraction
    const allNonZip = [...specific, ...generic];
    const zipConverter = new ZipConverter(allNonZip);

    // Plain text is the ultimate catch-all
    this.converters = [
      ...specific,
      zipConverter,
      ...generic,
      new PlainTextConverter(),
    ];
  }

  /**
   * Convert a local file to markdown.
   */
  async convertFile(path: string): Promise<ConversionResult> {
    const buffer = readFileSync(path);
    const streamInfo: StreamInfo = {
      localPath: path,
      extension: extname(path).toLowerCase(),
      filename: basename(path),
    };
    return this.convert(buffer, streamInfo);
  }

  /**
   * Convert a URL to markdown.
   */
  async convertUrl(url: string): Promise<ConversionResult> {
    const response = await fetch(url, {
      headers: {
        Accept:
          "text/markdown, text/html;q=0.9, text/plain;q=0.8, */*;q=0.1",
        "User-Agent": "mill/0.1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const [mimetype] = contentType.split(";");

    // Derive extension from URL path
    const urlPath = new URL(url).pathname;
    const ext = extname(urlPath).toLowerCase();

    const buffer = Buffer.from(await response.arrayBuffer());
    const streamInfo: StreamInfo = {
      url,
      mimetype: mimetype.trim(),
      extension: ext || undefined,
      filename: basename(urlPath) || undefined,
    };

    return this.convert(buffer, streamInfo);
  }

  /**
   * Convert a buffer with stream info to markdown.
   */
  async convert(
    input: Buffer,
    streamInfo: StreamInfo,
  ): Promise<ConversionResult> {
    const errors: Array<{ converter: string; error: Error }> = [];

    for (const converter of this.converters) {
      if (!converter.accepts(streamInfo)) continue;

      try {
        return await converter.convert(input, streamInfo);
      } catch (err) {
        errors.push({
          converter: converter.name,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    if (errors.length > 0) {
      const details = errors
        .map((e) => `  ${e.converter}: ${e.error.message}`)
        .join("\n");
      throw new Error(`Conversion failed:\n${details}`);
    }

    throw new Error(
      `Unsupported format: ${streamInfo.extension || streamInfo.mimetype || "unknown"}`,
    );
  }
}
