## What

<!-- One or two sentences: what this PR changes and why. Link the sprint task (docs/IMPLEMENTATION_ROADMAP.md). -->

## How to test

<!-- Steps a reviewer can follow locally (PAYMENT_PROVIDER=mock, SMS_PROVIDER=console). -->

## Screenshots

<!-- UI changes: mobile (375px) and desktop. Delete if not applicable. -->

## Checklist

- [ ] Targets `integration` during the integration phase (`dev` afterwards; see `CONTRIBUTING.md`)
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass
- [ ] Follows `docs/DECISIONS.md` (or this PR updates it)
- [ ] Every new Convex function validates its args and checks role/ownership server-side
- [ ] Money stays integer FCFA through `lib/money.ts`; no client-trusted amounts or statuses
- [ ] User-facing copy is French and lives in `lib/strings.fr.ts`
- [ ] Sensitive actions (moderation, payouts, payout-account changes, donor activity) write to `auditLog`
- [ ] No secrets committed; new env vars added to `.env.example`
