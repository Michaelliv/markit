import { installPlugin, removePlugin, listInstalled } from "../plugins/installer.js";
import type { OutputOptions } from "../utils/output.js";
import { output, success, error, dim, bold } from "../utils/output.js";
import { EXIT_ERROR } from "../utils/exit-codes.js";

export async function pluginInstall(
  source: string,
  options: OutputOptions,
): Promise<void> {
  try {
    const result = await installPlugin(source);
    output(options, {
      json: () => ({ success: true, ...result }),
      human: () => {
        success(`Installed ${result.name}`);
        console.log(dim(`  ${result.path}`));
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    output(options, {
      json: () => ({ success: false, error: msg }),
      human: () => error(msg),
    });
    process.exit(EXIT_ERROR);
  }
}

export async function pluginRemove(
  name: string,
  options: OutputOptions,
): Promise<void> {
  const removed = removePlugin(name);
  output(options, {
    json: () => ({ success: removed, name }),
    human: () => {
      if (removed) {
        success(`Removed ${name}`);
      } else {
        error(`Plugin '${name}' not found`);
      }
    },
  });
  if (!removed) process.exit(EXIT_ERROR);
}

export async function pluginList(
  options: OutputOptions,
): Promise<void> {
  const plugins = listInstalled();
  output(options, {
    json: () => ({ plugins }),
    human: () => {
      if (plugins.length === 0) {
        console.log(dim("  No plugins installed"));
        return;
      }
      console.log();
      console.log(bold("Installed plugins"));
      console.log();
      for (const p of plugins) {
        console.log(`  ${p.name.padEnd(20)} ${dim(p.type)} ${dim(p.source)}`);
      }
      console.log();
    },
  });
}
