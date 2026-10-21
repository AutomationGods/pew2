/**
 * Walkie-talkie voice: one big hold-to-talk button, captions of both sides,
 * and the reply read aloud. Paid by the user's ChatGPT plan on their computer,
 * so the plan is named on screen ("Using ChatGPT plan" + "Manage usage", per
 * OpenAI's plan-usage UI guidelines), and a usage limit makes "Manage usage"
 * the primary action.
 *
 * A full-screen Modal like the call screen; Stage pieces (Led, DashedRule,
 * StageButton) for the chrome.
 */
import { useEffect, useRef } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../theme";
import { haptics } from "./haptics";
import { usePalette } from "./appearance";
import { themedStyles, type Palette } from "../palette";
import { Led } from "./stage/Led";
import { DashedRule } from "./stage/DashedRule";
import { StageButton } from "./stage/StageButton";
import { MANAGE_USAGE_URL, walkieFailureMessage } from "../voice/walkie";
import type { WalkieState } from "../voice/useWalkie";

interface Props {
  walkie: WalkieState;
  onPressIn: () => void;
  onPressOut: () => void;
  onClose: () => void;
}

const PHASE_LABEL: Record<WalkieState["phase"], string> = {
  ready: "Hold to talk",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking · press to stop",
  error: "Hold to talk",
};

export function WalkieTalkie({ walkie, onPressIn, onPressOut, onClose }: Props): React.JSX.Element {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [walkie.lines, walkie.hearing]);

  const title = walkie.focus.title ?? (walkie.focus.sessionId ? "This conversation" : "pew2");
  const context = walkie.focus.folder ? `walkie-talkie · ${walkie.focus.folder}` : "walkie-talkie · all sessions";
  const limit = walkie.phase === "error" && walkie.error === "usage_limit";
  const live = walkie.phase === "listening";
  const manage = () => {
    haptics.tap();
    void Linking.openURL(walkie.manageUrl ?? MANAGE_USAGE_URL);
  };

  return (
    <Modal visible={walkie.open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close walkie-talkie" hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={26} color={palette.color.textDim} />
          </Pressable>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
          <Led tone="dim">{context}</Led>
        </View>
        <DashedRule />

        <ScrollView ref={scroll} style={styles.captions} contentContainerStyle={styles.captionsContent}>
          {walkie.lines.length === 0 && !walkie.hearing ? (
            <Text style={styles.hint}>Hold the button and speak. pew2 can check on agents, send prompts, answer approvals and questions, and run goals.</Text>
          ) : null}
          {walkie.lines.map((line) => (
            <View key={line.id} style={[styles.caption, line.who === "user" && styles.captionUser]}>
              <Led tone={line.who === "user" ? "dim" : "agent"} size={10}>{line.who === "user" ? "You" : "pew2"}</Led>
              <Text style={styles.captionText}>{line.text}</Text>
            </View>
          ))}
          {walkie.hearing ? (
            <View style={[styles.caption, styles.captionUser]}>
              <Led tone="dim" size={10}>You</Led>
              <Text style={[styles.captionText, styles.captionLive]}>{walkie.hearing}</Text>
            </View>
          ) : null}
          {walkie.phase === "error" && walkie.error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              {limit ? <Text style={styles.errorTitle}>Usage limit reached</Text> : null}
              <Text style={styles.errorText}>{walkieFailureMessage(walkie.error, walkie.errorDetail)}</Text>
              {limit ? <StageButton label="Manage usage" kind="primary" compact onPress={manage} /> : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.dock}>
          <Led tone={live ? "attention" : "dim"} style={styles.phase}>{PHASE_LABEL[walkie.phase]}</Led>
          <Pressable
            onPressIn={() => {
              haptics.tap();
              onPressIn();
            }}
            onPressOut={onPressOut}
            accessibilityRole="button"
            accessibilityLabel="Hold to talk"
            accessibilityHint="Hold while you speak, release to send. Press again to stop the reply."
            style={({ pressed }) => [styles.talk, (pressed || live) && styles.talkLive]}
          >
            <Ionicons name={walkie.phase === "speaking" ? "stop" : "mic"} size={44} color={live ? palette.color.onAccent : palette.color.text} />
          </Pressable>
          <View style={styles.plan}>
            <Text style={styles.planText}>Using ChatGPT plan</Text>
            <Pressable onPress={manage} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.planLink}>Manage usage</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const space = (n: number) => n * 4;

const makeStyles = themedStyles((p: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.color.bg },
  header: { alignItems: "center", paddingHorizontal: space(6), paddingTop: space(4), paddingBottom: space(3), gap: space(1) },
  close: { alignSelf: "flex-start", minHeight: theme.size.touch, justifyContent: "center" },
  title: { color: p.color.text, fontSize: theme.font.greeting, fontWeight: "700", textAlign: "center" },
  captions: { flex: 1 },
  captionsContent: { paddingHorizontal: space(5), paddingVertical: space(4), gap: space(3) },
  hint: { color: p.color.textFaint, fontSize: theme.font.body, textAlign: "center", marginTop: space(6) },
  caption: { gap: 2 },
  captionUser: { alignItems: "flex-end" },
  captionText: { color: p.color.text, fontSize: theme.font.body },
  captionLive: { color: p.color.textDim },
  errorBox: {
    alignItems: "center",
    gap: space(3),
    padding: space(5),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: p.stage.dash,
  },
  errorTitle: { color: p.color.text, fontSize: theme.font.body, fontWeight: "700" },
  errorText: { color: p.color.text, fontSize: theme.font.body, textAlign: "center" },
  dock: { alignItems: "center", gap: space(3), paddingBottom: space(4), paddingTop: space(2) },
  phase: { minHeight: 16 },
  talk: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: p.stage.dash,
    backgroundColor: p.color.surfaceRaised,
  },
  talkLive: { borderStyle: "solid", borderColor: p.color.accent, backgroundColor: p.color.accent },
  plan: { flexDirection: "row", alignItems: "center", gap: space(2) },
  planText: { color: p.color.textDim, fontSize: theme.font.small },
  planLink: { color: p.color.accent, fontSize: theme.font.small, fontWeight: "600" },
}));
