/**
 * Root native stack navigator.
 *
 * Wraps the bottom tabs ("Main" route) so top-level screens can be stacked
 * on top of them. Currently registers the tabs, product detail, the COD
 * checkout screen and the authentication screens (Login/Register, opened from
 * the guest Profile tab, plus Forgot/Reset Password flows); further flows
 * (Product List, Filter, Feedback, Payment) are added here when they are
 * implemented — remember to add the matching entry to RootStackParamList in
 * types.ts at the same time.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../constants/theme';
import AiAssistantScreen from '../screens/AiAssistantScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import ConversationListScreen from '../screens/ConversationListScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import LoginScreen from '../screens/LoginScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import SellerFulfillmentScreen from '../screens/SellerFulfillmentScreen';
import SellerProductFormScreen from '../screens/SellerProductFormScreen';
import SellerProductsScreen from '../screens/SellerProductsScreen';
import SellerShopScreen from '../screens/SellerShopScreen';
import AdminPortalScreen from '../screens/admin/AdminPortalScreen';
import AdminSellerApprovalScreen from '../screens/admin/AdminSellerApprovalScreen';
import AdminUserListScreen from '../screens/admin/AdminUserListScreen';
import AdminUserDetailScreen from '../screens/admin/AdminUserDetailScreen';
import AdminUserCreateScreen from '../screens/admin/AdminUserCreateScreen';
import AdminUserEditScreen from '../screens/admin/AdminUserEditScreen';
import AdminCategoryScreen from '../screens/admin/AdminCategoryScreen';
import AdminVoucherScreen from '../screens/admin/AdminVoucherScreen';
import AdminCarrierScreen from '../screens/admin/AdminCarrierScreen';
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
        name="Checkout"
        component={CheckoutScreen}
        options={{
          headerShown: true,
          title: 'Checkout',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="SellerShop"
        component={SellerShopScreen}
        options={{
          headerShown: true,
          title: 'Shop',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        options={{
          headerShown: true,
          title: 'My Orders',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          headerShown: true,
          title: 'Order Detail',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="SellerFulfillment"
        component={SellerFulfillmentScreen}
        options={{
          headerShown: true,
          title: 'Seller Orders',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="SellerProducts"
        component={SellerProductsScreen}
        options={{
          headerShown: true,
          title: 'My Products',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="SellerProductForm"
        component={SellerProductFormScreen}
        options={({ route }) => ({
          headerShown: true,
          title: route.params.mode === 'edit' ? 'Edit Product' : 'New Product',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        })}
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
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          headerShown: true,
          title: 'Forgot Password',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{
          headerShown: true,
          title: 'Reset Password',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerShown: true,
          title: 'Change Password',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AiAssistant"
        component={AiAssistantScreen}
        options={{
          headerShown: true,
          title: 'Trợ lý AI',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{
          headerShown: true,
          title: 'Tin nhắn',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={({ route }) => ({
          headerShown: true,
          title: route.params.counterpartName ?? 'Trò chuyện',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        })}
      />
      <Stack.Screen
        name="AdminPortal"
        component={AdminPortalScreen}
        options={{
          headerShown: true,
          title: 'Quản trị hệ thống',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminSellerApproval"
        component={AdminSellerApprovalScreen}
        options={{
          headerShown: true,
          title: 'Quản lý người bán',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminUserList"
        component={AdminUserListScreen}
        options={{
          headerShown: true,
          title: 'Quản lý người dùng',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={{
          headerShown: true,
          title: 'Chi tiết người dùng',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminUserCreate"
        component={AdminUserCreateScreen}
        options={{
          headerShown: true,
          title: 'Thêm người dùng mới',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminUserEdit"
        component={AdminUserEditScreen}
        options={{
          headerShown: true,
          title: 'Chỉnh sửa người dùng',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminCategory"
        component={AdminCategoryScreen}
        options={{
          headerShown: true,
          title: 'Quản lý danh mục',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminVoucher"
        component={AdminVoucherScreen}
        options={{
          headerShown: true,
          title: 'Quản lý mã giảm giá',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AdminCarrier"
        component={AdminCarrierScreen}
        options={{
          headerShown: true,
          title: 'Quản lý đơn vị vận chuyển',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}
