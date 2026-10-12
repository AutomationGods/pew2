/** Styles for the sidebar drawer and its conversation rows. */
import { StyleSheet } from "react-native";
import type { AppTheme } from "../theme";

export function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
  // "This computer" in Settings: an inset grouped list, matched to the accent
  // list above it in the same sheet so the two read as one settings screen.
  settingsSection: {
    paddingHorizontal: theme.space(4),
    paddingTop: theme.space(3),
    paddingBottom: theme.space(4),
  },
  settingsLabel: {
    color: theme.color.textDim,
    fontSize: theme.font.small,
    marginBottom: theme.space(2),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsGroup: {
    overflow: "hidden",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.separator,
    backgroundColor: theme.color.groupedSurface,
  },
  settingsRow: {
    minHeight: theme.size.touch,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
  },
  settingsRowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.separator,
  },
  settingsRowPressed: { backgroundColor: theme.color.surfacePressed },
  settingsCopy: { flex: 1, minWidth: 0, gap: 2 },
  settingsTitle: { flex: 1, color: theme.color.text, fontSize: theme.font.body },
  settingsMeta: { color: theme.color.textDim, fontSize: theme.font.tiny },
  // Not `danger`: being a version behind is not a problem.
  settingsAccent: { color: theme.color.accent },
  reconnect: {
    minHeight: theme.size.touch + theme.space(3),
    marginHorizontal: theme.gutter,
    marginTop: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.danger,
    backgroundColor: theme.color.groupedSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  reconnectText: {
    color: theme.color.danger,
    fontSize: theme.font.body,
    fontWeight: "600",
    textAlign: "center",
  },
  headerBadge: {
    position: "absolute",
    top: 4,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.accent,
  },

  // The drawer is the lower layer: it stays put while the conversation slides
  // right to reveal it, so it needs no transform of its own.
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: theme.color.drawer,
    // Curved on the inner edge — the side the conversation slides off — so the
    // two read as cards in one stack rather than a panel behind a card.
    borderTopRightRadius: theme.radius.pane,
    borderBottomRightRadius: theme.radius.pane,
    overflow: "hidden",
    // The canvas behind this panel is nearly its own colour, so once the drawer
    // is fully out the corners have nothing to read against. This rim draws
    // them, at the same weight as every other glass edge in the app. Only on the
    // curved side: the other three meet the screen edge, where a line would be
    // an outline around the whole app rather than the shape of this card.
    borderRightWidth: 1,
    borderRightColor: theme.color.separator,
  },
  panelInner: { flex: 1, paddingBottom: theme.space(4) },

  header: {
    flexDirection: "row",
    alignItems: "center",
    // Same gutter and the same row height as the conversation's top bar, so
    // the title and the hamburger beside it share one baseline.
    paddingHorizontal: theme.gutter,
    height: theme.size.control,
    // One step, shared by every gap down this column.
    marginBottom: theme.sectionGap,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(2),
  },
  // Sized from its own text rather than given a fixed width, so a two-digit
  // count cannot clip. `minWidth` keeps a single digit from looking pinched.
  headerCount: {
    minWidth: 24,
    paddingHorizontal: theme.space(1.5),
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.controlFill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCountText: {
    color: theme.color.textDim,
    fontFamily: theme.display.semibold,
    fontSize: theme.font.tiny,
    textAlign: "center",
  },
  headerAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    // Pushed to the far edge as a bar button is, leaving the title and its
    // status together on the left.
    marginLeft: "auto",
  },
  // Colour is the whole message, so it needs no glyph and no label beside it.
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: {
    color: theme.color.text,
    fontFamily: theme.display.bold,
    fontSize: theme.font.title,
    letterSpacing: 0.4,
  },

  // The agent and project rows: one inset grouped block, as in Settings.
  filterGroup: {
    marginHorizontal: theme.gutter,
    marginTop: theme.space(1),
    overflow: "hidden",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.separator,
    backgroundColor: theme.color.groupedSurface,
  },
  // Its own inset group, matching the Agent and Project block above it, so
  // the drawer reads as one settings-style list rather than three styles.
  activityShortcut: {
    minHeight: theme.size.touch,
    marginHorizontal: theme.gutter,
    marginTop: theme.space(3),
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    overflow: "hidden",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.separator,
    backgroundColor: theme.color.groupedSurface,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
  },
  activityShortcutPressed: { backgroundColor: theme.color.surfacePressed },
  activityIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCopy: { flex: 1, minWidth: 0, gap: 2 },
  activityTitle: { color: theme.color.text, fontSize: theme.font.body, fontWeight: "600" },
  activityMeta: { color: theme.color.textDim, fontSize: theme.font.tiny },
  activityCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: theme.space(1.5),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCountAttention: { backgroundColor: theme.color.accent },
  activityCountText: {
    color: theme.color.text,
    fontFamily: theme.display.semibold,
    fontSize: theme.font.tiny,
  },
  activityCountTextAttention: { color: theme.approval.allowText },
  pressed: { opacity: 0.6 },

  sectionLabel: {
    color: theme.color.textDim,
    fontFamily: theme.display.semibold,
    fontSize: theme.font.small,
    letterSpacing: 0.2,
  },
  // The heading and its action share a baseline: the button is what you do to
  // the section it names, so it belongs on that line rather than above the list.
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space(2),
    // On the text rail, not the box rail: "Recent sessions" lines up with the
    // row titles under it and "New conversation" with the chevrons in the cards above,
    // as a section header does in an iOS inset grouped list.
    paddingHorizontal: theme.gutter + theme.space(3),
    paddingTop: theme.sectionGap,
    paddingBottom: theme.space(2),
    // Always the chip's height, whether or not the chip is there. Otherwise
    // choosing a project grows this row and shoves the whole list down a
    // centimetre — the button's own spring lands on top of a jump.
    minHeight: theme.size.chip + theme.sectionGap + theme.space(2),
  },
  newChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1),
    height: theme.size.control,
  },
  newChipPressed: { opacity: 0.4 },
  newChipText: {
    color: theme.color.accent,
    fontSize: theme.font.body,
    fontWeight: "600",
  },

  sessions: { flex: 1 },
  // Two rails, shared with the cards above (Agent, Project, Activity): every
  // box edge, including the selected-row highlight, sits on the gutter, and
  // every line of text sits one row inset (12pt) inside it.
  sessionsContent: {
    paddingHorizontal: theme.gutter,
  },
  // One continuous list, as in Messages or Mail: hairline dividers and no
  // gaps; the selected row is a rounded fill on the same rail as the cards.
  session: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2.5),
    borderRadius: theme.radius.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.separator,
    gap: 2,
  },
  sessionActive: {
    backgroundColor: theme.color.selectedRow,
  },
  sessionLine: { flexDirection: "row", alignItems: "center", gap: theme.space(2) },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  // The agent's own accent: this is the agent doing something.
  statusWorking: { backgroundColor: theme.color.accent },
  statusUnread: { backgroundColor: theme.color.success },
  sessionTitle: {
    color: theme.color.text,
    fontSize: theme.font.body,
    lineHeight: theme.line.body,
    // Yields to the status dot rather than pushing it off the row.
    flexShrink: 1,
  },
  sessionMeta: { color: theme.color.textDim, fontSize: theme.font.tiny },
  empty: {
    color: theme.color.textDim,
    fontSize: theme.font.small,
    lineHeight: 20,
    paddingHorizontal: theme.space(3),
    paddingTop: theme.space(2),
  },
  });
}
