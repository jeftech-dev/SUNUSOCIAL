import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { SIGNUP_RECEIPT_PATH, signupReceiptPreflight, uploadSignupReceipt } from "./files";

const http = httpRouter();

// Convex Auth: OpenID configuration and JWKS used to verify session tokens.
auth.addHttpRoutes(http);

// Organisation signup: the récépissé / agrément upload (convex/files.ts).
http.route({ path: SIGNUP_RECEIPT_PATH, method: "POST", handler: uploadSignupReceipt });
http.route({ path: SIGNUP_RECEIPT_PATH, method: "OPTIONS", handler: signupReceiptPreflight });

export default http;
