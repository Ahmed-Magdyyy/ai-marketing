// ─────────────────────────────────────────────────────────────────
// ApiError — throwable error with HTTP status + ErrorCode
// Usage: throw new ApiError(404, ErrorCode.NotFound)
// The global error handler catches this and sends a structured response.
// ─────────────────────────────────────────────────────────────────

import { ErrorCode } from "../types";

class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly data: unknown;

  constructor(
    statusCode: number,
    errorCode: ErrorCode,
    message?: string,
    data: unknown = null,
  ) {
    super(message || errorCode);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export { ApiError };
