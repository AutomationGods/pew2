#!/usr/bin/env node
// Local documentation tooling. No dependencies, network, shell, or source execution.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const OWNER = 'pew2-ast-reference-v1';
const MARK = `<!-- generated-by: ${OWNER}; do not edit -->`;
const VERSION = '0.7.160';
const wiki = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = fs.realpathSync(path.resolve(wiki, '../../../..'));
const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const assert = (test, message) => { if (!test) throw new Error(message); };
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 2) {
  assert(['--snapshot', '--expect-sha256', '--manifest'].includes(args[i]) && args[i + 1] && !opts[args[i]], 'Usage: node generate.mjs --snapshot <repo-relative-path> [--manifest <repo-relative-path>] [--expect-sha256 <canonical-graph-hash>]');
  opts[args[i]] = args[i + 1];
}
assert(opts['--snapshot'] && (!opts['--expect-sha256'] || /^[a-f0-9]{64}$/.test(opts['--expect-sha256'])), 'Snapshot required; expected canonical hash must be SHA-256 if supplied');
function contained(base, relative) {
  assert(typeof relative === 'string' && relative && !path.isAbsolute(relative) && !relative.includes('\\') && !relative.includes('\0'), 'Invalid relative path');
  const full = path.resolve(base, relative);
  assert(full.startsWith(base + path.sep), `Path escapes allowed root: ${relative}`);
  let cursor = base;
  for (const part of path.relative(base, full).split(path.sep)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) || (() => { try { return fs.lstatSync(cursor).isSymbolicLink(); } catch { return false; } })()) {
      assert(!fs.lstatSync(cursor).isSymbolicLink(), `Symlink rejected: ${relative}`);
    }
  }
  return full;
}
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const snapshotPath = contained(root, opts['--snapshot']);
const snapshotBytes = fs.readFileSync(snapshotPath);
const snapshot = JSON.parse(snapshotBytes);
const manifestRelative = opts['--manifest'] || '.gg/wiki-graph/input-manifest.json';
const manifestPath = contained(root, manifestRelative);
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
assert(manifest.schema_version === 1 && manifest.engine === `@deeplake/hivemind@${VERSION}` && manifest.cloud_upload === false && manifest.external_agent_runs === false, 'Invalid local-only build manifest provenance');
assert(contained(root, manifest.snapshot_file) === snapshotPath && manifest.snapshot_sha256 === sha(snapshotBytes), 'Manifest raw snapshot SHA-256 mismatch; rerun safe extraction');
assert(manifest.source_sha256 && typeof manifest.source_sha256 === 'object' && Array.isArray(manifest.warnings) && manifest.warnings.every(w => typeof w === 'string'), 'Malformed source manifest');
assert(snapshot.graph?.generator === 'hivemind-graph' && snapshot.graph.schema_version === 1 && snapshot.observation?.generator_version === VERSION, 'Unrecognized graph generator/schema/version');
assert(fs.realpathSync(snapshot.observation.worktree_path) === root, 'Snapshot belongs to another worktree');
const git = argv => execFileSync('git', ['--no-pager', '-C', root, ...argv], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' } });
assert(git(['rev-parse', 'HEAD']).trim() === snapshot.graph.commit_sha, 'Snapshot HEAD differs from repository HEAD; extract again');
assert(Array.isArray(snapshot.nodes) && Array.isArray(snapshot.links), 'Missing graph arrays');
const { directed, multigraph, graph, nodes, links } = snapshot;
const graphHash = sha(canonical({ directed, multigraph, graph, nodes, links }));
if (opts['--expect-sha256']) assert(graphHash === opts['--expect-sha256'], 'Canonical graph SHA-256 mismatch');
const date = snapshot.observation.ts.slice(0, 10);
assert(/^\d{4}-\d{2}-\d{2}$/.test(date), 'Missing observation date');
const sorted = [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byId = new Map();
const files = new Map();
const warnings = manifest.warnings;
const cacheWarnings = [];
for (const n of sorted) {
  assert(typeof n.id === 'string' && !byId.has(n.id), 'Missing/duplicate node ID');
  assert(typeof n.label === 'string' && typeof n.kind === 'string' && /^L\d+(?:-\d+)?$/.test(n.source_location), `Invalid node: ${n.id}`);
  assert(typeof n.exported === 'boolean', `Missing export flag: ${n.id}`);
  byId.set(n.id, n);
  if (!files.has(n.source_file)) files.set(n.source_file, { nodes: [] });
  files.get(n.source_file).nodes.push(n);
}
const nodeCore = n => Object.fromEntries(['id', 'kind', 'label', 'language', 'source_file', 'source_location', 'exported', 'signature'].filter(k => k in n).map(k => [k, n[k]]));
const cacheBase = path.relative(root, path.resolve(path.dirname(snapshotPath), '../.cache'));
for (const [file, info] of files) {
  const bytes = fs.readFileSync(contained(root, file));
  info.hash = sha(bytes);
  assert(manifest.source_sha256[file] === info.hash, `Manifest/source SHA-256 mismatch: ${file}`);
  const cache = readJSON(contained(root, `${cacheBase}/${info.hash}.json`));
  assert(cache.schema === 1 && cache.content_sha256 === info.hash && cache.extraction?.source_file === file, `No matching extraction cache for current source: ${file}`);
  const extracted = new Map(cache.extraction.nodes.map(n => [n.id, n]));
  assert(extracted.size === info.nodes.length, `Cache/snapshot node count differs: ${file}`);
  for (const n of info.nodes) assert(canonical(nodeCore(n)) === canonical(nodeCore(extracted.get(n.id) || {})), `Cache/snapshot node mismatch: ${n.id}`);
  const lineCount = bytes.toString('utf8').split('\n').length;
  for (const n of info.nodes) assert(Number(n.source_location.match(/\d+$/)[0]) <= lineCount, `Source location beyond EOF: ${n.id}`);
  cacheWarnings.push(...cache.extraction.parse_errors);
  const metadata = git(['--literal-pathspecs', 'log', '-1', '--format=%H%x00%an%x00%aI', '--', file]).trimEnd().split('\0');
  info.commit = metadata[0] || null;
  info.author = metadata[1] || null;
  info.committedAt = metadata[2] || null;
}
assert(files.size === snapshot.observation.source_files_extracted && snapshot.observation.source_files_skipped === 0, 'Incomplete file coverage');
assert(canonical(Object.keys(manifest.source_sha256).sort()) === canonical([...files.keys()].sort()), 'Manifest and graph source sets differ');
assert(cacheWarnings.length === warnings.length, 'Manifest/cache parser warning count differs');
const adjacency = new Map(sorted.map(n => [n.id, []]));
for (const e of links) {
  assert(typeof e.source === 'string' && typeof e.target === 'string' && typeof e.relation === 'string' && ['EXTRACTED', 'RESOLVED'].includes(e.confidence), 'Invalid/unsupported graph edge');
  assert(byId.has(e.source), `Unknown edge source: ${e.source}`);
  adjacency.get(e.source).push({ direction: 'outgoing', edge: e, other: e.target });
  if (byId.has(e.target)) adjacency.get(e.target).push({ direction: 'incoming', edge: e, other: e.source });
}
// All dynamic Markdown text is HTML-entity escaped; YAML scalars use JSON quoting.
const text = value => String(value).replace(/[&<>[\]`*_{}\\|#!\r\n]/g, c => `&#${c.charCodeAt(0)};`);
const json = value => JSON.stringify(value);
const filename = n => `entities/generated/${sha(n.id)}.md`;
const wikilink = rel => `[[library/knowledge/private/codebase-graph/${rel.slice(0, -3)}]]`;
const link = (rel, label) => `${wikilink(rel)} — ${text(label)}`;
const markdownLink = (from, rel, label) => `[${text(label)}](${path.posix.relative(path.posix.dirname(from), rel).split('/').map(encodeURIComponent).join('/')})`;
const citation = n => `${text(n.source_file)}:${text(n.source_location.slice(1))}`;
const outputs = new Map();
const entityIds = new Map();
function front(type, title, extra = {}) {
  const fields = { type, title, status: 'developing', created: date, updated: date, tags: [type, 'automated-graph'], related: [], sources: [], generated_by: OWNER, extraction: 'hivemind-tree-sitter', graph_snapshot_sha256: graphHash, graph_commit_hash: graph.commit_sha, engine: '@deeplake/hivemind', engine_version: VERSION, partial_scan: true, graph_reconciled: false, ...extra };
  return '---\n' + Object.entries(fields).map(([k, v]) => Array.isArray(v) && v.length ? `${k}:\n${v.map(x => `  - ${json(x)}`).join('\n')}` : `${k}: ${json(v)}`).join('\n') + `\n---\n${MARK}\n\n`;
}
function add(rel, content) {
  assert(!outputs.has(rel), `Duplicate output: ${rel}`);
  assert(content.split('\n').length <= 280, `Page exceeds safety budget: ${rel}`);
  outputs.set(rel, content.trimEnd() + '\n');
}
const chunks = (array, size) => Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, (i + 1) * size));
const sourceRecords = [];
for (const n of sorted) {
  const info = files.get(n.source_file);
  const ext = path.extname(n.source_file).slice(1);
  const language = ({ mjs: 'js', cjs: 'js' })[ext] || ext;
  const kind = n.kind === 'type_alias' ? 'type' : n.kind;
  const entityType = ['function', 'class', 'module'].includes(kind) ? kind : (n.exported ? 'exported-symbol' : null);
  const rel = filename(n);
  entityIds.set(rel, n.id);
  let body = front('entity', n.label, { entity_type: entityType, graph_kind: n.kind, symbol_kind: kind, classification_note: entityType ? 'Graph declaration classification only; no domain-role inference' : 'No exact canonical entity subtype; retain actual graph kind', path: n.source_file, language, graph_language: n.language, graph_node_id: n.id, source_location: n.source_location, source_sha256: info.hash, last_commit_hash: info.commit, last_commit_author: info.author, last_commit_date: info.committedAt, exported: n.exported, depends_on: [], used_by: [], tested_by: [], sources: [`${n.source_file}:${n.source_location.slice(1)}`] });
  body += `# ${text(n.label)}\n\n## Extracted declaration\n\n- Graph kind: ${text(n.kind)}; normalized symbol kind: ${kind}; exported: ${n.exported}. (${citation(n)})\n`;
  if (n.signature) body += `- Extracted signature: ${text(n.signature)}. (${citation(n)})\n`;
  body += `- Source SHA-256: ${info.hash}. Verified against the local extraction cache.\n- Last source commit: ${info.commit || 'uncommitted/no source history'}; ${text(info.author || 'unknown')}; ${text(info.committedAt || 'unknown')}. Git metadata does not imply current bytes are committed.\n\n## Graph relationships\n\nRelations below are graph records, not inferred runtime behavior. Citations locate the originating declaration, not necessarily the exact call/import expression. Empty dependency fields are not a claim of no dependencies; the complete typed graph relations follow.\n\n`;
  const relations = adjacency.get(n.id).map(({ direction, edge, other }) => {
    const target = byId.get(other);
    const endpoint = target ? link(filename(target), target.label) : `${text(other)} (external/unresolved; no wiki target)`;
    return `- ${direction} ${text(edge.relation)} [${edge.confidence}]: ${endpoint}; evidence: ${citation(byId.get(edge.source))}.`;
  }).sort();
  const groups = chunks(relations, 150);
  if (!groups.length) body += 'No incident edges recorded in this snapshot.\n';
  else if (groups.length === 1) body += groups[0].join('\n') + '\n';
  else {
    groups.forEach((group, i) => {
      const page = `meta/generated/relations-${sha(n.id)}-${i + 1}.md`;
      body += `- ${link(page, `Relationships ${i + 1}/${groups.length}`)}\n`;
      add(page, front('meta', `${n.label}: relationships ${i + 1}`, { parent: wikilink(rel), report_type: 'graph-relationships', graph_node_id: n.id }) + `# Relationships ${i + 1}/${groups.length}\n\nParent: ${link(rel, n.label)}\n\n${group.join('\n')}\n`);
    });
  }
  body += `\n## Provenance\n\n${wikilink('meta/generated/catalog.md')} records engine version, graph hash, limitations and reproduction instructions.\n`;
  add(rel, body);
}
for (const [file, info] of [...files].sort(([a], [b]) => a < b ? -1 : 1)) sourceRecords.push(`- ${text(file)}: SHA-256 ${info.hash}; last commit ${info.commit || 'none'}, ${text(info.author || 'unknown')}, ${text(info.committedAt || 'unknown')}.`);
const catalogPages = chunks(sorted, 150);
catalogPages.forEach((group, i) => add(`meta/generated/catalog-${i + 1}.md`, front('meta', `Graph catalog ${i + 1}`, { report_type: 'graph-catalog' }) + `# Graph catalog ${i + 1}/${catalogPages.length}\n\n${markdownLink(`meta/generated/catalog-${i + 1}.md`, 'meta/generated/catalog.md', 'Catalog overview')}\n\n${group.map(n => `- ${markdownLink(`meta/generated/catalog-${i + 1}.md`, filename(n), n.label)} — ${text(n.kind)}; ${citation(n)}.`).join('\n')}\n`));
const sourcePages = chunks(sourceRecords, 100);
sourcePages.forEach((group, i) => add(`meta/generated/sources-${i + 1}.md`, front('meta', `Verified sources ${i + 1}`, { report_type: 'source-provenance' }) + `# Verified sources ${i + 1}\n\n${markdownLink(`meta/generated/sources-${i + 1}.md`, 'meta/generated/catalog.md', 'Catalog overview')}\n\n${group.join('\n')}\n`));
add('meta/generated/catalog.md', front('meta', 'Automated AST graph reference', { report_type: 'graph-catalog', node_count: nodes.length, edge_count: links.length, source_count: files.size }) + `# Automated AST graph reference\n\n${nodes.length} atomic node pages; ${links.length} graph edges; ${files.size} current source files verified by SHA-256 against extraction caches.\n\n## Catalog\n\n${catalogPages.map((_, i) => `- ${markdownLink('meta/generated/catalog.md', `meta/generated/catalog-${i + 1}.md`, `Node catalog ${i + 1}`)}`).join('\n')}\n\n## Source provenance\n\n${sourcePages.map((_, i) => `- ${markdownLink('meta/generated/catalog.md', `meta/generated/sources-${i + 1}.md`, `Source provenance ${i + 1}`)}`).join('\n')}\n\n## Reproduce locally\n\nRun from repository root; requires the real snapshot and its sibling extraction cache:\n\n\`\`\`sh\nnode library/knowledge/private/codebase-graph/tools/generate.mjs --snapshot ${opts['--snapshot']} --expect-sha256 ${graphHash}\n\`\`\`\n\nEngine: @deeplake/hivemind ${VERSION}; graph schema ${graph.schema_version}; canonical graph SHA-256 ${graphHash}. Snapshot file SHA-256 ${sha(snapshotBytes)}. Build manifest: ${text(manifestRelative)}; SHA-256 ${sha(manifestBytes)}. Its exact source-file set and all current source hashes are verified before rendering.\n\nThe supplied expected graph hash pins extracted records, not an independent authenticity signature. Current source hashes and cached AST declarations must match before any writes.\n\n## Limits\n\n- Real Hivemind/tree-sitter extraction completed; this deterministic renderer is not the canonical wiki driver. Global reconciliation has not run; partial_scan remains true.\n- No LLM, upload, install, shell, or source execution by this generator. No behavior narratives, domain-role inference, ADRs, or invented relationships.\n- This catalog covers nodes emitted by the engine, not all possible language constructs or unsupported source formats. A generated node is not necessarily an exported API.\n- Canonical entity types are assigned only where justified. Other nonexported declarations have a null entity_type and their actual graph_kind/symbol_kind; type_alias normalizes to type.\n- Confidence is preserved exactly; unresolved/external endpoints remain plain text. Cross-file resolution is not invented.\n- ${warnings.length} parser warning(s): ${warnings.map(text).join('; ') || 'none'}. Affected declarations may be incomplete.\n- Last-source git metadata is distinct from verified current working-tree bytes. Source hashing covers the ${files.size} extracted files, not the whole repository.\n- Existing curated prose remains manually authored; see [curated coverage](../coverage.md).\n- Removed outputs are never deleted; see [stale output report](stale-output.md).\n`);

const existing = new Map();
function scan(rel) {
  const dir = contained(wiki, rel);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    const full = contained(wiki, child);
    assert(entry.isFile() || entry.isDirectory(), `Unsupported output entry: ${child}`);
    if (entry.isDirectory()) scan(child);
    else {
      const content = fs.readFileSync(full, 'utf8'); // Read every existing target before considering replacement.
      assert(content.includes(MARK) && content.includes(`generated_by: "${OWNER}"`), `Refusing non-owned output: ${child}`);
      existing.set(child, content);
    }
  }
}
scan('entities/generated');
scan('meta/generated');
const stale = [...existing.keys()].filter(rel => !outputs.has(rel) && !rel.includes('/history-') && !rel.includes('/changes-') && !rel.includes('/stale-')).sort();
const staleGroups = chunks(stale, 150);
staleGroups.forEach((group, i) => add(`meta/generated/stale-${i + 1}.md`, front('meta', `Stale outputs ${i + 1}`, { report_type: 'stale-output' }) + `# Stale outputs\n\n> [!stale]\n> These preserved outputs are absent from the current generation plan. They are historical, not current graph evidence.\n\n${group.map(rel => `- ${wikilink(rel)}`).join('\n')}\n`));
add('meta/generated/stale-output.md', front('meta', 'Stale output report', { report_type: 'stale-output', stale_count: stale.length }) + `# Stale output report\n\n${stale.length} prior outputs absent from this generation plan. No deletions performed.\n\n${staleGroups.map((_, i) => `- ${wikilink(`meta/generated/stale-${i + 1}.md`)}`).join('\n')}\n`);
const changes = [];
const blockPattern = /\n<!-- change-breadcrumb:start -->[\s\S]*?<!-- change-breadcrumb:end -->\n/g;
for (const [rel, id] of entityIds) {
  const old = existing.get(rel);
  if (!old) continue;
  const oldBase = old.replace(blockPattern, '');
  if (oldBase === outputs.get(rel)) {
    outputs.set(rel, old); // Preserve prior contradiction breadcrumbs on idempotent runs.
    continue;
  }
  const archive = `meta/generated/history-${sha(old)}.md`;
  if (!existing.has(archive)) add(archive, oldBase + `\n> [!stale]\n> Historical generated reference; replaced by ${wikilink(rel)}. Not current source evidence.\n`);
  outputs.set(rel, outputs.get(rel) + `\n<!-- change-breadcrumb:start -->\n> [!contradiction]\n> Generated graph reference/provenance changed; no semantic contract inference. Previous evidence: ${wikilink(archive)}.\n<!-- change-breadcrumb:end -->\n`);
  changes.push({ old: archive, new: rel, reason: 'Generated graph reference/provenance changed; semantic contract not inferred', commit: graph.commit_sha, entity: id });
}
const journalPages = chunks(changes, 100);
journalPages.forEach((group, i) => add(`meta/generated/changes-${date}-${graphHash.slice(0, 12)}-${i + 1}.md`, front('meta', `Graph changes ${date} ${i + 1}`, { report_type: 'contradiction', contradiction_count: group.length }) + `# Graph reference changes\n\n${group.map(c => `- ${wikilink(c.old)} → ${wikilink(c.new)}: ${c.reason}.`).join('\n')}\n`));
// Preflight the entire plan and links before making any writes.
for (const [rel, content] of outputs) {
  contained(wiki, rel);
  assert(content.split('\n').length <= 300, `Page over 300 lines: ${rel}`);
  for (const match of content.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), decodeURIComponent(match[1])));
    assert(outputs.has(target) || fs.existsSync(contained(wiki, target)), `Dangling Markdown link from ${rel}: ${target}`);
  }
  for (const match of content.matchAll(/\[\[library\/knowledge\/private\/codebase-graph\/([^\]]+)\]\]/g)) {
    const target = `${match[1]}.md`;
    assert(outputs.has(target) || fs.existsSync(contained(wiki, target)), `Dangling link from ${rel}: ${target}`);
  }
}
// Recheck every source after rendering to avoid silently publishing a changed working tree.
for (const [file, info] of files) assert(sha(fs.readFileSync(contained(root, file))) === info.hash, `Source changed during generation: ${file}`);
assert(sha(fs.readFileSync(snapshotPath)) === sha(snapshotBytes) && sha(fs.readFileSync(manifestPath)) === sha(manifestBytes), 'Snapshot/manifest changed during generation; rerun after extraction completes');
const result = { pages_created: [], pages_updated: [], decisions_filed: [], contradictions_flagged: changes, meta_reports_written: [], notification_flags: [], entities_detected: sorted.map(n => ({ name: n.label, type: n.kind, file: n.source_file, line: Number(n.source_location.slice(1).split('-')[0]) })), gaps: cacheWarnings.map(w => ({ entity: 'parser', referenced_in: `${w.source_file}:${w.location}`, reason: w.message })), lint_findings: [], partial_scan: true };
for (const [rel, content] of outputs) {
  if (existing.get(rel) === content) continue;
  const full = contained(wiki, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, { flag: existing.has(rel) ? 'w' : 'wx' });
  result[existing.has(rel) ? 'pages_updated' : 'pages_created'].push(rel);
  if (rel.startsWith('meta/')) result.meta_reports_written.push(rel);
}
changes.forEach((change, i) => result.notification_flags.push({ severity: 'warning', title: 'Graph reference changed', page: change.new, report: `meta/generated/changes-${date}-${graphHash.slice(0, 12)}-${Math.floor(i / 100) + 1}.md` }));
console.log(JSON.stringify({ ...result, summary: { nodes: nodes.length, edges: links.length, sources: files.size, warnings: warnings.length, stale: stale.length, output_pages: outputs.size, graph_sha256: graphHash } }, null, 2));
