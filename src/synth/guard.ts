import { HEADER_PREFIX } from "./emit.ts";

const FORBIDDEN = ["browser-agent", "openrouter", "openai", "anthropic", "fetch(", "API_KEY"];

/** MT-6.5: a generated spec must be runnable with no Magpi, no model, no provider key. */
export function checkNoAi(source: string, allowedImports: string[] = []): string[] {
  const errors: string[] = [];
  if (!source.startsWith(HEADER_PREFIX)) errors.push("missing generated header");
  for (const match of source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
    const module = match[1];
    if (module !== "@playwright/test" && !module.startsWith("node:") && !allowedImports.includes(module)) {
      errors.push(`forbidden import ${module}`);
    }
  }
  if (/\brequire\(/.test(source) || /\bimport\(/.test(source)) errors.push("dynamic import or require");
  const body = source.split("\n").filter((line) => !line.startsWith("//")).join("\n");
  if (/magpi/i.test(body)) errors.push("mentions magpi outside the header");
  for (const word of FORBIDDEN) if (body.toLowerCase().includes(word.toLowerCase())) errors.push(`contains ${word}`);
  return errors;
}
