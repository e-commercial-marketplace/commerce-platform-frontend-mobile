import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useAppLanguage } from '../i18n';
import CartScreen from '../screens/CartScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import { useAppTheme } from '../theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({
  symbol,
  focused,
  activeColor,
  inactiveColor,
}: {
  symbol: string;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <View style={styles.iconWrap}>
      <Text
        style={[
          styles.icon,
          { color: focused ? activeColor : inactiveColor },
          focused && styles.iconActive,
        ]}
      >
        {symbol}
      </Text>
    </View>
  );
}

function OrdersPlaceholder({ backgroundColor }: { backgroundColor: string }) {
  return <View style={{ flex: 1, backgroundColor }} />;
}

export default function MainTabs() {
  const { totalItems } = useCart();
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        tabBarStyle: {
          height: 68,
          paddingTop: 6,
          paddingBottom: 7,
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: 9 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.home', 'Trang chủ'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              symbol="⌂"
              focused={focused}
              activeColor={theme.primary}
              inactiveColor={theme.textSecondary}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: t('nav.search', 'Tìm kiếm'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              symbol="⌕"
              focused={focused}
              activeColor={theme.primary}
              inactiveColor={theme.textSecondary}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: t('nav.cart', 'Giỏ hàng'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              symbol="🛒"
              focused={focused}
              activeColor={theme.primary}
              inactiveColor={theme.textSecondary}
            />
          ),
          ...(totalItems > 0 ? { tabBarBadge: totalItems > 99 ? '99+' : String(totalItems) } : {}),
        }}
      />
      <Tab.Screen
        name="Orders"
        children={() => <OrdersPlaceholder backgroundColor={theme.background} />}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            if (user?.role === 'SELLER') {
              navigation.getParent()?.navigate('SellerFulfillment');
            } else {
              navigation.getParent()?.navigate('MyOrders');
            }
          },
        })}
        options={{
          tabBarLabel: t('nav.orders', 'Đơn hàng'),
          tabBarAccessibilityLabel: 'Orders',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              symbol="▤"
              focused={focused}
              activeColor={theme.primary}
              inactiveColor={theme.textSecondary}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('nav.account', 'Tài khoản'),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              symbol="◉"
              focused={focused}
              activeColor={theme.primary}
              inactiveColor={theme.textSecondary}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { minWidth: 30, height: 27, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 23, lineHeight: 27 },
  iconActive: { fontWeight: '800' },
});
