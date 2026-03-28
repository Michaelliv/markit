import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { PptxConverter } from "./pptx.js";
import type { MarkitOptions, StreamInfo } from "../types.js";

const FIXTURE = join(import.meta.dir, "fixtures", "test-slides.pptx");

function streamInfo(filename = "test.pptx"): StreamInfo {
  return { extension: ".pptx", filename };
}

describe("PptxConverter", () => {
  const converter = new PptxConverter();

  describe("accepts", () => {
    it("accepts .pptx extension", () => {
      expect(converter.accepts({ extension: ".pptx" })).toBe(true);
    });

    it("accepts pptx mimetype", () => {
      expect(
        converter.accepts({
          mimetype:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }),
      ).toBe(true);
    });

    it("rejects other extensions", () => {
      expect(converter.accepts({ extension: ".pdf" })).toBe(false);
      expect(converter.accepts({ extension: ".docx" })).toBe(false);
    });
  });

  describe("convert", () => {
    it("extracts text from slides", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("Text Only Slide");
      expect(result.markdown).toContain("This slide has no images");
    });

    it("preserves slide markers", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("<!-- Slide 1 -->");
      expect(result.markdown).toContain("<!-- Slide 2 -->");
      expect(result.markdown).toContain("<!-- Slide 3 -->");
    });

    it("extracts speaker notes", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("### Notes:");
      expect(result.markdown).toContain("These are test speaker notes");
    });

    it("produces image placeholders without describe function", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("[Image:");
    });

    it("includes alt text in image placeholders", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("A red test square");
    });

    it("includes shape name in image placeholder", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      expect(result.markdown).toContain("Blue Square");
    });

    it("calls describe function when provided", async () => {
      const buffer = readFileSync(FIXTURE);
      const described: string[] = [];
      const options: MarkitOptions = {
        describe: async (image: Buffer, mimetype: string) => {
          described.push(mimetype);
          return "AI description of image";
        },
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      expect(described.length).toBeGreaterThan(0);
      expect(described.every((m) => m.startsWith("image/"))).toBe(true);
      expect(result.markdown).toContain("AI description of image");
    });

    it("falls back to placeholder when describe throws", async () => {
      const buffer = readFileSync(FIXTURE);
      const options: MarkitOptions = {
        describe: async () => {
          throw new Error("API error");
        },
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      // Should still have image placeholders, not crash
      expect(result.markdown).toContain("[Image:");
    });

    it("text-only slides have no image markers", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      // Split by slide markers; slide 1 is text-only
      const slides = result.markdown.split(/<!-- Slide \d+ -->/);
      // slides[0] is empty (before first marker), slides[1] is slide 1 content
      const slide1 = slides[1];
      expect(slide1).not.toContain("[Image:");
    });

    it("extracts images from inside groups", async () => {
      const buffer = readFileSync(FIXTURE);
      const result = await converter.convert(buffer, streamInfo());
      // Slide 4 has a grouped image named "Green Square"
      expect(result.markdown).toContain("Green Square");
    });

    it("extracts grouped images with describe function", async () => {
      const buffer = readFileSync(FIXTURE);
      const describedCount = { value: 0 };
      const options: MarkitOptions = {
        describe: async () => {
          describedCount.value++;
          return "described";
        },
      };
      const result = await converter.convert(buffer, streamInfo(), options);
      // Should describe images from all slides including grouped ones
      // Slides 2, 3, and 4 each have one image
      expect(describedCount.value).toBe(3);
    });
  });
});
