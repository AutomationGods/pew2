import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StageScroll } from "./stage/StageScroll";
import { Sheet } from "./Sheet";
import { PrivacyLink } from "./PrivacyLink";
import { haptics } from "./haptics";
import { Handshake, type HandshakePhase } from "./Handshake";
import { Led } from "./stage/Led";
import { DashedRule } from "./stage/DashedRule";
import { Dissolve } from "./motion/Dissolve";
import { theme } from "../theme";
import type { Status } from "../useDaemon";
import { useAppearance } from "./appearance";
import { ACCENT_NAMES, APPEARANCE_MODES, type AccentName, type AppearanceMode } from "../appearancePreference";
import { ACCENTS } from "../palette";
import { usePalette } from "./appearance";
import { themedStyles, type Palette } from "../palette";
import type { VoiceMode } from "../voice/walkie";

const MODE_LABEL: Record<AppearanceMode, string> = { system: "System", light: "Light", dark: "Dark" };
const ACCENT_LABEL: Record<AccentName, string> = { periwinkle: "Periwinkle", coral: "Coral", ocean: "Ocean", violet: "Violet", mint: "Mint" };

/** Mode and accent, applied the moment they are tapped and persisted beside the other preferences. */
function AppearanceRows({ index }: { index: number }) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const { preference, setPreference } = useAppearance();
  const c = palette.color;
  return <>
    <Row label="Mode" index={index}>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {APPEARANCE_MODES.map((mode) => {
          const on = preference.mode === mode;
          return <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${MODE_LABEL[mode]} appearance`}
            onPress={() => { haptics.tap(); setPreference({ ...preference, mode }); }}
            style={[styles.segment, on ? { borderStyle: "solid", borderColor: c.accent, backgroundColor: c.accentSoft } : { borderColor: palette.stage.dash }]}>
            <Text style={[styles.segmentText, { color: on ? c.text : c.textDim }]}>{MODE_LABEL[mode]}</Text>
          </Pressable>;
        })}
      </View>
    </Row>
    <Row label="Accent" index={index + 1}>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {ACCENT_NAMES.map((accent) => {
          const on = preference.accent === accent;
          return <Pressable key={accent} hitSlop={4} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${ACCENT_LABEL[accent]} accent`}
            onPress={() => { haptics.tap(); setPreference({ ...preference, accent }); }}
            style={[styles.swatchRing, { borderColor: on ? c.text : "transparent" }]}>
            <View style={[styles.swatch, { backgroundColor: ACCENTS[palette.scheme][accent].accent }]} />
          </Pressable>;
        })}
      </View>
    </Row>
  </>;
}

const VOICE_LABEL: Record<VoiceMode, string> = { live: "Live call", walkie: "Walkie-talkie" };
const VOICE_NOTE: Record<VoiceMode, string> = {
  live: "Live call (Gemini): talk hands-free.",
  walkie: "Walkie-talkie (ChatGPT plan): hold to talk. Using ChatGPT plan.",
};

/** Live call or walkie-talkie, for the call button. */
function VoiceRows({ index, mode, onChange }: { index: number; mode: VoiceMode; onChange: (mode: VoiceMode) => void }) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const c = palette.color;
  return <>
    <Row label="Voice" index={index}>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {(["live", "walkie"] as const).map((option) => {
          const on = mode === option;
          return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={VOICE_NOTE[option]}
            onPress={() => { haptics.tap(); onChange(option); }}
            style={[styles.segment, on ? { borderStyle: "solid", borderColor: c.accent, backgroundColor: c.accentSoft } : { borderColor: palette.stage.dash }]}>
            <Text style={[styles.segmentText, { color: on ? c.text : c.textDim }]}>{VOICE_LABEL[option]}</Text>
          </Pressable>;
        })}
      </View>
    </Row>
    <Text style={[styles.voiceNote, { color: c.textDim }]}>{VOICE_NOTE[mode]}</Text>
  </>;
}

// Same fixed desktop install/update instruction formerly shown in Sidebar.
const INSTALL_COMMAND = "curl -fsSL https://raw.githubusercontent.com/KenKaiii/pew2/main/install.sh | sh";
/** Shared label column, so every value starts at the same x. */
const LABEL_WIDTH = 92;

interface Props {
  visible: boolean;
  machineLabel: string;
  machineRemote: boolean;
  status: Status;
  update?: { latest: string; automatic: boolean };
  onClose: () => void;
  onUnpair: () => void;
  /** The voice choice; the row is hidden when absent. */
  voiceMode?: VoiceMode;
  onVoiceMode?: (mode: VoiceMode) => void;
}

const PHASE = { online: "paired", connecting: "pairing", offline: "waiting" } satisfies Record<Status, HandshakePhase>;

function Row({ label, index, children }: { label: string; index: number; children: React.ReactNode }) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  return (
    <Dissolve kind="row" delay={index * 50}>
      <View style={styles.row}>
        <Led tone="dim" style={styles.rowLabel}>{label}</Led>
        <View style={styles.rowValue}>{children}</View>
      </View>
    </Dissolve>
  );
}

export function ConnectionSheet({ visible, machineLabel, machineRemote, status, update, onClose, onUnpair, voiceMode, onVoiceMode }: Props) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const { height: screenHeight } = useWindowDimensions();
  const title = status === "online" ? "Connected" : status === "connecting" ? "Connecting…" : "Offline";
  return <Sheet visible={visible} label="Connection" labelTone={status === "connecting" ? "attention" : "agent"} pewMood={status === "online" ? "happy" : status === "connecting" ? "thinking" : "sleepy"} title={title} onClose={onClose} dismissLabel="Close connection details">
    <StageScroll style={[styles.scroll, { maxHeight: Math.round(screenHeight * 0.75) }]} contentContainerStyle={styles.content}>
      <Handshake phase={PHASE[status]} />
      <DashedRule />
      <Row label="Computer" index={0}>
        {/* The computer's own name, never the relay's address. */}
        <Text selectable numberOfLines={1} style={[styles.value, { color: palette.color.text }]}>{machineLabel}</Text>
      </Row>
      <Row label="Route" index={1}>
        <Text numberOfLines={1} style={[styles.value, { color: palette.color.text }]}>{machineRemote ? "Relay, sealed end to end" : "Same network"}</Text>
      </Row>
      {update && <Row label="pew2" index={2}>
        {update.automatic ? <Text numberOfLines={1} style={styles.value}>Updating to {update.latest}…</Text> :
          <Pressable accessibilityRole="button" accessibilityLabel={`pew2 ${update.latest} is available for ${machineLabel}. How to update.`} hitSlop={8} onPress={() => {
            haptics.tap();
            Alert.alert(`pew2 ${update.latest} is available`, `This computer can't update itself, so run this on ${machineLabel}:\n\n${INSTALL_COMMAND}`, [{ text: "OK" }]);
          }}><Text numberOfLines={1} style={[styles.value, styles.link]}>{update.latest} available · How</Text></Pressable>}
      </Row>}
      <DashedRule />
      <AppearanceRows index={3} />
      <DashedRule />
      {voiceMode && onVoiceMode ? <><VoiceRows index={5} mode={voiceMode} onChange={onVoiceMode} /><DashedRule /></> : null}
      <PrivacyLink />
      <Pressable accessibilityRole="button" accessibilityLabel={`Forget pairing with ${machineLabel}`} style={styles.action} onPress={() => {
        haptics.warned();
        Alert.alert("Forget this computer?", "You'll need to scan or paste its pairing link to connect again.", [
          { text: "Cancel", style: "cancel" },
          { text: "Forget", style: "destructive", onPress: () => { haptics.warned(); onUnpair(); } },
        ]);
      }}><Text style={[styles.destructive, { color: palette.color.danger }]}>Unpair this computer</Text></Pressable>
    </StageScroll>
  </Sheet>;
}
const makeStyles = themedStyles((p: Palette) => StyleSheet.create({
  // Everything shows at once (it is short); only a very small screen scrolls.
  scroll: { flexGrow: 0 },
  content: { paddingBottom: theme.sectionGap, gap: theme.space(3) },
  row: { flexDirection: "row", alignItems: "center", minHeight: theme.size.touch },
  rowLabel: { width: LABEL_WIDTH },
  rowValue: { flex: 1, alignItems: "flex-end" },
  value: { color: p.color.text, fontSize: theme.font.body, lineHeight: theme.line.body, textAlign: "right" },
  link: { color: p.color.accent },
  action: { minHeight: theme.size.touch, justifyContent: "center" },
  segments: { flexDirection: "row", gap: theme.space(1.5), justifyContent: "flex-end" },
  segment: { minHeight: 32, paddingHorizontal: theme.space(2.5), justifyContent: "center", borderRadius: theme.radius.pill, borderWidth: 1, borderStyle: "dashed" },
  segmentText: { fontSize: theme.font.small },
  voiceNote: { fontSize: theme.font.small, textAlign: "right" },
  swatchRing: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  destructive: { color: p.color.danger, fontSize: theme.font.body, lineHeight: 20 },
}));
