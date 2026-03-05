# Taste — Human Judgment Oracle

## Git Rules
- NEVER include `Co-Authored-By` lines in commit messages
- NEVER include any AI attribution trailers in commits

## Security Rules
- NEVER read, edit, display, or reference the contents of `.env` files
- NEVER include `.env` file contents in any context, summary, or output
- If you need to know what env vars exist, reference `.env.example` instead

## Git Style
- Prefer focused commits. If changes span distinct concerns (e.g. feature work + security fixes), commit them separately
- Each commit should be reviewable on its own — one logical change per commit

## Docs Maintenance
- Update `docs/cc_INDEX.md` when adding new docs, scripts, or config files
- Update `docs/cc_design-decisions.md` for any non-obvious choice (Context → Decision → Rationale)

## ACP Ecosystem
- Before optimizing offerings, keywords, or descriptions, run `scripts/acp-research.ts` to check current ecosystem state
- Validate features against what agents actually do, not what they could theoretically do

## Pre-Commit Checklist (MANDATORY)
Before EVERY commit and push, complete ALL of these steps:

1. **Security review** — Review all changes for injection, auth bypass, exposed secrets, missing validation, and other OWASP top 10 issues. Fix anything found before committing.
2. **Tests** — Write tests for new functionality (happy-path + edge cases). Run the full test suite (`npx vitest run`) and confirm all pass.
3. **Build check** — Run `npx tsc --noEmit` to verify the build compiles clean.
4. **Design decisions** — Check if `docs/cc_design-decisions.md` needs updating. Any non-obvious choice or tuning decision should be documented with context and rationale.
5. **Docs sync** — Check if other docs (e.g. `docs/cc_acp-session-lifecycle.md`, `docs/cc_offerings.md`) need updating to stay in sync with code changes.
6. **PR-style review** — Re-read the diff (`git diff --staged`) for correctness, missing edge cases, and unintended side effects. If issues are found, fix them before committing.

Do NOT skip steps. Do NOT commit and then review after.

## Pre-Push Plugin Analysis (MANDATORY)
Before EVERY push, run these plugin-based reviews on the changes being pushed:

1. **`/differential-review`** (Trail of Bits) — Security-focused differential review of all changes vs the base branch
2. **`/simplify`** — Code reuse, quality, and efficiency review of changed code
3. **`/code-review`** — General code review (use when pushing to a PR)

Fix any HIGH or MEDIUM severity findings before pushing. LOW findings are at your discretion.

**If any of these plugins are not installed**, STOP and notify the user before proceeding. Do NOT skip plugin analysis — ask the user to install the missing plugins via `/plugin` before continuing with the push.
