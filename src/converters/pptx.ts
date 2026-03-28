import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type {
  ConversionResult,
  Converter,
  MarkitOptions,
  StreamInfo,
} from "../types.js";

const IMAGE_MIMETYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".emf": "image/emf",
  ".wmf": "image/wmf",
};

const EXTENSIONS = [".pptx"];
const MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export class PptxConverter implements Converter {
  name = "pptx";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension))
      return true;
    if (
      streamInfo.mimetype &&
      MIMETYPES.some((m) => streamInfo.mimetype?.startsWith(m))
    )
      return true;
    return false;
  }

  async convert(
    input: Buffer,
    _streamInfo: StreamInfo,
    options?: MarkitOptions,
  ): Promise<ConversionResult> {
    const zip = await JSZip.loadAsync(input);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
    });

    // Get slide order from presentation.xml
    const presXml = await zip.file("ppt/presentation.xml")?.async("string");
    if (!presXml) throw new Error("Invalid PPTX: missing presentation.xml");

    const pres = parser.parse(presXml);
    const sldIdList = pres["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"];
    const sldIds = Array.isArray(sldIdList)
      ? sldIdList
      : sldIdList
        ? [sldIdList]
        : [];

    // Get relationship mappings
    const relsXml = await zip
      .file("ppt/_rels/presentation.xml.rels")
      ?.async("string");
    const rels = relsXml ? parser.parse(relsXml) : null;
    const relList = rels?.Relationships?.Relationship;
    const relArray = Array.isArray(relList)
      ? relList
      : relList
        ? [relList]
        : [];
    const relMap = new Map<string, string>();
    for (const r of relArray) {
      relMap.set(r["@_Id"], r["@_Target"]);
    }

    // Map slide IDs to file paths in order
    const slidePaths: string[] = [];
    for (const sld of sldIds) {
      const rId = sld["@_r:id"];
      const target = relMap.get(rId);
      if (target) slidePaths.push(`ppt/${target}`);
    }

    // If we couldn't resolve from rels, fall back to finding slide files
    if (slidePaths.length === 0) {
      const slideFiles = Object.keys(zip.files)
        .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
          const nb = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
          return na - nb;
        });
      slidePaths.push(...slideFiles);
    }

    const sections: string[] = [];

    for (let i = 0; i < slidePaths.length; i++) {
      const slidePath = slidePaths[i];
      const slideXml = await zip.file(slidePath)?.async("string");
      if (!slideXml) continue;

      const slide = parser.parse(slideXml);
      const spTree = slide["p:sld"]?.["p:cSld"]?.["p:spTree"];
      if (!spTree) continue;

      // Load slide-level relationships for image resolution
      const slideRelsPath =
        slidePath.replace("slides/slide", "slides/_rels/slide") + ".rels";
      const slideRelMap = await this.loadRelationships(
        zip,
        parser,
        slideRelsPath,
      );

      const slideLines: string[] = [`<!-- Slide ${i + 1} -->`];
      const shapes = spTree["p:sp"];
      const shapeList = Array.isArray(shapes) ? shapes : shapes ? [shapes] : [];

      let isTitle = true;
      for (const shape of shapeList) {
        const text = this.extractText(shape);
        if (!text) continue;

        if (isTitle) {
          slideLines.push(`# ${text}`);
          isTitle = false;
        } else {
          slideLines.push(text);
        }
      }

      // Images
      const pics = spTree["p:pic"];
      const picList = Array.isArray(pics) ? pics : pics ? [pics] : [];
      for (const pic of picList) {
        const imageMarkdown = await this.extractImage(
          pic,
          zip,
          slideRelMap,
          options,
        );
        if (imageMarkdown) slideLines.push(imageMarkdown);
      }

      // Tables
      const graphicFrames = spTree["p:graphicFrame"];
      const gfList = Array.isArray(graphicFrames)
        ? graphicFrames
        : graphicFrames
          ? [graphicFrames]
          : [];
      for (const gf of gfList) {
        const table = this.extractTable(gf);
        if (table) slideLines.push(table);
      }

      // Slide notes
      const noteFile = slidePath.replace(
        "slides/slide",
        "notesSlides/notesSlide",
      );
      const noteXml = await zip.file(noteFile)?.async("string");
      if (noteXml) {
        const note = parser.parse(noteXml);
        const noteSpTree = note["p:notes"]?.["p:cSld"]?.["p:spTree"];
        if (noteSpTree) {
          const noteShapes = noteSpTree["p:sp"];
          const noteList = Array.isArray(noteShapes)
            ? noteShapes
            : noteShapes
              ? [noteShapes]
              : [];
          const noteTexts: string[] = [];
          for (const ns of noteList) {
            // Skip slide image placeholder
            const phType = ns["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"]?.["@_type"];
            if (phType === "sldImg") continue;
            const t = this.extractText(ns);
            if (t) noteTexts.push(t);
          }
          if (noteTexts.length > 0) {
            slideLines.push("\n### Notes:");
            slideLines.push(noteTexts.join("\n"));
          }
        }
      }

      sections.push(slideLines.join("\n"));
    }

    return { markdown: sections.join("\n\n").trim() };
  }

  private async loadRelationships(
    zip: JSZip,
    parser: XMLParser,
    relsPath: string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const xml = await zip.file(relsPath)?.async("string");
    if (!xml) return map;
    const parsed = parser.parse(xml);
    const rels = parsed?.Relationships?.Relationship;
    const list = Array.isArray(rels) ? rels : rels ? [rels] : [];
    for (const r of list) {
      map.set(r["@_Id"], r["@_Target"]);
    }
    return map;
  }

  private async extractImage(
    pic: any,
    zip: JSZip,
    slideRelMap: Map<string, string>,
    options?: MarkitOptions,
  ): Promise<string | null> {
    // Get the relationship ID for the embedded image
    const blip = pic["p:blipFill"]?.["a:blip"];
    if (!blip) return null;

    const rId = blip["@_r:embed"];
    if (!rId) return null;

    // Resolve relationship to file path (targets are relative to slides/)
    const target = slideRelMap.get(rId);
    if (!target) return null;

    const imagePath = target.startsWith("../")
      ? `ppt/${target.slice(3)}`
      : `ppt/slides/${target}`;

    const imageFile = zip.file(imagePath);
    if (!imageFile) return null;

    const imageName = imagePath.split("/").pop() || "image";
    const ext = `.${imageName.split(".").pop()?.toLowerCase() || "png"}`;
    const mimetype = IMAGE_MIMETYPES[ext] || "image/png";

    // Use shape name / alt text if available
    const cNvPr = pic["p:nvPicPr"]?.["p:cNvPr"];
    const shapeName = cNvPr?.["@_name"] || "";
    const altText = cNvPr?.["@_descr"] || "";
    const label = shapeName || imageName;

    // AI description when available
    if (options?.describe) {
      try {
        const buffer = Buffer.from(await imageFile.async("nodebuffer"));
        const description = await options.describe(buffer, mimetype);
        if (description) {
          return `\n**[Image: ${label}]**\n\n${description}`;
        }
      } catch {
        // AI description failed, fall through to placeholder
      }
    }

    // Fallback: placeholder with alt text if present
    if (altText) {
      return `*[Image: ${label} — ${altText}]*`;
    }
    return `*[Image: ${label}]*`;
  }

  private extractText(shape: any): string {
    const txBody = shape["p:txBody"];
    if (!txBody) return "";

    const paragraphs = txBody["a:p"];
    const pList = Array.isArray(paragraphs)
      ? paragraphs
      : paragraphs
        ? [paragraphs]
        : [];

    const lines: string[] = [];
    for (const p of pList) {
      const runs = p["a:r"];
      const rList = Array.isArray(runs) ? runs : runs ? [runs] : [];
      const parts: string[] = [];
      for (const r of rList) {
        const t = r["a:t"];
        if (t != null)
          parts.push(typeof t === "object" ? t["#text"] || "" : String(t));
      }
      if (parts.length > 0) lines.push(parts.join(""));
    }

    return lines.join("\n").trim();
  }

  private extractTable(gf: any): string | null {
    const tbl = gf?.["a:graphic"]?.["a:graphicData"]?.["a:tbl"];
    if (!tbl) return null;

    const rows = tbl["a:tr"];
    const rowList = Array.isArray(rows) ? rows : rows ? [rows] : [];
    if (rowList.length === 0) return null;

    const mdRows: string[][] = [];
    for (const row of rowList) {
      const cells = row["a:tc"];
      const cellList = Array.isArray(cells) ? cells : cells ? [cells] : [];
      const cellTexts: string[] = [];
      for (const cell of cellList) {
        const txBody = cell["a:txBody"];
        if (!txBody) {
          cellTexts.push("");
          continue;
        }
        const paragraphs = txBody["a:p"];
        const pList = Array.isArray(paragraphs)
          ? paragraphs
          : paragraphs
            ? [paragraphs]
            : [];
        const parts: string[] = [];
        for (const p of pList) {
          const runs = p["a:r"];
          const rList = Array.isArray(runs) ? runs : runs ? [runs] : [];
          for (const r of rList) {
            const t = r["a:t"];
            if (t != null)
              parts.push(typeof t === "object" ? t["#text"] || "" : String(t));
          }
        }
        cellTexts.push(parts.join(" "));
      }
      mdRows.push(cellTexts);
    }

    if (mdRows.length === 0) return null;

    const [header, ...body] = mdRows;
    const lines: string[] = [];
    lines.push(`| ${header.join(" | ")} |`);
    lines.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (const row of body) {
      while (row.length < header.length) row.push("");
      lines.push(`| ${row.join(" | ")} |`);
    }
    return lines.join("\n");
  }
}
