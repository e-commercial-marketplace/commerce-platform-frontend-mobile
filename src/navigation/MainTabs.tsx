import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import { useCart } from '../hooks/useCart';
import CartScreen from '../screens/CartScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <View style={styles.iconWrap}><Text style={[styles.icon, focused && styles.iconActive]}>{symbol}</Text></View>;
}

function OrdersPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

export default function MainTabs() {
  const { totalItems } = useCart();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#667085',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        tabBarStyle: { height: 68, paddingTop: 6, paddingBottom: 7, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: 9 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="⌂" focused={focused} /> }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="⌕" focused={focused} /> }} />
      <Tab.Screen name="Cart" component={CartScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="🛒" focused={focused} />, ...(totalItems > 0 ? { tabBarBadge: totalItems > 99 ? '99+' : String(totalItems) } : {}) }} />
      <Tab.Screen
        name="Orders"
        component={OrdersPlaceholder}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.getParent()?.navigate('MyOrders');
          },
        })}
        options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="▤" focused={focused} /> }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Account', tabBarIcon: ({ focused }) => <TabIcon symbol="◉" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { minWidth: 30, height: 27, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 23, lineHeight: 27, color: '#667085' },
  iconActive: { color: colors.primary, fontWeight: '800' },
});
