/**
 * One tool call in the agent's turn: a single quiet row (kind glyph, title,
 * target, +/- counts, status), tapping open to its arguments, output and diff.
 *
 * Parsing and the diff live in `toolCalls.ts` / `lineDiff.ts`; this only draws.
 * Memoized on the card object, which `applyChunk` replaces only when an update
 * for this toolCallId lands — a burst of updates re-renders one cell, not the
 * thread. Expanded state is keyed on the tool id by the caller, so a recycled
 * cell never inherits another card's open state. Growing in place is left to
 * FlashList's `maintainVisibleContentPosition`; nothing here scrolls.
 */
import { memo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../theme";
import { diffCounts, type ToolCard } from "../toolCalls";
import type { DiffSummary } from "../lineDiff";
import type { ToolKind } from "../activity";
import { haptics } from "./haptics";
import { Led } from "./stage/Led";

const monospace = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

const KIND_ICON: Record<ToolKind, keyof typeof Ionicons.glyphMap> = {
  read: "document-text-outline",
  edit: "create-outline",
  delete: "trash-outline",
  move: "swap-horizontal-outline",
  search: "search-outline",
  execute: "terminal-outline",
  think: "bulb-outline",
  fetch: "globe-outline",
  other: "construct-outline",
};

function StatusGlyph({ status }: { status: ToolCard["status"] }) {
  if (status === "completed") return <Ionicons name="checkmark" size={14} color={theme.color.success} />;
  if (status === "failed") return <Ionicons name="alert-circle" size={14} color={theme.color.danger} />;
  return <ActivityIndicator size="small" color={theme.color.textDim} style={styles.spinner} />;
}

function DiffView({ diff }: { diff: DiffSummary }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel} numberOfLines={1}>
        {diff.path}
      </Text>
      <View style={styles.code}>
        {diff.lines.map((line, index) =>
          line.kind === "gap" ? (
            <Text key={index} style={[styles.mono, styles.gap]}>
              ⋯
            </Text>
          ) : (
            <Text
              key={index}
              style={[styles.mono, line.kind === "add" ? styles.add : line.kind === "del" ? styles.del : styles.ctx]}
            >
              {line.kind === "add" ? "+ " : line.kind === "del" ? "- " : "  "}
              {line.text}
            </Text>
          ),
        )}
        {diff.truncated && <Text style={[styles.mono, styles.gap]}>… diff truncated</Text>}
      </View>
    </View>
  );
}

function ToolCallCardView({ tool }: { tool: ToolCard }) {
  const [open, setOpen] = useState(false);
  const counts = diffCounts(tool);
  const hasDetail = !!(tool.input || tool.output || tool.diffs?.length);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          if (!hasDetail) return;
          haptics.tap();
          setOpen((value) => !value);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${tool.title}${tool.target ? `, ${tool.target}` : ""}, ${tool.status.replace("_", " ")}`}
        style={({ pressed }) => [styles.header, pressed && hasDetail && styles.pressed]}
      >
        <Ionicons name={KIND_ICON[tool.kind]} size={14} color={theme.color.textDim} />
        <Text style={styles.title} numberOfLines={1}>
          {tool.title}
          {tool.target && !tool.title.includes(tool.target.split("/").pop() ?? tool.target) ? <Text style={styles.target}>{`  ${tool.target}`}</Text> : null}
        </Text>
        {counts && (
          <View style={styles.counts}>
            <Led tone="plus" size={10} unlit>{`+${counts.added}`}</Led>
            <Led tone="minus" size={10} unlit>{`-${counts.removed}`}</Led>
          </View>
        )}
        <StatusGlyph status={tool.status} />
        {hasDetail && (
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={12} color={theme.color.textFaint} />
        )}
      </Pressable>
      {open && (
        <View style={styles.body}>
          {tool.input ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Input</Text>
              <Text style={[styles.mono, styles.code, styles.ctx]}>{tool.input}</Text>
            </View>
          ) : null}
          {tool.diffs?.map((diff, index) => <DiffView key={`${diff.path}:${index}`} diff={diff} />)}
          {tool.output ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Output</Text>
              <Text style={[styles.mono, styles.code, tool.status === "failed" ? styles.del : styles.ctx]}>
                {tool.output}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export const ToolCallCard = memo(ToolCallCardView, (before, after) => before.tool === after.tool);

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1.5),
    paddingHorizontal: theme.space(2.5),
    paddingVertical: theme.space(1.75),
  },
  pressed: { backgroundColor: theme.color.surfacePressed },
  title: { flex: 1, color: theme.color.text, fontSize: theme.font.small },
  target: { color: theme.color.textDim },
  counts: { flexDirection: "row", gap: theme.space(1) },
  spinner: { transform: [{ scale: 0.7 }], width: 14, height: 14 },
  body: {
    gap: theme.space(2),
    paddingHorizontal: theme.space(2.5),
    paddingBottom: theme.space(2.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    paddingTop: theme.space(2),
  },
  block: { gap: theme.space(1) },
  blockLabel: { color: theme.color.textDim, fontSize: theme.font.tiny, fontWeight: "600" },
  code: {
    backgroundColor: theme.color.bg,
    borderRadius: theme.radius.sm,
    padding: theme.space(2),
  },
  mono: { fontFamily: monospace, fontSize: theme.font.tiny, lineHeight: 16 },
  ctx: { color: theme.color.textDim },
  add: { color: theme.color.success, backgroundColor: "rgba(127,232,154,0.08)" },
  del: { color: theme.color.danger, backgroundColor: "rgba(255,107,96,0.08)" },
  gap: { color: theme.color.textFaint },
});
