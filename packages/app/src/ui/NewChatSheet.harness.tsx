/**
 * Dev-only visual harness for the "New chat" sheet.
 *
 * Renders it over a stand-in conversation so the card, the scrim and all three
 * steps can be checked against the same bottom edge the real sheet uses. Not
 * reachable from the app; point index.ts here and run `npx expo run:ios`.
 * `Sheet` is native-only and intentionally renders blank in the web harness.
 *
 * The cold-start toggle is the case worth looking at: an agent with no history
 * has no projects, so the sheet has to lead with browsing or it is a dead end.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { theme } from "../theme";
import { NewChatSheet } from "./NewChatSheet";
import type { Project } from "../projects";
import { WorkspaceCreateError, type WorkspaceBrowse } from "../useDaemon";

const PROJECTS: Project[] = [
  { path: "/Users/k/gg-projects/pew2", name: "pew2", sessions: 24 },
  { path: "/Users/k/gg-projects/kencode-search", name: "kencode-search", sessions: 7 },
  { path: "/Users/k/work/acme-storefront", name: "acme-storefront", sessions: 3 },
  { path: "/Users/k/work/notes", name: "notes", sessions: 1 },
  { path: "/Users/k/work/infra", name: "infra", sessions: 12 },
  { path: "/Users/k/work/scratch", name: "scratch", sessions: 2 },
];

/** A stand-in filesystem, shaped like what the daemon actually answers. */
const DISK: Record<string, WorkspaceBrowse> = {
  "": {
    entries: [
      { path: "/Users/k/gg-projects/pew2", name: "pew2", repo: true },
      { path: "/Users/k/work/acme-storefront", name: "acme-storefront", repo: true },
      { path: "/Users/k/work/infra", name: "infra", repo: true },
    ],
    loading: false,
    refused: false,
  },
  "/Users/k": {
    path: "/Users/k",
    entries: [
      { path: "/Users/k/gg-projects", name: "gg-projects", repo: false },
      { path: "/Users/k/work", name: "work", repo: false },
      { path: "/Users/k/notes", name: "notes", repo: false },
    ],
    loading: false,
    refused: false,
  },
  "/Users/k/work": {
    path: "/Users/k/work",
    parent: "/Users/k",
    entries: [
      { path: "/Users/k/work/acme-storefront", name: "acme-storefront", repo: true },
      { path: "/Users/k/work/infra", name: "infra", repo: true },
      { path: "/Users/k/work/scratch", name: "scratch", repo: false },
    ],
    loading: false,
    refused: false,
  },
};

export default function NewChatSheetHarness() {
  const [visible, setVisible] = useState(true);
  const [started, setStarted] = useState<string>("nothing yet");
  // The whole reason browsing exists: no projects means no way in without it.
  const [cold, setCold] = useState(false);
  const [browse, setBrowse] = useState<WorkspaceBrowse | undefined>(undefined);
  const [oldDaemon, setOldDaemon] = useState(false);
  const [createFixture, setCreateFixture] = useState<
    "success" | "duplicate" | "error" | "loading"
  >("success");

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Text style={styles.heading}>Conversation behind the sheet</Text>
        <Text style={styles.body}>
          The sheet rises from the bottom edge over this. Tap the scrim to dismiss it.
        </Text>
        <Text style={styles.body}>Last start: {started}</Text>
        <Pressable style={styles.button} onPress={() => setVisible(true)}>
          <Text style={styles.buttonText}>Open the sheet</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => setCold((c) => !c)}>
          <Text style={styles.buttonText}>
            {cold ? "Agent with 6 projects" : "Agent with no history (cold start)"}
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => setOldDaemon((value) => !value)}>
          <Text style={styles.buttonText}>{oldDaemon ? "New daemon" : "Old daemon"}</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={() =>
            setCreateFixture((value) =>
              value === "success"
                ? "duplicate"
                : value === "duplicate"
                  ? "error"
                  : value === "error"
                    ? "loading"
                    : "success",
            )
          }
        >
          <Text style={styles.buttonText}>Create fixture: {createFixture}</Text>
        </Pressable>
      </View>

      <NewChatSheet
        visible={visible}
        currentFolder={cold ? undefined : "pew2"}
        currentCwd={cold ? undefined : "/Users/k/gg-projects/pew2"}
        projects={cold ? [] : PROJECTS}
        onStart={(cwd) => {
          setStarted(cwd ?? "the agent's last project");
          setVisible(false);
        }}
        onClose={() => setVisible(false)}
        browse={browse}
        canCreateWorkspace={!oldDaemon}
        onCreate={async (parent, name) => {
          if (createFixture === "loading") {
            await new Promise(() => {});
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (createFixture === "duplicate") throw new WorkspaceCreateError("already_exists");
          if (createFixture === "error") throw new WorkspaceCreateError("create_failed");
          const path = `${parent ?? "/Users/k/gg-projects"}/${name}`;
          return { path, name, sessions: 0 };
        }}
        onBrowse={(path) => {
          // Latency is deliberate: the loading state is otherwise never seen,
          // and it is what the pane looks like on a cold scan of a real disk.
          setBrowse((prev) => ({
            path: path ?? prev?.path,
            parent: prev?.parent,
            entries: prev?.entries ?? [],
            loading: true,
            refused: false,
          }));
          setTimeout(() => {
            const listing = DISK[path ?? ""];
            setBrowse((prev) =>
              listing
                ? { ...listing, loading: false, refused: false }
                : // Mirrors the real reducer: a refusal keeps the listing the
                  // user was on, so the notice appears *over* it rather than
                  // dropping them back to the suggestions view.
                  {
                    path: prev?.path,
                    parent: prev?.parent,
                    entries: prev?.entries ?? [],
                    loading: false,
                    refused: true,
                  },
            );
          }, 350);
        }}
      />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space(6), gap: theme.space(3) },
  heading: { color: theme.color.text, fontSize: theme.font.title, fontWeight: "600" },
  body: { color: theme.color.textDim, fontSize: theme.font.body },
  button: {
    alignSelf: "flex-start",
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  buttonText: { color: theme.color.text, fontSize: theme.font.body },
});
