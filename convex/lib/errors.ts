// Typed application errors. Clients read `error.data` ({ code, message, field }) from a
// ConvexError; `message` is French and can be shown as is.

import { ConvexError } from "convex/values";

import type { ApiError, ApiErrorCode } from "../../lib/types";

export function appError(
  code: ApiErrorCode,
  message: string,
  field?: string,
): ConvexError<ApiError> {
  return new ConvexError<ApiError>({ code, message, field: field ?? null });
}
