import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Provider, Session } from "../useDaemon";
import { ActivityScreen } from "./ActivityScreen";

const providers: Provider[] = [
  { id: "claude-code", name: "Claude Code", description: "", available: true, color: "#d97757" },
  { id: "codex", name: "Codex", description: "", available: true, color: "#10a37f" },
  { id: "gemini-cli", name: "Gemini CLI", description: "", available: true, color: "#3d9bf5" },
];

const base = {
  startedAt: Date.now(),
  turns: [],
  configOptions: [],
};

const sessions: Session[] = [
  {
    ...base,
    id: "permission",
    providerId: "claude-code",
    title: "Update checkout tests",
    folder: "storefront",
    busy: true,
    permission: {
      requestId: "approve-tests",
      title: "Run: bun test checkout",
      options: [
        { optionId: "reject", name: "Deny" },
        { optionId: "allow", name: "Allow" },
      ],
    },
  },
  {
    ...base,
    id: "codex-working",
    providerId: "codex",
    title: "Fix webhook retry race",
    folder: "payments-api",
    busy: true,
  },
  {
    ...base,
    id: "gemini-working",
    providerId: "gemini-cli",
    title: "Audit responsive navigation",
    folder: "website",
    busy: true,
  },
  {
    ...base,
    id: "ready",
    providerId: "claude-code",
    title: "Checkout tests pass",
    folder: "storefront",
    unread: true,
    receipt: { verb: "Edited & ran", duration: "2m 4s", tools: 3, failed: 0 },
  },
];

export default function ActivityScreenHarness() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ActivityScreen
        sessions={sessions}
        providers={providers}
        status="online"
        reduceMotion={false}
        onClose={() => {}}
        onNewConversation={() => {}}
        onOpenSession={() => {}}
        onAnswerPermission={() => {}}
      />
    </SafeAreaProvider>
  );
}
