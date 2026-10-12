#!/usr/bin/env node
// Structural and repeatability checks for this local documentation renderer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const wiki = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(wiki, '../../../..');
const args = process.argv.slice(2);
assert.equal(args[0], '--snapshot');
assert.equal(args[2], '--expect-sha256');
assert.equal(args.length, 4);
const snapshot = JSON.parse(fs.readFileSync(path.resolve(root, args[1]), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const run = argv => spawnSync(process.execPath, [path.join(wiki, 'tools/generate.mjs'), ...argv], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
function pageFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? pageFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function fingerprint() {
  return hash(pageFiles(path.join(wiki, 'entities/generated')).concat(pageFiles(path.join(wiki, 'meta/generated'))).sort().map(file => `${file}:${hash(fs.readFileSync(file))}`).join('\n'));
}
const before = fingerprint();
for (let i = 0; i < 2; i++) {
  const result = run(args);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.pages_created.length, 0);
  assert.equal(report.pages_updated.length, 0);
  const staleReport = fs.readFileSync(path.join(wiki, 'meta/generated/stale-output.md'), 'utf8');
  assert.equal(staleReport, staleReport.trimEnd() + '\n', 'Stale report has an extra blank line at EOF');
  assert.equal(fingerprint(), before);
}
const badHash = run([args[0], args[1], args[2], '0'.repeat(64)]);
assert.notEqual(badHash.status, 0);
assert.match(badHash.stderr, /SHA-256 mismatch/);
assert.equal(fingerprint(), before);
const manifestFile = path.join(wiki, 'tools/.verification-manifest.json');
const manifestRelative = path.relative(root, manifestFile);
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.gg/wiki-graph/input-manifest.json'), 'utf8'));
fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, snapshot_sha256: '0'.repeat(64) }), { flag: 'wx' });
try {
  const rejectedSnapshot = run([...args, '--manifest', manifestRelative]);
  assert.notEqual(rejectedSnapshot.status, 0);
  assert.match(rejectedSnapshot.stderr, /Manifest raw snapshot SHA-256 mismatch/);
  const sourceHashes = { ...manifest.source_sha256 };
  sourceHashes[Object.keys(sourceHashes)[0]] = '0'.repeat(64);
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, source_sha256: sourceHashes }));
  const rejectedSource = run([...args, '--manifest', manifestRelative]);
  assert.notEqual(rejectedSource.status, 0);
  assert.match(rejectedSource.stderr, /Manifest\/source SHA-256 mismatch/);
} finally {
  fs.unlinkSync(manifestFile);
}
assert.equal(fingerprint(), before);
const collision = path.join(wiki, 'entities/generated/ownership-verification-fixture.md');
fs.writeFileSync(collision, '# Human-owned verification fixture\n', { flag: 'wx' });
try {
  const rejected = run(args);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Refusing non-owned output/);
  assert.equal(fs.readFileSync(collision, 'utf8'), '# Human-owned verification fixture\n');
} finally {
  fs.unlinkSync(collision); // Only this test-created fixture; never stale generated output.
}
assert.equal(fingerprint(), before);
const pages = new Map(pageFiles(path.join(wiki, 'entities/generated')).concat(pageFiles(path.join(wiki, 'meta/generated'))).map(file => [file, fs.readFileSync(file, 'utf8')]));
function verifyReferences(references) {
  let maxLines = 0;
  const exists = file => references.has(file) || fs.existsSync(file);
  // Preserved history still has to be a valid, bounded, linked generated page.
  // Its old graph records must not contribute to the current snapshot's totals.
  for (const [file, body] of references) {
    maxLines = Math.max(body.split('\n').length, maxLines);
    assert(body.split('\n').length <= 300, file);
    assert(body.startsWith('---\n'), file);
    assert(body.includes('<!-- generated-by: pew2-ast-reference-v1; do not edit -->'), file);
    for (const match of body.matchAll(/\[\[library\/knowledge\/private\/codebase-graph\/([^\]]+)\]\]/g)) assert(exists(path.join(wiki, `${match[1]}.md`)), `${file}: ${match[1]}`);
    for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) assert(exists(path.resolve(path.dirname(file), decodeURIComponent(match[1]))), `${file}: ${match[1]}`);
  }
  const current = new Set();
  const nodeIds = new Set(snapshot.nodes.map(n => n.id));
  assert.equal(nodeIds.size, snapshot.nodes.length, 'Duplicate current node ID');
  for (const n of snapshot.nodes) {
    const file = path.join(wiki, `entities/generated/${hash(n.id)}.md`);
    const body = references.get(file);
    assert.equal(typeof body, 'string', `Missing current node page: ${file}`);
    for (const [key, value] of Object.entries({ graph_node_id: n.id, path: n.source_file, source_location: n.source_location, graph_kind: n.kind, symbol_kind: n.kind === 'type_alias' ? 'type' : n.kind })) assert(body.includes(`${key}: ${JSON.stringify(value)}\n`), `${file}: ${key}`);
    assert.match(body, /source_sha256: "[a-f0-9]{64}"/);
    assert.match(body, /last_commit_hash: ("[a-f0-9]{40}"|null)/);
    current.add(file);
    // Only overflow pages linked by a CURRENT entity belong to this graph. Old
    // overflow pages can survive even when their node now needs fewer pages.
    for (const match of body.matchAll(/\[\[library\/knowledge\/private\/codebase-graph\/(meta\/generated\/relations-[a-f0-9]{64}-\d+)\]\]/g)) {
      assert(match[1].startsWith(`meta/generated/relations-${hash(n.id)}-`), `${file}: wrong relationship owner`);
      const overflow = path.join(wiki, `${match[1]}.md`);
      const contents = references.get(overflow);
      assert.equal(typeof contents, 'string', `Missing current relationship page: ${overflow}`);
      assert(contents.includes(`graph_node_id: ${JSON.stringify(n.id)}\n`), overflow);
      assert(contents.includes('report_type: "graph-relationships"\n'), overflow);
      current.add(overflow);
    }
  }
  let relationships = 0;
  for (const file of current) {
    const body = references.get(file);
    assert(body.includes(`graph_snapshot_sha256: ${JSON.stringify(args[3])}\n`), `${file}: wrong current graph`);
    relationships += [...body.matchAll(/^- (incoming|outgoing) /gm)].length;
  }
  const expected = snapshot.links.length + snapshot.links.filter(e => nodeIds.has(e.target)).length;
  assert.equal(relationships, expected, 'All current edges must appear as outgoing, and internal edges also incoming');
  return { relationships, maxLines, current };
}
const verified = verifyReferences(pages);
// Regression: removed nodes, archived nodes (even with the SAME graph hash),
// and no-longer-linked overflow pages must not inflate current graph counts.
const example = [...verified.current].find(file => /^- (incoming|outgoing) /m.test(pages.get(file)));
assert(example, 'This graph must include a relationship for the history regression');
const historical = new Map(pages);
const staleFile = path.join(wiki, 'entities/generated/verification-stale.md');
for (const file of [staleFile, path.join(wiki, 'meta/generated/history-verification.md'), path.join(wiki, `meta/generated/relations-${hash(snapshot.nodes[0].id)}-9999.md`)]) {
  assert(!historical.has(file), `Regression fixture collision: ${file}`);
  historical.set(file, pages.get(example));
}
assert.equal(verifyReferences(historical).relationships, verified.relationships);
const brokenHistory = new Map(historical);
brokenHistory.set(staleFile, '# Not a valid generated history page\n');
assert.throws(() => verifyReferences(brokenHistory), /verification-stale/);
const missingCurrentEdge = new Map(historical);
missingCurrentEdge.set(example, pages.get(example).replace(/^- (incoming|outgoing) .*\n/m, ''));
assert.throws(() => verifyReferences(missingCurrentEdge), /All current edges/);
assert.equal(fingerprint(), before);
console.log(JSON.stringify({ checks: ['two idempotent runs', 'stale report EOF', 'invalid graph hash rejection', 'manifest snapshot hash rejection', 'manifest source hash rejection', 'human ownership rejection', 'all current node pages', 'all current relationship occurrences', 'preserved history structure and links', 'stale/history/overflow regression', 'missing current edge rejection', 'all wiki link targets', 'source hash and git metadata fields', '300-line cap'], pages: pages.size, entities: snapshot.nodes.length, relationshipOccurrences: verified.relationships, maxLines: verified.maxLines, outputFingerprint: before }, null, 2));
