/**
 * Application Language Context and Provider.
 *
 * Implements:
 * 1. Runtime language switching ('vi' <-> 'en') without app restart
 * 2. Persistent storage via preferenceStorage (backed by expo-secure-store)
 * 3. Safe fallback for useAppLanguage() so tests outside provider never throw
 * 4. Zero backend requests
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import i18n from './index';
import {
  getCachedLanguagePreference,
  loadStoredPreferences,
  setStoredLanguagePreference,
} from '../services/preferenceStorage';
import type { AppLanguageContextValue, SupportedLanguage } from './types';

export const I18nContext = createContext<AppLanguageContextValue | null>(null);

const defaultLanguageContextValue: AppLanguageContextValue = {
  language: 'vi',
  setLanguage: async () => {},
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => {
    let result = defaultValue ?? key;
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      }
    }
    return result;
  },
};

interface AppI18nProviderProps {
  children: ReactNode;
  initialLanguage?: SupportedLanguage;
}

export function AppI18nProvider({
  children,
  initialLanguage,
}: AppI18nProviderProps) {
  const { t: i18nTranslate } = useTranslation([
    'common',
    'settings',
    'nav',
    'auth',
    'profile',
    'catalog',
    'product',
    'cart',
    'checkout',
    'orders',
    'reviews',
    'seller',
  ]);
  const hasExplicitlyChangedRef = useRef(false);

  const [language, setLanguageState] = useState<SupportedLanguage>(
    initialLanguage ?? getCachedLanguagePreference(),
  );

  // Sync initialLanguage prop if explicitly provided
  useEffect(() => {
    if (initialLanguage && i18n.language !== initialLanguage) {
      void i18n.changeLanguage(initialLanguage);
    }
  }, [initialLanguage]);

  // Initialize language from storage on boot
  useEffect(() => {
    let isMounted = true;
    void loadStoredPreferences().then(({ language: storedLang }) => {
      if (isMounted && initialLanguage === undefined && !hasExplicitlyChangedRef.current) {
        setLanguageState(storedLang);
        if (i18n.language !== storedLang) {
          void i18n.changeLanguage(storedLang);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [initialLanguage]);

  const setLanguage = useCallback(async (newLanguage: SupportedLanguage) => {
    hasExplicitlyChangedRef.current = true;
    setLanguageState(newLanguage);
    await i18n.changeLanguage(newLanguage);
    await setStoredLanguagePreference(newLanguage);
  }, []);

  const t = useCallback(
    (key: string, defaultValue?: string, options?: Record<string, unknown>): string => {
      const translated = options ? i18nTranslate(key, options) : i18nTranslate(key);
      if (translated && translated !== key) {
        return translated;
      }
      let fallback = defaultValue ?? key;
      if (options) {
        for (const [k, v] of Object.entries(options)) {
          fallback = fallback.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }
      }
      return fallback;
    },
    [i18nTranslate],
  );

  const value: AppLanguageContextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Accesses current language context with safe default fallback.
 * Can be called anywhere; if outside provider, defaults to 'vi' without throwing.
 */
export function useAppLanguage(): AppLanguageContextValue {
  const context = useContext(I18nContext);
  return context ?? defaultLanguageContextValue;
}
