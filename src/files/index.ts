import { glob, readFile, realpath } from "node:fs/promises";
import path from "node:path";

/**
 * The only module that reads target files (QD9). Every path is resolved to its real path
 * and checked against the answer-key globs before any byte is read.
 */
export class AnswerKeyError extends Error {
  constructor(readonly file: string) {
    super(`refusing to read answer-key file ${file}`);
  }
}

export interface FileAccess {
  root: string;
  isAnswerKey(relative: string): boolean;
  read(relative: string): Promise<string>;
  /** Files matching `patterns`, minus answer-key files, relative to root, sorted. */
  list(patterns: string[]): Promise<string[]>;
}

const IGNORED_DIRS = ["node_modules", ".git", "dist", "build", "magpi-tests", "coverage", ".next"];

export function fileAccess(root: string, answerKey: string[]): FileAccess {
  const absoluteRoot = path.resolve(root);
  const isAnswerKey = (relative: string) =>
    answerKey.some((pattern) => path.matchesGlob(relative.split(path.sep).join("/"), pattern));

  async function checked(relative: string): Promise<string> {
    const absolute = path.resolve(absoluteRoot, relative);
    const rel = path.relative(absoluteRoot, absolute);
    if (rel.startsWith("..")) throw new Error(`path outside target: ${relative}`);
    if (isAnswerKey(rel)) throw new AnswerKeyError(rel);
    const real = await realpath(absolute);
    const realRoot = await realpath(absoluteRoot);
    const realRel = path.relative(realRoot, real);
    if (isAnswerKey(realRel)) throw new AnswerKeyError(realRel);
    return absolute;
  }

  return {
    root: absoluteRoot,
    isAnswerKey,
    async read(relative) {
      return readFile(await checked(relative), "utf8");
    },
    async list(patterns) {
      const found = new Set<string>();
      for await (const entry of glob(patterns, {
        cwd: absoluteRoot,
        withFileTypes: true,
        exclude: (dirent) => IGNORED_DIRS.includes(dirent.name),
      })) {
        if (!entry.isFile() && !entry.isSymbolicLink()) continue;
        const rel = path.relative(absoluteRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/");
        if (!isAnswerKey(rel)) found.add(rel);
      }
      return [...found].sort();
    },
  };
}
