import { expect, mock, test } from "bun:test";
import { join } from "node:path";

/** The three states that matter here; `AppState` reports others on Android. */
type Status = "active" | "inactive" | "background";

/**
 * `react-native` cannot be imported here — it ships Flow-typed source the test
 * runner cannot parse — so `AppState` is stubbed before the module under test
 * evaluates. Only the two members it touches are needed: the state it starts
 * from, and the change listener it registers.
 *
 * The stub keeps that listener, and every test below drives the store through
 * it. That is deliberately the real path rather than a test-only setter: a
 * setter would still pass if the module stopped subscribing to `AppState`
 * altogether, which in the app would freeze the answer at whatever it was on
 * launch and quietly leave every animation running in the background forever.
 */
let registered: ((next: Status) => void) | undefined;

// `void`: this returns a promise the linter insists on, and the module registry
// is populated synchronously — awaiting at the top level would be the only
// statement in the file that needs the suite to be async.
void mock.module("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (event: string, handler: (next: Status) => void) => {
      if (event === "change") registered = handler;
      return { remove: () => {} };
    },
  },
}));

// Dynamic, so the stub is installed before this module evaluates; a static
// import would be hoisted above it.
const { isAppActive, subscribeAppActive } = await import("./useAppActive");

function setAppState(next: Status) {
  if (!registered) throw new Error("useAppActive registered no change listener");
  registered(next);
}

test("the store subscribes to AppState on import", () => {
  // Everything else here depends on this, and without it the store would report
  // the launch state forever.
  expect(registered).toBeDefined();
});

test("only `active` counts as active", () => {
  setAppState("active");
  expect(isAppActive()).toBe(true);
});

test("`inactive` counts as stopped, exactly like `background`", () => {
  // The app switcher, a system prompt, an incoming call. The app is either off
  // screen or not interactive, so there is nothing worth animating for.
  setAppState("active");
  setAppState("inactive");
  expect(isAppActive()).toBe(false);

  setAppState("active");
  setAppState("background");
  expect(isAppActive()).toBe(false);
});

test("a change in the answer notifies subscribers", () => {
  setAppState("active");
  let notifications = 0;
  const unsubscribe = subscribeAppActive(() => {
    notifications += 1;
  });

  setAppState("background");
  expect(notifications).toBe(1);

  setAppState("active");
  expect(notifications).toBe(2);

  unsubscribe();
});

test("a transition between two stopped states notifies nobody", () => {
  // The case the guard exists for: iOS passes through `inactive` on its way to
  // `background`, and both mean stopped. Without the guard that second step
  // would re-render every animated component in the app for a value each one
  // would read identically.
  setAppState("active");
  let notifications = 0;
  const unsubscribe = subscribeAppActive(() => {
    notifications += 1;
  });

  setAppState("inactive");
  expect(notifications).toBe(1);

  setAppState("background");
  expect(notifications).toBe(1);
  expect(isAppActive()).toBe(false);

  unsubscribe();
});

test("re-entering the state it is already in notifies nobody", () => {
  setAppState("active");
  let notifications = 0;
  const unsubscribe = subscribeAppActive(() => {
    notifications += 1;
  });

  setAppState("active");
  expect(notifications).toBe(0);

  unsubscribe();
});

test("an unsubscribed listener stops hearing about changes", () => {
  // `useSyncExternalStore` unsubscribes on unmount, and a leak here would mean
  // every screen ever opened still being woken on each foreground.
  setAppState("active");
  let notifications = 0;
  const unsubscribe = subscribeAppActive(() => {
    notifications += 1;
  });

  unsubscribe();
  setAppState("background");
  expect(notifications).toBe(0);
});

test.each(["reduceMotion", "reduceTransparency"] as const)(
  "%s prefers current events over an older initial snapshot",
  setting => {
    const cases = [
      { order: "event-first", event: true, snapshot: false, expected: true },
      // A false event must count even though false is also the initial default.
      { order: "event-first", event: false, snapshot: true, expected: false },
      { order: "query-first", event: false, snapshot: true, expected: false },
      { order: "query-only", event: false, snapshot: true, expected: true },
      { order: "during-query", event: true, snapshot: false, expected: true },
      { order: "failed-query", event: true, snapshot: false, expected: true },
    ];
    for (const scenario of cases) {
      // Isolate native/React boundary mocks from the other app-state tests.
      const script = `
        import { mock } from "bun:test";
        const setting = ${JSON.stringify(setting)};
        const scenario = ${JSON.stringify(scenario)};
        const handlers = new Map();
        let resolveQuery, rejectQuery;
        const pending = new Promise((resolve, reject) => { resolveQuery = resolve; rejectQuery = reject; });
        const query = name => {
          if (name !== setting) return Promise.resolve(false);
          if (scenario.order === "during-query") handlers.get(name + "Changed")(scenario.event);
          return pending;
        };
        mock.module("react", () => ({ useSyncExternalStore: (_subscribe, read) => read() }));
        mock.module("react-native", () => ({ AccessibilityInfo: {
          isReduceMotionEnabled: () => query("reduceMotion"),
          isReduceTransparencyEnabled: () => query("reduceTransparency"),
          addEventListener: (event, handler) => { handlers.set(event, handler); return { remove() {} }; },
        } }));
        const store = await import(${JSON.stringify(join(import.meta.dir, "accessibilityState.ts"))});
        const read = setting === "reduceMotion" ? store.useReducedMotion : store.useReduceTransparency;
        const emit = () => handlers.get(setting + "Changed")(scenario.event);
        if (scenario.order === "event-first" || scenario.order === "failed-query") emit();
        if (scenario.order === "failed-query") rejectQuery(new Error("native query failed"));
        else resolveQuery(scenario.snapshot);
        await Promise.resolve();
        await Promise.resolve();
        if (scenario.order === "query-first") emit();
        console.log(JSON.stringify(read()));
      `;
      const result = Bun.spawnSync([process.execPath, "--eval", script], { stdout: "pipe", stderr: "pipe" });
      expect(new TextDecoder().decode(result.stderr)).toBe("");
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(new TextDecoder().decode(result.stdout))).toBe(scenario.expected);
    }
  },
);
