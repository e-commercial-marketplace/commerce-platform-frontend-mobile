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
  Cart: undefined;
  Profile: undefined;
};

/**
 * Screens hosted by the root native stack.
 *
 * Future stack routes (not implemented yet — add both the type entry and the
 * matching <Stack.Screen> in AppNavigator.tsx at the same time):
 * - ProductList, Filter, Feedback,
 * - Checkout, Payment, Authentication.
 */
export type RootStackParamList = {
  /** Nested navigator that renders the bottom tabs. */
  Main: NavigatorScreenParams<MainTabParamList>;
  /** Product detail opened from the catalog; carries only the product id. */
  ProductDetail: { productId: string };
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
