import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MarkitOptions, StreamInfo } from "../types.js";
import { DocxConverter } from "./docx.js";

const FIXTURE = join(import.meta.dir, "fixtures", "test-doc.docx");

function streamInfo(filename = "test.docx"): StreamInfo {
  return { extension: ".docx", filename };
}

describe("DocxConverter", () => {
  const converter = new DocxConverter();

  describe("accepts", () => {
    it("accepts .docx extension", () => {
      expect(converter.accepts({ extension: ".docx" })).toBe(true);
    });

    it("accepts docx mimetype", () => {
      expect(
        converter.accepts({
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ).toBe(true);
    });

    it("rejects other extensions", () => {
      expect(converter.accepts({ extension: ".pdf" })).toBe(false);
      expect(converter.accepts({ extension: ".pptx" })).toBe(false);
    });
  });

  describe("convert", () => {
    it("extracts text content", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("Text Only Section");
      expect(result.markdown).toContain(
        "This document tests image extraction from DOCX files.",
      );
    });

    it("produces image placeholders without describe function", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("[Image");
    });

    it("includes alt text in image placeholders", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("A red test square");
    });

    it("produces numbered placeholder when no alt text", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("Image 2");
    });

    it("calls describe function when provided", async () => {
      const buffer = readFileSync(FIXTURE);
      const described: string[] = [];
      const options: MarkitOptions = {
        describe: async (_image: Buffer, mimetype: string) => {
          described.push(mimetype);
          return "AI description of image";
        },
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      // 3 images: red square, blue square, green square in table
      expect(described.length).toBe(3);
      expect(described.every((m) => m.startsWith("image/"))).toBe(true);
      expect(result.markdown).toContain("AI description of image");
    });

    it("preserves markdown returned by describe function", async () => {
      const buffer = readFileSync(FIXTURE);
      const options: MarkitOptions = {
        describe: async () => "- first\n- *second*",
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      expect(result.markdown).toContain("- first");
      expect(result.markdown).toContain("*second*");
      expect(result.markdown).not.toContain("\\*second\\*");
    });

    it("preserves literal dollar sequences in descriptions", async () => {
      const buffer = readFileSync(FIXTURE);
      const options: MarkitOptions = {
        describe: async () => "Before $& after\n\nPrice $1",
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      expect(result.markdown).toContain("Before $& after");
      expect(result.markdown).toContain("Price $1");
      expect(result.markdown).not.toContain("__MARKIT_IMG_");
    });

    it("falls back to placeholder when describe throws", async () => {
      const buffer = readFileSync(FIXTURE);
      const options: MarkitOptions = {
        describe: async () => {
          throw new Error("API error");
        },
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      expect(result.markdown).toContain("[Image");
      expect(result.markdown).toContain("Text Only Section");
    });

    it("does not contain raw placeholder tokens", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).not.toContain("__MARKIT_IMG_");
    });

    it("handles images inside table cells", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      // Table should still be valid markdown and contain the image placeholder
      expect(result.markdown).toContain("A green square in a table");
      expect(result.markdown).toContain("Green item");
    });

    it("table remains valid with describe function", async () => {
      const buffer = readFileSync(FIXTURE);
      const options: MarkitOptions = {
        describe: async () => "described image",
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      // Table cell content should include the description without breaking
      // the table structure
      expect(result.markdown).toContain(
        "| Green item | **[Image: A green square in a table]**<br>described image |",
      );
      expect(result.markdown).not.toContain("__MARKIT_IMG_");
    });
  });
});
