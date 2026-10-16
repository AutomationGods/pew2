/**
 * The full-screen live voice call: who it is about, connection state, live
 * captions of both sides, and mute / speaker / hang up.
 *
 * A plain full-screen Modal: the call owns the screen the way the system call
 * UI does, and the native sheet's drag-to-dismiss would hang up by accident.
 */
import { useEffect, useRef } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../theme";
import { haptics } from "./haptics";
import { voiceFailureMessage } from "../voice/protocol";
import type { VoiceCallState } from "../voice/useVoiceCall";
import { usePalette } from "./appearance";
import { themedStyles, type Palette } from "../palette";

interface CallScreenProps {
  call: VoiceCallState;
  onHangUp: () => void;
  onMute: (muted: boolean) => void;
  onSpeaker: (on: boolean) => void;
  onRetry: () => void;
}

function statusLine(call: VoiceCallState): string {
  switch (call.phase) {
    case "connecting":
      return "Connecting…";
    case "connected":
      return call.muted ? "Live · muted" : "Live";
    case "error":
      return "Couldn't connect";
    case "idle":
      return "Call ended";
  }
}

export function CallScreen({ call, onHangUp, onMute, onSpeaker, onRetry }: CallScreenProps): React.JSX.Element {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [call.captions]);

  const title = call.focus.title ?? (call.focus.sessionId ? "This conversation" : "pew2");
  const context = call.focus.folder ? `pew2 voice · ${call.focus.folder}` : "pew2 voice · all sessions";
  const failed = call.phase === "error" && call.error;

  return (
    <Modal visible={call.open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onHangUp}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.header} accessible accessibilityRole="header" accessibilityLabel={`${title}. ${context}. ${statusLine(call)}.`}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.context} numberOfLines={1}>{context}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    call.phase === "connected" ? palette.color.success : call.phase === "error" ? palette.color.danger : palette.color.accent,
                },
              ]}
            />
            <Text style={styles.status} accessibilityLiveRegion="polite">{statusLine(call)}</Text>
          </View>
        </View>

        <ScrollView ref={scroll} style={styles.captions} contentContainerStyle={styles.captionsContent}>
          {failed ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={22} color={palette.color.danger} />
              <Text style={styles.errorText}>{voiceFailureMessage(call.error!, call.errorDetail)}</Text>
              {call.error !== "unsupported" && call.error !== "unavailable" && (
                <Pressable
                  onPress={onRetry}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              )}
            </View>
          ) : call.captions.length === 0 ? (
            <Text style={styles.hint}>
              {call.phase === "connected" ? "Say what you need. pew2 can check on agents, send prompts and answer approvals." : " "}
            </Text>
          ) : (
            call.captions.map((caption) => (
              <View key={caption.id} style={[styles.caption, caption.who === "user" && styles.captionUser]}>
                <Text style={styles.captionWho}>{caption.who === "user" ? "You" : "pew2"}</Text>
                <Text style={[styles.captionText, !caption.final && styles.captionLive]}>{caption.text}</Text>
              </View>
            ))
          )}
          {call.phase !== "error" && call.errorDetail ? <Text style={styles.hint}>{call.errorDetail}</Text> : null}
        </ScrollView>

        <View style={styles.controls}>
          <CallButton
            icon={call.muted ? "mic-off" : "mic"}
            label={call.muted ? "Unmute" : "Mute"}
            selected={call.muted}
            disabled={call.phase !== "connected"}
            onPress={() => onMute(!call.muted)}
          />
          <CallButton
            icon="call"
            label="Hang up"
            danger
            onPress={() => {
              haptics.tap();
              onHangUp();
            }}
          />
          <CallButton
            icon={call.speaker ? "volume-high" : "volume-medium-outline"}
            label={call.speaker ? "Speaker on" : "Speaker"}
            selected={call.speaker}
            disabled={call.phase === "error"}
            onPress={() => onSpeaker(!call.speaker)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function CallButton({
  icon,
  label,
  onPress,
  selected = false,
  danger = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const color = danger ? "#ffffff" : selected ? palette.color.onAccent : palette.color.text;
  return (
    <View style={styles.buttonWrap}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled }}
        style={({ pressed }) => [
          styles.button,
          selected && styles.buttonSelected,
          danger && styles.buttonDanger,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={danger ? styles.hangUpGlyph : undefined}>
          <Ionicons name={icon} size={28} color={color} />
        </View>
      </Pressable>
      <Text style={styles.buttonLabel}>{label}</Text>
    </View>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Spacing in 4pt steps, matching the rest of the app. */
const space = (n: number) => n * 4;

const makeStyles = themedStyles(buildStyles);

function buildStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.color.bg },
    header: { alignItems: "center", paddingHorizontal: space(6), paddingTop: space(8), gap: space(1) },
    title: { color: palette.color.text, fontSize: theme.font.greeting, fontWeight: "700", textAlign: "center" },
    context: { color: palette.color.textDim, fontSize: theme.font.small },
    statusRow: { flexDirection: "row", alignItems: "center", gap: space(2), marginTop: space(2) },
    dot: { width: 8, height: 8, borderRadius: 4 },
    status: { color: palette.color.textDim, fontSize: theme.font.small, fontWeight: "600" },
    captions: { flex: 1, marginTop: space(6) },
    captionsContent: { paddingHorizontal: space(5), paddingBottom: space(4), gap: space(3) },
    hint: { color: palette.color.textFaint, fontSize: theme.font.body, textAlign: "center", marginTop: space(6) },
    caption: { gap: 2 },
    captionUser: { alignItems: "flex-end" },
    captionWho: { color: palette.color.textFaint, fontSize: theme.font.tiny, fontWeight: "600" },
    captionText: { color: palette.color.text, fontSize: theme.font.body },
    captionLive: { color: palette.color.textDim },
    errorBox: {
      alignItems: "center",
      gap: space(3),
      padding: space(5),
      borderRadius: theme.radius.md,
      backgroundColor: palette.color.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.color.border,
    },
    errorText: { color: palette.color.text, fontSize: theme.font.body, textAlign: "center" },
    retry: {
      minHeight: theme.size.touch,
      paddingHorizontal: space(5),
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: palette.color.surfaceRaised,
    },
    retryText: { color: palette.color.accent, fontSize: theme.font.body, fontWeight: "600" },
    controls: {
      flexDirection: "row",
      justifyContent: "space-evenly",
      paddingVertical: space(6),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.color.border,
    },
    buttonWrap: { alignItems: "center", gap: space(2), width: 88 },
    button: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.color.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.color.border,
    },
    buttonSelected: { backgroundColor: palette.color.accent },
    buttonDanger: { backgroundColor: "#d93a2f", borderColor: "#d93a2f" },
    hangUpGlyph: { transform: [{ rotate: "135deg" }] },
    buttonLabel: { color: palette.color.textDim, fontSize: theme.font.small },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.4 },
  });
}
