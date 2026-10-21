/**
 * Normalized API error used across the app. Screens catch it to show the
 * backend message (invalid credentials, duplicate email, validation) or a
 * friendly transport message (network/timeout) without touching raw Axios
 * shapes. It never carries tokens or credentials.
 */

import axios from 'axios';

import type { ApiErrorPayload } from '../types/api';

/** Codes produced locally when the request never reached the backend. */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
export const TIMEOUT_ERROR_CODE = 'TIMEOUT_ERROR';
export const UNEXPECTED_ERROR_CODE = 'UNEXPECTED_ERROR';

export class ApiError extends Error {
  /** HTTP status, or null when the request never produced a response. */
  readonly status: number | null;
  /** Machine-readable code: backend error.code, or a local transport code. */
  readonly code: string;
  /** Per-field validation messages from the backend, when available. */
  readonly fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    code: string,
    status: number | null,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Converts anything thrown by the API layer into a typed ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const payload: unknown = error.response?.data;
    const envelope = asErrorEnvelope(payload);

    if (envelope != null) {
      return new ApiError(
        envelope.error.message,
        envelope.error.code,
        error.response?.status ?? null,
        toFieldErrors(envelope.error.fieldErrors),
      );
    }

    if (error.response != null) {
      return new ApiError(
        'The server returned an unexpected response. Please try again.',
        UNEXPECTED_ERROR_CODE,
        error.response.status,
      );
    }

    if (error.code === 'ECONNABORTED') {
      return new ApiError('The request timed out. Please try again.', TIMEOUT_ERROR_CODE, null);
    }

    return new ApiError(
      'Unable to connect to the server. Please try again.',
      NETWORK_ERROR_CODE,
      null,
    );
  }

  return new ApiError('Something went wrong. Please try again.', UNEXPECTED_ERROR_CODE, null);
}

type ErrorEnvelope = { error: ApiErrorPayload };

/** Narrows an unknown response body to the backend's failure envelope. */
function asErrorEnvelope(payload: unknown): ErrorEnvelope | null {
  if (typeof payload !== 'object' || payload == null) {
    return null;
  }

  const candidate = payload as { success?: unknown; error?: unknown };
  if (candidate.success !== false || typeof candidate.error !== 'object' || candidate.error == null) {
    return null;
  }

  const error = candidate.error as { code?: unknown; message?: unknown; fieldErrors?: unknown };
  if (typeof error.code !== 'string' || typeof error.message !== 'string') {
    return null;
  }

  return { error: error as ApiErrorPayload };
}

/** Keeps only string values, so malformed payloads cannot leak through. */
function toFieldErrors(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value == null) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
