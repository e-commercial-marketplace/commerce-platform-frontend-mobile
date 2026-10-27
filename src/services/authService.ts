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
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshRequest,
  RegisterInput,
  RegisterRequest,
  ResetPasswordRequest,
  Role,
  User,
} from '../types/auth';

/** Default role for public registration. */
const DEFAULT_ROLE: Role = 'CUSTOMER';

/** POST /auth/login — the backend validates the credentials. */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
  return unwrapData(response);
}

/** POST /auth/register — sends the selected role (defaults to CUSTOMER; backend rejects ADMIN). */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const body: RegisterRequest = {
    email: input.email,
    password: input.password,
    name: input.name,
    role: input.role ?? DEFAULT_ROLE,
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

/** POST /auth/password/forgot — requests a 6-digit reset code by email. */
export async function forgotPassword(body: ForgotPasswordRequest): Promise<void> {
  const response = await apiClient.post<ApiResponse<null>>('/auth/password/forgot', body);
  unwrapVoid(response);
}

/** POST /auth/password/reset — sets a new password using the emailed 6-digit code. */
export async function resetPassword(body: ResetPasswordRequest): Promise<void> {
  const response = await apiClient.post<ApiResponse<null>>('/auth/password/reset', body);
  unwrapVoid(response);
}

/** PATCH /users/me/password — changes current user password and returns rotated tokens. */
export async function changePassword(body: ChangePasswordRequest): Promise<AuthResponse> {
  const response = await apiClient.patch<ApiResponse<AuthResponse>>('/users/me/password', body);
  return unwrapData(response);
}
