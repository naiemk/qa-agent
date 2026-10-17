#!/usr/bin/env node
// CLI entry point. Runs the TypeScript sources through tsx, like Magpi's bins.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve("tsx")).href;
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, "../src/cli/run.ts");

const result = spawnSync(process.execPath, ["--import", tsxLoader, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
