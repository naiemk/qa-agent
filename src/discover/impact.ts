import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Scenario } from "../scenario/types.ts";
import type { AppMap } from "./app-map.ts";

export interface Impact {
  schemaVersion: 1;
  base: string;
  changed: string[];
  areas: string[];
  paths: string[];
  rerunSpecs: string[];
  reexploreAreas: string[];
  unmapped: string[];
}

/** QD17: changed files → areas and paths via sourceFiles. Deterministic, report only. */
export function computeImpact(base: string, changed: string[], map: AppMap, scenarios: Scenario[]): Impact {
  const areas = new Set<string>();
  const paths = new Set<string>();
  const mapped = new Set<string>();
  for (const file of changed) {
    for (const area of map.areas) if (area.sourceFiles.includes(file)) (areas.add(area.id), mapped.add(file));
    for (const path of map.criticalPaths) if (path.sourceFiles.includes(file)) (paths.add(path.id), areas.add(path.area), mapped.add(file));
  }
  const accepted = scenarios.filter((s) => s.status === "accepted" && s.specFile);
  const rerunSpecs = accepted.filter((s) => (s.path && paths.has(s.path)) || areas.has(s.area)).map((s) => s.specFile!).sort();
  const reexploreAreas = [...areas].filter((area) => !accepted.some((s) => s.area === area)).sort();
  return {
    schemaVersion: 1,
    base,
    changed,
    areas: [...areas].sort(),
    paths: [...paths].sort(),
    rerunSpecs,
    reexploreAreas,
    unmapped: changed.filter((file) => !mapped.has(file)),
  };
}

export async function changedFiles(targetRoot: string, base: string): Promise<string[]> {
  const { stdout } = await promisify(execFile)("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: targetRoot });
  return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}
