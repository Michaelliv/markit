import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OutputOptions } from "../utils/output.js";
import { output, success, hint, cmd } from "../utils/output.js";
import type { MarkitConfig } from "../config.js";

const DATA_DIR = ".markit";

export async function init(
  _args: string[],
  options: OutputOptions,
): Promise<void> {
  const root = join(process.cwd(), DATA_DIR);

  if (existsSync(root)) {
    output(options, {
      json: () => ({ success: true, path: root, message: "already_exists" }),
      human: () => success(`.markit/ already exists`),
    });
    return;
  }

  mkdirSync(root, { recursive: true });

  const config: MarkitConfig = {
    llm: {
      model: "gpt-4o",
      transcriptionModel: "gpt-4o-mini-transcribe",
    },
  };

  writeFileSync(
    join(root, "config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );

  output(options, {
    json: () => ({ success: true, path: root }),
    human: () => {
      success(`Created .markit/ in ${process.cwd()}`);
      hint("Set your API key for image/audio AI features:");
      console.log(`  ${cmd("export OPENAI_API_KEY=sk-...")}`);
      hint("Or configure directly:");
      console.log(`  ${cmd("markit config set llm.apiKey sk-...")}`);
    },
  });
}
