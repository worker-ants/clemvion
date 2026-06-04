---
resource: order
entity: orders__cancellation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--cancellation
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders cancellation

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders cancellation](https://developers.cafe24.com/docs/ko/api/admin/#orders--cancellation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 취소(Orders cancellation) 는 배송 전의 특정 주문 하나를 취소 처리할 수 있는 기능입니다. · 해당 API를 사용하여 취소완료처리할 경우 환불완료 처리와 함께 PG 취소도 같이 진행할 수 있습니다.(payment_gateway_cancel : "T"로 요청시)

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `status` |  | 주문상태 canceled : 취소완료 · canceling : 취소처리중 |
| `claim_code` |  | 취소번호 |
| `items` |  | 품주코드 |
| `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 철회 사유 |
| `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |

## Operations

### `POST /api/v2/admin/orders/{order_id}/cancellation` — Create an order cancellation

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `payment_gateway_cancel` |  |  | F | PG 취소 요청 여부 주문을 취소함과 동시에 PG취소도 같이 처리할 수 있다. · PG취소가 가능한 결제수단(신용카드, 실시간계좌이체)에서만 사용 가능하다. · 결제수단이 복수인 주문(카드 등으로 결제한 주문을 결제 후 품목을 추가한 경우)의 경우에는 PG 결제를 취소할 수 없으며 관리자 화면에서 취소해야 한다. · 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 T : 취소함 · F : 취소안함 |
| `status` | ✓ |  |  | 주문상태 accepted: 취소접수 · canceling : 취소처리중 · canceled : 취소완료 |
| `recover_inventory` |  |  | F | 재고복구 T : 복구함 · F : 복구안함 |
| `recover_coupon` |  |  | F | 쿠폰 복원 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 T : 복구함 · F : 복구안함 |
| `recover_coupon_no` |  |  |  | 복원할 쿠폰 번호 |
| `add_memo_too` |  |  | F | 관리자 메모에도 추가 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 T : 사용함 · F : 사용안함 |
| `reason` |  | 최대글자수 : [2000자] |  | 취소사유 |
| `claim_reason_type` |  |  |  | 취소사유 구분 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 A : 고객변심 · B : 배송지연 · C : 배송불가지역 · L : 수출/통관 불가 · D : 포장불량 · E : 상품불만족 · F : 상품정보상이 · G : 서비스불만족 · H : 품절 · I : 기타 |
| `naverpay_cancel_reason_type` |  |  |  | 네이버페이 취소사유 구분 쇼핑몰/오픈마켓/카카오페이 주문을 취소할 경우 사용 불가 EC 베트남, 필리핀 버전에서는 사용할 수 없음. 51 : 구매 의사 취소 · 52 : 색상 및 사이즈 변경 · 53 : 다른 상품 잘못 주문 · 54 : 서비스 및 상품 불만족 · 55 : 배송 지연 · 56 : 상품 품절 · 60 : 상품 정보 상이 |
| `kakaopay_cancel_reason_type` |  |  |  | 카카오페이 취소사유 구분 오픈마켓/네이버페이 주문을 취소할 경우 사용 불가 K1 : 변심에 의한 상품 취소 · K2 : 다른 옵션이나 상품을 잘못 주문함 · K3 : 배송지연 · K4 : 상품 파손 또는 불량 · K5 : 다른 상품 오배송 또는 구성품 누락 · K6 : 상품정보와 다름 · K7 : 품절로 인한 배송 불가 |
| `refund_method_code` |  |  |  | 환불 방식 (오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가) T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 환불 방식(refund_method)이 현금(T)일 경우 필수 · refund_bank_code · 해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수 · 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 · 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 환불 방식(refund_method)이 현금(T)일 경우 필수 · ※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수 · 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 · 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 환불 방식(refund_method)이 현금(T)일 경우 필수 · 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `cancellation` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `status` |  | 주문상태 canceled : 취소완료 · canceling : 취소처리중 |
| ↳ `claim_code` |  | 취소번호 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  |  |
| ↳ ↳ `quantity` |  |  |

응답 예시 (JSON):

```json
{
    "cancellation": {
        "shop_no": 1,
        "order_id": "20190805-0000011",
        "status": "canceled",
        "claim_code": "C20190805-0000007",
        "items": [
            {
                "order_item_code": "20190805-0000011-01",
                "quantity": 4
            },
            {
                "order_item_code": "20190805-0000011-02",
                "quantity": 4
            }
        ]
    }
}
```

### `PUT /api/v2/admin/orders/{order_id}/cancellation/{claim_code}` — Change cancellation details

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `claim_code` | ✓ |  |  | 취소번호 |
| `status` |  |  |  | 주문상태 canceling : 취소처리중 |
| `recover_inventory` | ✓ |  |  | 재고복구 T : 복구함 · F : 복구안함 |
| `undone` | ✓ |  |  | 철회 여부 T : 철회함 |
| `add_memo_too` | ✓ |  |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` | ✓ |  |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 최대글자수 : [2000자] |  | 철회 사유 |
| `expose_order_detail` | ✓ |  |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 최대글자수 : [2000자] |  | 주문상세내역 노출 철회 사유 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `cancellation` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `claim_code` |  | 취소번호 |
| ↳ `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  |  |
| ↳ `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| ↳ `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| ↳ `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `undone_reason` |  | 철회 사유 |
| ↳ `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| ↳ `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |

응답 예시 (JSON):

```json
{
    "cancellation": {
        "shop_no": 1,
        "order_id": "20190805-0000011",
        "claim_code": "C20190805-0000007",
        "recover_inventory": "T",
        "items": [
            {
                "order_item_code": "20190805-0000011-01"
            },
            {
                "order_item_code": "20190805-0000011-02"
            }
        ],
        "undone": "T",
        "add_memo_too": "F",
        "undone_reason_type": "A",
        "undone_reason": "Change of mind",
        "expose_order_detail": "T",
        "exposed_undone_reason": "Dear customer, It has been undone as discussed. Thank you."
    }
}
```
