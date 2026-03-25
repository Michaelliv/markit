import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = ".markit";
const CONFIG_FILE = "config.json";

export interface MarkitConfig {
  llm?: {
    /** OpenAI-compatible API base URL (default: https://api.openai.com/v1) */
    apiBase?: string;
    /** API key — prefer env var OPENAI_API_KEY over storing here */
    apiKey?: string;
    /** Model for image descriptions (default: gpt-4o) */
    model?: string;
    /** Model for audio transcription (default: gpt-4o-mini-transcribe) */
    transcriptionModel?: string;
  };
}

const DEFAULT_CONFIG: MarkitConfig = {};

/**
 * Walk up from cwd to find .markit/ directory.
 */
export function findConfigDir(): string | null {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, DATA_DIR))) {
      return join(dir, DATA_DIR);
    }
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Load config from .markit/config.json, merging with defaults.
 */
export function loadConfig(): MarkitConfig {
  const configDir = findConfigDir();
  if (!configDir) return { ...DEFAULT_CONFIG };

  const configFile = join(configDir, CONFIG_FILE);
  if (!existsSync(configFile)) return { ...DEFAULT_CONFIG };

  const raw = JSON.parse(readFileSync(configFile, "utf-8"));
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    llm: { ...DEFAULT_CONFIG.llm, ...raw.llm },
  };
}

/**
 * Save config to .markit/config.json. Creates .markit/ if needed.
 */
export function saveConfig(config: MarkitConfig): void {
  const configDir = findConfigDir();
  const dir = configDir || join(process.cwd(), DATA_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, CONFIG_FILE),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

/**
 * Resolve the API key. Precedence: env var > config file.
 * Checks: OPENAI_API_KEY, MARKIT_API_KEY
 */
export function resolveApiKey(config: MarkitConfig): string | undefined {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.MARKIT_API_KEY ||
    config.llm?.apiKey
  );
}

/**
 * Resolve the API base URL. Precedence: env var > config file > default.
 */
export function resolveApiBase(config: MarkitConfig): string {
  return (
    process.env.OPENAI_API_BASE ||
    process.env.OPENAI_BASE_URL ||
    process.env.MARKIT_API_BASE ||
    config.llm?.apiBase ||
    "https://api.openai.com/v1"
  );
}

/**
 * Resolve the model. Precedence: flag > env var > config file > default.
 */
export function resolveModel(
  config: MarkitConfig,
  flagValue?: string,
): string {
  return (
    flagValue ||
    process.env.MARKIT_MODEL ||
    config.llm?.model ||
    "gpt-4o"
  );
}

/**
 * Resolve the transcription model.
 */
export function resolveTranscriptionModel(config: MarkitConfig): string {
  return config.llm?.transcriptionModel || "gpt-4o-mini-transcribe";
}
