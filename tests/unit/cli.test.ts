import assert from "node:assert/strict";
import { test } from "node:test";
import { HELP, main, parseArgs } from "../../src/cli/main.ts";

test("help lists every architecture command and exits 0", async () => {
  const lines: string[] = [];
  assert.equal(await main(["--help"], { out: (l) => lines.push(l) }), 0);
  for (const command of ["init", "discover", "guided", "explore", "accept", "run", "impact"]) assert.match(HELP, new RegExp(`\\n  ${command}\\s`));
  assert.ok(lines.join("\n").includes("magpi-test"));
});

test("unknown command exits 2", async () => {
  const write = process.stderr.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    assert.equal(await main(["nope"]), 2);
  } finally {
    process.stderr.write = write;
  }
});

test("parseArgs handles flags, inline values, and positionals", () => {
  assert.deepEqual(parseArgs(["guided", "--target", "x", "a.md", "--force", "--max-turns=5"]), {
    command: "guided",
    flags: { target: "x", force: true, "max-turns": "5" },
    positional: ["a.md"],
  });
});
