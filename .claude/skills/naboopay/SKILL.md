---
name: naboopay
description: Integrate the NabooPay payment API (Wave and Orange Money, XOF, Senegal / West Africa) into an application. Use this skill whenever the user wants to accept payments, create a checkout, send payouts, refund a transaction, read balances, or handle payment webhooks with NabooPay, or mentions "NabooPay", "naboopay", "Naboo Pay", "api.naboopay.com", Wave or Orange Money checkout, or mobile money payments in XOF / CFA. Also use it when debugging an existing NabooPay integration (401/403 errors, webhook signature failures, payments stuck in pending).
---

# NabooPay integration

NabooPay is a payment API for West Africa. A merchant creates a transaction, sends the customer to a hosted checkout page where they pay with Wave or Orange Money, and is notified by webhook when the payment succeeds. The same API sends payouts to mobile money wallets and refunds paid transactions.

This skill covers API **v2**. v1 (`/api/v1/...`) is deprecated: do not write new code against it, and when you find v1 code, offer to migrate it.

## Quick facts

| | |
|---|---|
| Base URL | `https://api.naboopay.com/api/v2` |
| Auth | `Authorization: Bearer <API_KEY>` (exactly one space, `Bearer` capitalised) |
| Currency | XOF only. Amounts are **integers**, no decimals, no cents. |
| Errors | Always `{ "error": "human readable message" }` |
| Rate limit | 100 requests per 60 seconds per IP and endpoint, then `429` |
| Dashboard | `https://platform.naboopay.com` (API keys and webhooks under Settings → Integration) |

## Reference files

Read these when you need the detail. Do not guess field names.

- `references/api-reference.md`: every endpoint, required scope, request and response fields, filters, error messages.
- `references/webhooks.md`: payload, signature verification, retries, idempotency.
- `references/examples.md`: working code for Node/TypeScript, Python, PHP and Go.

## How to work

1. **Look at the project first.** Identify the language, framework, HTTP client, how environment variables are loaded, and where server-side routes live. Follow the project's existing patterns instead of introducing new libraries. There is no official SDK to install: call the REST API with the HTTP client the project already uses.
2. **Ask only what you cannot infer.** Usually that is:
   - What to build: accept payments, send payouts, refunds, balance, or a combination.
   - Who pays the fees: the customer (`fees_customer_side: true`, fees added on top) or the merchant (`false`, fees deducted from what they receive). Default to `false` if the user has no preference.
   - Whether funds must be held in escrow (`is_escrow: true`). Only for marketplaces or pay-on-delivery, and it must be enabled on the account by NabooPay.
   - Whether they need webhooks. For any real checkout the answer should be yes; recommend it.
3. **Configure secrets** as environment variables, and add them to the project's example env file without real values:
   - `NABOOPAY_API_KEY`
   - `NABOOPAY_WEBHOOK_SECRET` (only if using webhooks)
4. **Implement** on the server. Keep the API key out of browser and mobile code.
5. **Verify**: make one real call (for example `GET /accounts`) to confirm the key and scope work before building further, and tell the user what you could and could not test.

## The payment flow

```
your server  ──POST /transactions──▶  NabooPay        returns order_id + checkout_url
customer     ──redirect────────────▶  checkout_url    pays with Wave / Orange Money
NabooPay     ──POST webhook────────▶  your server     transaction_status: "paid"
customer     ──redirect────────────▶  success_url     show a confirmation page
```

1. Create the transaction server-side and store the returned `order_id` against your own order record **before** redirecting.
2. Redirect the customer to `checkout_url`.
3. Mark the order paid only when you have confirmed it, either from a verified webhook or by calling `GET /transactions/{order_id}` and seeing `transaction_status` equal to `paid` or `paid_and_blocked`.
4. The `success_url` page only shows a message. Anyone can open that URL, so it must never be what marks an order as paid. On that page, look the order up by your own identifier and display its real status.

Minimal request:

```bash
curl -X POST https://api.naboopay.com/api/v2/transactions \
  -H "Authorization: Bearer $NABOOPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "method_of_payment": ["wave", "orange_money"],
    "products": [{ "name": "T-shirt", "price": 5000, "quantity": 1 }],
    "success_url": "https://example.com/orders/123/thanks",
    "error_url": "https://example.com/orders/123/failed"
  }'
```

## Rules that prevent real bugs

**Amounts**
- The amount is computed by NabooPay as the sum of `price × quantity` over `products`. You do not send a total.
- Every value is an integer number of XOF. The total must be greater than 10. Never multiply by 100.

**Statuses**
- Transaction: `pending`, `paid`, `paid_and_blocked` (paid, held in escrow), `cancelled`, `refunded`.
- Success is `paid`. There is no `completed` or `success` transaction status.
- Payout: `pending`, `completed`, `failed`, `cancelled`.

**API key scopes**
- A key carries one or more scopes: `checkout`, `read`, `write`, `readAndWrite`, `payout`, `management`.
- A valid key with the wrong scope returns `403` with `You don't have permission to perform this action`. When you see that, tell the user which scope the endpoint needs (see the reference) rather than changing code.
- `401 Invalid API key` means the key itself is wrong, or the header is malformed.

**Redirect URLs**
- `success_url` and `error_url` must be plain URLs with no percent-encoded characters (no `%20`, `%2F`, ...). Put a simple alphanumeric ID in the path or query, not an encoded string.
- NabooPay does not append the `order_id` to these URLs. Include your own order reference in them.

**Webhooks**
- Verify the `X-Signature` header as HMAC-SHA256 over the **raw request body bytes**, hex encoded, with a constant-time comparison. Do not parse the JSON and re-serialise it before verifying. See `references/webhooks.md`.
- Webhooks are sent when a transaction becomes paid. They can be delivered more than once, so make the handler idempotent (check whether the order is already marked paid).
- Respond `2xx` within 5 seconds. Do slow work after responding.

**Payouts and refunds move real money**
- Never retry a payout automatically after a timeout or `5xx`. There is no idempotency key. First list payouts (`GET /payouts?recipient_phone=...`) to see whether it went through.
- `409 A payout is already in progress. Please wait.` means another payout for the same organisation is still running. Send payouts one at a time and retry that one after a short delay.
- Payouts above 2,000,000 XOF are not sent immediately. They return `payout_status: "pending"` and wait for manual review.
- Refunds are full refunds only, and the endpoint is `GET /refund/{order_id}`. Being a `GET`, it must never be reachable from a link, a prefetch, or an unauthenticated route in the user's app.
- Both need enough balance on the merchant's main account, otherwise `400 Insufficient balance`.
- Do not run payouts or refunds against the live API to "test" without the user explicitly asking.

**Account limits you may hit**
- `403` mentioning a monthly limit: the organisation has not completed KYB verification and is capped at 200,000 XOF per month.
- `403` mentioning the business profile, escrow, payout, or a payment method "not allowed": the feature is not enabled on the account. This is fixed in the dashboard or by contacting NabooPay, not in code.
- `503`: the feature is temporarily disabled or a provider is unavailable. Surface a clear message to the end user and let them retry later.

## Error handling

Read the `error` string and the status code together. Show a friendly message to end users and log the original.

| Status | Meaning | What to do |
|---|---|---|
| 400 | Invalid body, amount, URL, or state (for example refunding an unpaid transaction) | Fix the request. Not retryable. |
| 401 | Invalid API key, or organisation not active | Check the key and header. |
| 403 | Wrong scope, blocked organisation, feature not enabled, or limit reached | Report to the user. Not retryable. |
| 404 | Unknown `order_id` or account | Check the ID. |
| 409 | A payout is already in progress | Wait, then retry that payout once. |
| 429 | Rate limited | Back off and retry. |
| 5xx | NabooPay or provider failure | Safe to retry reads and transaction creation. **Not** payouts or refunds: check their state first. |

## Before you finish

- [ ] The API key and webhook secret come from environment variables and never reach client-side code.
- [ ] `order_id` is stored with the local order before the redirect.
- [ ] Orders are marked paid only from a verified webhook or a server-side status check.
- [ ] The webhook handler verifies the raw body, is idempotent, and responds quickly.
- [ ] Amounts are integers in XOF.
- [ ] Non-2xx responses are handled and the `error` message is logged.
- [ ] You told the user which scopes their key needs and where to register the webhook URL.
