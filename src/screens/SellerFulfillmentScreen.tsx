/**
 * Seller Order Fulfillment & Shipment Management Screen (Phases 3, 4 & 5).
 *
 * Implements:
 * 1. WORKSPACE SELECTOR:
 *    - Order Items workspace: Line-item review, confirmation, cancellation, and bundling into shipments.
 *    - Shipments workspace: End-to-end shipment lifecycle management across all 7 statuses.
 *
 * 2. ORDER ITEMS WORKSPACE (Phases 3 & 4):
 *    - PENDING, CONFIRMED, CANCELLED filtering
 *    - Item confirmation (with unpaid VNPAY protection)
 *    - Item cancellation dialog (with optional reason)
 *    - Per-order bundling on CONFIRMED tab (enforcing ONE SHIPMENT PER ORDER)
 *    - Shipment creation modal (Platform Delivery vs Self Delivery)
 *
 * 3. SHIPMENTS WORKSPACE (Phase 5):
 *    - Server-side filtering across all 7 statuses: PENDING, PREPARING, SHIPPED, DELIVERED, FAILED, RETURNED, CANCELLED
 *    - Pull-to-refresh, loading indicator, status-sensitive empty messages, and error retry
 *    - Pagination (previous / next) with automatic page-0 reset on filter change
 *    - Safe data rendering: no customer PII, no fake tracking codes, no fake carriers for SELF_DELIVERY
 *    - Strict NEXT transitions matching backend state machine
 *    - Transition modal with mandatory trackingCode for SHIPPED, warning for CANCELLED, and multi-seller aggregation explanations
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import CancelOrderItemModal from '../components/seller/CancelOrderItemModal';
import CreateShipmentModal from '../components/seller/CreateShipmentModal';
import SellerOrderItemCard from '../components/seller/SellerOrderItemCard';
import SellerOrderItemFilters from '../components/seller/SellerOrderItemFilters';
import SellerShipmentCard from '../components/seller/SellerShipmentCard';
import SellerShipmentFilters from '../components/seller/SellerShipmentFilters';
import ShipmentOrderGroup from '../components/seller/ShipmentOrderGroup';
import UpdateShipmentStatusModal from '../components/seller/UpdateShipmentStatusModal';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAppTheme } from '../theme';
import { useAppLanguage } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import {
  useCancelSellerOrderItem,
  useConfirmSellerOrderItem,
  useSellerOrderItems,
  useSellerShipments,
  useUpdateSellerShipmentStatus,
} from '../hooks/useSellerFulfillment';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type {
  OrderItemStatus,
  SellerOrderItem,
  SellerShipment,
  ShipmentStatus,
} from '../types/sellerApi';

const PAGE_SIZE = 20;

type WorkspaceMode = 'ORDER_ITEMS' | 'SHIPMENTS';

const ORDER_ITEM_EMPTY_MESSAGES: Record<OrderItemStatus, string> = {
  PENDING: 'No pending order items to fulfill.',
  CONFIRMED: 'No confirmed order items.',
  CANCELLED: 'No cancelled order items.',
};

const SHIPMENT_EMPTY_MESSAGES: Record<ShipmentStatus, string> = {
  PENDING: 'No pending shipments.',
  PREPARING: 'No shipments currently being prepared.',
  SHIPPED: 'No shipments in transit.',
  DELIVERED: 'No delivered shipments.',
  FAILED: 'No failed shipments.',
  RETURNED: 'No returned shipments.',
  CANCELLED: 'No cancelled shipments.',
};

type OrderGroup = {
  orderId: string;
  items: SellerOrderItem[];
};

export default function SellerFulfillmentScreen({
  navigation,
}: AppNavigatorScreenProps<'SellerFulfillment'>) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { user, isAuthenticated } = useAuth();
  const isSeller = isAuthenticated && user?.role === 'SELLER';

  // Workspace Mode (Order Items vs Shipments)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>('ORDER_ITEMS');

  // ==========================================
  // Order Items State (Phases 3 & 4)
  // ==========================================
  const [selectedStatus, setSelectedStatus] = useState<OrderItemStatus>('PENDING');
  const [page, setPage] = useState(0);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingItem, setCancellingItem] = useState<SellerOrderItem | null>(null);
  const [cancelErrorMessage, setCancelErrorMessage] = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState<OrderGroup | null>(null);

  // ==========================================
  // Shipments State (Phase 5)
  // ==========================================
  const [selectedShipmentStatus, setSelectedShipmentStatus] =
    useState<ShipmentStatus>('PENDING');
  const [shipmentPage, setShipmentPage] = useState(0);

  const [updatingShipment, setUpdatingShipment] = useState<SellerShipment | null>(null);
  const [targetShipmentStatus, setTargetShipmentStatus] = useState<ShipmentStatus | null>(null);
  const [updateStatusErrorMessage, setUpdateStatusErrorMessage] = useState<string | null>(null);

  // ==========================================
  // Queries & Mutations
  // ==========================================
  const orderItemsQuery = useSellerOrderItems(
    {
      status: selectedStatus,
      page,
      size: PAGE_SIZE,
    },
    isSeller,
  );
  const orderItemsData = orderItemsQuery?.data;
  const isLoadingOrderItems = orderItemsQuery?.isLoading ?? false;
  const isFetchingOrderItems = orderItemsQuery?.isFetching ?? false;
  const isOrderItemsError = orderItemsQuery?.isError ?? false;
  const orderItemsError = orderItemsQuery?.error;
  const refetchOrderItems = orderItemsQuery?.refetch;

  const shipmentsQuery = useSellerShipments(
    {
      status: selectedShipmentStatus,
      page: shipmentPage,
      size: PAGE_SIZE,
    },
    isSeller,
  );
  const shipmentsData = shipmentsQuery?.data;
  const isLoadingShipments = shipmentsQuery?.isLoading ?? false;
  const isFetchingShipments = shipmentsQuery?.isFetching ?? false;
  const isShipmentsError = shipmentsQuery?.isError ?? false;
  const shipmentsError = shipmentsQuery?.error;
  const refetchShipments = shipmentsQuery?.refetch;

  const confirmMutation = useConfirmSellerOrderItem();
  const cancelMutation = useCancelSellerOrderItem();
  const updateShipmentStatusMutation = useUpdateSellerShipmentStatus();

  // Order Items aggregation
  const items = orderItemsData?.content ?? [];
  const totalItemPages = orderItemsData?.totalPages ?? 0;
  const totalItemElements = orderItemsData?.totalElements ?? 0;

  // Shipments aggregation
  const shipments = shipmentsData?.content ?? [];
  const totalShipmentPages = shipmentsData?.totalPages ?? 0;
  const totalShipmentElements = shipmentsData?.totalElements ?? 0;

  // Group confirmed items by orderId to enforce ONE SHIPMENT PER ORDER
  const orderGroups = useMemo<OrderGroup[]>(() => {
    if (selectedStatus !== 'CONFIRMED') {
      return [];
    }
    const groupMap = new Map<string, SellerOrderItem[]>();
    for (const item of items) {
      const existing = groupMap.get(item.orderId) ?? [];
      existing.push(item);
      groupMap.set(item.orderId, existing);
    }
    return Array.from(groupMap.entries()).map(([orderId, groupItems]) => ({
      orderId,
      items: groupItems,
    }));
  }, [items, selectedStatus]);

  if (!isAuthenticated || user?.role !== 'SELLER') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.centerState}>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('seller.sellerAccessRequired', 'Seller Access Required')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t(
              'seller.sellerAccessRequiredSubtitle',
              'This area is only accessible to authenticated seller accounts.',
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================
  // Workspace Handlers
  // ==========================================
  const handleWorkspaceChange = (mode: WorkspaceMode) => {
    if (mode !== activeWorkspace) {
      setActiveWorkspace(mode);
    }
  };

  // ==========================================
  // Order Item Handlers
  // ==========================================
  const handleItemStatusChange = (newStatus: OrderItemStatus) => {
    if (newStatus !== selectedStatus) {
      setSelectedStatus(newStatus);
      setPage(0);
    }
  };

  const handleConfirmItem = async (item: SellerOrderItem) => {
    if (confirmingId != null || confirmMutation?.isPending) {
      return;
    }

    setConfirmingId(item.id);
    try {
      if (confirmMutation?.mutateAsync) {
        await confirmMutation.mutateAsync(item.id);
      }
      Alert.alert('Item Confirmed', `"${item.productName}" has been confirmed for fulfillment.`);
    } catch (err) {
      const apiError = toApiError(err);
      let userFriendlyMessage = apiError.message;

      if (apiError.message.toLowerCase().includes('not paid')) {
        userFriendlyMessage = 'The order is not paid yet. Pre-paid orders must be PAID before confirmation.';
      } else if (apiError.status === 403) {
        userFriendlyMessage = 'You do not have permission to confirm this order item.';
      }

      Alert.alert('Cannot Confirm Item', userFriendlyMessage);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleOpenCancel = (item: SellerOrderItem) => {
    setCancelErrorMessage(null);
    setCancellingItem(item);
  };

  const handleCloseCancelModal = () => {
    if (cancelMutation?.isPending) {
      return;
    }
    setCancellingItem(null);
    setCancelErrorMessage(null);
  };

  const handleConfirmCancel = async (item: SellerOrderItem, cancelReason?: string) => {
    setCancelErrorMessage(null);
    try {
      if (cancelMutation?.mutateAsync) {
        await cancelMutation.mutateAsync({
          orderItemId: item.id,
          cancelReason,
        });
      }

      setCancellingItem(null);
      Alert.alert('Item Cancelled', `"${item.productName}" has been cancelled.`);
    } catch (err) {
      const apiError = toApiError(err);
      let message = apiError.message;

      if (apiError.code === 'CANNOT_CANCEL_AFTER_SHIPMENT' || apiError.message.toLowerCase().includes('cancel the shipment')) {
        message = 'This order item has already been assigned to a shipment. Cancel the shipment instead.';
      } else if (apiError.code === 'CANNOT_CANCEL_AFTER_PAYMENT' || apiError.message.toLowerCase().includes('already paid')) {
        message = 'A shipment or item of an already paid order cannot be cancelled by the seller.';
      } else if (apiError.status === 403) {
        message = 'You do not have permission to cancel this order item.';
      }

      setCancelErrorMessage(message);
    }
  };

  // ==========================================
  // Shipment Handlers (Phase 5)
  // ==========================================
  const handleShipmentStatusChange = (newStatus: ShipmentStatus) => {
    if (newStatus !== selectedShipmentStatus) {
      setSelectedShipmentStatus(newStatus);
      setShipmentPage(0);
    }
  };

  const handleOpenUpdateShipmentStatus = (
    shipment: SellerShipment,
    targetStatus: ShipmentStatus,
  ) => {
    setUpdateStatusErrorMessage(null);
    setUpdatingShipment(shipment);
    setTargetShipmentStatus(targetStatus);
  };

  const handleCloseUpdateShipmentModal = () => {
    if (updateShipmentStatusMutation?.isPending) {
      return;
    }
    setUpdatingShipment(null);
    setTargetShipmentStatus(null);
    setUpdateStatusErrorMessage(null);
  };

  const handleConfirmUpdateShipmentStatus = async (
    shipmentId: string,
    targetStatus: ShipmentStatus,
    trackingCode?: string,
  ) => {
    setUpdateStatusErrorMessage(null);
    try {
      if (updateShipmentStatusMutation?.mutateAsync) {
        await updateShipmentStatusMutation.mutateAsync({
          shipmentId,
          status: targetStatus,
          trackingCode,
        });
      }

      setUpdatingShipment(null);
      setTargetShipmentStatus(null);
      Alert.alert('Status Updated', `Shipment status updated to ${targetStatus}.`);
    } catch (err) {
      const apiError = toApiError(err);
      let message = apiError.message;

      if (
        targetStatus === 'CANCELLED' &&
        (apiError.code === 'PAID_ORDER_CANNOT_CANCEL' ||
          message.toLowerCase().includes('paid order'))
      ) {
        message = 'A shipment of a paid order cannot be cancelled by the seller.';
      } else if (apiError.status === 403) {
        message = 'You do not have permission to update this shipment.';
      } else if (apiError.status === 404) {
        message = 'Shipment not found.';
      } else if (message.toLowerCase().includes('cannot move')) {
        message = `Cannot transition shipment to ${targetStatus}.`;
      } else if (message.toLowerCase().includes('trackingcode')) {
        message = 'Tracking code is required to mark shipment as shipped.';
      }

      setUpdateStatusErrorMessage(message);
    }
  };

  // ==========================================
  // Render Helpers
  // ==========================================
  const renderOrderItem = ({ item }: { item: SellerOrderItem }) => (
    <SellerOrderItemCard
      item={item}
      onConfirm={handleConfirmItem}
      onCancel={handleOpenCancel}
      isConfirming={confirmingId === item.id}
      isCancelling={Boolean(cancelMutation?.isPending && cancellingItem?.id === item.id)}
      actionDisabled={Boolean(confirmingId != null || cancelMutation?.isPending)}
    />
  );

  const renderShipmentItem = ({ item }: { item: SellerShipment }) => (
    <SellerShipmentCard
      shipment={item}
      onUpdateStatus={handleOpenUpdateShipmentStatus}
      disabled={Boolean(updateShipmentStatusMutation?.isPending)}
    />
  );

  const renderOrderItemsEmpty = () => {
    if (isLoadingOrderItems) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('seller.loadingFulfillment', 'Loading order items…')}
          </Text>
        </View>
      );
    }

    if (isOrderItemsError) {
      const apiError = toApiError(orderItemsError);
      return (
        <View style={styles.centerState}>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('seller.errorFulfillmentTitle', "Couldn't load order items")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{apiError.message}</Text>
          <Pressable
            onPress={() => refetchOrderItems && void refetchOrderItems()}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading order items"
          >
            <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>
              {t('seller.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerState}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {t(`seller.empty_items_${selectedStatus}`, ORDER_ITEM_EMPTY_MESSAGES[selectedStatus])}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Items in {selectedStatus.toLowerCase()} status will appear here.
        </Text>
      </View>
    );
  };

  const renderShipmentsEmpty = () => {
    if (isLoadingShipments) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('seller.loadingFulfillment', 'Loading shipments…')}
          </Text>
        </View>
      );
    }

    if (isShipmentsError) {
      const apiError = toApiError(shipmentsError);
      return (
        <View style={styles.centerState}>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('seller.errorFulfillmentTitle', "Couldn't load shipments")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{apiError.message}</Text>
          <Pressable
            onPress={() => refetchShipments && void refetchShipments()}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading shipments"
          >
            <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>
              {t('seller.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerState}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {t(`seller.empty_shipment_${selectedShipmentStatus}`, SHIPMENT_EMPTY_MESSAGES[selectedShipmentStatus])}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Shipments in {selectedShipmentStatus.toLowerCase()} status will appear here.
        </Text>
      </View>
    );
  };

  const renderOrderItemsFooter = () => {
    if (totalItemPages <= 1) {
      return null;
    }

    return (
      <View style={styles.pagination}>
        <Pressable
          onPress={() => page > 0 && setPage((prev) => prev - 1)}
          disabled={page === 0 || isFetchingOrderItems}
          style={[
            styles.pageButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            (page === 0 || isFetchingOrderItems) && styles.pageButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
        >
          <Text
            style={[
              styles.pageButtonText,
              { color: theme.text },
              (page === 0 || isFetchingOrderItems) && styles.pageButtonTextDisabled,
            ]}
          >
            {t('seller.previous', 'Previous')}
          </Text>
        </Pressable>

        <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
          Page {page + 1} / {totalItemPages}
        </Text>

        <Pressable
          onPress={() => page < totalItemPages - 1 && setPage((prev) => prev + 1)}
          disabled={page >= totalItemPages - 1 || isFetchingOrderItems}
          style={[
            styles.pageButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            (page >= totalItemPages - 1 || isFetchingOrderItems) && styles.pageButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Next page"
        >
          <Text
            style={[
              styles.pageButtonText,
              { color: theme.text },
              (page >= totalItemPages - 1 || isFetchingOrderItems) && styles.pageButtonTextDisabled,
            ]}
          >
            {t('seller.next', 'Next')}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderShipmentsFooter = () => {
    if (totalShipmentPages <= 1) {
      return null;
    }

    return (
      <View style={styles.pagination}>
        <Pressable
          onPress={() => shipmentPage > 0 && setShipmentPage((prev) => prev - 1)}
          disabled={shipmentPage === 0 || isFetchingShipments}
          style={[
            styles.pageButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            (shipmentPage === 0 || isFetchingShipments) && styles.pageButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Previous shipment page"
        >
          <Text
            style={[
              styles.pageButtonText,
              { color: theme.text },
              (shipmentPage === 0 || isFetchingShipments) && styles.pageButtonTextDisabled,
            ]}
          >
            {t('seller.previous', 'Previous')}
          </Text>
        </Pressable>

        <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
          Page {shipmentPage + 1} / {totalShipmentPages}
        </Text>

        <Pressable
          onPress={() =>
            shipmentPage < totalShipmentPages - 1 && setShipmentPage((prev) => prev + 1)
          }
          disabled={shipmentPage >= totalShipmentPages - 1 || isFetchingShipments}
          style={[
            styles.pageButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            (shipmentPage >= totalShipmentPages - 1 || isFetchingShipments) && styles.pageButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Next shipment page"
        >
          <Text
            style={[
              styles.pageButtonText,
              { color: theme.text },
              (shipmentPage >= totalShipmentPages - 1 || isFetchingShipments) && styles.pageButtonTextDisabled,
            ]}
          >
            {t('seller.next', 'Next')}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
      testID="seller-fulfillment-screen"
    >
      {/* Screen Title */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('seller.fulfillmentTitle', 'Seller Orders')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t(
            'seller.fulfillmentSubtitle',
            'Manage customer order items and track end-to-end shipment fulfillment.',
          )}
        </Text>
      </View>

      {/* Top Workspace Selector (Order Items vs Shipments) */}
      <View
        style={[
          styles.workspaceSelector,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Pressable
          onPress={() => handleWorkspaceChange('ORDER_ITEMS')}
          style={[
            styles.workspaceTab,
            activeWorkspace === 'ORDER_ITEMS' && [
              styles.workspaceTabActive,
              { backgroundColor: theme.primary },
            ],
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Order Items Workspace"
          accessibilityState={{ selected: activeWorkspace === 'ORDER_ITEMS' }}
          testID="workspace-tab-order-items"
        >
          <Text
            style={[
              styles.workspaceTabText,
              activeWorkspace === 'ORDER_ITEMS'
                ? [styles.workspaceTabTextActive, { color: theme.onPrimary }]
                : { color: theme.textSecondary },
            ]}
          >
            {t('seller.workspaceOrderItems', 'Order Items')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleWorkspaceChange('SHIPMENTS')}
          style={[
            styles.workspaceTab,
            activeWorkspace === 'SHIPMENTS' && [
              styles.workspaceTabActive,
              { backgroundColor: theme.primary },
            ],
          ]}
          accessibilityRole="tab"
          accessibilityLabel="Shipments Workspace"
          accessibilityState={{ selected: activeWorkspace === 'SHIPMENTS' }}
          testID="workspace-tab-shipments"
        >
          <Text
            style={[
              styles.workspaceTabText,
              activeWorkspace === 'SHIPMENTS'
                ? [styles.workspaceTabTextActive, { color: theme.onPrimary }]
                : { color: theme.textSecondary },
            ]}
          >
            {t('seller.workspaceShipments', 'Shipments')}
          </Text>
        </Pressable>
      </View>

      {/* ============================================================== */}
      {/* WORKSPACE 1: ORDER ITEMS (Phases 3 & 4)                        */}
      {/* ============================================================== */}
      {activeWorkspace === 'ORDER_ITEMS' ? (
        <>
          <SellerOrderItemFilters
            currentStatus={selectedStatus}
            onSelectStatus={handleItemStatusChange}
            disabled={Boolean(isFetchingOrderItems && !isLoadingOrderItems)}
          />

          <View style={styles.listHeaderRow}>
            <Text style={[styles.countText, { color: theme.textSecondary }]}>
              {totalItemElements} item{totalItemElements === 1 ? '' : 's'}
            </Text>
          </View>

          {selectedStatus === 'CONFIRMED' ? (
            <FlatList
              data={orderGroups}
              renderItem={({ item: group }) => (
                <ShipmentOrderGroup
                  key={group.orderId}
                  orderId={group.orderId}
                  items={group.items}
                  onCreateShipment={(orderId, groupItems) => {
                    setShippingOrder({ orderId, items: groupItems });
                  }}
                  onCancelItem={handleOpenCancel}
                  disabled={Boolean(confirmingId != null || cancelMutation?.isPending)}
                />
              )}
              keyExtractor={(group) => group.orderId}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={Boolean(isFetchingOrderItems && !isLoadingOrderItems)}
                  onRefresh={() => refetchOrderItems && void refetchOrderItems()}
                  tintColor={theme.primary}
                  colors={[theme.primary]}
                />
              }
              ListEmptyComponent={renderOrderItemsEmpty}
              ListFooterComponent={renderOrderItemsFooter}
            />
          ) : (
            <FlatList
              data={items}
              renderItem={renderOrderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={Boolean(isFetchingOrderItems && !isLoadingOrderItems)}
                  onRefresh={() => refetchOrderItems && void refetchOrderItems()}
                  tintColor={theme.primary}
                  colors={[theme.primary]}
                />
              }
              ListEmptyComponent={renderOrderItemsEmpty}
              ListFooterComponent={renderOrderItemsFooter}
            />
          )}

          <CancelOrderItemModal
            visible={cancellingItem != null}
            item={cancellingItem}
            onClose={handleCloseCancelModal}
            onConfirmCancel={handleConfirmCancel}
            isSubmitting={Boolean(cancelMutation?.isPending)}
            errorMessage={cancelErrorMessage}
          />

          <CreateShipmentModal
            visible={shippingOrder != null}
            orderId={shippingOrder?.orderId ?? null}
            items={shippingOrder?.items ?? []}
            onClose={() => setShippingOrder(null)}
            onSuccess={() => setShippingOrder(null)}
          />
        </>
      ) : (
        /* ============================================================== */
        /* WORKSPACE 2: SHIPMENTS (Phase 5)                              */
        /* ============================================================== */
        <>
          <SellerShipmentFilters
            currentStatus={selectedShipmentStatus}
            onSelectStatus={handleShipmentStatusChange}
            disabled={Boolean(isFetchingShipments && !isLoadingShipments)}
          />

          <View style={styles.listHeaderRow}>
            <Text style={[styles.countText, { color: theme.textSecondary }]}>
              {totalShipmentElements} shipment{totalShipmentElements === 1 ? '' : 's'}
            </Text>
          </View>

          <FlatList
            data={shipments}
            renderItem={renderShipmentItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={Boolean(isFetchingShipments && !isLoadingShipments)}
                onRefresh={() => refetchShipments && void refetchShipments()}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListEmptyComponent={renderShipmentsEmpty}
            ListFooterComponent={renderShipmentsFooter}
          />

          <UpdateShipmentStatusModal
            visible={updatingShipment != null && targetShipmentStatus != null}
            shipment={updatingShipment}
            targetStatus={targetShipmentStatus}
            onClose={handleCloseUpdateShipmentModal}
            onConfirm={handleConfirmUpdateShipmentStatus}
            isSubmitting={Boolean(updateShipmentStatusMutation?.isPending)}
            errorMessage={updateStatusErrorMessage}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: typography.xxxl,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  workspaceSelector: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  workspaceTab: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  workspaceTabActive: {
    backgroundColor: colors.primary,
  },
  workspaceTabText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  workspaceTabTextActive: {
    color: colors.onPrimary,
  },
  listHeaderRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  countText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 240,
  },
  loadingText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: typography.sm,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  pageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  pageButtonTextDisabled: {
    color: colors.textSecondary,
  },
  pageInfo: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
