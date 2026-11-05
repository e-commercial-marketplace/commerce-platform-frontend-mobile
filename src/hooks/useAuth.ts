/**
 * Typed accessor for the shared auth state. Throws when used outside an
 * AuthProvider so a misplaced hook fails fast instead of silently reading a
 * guest session.
 */

import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '../context/AuthContext';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context == null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
