# Contributing to SUNUSOCIAL

Thanks for building SUNUSOCIAL. This is a small team (JefTech: lead/CTO, Bachir as second developer, Ndeye Mareme on marketing). Keep the workflow light but disciplined — the product handles donors' money, so correctness and traceability matter more than speed.

## Branch Strategy

```text
main          # production — always deployable; protected; deploys to Vercel prod
dev           # tested code only — receives `integration` once the MVP passes its end-to-end test
integration   # TEMPORARY — every MVP feature merges here until the MVP can be tested (see below)
feat/<slug>   # one branch per feature            e.g. feat/donation-modal
fix/<slug>    # bug fixes                          e.g. fix/progress-bar-rounding
chore/<slug>  # tooling, deps, config             e.g. chore/convex-upgrade
infra/<slug>  # deployment / env / CI             e.g. infra/vercel-preview
```

- **During the integration phase** (now): branch off `integration` and open your PR into `integration`.
- After the integration phase: branch off `dev` and open your PR into `dev`.
- `dev` → `main` is a release PR, reviewed by the lead developer.
- Never commit directly to `main`, `dev` or `integration`: every change goes through a PR.

## Integration Phase (until the MVP can be tested)

The MVP can't be tested end to end yet (no real Convex deployment wired up, and the SMS provider is waiting on the board). So `dev` stays tested-only, and all MVP work collects on the temporary `integration` branch.

**Flow**

```text
feat/* ──PR──▶ integration ──(MVP tested)──▶ dev ──(board decisions)──▶ dev ──release PR──▶ main
```

1. **Build the MVP on `integration`.** Every sprint in `docs/IMPLEMENTATION_ROADMAP.md` (1–7, and Sprint 8 tasks 1–6) is built in `feat/*`, `fix/*`, `chore/*` or `infra/*` branches cut from `integration`, with PRs into `integration`. The repository owner (3am.mouha) reviews and merges every PR; CI must be green.
2. **Test the MVP**, then merge `integration` into `dev` (one PR, merge commit, no squash), once every item of the exit checklist below is ticked. `integration` is then deleted, and work branches off `dev` again.
3. **Apply the board decisions on `dev`**: the answers to `docs/BOARD_QUESTIONS.md`, replacing the interim defaults of `docs/DECISIONS.md` §3 (and updating `DECISIONS.md` first).
4. **Release**: `dev` → `main`, then the production deploy (Sprint 8 task 7).

**Exit checklist: `integration` → `dev`**

- [ ] Sprints 1–7 and Sprint 8 tasks 1–6 are merged into `integration`, and CI is green on it.
- [ ] The app runs against a real Convex deployment (not production) with `PAYMENT_PROVIDER=mock` and `SMS_PROVIDER=console`; `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `MODERATION_SITE_URL` and `OTP_HASH_SECRET` are set in Convex.
- [ ] Every flow in `docs/PARCOURS.md` has been run by hand in that deployment, on the app and on the moderation subdomain, at 375px and on desktop: signups and logins (SMS codes read from the Convex logs), resets, cause publication and moderation, donation with the mock provider through release and payout, proofs, refunds and deletions, blood alerts.
- [ ] The Playwright e2e test of the donation flow (Sprint 8 task 6) passes.
- [ ] The Sprint 8 security review (task 4) is done and its findings are fixed.

**Not required** to leave the integration phase: a real SMS provider (board question Q1) and NabooPay live keys. Both come with the board decisions and the production deploy.

**Keeping the branches in sync.** Nothing should land on `dev` during this phase. If a fix has to (for example, an urgent doc correction), merge `dev` into `integration` right after, so the two never drift.

## Commit Convention

Conventional Commits. Scope is optional but encouraged (use a domain area: `cause`, `donation`, `proof`, `blood`, `moderation`, `auth`, `payment`).

```text
feat(donation): live fee line and net amount in the donation modal
fix(cause): round progress percentage to avoid 101% display
chore(deps): bump convex to latest
infra(vercel): add preview deployments for feat/* branches
docs(security): document payout-account change review
refactor(proof): extract dossier gallery into a shared component
test(payment): cover webhook signature verification
```

Keep user-facing strings in **French**; keep code, comments, and commit messages in **English**.

### AI agents (Claude Code)

AI agents follow this file and `CLAUDE.md`. Their commits are authored and committed as `3am.mouha <157067756+mouha18@users.noreply.github.com>`, with no AI attribution anywhere in git history or pull requests: no `Co-Authored-By` or `Claude-Session` trailers, and no "Generated with …" footers or session links in PR descriptions. Agents open PRs into `integration` during the integration phase and never merge them: the repository owner does.

## Development Workflow

1. Pick or open a task (see `docs/IMPLEMENTATION_ROADMAP.md` for the current sprint).
2. Create a branch off `integration` (off `dev` once the integration phase is over): `git checkout -b feat/<slug> origin/integration`.
3. Run the app locally — `npx convex dev` in one terminal, `npm run dev` in another (`PAYMENT_PROVIDER=mock`). Moderation is at `http://moderation.localhost:3000`.
4. Build the feature. Keep changes scoped to one concern per PR.
5. Validate: `npm run lint`, `npm run typecheck`, and any tests for the area you touched.
6. Verify French copy renders correctly and the screen is responsive (test at 375px and desktop).
7. Push and open a PR into `integration` (into `dev` after the integration phase) with a short description and screenshots/GIFs for UI changes.
8. Address review. The repository owner (3am.mouha) approves and merges.
9. Releases: open `dev` → `main`; Vercel deploys on merge.

## Code Standards

- **TypeScript strict** — `strict: true`; no implicit `any`.
- **No `any`** — model Convex documents and API payloads with explicit types (see `docs/TECHNICAL_ROADMAP.md` §2).
- **Validate all input** at the Convex function boundary (use Convex validators `v.*`); never trust client-supplied amounts, statuses, or IDs.
- **Money math in the smallest unit** — amounts are integers of FCFA; never use floats. Use `lib/money.ts` for every fee/net computation (`fee + platformFee + net === amount`).
- **No secrets in the repo** — everything sensitive goes through environment variables; `.env.local` is git-ignored.
- **Authorization on every mutation** — re-check the caller's role and ownership server-side; the moderation surface is a separate app and must never be reachable with a donor/structure session.
- **Lint & format** — ESLint + Prettier must pass before merge; CI blocks otherwise.
- **Accessibility** — every interactive element has a visible focus state; respect the design system's `:focus-visible` ring.
- **Keep the French copy out of logic** — centralize user-facing strings so marketing can review them.

## Questions

- Technical: ask the lead developer / CTO.
- Decisions already taken are in `docs/DECISIONS.md` — it wins over any other doc.
- Open product questions are in `docs/BOARD_QUESTIONS.md`: they need a SUNUSOCIAL board decision. Raise new ones with the client via the project owner; in code, use the interim default from `DECISIONS.md` §3 behind its config value, don't invent a rule.
- Marketing / copy: Ndeye Mareme.
