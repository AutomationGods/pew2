/**
 * The agent's plan as a compact checklist in the turn. Each `plan` update
 * replaces the list (see `applyPlan`), so this always shows the latest one.
 * Collapsible to its header; open by default because it is the progress view.
 */
import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../theme";
import type { PlanEntry } from "../toolCalls";
import { haptics } from "./haptics";
import { Led } from "./stage/Led";

const GLYPH: Record<PlanEntry["status"], keyof typeof Ionicons.glyphMap> = {
  pending: "ellipse-outline",
  in_progress: "radio-button-on",
  completed: "checkmark-circle",
};

function PlanCardView({ plan }: { plan: PlanEntry[] }) {
  const [open, setOpen] = useState(true);
  const done = plan.filter((entry) => entry.status === "completed").length;
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          haptics.tap();
          setOpen((value) => !value);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Plan, ${done} of ${plan.length} done`}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Led tone="dim">PLAN</Led>
        <Text style={styles.count}>{`${done}/${plan.length}`}</Text>
        <View style={styles.spacer} />
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={12} color={theme.color.textFaint} />
      </Pressable>
      {open && (
        <View style={styles.list}>
          {plan.map((entry, index) => (
            <View key={index} style={styles.row}>
              <Ionicons
                name={GLYPH[entry.status]}
                size={14}
                color={
                  entry.status === "completed"
                    ? theme.color.success
                    : entry.status === "in_progress"
                      ? theme.color.accent
                      : theme.color.textFaint
                }
                style={styles.glyph}
              />
              <Text
                style={[
                  styles.entry,
                  entry.status === "completed" && styles.completed,
                  entry.status === "in_progress" && styles.active,
                ]}
              >
                {entry.content}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const PlanCard = memo(PlanCardView, (before, after) => before.plan === after.plan);

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1.5),
    paddingHorizontal: theme.space(2.5),
    paddingVertical: theme.space(1.75),
  },
  pressed: { backgroundColor: theme.color.surfacePressed },
  count: { color: theme.color.textDim, fontSize: theme.font.small },
  spacer: { flex: 1 },
  list: { gap: theme.space(1.25), paddingHorizontal: theme.space(2.5), paddingBottom: theme.space(2.5) },
  row: { flexDirection: "row", alignItems: "flex-start", gap: theme.space(1.5) },
  glyph: { marginTop: 2 },
  entry: { flex: 1, color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 19 },
  completed: { textDecorationLine: "line-through", color: theme.color.textFaint },
  active: { color: theme.color.text },
});
