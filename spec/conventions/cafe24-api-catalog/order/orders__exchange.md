---
resource: order
entity: orders__exchange
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--exchange
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders exchange

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders exchange](https://developers.cafe24.com/docs/ko/api/admin/#orders--exchange)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 교환(Orders exchange)은 주문의 교환 접수 상태와 관련된 기능입니다. · 특정 주문에 대해 교환 접수를 할 수 있으며 교환이 접수된 주문의 상태를 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `status` |  | 주문상태 accept : 접수 · collected : 수거완료 · exchanged : 교환완료 |
| `claim_code` |  | 교환번호 |
| `items` |  | 품주코드 |
| `exchanged_items` |  | 교환상품 |
| `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| `return_shipping_company_name` | 최대글자수 : [30자] | 반품 배송업체명 |
| `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| `exchanged_after_collected` |  | 수거완료시 교환완료 여부 T : 사용함 · F : 사용안함 |
| `request_pickup` |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| `pickup` |  | 수거지역 상세 |
| `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 철회 사유 |
| `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |
| `carrier_id` |  | 배송사 아이디 |
| `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` | 최대글자수 : [100자] | 반송장 처리 실패 사유 |

## Operations

### `POST /api/v2/admin/orders/{order_id}/exchange` — Create an order exchange

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-exchange

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `status` | ✓ |  |  | 주문상태 accepted : 교환접수 · exchanged : 교환완료 |
| `recover_inventory` |  |  | F | 재고복구 T : 복구함 · F : 복구안함 |
| `add_memo_too` |  |  | F | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |
| ↳ `exchange_variant_code` |  |  |  | (동일상품 다른 옵션 교환시) 교환 상품 품목 코드 |
| `same_product` | ✓ |  |  | 동일상품교환 여부 T : 동일상품교환 · F : 다른상품교환 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `exchange` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `status` |  | 주문상태 accept : 접수 · collected : 수거완료 · exchanged : 교환완료 |
| ↳ `claim_code` |  | 교환번호 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `quantity` |  | 수량 |
| ↳ ↳ `exchange_variant_code` |  | (동일상품 다른 옵션 교환시) 교환 상품 품목 코드 |
| ↳ `exchanged_items` |  | 교환상품 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `origin_order_item_code` |  |  |

응답 예시 (JSON):

```json
{
    "exchange": {
        "shop_no": 1,
        "order_id": "20190805-0000011",
        "status": "accepted",
        "claim_code": "B20190805-0000007",
        "items": [
            {
                "order_item_code": "20190805-0000011-01",
                "quantity": 4,
                "exchange_variant_code": null
            },
            {
                "order_item_code": "20190805-0000011-02",
                "quantity": 4,
                "exchange_variant_code": "P000000R000C"
            }
        ],
        "exchanged_items": [
            {
                "order_item_code": "20190805-0000011-03",
                "origin_order_item_code": "20190805-0000011-01"
            },
            {
                "order_item_code": "20190805-0000011-04",
                "origin_order_item_code": "20190805-0000011-02"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/orders/{order_id}/exchange/{claim_code}` — Update an order exchange

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-exchange

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `claim_code` | ✓ |  |  | 교환번호 |
| `status` |  |  |  | 주문상태 exchanged : 교환완료 |
| `pickup_completed` |  |  |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `return_invoice_no` |  | 최대글자수 : [40자] |  | 반품 송장 번호 |
| `return_shipping_company_name` |  | 최대글자수 : [30자] |  | 반품 배송업체명 |
| `recover_inventory` |  |  |  | 재고복구 T : 복구함 · F : 복구안함 |
| `exchanged_after_collected` |  |  |  | 수거완료시 교환완료 여부 T : 사용함 · F : 사용안함 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` |  |  |  | 품주코드 |
| `request_pickup` |  |  |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| `pickup` |  |  |  | 수거지역 상세 |
| ↳ `name` |  |  |  | 이름 |
| ↳ `phone` |  |  |  | 전화번호 |
| ↳ `cellphone` |  |  |  | 휴대전화 |
| ↳ `zipcode` |  |  |  | 우편번호 |
| ↳ `address1` |  |  |  | 기본 주소 |
| ↳ `address2` |  |  |  | 상세 주소 |
| `undone` |  |  |  | 철회 여부 T : 철회함 |
| `add_memo_too` |  |  |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` |  |  |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 최대글자수 : [2000자] |  | 철회 사유 |
| `expose_order_detail` |  |  |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 최대글자수 : [2000자] |  | 주문상세내역 노출 철회 사유 |
| `carrier_id` |  |  |  | 배송사 아이디 |
| `return_invoice_success` |  |  |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` |  | 최대글자수 : [100자] |  | 반송장 처리 실패 사유 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `exchange` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `claim_code` |  | 교환번호 |
| ↳ `status` |  | 주문상태 accept : 접수 · collected : 수거완료 · exchanged : 교환완료 |
| ↳ `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| ↳ `return_shipping_company_name` | 최대글자수 : [30자] | 반품 배송업체명 |
| ↳ `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| ↳ `return_invoice_fail_reason` | 최대글자수 : [100자] | 반송장 처리 실패 사유 |
| ↳ `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| ↳ `exchanged_after_collected` |  | 수거완료시 교환완료 여부 T : 사용함 · F : 사용안함 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ `request_pickup` |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| ↳ `pickup` |  | 수거지역 상세 |
| ↳ ↳ `name` |  | 이름 |
| ↳ ↳ `phone` |  | 전화번호 |
| ↳ ↳ `cellphone` |  | 휴대전화 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `address1` |  | 기본 주소 |
| ↳ ↳ `address2` |  | 상세 주소 |
| ↳ `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| ↳ `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| ↳ `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `undone_reason` |  | 철회 사유 |
| ↳ `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| ↳ `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |

응답 예시 (JSON):

```json
{
    "exchange": {
        "shop_no": 1,
        "order_id": "20190228-0000011",
        "claim_code": "B20190228-0000004",
        "status": "processing",
        "pickup_completed": "T",
        "carrier_id": null,
        "return_invoice_no": null,
        "return_shipping_company_name": null,
        "return_invoice_success": null,
        "return_invoice_fail_reason": null,
        "recover_inventory": "T",
        "exchanged_after_collected": null,
        "items": [
            {
                "order_item_code": "20190228-0000011-01"
            },
            {
                "order_item_code": "20190228-0000011-02"
            }
        ],
        "request_pickup": null,
        "pickup": {
            "name": null,
            "phone": null,
            "cellphone": null,
            "zipcode": null,
            "address1": null,
            "address2": null
        },
        "undone": null,
        "add_memo_too": null,
        "undone_reason_type": null,
        "undone_reason": null,
        "expose_order_detail": null,
        "exposed_undone_reason": null
    }
}
```
