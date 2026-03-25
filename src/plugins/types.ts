import type { Converter } from "../types.js";
import type { Provider } from "../providers/types.js";

export interface MarkitPluginAPI {
  setName(name: string): void;
  setVersion(version: string): void;
  registerConverter(converter: Converter): void;
  registerProvider(provider: Provider): void;
}

export type PluginFunction = (api: MarkitPluginAPI) => void;

export interface PluginDef {
  name: string;
  version: string;
  converters: Converter[];
  providers: Provider[];
}

export interface InstalledPlugin {
  source: string;
  path: string;
  name?: string;
}
