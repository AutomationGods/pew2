/**
 * Isolated Wishwish-inspired chat prototype. No daemon, account or saved preferences.
 * Run from packages/app:
 * EXPO_PUBLIC_HARNESS=Wishwish npm run web -- --port 8095 --host localhost
 *
 * Thesis: a phone-first conversation, with clear blue messages and fresh teal actions.
 * Native system type: 24pt brand, 20pt heading, 16pt messages, 13pt utility; mono only for code.
 * Cool daylight surfaces or layered midnight navy; mint in the dark, teal in the light.
 * 4pt spacing grid, one 720pt rail; 12pt record corners, 16pt composer, 44pt targets.
 * Imagery: none. Existing Icon family. Press feedback only; no decorative animation.
 * Blue distinguishes the user's words; neutral cards contain permissions, not every paragraph.
 * All content is explicitly a fixture, including permission and offline simulations.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Icon } from "./Icon";
import { theme } from "../theme";
import { PREVIEW_REPLY, wishwishPreviewPalettes, type WishwishPreviewMode, type WishwishPreviewPalette } from "./wishwishPreviewTheme";

type Scene = "chat" | "approval" | "offline" | "empty";
type Message = { id: number; role: "user" | "agent"; text: string };
const SCENES = [
  { id: "chat", title: "Chat" }, { id: "approval", title: "Approval" },
  { id: "offline", title: "Offline" }, { id: "empty", title: "Empty" },
] as const;
const SAMPLE_MESSAGES: readonly Message[] = [
  { id: 1, role: "user", text: "Make the chat easier to scan on my phone." },
  { id: 2, role: "agent", text: "I’d keep your conversation at the center, with quieter controls and a clear next step.\n\nClear blue messages, fresh teal actions, and a little more breathing room. The conversation still comes first." },
];

type Styles = ReturnType<typeof makeStyles>;
function Button({ label, onPress, children, styles, primary = false, disabled = false }: {
  label: string; onPress: () => void; children: ReactNode; styles: Styles; primary?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.primaryButton,
        pressed && (primary ? styles.primaryPressed : styles.pressed), disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

function ChatPreview() {
  const [mode, setMode] = useState<WishwishPreviewMode>("dark");
  const [scene, setScene] = useState<Scene>("chat");
  const [messages, setMessages] = useState<readonly Message[]>(() => SAMPLE_MESSAGES.map(message => ({ ...message })));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(false);
  const [approval, setApproval] = useState<"waiting" | "allowed" | "denied">("waiting");
  const [details, setDetails] = useState(false);
  const [notice, setNotice] = useState("");
  const sequence = useRef(3);
  const scroll = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  const palette = wishwishPreviewPalettes[mode];
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const displayed = scene === "empty" ? [] : messages;
  const sendDisabled = scene === "offline" || (!draft.trim() && !attachment);

  useEffect(() => {
    if (!sending) return;
    const timer = setTimeout(() => {
      const reply: Message = { id: sequence.current++, role: "agent", text: PREVIEW_REPLY };
      setMessages(previous => [...previous, reply]);
      setSending(false);
      setNotice("Sample reply added. Nothing was sent to an agent.");
    }, 1600);
    return () => clearTimeout(timer);
  }, [sending]);

  function chooseScene(next: Scene) {
    setSending(false);
    setScene(next);
    setApproval("waiting");
    setNotice("");
  }

  function send() {
    if (sending || sendDisabled) return;
    const message: Message = { id: sequence.current++, role: "user", text: draft.trim() + (attachment ? `${draft.trim() ? "\n\n" : ""}Attached sample: preview-notes.md` : "") };
    setMessages(previous => [...(scene === "empty" ? [] : previous), message]);
    setDraft("");
    setAttachment(false);
    setScene("chat");
    setSending(true);
    setNotice("Preparing a sample reply.");
  }

  return (
    <View style={styles.backdrop}>
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Text style={styles.brand}>pew<Text style={styles.brandAccent}>2</Text></Text>
              <View style={styles.headerActions}>
                <Text style={styles.previewLabel}>Style preview</Text>
                <Button label={`Switch to ${mode === "light" ? "dark" : "light"} preview`} onPress={() => setMode(mode === "light" ? "dark" : "light")} styles={styles}>
                  <Icon name={mode === "light" ? "moon" : "sunny"} size={21} color={palette.text} />
                </Button>
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.title}>Chat with GG Coder</Text>
            <Text style={styles.subtitle}>Sample conversation. No agent is connected.</Text>
          </View>

          <View style={styles.sceneRow} accessibilityLabel="Preview states">
            {SCENES.map(item => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title} preview`}
                accessibilityState={{ selected: scene === item.id }} onPress={() => chooseScene(item.id)}
                style={({ pressed }) => [styles.sceneButton, scene === item.id && styles.sceneSelected, pressed && styles.pressed]}>
                <Text style={[styles.sceneText, scene === item.id && styles.sceneTextSelected]}>{item.title}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={styles.transcript}
            keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
            <View style={styles.context}>
              <Icon name="folder-outline" size={17} color={palette.accent} />
              <Text style={styles.contextText}>pew2</Text>
              <Text style={styles.contextDivider}>/</Text>
              <Text style={styles.contextText}>design-preview</Text>
            </View>

            {scene === "offline" && (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Icon name="cloud-offline-outline" size={21} color={palette.text} />
                  <Text accessibilityRole="header" style={styles.cardTitle}>Offline preview</Text>
                </View>
                <Text style={styles.body}>Your draft stays here. Reconnect the preview to try sending it.</Text>
                <Button label="Reconnect preview" onPress={() => { setScene("chat"); setNotice("Preview reconnected. No real connection was opened."); }} styles={styles}>
                  <Text style={styles.actionText}>Reconnect preview</Text>
                </Button>
              </View>
            )}

            {displayed.length === 0 ? (
              <View style={styles.empty}>
                <Icon name="create-outline" size={30} color={palette.accent} />
                <Text accessibilityRole="header" style={styles.emptyTitle}>A little room to think.</Text>
                <Text style={styles.emptyText}>Try a message below. This is a local style preview, so nothing leaves this screen.</Text>
              </View>
            ) : displayed.map(message => (
              <View key={message.id} style={message.role === "user" ? styles.userMessage : styles.agentMessage}>
                <Text style={[styles.author, message.role === "user" ? styles.userText : styles.agentAuthor]}>{message.role === "user" ? "You" : "GG Coder"}</Text>
                <Text selectable style={[styles.message, message.role === "user" && styles.userText]}>{message.text}</Text>
              </View>
            ))}

            {scene === "chat" && displayed.length > 0 && (
              <View style={styles.notes}>
                <Pressable accessibilityRole="button" accessibilityLabel="Preview design notes" accessibilityState={{ expanded: details }}
                  onPress={() => setDetails(!details)} style={({ pressed }) => [styles.notesControl, pressed && styles.pressed]}>
                  <Icon name="document-text-outline" size={18} color={palette.muted} />
                  <Text style={styles.notesLabel}>Preview design notes</Text>
                  <Icon name={details ? "chevron-up" : "chevron-down"} size={17} color={palette.muted} />
                </Pressable>
                {details && <Text style={styles.noteBody}>A Wishwish-inspired palette and flatter surfaces. This harness does not change the live chat, pairing, or agent connections.</Text>}
              </View>
            )}

            {scene === "approval" && (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.cardTitle}>Sample approval</Text>
                <Text style={styles.body}>Run the app’s UI tests?</Text>
                <Text selectable style={styles.code}>bun test ./packages/app/src/ui</Text>
                <Text style={styles.caption}>This preview never runs commands.</Text>
                {approval === "waiting" ? (
                  <View style={styles.approvalActions}>
                    <Button label="Deny sample request" onPress={() => { setApproval("denied"); setNotice("Sample request denied. No command was run."); }} styles={styles}>
                      <Text style={styles.buttonText}>Deny</Text>
                    </Button>
                    <Button label="Allow sample request once" onPress={() => { setApproval("allowed"); setNotice("Sample request allowed. No command was run."); }} styles={styles} primary>
                      <Text style={styles.primaryText}>Allow once</Text>
                    </Button>
                  </View>
                ) : <Text style={[styles.result, { color: approval === "allowed" ? palette.success : palette.danger }]}>{approval === "allowed" ? "Allowed in preview. No command was run." : "Denied in preview. No command was run."}</Text>}
              </View>
            )}
            {sending && <Text accessibilityLiveRegion="polite" style={styles.working}>Preparing a sample reply…</Text>}
          </ScrollView>

          <View style={styles.footer}>
            {notice !== "" && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
            <View style={styles.composer}>
              <TextInput ref={input} accessibilityLabel="Message for the local preview" placeholder="Ask GG Coder…"
                placeholderTextColor={palette.muted} value={draft} onChangeText={setDraft} multiline maxLength={4000}
                style={styles.input} textAlignVertical="top" />
              {attachment && <View style={styles.attachment}>
                <Icon name="document-outline" size={17} color={palette.text} />
                <Text style={styles.attachmentName}>preview-notes.md</Text>
                <Button label="Remove sample attachment" onPress={() => setAttachment(false)} styles={styles}>
                  <Icon name="close" size={18} color={palette.text} />
                </Button>
              </View>}
              <View style={styles.composerActions}>
                <Button label="Add sample attachment" onPress={() => setAttachment(true)} styles={styles} disabled={attachment}>
                  <Icon name="add" size={24} color={palette.text} />
                </Button>
                <Text style={styles.localLabel}>Local preview only</Text>
                <Button label={sending ? "Stop sample reply" : "Send preview message"}
                  onPress={sending ? () => { setSending(false); setNotice("Sample reply stopped."); } : send}
                  disabled={!sending && sendDisabled} styles={styles} primary>
                  <Icon name={sending ? "square" : "arrow-up"} size={20} color={!sending && sendDisabled ? palette.disabledInk : palette.onAccent} />
                </Button>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export default function WishwishHarness() {
  return <SafeAreaProvider><ChatPreview /></SafeAreaProvider>;
}

function makeStyles(p: WishwishPreviewPalette) {
  return StyleSheet.create({
    fill: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: p.canvas },
    screen: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center", backgroundColor: p.canvas },
    header: { paddingHorizontal: theme.space(5), paddingTop: theme.space(2), paddingBottom: theme.space(4), backgroundColor: p.surface },
    brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.space(4) },
    brand: { color: p.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.8 },
    brandAccent: { color: p.accent },
    headerActions: { flexDirection: "row", alignItems: "center", gap: theme.space(1) },
    previewLabel: { color: p.muted, fontSize: 12, fontWeight: "500" },
    title: { color: p.text, fontSize: 20, fontWeight: "700", lineHeight: 28 },
    subtitle: { color: p.muted, fontSize: 13, lineHeight: 20, marginTop: theme.space(1) },
    sceneRow: { flexDirection: "row", backgroundColor: p.surface, borderBottomWidth: 1, borderBottomColor: p.border, paddingHorizontal: theme.space(4) },
    sceneButton: { flex: 1, minHeight: 48, justifyContent: "center", alignItems: "center", padding: theme.space(2), borderBottomWidth: 3, borderBottomColor: "transparent" },
    sceneSelected: { borderBottomColor: p.accent },
    sceneText: { color: p.text, fontSize: 14, fontWeight: "500" },
    sceneTextSelected: { color: p.accent, fontWeight: "600" },
    transcript: { padding: theme.space(5), gap: theme.space(5), flexGrow: 1 },
    context: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.space(2) },
    contextText: { fontSize: 12, color: p.muted },
    contextDivider: { fontSize: 12, color: p.muted },
    userMessage: { padding: theme.space(4), backgroundColor: p.userSurface, borderRadius: 12, gap: theme.space(2) },
    userText: { color: p.userInk },
    agentAuthor: { color: p.accent },
    agentMessage: { paddingHorizontal: theme.space(1), gap: theme.space(2) },
    author: { color: p.text, fontSize: 13, fontWeight: "700" },
    message: { color: p.text, fontSize: 16, lineHeight: 25 },
    notes: { borderColor: p.border, borderWidth: 1, backgroundColor: p.surface, borderRadius: 12, overflow: "hidden" },
    notesControl: { flexDirection: "row", alignItems: "center", gap: theme.space(2), minHeight: 48, paddingHorizontal: theme.space(3), paddingVertical: theme.space(2) },
    notesLabel: { flex: 1, fontSize: 13, fontWeight: "500", color: p.text },
    noteBody: { color: p.muted, fontSize: 14, lineHeight: 22, paddingHorizontal: theme.space(3), paddingBottom: theme.space(3) },
    card: { padding: theme.space(4), backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 12, gap: theme.space(3) },
    row: { flexDirection: "row", alignItems: "center", gap: theme.space(2), flexWrap: "wrap" },
    cardTitle: { fontSize: 16, fontWeight: "600", color: p.text },
    body: { color: p.text, fontSize: 15, lineHeight: 23 },
    caption: { color: p.muted, fontSize: 13, lineHeight: 20 },
    code: { fontFamily: theme.display.monospace, fontSize: 13, lineHeight: 21, color: p.text, backgroundColor: p.canvas, padding: theme.space(3), borderRadius: 8 },
    approvalActions: { flexDirection: "row", gap: theme.space(2), justifyContent: "flex-end", flexWrap: "wrap" },
    result: { fontSize: 14, lineHeight: 22, fontWeight: "500" },
    empty: { alignItems: "center", justifyContent: "center", flexGrow: 1, gap: theme.space(3), paddingVertical: theme.space(5) },
    emptyTitle: { color: p.text, fontSize: 20, fontWeight: "600", textAlign: "center" },
    emptyText: { color: p.muted, fontSize: 15, lineHeight: 24, textAlign: "center", maxWidth: 320 },
    footer: { paddingHorizontal: theme.space(5), paddingBottom: theme.space(3), paddingTop: theme.space(3), backgroundColor: p.canvas },
    notice: { color: p.muted, fontSize: 12, lineHeight: 18, marginBottom: theme.space(2) },
    composer: { backgroundColor: p.surface, borderColor: p.controlBorder, borderWidth: 1, borderRadius: 16, padding: theme.space(2) },
    input: { color: p.text, fontSize: 16, lineHeight: 24, minHeight: 64, maxHeight: 144, padding: theme.space(2) },
    composerActions: { flexDirection: "row", alignItems: "center", gap: theme.space(2) },
    localLabel: { flex: 1, color: p.muted, fontSize: 12, lineHeight: 18 },
    button: { minWidth: 44, minHeight: 44, paddingHorizontal: theme.space(3), paddingVertical: theme.space(2), borderRadius: 12, alignItems: "center", justifyContent: "center" },
    primaryButton: { backgroundColor: p.solid },
    pressed: { backgroundColor: p.pressed },
    primaryPressed: { backgroundColor: p.solidPressed },
    disabled: { backgroundColor: p.disabledSurface },
    buttonText: { color: p.text, fontSize: 14, fontWeight: "600" },
    actionText: { color: p.accent, fontSize: 14, fontWeight: "600" },
    primaryText: { color: p.onAccent, fontSize: 14, fontWeight: "600" },
    attachment: { flexDirection: "row", alignItems: "center", gap: theme.space(2), paddingStart: theme.space(2), borderTopWidth: 1, borderTopColor: p.border },
    attachmentName: { color: p.text, fontSize: 13, flex: 1 },
    working: { color: p.muted, fontSize: 14, lineHeight: 22 },
  });
}
