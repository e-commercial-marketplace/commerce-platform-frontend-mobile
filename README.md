# Frontend

## 1. Scope

This directory contains the React Native (Expo) client for the E-Commerce Marketplace.

The Expo project uses TypeScript and React Navigation. Shared API infrastructure, secure token storage,
navigation stacks, reusable UI primitives, and placeholder screens are in place; feature behavior is
still to be implemented.

## Tech stack

Installed dependencies are recorded in `package.json` and `package-lock.json`.

### Client baseline

- React Native with Expo for the mobile runtime and project tooling.
- REST for normal backend requests.
- Axios for shared REST requests and common error normalization.
- React Navigation native stack and bottom tabs.
- Expo SecureStore for native access/refresh token storage.
- WebSocket for the planned human-chat realtime flow.

### Planned client libraries

- TanStack Query for server-state caching, loading, refetching, retries, and invalidation.

TanStack Query is not installed yet. SecureStore holds tokens on native platforms; authentication and
refresh flows are not implemented. On web, token storage intentionally remains unavailable rather than
falling back to insecure browser storage.

## 2. Planned Structure

Shared infrastructure is organized by technical responsibility. Feature API modules and business
screens will be added when their contracts and behavior are implemented.

```text
frontend/
├── README.md
├── .env.example
├── App.tsx
├── app.json
├── package.json
├── package-lock.json
├── assets/
└── src/
    ├── api/
    │   ├── client.ts
    │   ├── errors.ts
    │   └── index.ts
    ├── components/
    │   ├── Button.tsx
    │   ├── Loading.tsx
    │   └── ProductCard.tsx
    ├── constants/
    │   ├── api.ts
    │   └── theme.ts
    ├── context/
    │   └── AuthContext.tsx
    ├── hooks/
    ├── navigation/
    │   ├── AppNavigator.tsx
    │   ├── AuthStack.tsx
    │   ├── MainTabs.tsx
    │   └── types.ts
    ├── screens/
    ├── services/
    │   └── tokenStore.ts
    ├── types/
    │   ├── api.ts
    │   └── auth.ts
    ├── utils/
    │   └── format.ts
    └── assets/
```

Feature API modules such as `authApi.ts`, `productApi.ts`, and `orderApi.ts` are intentionally not
stubbed with endpoint behavior before their feature work begins.

## 3. Folder Responsibilities

### `src/components/`

Shared presentation components used by multiple features, such as buttons, inputs, loading states,
error states, and empty states. Do not place catalog/order business logic here.

### `src/screens/`

Contains screen-level UI, one screen per file. Feature behavior should stay in feature API modules or
hooks rather than being embedded in shared components.

### `src/navigation/`

Contains typed React Navigation stacks and tabs. Route params are declared in `types.ts`.

### `src/api/`

The shared Axios boundary:

- Axios instance, API base URL, timeout, and common JSON headers;
- request interceptor attaches the current access token from SecureStore;
- response/error interceptors normalize HTTP, network, and malformed-envelope failures;
- contract types live in `src/types/api.ts`.

Feature API modules should use this boundary instead of creating Axios instances. Automatic token
refresh is deferred until the authentication API flow is implemented.

### `src/context/` and `src/services/`

`AuthContext` exposes the current token state to the app; `tokenStore` persists native tokens through
Expo SecureStore. Cart and other server-owned data should not be copied into a client context.

### `src/hooks/`

Generic hooks shared by multiple screens/features. Feature API hooks can be added when server-state
management is introduced.

### `src/types/`

Types shared across features. Feature-only request/response types should stay inside the owning feature.

### `src/utils/`

Small pure utilities that do not belong to a specific business feature.

### `src/constants/`

Shared configuration values such as API timeout and API base URL validation. Public Expo environment
variables must never contain credentials or private secrets.

### `src/assets/`

Images, fonts, and other local static assets used by the mobile app.

## 4. Shared API Client and TanStack Query Boundary

The intended request flow is:

```text
Screen
  -> screen navigation
      -> feature API module
          -> shared Axios client
              -> Spring Boot API
```

Responsibilities are intentionally separate:

| Concern | Owner |
|---|---|
| HTTP request, headers, Bearer token, error normalization | Shared Axios client |
| Cache, loading, refetch, retry, invalidation | TanStack Query |
| Screen rendering and user interaction | Feature screens/components |
| Business endpoint path and payload mapping | Feature API module |
| Login session and local client state | AuthContext/SecureStore |

Screens should not call Axios directly. TanStack Query should not be used as a replacement for local
form state or navigation state.

### API base URL

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the backend URL including the
version prefix, for example `http://localhost:8080/api/v1`. Android emulators generally need the host
machine's LAN IP instead of `localhost`. Expo public environment variables are bundled into the app;
never put credentials or private secrets in them. Restart Expo after changing the value.

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

When feature APIs and screens are added, they map to the Spring Boot modules as follows:

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

The following work is not part of project initialization:

- install TanStack Query;
- add business screens, API functions, hooks, providers, or stores;
- implement login, token refresh, or authentication API flows;
- implement authentication, catalog, cart, checkout, or other features.

Start the app with `npm run start`; use `npm run android`, `npm run ios`, or `npm run web` for a
specific target. Add feature code alongside the corresponding backend milestone.

---

## Tiếng Việt

Đây là frontend React Native (Expo) cho E-Commerce Marketplace, dùng TypeScript và React Navigation.
Shared API client, contract types, SecureStore trên native, navigation stacks, component cơ bản và
các màn hình placeholder đã có; nghiệp vụ feature chưa được triển khai.

- `api/`: Axios client dùng chung và chuẩn hóa HTTP/network/API errors.
- `components/`: `Button`, `Loading`, `ProductCard` dùng lại.
- `screens/`: mỗi màn hình một file; hiện là placeholder, không chứa feature workflow.
- `navigation/`: `AppNavigator`, `AuthStack`, `MainTabs` và route param types trong `types.ts`.
- `context/AuthContext.tsx`: state token cấp ứng dụng; `services/tokenStore.ts` lưu token an toàn trên native.
- `types/`: `ApiResponse<T>`, error envelope, pagination, tiền VND dạng decimal string và timestamp UTC.
- `constants/`: API configuration và theme tokens dùng chung.
- `utils/`, `hooks/`, `assets/`: helper và tài nguyên dùng chung.

Luồng dự kiến:

```text
Screen -> navigation -> feature API module -> shared Axios client -> Spring Boot API
```

Tạo `.env` từ `.env.example`, cấu hình `EXPO_PUBLIC_API_BASE_URL` có hậu tố `/api/v1`, rồi khởi động
lại Expo. Biến `EXPO_PUBLIC_*` được đóng gói trong app nên không dùng để lưu secret. API client tự
đọc access token qua SecureStore trên native; chưa có luồng login/refresh. Trên web, token storage
không dùng localStorage. TanStack Query chưa được cài; cart và dữ liệu server sẽ không đặt trong context.
