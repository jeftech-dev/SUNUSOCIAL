# NabooPay webhooks

A webhook is an HTTPS `POST` that NabooPay sends to the merchant's server when a transaction is paid. It is the reliable way to learn that a payment succeeded: the customer may close the browser before reaching `success_url`.

## Setup

1. The merchant registers the endpoint URL in the dashboard: `https://platform.naboopay.com/parametre/` → Integration → Webhooks. This cannot be done through the public API, so tell the user to do it and give them the exact URL of the route you created.
2. The dashboard provides a **secret key** for that webhook. Store it as `NABOOPAY_WEBHOOK_SECRET`.
3. The endpoint must be reachable from the internet over HTTPS. For local development, use a tunnel (ngrok, cloudflared) and register the tunnel URL.

## The request

```
POST <your webhook URL>
Content-Type: application/json
X-Signature: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

Event: `payment_status`, sent when a transaction becomes paid.

Body (webhook version v2, the default for new webhooks):

```json
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "method_of_payment": ["wave", "orange_money"],
  "selected_payment_method": "wave",
  "amount": 5000,
  "fees": 100,
  "currency": "XOF",
  "customer": {
    "first_name": "Awa",
    "last_name": "Diop",
    "phone": "+221771234567",
    "created_at": "2025-01-15T10:30:00Z"
  },
  "transaction_status": "paid",
  "products": [{ "name": "T-shirt", "price": 5000, "quantity": 1 }],
  "is_escrow": false,
  "is_merchant": false,
  "fees_customer_side": false,
  "success_url": "https://example.com/orders/123/thanks",
  "error_url": "https://example.com/orders/123/failed",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:35:00Z",
  "paid_at": "2025-01-15T10:35:00Z"
}
```

`transaction_status` is `paid`. There is no `completed` value. Write the handler to also accept `paid_and_blocked` (paid, funds held in escrow), which is the other paid state a transaction can be in.

Webhooks created with the legacy version v1 receive a smaller body:

```json
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 5000,
  "currency": "XOF",
  "created_at": "2025-01-15T10:30:00Z",
  "transaction_status": "paid",
  "payment_method": "wave"
}
```

Read `order_id`, `transaction_status` and `amount`, which exist in both versions, and treat the other fields as optional.

## Verifying the signature

`X-Signature` is the lowercase hex HMAC-SHA256 of the request body, keyed with the webhook secret.

**Compute it over the raw bytes you received.** Do not parse the JSON and serialise it again: key order, spacing, and the escaping of characters such as `&`, `<`, `>` and non-ASCII letters differ between languages, and the signature will not match. This is the most common cause of "invalid signature" bugs. In practice that means:

| Framework | How to get the raw body |
|---|---|
| Express | `express.raw({ type: "application/json" })` on the webhook route, registered before any global `express.json()` |
| Next.js App Router | `await request.text()` |
| Next.js Pages Router | `export const config = { api: { bodyParser: false } }`, then read the stream |
| NestJS | `rawBody: true` in `NestFactory.create`, then `req.rawBody` |
| Fastify | a raw body plugin, or a custom content type parser that keeps the buffer |
| Flask | `request.get_data()` |
| Django | `request.body` |
| FastAPI | `await request.body()` |
| Laravel | `$request->getContent()` |
| Plain PHP | `file_get_contents('php://input')` |
| Go | `io.ReadAll(r.Body)` |

Then:

1. Compute `hex(hmac_sha256(secret, raw_body))`.
2. Compare it to the header with a constant-time function (`crypto.timingSafeEqual`, `hmac.compare_digest`, `hash_equals`, `hmac.Equal`).
3. If it is missing or different, respond `401` and do nothing else.
4. Only then parse the JSON.

Code for each language is in `examples.md`.

## Handling the event

```
verify signature            → 401 if invalid
parse JSON
look up your order by order_id            → 200 and stop if unknown
if order is already paid                  → 200 and stop   (duplicate delivery)
check amount matches what you expected    → log and alert if not
mark order paid, in one transaction
respond 200
then: send emails, fulfil, etc.
```

- **Idempotent.** The same event can arrive more than once. Marking an already-paid order as paid must be a no-op, and side effects such as emails or stock changes must happen only on the first transition.
- **Fast.** NabooPay waits 5 seconds. Respond `2xx` as soon as the order is updated and move slow work to a background job, or do it after sending the response.
- **Check the amount.** Compare `amount` with what your order expects before fulfilling.
- **Return `2xx` for events you do not care about**, including unknown `order_id`s, so they are not retried.
- **Exempt the route from CSRF protection and session auth.** The signature is the authentication. In Django use `@csrf_exempt`; in Laravel put the route in `routes/api.php` or exclude it from the CSRF middleware.

## Retries

A delivery fails if the endpoint does not answer with a `2xx` status within 5 seconds. NabooPay then retries up to 3 more times, 5 minutes apart. After that the event is dropped.

Because events can be lost this way, add a fallback for orders that stay `pending` on your side: when the customer lands on the success page, or on a schedule, call `GET /transactions/{order_id}` and apply the same "mark paid" logic if the status is `paid` or `paid_and_blocked`.

## Testing

You can exercise the handler locally without a real payment by signing a body yourself:

```bash
BODY='{"order_id":"test-order-1","amount":5000,"currency":"XOF","transaction_status":"paid"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$NABOOPAY_WEBHOOK_SECRET" | sed 's/^.* //')

curl -i -X POST http://localhost:3000/api/webhooks/naboopay \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

Expect `200`. Then change one character of the body without recomputing the signature and expect `401`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Signature never matches | The body was parsed and re-serialised before hashing, a body-parsing middleware ran first, or the wrong secret is configured (each webhook has its own). |
| Signature matches locally but not in production | A proxy or framework middleware is modifying the body, or the production environment variable is missing or has trailing whitespace. |
| Nothing arrives | The URL is not public HTTPS, is not registered in the dashboard, or a firewall or auth middleware is rejecting the request. |
| Events arrive several times | The handler is slower than 5 seconds or returns a non-2xx status, so NabooPay retries. |
| Order stays pending | The webhook was missed. Use the status-check fallback above. |
