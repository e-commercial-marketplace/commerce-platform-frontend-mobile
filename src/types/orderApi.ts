/**
 * Backend DTO types for the order/checkout API.
 *
 * These mirror the backend records exactly (CheckoutRequest / OrderResponse /
 * OrderItemResponse) and must not drift from the wire format.
 *
 * Contract verified against the backend source:
 * - POST /api/v1/orders -> 201 ApiResponse<OrderResponse>
 *
 * Money values are decimal STRINGS (`@JsonFormat(shape = STRING)`), never JSON
 * numbers. The response intentionally has no subtotal, order code, line total,
 * product image, seller name, shipment, payment id or expiry field.
 */

/** Backend order-level status values. */
export type OrderStatus = 'PENDING' | 'PAID' | 'DELIVERED' | 'CANCELLED';

/** Backend per-item status values. */
export type OrderItemStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

/** Backend payment methods. This feature only exposes COD in the UI. */
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

/** Order created by checkout. */
export type OrderResponse = {
  /** Order UUID. */
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  /** VNPAY signed URL; null for COD. */
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
  items: OrderItemResponse[];
};
