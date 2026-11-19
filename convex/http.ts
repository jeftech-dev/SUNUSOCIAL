import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { SIGNUP_RECEIPT_PATH, signupReceiptPreflight, uploadSignupReceipt } from "./files";
import { httpAction } from "./_generated/server";
import { handleWebhook } from "./payments";

const http = httpRouter();

// Convex Auth: OpenID configuration and JWKS used to verify session tokens.
auth.addHttpRoutes(http);

// Organisation signup: the récépissé / agrément upload (convex/files.ts).
http.route({ path: SIGNUP_RECEIPT_PATH, method: "POST", handler: uploadSignupReceipt });
http.route({ path: SIGNUP_RECEIPT_PATH, method: "OPTIONS", handler: signupReceiptPreflight });

/**
 * NabooPay payment webhook (DT-3). The signature is the authentication, so no session or CORS:
 * the raw body is verified before the JSON is even parsed. Slow work is none — recording is a
 * single mutation — so the 5 s budget is comfortable.
 */
export const NABOOPAY_WEBHOOK_PATH = "/payments/naboopay/webhook";
http.route({
  path: NABOOPAY_WEBHOOK_PATH,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const status = await handleWebhook(ctx, rawBody, request.headers.get("X-Signature"));
    return new Response(null, { status });
  }),
});

export default http;
