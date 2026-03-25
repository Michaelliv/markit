import type { LlmClient } from "./types.js";
import type { MarkitConfig } from "./config.js";
import { resolveApiKey, resolveApiBase, resolveTranscriptionModel } from "./config.js";

/**
 * Build an OpenAI-compatible LLM client from config + env vars.
 * Returns null if no API key is available.
 * Uses raw fetch — no openai SDK dependency.
 */
export function createLlmClient(config: MarkitConfig): LlmClient | null {
  const apiKey = resolveApiKey(config);
  if (!apiKey) return null;

  const baseUrl = resolveApiBase(config).replace(/\/+$/, "");
  const transcriptionModel = resolveTranscriptionModel(config);

  return {
    chat: {
      completions: {
        async create(params) {
          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: params.model,
              messages: params.messages,
              max_tokens: params.max_tokens ?? 1024,
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`LLM API error ${res.status}: ${body}`);
          }

          return res.json() as any;
        },
      },
    },
    audio: {
      transcriptions: {
        async create(params) {
          const formData = new FormData();
          formData.append("model", params.model || transcriptionModel);

          // Convert Blob/File to a File with a proper name if needed
          if (params.file instanceof File) {
            formData.append("file", params.file);
          } else {
            // Blob — wrap in a File with a name (required by the API)
            const file = new File([params.file], "audio.mp3", {
              type: params.file.type || "audio/mpeg",
            });
            formData.append("file", file);
          }

          const res = await fetch(`${baseUrl}/audio/transcriptions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Transcription API error ${res.status}: ${body}`);
          }

          return res.json() as any;
        },
      },
    },
  };
}
