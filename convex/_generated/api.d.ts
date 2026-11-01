/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as causes from "../causes.js";
import type * as crons from "../crons.js";
import type * as donations from "../donations.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_causeViews from "../lib/causeViews.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as moderation from "../moderation.js";
import type * as notify from "../notify.js";
import type * as otp from "../otp.js";
import type * as passwordReset from "../passwordReset.js";
import type * as payments from "../payments.js";
import type * as proofChecks from "../proofChecks.js";
import type * as proofs from "../proofs.js";
import type * as seed from "../seed.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  audit: typeof audit;
  auth: typeof auth;
  causes: typeof causes;
  crons: typeof crons;
  donations: typeof donations;
  files: typeof files;
  http: typeof http;
  "lib/causeViews": typeof lib_causeViews;
  "lib/crypto": typeof lib_crypto;
  "lib/errors": typeof lib_errors;
  "lib/guards": typeof lib_guards;
  "lib/rateLimit": typeof lib_rateLimit;
  moderation: typeof moderation;
  notify: typeof notify;
  otp: typeof otp;
  passwordReset: typeof passwordReset;
  payments: typeof payments;
  proofChecks: typeof proofChecks;
  proofs: typeof proofs;
  seed: typeof seed;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
