/**
 * The off switch for self-update.
 *
 * The updater installs whatever `KenKaiii/pew2` last released. A machine running
 * its own build (a fork, a branch with features upstream has not got) would be
 * silently downgraded to upstream's binary the first time upstream tagged a
 * newer version, so such a machine needs a way to say "never replace me".
 *
 * Two ways, either one is enough:
 * - `PEW2_AUTO_UPDATE=0` (or `false`/`off`/`no`) in the daemon's environment.
 * - A file named `no-auto-update` in `~/.pew2` (or `$PEW2_HOME`). A file and
 *   not only an env var because `pew2 setup` rewrites the service definition,
 *   and an env var kept there would quietly disappear with it.
 *
 * Opting out also stops the *checking*: an "update available" notice on the
 * phone would point at upstream's release, which is not an update for this
 * build.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pew2Home } from "../openai-auth.js";

export const OPT_OUT_FILE = "no-auto-update";

export function autoUpdateDisabled(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
): boolean {
  const flag = env.PEW2_AUTO_UPDATE?.trim().toLowerCase();
  if (flag && ["0", "false", "off", "no"].includes(flag)) return true;
  return exists(join(pew2Home(env), OPT_OUT_FILE));
}
