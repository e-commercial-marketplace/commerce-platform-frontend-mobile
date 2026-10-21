/**
 * Root native stack navigator.
 *
 * Wraps the bottom tabs ("Main" route) so top-level screens can be stacked
 * on top of them. Currently registers the tabs, the product detail screen and
 * the authentication screens (Login/Register, opened from the guest Profile
 * tab); further flows (Product List, Filter, Feedback, Checkout, Payment) are
 * added here when they are implemented — remember to add the matching entry
 * to RootStackParamList in types.ts at the same time.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../constants/theme';
import LoginScreen from '../screens/LoginScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MainTabs from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{
          headerShown: true,
          title: 'Product Detail',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: true,
          title: 'Login',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerShown: true,
          title: 'Register',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
