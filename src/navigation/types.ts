/**
 * Central navigation typing for the app.
 *
 * Structure:
 * - RootStackParamList: native stack wrapping the whole app. New top-level
 *   screens (Product List, Product Detail, Filter, Feedback, Checkout,
 *   Payment, Authentication, ...) are registered here when they are built.
 * - MainTabParamList: bottom tab navigator hosted inside the "Main" stack
 *   route.
 *
 * Screens receive type-safe props through the helper aliases below, so route
 * names and params are always checked by TypeScript.
 */

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Screens hosted by the bottom tab navigator. */
export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
};

/**
 * Screens hosted by the root native stack.
 *
 * Future stack routes (not implemented yet — add both the type entry and the
 * matching <Stack.Screen> in AppNavigator.tsx at the same time):
 * - ProductList, Filter, Feedback,
 * - Payment.
 */
export type RootStackParamList = {
  /** Nested navigator that renders the bottom tabs. */
  Main: NavigatorScreenParams<MainTabParamList>;
  /** Product detail opened from the catalog; carries only the product id. */
  ProductDetail: { productId: string };
  /** COD checkout for the cart lines selected on the Cart screen. */
  Checkout: { cartItemIds: string[] };
  /** Public seller shop opened from a product detail; carries only the seller id. */
  SellerShop: { sellerId: string };
  /** Customer order history. */
  MyOrders: undefined;
  /** Customer order detail. */
  OrderDetail: { orderId: string };
  /** Seller order fulfillment management. */
  SellerFulfillment: undefined;
  /** Seller product management list. */
  SellerProducts: undefined;
  /** Seller product create or edit form. */
  SellerProductForm: { mode: 'create' } | { mode: 'edit'; productId: string };
  /** Local mock sign-in form; opened from the guest Profile tab. */
  Login: undefined;
  /** Local mock registration form; opened from the guest Profile tab. */
  Register: undefined;
  /** Request password reset code via email. */
  ForgotPassword: undefined;
  /** Set a new password using the emailed 6-digit code. */
  ResetPassword: { email?: string } | undefined;
  /** Authenticated user password change. */
  ChangePassword: undefined;
};

/** Props for screens rendered directly by the root stack. */
export type AppNavigatorScreenProps<RouteName extends keyof RootStackParamList = keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>;

/** Props for screens rendered by the bottom tab navigator. */
export type MainTabScreenProps<RouteName extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, RouteName>,
  NativeStackScreenProps<RootStackParamList>
>;

// Makes untyped navigation hooks (e.g. useNavigation()) resolve to the
// root stack param list by default.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
