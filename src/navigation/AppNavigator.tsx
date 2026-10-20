/**
 * Root native stack navigator.
 *
 * Wraps the bottom tabs ("Main" route) so top-level screens can be stacked
 * on top of them. Currently registers the tabs and the product detail screen;
 * further flows (Product List, Filter, Feedback, Checkout, Payment,
 * Authentication) are added here when they are implemented — remember to add
 * the matching entry to RootStackParamList in types.ts at the same time.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../constants/theme';
import ProductDetailScreen from '../screens/ProductDetailScreen';
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
    </Stack.Navigator>
  );
}
