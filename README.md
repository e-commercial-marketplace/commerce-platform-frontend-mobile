# Frontend Scaffold

## 1. Scope

This directory is the initial structure for the React Native (Expo) client of the E-Commerce
Marketplace.

Only folders and this README are created at this stage. There is no application code, `package.json`,
API client, navigation setup, TanStack Query provider, or installed dependency yet.

## Tech stack

The frontend stack is divided into the scaffold baseline and libraries planned for the first Expo
implementation. Versions will be pinned when the application and `package.json` are initialized.

### Client baseline

- React Native with Expo for the mobile runtime and project tooling.
- REST for normal backend requests.
- WebSocket for the planned human-chat realtime flow.

### Planned client libraries

- Axios for the shared HTTP client, interceptors, timeout, and error normalization.
- TanStack Query for server-state caching, loading, refetching, retries, and invalidation.
- Expo SecureStore for access/refresh token storage when authentication is implemented.
- A navigation library, either React Navigation or Expo Router, to be selected during Expo initialization.

This is a planned technology stack, not an installed dependency list. Do not report the frontend as
buildable until `package.json`, a lockfile, the Expo entry point, and the selected navigation library
have been added.

## 2. Planned Structure

The tree below is the target structure after implementation. Only the directories and `.gitkeep`
files exist in the current scaffold; the listed source files are not created yet.

```text
frontend/
├── README.md
└── src/
    ├── features/
    │   └── <feature>/
    │       ├── api/
    │       ├── components/
    │       ├── queries/
    │       ├── screens/
    │       └── types.ts
    ├── components/
    ├── navigation/
    ├── providers/
    ├── lib/
    │   └── api/
    │       ├── client.ts
    │       ├── config.ts
    │       └── errors.ts
    ├── store/
    ├── hooks/
    ├── types/
    ├── utils/
    └── assets/
```

`.gitkeep` files exist only to preserve the empty scaffold folders. They are not application code.

## 3. Folder Responsibilities

### `src/features/`

Contains business features that correspond to the backend plan:

```text
auth, catalog, cart, checkout, orders,
shipment, review, chat, ai
```

Each feature owns its screens and feature-specific UI. When implementation starts, its API functions,
TanStack Query hooks, types, and feature components should stay close to that feature.

Example planned shape:

```text
features/catalog/
├── api/
│   └── catalog.api.ts
├── components/
├── queries/
│   ├── use-product-query.ts
│   └── use-products-query.ts
├── screens/
└── types.ts
```

The files above are intentionally not created yet.

### `src/components/`

Shared presentation components used by multiple features, such as buttons, inputs, loading states,
error states, and empty states. Do not place catalog/order business logic here.

### `src/navigation/`

The future navigation boundary for auth flow, customer flow, seller flow, and admin flow. The project
can choose React Navigation or Expo Router when the Expo application is initialized.

### `src/providers/`

The future application providers, including `QueryClientProvider` and any authentication/provider
composition. Providers should be mounted once near the application root.

### `src/lib/api/`

The shared HTTP boundary:

- Axios instance and backend `baseURL`;
- request timeout and common headers;
- access-token attachment;
- refresh-token handling for `401` responses;
- common API response/error normalization.

Feature API functions should use this boundary instead of creating their own Axios instances.

### `src/store/`

Client-only state, such as the current session, selected UI state, or local preferences. Product lists,
orders, shipment data, and other server data should remain in TanStack Query rather than being copied
into a global store.

### `src/hooks/`

Generic hooks shared by multiple features. Feature-specific TanStack Query hooks belong in the
corresponding `features/<feature>/queries/` directory.

### `src/types/`

Types shared across features. Feature-only request/response types should stay inside the owning feature.

### `src/utils/`

Small pure utilities that do not belong to a specific business feature.

### `src/assets/`

Images, fonts, and other local static assets used by the mobile app.

## 4. Axios and TanStack Query Boundary

The intended request flow is:

```text
Screen
  -> feature hook
      -> feature api function
          -> shared Axios instance
              -> Spring Boot API
```

Responsibilities are intentionally separate:

| Concern | Owner |
|---|---|
| HTTP request, headers, timeout, token interceptor | Axios layer |
| Cache, loading, refetch, retry, invalidation | TanStack Query |
| Screen rendering and user interaction | Feature screens/components |
| Business endpoint path and payload mapping | Feature API module |
| Login session and local client state | Store/SecureStore |

Screens should not call Axios directly. TanStack Query should not be used as a replacement for local
form state or navigation state.

## 5. Planned Query Conventions

Use stable query keys when implementation begins:

```text
["products", filters]
["product", productId]
["cart"]
["my-orders", page]
["shipment", orderId]
```

After a mutation, invalidate the related server query:

```text
createOrder -> ["my-orders"]
updateCart  -> ["cart"]
updateStock -> ["products"]
```

The exact keys may be refined when backend DTOs and endpoints are implemented.

## 6. Backend Alignment

The feature folders mirror the planned Spring Boot modules:

```text
Frontend             Backend
auth          ->     auth
catalog       ->     catalog
cart          ->     cart
checkout      ->     order/payment
orders        ->     order
shipment      ->     shipment
review        ->     review
chat          ->     chat
ai            ->     ai
```

The frontend is responsible for presentation and client state only. Authorization and ownership must
remain enforced by the Spring Boot backend even when the mobile UI hides an action.

## 7. Deferred Work

The following work is deliberately not performed in this initialization step:

- create the Expo application;
- install Axios, TanStack Query, navigation, or SecureStore;
- create `package.json` or lock files;
- create screens, components, API functions, hooks, providers, or stores;
- configure backend URLs or environment variables;
- implement authentication, catalog, cart, checkout, or other features.

When implementation starts, initialize the Expo project first, then add dependencies and create the
smallest feature slice required by the current backend milestone.

---

## Tiếng Việt

Đây là scaffold ban đầu cho frontend React Native (Expo). Hiện tại chỉ có thư mục và README; chưa có
source code, `package.json`, dependency, Axios client, TanStack Query provider hay màn hình nào.

- `features/`: chia theo nghiệp vụ giống backend.
- `features/<feature>/api/`: các hàm gọi endpoint riêng của feature, dùng shared Axios client.
- `features/<feature>/queries/`: TanStack Query hooks cho query và mutation của feature.
- `components/`: UI dùng chung, không chứa business logic.
- `navigation/`: cấu hình navigation sau này.
- `providers/`: nơi đặt `QueryClientProvider` và provider cấp ứng dụng.
- `lib/api/`: Axios instance, interceptor, token và chuẩn hóa response/error.
- `store/`: state phía client; không dùng để sao chép server state đã do TanStack Query quản lý.
- `hooks/`, `types/`, `utils/`, `assets/`: các phần dùng chung.

Luồng dự kiến:

```text
Screen -> feature hook -> feature api -> Axios -> Spring Boot API
```

TanStack Query quản lý cache/loading/refetch/invalidation của server state. Axios chỉ đảm nhiệm HTTP.
Màn hình không gọi Axios trực tiếp.
