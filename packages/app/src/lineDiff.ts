/**
 * A line diff of one file edit, for the tool card.
 *
 * Pure and Expo-free (`bun test` cannot parse React Native). Computed once,
 * when the tool update is read, and only the capped display lines are kept:
 * `oldText`/`newText` are whole files, and holding them per card per session
 * would make memory scale with the size of the repo being edited.
 */

export type DiffLineKind = "add" | "del" | "ctx" | "gap";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffSummary {
  path: string;
  added: number;
  removed: number;
  /** Changed lines with a little context, `gap` rows where unchanged runs were skipped. */
  lines: DiffLine[];
  /** True when `lines` was cut short, or the files were too big to align. */
  truncated: boolean;
}

/** Above this many DP cells the middle is shown as a straight replace. */
const MAX_CELLS = 250_000;
/** Lines of unchanged context around each change. */
const CONTEXT = 3;
/** Rows kept for display. */
const MAX_LINES = 300;
/** Characters kept per row. */
const MAX_LINE_CHARS = 240;

type Op = { kind: "add" | "del" | "ctx"; text: string };

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** LCS alignment of the middle section; falls back to delete-all/add-all when too large. */
function alignMiddle(a: readonly string[], b: readonly string[]): { ops: Op[]; exact: boolean } {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0 || n * m > MAX_CELLS) {
    return {
      ops: [...a.map((text): Op => ({ kind: "del", text })), ...b.map((text): Op => ({ kind: "add", text }))],
      exact: n === 0 || m === 0,
    };
  }
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "ctx", text: a[i] ?? "" });
      i++;
      j++;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      ops.push({ kind: "del", text: a[i] ?? "" });
      i++;
    } else {
      ops.push({ kind: "add", text: b[j] ?? "" });
      j++;
    }
  }
  for (; i < n; i++) ops.push({ kind: "del", text: a[i] ?? "" });
  for (; j < m; j++) ops.push({ kind: "add", text: b[j] ?? "" });
  return { ops, exact: true };
}

function clip(text: string): string {
  return text.length > MAX_LINE_CHARS ? `${text.slice(0, MAX_LINE_CHARS)}…` : text;
}

export function computeLineDiff(path: string, oldText: string, newText: string): DiffSummary {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;

  const middle = alignMiddle(a.slice(prefix, a.length - suffix), b.slice(prefix, b.length - suffix));
  const ops: Op[] = [
    ...a.slice(0, prefix).map((text): Op => ({ kind: "ctx", text })),
    ...middle.ops,
    ...a.slice(a.length - suffix).map((text): Op => ({ kind: "ctx", text })),
  ];

  let added = 0;
  let removed = 0;
  const keep = new Uint8Array(ops.length);
  ops.forEach((op, index) => {
    if (op.kind === "ctx") return;
    if (op.kind === "add") added++;
    else removed++;
    const from = Math.max(0, index - CONTEXT);
    const to = Math.min(ops.length - 1, index + CONTEXT);
    for (let k = from; k <= to; k++) keep[k] = 1;
  });

  const lines: DiffLine[] = [];
  let truncated = !middle.exact;
  let skipping = false;
  for (let index = 0; index < ops.length; index++) {
    if (!keep[index]) {
      skipping = true;
      continue;
    }
    if (lines.length >= MAX_LINES) {
      truncated = true;
      break;
    }
    if (skipping && lines.length > 0) lines.push({ kind: "gap", text: "" });
    skipping = false;
    const op = ops[index];
    if (op) lines.push({ kind: op.kind, text: clip(op.text) });
  }
  return { path, added, removed, lines, truncated };
}
