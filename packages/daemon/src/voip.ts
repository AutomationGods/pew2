/**
 * Ringing the phone like a real call: CallKit via APNs VoIP pushes.
 *
 * Sent straight to Apple with the user's OWN APNs auth key (.p8), configured on
 * this machine with `pew2 voice apns`. No credential ships in the daemon, and
 * the relay stays a dumb pipe. VoIP tokens, like Expo tokens, live in memory
 * only and are re-sent by the app on every connect.
 *
 * Every call is also broadcast as `voice.incoming`, so a foregrounded app rings
 * without APNs at all. The existing Expo "needs input" banner is untouched and
 * remains the fallback when VoIP is not configured.
 */
import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import http2 from "node:http2";
import { join } from "node:path";
import type { wire } from "@pew2/protocol";
import { writeFileAtomic } from "./atomic-file.js";
import { pew2Home } from "./openai-auth.js";

// ---- config -----------------------------------------------------------------

export interface VoiceConfig {
  apns?: { keyId: string; teamId: string };
  /** Default on. */
  calls?: boolean;
}

export const voiceConfigPath = (env: NodeJS.ProcessEnv = process.env) => join(pew2Home(env), "voice.json");
export const apnsKeyPath = (env: NodeJS.ProcessEnv = process.env) => join(pew2Home(env), "apns-voip.p8");

export async function readVoiceConfig(env: NodeJS.ProcessEnv = process.env): Promise<VoiceConfig> {
  try {
    const value = JSON.parse(await readFile(voiceConfigPath(env), "utf8"));
    return value && typeof value === "object" ? value as VoiceConfig : {};
  } catch {
    return {};
  }
}

export async function writeVoiceConfig(config: VoiceConfig, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await mkdir(pew2Home(env), { recursive: true, mode: 0o700 });
  await writeFileAtomic(voiceConfigPath(env), JSON.stringify(config, null, 2) + "\n");
}

/** Validate and copy the .p8 into the config dir at 0600. */
export async function configureApns(
  keyFile: string,
  keyId: string,
  teamId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!/^[A-Z0-9]{10}$/.test(keyId)) throw new Error("--key-id should be the 10-character Key ID from the Apple developer portal.");
  if (!/^[A-Z0-9]{10}$/.test(teamId)) throw new Error("--team-id should be your 10-character Apple Team ID.");
  const pem = await readFile(keyFile, "utf8");
  createPrivateKey(pem); // throws on anything that is not a key
  await mkdir(pew2Home(env), { recursive: true, mode: 0o700 });
  await copyFile(keyFile, apnsKeyPath(env));
  await chmod(apnsKeyPath(env), 0o600);
  await writeVoiceConfig({ ...(await readVoiceConfig(env)), apns: { keyId, teamId } }, env);
}

export async function clearApns(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const { apns: _drop, ...rest } = await readVoiceConfig(env);
  await writeVoiceConfig(rest, env);
  await rm(apnsKeyPath(env), { force: true });
}

// ---- provider JWT -----------------------------------------------------------

/** ES256 provider token: header {alg,kid}, claims {iss,iat}. */
export function apnsJwt(keyPem: string, keyId: string, teamId: string, nowSeconds: number): string {
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const input = `${enc({ alg: "ES256", kid: keyId })}.${enc({ iss: teamId, iat: nowSeconds })}`;
  const signature = sign("sha256", Buffer.from(input), { key: createPrivateKey(keyPem), dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

// ---- registry ---------------------------------------------------------------

export interface VoipTarget {
  token: string;
  environment: "production" | "sandbox";
  bundleId: string;
}

export class VoipRegistry {
  private readonly targets = new Map<string, VoipTarget>();
  register(deviceId: string, target: VoipTarget): void {
    this.targets.set(deviceId, { ...target, token: target.token.toLowerCase() });
  }
  forget(token: string): void {
    for (const [id, t] of this.targets) if (t.token === token) this.targets.delete(id);
  }
  get(deviceId: string): VoipTarget | undefined {
    return this.targets.get(deviceId);
  }
  list(): VoipTarget[] {
    return [...this.targets.values()];
  }
  get size(): number {
    return this.targets.size;
  }
}

// ---- transport --------------------------------------------------------------

export interface ApnsRequest {
  host: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}
export type ApnsTransport = (request: ApnsRequest) => Promise<{ status: number; reason?: string }>;

/** HTTP/2 via node:http2, which Bun's client implements. One connection per push. */
export const http2Transport: ApnsTransport = (request) =>
  new Promise((resolve, reject) => {
    const client = http2.connect(`https://${request.host}`);
    client.on("error", reject);
    const stream = client.request({ ":method": "POST", ":path": request.path, ...request.headers });
    stream.setTimeout(10_000, () => stream.close(http2.constants.NGHTTP2_CANCEL));
    let status = 0;
    let body = "";
    stream.on("response", (headers) => (status = Number(headers[":status"])));
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => (body += chunk));
    stream.on("end", () => {
      client.close();
      let reason: string | undefined;
      try {
        reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined;
      } catch {
        // not JSON
      }
      resolve({ status, reason });
    });
    stream.on("error", (e) => {
      client.close();
      reject(e instanceof Error ? e : new Error("APNs request failed"));
    });
    stream.end(request.body);
  });

export function apnsRequest(target: VoipTarget, jwt: string, incoming: wire.VoiceIncoming): ApnsRequest {
  return {
    host: target.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com",
    path: `/3/device/${target.token}`,
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-push-type": "voip",
      "apns-topic": `${target.bundleId}.voip`,
      "apns-priority": "10",
      "apns-expiration": "0",
      "content-type": "application/json",
    },
    body: JSON.stringify(incoming),
  };
}

// ---- ringing ----------------------------------------------------------------

export const CALL_COOLDOWN_MS = 2 * 60_000;

export interface CallOrigin {
  sessionId?: string;
  providerId?: string;
  folder?: string;
  agentName?: string;
}

export class CallRinger {
  readonly voip = new VoipRegistry();
  private readonly lastCall = new Map<string, number>();
  private jwtCache?: { jwt: string; keyId: string; at: number };
  private nextWarnAt = 0;

  constructor(private readonly deps: {
    env: NodeJS.ProcessEnv;
    broadcast: (message: unknown) => void;
    transport?: ApnsTransport;
    now?: () => number;
    warn?: (message: string) => void;
    /**
     * Android has no CallKit or VoIP push: ring through a high-priority,
     * data-only Expo push the app turns into a full-screen incoming call.
     * `deviceId` narrows it to one phone (manual calls); absent means all.
     */
    androidRing?: (incoming: wire.VoiceIncoming, deviceId?: string) => Promise<void>;
  }) {}

  private now() {
    return (this.deps.now ?? Date.now)();
  }

  /** The agent needs input: ring at most once per session per two minutes. */
  async ringForInput(origin: CallOrigin): Promise<wire.VoiceIncoming | undefined> {
    const key = origin.sessionId ?? "";
    const now = this.now();
    const last = this.lastCall.get(key);
    if (last !== undefined && now - last < CALL_COOLDOWN_MS) return undefined;
    this.lastCall.set(key, now);
    return this.ring("input", origin);
  }

  /**
   * "Call me" from the computer itself (the CLI, a test): it has no phone of
   * its own, so every paired phone rings, the same way an agent's question
   * does, but without the per-session cooldown.
   */
  ringEveryPhone(origin: CallOrigin): Promise<wire.VoiceIncoming | undefined> {
    return this.ring("manual", origin);
  }

  /** "Call me" from the app: ring only that phone's VoIP token. */
  ringManual(origin: CallOrigin, deviceId: string | undefined): Promise<wire.VoiceIncoming | undefined> {
    const target = deviceId ? this.voip.get(deviceId) : undefined;
    return this.ring("manual", origin, target ? [target] : [], deviceId ?? "");
  }

  private async ring(
    reason: wire.VoiceCallReason,
    origin: CallOrigin,
    targets?: VoipTarget[],
    /** Manual calls ring only the asking phone; "" means it has no identity, so none. */
    androidDevice?: string,
  ): Promise<wire.VoiceIncoming | undefined> {
    const config = await readVoiceConfig(this.deps.env);
    if (config.calls === false) return undefined;
    const incoming: wire.VoiceIncoming = {
      t: "voice.incoming",
      callId: randomUUID(),
      reason,
      ...(origin.sessionId ? { sessionId: origin.sessionId } : null),
      ...(origin.providerId ? { providerId: origin.providerId } : null),
      ...(origin.folder ? { folder: origin.folder } : null),
      summary: reason === "manual"
        ? "pew2 is calling"
        : `${origin.agentName ?? "Your agent"} needs you in ${origin.folder ?? "pew2"}`,
      at: this.now(),
    };
    this.deps.broadcast(incoming);
    await Promise.all([
      config.apns ? this.pushAll(targets ?? this.voip.list(), config.apns, incoming) : undefined,
      androidDevice === "" || !this.deps.androidRing
        ? undefined
        : this.deps.androidRing(incoming, androidDevice).catch(() => this.warn("could not ring Android")),
    ]);
    return incoming;
  }

  private async jwt(keyId: string, teamId: string): Promise<string> {
    const now = this.now();
    // APNs wants a token between 20 and 60 minutes old at most; reuse for 40.
    if (this.jwtCache && this.jwtCache.keyId === keyId && now - this.jwtCache.at < 40 * 60_000) return this.jwtCache.jwt;
    const pem = await readFile(apnsKeyPath(this.deps.env), "utf8");
    const jwt = apnsJwt(pem, keyId, teamId, Math.floor(now / 1000));
    this.jwtCache = { jwt, keyId, at: now };
    return jwt;
  }

  private async pushAll(targets: VoipTarget[], apns: { keyId: string; teamId: string }, incoming: wire.VoiceIncoming) {
    if (targets.length === 0) return;
    let jwt: string;
    try {
      jwt = await this.jwt(apns.keyId, apns.teamId);
    } catch {
      this.warn("could not read the APNs key; run `pew2 voice apns` again");
      return;
    }
    const transport = this.deps.transport ?? http2Transport;
    await Promise.all(targets.map(async (target) => {
      try {
        const result = await transport(apnsRequest(target, jwt, incoming));
        if (result.status === 200) return;
        if (result.status === 410 || result.reason === "BadDeviceToken" || result.reason === "Unregistered") {
          this.voip.forget(target.token);
        }
        if (result.reason === "ExpiredProviderToken" || result.reason === "InvalidProviderToken") this.jwtCache = undefined;
        this.warn(`APNs refused a VoIP push (${result.status}${result.reason ? ` ${result.reason}` : ""})`);
      } catch {
        this.warn("could not reach APNs");
      }
    }));
  }

  private warn(text: string) {
    const now = this.now();
    if (now < this.nextWarnAt) return;
    this.nextWarnAt = now + 60_000;
    try {
      (this.deps.warn ?? console.warn)(`[voip] ${text}. Further failures are suppressed for 60s.`);
    } catch {
      // never let diagnostics break a call
    }
  }
}
