/** Behavioral Android check against the real Reconnect harness, not source text.
 * Prerequisites: disposable AVD pew2-reconnect-verification at emulator-5580,
 * debug APK installed there, and EXPO_PUBLIC_HARNESS=Reconnect Metro on port 8087.
 * Run: bun run packages/app/scripts/verify-reconnect-native.ts
 * Never targets a hardware device, existing AVD, production app, or real pairing.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const adbPath = join(process.env.ANDROID_HOME ?? join(homedir(), "Library/Android/sdk"), "platform-tools/adb");
const serial = "emulator-5580";
const app = "io.github.kenkaiii.pew2";
const output = join(process.cwd(), ".gg/screenshots/reconnect-native");
function adb(...args: string[]): string {
  return execFileSync(adbPath, ["-s", serial, ...args], { encoding: "utf8", timeout: 20_000 });
}
interface Node { text: string; description: string; id: string; bounds: string }
function screen(): Node[] {
  adb("shell", "uiautomator", "dump", "/sdcard/reconnect-window.xml");
  const xml = adb("exec-out", "cat", "/sdcard/reconnect-window.xml");
  return Array.from(xml.matchAll(/<node\b([^>]+)>/g), match => {
    const attributes = new Map(Array.from((match[1] ?? "").matchAll(/([\w-]+)="([^"]*)"/g), item => [item[1], (item[2] ?? "").replaceAll("&amp;", "&").replaceAll("&apos;", "'")]));
    return { text: attributes.get("text") ?? "", description: attributes.get("content-desc") ?? "", id: attributes.get("resource-id") ?? "", bounds: attributes.get("bounds") ?? "" };
  });
}
async function waitFor(predicate: (node: Node) => boolean): Promise<Node> {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    const node = screen().find(predicate);
    if (node) return node;
    await delay(250);
  }
  throw new Error("Expected native control did not appear before deadline");
}
const named = (label: string) => (node: Node): boolean => node.text === label || node.description === label;
async function tap(label: string): Promise<void> {
  const node = await waitFor(named(label));
  press(node);
}
function press(node: Node): void {
  const values = node.bounds.match(/\d+/g)?.map(Number);
  assert(values?.length === 4, "Control has tap bounds");
  const [left = 0, top = 0, right = 0, bottom = 0] = values;
  adb("shell", "input", "tap", String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
}
function screenshot(name: string): void {
  const png = execFileSync(adbPath, ["-s", serial, "exec-out", "screencap", "-p"], { timeout: 20_000 });
  writeFileSync(join(output, `${name}.png`), png);
}
async function inspectStorage(expected: string): Promise<void> {
  await tap("Read fixture storage");
  await waitFor(named(expected));
}
async function confirmReconnect(): Promise<void> {
  await tap("Forget connection & reconnect");
  await waitFor(named("Forget connection & reconnect?"));
  press(await waitFor(node => node.id === "android:id/button1"));
}
async function verifyManualPairing(closeLabel = "Cancel scanning"): Promise<void> {
  await tap(closeLabel);
  await inspectStorage("Pairing: empty; providers: 0");
  await tap("Pairing link");
  adb("shell", "input", "text", "not-a-link");
  adb("shell", "input", "keyevent", "111");
  await tap("Connect");
  await waitFor(node => node.text.includes("Not a valid link"));
}

assert.equal(adb("emu", "avd", "name").split("\n")[0]?.trim(), "pew2-reconnect-verification", "Refuse to touch anything except the disposable verification AVD");
mkdirSync(output, { recursive: true });
adb("reverse", "tcp:8081", "tcp:8087");
adb("shell", "svc", "wifi", "disable");
adb("shell", "svc", "data", "disable");
// Reset only this disposable harness's camera choice, making reruns repeatable.
adb("shell", "am", "force-stop", app);
adb("shell", "pm", "revoke", app, "android.permission.CAMERA");
adb("shell", "pm", "clear-permission-flags", app, "android.permission.CAMERA", "user-set", "user-fixed");
adb("shell", "am", "start", "-n", `${app}/.MainActivity`);
await waitFor(named("Pairing: stored; providers: 1"));
await waitFor(named("Forget connection & reconnect"));
screenshot("drawer-offline");
await tap("Forget connection & reconnect");
await waitFor(named("Forget connection & reconnect?"));
screenshot("confirmation");
press(await waitFor(node => node.id === "android:id/button2"));
await inspectStorage("Pairing: stored; providers: 1");
await waitFor(named("Forget connection & reconnect"));
console.log("PASS: Cancel preserves the pairing, cached provider and offline drawer");

await confirmReconnect();
await tap("Allow camera access");
press(await waitFor(node => node.id.endsWith("permission_deny_button")));
await waitFor(node => node.text === "Camera needed" || node.text === "Camera is off");
screenshot("scanner-camera-denied");
await verifyManualPairing("Paste the link instead");
screenshot("manual-after-denial");
console.log("PASS: Confirm clears persisted pairing/providers offline; camera denial retains working manual pairing");

adb("shell", "pm", "grant", app, "android.permission.CAMERA");
adb("shell", "am", "force-stop", app);
adb("shell", "am", "start", "-n", `${app}/.MainActivity`);
await waitFor(named("Pairing: stored; providers: 1"));
await confirmReconnect();
await waitFor(named("Point at the code"));
screenshot("scanner");
await verifyManualPairing();
screenshot("manual-after-cancel");
console.log("PASS: Scanner cancellation retains working manual pairing and keeps persisted credentials cleared");
console.log(`Native evidence: ${output}`);
