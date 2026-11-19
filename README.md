# SUNUSOCIAL

> Donnez avec confiance. Aidez avec impact.

## Overview

SUNUSOCIAL is a French-language, mobile-responsive web platform that connects donors with verified social organizations in Senegal. It is an **intermediation platform**: verified structures (orphanages, nurseries, shelters, centers for people with disabilities, women's prisons, hospitals) publish concrete, costed needs — "bons de besoins" — and donors fund them directly through mobile money (Orange Money, Wave), with transparency and proof of reception built into every cause.

The platform exists for **trust and visibility**, not because Senegal lacks charitable actors. The sector has many small, isolated organizations and many willing donors, but no trusted channel between them. SUNUSOCIAL is that channel: every structure is document-verified, every cause is moderated, and every completed cause carries a published proof-of-use dossier that donors can inspect.

SUNUSOCIAL is run as a non-profit service. Its founder does not take income from it; any fee exists only to cover maintenance and running costs. A secondary **blood-donation module** lets hospitals broadcast blood-shortage alerts to compatible, opted-in donors nearby.

<!-- assumed: the "built for a specific market (Senegal)" framing is used throughout, per context.md §1 — the product is never described as "built for Africa". -->

## Features

- **Verified causes feed** — browse real needs by category (Santé, Alimentation, Matériel) with Urgent / Presque atteint / Récent filters and a weekly editor's pick ("Coup de cœur de la semaine").
- **Transparent mobile-money donations** — Orange Money and Wave only (no card), with a live fee line and the exact net amount the structure receives shown before confirming.
- **Proof of reception** — each funded cause produces a dossier of at least 5 items (photos, video, invoices, delivery notes) plus a written report and a breakdown of how funds were used; moderators review exactly what donors will see.
- **Donor dashboard** — donation history, cumulative impact, access to proof dossiers, and refund requests while funds are held.
- **Organization dashboard** — create/edit causes, track per-cause status timeline, see donations received, and submit proof dossiers.
- **Moderation platform** (separate URL) — queues for structures to validate, causes to moderate, proofs to validate (with auto-flagged items), deletion requests, refund requests, payout-account checks, and the weekly "Coup de cœur" pick.
- **Blood-donation module** — hospitals publish blood-type shortage alerts to opted-in, compatible donors by commune; donors confirm a visit slot; hospitals update stock and thank donors.
- **WhatsApp fallback** — anything the platform cannot handle (in-kind donations, questions) routes to SUNUSOCIAL's WhatsApp.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), React, TypeScript |
| Hosting | Vercel (Pro) |
| Backend & Database | Convex (Pro) — reactive queries/mutations, realtime, file storage |
| Realtime | Convex live queries (progress bars, blood alerts) |
| Auth | Convex Auth (`@convex-dev/auth`) — donors: phone + password, phone verified by SMS code at signup; structures/hospitals/moderators: email + password (12+ chars) + SMS code at each login; sessions ≤ 7 days |
| Payments | **NabooPay** API v2 — Orange Money + Wave; funds held in SUNUSOCIAL's merchant account and paid out per cause; refunds as payouts of the net amount. A `mock` adapter is used in dev/tests |
| File storage | Convex file storage (récépissés, proof media) |
| Email | Resend (organization password resets, org/moderation notifications) |
| SMS | Required (codes, blood alerts, notifications); provider pending — `docs/BOARD_QUESTIONS.md` Q1. Dev uses a console provider |
| Styling | Tailwind CSS + shadcn/ui, themed with the SUNUSOCIAL charte graphique (Montserrat headings, Inter body) |
| Testing | Vitest + `convex-test` (backend), Playwright (e2e) |
| Language | French throughout (UI copy); documentation in English |

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.9 (`.nvmrc`) and **npm** ≥ 10. To *add* dependencies, use npm ≥ 11 (`npx npm@11 install …`): npm 10.9 crashes on Vitest's peer dependencies. `npm ci` works with npm 10.
- A **Convex** account (dev deployment is free)
- A **Vercel** account for deployment (Pro for production)
- **NabooPay** sandbox credentials (or run with `PAYMENT_PROVIDER=mock`)
- A **Resend** API key (email)
- An SMS provider account — _provider pending; local work uses `SMS_PROVIDER=console` (codes printed in the Convex logs)_
- WhatsApp Business number for the contact link

### Installation

```bash
# 1. Clone
git clone <repo-url> sunusocial
cd sunusocial

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# fill in the values described in "Environment Variables" below

# 4. Start Convex (in one terminal) — provisions a dev deployment, writes
#    NEXT_PUBLIC_CONVEX_URL / CONVEX_DEPLOYMENT to .env.local, and regenerates convex/_generated
npx convex dev

# 4a. Once per deployment: Convex Auth keys (JWT_PRIVATE_KEY, JWKS, SITE_URL in the Convex env)
npx @convex-dev/auth
npx convex env set MODERATION_SITE_URL http://moderation.localhost:3000
npx convex env set OTP_HASH_SECRET "$(openssl rand -hex 32)"   # key for SMS code hashes (required in production)

# 4b. Optional: load demo data (structures, causes, donations, a blood alert) from the prototype
npx convex run seed:run

# 4c. Create a moderator: the password link is emailed (printed in the Convex logs in dev)
npx convex run admin:createModerator '{"name": "Fatou Ndiaye", "email": "fatou@example.sn", "phone": "+221770000000"}'

# 5. Start Next.js (in another terminal)
npm run dev
# app on http://localhost:3000  ·  moderation on http://moderation.localhost:3000
```

In development, SMS codes and emails are printed in the Convex logs (`SMS_PROVIDER=console`, no `RESEND_API_KEY`): look for `[SMS console]` and `[email console]`.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Next.js dev server |
| `npx convex dev` | Convex dev deployment + codegen (keep running alongside `npm run dev`) |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | Next route types, then `tsc` on the app and on `convex/` |
| `npm test` | Vitest: `lib/` unit tests and `convex/` tests with `convex-test` |
| `npm run build` | Production build |

`convex/_generated` is committed (Convex's recommendation) so typecheck and tests work without a deployment. `npx convex dev` keeps it up to date; commit it with any change to `convex/`.

## Project Structure

```text
sunusocial/
├── README.md                 # this file
├── CONTRIBUTING.md           # branch strategy, commits, workflow
├── context.md                # project brief (decisions & open items)
├── CLAUDE.md                 # entry point for AI coding agents
├── .claude/skills/           # project skills for AI coding agents (see docs/PROJECT_REVIEW.md §2)
├── .env.example              # environment variable template
├── docs/                     # documentation bundle (PRD, architecture, API, schema, security, roadmaps…)
│   ├── DECISIONS.md          # authoritative decision log — wins over any other doc
│   ├── PARCOURS.md           # every user flow and button in one chart (French), + points to decide
│   └── BOARD_QUESTIONS.md    # open product questions for the SUNUSOCIAL board (French)
├── design/                   # charte graphique PDF + source logo
├── prototype/                # the clickable HTML prototype (reference for build), Netlify-deployable
│   ├── *.dc.html             # screens: landing, donor, structure, hospital, moderation, specs
│   ├── assets/               # logo variants (PNG)
│   └── _ds/                  # "Industry" design-system package (tokens, components)
├── app/                      # Next.js App Router: root layout, charte theme (globals.css), pages
├── components/               # ui/ (shadcn, themed), common/, providers/
├── convex/                   # schema.ts (all tables), validators.ts, seed.ts, _generated/ (committed)
├── lib/                      # types, money (fee math), config (product rules), geo, strings.fr
└── public/                   # static assets (logos)
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `APP_ENV` | `development`, `preview` or `production`. Production refuses the mock/console providers and the seed | Yes (in production) |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL exposed to the browser | Yes |
| `CONVEX_DEPLOYMENT` | Convex deployment identifier for the CLI | Yes |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth signing keys — set in the **Convex** environment (generated by the Convex Auth setup) | Yes |
| `SITE_URL` | Base URL of the app: Convex Auth and organisation password links | Yes |
| `MODERATION_SITE_URL` | Base URL of the moderation app, for moderator password links (Convex env) | Yes |
| `PAYMENT_PROVIDER` | `naboopay` or `mock` (dev/preview/tests only — refused in production) | Yes |
| `NABOOPAY_CHECKOUT_KEY` | NabooPay key with the `checkout` scope (transactions) | If provider = naboopay |
| `NABOOPAY_PAYOUT_KEY` | NabooPay key with the `payout` scope (releases + refunds) | If provider = naboopay |
| `NABOOPAY_WEBHOOK_SECRET` | Secret to verify NabooPay webhook signatures | If provider = naboopay |
| `RESEND_API_KEY` | Resend API key | Yes |
| `EMAIL_FROM` | Sender address on SUNUSOCIAL's domain | Yes |
| `SMS_PROVIDER` | `console` (dev/preview — refused in production) or the chosen provider | Yes |
| `SMS_PROVIDER_API_KEY` | SMS gateway key | In production |
| `SMS_SENDER_ID` | Dedicated SMS sender number/ID | In production |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | E.164 number behind the "Nous contacter sur WhatsApp" links; the buttons are hidden while it is empty (waiting on the board) | Yes |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the donor/structure app | Yes |
| `NEXT_PUBLIC_MODERATION_URL` | Public base URL of the moderation subdomain | Yes |

Product rules (max cause duration, proof deadline, minimum donation, platform fee, phase-2 gate, session length) are config values — see `docs/DECISIONS.md` §3.

## License

Proprietary — © 2026 SUNUSOCIAL. All rights reserved. Developed by JefTech (Phase 1, pro bono). <!-- assumed: no open-source license was specified; the contract is a private engagement. -->
