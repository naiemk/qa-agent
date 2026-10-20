import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Everything Magpi Test writes for a target lives under `<target>/magpi-tests/` (QD7). */
export interface TargetPaths {
  root: string;
  magpiTests: string;
  state: string;
  specs: string;
  pending: string;
  manual: string;
  scenariosMd: string;
  magpiHome: string;
  logs: string;
}

export function targetPaths(targetRoot: string): TargetPaths {
  const root = path.resolve(targetRoot);
  const magpiTests = path.join(root, "magpi-tests");
  const state = path.join(magpiTests, "state");
  return {
    root,
    magpiTests,
    state,
    specs: path.join(magpiTests, "specs"),
    pending: path.join(state, "pending"),
    manual: path.join(magpiTests, "manual"),
    scenariosMd: path.join(magpiTests, "scenarios"),
    magpiHome: path.join(state, "magpi-home"),
    logs: path.join(state, "logs"),
  };
}

export async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Whole-file write through a temp file, so an interrupted run never leaves half a record. */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, text);
  await rename(temp, file);
}

export async function readRecords<T>(dir: string): Promise<T[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const records: T[] = [];
  for (const name of names) {
    const record = await readJson<T>(path.join(dir, name));
    if (record) records.push(record);
  }
  return records;
}

export async function appendLine(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const { appendFile } = await import("node:fs/promises");
  await appendFile(file, `${JSON.stringify(value)}\n`);
}
