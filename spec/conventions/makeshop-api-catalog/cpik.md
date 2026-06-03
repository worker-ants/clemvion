---
id: makeshop-cpik
status: spec-only
code: []
pending_plans:
  - plan/in-progress/makeshop-integration.md
---

# Makeshop API Catalog — CPIK (외부연동: 장바구니·회원·주문·webhook)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/cpik.openapi.json`](./openapi/cpik.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출한 **구현 전 레퍼런스**다 (우리 백엔드 메타데이터 미존재 → status/sync test 없음).

## REST endpoints (8)

| id | 라벨 (한) | method | path | 권한 (x-scope) | docs |
|----|-----------|--------|------|----------------|------|
| `post-cart-create` | 장바구니 담기 | POST | `cart/create` | 주문 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cart-create) |
| `post-cart-delete` | 장바구니 삭제 | POST | `cart/delete` | 주문 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cart-delete) |
| `post-cart-update` | 장바구니 수정 | POST | `cart/update` | 주문 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cart-update) |
| `post-cpik_member-check` | 연동 여부 확인 | POST | `cpik_member/check` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cpik-member-check) |
| `post-cpik_member-delete` | 회원 연동 해제 (메이크샵) | POST | `cpik_member/delete` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cpik-member-delete) |
| `post-cpik_member-join` | 회원가입 | POST | `cpik_member/join` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cpik-member-join) |
| `post-cpik_member-login` | 회원 로그인 (SSO 토큰) | POST | `cpik_member/login` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cpik-member-login) |
| `post-cpik_online_order-create` | 주문 등록 | POST | `cpik_online_order/create` | 주문 | [↗](https://developer.makeshop.co.kr/docs/api/cpik/post-cpik-online-order-create) |

## Webhook events (11)

> `method: event` — REST 호출이 아니라 **이벤트 수신(trigger) 정의**. payload 스키마는 openapi json 의 `x-webhooks` 참고.

| id | 라벨 (한) | event_code | docs |
|----|-----------|-----------|------|
| `webhook-cpik_category_change` | 카테고리 등록/수정/삭제 | `CATEGORY_CHANGE` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-category-change) |
| `webhook-cpik_delivery_change` | 배송 상태 변경 - 배송중 | `DELIVERY` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-delivery-change) |
| `webhook-cpik_delivery_complete_change` | 배송 상태 변경 - 배송완료 | `DELIVERY_COMPLETE` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-delivery-complete-change) |
| `webhook-cpik_delivery_ready_change` | 배송 상태 변경 - 배송준비 | `DELIVERY_READY` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-delivery-ready-change) |
| `webhook-cpik_order_cancel_status` | 주문 상태 변경 - 결제취소 | `ORDER_CANCEL` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-order-cancel-status) |
| `webhook-cpik_order_paid_status` | 주문 상태 변경 - 결제완료 | `ORDER_PAID` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-order-paid-status) |
| `webhook-cpik_order_partial_refund_status` | 주문 상태 변경 - 부분환불 | `ORDER_REFUND` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-order-partial-refund-status) |
| `webhook-cpik_order_refund_status` | 주문 상태 변경 - 환불 | `ORDER_REFUND` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-order-refund-status) |
| `webhook-cpik_product` | 상품 등록/수정 | `PRODUCT_ADD` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-product) |
| `webhook-cpik_product_change_status` | 상품 상태 변경 | `PRODUCT_STATUS` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-product-change-status) |
| `webhook-cpik_product_delete` | 상품 삭제 | `PRODUCT_DELETE` | [↗](https://developer.makeshop.co.kr/docs/api/cpik/webhook-cpik-product-delete) |
