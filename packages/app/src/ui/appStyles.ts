/** Styles for the conversation screen and the drawer layout around it. */
import { StyleSheet } from "react-native";
import type { AppTheme } from "../theme";

export function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
  // The drawer paints its own panel. Matching the conversation canvas here
  // removes the stray drawer-coloured band beneath the closed pane/home area.
  root: { flex: 1, backgroundColor: theme.color.bg },
  // Rounded on all corners: once it slides it is a card over the drawer, and
  // the curve is what makes the two planes legible.
  pane: {
    flex: 1,
    backgroundColor: theme.color.bg,
    borderRadius: theme.radius.pane,
    overflow: "hidden",
    // Must sit above the drawer, which is absolutely positioned and would
    // otherwise paint over this pane and swallow its touches.
    zIndex: 1,
    // A cast shadow is what stops the two dark planes merging into one at the
    // seam once the pane slides clear.
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: -8, height: 0 },
    elevation: 16,
  },
  paneInner: { flex: 1 },
  body: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(1),
    // Bar buttons are full touch targets with the glyph centred inside, so the
    // inset is narrower than the gutter: the glyph lands back on the gutter
    // rail the drawer header uses.
    paddingHorizontal: theme.gutter - (theme.size.touch - 22) / 2,
    paddingVertical: theme.headerInset,
    // No hairline: the frosted CanvasCover already separates bar from thread,
    // and iOS drops the bar's shadow line while content scrolls under it.
    backgroundColor: theme.color.bg,
  },
  topBarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
  },
  navFade: { zIndex: 2 },
  conversationIdentity: { flex: 1, minWidth: 0, alignItems: "center" },
  // Fills the menu's invisible button so the whole title is the target, not
  // only the glyphs; the 44pt floor keeps a short title easy to hit.
  titleContent: { minHeight: theme.size.touch, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.space(1), maxWidth: "100%" },
  // Shrinks before the chevron does, so a long title truncates instead of
  // pushing the menu cue off the end.
  conversationTitle: {
    color: theme.color.text,
    fontSize: theme.font.body,
    fontWeight: "600",
    flexShrink: 1,
  },
  conversationContext: {
    color: theme.color.textDim,
    fontSize: theme.font.tiny,
    marginTop: 1,
  },
  barSlot: { width: theme.size.touch, height: theme.size.touch },
  topBarSpacer: { flex: 1 },
  // On the glyph's top-right corner: the button box is a 44pt target around a
  // 22pt glyph, so the box's own corner would float the dot off the icon.
  statusDot: {
    position: "absolute",
    top: (theme.size.touch - 22) / 2 - 3,
    right: (theme.size.touch - 22) / 2 - 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: theme.color.bg,
  },


  greetingLift: { flex: 1 },
  conversationLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.gutter,
    paddingBottom: theme.size.composerCollapsed,
  },
  greeting: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-end",
    gap: theme.space(3),
    paddingHorizontal: theme.gutter,
    paddingBottom: theme.size.composerCollapsed + theme.space(36),
  },
  workspaceContext: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.groupedSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.separator,
  },
  workspaceMarker: { width: 8, height: 28, borderRadius: 4 },
  workspaceCopy: { flex: 1, minWidth: 0 },
  workspaceProvider: { color: theme.color.text, fontSize: theme.font.body, fontWeight: "600" },
  workspaceProject: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: 2 },
  workspaceStatus: { fontSize: theme.font.tiny, fontWeight: "600" },
  greetingText: {
    color: theme.color.textDim,
    fontSize: theme.font.body,
    lineHeight: theme.line.body,
    textAlign: "left",
  },
  greetingHeadline: {
    color: theme.color.text,
    fontFamily: theme.display.editorial,
    fontSize: theme.font.greeting,
    lineHeight: theme.line.greeting,
    letterSpacing: -0.4,
  },

  // One consistent gap between the thread and the composer, kept when the
  // keyboard is open so the last message never hides behind the input.
  dock: {
    paddingHorizontal: theme.gutter,
    paddingTop: theme.space(2),
  },
  dockOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 3,
  },
  // Behind the composer, filling the wrapper it shares with it.
  dockCover: { zIndex: 0 },

  // Rides above the composer it belongs to, at the gutter it shares with the
  // thread, so it lands over the conversation rather than over the input.

  jumpToEnd: {
    position: "absolute",
    right: theme.gutter,
    bottom: "100%",
    marginBottom: theme.space(2),
    zIndex: 1,
    // Opaque disc behind the glass. Every other glass control sits over the
    // dock's blur; this one floats on the bare transcript, so without a fill
    // the words it covers read straight through the arrow.
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.size.chip / 2,
  },

  // A narrow strip: wide enough to catch a deliberate edge swipe, too narrow to
  // interfere with anything the conversation itself does.
  edgeSwipe: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: theme.space(5),
    zIndex: 4,
  },
  });
}
