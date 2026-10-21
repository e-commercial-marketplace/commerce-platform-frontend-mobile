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
 * Request timeout. Generous on purpose: the deployed backend may need tens of
 * seconds to wake up from a cold start on the hosting platform.
 */
export const API_TIMEOUT_MS = 30000;
