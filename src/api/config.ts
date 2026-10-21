/**
 * Central API configuration.
 *
 * The base URL comes from EXPO_PUBLIC_API_BASE_URL (inlined by Expo at bundle
 * time — see .env.example) and must include the version prefix (/api/v1)
 * because the backend mounts every REST controller under it (WebConfig).
 *
 * A single production fallback keeps device builds working without a local
 * .env file; set the env var to override it for local or other environments.
 * The backend URL is public information, never a secret.
 */

const FALLBACK_API_BASE_URL = 'https://commerce-platform-backend-k61l.onrender.com/api/v1';

/** Base URL for every API call; trailing slashes are removed for clean joins. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? FALLBACK_API_BASE_URL).replace(
  /\/+$/,
  '',
);

/**
 * Request timeout. Generous on purpose: the deployed backend runs on a free
 * hosting tier that spins the instance down when idle, so the FIRST request
 * after an idle period pays a cold start.
 *
 * Measured against the deployed backend: a cold request was still pending
 * after 60 s and after 110 s, while a warm request answers in 1-3 s. A
 * timeout shorter than the cold start therefore turns a perfectly valid
 * request into a hard failure, so the budget covers a cold start plus a
 * little headroom.
 */
export const API_TIMEOUT_MS = 120000;
