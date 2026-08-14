import { parseRuntimeConfig } from "./runtime-config";

export const runtimeConfig = parseRuntimeConfig(process.env);
