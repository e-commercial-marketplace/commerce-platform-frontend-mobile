/**
 * React Navigation linking configuration for marketplace deep links.
 *
 * Handles:
 * - Direct OS deep-link callback delivery: `marketplace://payment-result?orderId=<uuid>&status=<status>`
 * - Cold-start initial URLs
 * - Background/resume URL events
 * - Deduplication so active WebBrowser.openAuthSessionAsync does not cause double navigation
 *
 * Rules:
 * - `orderId` is required; missing orderId never navigates.
 * - `status` is UX hint only ('COMPLETED' | 'FAILED' | 'INVALID'); never payment proof.
 */

import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import {
  isPaymentUrlHandled,
  markPaymentUrlHandled,
  parsePaymentResultUrl,
} from '../utils/paymentDeepLink';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['marketplace://', 'ecommercemarketplace://'],

  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url && !isPaymentUrlHandled(url)) {
      return url;
    }
    return null;
  },

  subscribe(listener) {
    const onReceiveURL = ({ url }: { url: string }) => {
      if (!isPaymentUrlHandled(url)) {
        listener(url);
      }
    };

    const subscription = Linking.addEventListener('url', onReceiveURL);
    return () => {
      subscription.remove();
    };
  },

  getStateFromPath(path) {
    const parsed = parsePaymentResultUrl(path);
    if (parsed && parsed.orderId) {
      markPaymentUrlHandled(path);
      return {
        routes: [
          {
            name: 'OrderDetail',
            params: {
              orderId: parsed.orderId,
              paymentHint: parsed.paymentHint,
            },
          },
        ],
      };
    }
    return undefined;
  },
};
