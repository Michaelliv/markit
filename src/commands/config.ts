import type { OutputOptions } from "../utils/output.js";
import { output, success, error, dim, bold } from "../utils/output.js";
import { loadConfig, saveConfig, findConfigDir, resolveApiKey, resolveApiBase, resolveModel } from "../config.js";
import { EXIT_ERROR, EXIT_USER_ERROR } from "../utils/exit-codes.js";

export async function configShow(
  _args: string[],
  options: OutputOptions,
): Promise<void> {
  const config = loadConfig();
  const configDir = findConfigDir();

  output(options, {
    json: () => ({
      configDir,
      config,
      resolved: {
        apiKey: resolveApiKey(config) ? "***" : null,
        apiBase: resolveApiBase(config),
        model: resolveModel(config),
      },
    }),
    human: () => {
      console.log();
      console.log(bold("Configuration"));
      console.log();
      if (configDir) {
        console.log(`  ${dim("config:")} ${configDir}/config.json`);
      } else {
        console.log(`  ${dim("config:")} none (run 'markit init')`);
      }
      console.log();
      console.log(bold("LLM Settings"));
      console.log();

      const apiKey = resolveApiKey(config);
      const keySource = process.env.OPENAI_API_KEY
        ? "OPENAI_API_KEY"
        : process.env.MILL_API_KEY
          ? "MILL_API_KEY"
          : config.llm?.apiKey
            ? "config"
            : "not set";
      console.log(`  ${dim("api key:")} ${apiKey ? `***${apiKey.slice(-4)} (${keySource})` : dim("not set")}`);
      console.log(`  ${dim("api base:")} ${resolveApiBase(config)}`);
      console.log(`  ${dim("model:")} ${resolveModel(config)}`);
      console.log(`  ${dim("transcription:")} ${config.llm?.transcriptionModel || "gpt-4o-mini-transcribe"}`);
      console.log();
    },
  });
}

export async function configGet(
  key: string,
  options: OutputOptions,
): Promise<void> {
  const config = loadConfig();
  const value = getNestedValue(config, key);

  if (value === undefined) {
    output(options, {
      json: () => ({ key, value: null }),
      human: () => error(`Key '${key}' not found`),
    });
    process.exit(EXIT_USER_ERROR);
  }

  output(options, {
    json: () => ({ key, value }),
    quiet: () => console.log(String(value)),
    human: () => console.log(String(value)),
  });
}

export async function configSet(
  key: string,
  value: string,
  options: OutputOptions,
): Promise<void> {
  if (!findConfigDir()) {
    output(options, {
      json: () => ({ success: false, error: "No .markit/ directory. Run 'markit init'" }),
      human: () => error("No .markit/ directory. Run 'markit init' first."),
    });
    process.exit(EXIT_ERROR);
  }

  const config = loadConfig();

  // Parse value (handle booleans and numbers)
  let parsed: any = value;
  if (value === "true") parsed = true;
  else if (value === "false") parsed = false;
  else if (/^\d+$/.test(value)) parsed = parseInt(value);

  setNestedValue(config, key, parsed);
  saveConfig(config);

  output(options, {
    json: () => ({ success: true, key, value: parsed }),
    human: () => success(`${key} = ${JSON.stringify(parsed)}`),
  });
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}
