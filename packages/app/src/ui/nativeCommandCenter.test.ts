import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { motion, createMotionEasings } from "../motionTokens";
import type { WorkspaceBrowse } from "../useDaemon";

const source = (name: string) => readFileSync(join(import.meta.dir, name), "utf8");

test("the agent filter is a neutral menu row with a small provider marker", () => {
  const drawer = source("Sidebar.tsx");
  expect(drawer).toContain('caption="Agent"');
  expect(drawer).toContain("valueMarker=");
  expect(drawer).not.toContain("LinearGradient");
});

test("pickers are the system menu, not hand-drawn dropdowns", () => {
  // A scrim, a glass card and hand-tuned clamping used to stand in for UIMenu;
  // the native one positions, scrolls and reads to VoiceOver like every other.
  expect(source("MenuRow.tsx")).toContain("<NativeMenu");
  expect(source("NativeMenu.tsx")).toContain("@react-native-menu/menu");
  expect(source("Sheet.tsx")).toContain("@lodev09/react-native-true-sheet");
});

test("shared controls keep the Apple minimum touch target", () => {
  const controls = source("controls.tsx");
  expect(controls).toContain("theme.size.touch");
  expect(controls).toContain("accessibilityState={{ disabled }}");
});

test("reconnect is a large always-available drawer action with confirmation", () => {
  const drawer = source("Sidebar.tsx");
  const action = drawer.slice(drawer.indexOf("          {/* Always reachable"), drawer.indexOf("          <AppearanceSheet"));
  expect(action).toContain('accessibilityLabel="Forget connection & reconnect"');
  expect(action).not.toContain("disabled=");
  expect(action).toContain("reconnectDialog(machineLabel, () => {");
  expect(action).toContain("Alert.alert(dialog.title, dialog.message, dialog.buttons)");
  expect(action).toContain("onUnpair();");
  expect(drawer).toContain("minHeight: theme.size.touch + theme.space(3)");
});

test("forgetting clears local pairing and opens the native scanner", () => {
  const app = source("../../App.tsx");
  const start = app.indexOf("  const unpair =");
  expect(start).toBeGreaterThan(-1);
  const unpair = app.slice(start, app.indexOf("  if (!checked)", start));
  expect(unpair).toContain("forgetConnection({");
  expect(unpair).toContain("clearPairing,");
  expect(unpair).toContain("clearProviders: clearCachedProviders,");
  expect(unpair).toContain("setPairing(null)");
  expect(unpair).toContain('setConnecting("scan")');
  expect(app).toContain('startScanning={connecting === "scan"}');
  expect(source("PairingScreen.tsx")).toContain('startScanning && (Platform.OS === "ios" || Platform.OS === "android")');
});

test("glass is restricted to raised overlays without edge decoration", () => {
  const glass = source("Glass.tsx");
  expect(glass).toContain('tier === "raised"');
  expect(glass).not.toContain("EdgeHighlight");
  expect(glass).not.toContain("Sheen");
});

test("approval card names include the actual request before the decision buttons", () => {
  const ast = ts.createSourceFile("ActivityScreen.tsx", source("ActivityScreen.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: string | undefined;
  function find(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "PermissionCard") {
      function visit(child: ts.Node) {
        if (ts.isJsxAttribute(child) && child.name.getText() === "accessibilityLabel" &&
            child.initializer && ts.isJsxExpression(child.initializer)) {
          expression = child.initializer.expression?.getText();
        }
        ts.forEachChild(child, visit);
      }
      visit(node);
    }
    ts.forEachChild(node, find);
  }
  find(ast);
  if (!expression) throw new Error("Missing approval label");
  expect(runInNewContext(expression, {
    session: { title: "Dependency update" },
    permission: { title: "Run npm install" },
    provider: {}, providerLabel: () => "Agent A in demo",
  }, { timeout: 1000 })).toBe("Open Dependency update. Permission needed: Run npm install. Agent A in demo.");
});

test("empty-state names retain visible connection errors and the dismissal action", () => {
  const app = source("../../App.tsx");
  const ast = ts.createSourceFile("App.tsx", app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function initializer(name: string): string {
    let result: string | undefined;
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText() === name) result = node.initializer?.getText();
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (!result) throw new Error(`Missing ${name}`);
    return ts.transpileModule(`(${result})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  }
  const messageExpression = initializer("emptyMessage");
  const labelExpression = initializer("emptyAccessibilityLabel");
  const emptyReason: unknown = runInNewContext(initializer("emptyReason"), {}, { timeout: 1000 });
  const cases = [
    { status: "offline", fatal: "Pairing key was rotated.", unreachable: true, available: true, count: 1, message: "Pairing key was rotated.", connection: "Offline" },
    { status: "connecting", fatal: undefined, unreachable: true, available: true, count: 1, message: "Can't reach your machine.", connection: "Offline" },
    { status: "connecting", fatal: undefined, unreachable: false, available: false, count: 0, message: "Connecting to your machine…", connection: "Offline" },
    { status: "online", fatal: undefined, unreachable: false, available: true, count: 1, message: "Ready when you are.", connection: "Connected" },
    { status: "online", fatal: undefined, unreachable: false, available: false, count: 0, message: "Getting the list of agents…", connection: "Connected" },
    { status: "online", fatal: undefined, unreachable: false, available: false, count: 1, message: "No agents are turned on. Run pew2 setup on your computer to choose some.", connection: "Connected" },
  ];
  for (const scenario of cases) {
    const context = {
      daemon: { status: scenario.status, fatal: scenario.fatal, unreachable: scenario.unreachable, providers: Array.from({ length: scenario.count }) },
      active: scenario.available ? { name: "Agent A" } : undefined,
      greeting: "Ready when you are.", emptyReason,
      selectedProject: undefined, pairing: { label: "Example machine" },
    };
    const emptyMessage: unknown = runInNewContext(messageExpression, context, { timeout: 1000 });
    expect(emptyMessage).toBe(scenario.message);
    expect(runInNewContext(labelExpression, { ...context, emptyMessage }, { timeout: 1000 })).toBe([
      scenario.available ? "Agent A" : "No agent available",
      "Example machine", scenario.connection, scenario.message, "Dismiss keyboard",
    ].join("\n"));
  }
  const start = app.indexOf("style={styles.greeting}");
  const greeting = app.slice(start, app.indexOf("</Pressable>", start));
  expect(greeting).toContain("accessibilityLabel={emptyAccessibilityLabel}");
  expect(greeting).toContain("{emptyMessage}");
  expect(greeting).toContain("onPress={Keyboard.dismiss}");
});

test("markdown rendering preserves descriptions through the image and viewer", () => {
  expect(source("MarkdownText.tsx")).toContain("const image = imageFromMarkdown(node)");
  expect(source("MarkdownText.tsx")).toContain("image={image}");
  expect(source("ChatImage.tsx")).toContain('accessibilityLabel={`${image.alt || "Image from the agent"}. Tap to view and save`}');
  expect(source("ChatImage.tsx")).toContain("image={image}");
  expect(source("ImageViewer.tsx")).toContain('accessibilityLabel={image.alt || "Image from the agent"}');
});

test("shared motion profiles preserve the existing rhythms and spring tuning", () => {
  expect(motion).toEqual({
    fast: 120, base: 180, composerExpand: 140, rowReveal: 180, rowStagger: 18,
    titleOut: 110, titleIn: 150, iconEnter: 160, activitySwap: 160, receipt: 260,
    skeletonPulse: 650, sessionPulse: 700, workingPulse: 320, workingStagger: 160,
    shimmerSweep: 1800, activitySweep: 2200, commandPause: 900,
    drawerSpring: { duration: 340, dampingRatio: 0.95 },
    stepSpring: { duration: 340, dampingRatio: 0.92 },
    chipSpring: { damping: 24, stiffness: 300, mass: 0.8 },
  });
  // Each engine builds its own easing functions; JS functions must not be
  // passed to Reanimated's UI thread.
  expect(createMotionEasings({
    ease: "ease", quad: "quad", cubic: "cubic",
    inOut: curve => `inOut(${curve})`, out: curve => `out(${curve})`,
    bezier: (...points) => ({ points }),
  })).toEqual({
    standard: { points: [0.22, 1, 0.36, 1] },
    nativeTiming: "inOut(ease)", inOutQuad: "inOut(quad)", outCubic: "out(cubic)",
  });
});

test("app-owned timing stays in profiles while keyboard timing stays platform-owned", () => {
  for (const name of [
    "ActivityLine.tsx", "ActivityScreen.tsx", "ChatThread.tsx", "CommandToken.tsx",
    "Composer.tsx", "NewChatSheet.tsx", "Sheet.tsx", "Sidebar.tsx", "Skeleton.tsx",
    "ShimmerText.tsx", "TurnReceipt.tsx",
  ]) {
    const text = source(name);
    expect(text).not.toMatch(/\bduration\s*:\s*[1-9]\d*/);
    expect(text).not.toMatch(/\.duration\(\s*[1-9]\d*/);
    expect(text).not.toMatch(/Easing\.(?:out|inOut|bezier)\(/);
  }
  const root = source("../../App.tsx");
  expect(root).toContain("const DRAWER_SETTLE = motion.drawerSpring");
  expect(root).toContain("duration: event.duration, easing: KEYBOARD_CURVE");
  expect(source("Composer.tsx")).toContain("createMotionEasings(ReanimatedEasing)");
  expect(source("Sheet.tsx")).toContain("createMotionEasings(Easing)");
});

/** Execute the actual effect body; only the hooks/animation boundary is modeled. */
function motionEffect(file: string, component: string): string {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect: string | undefined;
  function find(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === component) {
      function visit(child: ts.Node) {
        if (!effect && ts.isCallExpression(child) && child.expression.getText() === "useEffect") {
          effect = child.arguments[0]?.getText();
        }
        ts.forEachChild(child, visit);
      }
      visit(node);
    }
    ts.forEachChild(node, find);
  }
  find(ast);
  if (!effect) throw new Error(`No effect in ${component}`);
  return `(${effect})()`;
}

test("an unchanged tool settles its active fade when reduced motion is enabled", () => {
  const effect = motionEffect("ActivityLine.tsx", "ActivityLineView");
  let active = false;
  let opacity = 1;
  let starts = 0;
  const context = {
    tool: { id: "second" }, shown: { current: "first" }, reduceMotion: false,
    fade: { setValue(value: number) { active = false; opacity = value; } },
    SWAP_FROM: 0.35, SWAP_DURATION: motion.activitySwap,
    nativeMotionEasings: { nativeTiming: (value: number) => value },
    Animated: { timing: () => ({ start() { active = true; starts++; }, stop() { active = false; } }) },
  };
  const cleanup: unknown = runInNewContext(effect, context, { timeout: 1000 });
  expect(active).toBe(true);
  expect(typeof cleanup).toBe("function");
  if (typeof cleanup === "function") cleanup();
  context.reduceMotion = true;
  runInNewContext(effect, context, { timeout: 1000 });
  expect(active).toBe(false);
  expect(opacity).toBe(1);
  context.reduceMotion = false;
  runInNewContext(effect, context, { timeout: 1000 });
  expect(starts).toBe(1);
});

test("a sheet title settles on reduced motion and ignores a queued stale title commit", () => {
  const effect = motionEffect("Sheet.tsx", "CrossfadeTitle");
  let rendered = "first";
  let active = false;
  const callbacks: ((finished: boolean) => void)[] = [];
  const jsQueue: (() => void)[] = [];
  const context = {
    title: "second", shown: { current: "first" }, reduceMotion: false,
    fade: { value: 1 }, motion, sheetEasings: { inOutQuad: (value: number) => value },
    setRendered(value: string) { rendered = value; },
    withTiming(to: number, _config: unknown, finished?: (done: boolean) => void) {
      active = true;
      if (finished) callbacks.push(finished);
      return to;
    },
    cancelAnimation() { active = false; },
    runOnJS(fn: () => void) { return () => { jsQueue.push(fn); }; },
  };
  const cleanup: unknown = runInNewContext(effect, context, { timeout: 1000 });
  expect(typeof cleanup).toBe("function");
  expect(active).toBe(true);
  // UI-thread completion has queued a JS title update, but it has not run yet.
  callbacks[0]?.(true);
  expect(jsQueue).toHaveLength(1);
  if (typeof cleanup === "function") cleanup();
  context.reduceMotion = true;
  runInNewContext(effect, context, { timeout: 1000 });
  expect(active).toBe(false);
  expect(context.fade.value).toBe(1);
  expect(rendered).toBe("second");
  context.title = "third";
  runInNewContext(effect, context, { timeout: 1000 });
  for (const commit of jsQueue) commit();
  expect(rendered).toBe("third");
  expect(context.fade.value).toBe(1);
});

/** Select and execute production expressions without importing native modules. */
function sourceExpression(file: string, select: (node: ts.Node) => ts.Node | undefined): string {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    found ??= select(node);
    if (!found) ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!found) throw new Error(`Missing expression in ${file}`);
  return ts.transpileModule(`(${found.getText()})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
}

test("approval and settings scroll within the screen below a measured header", () => {
  expect(source("ApprovalSheet.tsx")).toContain('title="Approval needed" scrollContent');
  expect(source("ApprovalSheet.tsx")).not.toContain("onClose=");
  expect(source("AppearanceSheet.tsx")).toContain('title="Settings" scrollContent');
  expect(source("AppearanceSheet.tsx")).toContain('flexWrap: "wrap"');
  const sheet = source("Sheet.tsx");
  expect(sheet).toContain("setHeaderHeight(event.nativeEvent.layout.height)");
  expect(sheet).toContain("{scrollContent ? (");
  expect(sheet).toContain("<ScrollView");
  expect(sheet).toContain("maxHeight: contentHeight");
  const heightExpression = sourceExpression("Sheet.tsx", node =>
    ts.isVariableDeclaration(node) && node.name.getText() === "contentHeight" ? node.initializer : undefined,
  );
  for (const [height, headerHeight, top, bottom] of [
    [568, 68, 20, 0], [320, 68, 0, 21], [568, 140, 20, 0], [844, 68, 59, 34],
  ]) {
    const available: unknown = runInNewContext(heightExpression, {
      height, headerHeight, insets: { top, bottom }, theme: { space: (n: number) => n * 4 },
    }, { timeout: 1000 });
    expect(typeof available).toBe("number");
    if (typeof available !== "number" || height === undefined || headerHeight === undefined || top === undefined || bottom === undefined) throw new Error("Missing height fixture");
    expect(available).toBeGreaterThan(0);
    expect(available + headerHeight + top + bottom + 32).toBeLessThanOrEqual(height);
  }
});

test("an empty transcript has a named busy state while its history loads", () => {
  const loading = sourceExpression("../../App.tsx", node =>
    ts.isConditionalExpression(node) && node.condition.getText() === "daemon.loadingSession" ? node.whenTrue : undefined,
  );
  expect(loading).toContain('accessibilityLabel: "Loading conversation"');
  expect(loading).toContain("busy: true");
  expect(loading).toContain("ActivityIndicator");
  expect(loading).toContain("Loading conversation");
});

test("notification reply actions require authentication and foreground the app", async () => {
  const code = sourceExpression("notifier.ts", node =>
    ts.isFunctionDeclaration(node) && node.name?.text === "registerCategory" ? node : undefined,
  ).replace("export ", "");
  const actionId: unknown = runInNewContext(sourceExpression("notifier.ts", node =>
    ts.isVariableDeclaration(node) && node.name.getText() === "REPLY_ACTION" ? node.initializer : undefined,
  ));
  expect(actionId).not.toBe("reply");
  let calls = 0;
  const register: unknown = runInNewContext(code, {
    CATEGORY: "agentTurn", REPLY_ACTION: actionId,
    Notifications: { setNotificationCategoryAsync: async (_category: string, actions: unknown[]) => {
      calls++;
      expect(actions).toMatchObject([{ identifier: actionId, options: { opensAppToForeground: true, isAuthenticationRequired: true } }]);
    } },
  }, { timeout: 1000 });
  if (typeof register !== "function") throw new Error("Missing registration");
  await register();
  expect(calls).toBe(1);
});

test("notification replies wait for foreground, reject legacy actions and dispatch once", () => {
  const choiceCode = sourceExpression("notifier.ts", node =>
    ts.isFunctionDeclaration(node) && node.name?.text === "choiceOf" ? node : undefined,
  );
  const actionId = runInNewContext(sourceExpression("notifier.ts", node =>
    ts.isVariableDeclaration(node) && node.name.getText() === "REPLY_ACTION" ? node.initializer : undefined,
  ));
  const choiceOf: unknown = runInNewContext(choiceCode, { REPLY_ACTION: actionId });
  if (typeof choiceOf !== "function") throw new Error("Missing choice parser");
  const response = { actionIdentifier: actionId, userText: "continue", notification: { request: { identifier: "notice", content: { data: { sessionId: "s1" } } } } };
  expect(choiceOf({ ...response, actionIdentifier: "reply" })).toEqual({ sessionId: "s1", text: undefined });
  let changed: ((state: string) => void) | undefined;
  let received: ((response: unknown) => void) | undefined;
  let removed = 0;
  const appState = {
    currentState: "background",
    addEventListener: (_event: string, callback: (state: string) => void) => {
      changed = callback;
      return { remove: () => { removed++; } };
    },
  };
  // Remove the export modifier before compiling this declaration as an expression.
  const file = ts.createSourceFile("notifier.ts", source("notifier.ts"), ts.ScriptTarget.Latest, true);
  const declaration = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "onNotificationChoice");
  if (!declaration) throw new Error("Missing subscription");
  const code = ts.transpileModule(`(${declaration.getText().replace(/^export /, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const subscribe: unknown = runInNewContext(code, {
    AppState: appState, choiceOf, handled: new Set(),
    Notifications: {
      getLastNotificationResponse: () => response,
      addNotificationResponseReceivedListener: (callback: (response: unknown) => void) => {
        received = callback;
        return { remove: () => { removed++; } };
      },
    },
  }, { timeout: 1000 });
  if (typeof subscribe !== "function") throw new Error("Missing subscription callback");
  const dispatched: unknown[] = [];
  const unsubscribe: unknown = subscribe((value: unknown) => dispatched.push(value));
  received?.(response);
  expect(dispatched).toHaveLength(0);
  appState.currentState = "active";
  changed?.("active");
  expect(dispatched).toEqual([{ sessionId: "s1", text: "continue" }]);
  received?.(response);
  changed?.("active");
  expect(dispatched).toHaveLength(1);
  if (typeof unsubscribe !== "function") throw new Error("Missing cleanup");
  unsubscribe();
  expect(removed).toBe(2);
});

function browseHarness(sent: boolean | "throws" = true) {
  type State = { status: string; browse?: WorkspaceBrowse };
  let state: State = { status: "online" };
  let nextTimer = 0;
  const timers = new Map<number, () => void>();
  const context = {
    get state() { return state; },
    browseCounter: { current: 0 }, browseRequest: { current: undefined as string | undefined },
    post: () => {
      if (sent === "throws") throw new Error("closed");
      return sent;
    },
    setState: (update: (previous: State) => State) => { state = update(state); },
    WORKSPACE_BROWSE_TIMEOUT: 10_000,
    setTimeout: (callback: () => void, delay: number) => {
      expect(delay).toBe(10_000);
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout: (timer: number) => { timers.delete(timer); },
  };
  const action = sourceExpression("../useDaemon.ts", node =>
    ts.isPropertyAssignment(node) && node.name.getText() === "browseWorkspaces" ? node.initializer : undefined,
  );
  const effect = sourceExpression("../useDaemon.ts", node => {
    if (!ts.isCallExpression(node) || node.expression.getText() !== "useEffect") return undefined;
    const callback = node.arguments[0];
    return callback?.getText().includes("WORKSPACE_BROWSE_TIMEOUT") ? callback : undefined;
  });
  return {
    context, timers,
    get state() { return state; },
    set state(value: State) { state = value; },
    browse(path?: string) {
      const callback: unknown = runInNewContext(action, context, { timeout: 1000 });
      if (typeof callback !== "function") throw new Error("Missing browse action");
      callback(path);
    },
    effect() {
      const callback: unknown = runInNewContext(effect, {
        ...context, state, browseRequestId: state.browse?.requestId, browseLoading: state.browse?.loading === true,
      }, { timeout: 1000 });
      if (typeof callback !== "function") throw new Error("Missing browse effect");
      const cleanup: unknown = callback();
      return () => { if (typeof cleanup === "function") cleanup(); };
    },
    reply(message: { t: "workspaces"; requestId: string; path?: string; entries: unknown[]; refused?: boolean }) {
      const ast = ts.createSourceFile("useDaemon.ts", source("../useDaemon.ts"), ts.ScriptTarget.Latest, true);
      let handler: string | undefined;
      function visit(node: ts.Node) {
        if (ts.isIfStatement(node) && node.expression.getText().startsWith('message.t === "workspaces"')) handler = node.thenStatement.getText();
        ts.forEachChild(node, visit);
      }
      visit(ast);
      if (!handler) throw new Error("Missing browse response handler");
      const code = ts.transpileModule(`(() => ${handler})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      runInNewContext(code, { ...context, message }, { timeout: 1000 });
    },
  };
}

test("failed and throwing folder sends report offline, not an empty result", () => {
  for (const result of [false, "throws"] as const) {
    const harness = browseHarness(result);
    harness.browse("/missing");
    expect(harness.state.browse).toMatchObject({ loading: false, error: "offline", requestedPath: "/missing", refused: false });
    harness.effect();
    expect(harness.timers.size).toBe(0);
  }
});

test("folder deadlines end on timeout, disconnect, completion and replacement", () => {
  const harness = browseHarness();
  harness.browse("/slow");
  const cleanup = harness.effect();
  const oldTimeout = [...harness.timers.values()][0];
  harness.browse("/newer");
  cleanup();
  expect(harness.timers.size).toBe(0);
  oldTimeout?.();
  expect(harness.state.browse?.loading).toBe(true);
  expect(harness.state.browse?.error).toBeUndefined();
  harness.effect();
  for (const timer of harness.timers.values()) timer();
  expect(harness.state.browse).toMatchObject({ loading: false, error: "timeout", requestedPath: "/newer" });

  harness.browse("/again");
  harness.state = { ...harness.state, status: "offline" };
  harness.effect();
  expect(harness.state.browse).toMatchObject({ loading: false, error: "offline" });

  harness.state = { ...harness.state, status: "online" };
  harness.browse();
  const finish = harness.effect();
  const lateTimeout = [...harness.timers.values()].at(-1);
  const requestId = harness.state.browse?.requestId;
  if (!requestId) throw new Error("Missing request id");
  harness.reply({ t: "workspaces", requestId, entries: [] });
  finish();
  lateTimeout?.();
  expect(harness.state.browse).toMatchObject({ loading: false, entries: [] });
  expect(harness.state.browse?.error).toBeUndefined();
  expect(harness.state.browse?.path).toBeUndefined();
});

test("folder retries keep the confirmed listing and target, while stale replies are ignored", () => {
  const harness = browseHarness();
  const entries = [{ path: "/shown/child", name: "child", repo: false }];
  harness.state = { status: "online", browse: { path: "/shown", parent: "/", entries, loading: false, refused: false } };
  harness.browse("/refused");
  expect(harness.state.browse).toMatchObject({ path: "/shown", entries, requestedPath: "/refused", loading: true });
  const requestId = harness.state.browse?.requestId;
  if (!requestId) throw new Error("Missing request id");
  harness.reply({ t: "workspaces", requestId, entries: [], refused: true });
  expect(harness.state.browse).toMatchObject({ path: "/shown", entries, refused: true, loading: false });
  harness.browse();
  expect(harness.state.browse?.requestedPath).toBeUndefined();
  harness.reply({ t: "workspaces", requestId, path: "/stale", entries: [] });
  expect(harness.state.browse?.path).toBe("/shown");
  expect(harness.state.browse?.loading).toBe(true);
});

test("folder progress and retry stay above retained entries and errors suppress empty copy", () => {
  const picker = source("NewChatSheet.tsx");
  const browser = picker.slice(picker.indexOf("{browsing && ("));
  expect(browser.indexOf("{browse?.loading ? (")).toBeLessThan(browser.indexOf("<ScrollView"));
  expect(browser.indexOf('accessibilityLabel="Retry loading folders"')).toBeLessThan(browser.indexOf("<ScrollView"));
  expect(browser).toContain("onBrowse?.(browse?.requestedPath)");
  expect(browser).toContain("browseEntries.length === 0 && !browse?.loading && !browseError");
  const error = sourceExpression("NewChatSheet.tsx", node =>
    ts.isVariableDeclaration(node) && node.name.getText() === "browseError" ? node.initializer : undefined,
  );
  for (const [browse, message] of [
    [{ error: "offline" }, "Your computer is offline"],
    [{ error: "timeout" }, "Your computer didn't answer"],
    [{ refused: true }, "That folder can't be opened"],
    [{ refused: false }, undefined],
  ]) {
    expect(runInNewContext(error, { browse }, { timeout: 1000 })).toBe(message);
  }
});
