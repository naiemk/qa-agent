import path from "node:path";
import type { FileAccess } from "../files/index.ts";
import { uiStrings } from "./app-text.ts";

export interface ScannedRoute {
  path: string;
  file: string;
  line: number;
  component?: string;
  /** Component file plus same-folder relative imports (QD17). */
  sourceFiles: string[];
}

export interface StaticScan {
  schemaVersion: 1;
  routes: ScannedRoute[];
  docs: { file: string; headings: string[] }[];
  helpers: { file: string; exports: string[] }[];
  locatorHints: { file: string; testIds: string[]; ariaLabels: string[] }[];
  /** UI-looking string literals and JSX text from source, for grounding criteria. */
  uiStrings: string[];
}

const SOURCE_EXT = /\.(tsx?|jsx?|mjs)$/;
const DOC_FILES = ["README*", "AGENTS.md", "CLAUDE.md", "QA.md", "docs/**/*.md"];

interface RawRoute {
  path: string;
  line: number;
  component?: string;
}

/** React Router routes in the three forms the spec lists, by regex over source text. */
export function findRoutes(source: string): RawRoute[] {
  const routes: RawRoute[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;
  for (const match of source.matchAll(/<Route\b([^>]*?)\/?>/gs)) {
    const attrs = match[1];
    const pathMatch = attrs.match(/\bpath\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/);
    if (!pathMatch) continue;
    const component = attrs.match(/element\s*=\s*\{\s*<\s*([A-Z][A-Za-z0-9_.]*)/)?.[1] ?? attrs.match(/Component\s*=\s*\{\s*([A-Z][A-Za-z0-9_]*)/)?.[1];
    routes.push({ path: pathMatch[1] ?? pathMatch[2] ?? pathMatch[3], line: lineOf(match.index), component });
  }
  if (/createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes|RouteObject/.test(source)) {
    for (const match of source.matchAll(/\bpath\s*:\s*["'`]([^"'`]*)["'`]\s*,?([^}]{0,200})/g)) {
      const component = match[2].match(/(?:element\s*:\s*<\s*|Component\s*:\s*)([A-Z][A-Za-z0-9_]*)/)?.[1];
      routes.push({ path: match[1], line: lineOf(match.index), component });
    }
  }
  return routes;
}

/** import name → specifier, for named, default, and namespace imports. */
export function importsOf(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of source.matchAll(/import\s+(?:type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/g)) {
    const clause = match[1];
    const specifier = match[2];
    const named = clause.match(/\{([^}]*)\}/)?.[1];
    if (named) {
      for (const part of named.split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) map.set(name, specifier);
      }
    }
    const def = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+/, "").split(",")[0]?.trim();
    if (def && /^[A-Za-z_$][\w$]*$/.test(def)) map.set(def, specifier);
  }
  return map;
}

function resolveSpecifier(fromFile: string, specifier: string, known: Set<string>): string | undefined {
  let base: string;
  if (specifier.startsWith(".")) {
    base = path.posix.join(path.posix.dirname(fromFile), specifier);
  } else if (specifier.startsWith("@/") || specifier.startsWith("~/")) {
    const parts = fromFile.split("/");
    const srcIndex = parts.lastIndexOf("src");
    if (srcIndex < 0) return undefined;
    base = path.posix.join(parts.slice(0, srcIndex + 1).join("/"), specifier.slice(2));
  } else {
    return undefined;
  }
  base = base.replace(/\.js$/, "");
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (known.has(candidate)) return candidate;
  }
  return undefined;
}

export async function staticScan(files: FileAccess, include: string[], helperGlobs: string[] = []): Promise<StaticScan> {
  const all = await files.list(include);
  const sources = all.filter((file) => SOURCE_EXT.test(file));
  const known = new Set(sources);
  const texts = new Map<string, string>();
  for (const file of sources) texts.set(file, await files.read(file));

  const sameFolderImports = (file: string): string[] => {
    const text = texts.get(file) ?? "";
    const out = new Set<string>([file]);
    for (const specifier of importsOf(text).values()) {
      if (!specifier.startsWith("./")) continue;
      const resolved = resolveSpecifier(file, specifier, known);
      if (resolved && path.posix.dirname(resolved) === path.posix.dirname(file)) out.add(resolved);
    }
    return [...out].sort();
  };

  const perFile = new Map<string, RawRoute[]>();
  for (const [file, text] of texts) {
    const routes = findRoutes(text);
    if (routes.length) perFile.set(file, routes);
  }
  const componentFile = (file: string, component?: string) => {
    if (!component) return undefined;
    const specifier = importsOf(texts.get(file) ?? "").get(component.split(".")[0]);
    if (!specifier) return texts.get(file)?.match(new RegExp(`(?:function|const)\\s+${component}\\b`)) ? file : undefined;
    return resolveSpecifier(file, specifier, known);
  };

  const routes: ScannedRoute[] = [];
  const mounted = new Set<string>();
  const emit = (file: string, prefix: string, depth: number) => {
    if (depth > 4) return;
    for (const raw of perFile.get(file) ?? []) {
      if (raw.path === "*" ) continue;
      const full = raw.path.startsWith("/") ? raw.path : path.posix.join(prefix || "/", raw.path);
      const target = componentFile(file, raw.component);
      if (full.endsWith("/*") && target && perFile.has(target) && target !== file) {
        mounted.add(target);
        emit(target, full.slice(0, -2), depth + 1);
      }
      routes.push({ path: full, file, line: raw.line, component: raw.component, sourceFiles: target ? sameFolderImports(target) : [file] });
    }
  };
  for (const file of perFile.keys()) {
    if (perFile.get(file)!.some((route) => route.path.startsWith("/"))) emit(file, "", 0);
  }
  // Files with only relative routes that nothing mounted: keep them, unresolved.
  for (const [file, raws] of perFile) {
    if (mounted.has(file) || raws.some((route) => route.path.startsWith("/"))) continue;
    for (const raw of raws) if (raw.path !== "*") routes.push({ path: `?/${raw.path}`, file, line: raw.line, component: raw.component, sourceFiles: [file] });
  }
  const unique = new Map<string, ScannedRoute>();
  for (const route of routes) if (!unique.has(route.path)) unique.set(route.path, route);

  const docs: StaticScan["docs"] = [];
  for (const file of await files.list(DOC_FILES)) {
    const headings = (await files.read(file)).split("\n").filter((line) => /^#{1,2}\s/.test(line)).map((line) => line.replace(/^#+\s*/, "").trim());
    docs.push({ file, headings: headings.slice(0, 40) });
  }

  const helpers: StaticScan["helpers"] = [];
  for (const file of helperGlobs.length ? await files.list(helperGlobs) : []) {
    const text = await files.read(file);
    const exports = [...text.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    if (exports.length) helpers.push({ file, exports });
  }

  const locatorHints: StaticScan["locatorHints"] = [];
  for (const [file, text] of texts) {
    const testIds = [...new Set([...text.matchAll(/data-testid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
    const ariaLabels = [...new Set([...text.matchAll(/aria-label\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
    if (testIds.length || ariaLabels.length) locatorHints.push({ file, testIds, ariaLabels });
  }

  const strings = new Set<string>();
  for (const text of texts.values()) for (const s of uiStrings(text)) strings.add(s);

  return { schemaVersion: 1, routes: [...unique.values()].sort((a, b) => a.path.localeCompare(b.path)), docs, helpers, locatorHints, uiStrings: [...strings].sort() };
}
