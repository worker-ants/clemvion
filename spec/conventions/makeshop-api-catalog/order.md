---
id: makeshop-order
status: spec-only
code: []
pending_plans:
  - plan/in-progress/makeshop-integration.md
---

# Makeshop API Catalog — 주문 (Order)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/order.openapi.json`](./openapi/order.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출했으며, Phase 0 에서 backend 메타데이터(`MAKESHOP_OPERATIONS_BY_RESOURCE`)와 `catalog-sync` 양방향 테스트로 동기 보호된다. `scope`/`paginated`/`status` 컬럼은 메타데이터와 1:1 일치한다.

## REST endpoints (34)

| id | 라벨 (한) | method | path | scope | paginated | status | docs |
|----|-----------|--------|------|-------|-----------|--------|------|
| `get-cash_bill` | 현금영수증 조회 | GET | `cash_bill` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-cash-bill) |
| `get-order-1` | 주문 1.0 조회 | GET | `order/1` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-1) |
| `get-order-2` | 주문 2.0 조회 | GET | `order/2` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-2) |
| `get-order_delivery` | 주문 2.0 배송지 조회 | GET | `order_delivery` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-delivery) |
| `get-order_log` | 주문 2.0  히스토리 조회 | GET | `order_log` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-log) |
| `get-order_memo` | 관리자 메모 조회 | GET | `order_memo` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-memo) |
| `get-order_return_delivery` | 회수 송장 번호 조회 (주문번호) | GET | `order_return_delivery` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-return-delivery) |
| `get-order_return_invoice` | 회수 송장 번호 조회 | GET | `order_return_invoice` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-return-invoice) |
| `get-order_search` | 주문 2.0 검색 지원 | GET | `order_search` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-search) |
| `get-order_trade_log` | 교환 상품 품목 조회 | GET | `order_trade_log` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-order-trade-log) |
| `get-present_order` | 선물 내역 조회 | GET | `present_order` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-present-order) |
| `get-subs` | 정기 배송 조회 | GET | `subs` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/get-subs) |
| `post-order-basket_separated` | 주문서 품목 분리 | POST | `order/basket_separated` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-basket-separated) |
| `post-order-cancel_done` | 주문 취소 (입금전) | POST | `order/cancel_done` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-cancel-done) |
| `post-order-cancel_request` | 주문 취소 요청 (입금후) | POST | `order/cancel_request` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-cancel-request) |
| `post-order-delivery` | 배송 처리 | POST | `order/delivery` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-delivery) |
| `post-order-delivery_complete` | 배송완료 | POST | `order/delivery_complete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-delivery-complete) |
| `post-order-done` | 거래 완료 | POST | `order/done` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-done) |
| `post-order-hold` | 배송보류 처리 | POST | `order/hold` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-hold) |
| `post-order-hold_cancel` | 배송보류 해지 처리 | POST | `order/hold_cancel` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-hold-cancel) |
| `post-order-invoice` | 송장 등록 | POST | `order/invoice` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-invoice) |
| `post-order-invoice_change` | 송장 변경 | POST | `order/invoice_change` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-invoice-change) |
| `post-order-paid` | 입금 확인 처리 | POST | `order/paid` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-paid) |
| `post-order-ready` | 배송 준비 처리 | POST | `order/ready` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-ready) |
| `post-order-return_receipt` | 반품 접수 | POST | `order/return_receipt` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-return-receipt) |
| `post-order-return_receipt_refusal` | 반품 접수 거부 | POST | `order/return_receipt_refusal` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-return-receipt-refusal) |
| `post-order-return_request` | 반품 요청 | POST | `order/return_request` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-return-request) |
| `post-order-trade_receipt` | 교환 접수 | POST | `order/trade_receipt` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-trade-receipt) |
| `post-order-trade_receipt_refusal` | 교환 접수 거부 | POST | `order/trade_receipt_refusal` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-trade-receipt-refusal) |
| `post-order-trade_request` | 교환 요청 | POST | `order/trade_request` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-trade-request) |
| `post-order_delivery-update` | 배송 수령인 정보 수정 | POST | `order_delivery/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-delivery-update) |
| `post-order_memo-create` | 관리자 메모 등록 | POST | `order_memo/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-memo-create) |
| `post-order_memo-delete` | 관리자 메모 삭제 | POST | `order_memo/delete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-memo-delete) |
| `post-order_memo-update` | 관리자 메모 수정 | POST | `order_memo/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/order/post-order-memo-update) |
