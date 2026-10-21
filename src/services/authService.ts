/**
 * Auth API calls — thin typed wrappers over the real backend endpoints
 * (contract verified from the backend source; no mock behavior remains).
 * Failures surface as ApiError so screens can display the backend message
 * (invalid credentials, duplicate email, field validation).
 */

import { apiClient, refreshSession, unwrapData, unwrapVoid } from '../api/client';
import type { ApiResponse } from '../types/api';
import type {
  AuthResponse,
  LoginRequest,
  RefreshRequest,
  RegisterInput,
  RegisterRequest,
  Role,
  User,
} from '../types/auth';

/** Public self-registration is limited to customers in this app. */
const CUSTOMER_ROLE: Role = 'CUSTOMER';

/** POST /auth/login — the backend validates the credentials. */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
  return unwrapData(response);
}

/** POST /auth/register — always sends the CUSTOMER role (backend rejects ADMIN). */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const body: RegisterRequest = {
    email: input.email,
    password: input.password,
    name: input.name,
    role: CUSTOMER_ROLE,
  };
  const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/register', body);
  return unwrapData(response);
}

/**
 * POST /auth/refresh — the shared single-flight rotation from the API client
 * (also used automatically by the 401 interceptor, so the endpoint has exactly
 * one implementation).
 */
export { refreshSession as refresh };

/** POST /auth/logout — requires the Bearer access token plus the refresh token body. */
export async function logout(refreshToken: string): Promise<void> {
  const body: RefreshRequest = { refreshToken };
  const response = await apiClient.post<ApiResponse<null>>('/auth/logout', body);
  unwrapVoid(response);
}

/** GET /users/me — current profile; used to restore the session at startup. */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<ApiResponse<User>>('/users/me');
  return unwrapData(response);
}
