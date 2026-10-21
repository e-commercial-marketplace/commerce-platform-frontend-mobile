/**
 * Authentication domain types, matching the backend DTOs exactly
 * (RegisterRequest, LoginRequest, RefreshTokenRequest, AuthResponse and
 * UserSummaryResponse). Field names are kept identical to the wire format so
 * no mapping layer is needed; the password never becomes part of User.
 */

/** Roles defined by the backend Role enum. */
export type Role = 'CUSTOMER' | 'SELLER' | 'ADMIN';

/** UserSummaryResponse returned by auth endpoints and GET /users/me. */
export type User = {
  /** UUID string assigned by the backend. */
  id: string;
  email: string;
  /** Display name; the backend field is named `name`. */
  name: string;
  role: Role;
};

/** Body of POST /auth/login. */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * Registration input collected by the app. Confirm-password is a UI-only
 * check and is never sent; the customer role is added by the service layer.
 */
export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

/** Body of POST /auth/register (role is always CUSTOMER for this app). */
export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

/** Body of POST /auth/refresh and POST /auth/logout. */
export type RefreshRequest = {
  refreshToken: string;
};

/** Token pair persisted in SecureStore. */
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

/** AuthResponse data returned by register/login/refresh. */
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds (backend: 900 by default). */
  expiresIn: number;
  user: User;
};
