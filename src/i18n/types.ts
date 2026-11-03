/**
 * Language & Translation Types for UI Personalization.
 */

export type SupportedLanguage = 'vi' | 'en';

export interface AppLanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string;
}
