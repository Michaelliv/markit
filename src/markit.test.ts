import { afterEach, describe, expect, mock, test } from "bun:test";
import { Markit } from "./markit.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("Markit URL conversion", () => {
  test("uses the GitHub reader before the generic HTML fetch path", async () => {
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      expect(url).toBe(
        "https://r.jina.ai/http://github.com/TanStack/table/discussions/5834#discussion-7698250",
      );

      return new Response(
        [
          "Title: Example Discussion",
          "",
          "URL Source: http://github.com/TanStack/table/discussions/5834",
          "",
          "Markdown Content:",
          "## Heading",
          "",
          "Body",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
          },
        },
      );
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const markit = new Markit();
    const result = await markit.convertUrl(
      "https://github.com/TanStack/table/discussions/5834#discussion-7698250",
    );

    expect(result.title).toBe("Example Discussion");
    expect(result.markdown).toBe("# Example Discussion\n\n## Heading\n\nBody");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("keeps the default fetch path for non-GitHub URLs", async () => {
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      expect(url).toBe("https://example.com/article");

      return new Response(
        "<html><head><title>Example</title></head><body><main><h1>Hello</h1><p>World</p></main></body></html>",
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        },
      );
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const markit = new Markit();
    const result = await markit.convertUrl("https://example.com/article");

    expect(result.title).toBe("Example");
    expect(result.markdown).toContain("Hello");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
