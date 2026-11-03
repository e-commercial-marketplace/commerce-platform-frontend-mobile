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

import { useAppLanguage } from '../i18n';
import AiAssistantScreen from '../screens/AiAssistantScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
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
import SettingsScreen from '../screens/SettingsScreen';
import { useAppTheme } from '../theme';
import MainTabs from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{
          headerShown: true,
          title: t('nav.productDetail', 'Chi tiết sản phẩm'),
        }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{
          headerShown: true,
          title: t('nav.checkout', 'Thanh toán'),
        }}
      />
      <Stack.Screen
        name="SellerShop"
        component={SellerShopScreen}
        options={{
          headerShown: true,
          title: t('nav.shop', 'Cửa hàng'),
        }}
      />
      <Stack.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        options={{
          headerShown: true,
          title: t('nav.myOrders', 'Đơn hàng của tôi'),
        }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          headerShown: true,
          title: t('nav.orderDetail', 'Chi tiết đơn hàng'),
        }}
      />
      <Stack.Screen
        name="SellerFulfillment"
        component={SellerFulfillmentScreen}
        options={{
          headerShown: true,
          title: t('nav.sellerOrders', 'Đơn bán hàng'),
        }}
      />
      <Stack.Screen
        name="SellerProducts"
        component={SellerProductsScreen}
        options={{
          headerShown: true,
          title: t('nav.myProducts', 'Sản phẩm của tôi'),
        }}
      />
      <Stack.Screen
        name="SellerProductForm"
        component={SellerProductFormScreen}
        options={({ route }) => ({
          headerShown: true,
          title:
            route.params.mode === 'edit'
              ? t('nav.editProduct', 'Chỉnh sửa sản phẩm')
              : t('nav.newProduct', 'Thêm sản phẩm'),
        })}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: true,
          title: t('nav.login', 'Đăng nhập'),
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerShown: true,
          title: t('nav.register', 'Đăng ký'),
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          headerShown: true,
          title: t('nav.forgotPassword', 'Quên mật khẩu'),
        }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{
          headerShown: true,
          title: t('nav.resetPassword', 'Đặt lại mật khẩu'),
        }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerShown: true,
          title: t('nav.changePassword', 'Đổi mật khẩu'),
        }}
      />
      <Stack.Screen
        name="AiAssistant"
        component={AiAssistantScreen}
        options={{
          headerShown: true,
          title: t('nav.aiAssistant', 'Trợ lý AI'),
        }}
      />
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{
          headerShown: true,
          title: t('nav.messages', 'Tin nhắn'),
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={({ route }) => ({
          headerShown: true,
          title: route.params.counterpartName ?? t('nav.chat', 'Trò chuyện'),
        })}
      />
      <Stack.Screen
        name="AdminPortal"
        component={AdminPortalScreen}
        options={{
          headerShown: true,
          title: t('nav.adminPortal', 'Quản trị hệ thống'),
        }}
      />
      <Stack.Screen
        name="AdminSellerApproval"
        component={AdminSellerApprovalScreen}
        options={{
          headerShown: true,
          title: t('nav.adminSellerApproval', 'Quản lý người bán'),
        }}
      />
      <Stack.Screen
        name="AdminUserList"
        component={AdminUserListScreen}
        options={{
          headerShown: true,
          title: t('nav.adminUserList', 'Quản lý người dùng'),
        }}
      />
      <Stack.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={{
          headerShown: true,
          title: t('nav.adminUserDetail', 'Chi tiết người dùng'),
        }}
      />
      <Stack.Screen
        name="AdminUserCreate"
        component={AdminUserCreateScreen}
        options={{
          headerShown: true,
          title: t('nav.adminUserCreate', 'Thêm người dùng mới'),
        }}
      />
      <Stack.Screen
        name="AdminUserEdit"
        component={AdminUserEditScreen}
        options={{
          headerShown: true,
          title: t('nav.adminUserEdit', 'Chỉnh sửa người dùng'),
        }}
      />
      <Stack.Screen
        name="AdminCategory"
        component={AdminCategoryScreen}
        options={{
          headerShown: true,
          title: t('nav.adminCategory', 'Quản lý danh mục'),
        }}
      />
      <Stack.Screen
        name="AdminVoucher"
        component={AdminVoucherScreen}
        options={{
          headerShown: true,
          title: t('nav.adminVoucher', 'Quản lý mã giảm giá'),
        }}
      />
      <Stack.Screen
        name="AdminCarrier"
        component={AdminCarrierScreen}
        options={{
          headerShown: true,
          title: t('nav.adminCarrier', 'Quản lý đơn vị vận chuyển'),
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: t('nav.settings', 'Cài đặt'),
        }}
      />
    </Stack.Navigator>
  );
}
