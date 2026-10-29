# Contributing to SUNUSOCIAL

Thanks for building SUNUSOCIAL. This is a small team (JefTech: lead/CTO, Bachir as second developer, Ndeye Mareme on marketing). Keep the workflow light but disciplined — the product handles donors' money, so correctness and traceability matter more than speed.

## Branch Strategy

```text
main          # production — always deployable; protected; deploys to Vercel prod
develop       # integration branch — features merge here first
feat/<slug>   # one branch per feature            e.g. feat/donation-modal
fix/<slug>    # bug fixes                          e.g. fix/progress-bar-rounding
chore/<slug>  # tooling, deps, config             e.g. chore/convex-upgrade
infra/<slug>  # deployment / env / CI             e.g. infra/vercel-preview
```

- Branch off `develop` for everyday work; open a PR back into `develop`.
- `develop` → `main` is a release PR, reviewed by the lead developer.
- Never commit directly to `main` or `develop`.

## Commit Convention

Conventional Commits. Scope is optional but encouraged (use a domain area: `cause`, `donation`, `proof`, `blood`, `moderation`, `auth`, `payment`).

```text
feat(donation): live fee line and net amount in the donation modal
fix(cause): round progress percentage to avoid 101% display
chore(deps): bump convex to latest
infra(vercel): add preview deployments for feat/* branches
docs(security): document NabooPay escrow vs SycaPay direct-payout
refactor(proof): extract dossier gallery into a shared component
test(payment): cover webhook signature verification
```

Keep user-facing strings in **French**; keep code, comments, and commit messages in **English**.

## Development Workflow

1. Pick or open a task (see `docs/IMPLEMENTATION_ROADMAP.md` for the current sprint).
2. Create a branch off `develop`: `git checkout -b feat/<slug>`.
3. Run the app locally — `npx convex dev` in one terminal, `npm run dev` in another.
4. Build the feature. Keep changes scoped to one concern per PR.
5. Validate: `npm run lint`, `npm run typecheck`, and any tests for the area you touched.
6. Verify French copy renders correctly and the screen is responsive (test at 375px and desktop).
7. Push and open a PR into `develop` with a short description and screenshots/GIFs for UI changes.
8. Address review. The lead developer approves and merges.
9. Releases: open `develop` → `main`; Vercel deploys on merge.

## Code Standards

- **TypeScript strict** — `strict: true`; no implicit `any`.
- **No `any`** — model Convex documents and API payloads with explicit types (see `docs/TECHNICAL_ROADMAP.md` §2).
- **Validate all input** at the Convex function boundary (use Convex validators `v.*`); never trust client-supplied amounts, statuses, or IDs.
- **Money math in the smallest unit** — amounts are integers of FCFA; never use floats. Compute fees and net consistently with the active provider's rate.
- **No secrets in the repo** — everything sensitive goes through environment variables; `.env.local` is git-ignored.
- **Authorization on every mutation** — re-check the caller's role and ownership server-side; the moderation surface is a separate app and must never be reachable with a donor/structure session.
- **Lint & format** — ESLint + Prettier must pass before merge; CI blocks otherwise.
- **Accessibility** — every interactive element has a visible focus state; respect the design system's `:focus-visible` ring.
- **Keep the French copy out of logic** — centralize user-facing strings so marketing can review them.

## Questions

- Technical: ask the lead developer / CTO.
- Product decisions and anything marked **[OPEN]** in `context.md`: these need a SUNUSOCIAL board decision — raise them with the client (via the project owner), don't guess in code.
- Marketing / copy: Ndeye Mareme.
