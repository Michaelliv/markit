import TurndownService from "turndown";
import type { Converter, ConversionResult, StreamInfo } from "../types.js";

const EXTENSIONS = [".rss", ".atom", ".xml"];
const MIMETYPES = [
  "application/rss+xml", "application/rss",
  "application/atom+xml", "application/atom",
  "text/xml", "application/xml",
];

export class RssConverter implements Converter {
  name = "rss";

  accepts(streamInfo: StreamInfo): boolean {
    // Only accept known RSS/Atom extensions directly
    if (streamInfo.extension && [".rss", ".atom"].includes(streamInfo.extension)) return true;

    // For .xml, we'll try and fail gracefully
    if (streamInfo.extension === ".xml") return true;

    if (streamInfo.mimetype && MIMETYPES.some((m) => streamInfo.mimetype!.startsWith(m))) return true;
    return false;
  }

  async convert(input: Buffer, _streamInfo: StreamInfo): Promise<ConversionResult> {
    const text = new TextDecoder("utf-8").decode(input);

    // Detect feed type
    if (text.includes("<rss")) {
      return this.parseRss(text);
    } else if (text.includes("<feed")) {
      return this.parseAtom(text);
    }

    // Not a feed — fall through for XML as generic text
    throw new Error("Not an RSS or Atom feed");
  }

  private parseRss(xml: string): ConversionResult {
    const turndown = new TurndownService({ headingStyle: "atx" });
    const sections: string[] = [];

    // Extract from the <channel> block specifically
    const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
    const channelXml = channelMatch ? channelMatch[1] : xml;

    const channelTitle = this.extract(channelXml, "title");
    const channelDesc = this.extract(channelXml, "description");

    if (channelTitle) sections.push(`# ${channelTitle}`);
    if (channelDesc) sections.push(this.htmlToMd(channelDesc, turndown));

    // Extract items
    const items = this.extractAll(xml, "item");
    for (const item of items) {
      const title = this.extract(item, "title");
      const pubDate = this.extract(item, "pubDate");
      const description = this.extract(item, "description");
      const content = this.extract(item, "content:encoded");
      const link = this.extract(item, "link");

      const parts: string[] = [];
      if (title) parts.push(`## ${title}`);
      if (pubDate) parts.push(`Published: ${pubDate}`);
      if (link) parts.push(`[Link](${link})`);
      if (content) {
        parts.push(this.htmlToMd(content, turndown));
      } else if (description) {
        parts.push(this.htmlToMd(description, turndown));
      }
      if (parts.length > 0) sections.push(parts.join("\n"));
    }

    return { markdown: sections.join("\n\n").trim(), title: channelTitle };
  }

  private parseAtom(xml: string): ConversionResult {
    const turndown = new TurndownService({ headingStyle: "atx" });
    const sections: string[] = [];

    const feedTitle = this.extract(xml, "title");
    const subtitle = this.extract(xml, "subtitle");

    if (feedTitle) sections.push(`# ${feedTitle}`);
    if (subtitle) sections.push(subtitle);

    const entries = this.extractAll(xml, "entry");
    for (const entry of entries) {
      const title = this.extract(entry, "title");
      const updated = this.extract(entry, "updated");
      const summary = this.extract(entry, "summary");
      const content = this.extract(entry, "content");

      const parts: string[] = [];
      if (title) parts.push(`## ${title}`);
      if (updated) parts.push(`Updated: ${updated}`);
      if (content) {
        parts.push(this.htmlToMd(content, turndown));
      } else if (summary) {
        parts.push(this.htmlToMd(summary, turndown));
      }
      if (parts.length > 0) sections.push(parts.join("\n"));
    }

    return { markdown: sections.join("\n\n").trim(), title: feedTitle };
  }

  private htmlToMd(html: string, turndown: TurndownService): string {
    // Unescape CDATA and HTML entities that might be in RSS
    const unescaped = html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    // If it looks like HTML, convert it
    if (unescaped.includes("<")) {
      return turndown.turndown(unescaped).trim();
    }
    return unescaped.trim();
  }

  private extract(xml: string, tag: string): string | undefined {
    // Handle both <tag>content</tag> and <tag><![CDATA[content]]></tag>
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
    const match = xml.match(re);
    if (!match) return undefined;
    return match[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .trim() || undefined;
  }

  private extractAll(xml: string, tag: string): string[] {
    const results: string[] = [];
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml)) !== null) {
      results.push(match[0]);
    }
    return results;
  }
}
