/**
 * Bottom tab navigator: Home, Cart, Profile.
 * Hosted inside the "Main" route of the root stack (AppNavigator).
 * The Cart tab shows a badge with the live totalItems from the server cart
 * query (customer-only); no badge is rendered while the cart is empty or when
 * the signed-in account is not a customer.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '../constants/theme';
import { useCart } from '../hooks/useCart';
import CartScreen from '../screens/CartScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const { totalItems } = useCart();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.primary,
          color: colors.onPrimary,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={totalItems > 0 ? { tabBarBadge: String(totalItems) } : undefined}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
