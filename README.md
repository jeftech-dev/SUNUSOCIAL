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
| Auth | Convex Auth (`@convex-dev/auth`) — donors: phone + password (no OTP); structures/hospitals/moderators: email + password (12+ chars) + one-time code (email now, SMS once approved) |
| Payments | **NabooPay** — Orange Money + Wave, funds held until release (escrow). A `mock` adapter is used in dev/tests |
| File storage | Convex file storage (récépissés, proof media) |
| Email | Resend (2FA codes until SMS, password resets, org/moderation notifications) |
| SMS | Pending board approval (provider, budget, sender ID) — see `docs/BOARD_QUESTIONS.md` Q1 |
| Styling | Tailwind CSS + shadcn/ui, themed with the SUNUSOCIAL charte graphique (Montserrat headings, Inter body) |
| Testing | Vitest + `convex-test` (backend), Playwright (e2e) |
| Language | French throughout (UI copy); documentation in English |

## Getting Started

### Prerequisites

- **Node.js** ≥ 20 LTS and **npm** ≥ 10 (or pnpm)
- A **Convex** account (dev deployment is free)
- A **Vercel** account for deployment (Pro for production)
- **NabooPay** sandbox credentials (or run with `PAYMENT_PROVIDER=mock`)
- A **Resend** API key (email)
- An SMS provider account — _pending board approval; not needed for local work_
- WhatsApp Business number for the contact link

<!-- assumed: the Next.js app has not been scaffolded yet; the commands below describe the intended setup once it is. The current repo holds the clickable prototype under prototype/. -->

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

# 4. Start Convex (in one terminal) — provisions a dev deployment and watches functions
npx convex dev

# 5. Start Next.js (in another terminal)
npm run dev
# app on http://localhost:3000  ·  moderation on http://moderation.localhost:3000
```

## Project Structure

```text
sunusocial/
├── README.md                 # this file
├── CONTRIBUTING.md           # branch strategy, commits, workflow
├── context.md                # project brief (decisions & open items)
├── .claude/skills/           # project skills for AI coding agents (see docs/PROJECT_REVIEW.md §2)
├── .env.example              # environment variable template
├── docs/                     # documentation bundle (PRD, architecture, API, schema, security, roadmaps…)
│   ├── DECISIONS.md          # authoritative decision log — wins over any other doc
│   └── BOARD_QUESTIONS.md    # open product questions for the SUNUSOCIAL board (French)
├── design/                   # charte graphique PDF + source logo
├── prototype/                # the clickable HTML prototype (reference for build), Netlify-deployable
│   ├── *.dc.html             # screens: landing, donor, structure, hospital, moderation, specs
│   ├── assets/               # logo variants (PNG)
│   └── _ds/                  # "Industry" design-system package (tokens, components)
├── app/                      # Next.js App Router (donor, structure, hospital, moderation route groups)  [to build]
├── components/               # shared React components (cause card, donation modal, proof gallery…)       [to build]
├── convex/                   # Convex schema + queries/mutations/actions (causes, donations, proofs…)      [to build]
├── lib/                      # client/server helpers (formatting, geo lists, fee math, auth guards)        [to build]
└── public/                   # static assets served by Next.js                                            [to build]
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL exposed to the browser | Yes |
| `CONVEX_DEPLOYMENT` | Convex deployment identifier for the CLI | Yes |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth signing keys — set in the **Convex** environment (generated by the Convex Auth setup) | Yes |
| `SITE_URL` | Base URL Convex Auth redirects to | Yes |
| `PAYMENT_PROVIDER` | `naboopay` or `mock` (dev/preview/tests only — refused in production) | Yes |
| `NABOOPAY_API_KEY` | NabooPay API key | If provider = naboopay |
| `NABOOPAY_WEBHOOK_SECRET` | Secret to verify NabooPay webhook signatures | If provider = naboopay |
| `RESEND_API_KEY` | Resend API key | Yes |
| `EMAIL_FROM` | Sender address on SUNUSOCIAL's domain | Yes |
| `OTP_CHANNEL` | `email` or `sms` — where 2FA codes are sent | Yes (`email` until SMS approved) |
| `SMS_ENABLED` | `true` once the board approves SMS | No (default `false`) |
| `SMS_PROVIDER_API_KEY` | SMS gateway key | When SMS is enabled |
| `SMS_SENDER_ID` | Dedicated SMS sender number/ID | When SMS is enabled |
| `WHATSAPP_CONTACT_NUMBER` | E.164 number behind the "Nous contacter sur WhatsApp" links | Yes |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the donor/structure app | Yes |
| `NEXT_PUBLIC_MODERATION_URL` | Public base URL of the moderation subdomain | Yes |

Product rules that wait on the board (blood-alert self-serve, proof deadline, max cause duration, minimum donation, platform fee, refund fee policy) are config values with interim defaults — see `docs/DECISIONS.md` §3.

## License

Proprietary — © 2026 SUNUSOCIAL. All rights reserved. Developed by JefTech (Phase 1, pro bono). <!-- assumed: no open-source license was specified; the contract is a private engagement. -->
