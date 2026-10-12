/** Run the existing relay checks against an isolated, real Workers runtime. */
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { unstable_dev } from "wrangler";

const here = dirname(fileURLToPath(import.meta.url));
process.env.WRANGLER_SEND_METRICS = "false";

const relay = await unstable_dev(join(here, "index.ts"), {
  config: join(here, "../wrangler.toml"),
  ip: "127.0.0.1",
  port: 0,
  local: true,
  persist: false,
  logLevel: "error",
  experimental: {
    forceLocal: true,
    disableDevRegistry: true,
    disableExperimentalWarning: true,
  },
});

try {
  const { stdout, stderr } = await promisify(execFile)(
    "bun",
    [join(here, "relay-check.mjs")],
    {
      env: { ...process.env, PEW2_RELAY_TEST_PORT: String(relay.port) },
      timeout: 30_000,
    },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
} finally {
  await relay.stop();
}
