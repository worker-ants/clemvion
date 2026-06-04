---
resource: order
entity: exchangerequests
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#exchangerequests
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Exchangerequests

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Exchangerequests](https://developers.cafe24.com/docs/ko/api/admin/#exchangerequests)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

교환요청(Exchangerequests)은 주문에 대해 교환을 요청할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `items` |  | 품주 목록 |
| `exchange_request_no` |  | 교환신청번호 |
| `undone` |  | 접수거부 여부 |
| `order_item_code` |  | 품주코드 |
| `additional_payment_gateway_cancel` |  | 추가 PG 취소 |

## Operations

### `POST /api/v2/admin/exchangerequests` — Bulk exchange request API

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#bulk-exchange-request-api

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `reason_type` | ✓ |  |  | 사유 구분 A:고객변심 · E:상품불만족 · K:상품불량 · J:배송오류 · I:기타 |
| `reason` | ✓ | 최대글자수 : [2000자] |  | 교환신청 사유 |
| `request_pickup` |  |  |  | 수거신청 여부 T : 수거신청 · F : 직접발송 |
| `pickup` |  |  |  | 수거지역 상세 |
| ↳ `name` | ✓ |  |  | 이름 |
| ↳ `phone` |  |  |  | 전화번호 |
| ↳ `cellphone` | ✓ |  |  | 휴대전화 |
| ↳ `zipcode` |  |  |  | 우편번호 |
| ↳ `address1` | ✓ |  |  | 기본 주소 |
| ↳ `address2` | ✓ |  |  | 상세 주소 |
| `tracking_no` |  | 최대글자수 : [40자] |  | 반품 송장 번호 |
| `shipping_company_name` |  | 최대글자수 : [30자] |  | 반품 배송업체명 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `items` |  |  |  | 품주 목록 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |
| `exchange_items` |  |  |  | 교환상품정보 |
| ↳ `product_no` | ✓ |  |  | 상품번호 |
| ↳ `variant_code` | ✓ |  |  | 상품 품목 코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "exchangerequests": [
        {
            "shop_no": 1,
            "order_id": "20190228-0000011",
            "exchange_request_no": 8,
            "items": [
                {
                    "order_item_code": "20190228-0000011-01",
                    "quantity": 1
                },
                {
                    "order_item_code": "20190228-0000011-02",
                    "quantity": 3
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "20190228-0000022",
            "exchange_request_no": 9,
            "items": [
                {
                    "order_item_code": "20190228-0000022-01",
                    "quantity": 2
                },
                {
                    "order_item_code": "20190228-0000022-02",
                    "quantity": 2
                }
            ]
        }
    ]
}
```

### `PUT /api/v2/admin/exchangerequests` — Reject an exchange request for multiple items

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request-for-multiple-items

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `undone` | ✓ |  |  | 접수거부 여부 T : 접수거부함 |
| `reason_type` |  |  |  | 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `reason` |  | 최대글자수 : [2000자] |  | 사유 |
| `display_reject_reason` |  |  | F | 주문상세내역 노출설정 T : 노출함 · F : 노출안함 |
| `reject_reason` |  | 최대글자수 : [2000자] |  | 거부 사유 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "exchangerequests": [
        {
            "shop_no": 1,
            "order_id": "20190228-0000011",
            "undone": "T",
            "order_item_code": [
                "20190228-0000011-01",
                "20190228-0000011-02"
            ],
            "additional_payment_gateway_cancel": {
                "success": [
                    "20190228-0000011-01",
                    "20190228-0000011-02"
                ],
                "fail": null
            }
        },
        {
            "shop_no": 1,
            "order_id": "20190228-0000022",
            "undone": "T",
            "order_item_code": [
                "20190228-0000022-01",
                "20190228-0000022-02"
            ],
            "additional_payment_gateway_cancel": {
                "success": [
                    "20190228-0000022-01",
                    "20190228-0000022-02"
                ],
                "fail": null
            }
        }
    ]
}
```
