---
resource: order
entity: cancellation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#cancellation
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Cancellation

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Cancellation](https://developers.cafe24.com/docs/ko/api/admin/#cancellation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

취소(Cancellation)는 특정 주문을 배송 전에 취소하는 기능입니다. · 판매자가 접수한 이후부터 생성되며 취소처리중의 단계를 거쳐 취소완료까지 진행됩니다. · 취소 리소스에서는 복수의 주문을 한번에 취소하거나 취소 상태를 수정하거나 조회할 수 있습니다. · 특정 주문을 취소할 때와 달리 PG 취소까지 진행되도록 취소할 수는 없습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `claim_code` |  | 취소번호 |
| `claim_reason_type` |  | 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `claim_reason` |  | 사유 |
| `refund_methods` |  | 환불 방식 |
| `refund_reason` |  | 비고 |
| `order_price_amount` |  | 상품구매금액 |
| `refund_amounts` |  | 환불금액 |
| `shipping_fee` |  | 배송비 |
| `return_ship_type` |  | 반품배송비 적용구분 |
| `defer_commission` |  | 후불 결제 수수료 |
| `partner_discount_amount` |  | 제휴할인 취소액 |
| `add_discount_amount` |  | 상품별추가할인 취소액 |
| `member_grade_discount_amount` |  | 회원등급할인 취소액 |
| `shipping_discount_amount` |  | 배송비할인 취소액 |
| `coupon_discount_amount` |  | 쿠폰할인 취소액 |
| `point_used` |  | 사용된 적립금 반환액 |
| `credit_used` |  | 사용된 예치금 반환액 |
| `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 철회 사유 |
| `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |
| `items` |  | 품주코드 |
| `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| `tax` |  | 세금 정보 세금 관리자 앱을 사용 안 할 경우 null로 반환 |
| `cancel_fee_amount` |  | 취소수수료 |
| `status` |  | 주문상태 canceled : 취소완료 · canceling : 취소처리중 |
| `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/cancellation/{claim_code}` — Retrieve an order cancellation

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-cancellation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `claim_code` | ✓ |  |  | 취소번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "cancellation": {
        "shop_no": 1,
        "order_id": "20190607-0000018",
        "claim_code": "C20190610-0000001",
        "claim_reason_type": "A",
        "claim_reason": "Damaged products",
        "refund_methods": [
            "Refund to points",
            "Refund to card"
        ],
        "refund_reason": "Points for damaged products",
        "order_price_amount": "15000.00",
        "refund_amounts": [
            {
                "payment_method": "point",
                "amount": "160.00"
            },
            {
                "payment_method": "card",
                "amount": "160.00"
            }
        ],
        "shipping_fee": "0.00",
        "return_ship_type": "Charge",
        "defer_commission": "0.00",
        "partner_discount_amount": "0.00",
        "add_discount_amount": "0.00",
        "member_grade_discount_amount": "0.00",
        "shipping_discount_amount": "0.00",
        "coupon_discount_amount": "0.00",
        "point_used": "-15000.00",
        "credit_used": "0.00",
        "undone": "F",
        "undone_reason_type": null,
        "undone_reason": null,
        "expose_order_detail": null,
        "exposed_undone_reason": null,
        "items": [
            {
                "shop_no": 1,
                "item_no": 1,
                "order_item_code": "20190607-0000018-01",
                "variant_code": "P000000N000A",
                "product_no": 14,
                "product_code": "P000000N",
                "custom_product_code": "",
                "custom_variant_code": "",
                "eng_product_name": null,
                "option_id": "000A",
                "option_value": "",
                "option_value_default": "",
                "additional_option_value": "",
                "additional_option_values": [
                    {
                        "key": "item_option_add",
                        "type": "text",
                        "name": "gift option",
                        "value": "yes"
                    },
                    {
                        "key": "item_option_add",
                        "type": "url",
                        "name": "Attached File",
                        "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                    }
                ],
                "product_name": "iPhone X",
                "product_name_default": "iPhone X",
                "product_price": "30000.00",
                "option_price": "0.00",
                "additional_discount_price": "0.00",
                "coupon_discount_price": "1000.00",
                "app_item_discount_amount": "0.00",
                "quantity": 1,
                "supplier_product_name": "",
                "supplier_transaction_type": "D",
                "supplier_id": "S0000000",
                "supplier_name": "Apple",
                "tracking_no": "12345678",
                "shipping_code": "D-20190607-0000018-00",
                "claim_code": "C20190107-0000001",
                "claim_reason_type": "A",
                "claim_reason": "Sorry. I will cancel order for one item.",
                "refund_bank_name": "Woori Bank",
                "refund_bank_account_no": "1234567890",
                "refund_bank_account_holder": "Holders Name",
                "post_express_flag": null,
                "order_status": "N40",
                "order_status_additional_info": null,
                "claim_quantity": 0,
                "status_code": "N1",
                "status_text": "Shipping Complete",
                "open_market_status": "",
                "bundled_shipping_type": "N",
                "shipping_company_id": "2",
                "shipping_company_name": "DHL",
                "shipping_company_code": "0001",
                "product_bundle": "F",
                "product_bundle_no": "0",
                "product_bundle_name": null,
                "product_bundle_name_default": null,
                "product_bundle_type": "C",
                "was_product_bundle": null,
                "original_bundle_item_no": null,
                "naver_pay_order_id": null,
                "naver_pay_claim_status": "PAYMENT_WAITING",
                "individual_shipping_fee": "0.00",
                "shipping_fee_type": "X",
                "shipping_fee_type_text": "Free",
                "shipping_payment_option": "F",
                "payment_info_id": "0",
                "original_item_no": [
                    242,
                    473
                ],
                "store_pickup": "F",
                "ordered_date": "2019-06-07T15:55:51+09:00",
                "shipped_date": "2019-06-07T15:56:52+09:00",
                "delivered_date": "2019-06-07T15:57:05+09:00",
                "cancel_date": null,
                "return_request_date": null,
                "return_confirmed_date": null,
                "return_collected_date": null,
                "cancel_request_date": null,
                "refund_date": null,
                "exchange_request_date": null,
                "exchange_date": null,
                "product_material": null,
                "product_material_eng": null,
                "cloth_fabric": null,
                "product_weight": "1.00",
                "volume_size": null,
                "volume_size_weight": null,
                "clearance_category": null,
                "clearance_category_info": null,
                "clearance_category_code": null,
                "hs_code": "",
                "one_plus_n_event": null,
                "origin_place": " ",
                "gift": "F",
                "item_granting_gift": null,
                "product_bundle_list": [
                    {
                        "product_no": 15,
                        "product_code": "P000000I",
                        "variant_code": "P000000P000A",
                        "product_name": "Sample Product 1",
                        "product_name_default": "Sample Product 1",
                        "option_id": "000A",
                        "option_value": "",
                        "option_value_default": "",
                        "additional_option_value": "",
                        "additional_option_values": [
                            {
                                "key": "item_option_add",
                                "type": "text",
                                "name": "gift option",
                                "value": "yes"
                            },
                            {
                                "key": "item_option_add",
                                "type": "url",
                                "name": "Attached File",
                                "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                            }
                        ],
                        "quantity": 1,
                        "supplier_id": "S0000000",
                        "eng_product_name": null,
                        "hs_code": "0201100000",
                        "option_price": "0.00"
                    },
                    {
                        "product_no": 16,
                        "product_code": "P000000Q",
                        "variant_code": "P000000Q000A",
                        "product_name": "Sample Product 3",
                        "product_name_default": "Sample Product 3",
                        "option_id": "000A",
                        "option_value": "",
                        "option_value_default": "",
                        "additional_option_value": "",
                        "additional_option_values": [
                            {
                                "key": "item_option_add",
                                "type": "text",
                                "name": "gift option",
                                "value": "yes"
                            },
                            {
                                "key": "item_option_add",
                                "type": "url",
                                "name": "Attached File",
                                "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                            }
                        ],
                        "quantity": 1,
                        "supplier_id": "S0000000",
                        "eng_product_name": null,
                        "hs_code": "0201201000",
                        "option_price": "0.00"
                    }
                ],
                "market_cancel_request": null,
                "market_cancel_request_quantity": null,
                "market_fail_reason": null,
                "market_fail_reason_guide": null,
                "market_item_sequence": null,
                "market_item_no": null,
                "market_custom_variant_code": null,
                "option_type": "E",
                "options": [
                    {
                        "option_code": "O000000A",
                        "option_name": null,
                        "option_value": {
                            "option_text": null,
                            "value_no": 1
                        }
                    },
                    {
                        "option_code": "O000000B",
                        "option_name": null,
                        "option_value": {
                            "option_text": null,
                            "value_no": 2
                        }
                    }
                ],
                "market_discount_amount": "0.00",
                "labels": null,
                "order_status_before_cs": "N20",
                "supply_price": "1500.00",
                "multi_invoice": null,
                "shipping_expected_date": null,
                "dropshipping_type": "N"
            }
        ],
        "include_tax": "T",
        "tax": [
            {
                "name": "vat",
                "amount": "1000.00"
            },
            {
                "name": "tax",
                "amount": "800.00"
            }
        ],
        "cancel_fee_amount": null
    }
}
```

### `POST /api/v2/admin/cancellation` — Create multiple order cancellations

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-cancellations

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
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
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 · 오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "cancellation": [
        {
            "shop_no": 1,
            "order_id": "20190228-0000011",
            "status": "canceled",
            "claim_code": "C20190805-0000007",
            "items": [
                {
                    "order_item_code": "20190228-0000011-01",
                    "quantity": 4
                },
                {
                    "order_item_code": "20190228-0000011-02",
                    "quantity": 4
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "20190228-0000012",
            "status": "canceled",
            "claim_code": "C20190805-0000008",
            "items": [
                {
                    "order_item_code": "20190228-0000012-01",
                    "quantity": 4
                },
                {
                    "order_item_code": "20190228-0000012-02",
                    "quantity": 4
                }
            ]
        }
    ]
}
```

### `PUT /api/v2/admin/cancellation` — Change cancellation details in bulk

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details-in-bulk

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `claim_code` | ✓ |  |  | 취소번호 |
| `status` |  |  |  | 주문상태 canceling : 취소처리중 |
| `recover_inventory` | ✓ |  |  | 재고복구 T : 복구함 · F : 복구안함 |
| `undone` |  |  |  | 철회 여부 T : 철회함 |
| `add_memo_too` | ✓ |  |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` |  |  |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 최대글자수 : [2000자] |  | 철회 사유 |
| `expose_order_detail` |  |  |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 최대글자수 : [2000자] |  | 주문상세내역 노출 철회 사유 |
| `refund_method_code` |  |  |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "cancellation": [
        {
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
        },
        {
            "shop_no": 1,
            "order_id": "20190805-0000012",
            "claim_code": "C20190805-0000008",
            "recover_inventory": "T",
            "items": [
                {
                    "order_item_code": "20190805-0000012-01"
                },
                {
                    "order_item_code": "20190805-0000012-02"
                }
            ],
            "undone": "T",
            "add_memo_too": "F",
            "undone_reason_type": "A",
            "undone_reason": "Change of mind",
            "expose_order_detail": "F",
            "exposed_undone_reason": null
        }
    ]
}
```
