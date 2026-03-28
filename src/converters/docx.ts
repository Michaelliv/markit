import mammoth from "mammoth";
import type {
  ConversionResult,
  Converter,
  MarkitOptions,
  StreamInfo,
} from "../types.js";
import { createTurndown, normalizeTablesHtml } from "../utils/turndown.js";

const EXTENSIONS = [".docx"];
const MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface CapturedImage {
  buffer: Buffer;
  contentType: string;
  index: number;
}

interface TurndownNodeLike {
  nodeName: string;
  parentNode: TurndownNodeLike | null;
  getAttribute?: (name: string) => string | null;
}

export class DocxConverter implements Converter {
  name = "docx";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) {
      return true;
    }
    if (
      streamInfo.mimetype &&
      MIMETYPES.some((m) => streamInfo.mimetype?.startsWith(m))
    ) {
      return true;
    }
    return false;
  }

  async convert(
    input: Buffer,
    _streamInfo: StreamInfo,
    options?: MarkitOptions,
  ): Promise<ConversionResult> {
    const captured: CapturedImage[] = [];
    let imageIndex = 0;

    // Mammoth's convertImage hook captures image data and emits a placeholder
    // src. The placeholder img nodes are converted to markdown by a Turndown
    // rule, which keeps structured contexts intact and preserves markdown
    // returned by describe().
    const convertImage = mammoth.images.imgElement((image) => {
      const idx = imageIndex++;
      const placeholder = this.imagePlaceholder(idx);

      return image.readAsBuffer().then((buffer) => {
        captured[idx] = {
          buffer,
          contentType: image.contentType,
          index: idx,
        };
        return { src: placeholder };
      });
    });

    const { value: html } = await mammoth.convertToHtml(
      { buffer: input },
      { convertImage },
    );

    const descriptions = await this.describeImages(captured, options);

    const turndown = createTurndown();
    turndown.addRule("markitDocxImage", {
      filter: (node) => {
        if (node.nodeName !== "IMG") return false;
        return this.parseImageIndex(this.getNodeAttribute(node, "src")) != null;
      },
      replacement: (_content, node) => {
        const src = this.getNodeAttribute(node, "src");
        const index = this.parseImageIndex(src);
        if (index == null) return "";

        const altText = this.getNodeAttribute(node, "alt") || "";
        const label = altText || `Image ${index + 1}`;
        const description = descriptions.get(index);
        const inTableCell = this.isInTableCell(node);

        if (description) {
          if (inTableCell) {
            return `${this.imageHeadingMarkdown(label, true)}<br>${this.inlineTableMarkdown(description)}`;
          }
          return `${this.imageHeadingMarkdown(label)}\n\n${description}`;
        }

        return this.placeholderMarkdown(label, index, inTableCell);
      },
    });

    const markdown = turndown.turndown(normalizeTablesHtml(html));
    return { markdown: markdown.trim() };
  }

  private async describeImages(
    images: CapturedImage[],
    options?: MarkitOptions,
  ): Promise<Map<number, string>> {
    const descriptions = new Map<number, string>();
    if (!options?.describe) return descriptions;

    for (const image of images) {
      if (!image) continue;

      try {
        const description = await options.describe(
          image.buffer,
          image.contentType,
        );
        if (description) descriptions.set(image.index, description);
      } catch {
        // Description failed — caller falls back to placeholder markdown.
      }
    }

    return descriptions;
  }

  private imagePlaceholder(index: number): string {
    return `__MARKIT_IMG_${index}__`;
  }

  private parseImageIndex(src: string | null): number | null {
    if (!src) return null;
    const match = /^__MARKIT_IMG_(\d+)__$/.exec(src);
    if (!match) return null;
    return Number(match[1]);
  }

  private placeholderMarkdown(
    label: string,
    index: number,
    inTableCell = false,
  ): string {
    const escaped = this.escapeImageLabel(label, inTableCell);
    if (label === `Image ${index + 1}`) {
      return `*[${escaped}]*`;
    }
    return `*[Image: ${escaped}]*`;
  }

  private imageHeadingMarkdown(label: string, inTableCell = false): string {
    return `**[Image: ${this.escapeImageLabel(label, inTableCell)}]**`;
  }

  private escapeImageLabel(label: string, inTableCell: boolean): string {
    const escaped = this.escapeMarkdownText(label);
    return inTableCell ? escaped.replace(/\|/g, "\\|") : escaped;
  }

  private inlineTableMarkdown(markdown: string): string {
    return markdown.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  }

  private getNodeAttribute(node: unknown, name: string): string | null {
    const candidate = node as TurndownNodeLike;
    if (typeof candidate.getAttribute !== "function") return null;
    return candidate.getAttribute(name);
  }

  private isInTableCell(node: unknown): boolean {
    let current: TurndownNodeLike | null = node as TurndownNodeLike;
    while (current) {
      if (current.nodeName === "TD" || current.nodeName === "TH") {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  private escapeMarkdownText(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/([`*_{}[\]()#+.!-])/g, "\\$1");
  }
}
