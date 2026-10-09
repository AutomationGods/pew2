/**
 * The sidebar drawer.
 *
 * Connected apps across the top, their conversations below. Switching app
 * refilters the list in place, so moving between Claude, Codex and your own app
 * is one tap and never a new screen.
 *
 * This is a push drawer: the conversation slides right to reveal it rather than
 * being covered, so the two surfaces read as one moving layout instead of a
 * modal layer. The panel itself is therefore static — App owns the motion.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { useAppTheme, useThemeStyles } from "../appearance";
import { motion, nativeMotionEasings, type AppTheme } from "../theme";
import { MenuRow } from "./MenuRow";
import { agentChoices, projectChoices, projectPathFromChoice } from "./drawerMenus";
import { touchSlop } from "./controls";
import { haptics } from "./haptics";
import { reconnectDialog } from "../reconnect";
import { HistorySkeleton } from "./Skeleton";
import { orderProvidersByRecency } from "../providerRecency";
import { formatHistoryMetadata } from "../historyMetadata";
import { recentSessionsForProvider } from "../sessionHistory";
import { useReducedMotion } from "./useReducedMotion";
import { useAppActive } from "./useAppActive";
import { AppearanceSheet } from "./AppearanceSheet";
import { projectLabel, sessionsInProject, type Project } from "../projects";
import { activitySummary, groupActivitySessions } from "../activitySessions";
import type { Provider, Session, Status } from "../useDaemon";

export const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.88, 380);

interface SidebarProps {
  open: boolean;
  providers: Provider[];
  sessions: Session[];
  activeProviderId?: string;
  activeSessionId?: string;
  onSelectProvider: (id: string) => void;
  onOpenSession: (id: string) => void;
  onOpenActivity: () => void;
  /**
   * Starts a conversation in `cwd`.
   *
   * Always called with one: the only button that reaches this is beside a named
   * project, which is what replaced a header button that could not say where
   * its chat would go.
   */
  onNewConversation: (cwd: string) => void;
  /** Projects the selected agent has worked in, newest first. */
  projects: Project[];
  /** The chosen one, or undefined for all of them. */
  selectedProjectPath?: string;
  /** `undefined` clears the filter back to every project. */
  onSelectProject: (path?: string) => void;
  /** Host and port, retained for accessible detail and the Forget confirmation. */
  machineLabel: string;
  /** True when reached via a relay, so it works away from home. */
  machineRemote: boolean;
  connectionStatus: Status;
  onUnpair: () => void;
  /**
   * A newer pew2 the paired computer has not got, when there is one.
   *
   * Absent for the ordinary case, including a machine that updates itself — by
   * the time anyone could read a notice about it, it has already happened.
   */
  update?: { latest: string; automatic: boolean };
  /**
   * Agents are still answering what conversations they hold. Without this the
   * drawer claims "No conversations yet" for the first seconds after connect —
   * a false empty state on machines with plenty of history.
   */
  historyLoading?: boolean;
  /** Honor the phone's Reduce Motion accessibility preference. */
  reduceMotion?: boolean;
}

/**
 * The line that installs or updates pew2 on a desktop.
 *
 * Duplicated from the README rather than fetched: it is shown when the machine
 * is behind, which is exactly when nothing about that machine can be relied on
 * to answer. It has been stable across every release, and a wrong command here
 * is worse than no notice at all.
 */
const INSTALL_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/KenKaiii/pew2/main/install.sh | sh";

const MAX_STAGGERED_ROWS = 14;
const ROW_STAGGER_MS = motion.rowStagger;
const ROW_REVEAL_MS = motion.rowReveal;

/**
 * The dot beside a conversation title: working, or finished while you were
 * away.
 *
 * Two states rather than one because they ask for opposite things. A pulsing
 * dot says "still going, nothing to do"; a solid one says "this came back, go
 * read it". Both are on the row you would tap anyway, so noticing and acting
 * are the same gesture.
 */
function SessionStatus({
  busy,
  unread,
  reduceMotion,
  paused,
}: {
  busy: boolean;
  unread: boolean;
  reduceMotion: boolean;
  /**
   * The drawer is shut, or the app is not on screen. Rows stay mounted through
   * both, so without this they keep pulsing where nobody can see them.
   */
  paused: boolean;
}) {
  const styles = useThemeStyles(makeStyles);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pulse.stopAnimation();
    if (!busy || reduceMotion || paused) {
      pulse.setValue(1);
      return;
    }
    // Never fully out: a dot that disappears reads as a rendering glitch in a
    // list, where the neighbouring rows have no dot at all.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: motion.sessionPulse,
          easing: nativeMotionEasings.inOutQuad,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.sessionPulse,
          easing: nativeMotionEasings.inOutQuad,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, pulse, reduceMotion, paused]);

  // Working outranks unread: a session that answered and was prompted again
  // from the desktop is, right now, working.
  if (!busy && !unread) return null;
  return (
    <Animated.View
      // Spoken, because colour alone carries this for everyone else. The role
      // is what makes a bare View announce its label at all, and it matches the
      // connection dot above.
      accessibilityRole="text"
      accessibilityLabel={busy ? "Working" : "New reply"}
      style={[
        styles.statusDot,
        busy ? styles.statusWorking : styles.statusUnread,
        busy && { opacity: pulse },
      ]}
    />
  );
}

interface SessionRowProps {
  session: Session;
  index: number;
  active: boolean;
  reduceMotion: boolean;
  /** Nothing in this row should be animating: shut drawer, or app in the
   *  background. */
  paused: boolean;
  /** Takes the id, so one stable callback serves every row. */
  onOpen: (id: string) => void;
}

const SessionRow = memo(function SessionRow({
  session,
  index,
  active,
  reduceMotion,
  paused,
  onOpen,
}: SessionRowProps) {
  const styles = useThemeStyles(makeStyles);
  // Only the initial viewport cascades. Rows virtualized in later should appear
  // immediately, rather than fading under the user's finger while they scroll.
  //
  // And only rows that mount while the drawer is actually open. The list is
  // remounted by its `key` whenever the app or the project changes, and both of
  // those resolve on their own schedule — the daemon naming a provider a moment
  // after launch remounts it behind a shut drawer. The cascade then ran against
  // nothing, and pulling the drawer out a beat later caught it mid-flight: rows
  // arriving one after another under a panel that was itself still moving. That
  // is the drawer's intermittent stagger, and why it came and went with how
  // quickly the daemon answered.
  //
  // Captured at mount rather than read each render, because this must not
  // become true *later*: recomputing it when the drawer opens would re-run the
  // effect below and replay the cascade on open, every open — which is the
  // thing being fixed, arrived at from the other side.
  //
  // A lazy initial state rather than a ref, because this is read *during*
  // render. The `useRef(new Animated.Value(…))` idiom used elsewhere in this
  // file is a stable box whose identity never changes, so reading it in render
  // is harmless; this one derives from a prop, which is the case the rule is
  // actually about. Lazy state is the sanctioned way to freeze one at mount,
  // and it stays correct under the React Compiler's memoisation.
  const [revealing] = useState(() => !paused);
  const shouldAnimate = !reduceMotion && revealing && index < MAX_STAGGERED_ROWS;
  const entrance = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;

  useEffect(() => {
    entrance.stopAnimation();
    if (!shouldAnimate) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      delay: index * ROW_STAGGER_MS,
      duration: ROW_REVEAL_MS,
      easing: nativeMotionEasings.outCubic,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, index, shouldAnimate]);

  // Memoised against the row's own re-renders, not just the list's. `paused`
  // flips the instant the drawer opens, so `memo` above cannot spare these rows
  // that particular render — the one render that lands on the frame the slide
  // starts. Only the dot at the end of the row actually reads `paused`; this is
  // date arithmetic for a line that has not changed, and it ran once per
  // mounted row before the drawer had moved a pixel.
  const metadata = useMemo(() => formatHistoryMetadata(session), [session]);
  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [7, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={session.title}
        accessibilityState={{ selected: active }}
        onPress={() => onOpen(session.id)}
        style={({ pressed }) => [
          styles.session,
          active && styles.sessionActive,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.sessionLine}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {session.title}
          </Text>
          {/* The agent keeps running when you leave a conversation, so the
              drawer is where you find out what is still going and what came
              back while you were elsewhere. */}
          <SessionStatus
            busy={session.busy === true}
            unread={session.unread === true}
            reduceMotion={reduceMotion}
            paused={paused}
          />
        </View>
        {metadata ? (
          <Text style={styles.sessionMeta} numberOfLines={1}>
            {metadata}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

function SidebarView({
  open,
  providers,
  sessions,
  activeProviderId,
  activeSessionId,
  onSelectProvider,
  onOpenSession,
  onOpenActivity,
  onNewConversation,
  projects,
  selectedProjectPath,
  onSelectProject,
  machineLabel,
  machineRemote,
  connectionStatus,
  onUnpair,
  update,
  historyLoading = false,
  reduceMotion = false,
}: SidebarProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const appActive = useAppActive();
  // Nothing in a row should be animating when the drawer is shut behind the
  // conversation, or when the app is not on screen at all. Resolved once here
  // rather than per row, so the whole list shares one subscription.
  const rowsStill = !open || !appActive;
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  // The four derived lists below are memoised on what they actually read, not
  // because any one of them is slow on its own, but because of *when* they run.
  //
  // Opening the drawer flips `open`, and that render lands on the same frame
  // the slide starts. The translation itself is on the UI thread and does not
  // care, but a sort, two filters and a scan of every session held the JS
  // thread through the first frames of it — exactly when the list below is also
  // laying out its rows. That is the hitch the drawer had on the way out, and
  // the reason it was intermittent: it cost nothing until enough conversations
  // had accumulated to be worth sorting.
  //
  // Now `open` changing re-renders a component whose data is all cache hits.

  // Most recently used app first, so the daily driver is never off-screen
  // behind apps that were tried once.
  const orderedProviders = useMemo(
    () => orderProvidersByRecency(providers, sessions),
    [providers, sessions],
  );
  // Ready to use right now. `providers` also carries the ones that are known but
  // unusable — not installed, or missing an API key — and they are shown greyed
  // out rather than hidden, so the total would overstate what works.
  const availableCount = useMemo(
    () => providers.filter((provider) => provider.available).length,
    [providers],
  );
  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === activeProviderId),
    [providers, activeProviderId],
  );
  const agentMenu = useMemo(
    () => agentChoices(orderedProviders, activeProviderId),
    [orderedProviders, activeProviderId],
  );
  const activityGroups = useMemo(() => groupActivitySessions(sessions), [sessions]);
  const activityCount =
    activityGroups.needsYou.length + activityGroups.working.length + activityGroups.ready.length;

  const selectedProject = useMemo(
    () => projects.find((project) => project.path === selectedProjectPath),
    [projects, selectedProjectPath],
  );
  // Narrowed before the recent-work cap, or a project's older conversations
  // would be cut away by a window they were never in.
  const visible = useMemo(
    () => recentSessionsForProvider(sessionsInProject(sessions, selectedProject), activeProviderId),
    [sessions, selectedProject, activeProviderId],
  );
  const projectMenu = useMemo(
    () => projectChoices(projects, selectedProjectPath),
    [projects, selectedProjectPath],
  );

  // Stable, so the memoised rows below actually bail out. Built per render it
  // was a new function for every row on every render, which defeats the memo
  // entirely: opening the drawer re-rendered the whole first batch — eighteen
  // rows, per `initialNumToRender` below — and re-ran each one's date
  // formatting, on the frame the slide begins.
  const openRow = useCallback(
    (id: string) => {
      haptics.tap();
      onOpenSession(id);
    },
    [onOpenSession],
  );
  // The dot beside the title carries this at a glance; a screen reader gets
  // the sentence, and Settings shows it in words under "This computer".
  const connectionLabel =
    connectionStatus === "online"
      ? "Healthy connection"
      : connectionStatus === "connecting"
        ? "Connecting…"
        : "Connection interrupted";
  const connectionColor =
    connectionStatus === "online"
      ? theme.color.success
      : connectionStatus === "connecting"
        ? theme.color.textDim
        : theme.color.danger;

  return (
    <View
      style={[styles.panel, { width: DRAWER_WIDTH }]}
      pointerEvents={open ? "auto" : "none"}
      // Hidden from assistive tech while closed: it is still mounted, but it is
      // not on screen and must not be reachable by swipe navigation.
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    >
      <View
        style={[
          styles.panelInner,
          {
            paddingTop: insets.top + theme.headerInset,
            paddingBottom: insets.bottom + theme.space(4),
          },
        ]}
      >
          <View style={styles.header}>
            {/* The dot rides with the title rather than sitting in the footer:
                connection state is the first thing to check when the drawer is
                opened, and it belongs to the list of apps it describes. */}
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{machineLabel}</Text>
              {/* The count is of apps that can actually be tapped, not of
                  manifests: the list also holds agents that are installed but
                  missing a key, or not installed at all, and counting those
                  would promise more than the drawer delivers. Hidden entirely at
                  zero — a lone "0" beside the title reads as an error state
                  rather than as "still looking".

                  Placed after the dot, not between it and the title: the dot is
                  the title's own status and the two belong together, so pushing
                  them a full gap apart would break that pairing. */}
              <View
                style={[styles.connectionDot, { backgroundColor: connectionColor }]}
                accessibilityRole="text"
                accessibilityLabel={`${connectionLabel} to ${machineLabel}. ${
                  machineRemote ? "Reachable from anywhere." : "Same network only."
                }`}
              />
              {availableCount > 0 && (
                <View
                  style={styles.headerCount}
                  accessibilityRole="text"
                  // Without this it is announced as a bare number after the
                  // title, which says nothing about what was counted.
                  accessibilityLabel={`${availableCount} ${availableCount === 1 ? "agent" : "agents"} ready`}
                >
                  <Text style={styles.headerCountText}>{availableCount}</Text>
                </View>
              )}
            </View>
            {/* Settings, pushed to the far edge as a bar button is. The dot
                says a new version is waiting without putting the notice in
                the list itself. */}
            <Pressable
              accessibilityRole="button"
              // Same condition as the dot: a self-installing update needs nothing
              // from the user, so it is neither badged nor announced here.
              accessibilityLabel={update && !update.automatic ? "Settings. A pew2 update is available." : "Settings"}
              hitSlop={touchSlop(32, theme.size.touch)}
              onPress={() => { haptics.tap(); setAppearanceOpen(true); }}
              style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.4 }]}
            >
              <Icon name="settings-outline" size={21} color={theme.color.textDim} />
              {update && !update.automatic ? <View style={styles.headerBadge} /> : null}
            </Pressable>
            {/* No button here. A "new chat" in the drawer header sits above the
                app chips and the project selector both, so it could only mean
                "somewhere" — it started one wherever the agent last was, which
                is misleading precisely when it matters. The action now lives
                beside the project it applies to. */}
          </View>

          {/* What the list below shows: which agent, which project. One grouped
              block of two rows, each opening the system menu, where a strip of
              chips (its end always cut off) sat beside a form-field dropdown. */}
          {orderedProviders.length > 0 && (
            <View style={styles.filterGroup}>
              <MenuRow
                caption="Agent"
                value={activeProvider?.name ?? "Choose"}
                choices={agentMenu}
                onSelect={onSelectProvider}
                accessibilityHint="Choose which agent to show conversations from and start new ones with"
                valueMarker={activeProvider?.color ?? theme.color.textFaint}
              />
              {projects.length > 0 && (
                <MenuRow
                  divided
                  caption="Project"
                  value={projectLabel(selectedProject)}
                  choices={projectMenu}
                  onSelect={(id) => onSelectProject(projectPathFromChoice(id))}
                  accessibilityHint="Choose which project to show conversations from and start new ones in"
                />
              )}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open activity. ${activitySummary(activityGroups)}.`}
            onPress={() => {
              haptics.tap();
              onOpenActivity();
            }}
            style={({ pressed }) => [
              styles.activityShortcut,
              pressed && styles.activityShortcutPressed,
            ]}
          >
            <View style={styles.activityIcon}>
              <View style={[styles.connectionDot, { backgroundColor: activityGroups.needsYou.length > 0 ? theme.color.warning : theme.color.success }]} />
            </View>
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>Activity</Text>
              <Text style={styles.activityMeta} numberOfLines={1}>
                {activitySummary(activityGroups)}
              </Text>
            </View>
            {activityCount > 0 ? (
              <View
                style={[
                  styles.activityCount,
                  activityGroups.needsYou.length > 0 && styles.activityCountAttention,
                ]}
              >
                <Text
                  style={[
                    styles.activityCountText,
                    activityGroups.needsYou.length > 0 && styles.activityCountTextAttention,
                  ]}
                >
                  {activityCount}
                </Text>
              </View>
            ) : null}
            <Icon name="chevron-forward" size={18} color={theme.color.textFaint} />
          </Pressable>

          {/* "Recent sessions", not "Chat history": the list is capped at the
              newest conversations, and calling that history promises an archive
              it does not have — the Project row above is what reaches the
              rest. */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Recent sessions</Text>

            {/* Only with a project chosen, and that is the whole point: a "new
                chat" button with no project named cannot say where the chat
                would go, which is exactly the ambiguity this replaces. Here it
                is unambiguous — the project is on screen directly above it. */}
            {selectedProject && (
              <NewChatChip
                project={selectedProject}
                onPress={() => onNewConversation(selectedProject.path)}
              />
            )}
          </View>

          {/* A provider can hold hundreds of conversations. Rendering them
              all in a ScrollView was the stall when switching to a well-used
              app; a windowed list mounts only what is on screen. */}
          <FlatList
            // Remount on app selection: this resets a previously scrolled list
            // to its newest session and gives each new row one clean entrance.
            key={`${activeProviderId ?? "all-providers"}:${selectedProjectPath ?? "all"}`}
            style={styles.sessions}
            contentContainerStyle={styles.sessionsContent}
            showsVerticalScrollIndicator={false}
            data={visible}
            extraData={`${activeSessionId ?? ""}:${reduceMotion}`}
            keyExtractor={(session) => session.id}
            initialNumToRender={18}
            maxToRenderPerBatch={18}
            windowSize={9}
            removeClippedSubviews
            ListEmptyComponent={
              historyLoading ? (
                <HistorySkeleton />
              ) : (
                <Text style={styles.empty}>
                  {selectedProject
                    ? `No conversations in ${selectedProject.name} yet. Send a message to start one there.`
                    : "No conversations yet. Send a message to start one."}
                </Text>
              )
            }
            renderItem={({ item: session, index }) => (
              <SessionRow
                session={session}
                index={index}
                active={session.id === activeSessionId}
                reduceMotion={reduceMotion}
                paused={rowsStill}
                onOpen={openRow}
              />
            )}
          />

          {/* Always reachable, including offline and with no discovered agents.
              Outside the scrolling list and Settings so recovery is easy to find. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forget connection & reconnect"
            accessibilityHint="Asks before disconnecting this phone and opening the pairing scanner."
            onPress={() => {
              haptics.tap();
              const dialog = reconnectDialog(machineLabel, () => {
                haptics.warned();
                onUnpair();
              });
              Alert.alert(dialog.title, dialog.message, dialog.buttons);
            }}
            style={({ pressed }) => [styles.reconnect, pressed && styles.settingsRowPressed]}
          >
            <Text style={styles.reconnectText}>Forget connection & reconnect</Text>
          </Pressable>

          {/* Appearance, computer details, and updates stay in Settings. */}
          <AppearanceSheet
            visible={appearanceOpen}
            onClose={() => setAppearanceOpen(false)}
          >
            <View style={styles.settingsSection}>
              <Text style={styles.settingsLabel}>This computer</Text>
              <View style={styles.settingsGroup}>
                <View
                  style={styles.settingsRow}
                  accessibilityRole="text"
                  accessibilityLabel={`${machineLabel}. ${connectionLabel}. ${
                    machineRemote ? "Reachable from anywhere." : "Same network only."
                  }`}
                >
                  <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
                  <View style={styles.settingsCopy}>
                    <Text style={styles.settingsTitle} numberOfLines={1}>{machineLabel}</Text>
                    <Text style={styles.settingsMeta} numberOfLines={1}>
                      {connectionLabel} · {machineRemote ? "Reachable from anywhere" : "Same network only"}
                    </Text>
                  </View>
                </View>

                {/* The App Store handles the app; this is the daemon on the desk,
                    which has no screen of its own to say it with. */}
                {update ? (
                  update.automatic ? (
                    // Installing itself, and it will restart at the next quiet
                    // moment. Said so a restart is never a surprise, but with
                    // nothing to tap, because there is nothing to do.
                    <View style={[styles.settingsRow, styles.settingsRowDivided]}>
                      <Text style={styles.settingsMeta}>Updating pew2…</Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`pew2 ${update.latest} is available for ${machineLabel}. How to update.`}
                      onPress={() => {
                        haptics.tap();
                        Alert.alert(
                          `pew2 ${update.latest} is available`,
                          // The command itself, not a description of it: whoever
                          // reads this is holding the phone and will be typing it
                          // out on the other machine.
                          `This computer can't update itself, so run this on ${machineLabel}:\n\n${INSTALL_COMMAND}`,
                          [{ text: "OK" }],
                        );
                      }}
                      style={({ pressed }) => [
                        styles.settingsRow,
                        styles.settingsRowDivided,
                        pressed && styles.settingsRowPressed,
                      ]}
                    >
                      <Text style={[styles.settingsTitle, styles.settingsAccent]}>
                        Update to pew2 {update.latest}
                      </Text>
                      <Icon name="chevron-forward" size={14} color={theme.color.textFaint} />
                    </Pressable>
                  )
                ) : null}

              </View>
            </View>
          </AppearanceSheet>
      </View>
    </View>
  );
}

/**
 * "+ New conversation", beside the heading, once a project is chosen.
 *
 * It appears and disappears with the project selection, so it arrives rather
 * than pops: scale and fade from the right, anchored where it sits. An element
 * that materialises next to a heading the user was already reading is the kind
 * of change that gets noticed as a glitch and not as an offer.
 *
 * Entrance only. It unmounts with the selection, and animating that out would
 * mean holding a button that no longer applies to what the list is showing.
 */
function NewChatChip({ project, onPress }: { project: Project; onPress: () => void }) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);

  const reduceMotion = useReducedMotion();
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    const animation = Animated.spring(enter, {
      toValue: 1,
      ...motion.chipSpring,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, enter]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
          // Slides in from the right edge it is pinned to, so the growth reads
          // as coming from outside the panel rather than out of the heading.
          { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ],
      }}
    >
      {/* A plain tinted text button, as a section action is on iOS. The glass
          pill drew a third button shape into a drawer that already had two. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`New conversation in ${project.name}`}
        hitSlop={touchSlop(theme.space(1))}
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        style={({ pressed }) => [styles.newChip, pressed && styles.newChipPressed]}
      >
        <Icon name="add" size={17} color={theme.color.accent} weight="semibold" />
        <Text style={styles.newChipText}>New conversation</Text>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(theme: AppTheme) {
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
;

// Memoized: a streamed chunk re-renders the screen many times a second, and
// none of those chunks change anything here.
export const Sidebar = memo(SidebarView);
