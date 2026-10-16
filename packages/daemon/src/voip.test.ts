import { describe, expect, it } from "bun:test";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wire } from "@pew2/protocol";
import { apnsJwt, apnsKeyPath, CallRinger, configureApns, writeVoiceConfig, type ApnsRequest } from "./voip.js";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const TOKEN = "ab".repeat(32);

async function setup(calls = true) {
  const env = { PEW2_HOME: mkdtempSync(join(tmpdir(), "pew2-voip-")) };
  const keyFile = join(env.PEW2_HOME, "AuthKey.p8");
  writeFileSync(keyFile, pem);
  await configureApns(keyFile, "KEY1234567", "TEAM123456", env);
  if (!calls) await writeVoiceConfig({ apns: { keyId: "KEY1234567", teamId: "TEAM123456" }, calls: false }, env);
  const sent: ApnsRequest[] = [];
  const broadcasts: unknown[] = [];
  let now = 1_000_000;
  const ringer = new CallRinger({
    env,
    broadcast: (m) => broadcasts.push(m),
    transport: async (r) => { sent.push(r); return { status: 200 }; },
    now: () => now,
  });
  ringer.voip.register("phone-1", { token: TOKEN, environment: "sandbox", bundleId: "com.example.pew2" });
  return { env, sent, broadcasts, ringer, advance: (ms: number) => (now += ms) };
}

describe("APNs", () => {
  it("signs an ES256 provider token", () => {
    const jwt = apnsJwt(pem, "KEY1234567", "TEAM123456", 1700000000);
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(c!, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1700000000 });
    expect(verify("sha256", Buffer.from(`${h}.${c}`), { key: createPublicKey(privateKey), dsaEncoding: "ieee-p1363" }, Buffer.from(s!, "base64url"))).toBe(true);
  });

  it("copies the key at 0600 and sends a VoIP push with the right headers", async () => {
    const { env, sent, broadcasts, ringer } = await setup();
    expect(statSync(apnsKeyPath(env)).mode & 0o777).toBe(0o600);
    const incoming = await ringer.ringForInput({ sessionId: "s1", providerId: "codex", folder: "pew2", agentName: "Codex" });
    expect(wire.VoiceIncoming.parse(incoming)).toBeTruthy();
    expect(incoming?.summary).toBe("Codex needs you in pew2");
    expect(broadcasts).toEqual([incoming]);
    expect(sent).toHaveLength(1);
    const r = sent[0]!;
    expect(r.host).toBe("api.sandbox.push.apple.com");
    expect(r.path).toBe(`/3/device/${TOKEN}`);
    expect(r.headers["apns-push-type"]).toBe("voip");
    expect(r.headers["apns-topic"]).toBe("com.example.pew2.voip");
    expect(r.headers["apns-priority"]).toBe("10");
    expect(r.headers["apns-expiration"]).toBe("0");
    expect(r.headers.authorization).toStartWith("bearer ");
    expect(JSON.parse(r.body)).toEqual(incoming as object);
  });

  it("rings at most once per session per two minutes", async () => {
    const { sent, ringer, advance } = await setup();
    expect(await ringer.ringForInput({ sessionId: "s1" })).toBeDefined();
    advance(60_000);
    expect(await ringer.ringForInput({ sessionId: "s1" })).toBeUndefined();
    expect(await ringer.ringForInput({ sessionId: "s2" })).toBeDefined();
    advance(61_000);
    expect(await ringer.ringForInput({ sessionId: "s1" })).toBeDefined();
    expect(sent).toHaveLength(3);
  });

  it("stays quiet when calls are off", async () => {
    const { sent, broadcasts, ringer } = await setup(false);
    expect(await ringer.ringManual({}, "phone-1")).toBeUndefined();
    expect(sent).toHaveLength(0);
    expect(broadcasts).toHaveLength(0);
  });

  it("manual calls ring only the asking phone", async () => {
    const { sent, ringer } = await setup();
    ringer.voip.register("phone-2", { token: "cd".repeat(32), environment: "production", bundleId: "x" });
    const incoming = await ringer.ringManual({}, "phone-2");
    expect(incoming?.reason).toBe("manual");
    expect(sent.map((r) => r.host)).toEqual(["api.push.apple.com"]);
  });

  it("also rings Android: every phone for input, only the asker for manual", async () => {
    const { env } = await setup();
    const android: (string | undefined)[] = [];
    const ringer = new CallRinger({
      env,
      broadcast: () => {},
      transport: async () => ({ status: 200 }),
      androidRing: async (_incoming, deviceId) => { android.push(deviceId); },
    });
    await ringer.ringForInput({ sessionId: "s1" });
    await ringer.ringManual({}, "droid");
    await ringer.ringManual({}, undefined);
    expect(android).toEqual([undefined, "droid"]);
  });
});
