#!/usr/bin/env node
/** Run the installed, reviewed Hivemind extractor locally; never invoke its CLI bootstrap. */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const engineVersion = "0.7.160";
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.."));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--hivemind-root") {
  console.error("Usage: node tools/build-graph.mjs --hivemind-root <installed @deeplake/hivemind directory>");
  process.exit(2);
}
const installed = realpathSync(args[1]);
const pkg = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
if (pkg.name !== "@deeplake/hivemind" || pkg.version !== engineVersion) {
  throw new Error(`Expected installed @deeplake/hivemind ${engineVersion}; review engine side effects before changing this pin.`);
}
const engines = readdirSync(join(installed, "bundle")).filter((name) => /^graph-[\w-]+\.js$/.test(name));
if (engines.length !== 1) throw new Error("Expected exactly one graph command bundle");
const ignored = new Set(["node_modules", "library", "dist", "build", "out", "coverage", "Pods", "vendor", "target"]);
const git = (...argv) => execFileSync("git", argv, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const contained = (base, path) => {
  const rel = relative(base, realpathSync(path));
  if (rel === ".." || rel.startsWith(`..${sep}`) || resolve(base, rel) !== realpathSync(path)) {
    throw new Error("Path escapes its expected directory");
  }
  return rel;
};
const sources = [...new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0"))]
  .filter((file) => file && !file.endsWith(".d.ts") && /\.(tsx?|jsx?|mjs|cjs|pyi?|go|rs|java|rb|cpp|cc|cxx|hpp|[ch])$/i.test(file))
  .filter((file) => !file.split("/").some((part, i, parts) => ignored.has(part) || (i < parts.length - 1 && part.startsWith("."))))
  .sort();
const sourceHashes = Object.fromEntries(sources.map((file) => {
  contained(root, join(root, file));
  return [file, sha256(readFileSync(join(root, file)))];
}));
const scratch = join(root, ".gg");
mkdirSync(scratch, { recursive: true });
contained(root, scratch);
const graphHome = join(scratch, "wiki-graph");
mkdirSync(graphHome, { recursive: true });
contained(root, graphHome);
const temporaryHome = mkdtempSync(join(tmpdir(), "pew2-wiki-graph-"));
try {
  mkdirSync(join(temporaryHome, ".deeplake"));
  writeFileSync(join(temporaryHome, ".deeplake", "graph-ignore.json"), JSON.stringify({ ignoreDirs: [...ignored], respectGitignore: true }));
  // Empty HOME keeps credentials and global preferences out of the child. Explicit
  // flags also disable cloud sync and docs host-agent spawning in the reviewed build.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("HIVEMIND_")));
  Object.assign(env, {
    HOME: temporaryHome, USERPROFILE: temporaryHome, NODE_OPTIONS: "",
    HIVEMIND_GRAPHS_HOME: graphHome, HIVEMIND_GRAPH_PUSH: "0", HIVEMIND_GRAPH_PULL: "0",
    HIVEMIND_DOCS_AUTO_FILE: join(temporaryHome, "disabled-auto.json"), HIVEMIND_TOKEN: "", HIVEMIND_ORG_ID: "",
  });
  const child = spawnSync(process.execPath, ["--input-type=module", "--eval",
    'import { pathToFileURL } from "node:url"; const { runBuildCommand } = await import(pathToFileURL(process.argv[1]).href); await runBuildCommand(["--cwd", process.argv[2]]);',
    join(installed, "bundle", engines[0]), root], {
    cwd: root, env, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Graph extraction failed (exit ${child.status}, signal ${child.signal})`);
  const snapshotPath = child.stdout.match(/^Snapshot:\s+(.+)$/m)?.[1];
  if (!snapshotPath) throw new Error("Extractor did not report a snapshot");
  contained(graphHome, snapshotPath);
  const raw = readFileSync(snapshotPath);
  const snapshot = JSON.parse(raw.toString("utf8"));
  if (snapshot.graph?.generator !== "hivemind-graph" || snapshot.graph?.commit_sha !== git("rev-parse", "HEAD").trim()
      || snapshot.observation?.worktree_path !== root || snapshot.observation?.generator_version !== engineVersion
      || snapshot.observation?.source_files_skipped !== 0 || snapshot.observation?.source_files_extracted !== sources.length) {
    throw new Error("Graph provenance or extraction coverage does not match this checkout");
  }
  for (const file of sources) {
    if (sha256(readFileSync(join(root, file))) !== sourceHashes[file]) throw new Error(`Source changed during extraction: ${file}`);
  }
  const manifest = {
    schema_version: 1, engine: `@deeplake/hivemind@${engineVersion}`,
    snapshot_file: relative(root, snapshotPath).split(sep).join("/"), snapshot_sha256: sha256(raw),
    source_sha256: sourceHashes,
    warnings: child.stderr.split("\n").map((line) => line.trim()).filter(Boolean),
    cloud_upload: false, external_agent_runs: false,
  };
  const manifestPath = join(graphHome, "input-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Input manifest: ${relative(root, manifestPath)} (${sources.length} source hashes)`);
} finally {
  // Only the fresh temporary directory allocated by this invocation is removed.
  rmSync(temporaryHome, { recursive: true, force: true });
}
