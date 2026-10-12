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
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { useAppTheme, useThemeStyles } from "../appearance";
import { motion } from "../theme";
import { MenuRow } from "./MenuRow";
import { agentChoices, projectChoices, projectPathFromChoice } from "./drawerMenus";
import { touchSlop } from "./controls";
import { haptics } from "./haptics";
import { reconnectDialog } from "../reconnect";
import { HistorySkeleton } from "./Skeleton";
import { orderProvidersByRecency } from "../providerRecency";
import { recentSessionsForProvider } from "../sessionHistory";
import { useReducedMotion } from "./useReducedMotion";
import { useAppActive } from "./useAppActive";
import { AppearanceSheet } from "./AppearanceSheet";
import { projectLabel, sessionsInProject, type Project } from "../projects";
import { activitySummary, groupActivitySessions } from "../activitySessions";
import type { Provider, Session, Status } from "../useDaemon";
import { SessionRow } from "./SessionRow";
import { makeStyles } from "./sidebarStyles";

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

// Memoized: a streamed chunk re-renders the screen many times a second, and
// none of those chunks change anything here.
export const Sidebar = memo(SidebarView);
