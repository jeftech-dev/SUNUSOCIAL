# NabooPay code examples

Adapt these to the project's own HTTP client, error handling and structure. They use only the standard library of each language so they work anywhere.

All of them read `NABOOPAY_API_KEY` and `NABOOPAY_WEBHOOK_SECRET` from the environment.

## Contents

- [Node.js / TypeScript](#nodejs--typescript): client, create transaction, payout, Express webhook, Next.js webhook
- [Python](#python): client, Flask webhook, Django webhook, FastAPI webhook
- [PHP](#php): client, plain PHP webhook, Laravel webhook
- [Go](#go): client, webhook
- [Frontend](#frontend)

## Node.js / TypeScript

Node 18+ has `fetch` built in.

### Client

```ts
// naboopay.ts
const BASE_URL = "https://api.naboopay.com/api/v2";

export class NabooPayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "NabooPayError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.NABOOPAY_API_KEY;
  if (!apiKey) throw new Error("NABOOPAY_API_KEY is not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new NabooPayError(res.status, data.error ?? `NabooPay request failed (${res.status})`);
  }
  return data as T;
}

export type PaymentMethod = "wave" | "orange_money";
export type TransactionStatus = "pending" | "paid" | "paid_and_blocked" | "cancelled" | "refunded";

export interface Product {
  name: string;
  price: number; // integer XOF
  quantity: number;
  description?: string;
}

export interface Customer {
  first_name: string;
  last_name: string;
  phone: string;
}

export interface CreateTransactionInput {
  method_of_payment: PaymentMethod[];
  products: Product[];
  customer?: Customer;
  success_url?: string;
  error_url?: string;
  fees_customer_side?: boolean;
  is_escrow?: boolean;
}

export interface Transaction {
  order_id: string;
  amount: number;
  currency: "XOF";
  transaction_status: TransactionStatus;
  checkout_url?: string;
  selected_payment_method?: PaymentMethod;
  fees?: number;
  paid_at?: string;
}

export const createTransaction = (input: CreateTransactionInput) =>
  request<Transaction>("POST", "/transactions", input);

export const getTransaction = (orderId: string) =>
  request<Transaction>("GET", `/transactions/${encodeURIComponent(orderId)}`);

export const cancelTransaction = (orderId: string) =>
  request<{ message: string }>("DELETE", `/transactions/${encodeURIComponent(orderId)}`);

// Full refund. The API uses GET for this endpoint.
export const refundTransaction = (orderId: string) =>
  request<{ message: string }>("GET", `/refund/${encodeURIComponent(orderId)}`);

export const isPaid = (status: TransactionStatus) =>
  status === "paid" || status === "paid_and_blocked";
```

### Create a transaction and redirect

```ts
import { createTransaction } from "./naboopay";

// `order` is your own record, already saved with status "pending".
const tx = await createTransaction({
  method_of_payment: ["wave", "orange_money"],
  products: order.items.map((i) => ({ name: i.name, price: i.unitPrice, quantity: i.quantity })),
  customer: { first_name: order.firstName, last_name: order.lastName, phone: order.phone },
  success_url: `https://example.com/orders/${order.id}/thanks`,
  error_url: `https://example.com/orders/${order.id}/failed`,
  fees_customer_side: false,
});

// Save the link between your order and NabooPay's before redirecting.
await db.orders.update(order.id, { naboopayOrderId: tx.order_id });

res.redirect(303, tx.checkout_url!);
```

### Payout

```ts
import { NabooPayError } from "./naboopay";

interface Payout {
  order_id: string;
  amount: number;
  payout_status: "pending" | "completed" | "failed" | "cancelled";
}

export async function sendPayout(phone: string, amount: number, reason?: string): Promise<Payout> {
  try {
    return await request<Payout>("POST", "/payouts", {
      selected_payment_method: "wave",
      amount,
      recipient: { first_name: "", last_name: "", phone },
      reason,
    });
  } catch (err) {
    // 409: another payout for this organisation is still running. Safe to retry this one.
    if (err instanceof NabooPayError && err.status === 409) {
      await new Promise((r) => setTimeout(r, 5000));
      return sendPayout(phone, amount, reason); // add a retry cap in real code
    }
    // Any other failure, including timeouts and 5xx: do NOT resend blindly.
    // Check GET /payouts?recipient_phone=... to see whether it went through.
    throw err;
  }
}
```

(`request` is the helper from the client above; export it if you split files.)

Check `payout_status` on the result: `pending` means the amount is above 2,000,000 XOF and is awaiting manual review.

### Webhook: Express

```ts
import express from "express";
import crypto from "node:crypto";
import { isPaid } from "./naboopay";

const app = express();

// Raw body for this route only. Register it BEFORE app.use(express.json()).
app.post("/webhooks/naboopay", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.get("X-Signature") ?? "";
  const expected = crypto
    .createHmac("sha256", process.env.NABOOPAY_WEBHOOK_SECRET!)
    .update(req.body) // Buffer
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(req.body.toString("utf8"));

  if (isPaid(event.transaction_status)) {
    const order = await db.orders.findByNaboopayOrderId(event.order_id);
    if (order && order.status !== "paid" && order.total === event.amount) {
      await db.orders.markPaid(order.id);
      // enqueue emails / fulfilment here
    }
  }

  res.status(200).json({ received: true });
});

app.use(express.json());
```

`timingSafeEqual` throws if the lengths differ, hence the length check.

### Webhook: Next.js App Router

```ts
// app/api/webhooks/naboopay/route.ts
import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  const expected = crypto
    .createHmac("sha256", process.env.NABOOPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.transaction_status === "paid" || event.transaction_status === "paid_and_blocked") {
    // look up the order by event.order_id, skip if already paid, check amount, mark paid
  }

  return NextResponse.json({ received: true });
}
```

To start a checkout in Next.js, call `createTransaction` from a Server Action or Route Handler and `redirect(tx.checkout_url)`. Never import the client into a Client Component, and never prefix the key with `NEXT_PUBLIC_`.

## Python

### Client

```python
# naboopay.py
import json
import os
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://api.naboopay.com/api/v2"


class NabooPayError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _request(method: str, path: str, body: dict | None = None, timeout: float = 30) -> dict | list:
    headers = {"Authorization": f"Bearer {os.environ['NABOOPAY_API_KEY']}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(BASE_URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            message = json.loads(e.read()).get("error", "")
        except ValueError:
            message = ""
        raise NabooPayError(e.code, message or f"NabooPay request failed ({e.code})") from None


def create_transaction(products: list[dict], *, methods=("wave", "orange_money"), customer: dict | None = None,
                       success_url: str | None = None, error_url: str | None = None,
                       fees_customer_side: bool = False, is_escrow: bool = False) -> dict:
    body = {
        "method_of_payment": list(methods),
        "products": products,  # [{"name": str, "price": int, "quantity": int}]
        "fees_customer_side": fees_customer_side,
        "is_escrow": is_escrow,
    }
    if customer:
        body["customer"] = customer
    if success_url:
        body["success_url"] = success_url
    if error_url:
        body["error_url"] = error_url
    return _request("POST", "/transactions", body)


def get_transaction(order_id: str) -> dict:
    return _request("GET", f"/transactions/{urllib.parse.quote(order_id, safe='')}")


def refund_transaction(order_id: str) -> dict:
    # Full refund. The API uses GET for this endpoint.
    return _request("GET", f"/refund/{urllib.parse.quote(order_id, safe='')}")


def create_payout(phone: str, amount: int, *, method: str = "wave", reason: str = "") -> dict:
    # Do not retry automatically on timeouts or 5xx: check GET /payouts first.
    return _request("POST", "/payouts", {
        "selected_payment_method": method,
        "amount": amount,
        "recipient": {"first_name": "", "last_name": "", "phone": phone},
        "reason": reason,
    })


def is_paid(status: str) -> bool:
    return status in ("paid", "paid_and_blocked")
```

If the project already uses `requests` or `httpx`, use that instead of `urllib`.

### Signature helper

```python
import hashlib
import hmac
import os


def verify_signature(raw_body: bytes, signature: str | None) -> bool:
    expected = hmac.new(os.environ["NABOOPAY_WEBHOOK_SECRET"].encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")
```

### Webhook: Flask

```python
import json
from flask import Flask, request, jsonify

app = Flask(__name__)


@app.post("/webhooks/naboopay")
def naboopay_webhook():
    raw = request.get_data()  # raw bytes, before any JSON parsing
    if not verify_signature(raw, request.headers.get("X-Signature")):
        return jsonify(error="Invalid signature"), 401

    event = json.loads(raw)
    if is_paid(event.get("transaction_status", "")):
        mark_order_paid(event["order_id"], event["amount"])  # idempotent
    return jsonify(received=True), 200
```

### Webhook: Django

```python
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


@csrf_exempt
@require_POST
def naboopay_webhook(request):
    if not verify_signature(request.body, request.headers.get("X-Signature")):
        return JsonResponse({"error": "Invalid signature"}, status=401)

    event = json.loads(request.body)
    if is_paid(event.get("transaction_status", "")):
        mark_order_paid(event["order_id"], event["amount"])  # idempotent
    return JsonResponse({"received": True})
```

### Webhook: FastAPI

```python
import json
from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()


@app.post("/webhooks/naboopay")
async def naboopay_webhook(request: Request, x_signature: str | None = Header(default=None)):
    raw = await request.body()
    if not verify_signature(raw, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = json.loads(raw)
    if is_paid(event.get("transaction_status", "")):
        mark_order_paid(event["order_id"], event["amount"])  # idempotent
    return {"received": True}
```

## PHP

### Client

```php
<?php
// NabooPay.php

class NabooPayException extends Exception {}

class NabooPay
{
    private const BASE_URL = 'https://api.naboopay.com/api/v2';

    public function __construct(private string $apiKey) {}

    private function request(string $method, string $path, ?array $body = null): array
    {
        $headers = ['Authorization: Bearer ' . $this->apiKey];
        $ch = curl_init(self::BASE_URL . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
        ]);
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $raw = curl_exec($ch);
        if ($raw === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new NabooPayException('NabooPay request failed: ' . $error);
        }
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode($raw, true) ?? [];
        if ($status < 200 || $status >= 300) {
            throw new NabooPayException($data['error'] ?? "NabooPay request failed ($status)", $status);
        }
        return $data;
    }

    /** @param array<int, array{name: string, price: int, quantity: int}> $products */
    public function createTransaction(array $products, array $options = []): array
    {
        return $this->request('POST', '/transactions', array_merge([
            'method_of_payment'  => ['wave', 'orange_money'],
            'products'           => $products,
            'fees_customer_side' => false,
        ], $options));
    }

    public function getTransaction(string $orderId): array
    {
        return $this->request('GET', '/transactions/' . rawurlencode($orderId));
    }

    /** Full refund. The API uses GET for this endpoint. */
    public function refundTransaction(string $orderId): array
    {
        return $this->request('GET', '/refund/' . rawurlencode($orderId));
    }

    /** Do not retry automatically on timeouts or 5xx: check GET /payouts first. */
    public function createPayout(string $phone, int $amount, string $method = 'wave', string $reason = ''): array
    {
        return $this->request('POST', '/payouts', [
            'selected_payment_method' => $method,
            'amount'                  => $amount,
            'recipient'               => ['first_name' => '', 'last_name' => '', 'phone' => $phone],
            'reason'                  => $reason,
        ]);
    }
}

// Usage
$naboo = new NabooPay(getenv('NABOOPAY_API_KEY'));
$tx = $naboo->createTransaction(
    [['name' => 'T-shirt', 'price' => 5000, 'quantity' => 1]],
    ['success_url' => "https://example.com/orders/$orderId/thanks", 'error_url' => "https://example.com/orders/$orderId/failed"]
);
// save $tx['order_id'] with your order, then:
header('Location: ' . $tx['checkout_url'], true, 303);
exit;
```

### Webhook: plain PHP

```php
<?php
$raw = file_get_contents('php://input'); // raw body, do not decode before verifying
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
$expected = hash_hmac('sha256', $raw, getenv('NABOOPAY_WEBHOOK_SECRET'));

header('Content-Type: application/json');

if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$event = json_decode($raw, true);
if (in_array($event['transaction_status'] ?? '', ['paid', 'paid_and_blocked'], true)) {
    markOrderPaid($event['order_id'], $event['amount']); // idempotent
}

http_response_code(200);
echo json_encode(['received' => true]);
```

### Webhook: Laravel

```php
// routes/api.php  (api routes have no CSRF check)
Route::post('/webhooks/naboopay', NabooPayWebhookController::class);

// app/Http/Controllers/NabooPayWebhookController.php
class NabooPayWebhookController extends Controller
{
    public function __invoke(Request $request)
    {
        $raw = $request->getContent();
        $expected = hash_hmac('sha256', $raw, config('services.naboopay.webhook_secret'));

        if (!hash_equals($expected, (string) $request->header('X-Signature'))) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $event = json_decode($raw, true);
        if (in_array($event['transaction_status'] ?? '', ['paid', 'paid_and_blocked'], true)) {
            // look up the order by $event['order_id'], skip if already paid, check amount, mark paid
        }

        return response()->json(['received' => true]);
    }
}
```

Add `'naboopay' => ['api_key' => env('NABOOPAY_API_KEY'), 'webhook_secret' => env('NABOOPAY_WEBHOOK_SECRET')]` to `config/services.php`.

## Go

### Client

```go
package naboopay

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

const baseURL = "https://api.naboopay.com/api/v2"

var httpClient = &http.Client{Timeout: 30 * time.Second}

type Error struct {
	Status  int
	Message string `json:"error"`
}

func (e *Error) Error() string { return fmt.Sprintf("naboopay: %d %s", e.Status, e.Message) }

func do(ctx context.Context, method, path string, body, out any) error {
	var buf *bytes.Reader = bytes.NewReader(nil)
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		buf = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, buf)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("NABOOPAY_API_KEY"))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		apiErr := &Error{Status: res.StatusCode}
		_ = json.NewDecoder(res.Body).Decode(apiErr)
		return apiErr
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}

type Product struct {
	Name        string `json:"name"`
	Price       int    `json:"price"` // integer XOF
	Quantity    int    `json:"quantity"`
	Description string `json:"description,omitempty"`
}

type Customer struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone"`
}

type CreateTransactionRequest struct {
	MethodOfPayment  []string  `json:"method_of_payment"`
	Products         []Product `json:"products"`
	Customer         *Customer `json:"customer,omitempty"`
	SuccessURL       string    `json:"success_url,omitempty"`
	ErrorURL         string    `json:"error_url,omitempty"`
	FeesCustomerSide bool      `json:"fees_customer_side"`
	IsEscrow         bool      `json:"is_escrow"`
}

type Transaction struct {
	OrderID           string `json:"order_id"`
	Amount            int    `json:"amount"`
	Currency          string `json:"currency"`
	TransactionStatus string `json:"transaction_status"`
	CheckoutURL       string `json:"checkout_url"`
}

func (t Transaction) IsPaid() bool {
	return t.TransactionStatus == "paid" || t.TransactionStatus == "paid_and_blocked"
}

func CreateTransaction(ctx context.Context, in CreateTransactionRequest) (*Transaction, error) {
	var tx Transaction
	return &tx, do(ctx, http.MethodPost, "/transactions", in, &tx)
}

func GetTransaction(ctx context.Context, orderID string) (*Transaction, error) {
	var tx Transaction
	return &tx, do(ctx, http.MethodGet, "/transactions/"+url.PathEscape(orderID), nil, &tx)
}

// RefundTransaction issues a full refund. The API uses GET for this endpoint.
func RefundTransaction(ctx context.Context, orderID string) error {
	return do(ctx, http.MethodGet, "/refund/"+url.PathEscape(orderID), nil, nil)
}
```

### Webhook

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
)

func naboopayWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		http.Error(w, `{"error":"Bad request"}`, http.StatusBadRequest)
		return
	}

	mac := hmac.New(sha256.New, []byte(os.Getenv("NABOOPAY_WEBHOOK_SECRET")))
	mac.Write(raw)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(r.Header.Get("X-Signature"))) {
		http.Error(w, `{"error":"Invalid signature"}`, http.StatusUnauthorized)
		return
	}

	var event struct {
		OrderID           string `json:"order_id"`
		Amount            int    `json:"amount"`
		TransactionStatus string `json:"transaction_status"`
	}
	if err := json.Unmarshal(raw, &event); err != nil {
		http.Error(w, `{"error":"Bad request"}`, http.StatusBadRequest)
		return
	}

	if event.TransactionStatus == "paid" || event.TransactionStatus == "paid_and_blocked" {
		// look up the order by event.OrderID, skip if already paid, check amount, mark paid
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"received":true}`))
}
```

## Frontend

The browser never talks to NabooPay directly. A "Pay" button posts to your own backend, which creates the transaction and returns or redirects to `checkout_url`:

```ts
// client side
const res = await fetch("/api/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orderId }),
});
const { checkoutUrl } = await res.json();
window.location.assign(checkoutUrl);
```

Compute prices on the server from your own data. Do not trust amounts sent by the browser.

For mobile apps (React Native, Flutter, native), do the same: call your backend, open `checkout_url` in the system browser or an in-app browser tab, and confirm the payment from your backend, which learns about it through the webhook.
