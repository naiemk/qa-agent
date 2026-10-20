#!/usr/bin/env node
// Process entry for the isolated GitHub App. Does not load Magpi Test src/.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve("tsx")).href;
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, "../src/index.ts");

const result = spawnSync(
  process.execPath,
  ["--import", tsxLoader, entry, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: path.join(here, "..") },
);
process.exit(result.status ?? 1);
