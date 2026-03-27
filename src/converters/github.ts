import type {
  ConversionResult,
  Converter,
  MarkitOptions,
  StreamInfo,
} from "../types.js";

const GITHUB_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "gist.github.com",
]);

function getGitHubUrl(streamInfo: StreamInfo): URL | null {
  if (!streamInfo.url) return null;

  let parsed: URL;
  try {
    parsed = new URL(streamInfo.url);
  } catch {
    return null;
  }

  return GITHUB_HOSTS.has(parsed.hostname) ? parsed : null;
}

function toJinaReadUrl(url: URL): string {
  return `https://r.jina.ai/http://${url.host}${url.pathname}${url.search}${url.hash}`;
}

function parseJinaMarkdown(text: string): ConversionResult {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const titleMatch = normalized.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim();

  const bodyMatch = normalized.match(/\nMarkdown Content:\s*\n([\s\S]*)$/);
  let markdown = bodyMatch ? bodyMatch[1].trim() : normalized;

  markdown = markdown
    .replace(/^Title:\s*.+$/m, "")
    .replace(/^URL Source:\s*.+$/m, "")
    .replace(/^Markdown Content:\s*$/m, "")
    .trim();

  if (title && !markdown.startsWith("# ")) {
    markdown = `# ${title}\n\n${markdown}`;
  }

  if (!markdown) {
    throw new Error("GitHub reader returned an empty response");
  }

  return { markdown, title };
}

async function readGitHubUrl(url: URL): Promise<ConversionResult> {
  const response = await fetch(toJinaReadUrl(url), {
    headers: {
      Accept: "text/plain, text/markdown;q=0.9, */*;q=0.1",
      "User-Agent": "markit/0.2.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub reader failed for ${url.toString()}: ${response.status} ${response.statusText}`,
    );
  }

  return parseJinaMarkdown(await response.text());
}

export class GitHubConverter implements Converter {
  name = "github";

  accepts(streamInfo: StreamInfo): boolean {
    return getGitHubUrl(streamInfo) !== null;
  }

  async convert(
    _input: Buffer,
    streamInfo: StreamInfo,
    _options?: MarkitOptions,
  ): Promise<ConversionResult> {
    const url = getGitHubUrl(streamInfo);
    if (!url) {
      throw new Error("GitHub converter requires a github.com URL");
    }
    return readGitHubUrl(url);
  }

  async convertUrl(
    url: string,
    streamInfo: StreamInfo,
    _options?: MarkitOptions,
  ): Promise<ConversionResult> {
    const githubUrl = getGitHubUrl(streamInfo) ?? new URL(url);
    return readGitHubUrl(githubUrl);
  }
}
