import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { countPorcelain, workspaceStatus } from "./git.js";

describe("countPorcelain", () => {
  test("counts one entry per line", () => {
    expect(countPorcelain(" M src/a.ts\n?? src/b.ts\nA  src/c.ts\n")).toBe(3);
  });

  test("a clean tree is zero, not one empty line", () => {
    expect(countPorcelain("")).toBe(0);
    expect(countPorcelain("\n")).toBe(0);
  });
});

describe("workspaceStatus", () => {
  test("status overrides repository monitor hooks with an empty, non-executable value", async () => {
    const text = readFileSync(new URL("./git.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("git.ts", text, ts.ScriptTarget.Latest, true);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "workspaceStatus");
    if (!fn) throw new Error("Missing workspaceStatus");
    const code = ts.transpileModule(`(${fn.getText().replace(/^export /, "")})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    let calls = 0;
    const status: unknown = runInNewContext(code, {
      basename, countPorcelain,
      run: async (command: string, args: string[], options: { cwd: string }) => {
        calls++;
        expect(command).toBe("git");
        expect(args).toEqual(["-c", "core.fsmonitor=", "status", "--porcelain"]);
        expect(options.cwd).toBe("/workspace");
        return { stdout: " M file.ts\n" };
      },
    }, { timeout: 1000 });
    if (typeof status !== "function") throw new Error("Missing callable status");
    expect(await status("/workspace")).toMatchObject({ repo: true, uncommitted: 1 });
    expect(calls).toBe(1);
  });
  test("names the folder and reports the repo it is in", async () => {
    // This project is itself a git checkout, which is the case the bar shows.
    const status = await workspaceStatus(process.cwd());
    expect(status.repo).toBe(true);
    expect(status.folder).toBe(basename(process.cwd()));
    expect(status.uncommitted).toBeGreaterThanOrEqual(0);
  });

  test("a directory outside any repo is not an error", async () => {
    // An agent opened on a scratch folder is normal; the bar simply omits the
    // change count rather than the request failing.
    const scratch = mkdtempSync(join(tmpdir(), "pew2-git-"));
    const status = await workspaceStatus(scratch);
    expect(status.repo).toBe(false);
    expect(status.uncommitted).toBe(0);
    expect(status.folder.startsWith("pew2-git-")).toBe(true);
  });
});
