/**
 * Backend DTO types for the order/checkout API.
 *
 * These mirror the backend records exactly (CheckoutRequest / OrderResponse /
 * OrderItemResponse) and must not drift from the wire format.
 *
 * Contract verified against the backend source:
 * - POST /api/v1/orders -> 201 ApiResponse<OrderResponse>
 * - GET /api/v1/orders -> 200 ApiResponse<PageResponse<OrderSummaryResponse>>
 * - GET /api/v1/orders/{id} -> 200 ApiResponse<OrderResponse>
 * - PATCH /api/v1/orders/{id}/received -> 200 ApiResponse<OrderResponse>
 *
 * Money values are decimal STRINGS (`@JsonFormat(shape = STRING)`), never JSON
 * numbers.
 */

/** Backend order-level status values. */
export type OrderStatus = 'PENDING' | 'PAID' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

/** Backend per-item status values. */
export type OrderItemStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

/** Backend payment methods. */
export type PaymentMethod = 'COD' | 'VNPAY';

/** Backend payment attempt status values. */
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

/** Body of POST /api/v1/orders. Only the selected cart lines are purchased. */
export type CheckoutRequest = {
  /** Cart-item UUIDs from the customer's own cart; non-empty, unique. */
  cartItemIds: string[];
  /** Single free-text delivery address snapshot; trimmed by the backend. */
  shippingAddress: string;
  /** Payment method for this feature is always COD. */
  paymentMethod: PaymentMethod;
  /** Optional voucher code; case-insensitive, maximum 64 characters. */
  voucherCode?: string | null;
};

/** One order line returned by checkout. */
export type OrderItemResponse = {
  /** Order-item UUID. */
  id: string;
  /** Order that owns this line. */
  orderId: string;
  /** Product UUID; product name and unit price are checkout snapshots. */
  productId: string;
  productName: string;
  /** Unit price as a decimal string, e.g. "29990000.00". */
  unitPrice: string;
  quantity: number;
  status: OrderItemStatus;
  /** Seller responsible for this line. */
  sellerId: string;
};

/** Backend shipment status values. */
export type ShipmentStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'
  | 'CANCELLED';

/** Backend delivery method enum values (com.marketplace.enums.DeliveryMethod). */
export type DeliveryMethod = 'PLATFORM_DELIVERY' | 'SELF_DELIVERY';

/** Carrier info nested in shipment response. */
export type ShipmentCarrierResponse = {
  id: string;
  name: string;
};

/** One order item in a shipment. */
export type ShipmentItemResponse = {
  orderItemId: string;
  quantity: number;
};

/** Shipment details returned in order detail. */
export type ShipmentResponse = {
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

/** Order summary for My Orders list. */
export type OrderSummaryResponse = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  totalAmount: string;
};

/** Paginated response wrapper. */
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

/** Order created by checkout / returned by order detail. */
export type OrderResponse = {
  /** Order UUID. */
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  /** VNPAY signed URL; null for COD and when reading existing order. */
  paymentUrl: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Address snapshot stored on the order. */
  shippingAddress: string;
  /** Shipping fee as a decimal string. */
  shippingFee: string;
  /** Discount as a decimal string (0 until vouchers exist). */
  discountAmount: string;
  /** Authoritative order total as a decimal string. */
  totalAmount: string;
  /** Voucher code; null until vouchers exist. */
  voucherCode: string | null;
  shipments: ShipmentResponse[];
  items: OrderItemResponse[];
};
