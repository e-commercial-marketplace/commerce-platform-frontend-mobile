/**
 * Shape of the backend's standard response envelope (ApiResponse.java):
 * every endpoint answers { success, data, error, timestamp, traceId }.
 *
 * The backend omits null fields from the JSON (@JsonInclude(NON_NULL)), so
 * `data` is only present on success and `error` only on failure.
 */

export type ApiErrorPayload = {
  /** Stable machine code; switch on this instead of parsing messages. */
  code: string;
  /** Human-readable message supplied by the backend. */
  message: string;
  /** Present only for validation failures: backend field name -> message. */
  fieldErrors?: Record<string, string>;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  timestamp?: string;
  traceId?: string;
};
