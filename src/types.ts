export interface StreamInfo {
  mimetype?: string;
  extension?: string;
  charset?: string;
  filename?: string;
  localPath?: string;
  url?: string;
}

export interface ConversionResult {
  markdown: string;
  title?: string;
}

export interface ConvertOptions {
  /** OpenAI-compatible client for image descriptions and audio transcription */
  llmClient?: LlmClient;
  /** Model to use for vision/chat operations (e.g. "gpt-4o") */
  llmModel?: string;
}

/**
 * OpenAI-compatible client interface.
 * Works with the official `openai` SDK or any compatible client.
 *
 * Usage with official SDK:
 *   import OpenAI from "openai";
 *   const markit = new Markit({ llmClient: new OpenAI() as LlmClient, llmModel: "gpt-4o" });
 *
 * Usage with raw fetch (built-in, see llm.ts):
 *   const markit = new Markit({ llmClient: createLlmClient(config), llmModel: "gpt-4o" });
 */
export interface LlmClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        messages: Array<{
          role: string;
          content:
            | string
            | Array<
                | { type: "text"; text: string }
                | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
              >;
        }>;
        max_tokens?: number;
      }): Promise<{
        choices: Array<{
          message: { content: string | null; role: string };
          finish_reason: string;
        }>;
      }>;
    };
  };
  audio?: {
    transcriptions: {
      create(params: {
        model: string;
        file: File | Blob;
      }): Promise<{ text: string }>;
    };
  };
}

export interface Converter {
  /** Human-readable name for error messages */
  name: string;

  /** Quick check: can this converter handle the given stream? */
  accepts(streamInfo: StreamInfo): boolean;

  /** Convert the source to markdown */
  convert(input: Buffer, streamInfo: StreamInfo, options?: ConvertOptions): Promise<ConversionResult>;
}
