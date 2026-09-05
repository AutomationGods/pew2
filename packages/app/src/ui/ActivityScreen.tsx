import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import {
  activitySummary,
  groupActivitySessions,
  receiptSummary,
  type ActivitySessionGroups,
} from "../activitySessions";
import {
  isDenyApprovalOption,
  selectApprovalOptions,
  type ApprovalOption,
} from "../approvalOptions";
import type { Provider, Session, Status } from "../useDaemon";
import { CircleButton, touchSlop } from "./controls";
import { haptics } from "./haptics";

interface ActivityScreenProps {
  sessions: Session[];
  providers: Provider[];
  status: Status;
  reduceMotion: boolean;
  onClose: () => void;
  onNewConversation: () => void;
  onOpenSession: (id: string) => void;
  onAnswerPermission: (
    sessionId: string,
    requestId: string,
    optionId: string,
    deny: boolean,
  ) => void;
}

interface SessionCardProps {
  session: Session;
  provider?: Provider;
  onOpen: () => void;
}

function providerLabel(session: Session, provider?: Provider): string {
  return [provider?.name ?? session.providerId, session.folder].filter(Boolean).join(" · ");
}

function SessionIdentity({
  provider,
  busy,
}: {
  provider?: Provider;
  busy: boolean;
}) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  return <View style={[styles.statusMarker, { backgroundColor: busy ? theme.color.warning : provider?.color ?? theme.color.textFaint }]} />;
}

function WorkingCard({
  session,
  provider,
  onOpen,
  reduceMotion,
}: SessionCardProps & { reduceMotion: boolean }) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.title}. ${providerLabel(session, provider)}. Agent is working.`}
      onPress={() => {
        haptics.tap();
        onOpen();
      }}
      style={({ pressed }) => [styles.card, styles.workingCard, pressed && styles.cardPressed]}
    >
      <SessionIdentity provider={provider} busy />
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {session.title || "Untitled conversation"}
        </Text>
        <Text style={styles.metadata} numberOfLines={1}>
          {providerLabel(session, provider)}
        </Text>
        <View style={styles.liveRow}>
          {reduceMotion ? (
            <Ionicons name="ellipsis-horizontal" size={17} color={theme.color.textFaint} />
          ) : (
            <ActivityIndicator size="small" color={theme.color.textFaint} />
          )}
          <Text style={styles.liveText}>Agent is working…</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.color.textFaint} />
    </Pressable>
  );
}

function ReadyCard({ session, provider, onOpen }: SessionCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.title}. ${receiptSummary(session)}. Unread result.`}
      onPress={() => {
        haptics.select();
        onOpen();
      }}
      style={({ pressed }) => [styles.readyCard, pressed && styles.cardPressed]}
    >
      <View style={styles.readyIcon}>
        <Ionicons name="checkmark" size={22} color={theme.color.success} />
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.readyTitle} numberOfLines={1}>
          {session.title || "Untitled conversation"}
        </Text>
        <Text style={styles.metadata} numberOfLines={1}>
          Ready · {receiptSummary(session)} · {providerLabel(session, provider)}
        </Text>
      </View>
      <View style={styles.unreadDot} />
    </Pressable>
  );
}

function RecentRow({ session, provider, onOpen }: SessionCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${session.title}`}
      onPress={() => {
        haptics.select();
        onOpen();
      }}
      style={({ pressed }) => [styles.recentRow, pressed && styles.recentPressed]}
    >
      <View style={[styles.providerDot, { backgroundColor: provider?.color ?? theme.color.textFaint }]} />
      <View style={styles.cardCopy}>
        <Text style={styles.recentTitle} numberOfLines={1}>
          {session.title || "Untitled conversation"}
        </Text>
        <Text style={styles.metadata} numberOfLines={1}>
          Recent · {providerLabel(session, provider)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.color.textFaint} />
    </Pressable>
  );
}

function PermissionAction({
  option,
  disabled,
  onPress,
}: {
  option: ApprovalOption;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const deny = isDenyApprovalOption(option);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={option.name}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.permissionAction,
        deny ? styles.denyAction : styles.allowAction,
        disabled && styles.permissionActionDisabled,
        pressed && styles.permissionActionPressed,
      ]}
    >
      <Text style={[styles.permissionActionText, deny && styles.denyActionText]} numberOfLines={2}>
        {option.name}
      </Text>
    </Pressable>
  );
}

function PermissionCard({
  session,
  provider,
  disabled,
  onOpen,
  onAnswer,
}: SessionCardProps & {
  disabled: boolean;
  onAnswer: (requestId: string, option: ApprovalOption) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const permission = session.permission;
  if (!permission) return null;
  const options = [...selectApprovalOptions(permission.options)].sort(
    (left, right) =>
      Number(isDenyApprovalOption(right)) - Number(isDenyApprovalOption(left)),
  );

  return (
    <View style={styles.permissionCard} accessibilityLiveRegion="assertive">
      <View style={styles.permissionRail} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${session.title}`}
        hitSlop={touchSlop(40)}
        onPress={() => {
          haptics.tap();
          onOpen();
        }}
        style={({ pressed }) => [styles.permissionHeader, pressed && styles.cardPressed]}
      >
        <SessionIdentity provider={provider} busy={false} />
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>Permission needed</Text>
          <Text style={styles.metadata} numberOfLines={1}>
            {providerLabel(session, provider)}
          </Text>
          <Text style={styles.permissionRequest} numberOfLines={3}>
            {permission.title}
          </Text>
        </View>
      </Pressable>
      <View style={styles.permissionActions}>
        {options.map((option) => (
          <PermissionAction
            key={option.optionId}
            option={option}
            disabled={disabled}
            onPress={() => onAnswer(permission.requestId, option)}
          />
        ))}
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function hasActiveWork(groups: ActivitySessionGroups): boolean {
  return groups.needsYou.length + groups.working.length + groups.ready.length > 0;
}

function ActivityScreenView({
  sessions,
  providers,
  status,
  reduceMotion,
  onClose,
  onNewConversation,
  onOpenSession,
  onAnswerPermission,
}: ActivityScreenProps) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const providerById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );
  const groups = useMemo(() => groupActivitySessions(sessions), [sessions]);
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: theme.motion.base,
      useNativeDriver: true,
    }).start();
  }, [entrance, reduceMotion]);

  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.root,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + theme.space(2), paddingHorizontal: theme.gutter },
          ]}
        >
          <CircleButton label="Back to conversation" size={48} onPress={onClose}>
            <Ionicons name="chevron-back" size={26} color={theme.color.text} />
          </CircleButton>
          <Text style={styles.title} accessibilityRole="header">
            Activity
          </Text>
          <CircleButton label="New conversation" size={48} onPress={onNewConversation}>
            <Ionicons name="create-outline" size={23} color={theme.color.text} />
          </CircleButton>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + theme.space(6) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.summary} accessibilityLiveRegion="polite">
            {activitySummary(groups)}
          </Text>

          {status !== "online" ? (
            <View style={styles.offlineBanner} accessibilityRole="alert">
              <Ionicons name="cloud-offline-outline" size={19} color={theme.color.textDim} />
              <Text style={styles.offlineText}>
                {status === "connecting"
                  ? "Reconnecting to your computer…"
                  : "Computer offline. Sessions will reconnect."}
              </Text>
            </View>
          ) : null}

          {groups.needsYou.length > 0 ? (
            <Section title="Needs you">
              {groups.needsYou.map((session) => (
                <PermissionCard
                  key={session.id}
                  session={session}
                  provider={providerById.get(session.providerId)}
                  disabled={status !== "online"}
                  onOpen={() => onOpenSession(session.id)}
                  onAnswer={(requestId, option) =>
                    onAnswerPermission(
                      session.id,
                      requestId,
                      option.optionId,
                      isDenyApprovalOption(option),
                    )
                  }
                />
              ))}
            </Section>
          ) : null}

          {groups.working.length > 0 ? (
            <Section title="Working">
              {groups.working.map((session) => (
                <WorkingCard
                  key={session.id}
                  session={session}
                  provider={providerById.get(session.providerId)}
                  onOpen={() => onOpenSession(session.id)}
                  reduceMotion={reduceMotion}
                />
              ))}
            </Section>
          ) : null}

          {groups.ready.length > 0 ? (
            <Section title="Ready">
              {groups.ready.map((session) => (
                <ReadyCard
                  key={session.id}
                  session={session}
                  provider={providerById.get(session.providerId)}
                  onOpen={() => onOpenSession(session.id)}
                />
              ))}
            </Section>
          ) : null}

          {!hasActiveWork(groups) ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing running</Text>
              <Text style={styles.emptyBody}>Start a conversation and it will stay visible here.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a new conversation"
                onPress={() => {
                  haptics.sent();
                  onNewConversation();
                }}
                style={({ pressed }) => [styles.emptyAction, pressed && styles.permissionActionPressed]}
              >
                <Text style={styles.emptyActionText}>New conversation</Text>
              </Pressable>
            </View>
          ) : null}

          {groups.recent.length > 0 ? (
            <Section title="Recent">
              {groups.recent.slice(0, 5).map((session) => (
                <RecentRow
                  key={session.id}
                  session={session}
                  provider={providerById.get(session.providerId)}
                  onOpen={() => onOpenSession(session.id)}
                />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export const ActivityScreen = memo(ActivityScreenView);

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  header: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    minHeight: 112,
    paddingBottom: theme.space(3),
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(4),
  },
  title: {
    flex: 1,
    color: theme.color.text,
    fontFamily: theme.display.semibold,
    fontSize: 29,
    letterSpacing: 1.2,
  },
  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: theme.gutter,
    gap: theme.space(6),
  },
  summary: { color: theme.color.textDim, fontSize: theme.font.body, lineHeight: 24 },
  offlineBanner: {
    minHeight: theme.size.touch,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(2.5),
    paddingHorizontal: theme.space(3.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
  },
  offlineText: { flex: 1, color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 20 },
  section: { gap: theme.space(2.5) },
  sectionTitle: {
    color: theme.color.textFaint,
    fontSize: theme.font.tiny,
    lineHeight: 17,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  sectionBody: { overflow: "hidden", borderRadius: theme.radius.md, backgroundColor: theme.color.groupedSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.separator },
  card: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3.5),
    padding: theme.space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.separator,
  },
  workingCard: { backgroundColor: theme.color.groupedSurface },
  cardPressed: { backgroundColor: theme.color.surfacePressed },
  cardCopy: { flex: 1, minWidth: 0, gap: theme.space(1) },
  cardTitle: { color: theme.color.text, fontSize: 17, lineHeight: 22, fontWeight: "700" },
  metadata: { color: theme.color.textFaint, fontSize: theme.font.small, lineHeight: 19 },
  liveRow: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: theme.space(2) },
  liveText: { flex: 1, color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 20 },
  permissionCard: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.surfaceRaised,
  },
  permissionRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: theme.color.accent,
  },
  permissionHeader: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3.5),
    paddingTop: theme.space(4),
    paddingHorizontal: theme.space(4),
    paddingBottom: theme.space(3),
  },
  permissionRequest: {
    marginTop: theme.space(1),
    color: theme.color.textDim,
    fontSize: theme.font.small,
    lineHeight: 20,
  },
  permissionActions: {
    flexDirection: "row",
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingBottom: theme.space(4),
  },
  permissionAction: {
    flex: 1,
    minHeight: theme.size.touch,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  denyAction: { borderColor: theme.color.border, backgroundColor: theme.color.surface },
  allowAction: { borderColor: theme.color.accent, backgroundColor: theme.color.accent },
  permissionActionDisabled: { opacity: 0.42 },
  permissionActionPressed: { opacity: 0.7 },
  permissionActionText: {
    color: theme.approval.allowText,
    fontSize: theme.font.body,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  denyActionText: { color: theme.color.text },
  readyCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.separator,
    backgroundColor: theme.color.groupedSurface,
  },
  readyIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.success,
  },
  readyTitle: { color: theme.color.text, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  recentRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  recentPressed: { opacity: 0.58 },
  providerDot: { width: 8, height: 8, borderRadius: 4 },
  statusMarker: { width: 8, height: 32, borderRadius: 4 },
  recentTitle: { color: theme.color.text, fontSize: theme.font.body, lineHeight: 22 },
  empty: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space(3),
    paddingVertical: theme.space(7),
  },
  emptyTitle: {
    color: theme.color.text,
    fontFamily: theme.display.semibold,
    fontSize: 22,
    letterSpacing: 0.5,
  },
  emptyBody: {
    maxWidth: 280,
    color: theme.color.textDim,
    fontSize: theme.font.body,
    lineHeight: 23,
    textAlign: "center",
  },
  emptyAction: {
    minHeight: theme.size.touch,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.space(2),
    paddingHorizontal: theme.space(6),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
  },
  emptyActionText: { color: theme.approval.allowText, fontSize: theme.font.body, fontWeight: "700" },
  });
}
;
