import type { Converter } from "../types.js";
import type { Provider } from "../providers/types.js";
import type { MarkitPluginAPI, PluginDef, PluginFunction } from "./types.js";

export function createPluginAPI(pluginId: string): {
  api: MarkitPluginAPI;
  resolve: () => PluginDef;
} {
  let name = pluginId;
  let version = "0.0.0";
  const converters: Converter[] = [];
  const providers: Provider[] = [];

  const api: MarkitPluginAPI = {
    setName(n: string) {
      name = n;
    },
    setVersion(v: string) {
      version = v;
    },
    registerConverter(converter: Converter) {
      converters.push(converter);
    },
    registerProvider(provider: Provider) {
      providers.push(provider);
    },
  };

  function resolve(): PluginDef {
    return { name, version, converters, providers };
  }

  return { api, resolve };
}

export function isPluginFunction(val: any): val is PluginFunction {
  return typeof val === "function";
}

export function resolvePluginExport(
  exported: PluginFunction | PluginDef,
  pluginId: string,
): PluginDef {
  if (isPluginFunction(exported)) {
    const { api, resolve } = createPluginAPI(pluginId);
    exported(api);
    return resolve();
  }
  if (
    exported &&
    typeof exported === "object" &&
    "converters" in exported
  ) {
    return exported as PluginDef;
  }
  throw new Error(
    `Invalid plugin export from "${pluginId}": expected a function or { name, converters } object`,
  );
}
