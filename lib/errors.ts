// Turns errors from Convex calls into French messages for the UI.

import { ConvexError } from "convex/values";

import { fr } from "./strings.fr";
import type { ApiError } from "./types";

export interface UiError {
  message: string;
  field?: string | null;
  code?: string;
}

/** Errors thrown by app functions carry `{ code, message, field }` (convex/lib/errors.ts). */
export function toUiError(error: unknown): UiError {
  if (error instanceof ConvexError) {
    const data = (typeof error.data === "string" ? safeParse(error.data) : error.data) as
      Partial<ApiError> | undefined;
    if (data?.message) return { message: data.message, field: data.field, code: data.code };
  }
  return { message: fr.errors.generic };
}

/** Errors from Convex Auth's signIn only carry a message: map them without revealing details. */
export function signInErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("TooManyFailedAttempts")) return fr.errors.tooManyAttempts;
  if (text.includes("AccountDisabled")) return fr.errors.accountDisabled;
  if (/fetch|network/i.test(text)) return fr.errors.network;
  return fr.errors.invalidCredentials;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
