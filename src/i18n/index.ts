/**
 * i18next & react-i18next Configuration.
 *
 * Configures:
 * - Default language: 'vi' (Vietnamese)
 * - Supported languages: 'vi', 'en'
 * - In-memory translation dictionaries
 * - Device-local persistence integration
 * - Zero network requests
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getCachedLanguagePreference } from '../services/preferenceStorage';
import { admin as enAdmin } from './locales/en/admin';
import { ai as enAi } from './locales/en/ai';
import { auth as enAuth } from './locales/en/auth';
import { cart as enCart } from './locales/en/cart';
import { catalog as enCatalog } from './locales/en/catalog';
import { chat as enChat } from './locales/en/chat';
import { checkout as enCheckout } from './locales/en/checkout';
import { common as enCommon } from './locales/en/common';
import { nav as enNav } from './locales/en/nav';
import { orders as enOrders } from './locales/en/orders';
import { product as enProduct } from './locales/en/product';
import { profile as enProfile } from './locales/en/profile';
import { reviews as enReviews } from './locales/en/reviews';
import { seller as enSeller } from './locales/en/seller';
import { settings as enSettings } from './locales/en/settings';
import { admin as viAdmin } from './locales/vi/admin';
import { ai as viAi } from './locales/vi/ai';
import { auth as viAuth } from './locales/vi/auth';
import { cart as viCart } from './locales/vi/cart';
import { catalog as viCatalog } from './locales/vi/catalog';
import { chat as viChat } from './locales/vi/chat';
import { checkout as viCheckout } from './locales/vi/checkout';
import { common as viCommon } from './locales/vi/common';
import { nav as viNav } from './locales/vi/nav';
import { orders as viOrders } from './locales/vi/orders';
import { product as viProduct } from './locales/vi/product';
import { profile as viProfile } from './locales/vi/profile';
import { reviews as viReviews } from './locales/vi/reviews';
import { seller as viSeller } from './locales/vi/seller';
import { settings as viSettings } from './locales/vi/settings';

export const resources = {
  vi: {
    common: viCommon,
    settings: viSettings,
    nav: viNav,
    auth: viAuth,
    profile: viProfile,
    catalog: viCatalog,
    product: viProduct,
    cart: viCart,
    checkout: viCheckout,
    orders: viOrders,
    reviews: viReviews,
    seller: viSeller,
    ai: viAi,
    chat: viChat,
    admin: viAdmin,
  },
  en: {
    common: enCommon,
    settings: enSettings,
    nav: enNav,
    auth: enAuth,
    profile: enProfile,
    catalog: enCatalog,
    product: enProduct,
    cart: enCart,
    checkout: enCheckout,
    orders: enOrders,
    reviews: enReviews,
    seller: enSeller,
    ai: enAi,
    chat: enChat,
    admin: enAdmin,
  },
} as const;

// Synchronous initialization so translations are immediately available at boot
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources,
    lng: getCachedLanguagePreference(),
    fallbackLng: 'vi',
    defaultNS: 'common',
    ns: [
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
      'ai',
      'chat',
      'admin',
    ],
    nsSeparator: '.',
    keySeparator: '.',
    interpolation: {
      escapeValue: false, // React already escapes values safely
    },
    react: {
      useSuspense: false, // Prevents loading suspense fallback in React Native
    },
  });
}

export default i18n;
export * from './types';
export * from './I18nContext';
