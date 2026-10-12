import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { pairingFromToken, pairingPath } from "./pairing.js";
import { AppClient } from "./testing/app-client.js";
import { startDaemon, type RunningDaemon } from "./testing/daemon-process.js";

// Isolated wire-level coverage only: not native app relaunch, machine reboot,
// or automatic launchd/systemd recovery. The live user's daemon is never touched.
test("saved pairing and device id reconnect a test client to a manually restarted daemon", async () => {
  const home = await mkdtemp(join(tmpdir(), "pew2-restart-pairing-"));
  const secret = randomBytes(32).toString("hex");
  const saved = { ...pairingFromToken(secret), claimedBy: "restart-test-phone" };
  const env = { PEW2_HOME: home, PEW2_TOKEN: "" };
  const path = pairingPath(env);
  await writeFile(path, JSON.stringify(saved), { mode: 0o600 });
  let process: RunningDaemon | undefined;
  let app: AppClient | undefined;
  try {
    process = await startDaemon({ secret, env });
    app = await AppClient.connect(process, { deviceId: saved.claimedBy });
    expect(app.all("providers").length).toBeGreaterThan(0);
    app.close();
    app = undefined;
    await process.stop();
    process = undefined;

    // New processes and crypto counters, but the same persisted credentials.
    process = await startDaemon({ secret, env });
    app = await AppClient.connect({ ...process, key: saved.key, token: saved.token }, { deviceId: saved.claimedBy });
    expect(app.all("providers").length).toBeGreaterThan(0);
    const persisted = JSON.parse(await readFile(path, "utf8"));
    expect(persisted.key === saved.key).toBe(true);
    expect(persisted.claimedBy).toBe(saved.claimedBy);
    expect(app.all("error")).toEqual([]);
  } finally {
    app?.close();
    await process?.stop();
  }
}, 60_000);
