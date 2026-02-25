# Taste — Human Judgment Oracle

## Git Rules
- NEVER include `Co-Authored-By` lines in commit messages
- NEVER include any AI attribution trailers in commits

## Security Rules
- NEVER read, edit, display, or reference the contents of `.env` files
- NEVER include `.env` file contents in any context, summary, or output
- If you need to know what env vars exist, reference `.env.example` instead

## Pre-Commit Checklist (MANDATORY)
Before EVERY commit and push, complete ALL of these steps:

1. **Security review** — Review all changes for injection, auth bypass, exposed secrets, missing validation, and other OWASP top 10 issues. Fix anything found before committing.
2. **Tests** — Write tests for new functionality (happy-path + edge cases). Run the full test suite (`npx vitest run`) and confirm all pass.
3. **Build check** — Run `npx tsc --noEmit` to verify the build compiles clean.
4. **Design decisions** — Check if `docs/design-decisions.md` needs updating. Any non-obvious choice or tuning decision should be documented with context and rationale.
5. **Docs sync** — Check if other docs (e.g. `docs/acp-session-lifecycle.md`, `docs/offerings.md`) need updating to stay in sync with code changes.
6. **PR-style review** — Re-read the diff (`git diff --staged`) for correctness, missing edge cases, and unintended side effects. If issues are found, fix them before committing.

Do NOT skip steps. Do NOT commit and then review after.
