---
resource: order
entity: orders__return
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--return
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders return

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders return](https://developers.cafe24.com/docs/ko/api/admin/#orders--return)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 반품(Orders return)은 특정 주문의 반품과 관련된 기능입니다. · 특정 주문을 반품처리 하거나, 반품처리중인 주문의 상태를 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `status` |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| `claim_code` |  | 반품번호 |
| `items` |  | 품주코드 |
| `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `carrier_id` |  | 배송사 아이디 |
| `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| `return_shipping_company_name` | 최대글자수 : [30자] | 반품 배송업체명 |
| `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` | 최대글자수 : [100자] | 반송장 처리 실패 사유 |
| `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| `request_pickup` |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| `pickup` |  | 수거지역 상세 |
| `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 철회 사유 |
| `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |

## Operations

### `POST /api/v2/admin/orders/{order_id}/return` — Create an order return

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-return

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `payment_gateway_cancel` |  |  | F | PG 취소 요청 여부 주문을 반품처리함과 동시에 PG취소도 같이 처리할 수 있다. · PG취소가 가능한 결제수단(신용카드, 실시간계좌이체)에서만 사용 가능하다. · 결제수단이 복수인 주문(카드 등으로 결제한 주문을 결제 후 품목을 추가한 경우)의 경우에는 PG 결제를 취소할 수 없으며 관리자 화면에서 취소해야 한다. · 오픈마켓/네이버페이 주문을 취소할 경우 사용 불가 T : 취소함 · F : 취소안함 |
| `status` | ✓ |  |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| `pickup_completed` |  |  | F | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `recover_inventory` |  |  | F | 재고복구 T : 복구함 · F : 복구안함 |
| `recover_coupon` |  |  | F | 쿠폰 복원 Youtube shopping 이용 시에는 미제공 T : 복구함 · F : 복구안함 |
| `recover_coupon_no` |  |  |  | 복원할 쿠폰 번호 Youtube shopping 이용 시에는 미제공 |
| `add_memo_too` |  |  | F | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `reason` |  | 최대글자수 : [2000자] |  | 반품사유 |
| `claim_reason_type` |  |  |  | 반품사유 구분 A : 고객변심 · B : 배송지연 · C : 배송불가지역 · L : 수출/통관 불가 · D : 포장불량 · E : 상품불만족 · F : 상품정보상이 · G : 서비스불만족 · H : 품절 · I : 기타 |
| `naverpay_return_reason_type` |  |  |  | 네이버페이 반품사유 구분 Youtube shopping 이용 시에는 미제공 카카오페이 주문을 반품할 경우 사용 불가 EC 베트남, 필리핀, 일본 버전에서는 사용할 수 없음. 51 : 구매 의사 취소 · 52 : 색상 및 사이즈 변경 · 53 : 다른 상품 잘못 주문 · 54 : 서비스 및 상품 불만족 · 55 : 배송 지연 · 56 : 상품 품절 · 57 : 배송 누락 · 58 : 미배송 · 59 : 상품 파손 · 60 : 상품 정보 상이 · 61 : 오배송 · 62 : 색상 등 옵션이 다른 상품 잘못 배송 |
| `refund_method_code` |  |  |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 환불 방식(refund_method)이 현금(T)일 경우 필수 · refund_bank_code · ※ 해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 환불 방식(refund_method)이 현금(T)일 경우 필수 · ※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수 · 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 환불 방식(refund_method)이 현금(T)일 경우 필수 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |
| `request_pickup` |  |  |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| `pickup` |  |  |  | 수거지역 상세 |
| ↳ `name` |  |  |  | 이름 |
| ↳ `phone` |  |  |  | 전화번호 |
| ↳ `cellphone` |  |  |  | 휴대전화 |
| ↳ `zipcode` |  |  |  | 우편번호 |
| ↳ `address1` |  |  |  | 기본 주소 |
| ↳ `address2` |  |  |  | 상세 주소 |
| `return_invoice_no` |  | 최대글자수 : [40자] |  | 반품 송장 번호 |
| `return_shipping_company_name` |  | 최대글자수 : [30자] |  | 반품 배송업체명 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `return` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `status` |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  |  |
| ↳ ↳ `quantity` |  |  |

응답 예시 (JSON):

```json
{
    "return": {
        "shop_no": 1,
        "order_id": "20190805-0000011",
        "status": "returned",
        "claim_code": "C20190805-0000007",
        "pickup_completed": "T",
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

### `PUT /api/v2/admin/orders/{order_id}/return/{claim_code}` — Update an order return

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-return

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `claim_code` | ✓ |  |  | 반품번호 |
| `status` |  |  |  | 주문상태 processing : 반품처리중 · returned : 반품완료 |
| `carrier_id` |  |  |  | 배송사 아이디 배송사에서 반송장번호 업데이트시 carrier_id 필수 |
| `return_invoice_no` |  | 최대글자수 : [40자] |  | 반품 송장 번호 |
| `return_shipping_company_name` |  | 최대글자수 : [30자] |  | 반품 배송업체명 |
| `return_invoice_success` |  |  |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` |  | 최대글자수 : [100자] |  | 반송장 처리 실패 사유 |
| `refund_method_code` |  |  |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `pickup_completed` |  |  |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` |  |  |  | 품주코드 |
| `recover_coupon` |  |  |  | 쿠폰 복원 Youtube shopping 이용 시에는 미제공 T : 복구함 · F : 복구안함 |
| `recover_coupon_no` |  |  |  | 복원할 쿠폰 번호 Youtube shopping 이용 시에는 미제공 |
| `recover_inventory` |  |  |  | 재고복구 T : 복구함 · F : 복구안함 |
| `request_pickup` |  |  |  | 수거신청 여부 반송지 저장시 기본값은 "수거신청함(T)" T : 사용함 · F : 사용안함 |
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
| `refund_bank_code` |  |  |  | 환불 은행 코드 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `return` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `status` |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| ↳ `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| ↳ `return_shipping_company_name` | 최대글자수 : [30자] | 반품 배송업체명 |
| ↳ `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| ↳ `return_invoice_fail_reason` | 최대글자수 : [100자] | 반송장 처리 실패 사유 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  |  |
| ↳ `refund_method_code` |  | (목록) |
| ↳ `refund_bank_code` |  |  |
| ↳ `refund_bank_account_no` |  |  |
| ↳ `refund_bank_account_holder` |  |  |
| ↳ `combined_refund_method` |  |  |
| ↳ `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| ↳ `request_pickup` |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| ↳ `pickup` |  | 수거지역 상세 |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `phone` |  |  |
| ↳ ↳ `cellphone` |  |  |
| ↳ ↳ `zipcode` |  |  |
| ↳ ↳ `address1` |  |  |
| ↳ ↳ `address2` |  |  |
| ↳ `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| ↳ `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| ↳ `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `undone_reason` |  | 철회 사유 |
| ↳ `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| ↳ `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |

응답 예시 (JSON):

```json
{
    "return": {
        "shop_no": 1,
        "order_id": "20190228-0000011",
        "claim_code": "C20190228-0000004",
        "status": "processing",
        "pickup_completed": "T",
        "carrier_id": null,
        "return_invoice_no": null,
        "return_shipping_company_name": null,
        "return_invoice_success": null,
        "return_invoice_fail_reason": null,
        "items": [
            {
                "order_item_code": "20190228-0000011-01"
            },
            {
                "order_item_code": "20190228-0000011-02"
            }
        ],
        "refund_method_code": [
            "F",
            "T"
        ],
        "refund_bank_code": "bank_82",
        "refund_bank_account_no": "000000111111",
        "refund_bank_account_holder": "John Doe",
        "combined_refund_method": null,
        "recover_inventory": "T",
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
