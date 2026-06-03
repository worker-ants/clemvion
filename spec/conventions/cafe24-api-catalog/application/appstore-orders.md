---
resource: application
entity: appstore-orders
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#appstore-orders
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Application / Appstore orders

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Appstore orders](https://developers.cafe24.com/docs/ko/api/admin/#appstore-orders)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

앱스토어 주문(Appstore orders)은 앱에서 사용 금액이나 기타 금액을 쇼핑몰 운영자에게 부과하기 위한 주문입니다. · 앱스토어 주문 생성을 통해 쇼핑몰 운영자에게 결제 필요한 금액을 부과할 수 있으며, 생성된 주문을 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `order_id` |  | 주문아이디 앱스토어 주문의 주문 ID |
| `order_name` |  | 주문명 앱스토어 주문의 주문 이름. 주문 생성시 지정이 가능하며, 사용자가 결제시 해당 결제의 내용이 무엇인지 알 수 있는 내용이어야 함. |
| `order_amount` |  | 주문금액 앱스토어 주문 생성시 결제 요청한 주문 금액 |
| `currency` |  | 화폐단위 KRW : ￦ 원 · USD : $ 달러 · JPY : ¥ 엔 · PHP : ₱ 페소 |
| `return_url` |  | Return Url 사용자가 결제 후 이동해야하는 페이지. |
| `automatic_payment` | 최대글자수 : [1자] | 정기과금 여부 T : 사용함 · F : 사용안함 |
| `created_date` |  | 주문 생성일 |
| `confirmation_url` |  | 결제 Url 사용자가 결제하기 위해 자동으로 이동하는 페이지 주소 |

## Operations

### `GET /api/v2/admin/appstore/orders/{order_id}` — Retreive a Cafe24 Store order

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `order_id` |  |  |  | 주문번호 조회하고자하는 앱스토어 주문 번호 |

### `POST /api/v2/admin/appstore/orders` — Create a Cafe24 Store order

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 10
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `order_name` | ✓ | 최대글자수 : [100자] |  | 주문명 앱스토어 주문의 주문 이름. 주문 생성시 지정이 가능하며, 사용자가 결제시 해당 결제의 내용이 무엇인지 알 수 있는 내용이어야 함. |
| `order_amount` | ✓ |  |  | 주문금액 사용자에게 결제 받고자 하는 주문 금액 입력 |
| `return_url` | ✓ | 최대글자수 : [250자] |  | Return Url 사용자가 결제 후 이동해야하는 페이지. 결제 완료 페이지 주소를 입력한다. |
| `automatic_payment` |  | 최대글자수 : [1자] | F | 정기과금 여부 T : 사용함 · F : 사용안함 |
