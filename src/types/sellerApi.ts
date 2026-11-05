/**
 * Backend DTO for the public seller shop page.
 *
 * Verified against the backend source (SellerShopResponse, a Java record):
 * the shop exposes exactly three values - the seller id, the shop name and
 * the number of products currently on sale. The backend deliberately hides
 * the seller's email and any other personal data.
 *
 * There is NO rating, description, avatar/logo, address, join date, follower
 * count or shop status in this payload, so the UI must not display those
 * values instead of real backend data.
 */

export type SellerShopDto = {
  /** Seller UUID; it doubles as the shop identifier. */
  id: string;
  /** Shop name - the seller's full name. */
  name: string;
  /** Number of active (listed) products owned by this seller. */
  productCount: number;
};

// ============================================================================
// Seller Order Fulfillment Types (Phase 1)
// Direct mapping to backend DTOs, records, and enums.
// ============================================================================

/**
 * Processing status of each order item (OrderItem.status) - confirmed by the seller.
 * Backend enum: com.marketplace.enums.OrderItemStatus
 */
export type OrderItemStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

/**
 * Delivery progress (Shipment.status) - per com.marketplace.enums.ShipmentStatus
 */
export type ShipmentStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'
  | 'CANCELLED';

/**
 * Delivery method of the shipment (chosen by the seller).
 * Backend enum: com.marketplace.enums.DeliveryMethod
 */
export type DeliveryMethod = 'PLATFORM_DELIVERY' | 'SELF_DELIVERY';

/**
 * Order item managed by the seller (OrderItemResponse.java).
 * unitPrice is a VND decimal string captured at checkout (@JsonFormat(shape = STRING)).
 * Note: a seller only sees the fields of their own order items, with no
 * personal data of the customer (name, phone, shipping address), as per backend permissions.
 */
export type SellerOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  status: OrderItemStatus;
  sellerId: string;
};

/** Alias matching backend response type name */
export type OrderItemResponse = SellerOrderItem;

/**
 * Carrier (CarrierResponse.java).
 * Sellers only receive carriers with active = true.
 */
export type Carrier = {
  id: string;
  name: string;
  active: boolean;
};

/** Alias matching backend response type name */
export type CarrierResponse = Carrier;

/**
 * Compact carrier inside a shipment: id and name only.
 * (ShipmentResponse.ShipmentCarrierResponse)
 */
export type ShipmentCarrierResponse = {
  id: string;
  name: string;
};

/**
 * An item line in the shipment.
 * (ShipmentResponse.ShipmentItemResponse)
 */
export type ShipmentItemResponse = {
  orderItemId: string;
  quantity: number;
};

/**
 * A seller shipment (ShipmentResponse.java).
 * shippingFee is a VND decimal string (@JsonFormat(shape = STRING)).
 */
export type SellerShipment = {
  id: string;
  orderId: string;
  sellerId: string;
  deliveryMethod: DeliveryMethod;
  carrier: ShipmentCarrierResponse | null;
  status: ShipmentStatus;
  trackingCode: string | null;
  shippingFee: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: ShipmentItemResponse[];
};

/** Alias matching backend response type name */
export type ShipmentResponse = SellerShipment;

/**
 * Paginated response wrapper (com.marketplace.common.response.PageResponse).
 */
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/**
 * Filter and pagination parameters for the seller order item list (GET /seller/order-items).
 */
export type SellerOrderItemFilterParams = {
  status?: OrderItemStatus;
  orderId?: string;
  page?: number;
  size?: number;
};

/**
 * Filter and pagination parameters for the seller shipment list (GET /seller/shipments).
 */
export type SellerShipmentFilterParams = {
  status?: ShipmentStatus;
  orderId?: string;
  page?: number;
  size?: number;
};

/**
 * Optional body of PATCH /seller/order-items/{id}/cancel (OrderItemCancelRequest.java).
 * cancelReason is at most 1000 characters.
 */
export type OrderItemCancelRequest = {
  cancelReason?: string;
};

/**
 * Body of POST /seller/shipments (ShipmentCreateRequest.java).
 * carrierId is required for PLATFORM_DELIVERY and must be empty/null for SELF_DELIVERY.
 */
export type ShipmentCreateRequest = {
  orderId: string;
  deliveryMethod: DeliveryMethod;
  carrierId?: string | null;
  orderItemIds: string[];
};

/**
 * Body of PATCH /seller/shipments/{id}/status (ShipmentStatusUpdateRequest.java).
 * trackingCode is required when moving to SHIPPED and ignored for other statuses.
 */
export type ShipmentStatusUpdateRequest = {
  status: ShipmentStatus;
  trackingCode?: string | null;
};
