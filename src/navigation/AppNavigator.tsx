/**
 * Root native stack navigator.
 *
 * Wraps the bottom tabs ("Main" route) so top-level flows can be stacked on
 * top later (Product List, Product Detail, Filter, Feedback, Checkout,
 * Payment, Authentication). Only the tabs are registered at this stage —
 * future screens are intentionally not stubbed.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabs from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      {/*
        Future stack screens — add a matching entry to RootStackParamList in
        types.ts when they are implemented:
        ProductList, ProductDetail, Filter, Feedback, Checkout, Payment,
        Authentication.
      */}
    </Stack.Navigator>
  );
}
