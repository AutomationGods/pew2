import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  accountInfo, buildAuthorizeUrl, freshAuth, generatePkce, openaiAuthPath, readAuth, saveAuth,
  OPENAI_CLIENT_ID, OPENAI_TOKEN_URL, type StoredAuth,
} from "./openai-auth.js";

export const fakeJwt = (claims: object) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const home = () => ({ PEW2_HOME: mkdtempSync(join(tmpdir(), "pew2-oai-")) });

describe("authorize URL", () => {
  it("uses PKCE S256 and Codex's parameters", () => {
    const { verifier, challenge } = generatePkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    const url = new URL(buildAuthorizeUrl(challenge, "st"));
    expect(url.origin + url.pathname).toBe("https://auth.openai.com/oauth/authorize");
    const p = url.searchParams;
    expect(p.get("client_id")).toBe(OPENAI_CLIENT_ID);
    expect(p.get("redirect_uri")).toBe("http://localhost:1455/auth/callback");
    expect(p.get("scope")).toBe("openid profile email offline_access");
    expect(p.get("code_challenge")).toBe(challenge);
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("id_token_add_organizations")).toBe("true");
    expect(p.get("codex_cli_simplified_flow")).toBe("true");
    expect(p.get("state")).toBe("st");
    expect(p.get("response_type")).toBe("code");
  });

  it("reads the ChatGPT account id from the auth claim", () => {
    const id = fakeJwt({ email: "a@b.c", "https://api.openai.com/auth": { chatgpt_account_id: "acc", chatgpt_plan_type: "plus" } });
    expect(accountInfo(id)).toEqual({ accountId: "acc", plan: "plus", email: "a@b.c" });
  });
});

describe("refresh", () => {
  const stored = (expiresAt: number): StoredAuth => ({ idToken: "i", accessToken: "old", refreshToken: "r1", expiresAt });

  it("keeps a token that is not near expiry", async () => {
    const env = home();
    await saveAuth(stored(Date.now() + 3600_000), env);
    let calls = 0;
    const auth = await freshAuth(env, { fetchImpl: async () => { calls++; return new Response("{}"); } });
    expect(auth?.accessToken).toBe("old");
    expect(calls).toBe(0);
    expect(statSync(openaiAuthPath(env)).mode & 0o777).toBe(0o600);
  });

  it("refreshes near expiry and stores the rotated refresh token", async () => {
    const env = home();
    await saveAuth(stored(Date.now() + 60_000), env);
    const seen: string[] = [];
    const access = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const auth = await freshAuth(env, {
      fetchImpl: async (url, init) => {
        seen.push(url, init.body as string);
        return Response.json({ access_token: access, refresh_token: "r2", id_token: fakeJwt({ "https://api.openai.com/auth": { chatgpt_account_id: "acc" } }) });
      },
    });
    expect(seen[0]).toBe(OPENAI_TOKEN_URL);
    const body = new URLSearchParams(seen[1]);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("r1");
    expect(auth?.accessToken).toBe(access);
    expect((await readAuth(env))?.refreshToken).toBe("r2");
    expect((await readAuth(env))?.accountId).toBe("acc");
  });
});
