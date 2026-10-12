---
name: commit
description: Run checks, agent code review, secret scan, then commit to a feature branch and open a pull request. Never pushes to main.
---

1. Run quality checks. These are the real gates:
   `npm run lint` — ESLint over the whole repo; .gg/** is excluded by config
   `npm run typecheck` — tsc over daemon+protocol AND packages/relay (Workers types are separate)
   `npm run providers:validate` — every providers/*.json manifest must parse and validate
   `npm test` — daemon pipeline tests against the local echo ACP agent
   Fix ALL errors before continuing. There is no auto-fix; correct the source.

2. Review changes: run git status and git diff --staged and git diff

3. Fast review gate: spawn ONE subagent with the full diff. Instructions: review ONLY
   the diff for real bugs, regressions, leftover debug code, and unintended changes.
   Score each issue 0-100 confidence (pre-existing issues and stylistic nitpicks = false
   positives, score low). Report ONLY issues with confidence >= 80, with file:line and a
   one-line fix. If none, reply "CLEAR". This is a last check, not a deep audit - be fast.

4. If CLEAR: proceed straight to step 5 without asking the user anything.
   If issues >= 80 were reported: STOP. Show the issues and do not stage, commit or push.
   Wait for the user to choose a fix. After fixing, re-run step 1 and then continue
   (no re-review). There is no commit-and-push-anyway option.

5. Stage relevant files with git add (specific files, not -A).
   Never stage secrets, .dev.vars, or .env* files (.env.example is the one allowed exception).
   Then run the secret scan over the staged content and stop on any finding:
   `gitleaks protect --staged --redact --no-banner --exit-code 1 --config .gitleaks.toml`
   It must run after staging, because it only sees what is staged. If it reports a
   leak, unstage the file, show the rule and location (never the value), and stop.
   Nothing is committed or pushed until this exits 0.

6. Generate a commit message:
   - Start with verb (Add/Update/Fix/Remove/Refactor)
   - Be specific and concise, one line preferred

7. Commit to a feature branch and open a pull request. Never commit or push to main:
   - If the current branch is main, create a feature branch first, for example
     `git switch -c <verb>/<short-slug>`. If already on a feature branch, use it.
   - git commit -m "your generated message"
   - git push -u origin <branch>
   - gh pr create --base main --title "<commit message>" --fill
   Report the PR URL. Do not merge it. Merging is the user's decision.
