/**
 * `pew2 openai …` and `pew2 voice …`: credentials for live voice and calls.
 *
 * Never prints a token or key. Settings are read by the daemon on each use, so
 * no restart is needed after changing them.
 */
import {
  clearApiKey,
  clearAuth,
  loginWithBrowser,
  loginWithDeviceCode,
  readApiKey,
  readAuth,
  saveApiKey,
} from "../openai-auth.js";
import { DEFAULT_REALTIME_MODEL } from "../voice.js";
import { apnsKeyPath, clearApns, configureApns, readVoiceConfig, writeVoiceConfig } from "../voip.js";

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  return eq?.slice(name.length + 1);
}

/** Read a secret from piped stdin, or prompt with echo off on a terminal. */
async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) return (await new Response(Bun.stdin.stream()).text()).trim();
  process.stdout.write(prompt);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelled."));
          return;
        }
        if (ch === "\u007f") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

export async function cmdOpenAI(command: string | undefined, flags: Set<string>): Promise<number> {
  try {
    switch (command) {
      case "login": {
        const auth = flags.has("--device") ? await loginWithDeviceCode() : await loginWithBrowser();
        console.log(`Signed in to ChatGPT${auth.email ? ` as ${auth.email}` : ""}${auth.plan ? ` (${auth.plan})` : ""}.`);
        return 0;
      }
      case "logout":
        await clearAuth();
        console.log("Signed out of ChatGPT for pew2. (Codex's own sign-in is untouched.)");
        return 0;
      case "key": {
        if (flags.has("--clear")) {
          await clearApiKey();
          console.log("Removed the stored OpenAI API key.");
          return 0;
        }
        const key = await readSecret("OpenAI API key (input hidden): ");
        if (!/^sk-\S{10,}$/.test(key)) {
          console.error("That does not look like an OpenAI API key (sk-…). Nothing saved.");
          return 1;
        }
        await saveApiKey(key);
        console.log("Saved the fallback API key (readable only by you).");
        return 0;
      }
      case "status": {
        const auth = await readAuth();
        const key = await readApiKey();
        console.log(auth
          ? `ChatGPT: signed in${auth.email ? ` as ${auth.email}` : ""}${auth.plan ? `, plan ${auth.plan}` : ""}`
          : "ChatGPT: not signed in (run `pew2 openai login`)");
        console.log(`API key: ${key ? (key.from === "env" ? "from OPENAI_API_KEY" : "stored") : "none"}`);
        console.log(`Voice uses: ${auth ? "ChatGPT sign-in" + (key ? ", API key as fallback" : "") : key ? "API key" : "nothing yet; voice is unavailable"}`);
        console.log(`Default model: ${DEFAULT_REALTIME_MODEL}`);
        return 0;
      }
      default:
        console.log("  pew2 openai login [--device]    Sign in with ChatGPT (device code for headless machines)");
        console.log("  pew2 openai logout              Forget the ChatGPT sign-in");
        console.log("  pew2 openai status              Who is signed in and which credential voice uses");
        console.log("  pew2 openai key [--clear]       Store (from stdin or a hidden prompt) or remove a fallback API key");
        return command ? 1 : 0;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export async function cmdVoice(command: string | undefined, arg: string | undefined, flags: Set<string>, argv: string[]): Promise<number> {
  try {
    switch (command) {
      case "apns": {
        if (flags.has("--clear")) {
          await clearApns();
          console.log("Removed the APNs key. Calls will only ring an open app.");
          return 0;
        }
        const key = flagValue(argv, "--key");
        const keyId = flagValue(argv, "--key-id");
        const teamId = flagValue(argv, "--team-id");
        if (!key || !keyId || !teamId) {
          console.error("Usage: pew2 voice apns --key <AuthKey_XXXX.p8> --key-id <KEYID> --team-id <TEAMID>");
          return 1;
        }
        await configureApns(key, keyId, teamId);
        console.log(`APNs key copied to ${apnsKeyPath()}. Your phone can now ring.`);
        return 0;
      }
      case "calls": {
        if (arg !== "on" && arg !== "off") {
          console.error("Usage: pew2 voice calls on|off");
          return 1;
        }
        await writeVoiceConfig({ ...(await readVoiceConfig()), calls: arg === "on" });
        console.log(`Calls ${arg}.`);
        return 0;
      }
      case "status": {
        const config = await readVoiceConfig();
        console.log(`Calls: ${config.calls === false ? "off" : "on"}`);
        console.log(config.apns
          ? `APNs: key ${config.apns.keyId}, team ${config.apns.teamId}`
          : "APNs: not configured (the phone rings only while the app is open)");
        return 0;
      }
      default:
        console.log("  pew2 voice apns --key <p8> --key-id <id> --team-id <id>   Let pew2 ring your phone");
        console.log("  pew2 voice apns --clear                                    Remove the APNs key");
        console.log("  pew2 voice calls on|off                                    Ring when an agent needs you");
        console.log("  pew2 voice status");
        return command ? 1 : 0;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
