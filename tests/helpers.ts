import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** Copies a fixture target into a temp dir under tests/.tmp so writes never touch fixtures. */
export async function tempTarget(name: string): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const base = fileURLToPath(new URL("./.tmp/", import.meta.url));
  const { mkdir } = await import("node:fs/promises");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, `${name}-`));
  await cp(path.join(FIXTURES, name), root, { recursive: true });
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

export async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "magpi-test-"));
}
