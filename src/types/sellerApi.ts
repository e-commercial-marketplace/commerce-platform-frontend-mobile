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
 * Trạng thái xử lý của từng dòng hàng (OrderItem.status) - do seller xác nhận.
 * Backend enum: com.marketplace.enums.OrderItemStatus
 */
export type OrderItemStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

/**
 * Tiến độ giao hàng (Shipment.status) - theo com.marketplace.enums.ShipmentStatus
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
 * Hình thức giao hàng của shipment (do seller chọn).
 * Backend enum: com.marketplace.enums.DeliveryMethod
 */
export type DeliveryMethod = 'PLATFORM_DELIVERY' | 'SELF_DELIVERY';

/**
 * Dòng hàng seller quản lý (OrderItemResponse.java).
 * Giá trị unitPrice là chuỗi thập phân VND chụp lúc checkout (@JsonFormat(shape = STRING)).
 * Chú ý: Seller chỉ thấy các trường thuộc dòng hàng của mình, không có thông tin
 * cá nhân khách hàng (tên, SĐT, địa chỉ giao hàng) theo đúng phân quyền backend.
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
 * Đơn vị vận chuyển (CarrierResponse.java).
 * Seller chỉ nhận các đơn vị có active = true.
 */
export type Carrier = {
  id: string;
  name: string;
  active: boolean;
};

/** Alias matching backend response type name */
export type CarrierResponse = Carrier;

/**
 * Đơn vị vận chuyển gọn trong shipment: chỉ id và tên.
 * (ShipmentResponse.ShipmentCarrierResponse)
 */
export type ShipmentCarrierResponse = {
  id: string;
  name: string;
};

/**
 * Một dòng hàng trong shipment.
 * (ShipmentResponse.ShipmentItemResponse)
 */
export type ShipmentItemResponse = {
  orderItemId: string;
  quantity: number;
};

/**
 * Một shipment của seller (ShipmentResponse.java).
 * Tiền shippingFee là chuỗi thập phân VND (@JsonFormat(shape = STRING)).
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
 * Tham số lọc và phân trang cho danh sách dòng hàng của seller (GET /seller/order-items).
 */
export type SellerOrderItemFilterParams = {
  status?: OrderItemStatus;
  orderId?: string;
  page?: number;
  size?: number;
};

/**
 * Tham số lọc và phân trang cho danh sách shipments của seller (GET /seller/shipments).
 */
export type SellerShipmentFilterParams = {
  status?: ShipmentStatus;
  orderId?: string;
  page?: number;
  size?: number;
};

/**
 * Body tuỳ chọn của PATCH /seller/order-items/{id}/cancel (OrderItemCancelRequest.java).
 * cancelReason tối đa 1000 ký tự.
 */
export type OrderItemCancelRequest = {
  cancelReason?: string;
};

/**
 * Body của POST /seller/shipments (ShipmentCreateRequest.java).
 * carrierId bắt buộc khi PLATFORM_DELIVERY, phải trống/null khi SELF_DELIVERY.
 */
export type ShipmentCreateRequest = {
  orderId: string;
  deliveryMethod: DeliveryMethod;
  carrierId?: string | null;
  orderItemIds: string[];
};

/**
 * Body của PATCH /seller/shipments/{id}/status (ShipmentStatusUpdateRequest.java).
 * trackingCode bắt buộc khi chuyển sang SHIPPED, bỏ qua với trạng thái khác.
 */
export type ShipmentStatusUpdateRequest = {
  status: ShipmentStatus;
  trackingCode?: string | null;
};
