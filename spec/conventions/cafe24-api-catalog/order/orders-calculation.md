---
resource: order
entity: orders-calculation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-calculation
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders calculation

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders calculation](https://developers.cafe24.com/docs/ko/api/admin/#orders-calculation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문의 결제예정금액 계산(Orders calculation)은 주문의 배송국가 등을 체크하여 결제예정금액을 계산하는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `mobile` |  | 모바일 PC 여부 |
| `device` |  | 접속 환경 |
| `member_id` |  | 회원아이디 |
| `shipping_type` |  | 배송 유형 A : 국내 · B : 해외 |
| `payment_method` |  | 결제수단 코드 cash : 무통장 · card : 신용카드 · icash : 가상계좌 · tcash : 계좌이체 · cell : 휴대폰 · deferpay : 후불결제 · point : 적립금 |
| `country_code` |  | 국가코드 |
| `carrier_id` |  | 배송사 아이디 |
| `zipcode` |  | 우편번호 |
| `address_full` |  | 전체주소 |
| `address_state` |  | 주/도 |
| `items` |  | 주문상품목록 |
| `points_spent_amount` |  | 적립금사용금액 |
| `coupon_discount_amount` |  | 쿠폰 할인금액 |
| `membership_discount_amount` |  | 회원등급 할인금액 |
| `shipping_fee_discount_amount` |  | 배송비 할인금액 |
| `product_discount_amount` |  | 상품별 할인금액 |
| `order_price_amount` |  | 상품 구매금액 |
| `total_discount_amount` |  | 총 할인금액 |
| `shipping_fee` |  | 배송비 |
| `total_amount_due` |  | 결제예정 금액 |
| `shipping_fee_information` |  | 배송비 상세정보 |
| `tax_free_amount` |  | 면세 + 영세 |
| `vat_amount` |  | 부가세 |
| `tax_amount` |  | 과세 |
| `order_coupons` |  | 주문서 쿠폰 |

## Operations

### `POST /api/v2/admin/orders/calculation` — Calculate total due

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#calculate-total-due

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `mobile` |  |  | F | 모바일 PC 여부 T : 사용함 · F : 사용안함 |
| `device` |  |  |  | 접속 환경 pc : PC · mobile : 모바일 · plusapp : 플러스앱(브랜드앱) |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `shipping_type` |  |  | A | 배송 유형 A : 국내 · B : 해외 |
| `payment_method` |  |  |  | 결제수단 코드 cash : 무통장 · card : 신용카드 · icash : 가상계좌 · tcash : 계좌이체 · cell : 휴대폰 · deferpay : 후불결제 · point : 적립금 |
| `country_code` |  |  |  | 국가코드 |
| `carrier_id` |  |  |  | 배송사 아이디 |
| `zipcode` |  |  |  | 우편번호 |
| `address_full` |  | 최대글자수 : [1000자] |  | 전체주소 |
| `address_state` |  | 최대글자수 : [255자] |  | 주/도 |
| `items` |  |  |  | 주문상품목록 |
| ↳ `product_no` | ✓ |  |  | 상품번호 |
| ↳ `variant_code` | ✓ |  |  | 상품 품목 코드 |
| ↳ `option_id` |  |  |  | 상품옵션 아이디 |
| ↳ `quantity` | ✓ |  |  | 수량 |
| ↳ `product_price` | ✓ |  |  | 상품 판매가 |
| ↳ `option_price` |  |  |  | 옵션 추가 가격 |
| ↳ `product_bundle` |  |  |  | 세트상품 여부 · T : 세트상품 · F : 세트상품 아님 · DEFAULT F |
| ↳ `product_bundle_no` |  |  |  | 세트상품번호 |
| ↳ `prepaid_shipping_fee` |  |  |  | 배송비 선결제 설정 · P : 선불 · C : 착불 · DEFAULT P |
| ↳ `product_coupons` |  |  |  | 상품 쿠폰 |
| `points_spent_amount` |  |  |  | 적립금사용금액 |
| `order_coupons` |  |  |  | 주문서 쿠폰 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `calculation` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `mobile` |  | 모바일 PC 여부 |
| ↳ `device` |  | 접속 환경 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `payment_method` |  | 결제수단 코드 cash : 무통장 · card : 신용카드 · icash : 가상계좌 · tcash : 계좌이체 · cell : 휴대폰 · deferpay : 후불결제 · point : 적립금 |
| ↳ `shipping_type` |  | 배송 유형 A : 국내 · B : 해외 |
| ↳ `country_code` |  | 국가코드 |
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `zipcode` |  | 우편번호 |
| ↳ `address_full` |  | 전체주소 |
| ↳ `address_state` |  | 주/도 |
| ↳ `items` |  | 주문상품목록 |
| ↳ ↳ `product_no` |  | 상품번호 |
| ↳ ↳ `variant_code` |  | 상품 품목 코드 |
| ↳ ↳ `option_id` |  | 상품옵션 아이디 |
| ↳ ↳ `quantity` |  | 수량 |
| ↳ ↳ `product_price` |  | 상품 판매가 |
| ↳ ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ ↳ `product_bundle` |  | 세트상품 여부 · T : 세트상품 · F : 세트상품 아님 · DEFAULT F |
| ↳ ↳ `product_bundle_no` |  | 세트상품번호 |
| ↳ ↳ `prepaid_shipping_fee` |  | 배송비 선결제 설정 · P : 선불 · C : 착불 · DEFAULT P |
| ↳ ↳ `additional_discount_price` |  | 상품추가할인액 상품에 대한 추가 할인금액 |
| ↳ ↳ `additional_discount_detail` |  | (응답 객체) |
| ↳ ↳ ↳ `customer_discount_amount` |  |  |
| ↳ ↳ ↳ `new_product_discount_amount` |  |  |
| ↳ ↳ ↳ `individual_bundle_product_discount_amount` |  |  |
| ↳ ↳ ↳ `repurchase_discount_amount` |  |  |
| ↳ ↳ ↳ `bulk_purchase_discount_amount` |  |  |
| ↳ ↳ ↳ `period_discount_amount` |  |  |
| ↳ `points_spent_amount` |  | 적립금사용금액 |
| ↳ `coupon_discount_amount` |  | 쿠폰 할인금액 |
| ↳ `membership_discount_amount` |  | 회원등급 할인금액 |
| ↳ `shipping_fee_discount_amount` |  | 배송비 할인금액 |
| ↳ `product_discount_amount` |  | 상품별 할인금액 |
| ↳ `order_price_amount` |  | 상품 구매금액 |
| ↳ `total_discount_amount` |  | 총 할인금액 |
| ↳ `shipping_fee` |  | 배송비 |
| ↳ `total_amount_due` |  | 결제예정 금액 |
| ↳ `shipping_fee_information` |  | 배송비 상세정보 |
| ↳ ↳ `default_shipping_fee` |  | 기본 배송비 |
| ↳ ↳ `supplier_shipping_fee` |  |  |
| ↳ ↳ `additonal_abroad_shipping_fee` |  |  |
| ↳ ↳ `additional_handling_fee` |  |  |
| ↳ `tax_free_amount` |  | 면세 + 영세 |
| ↳ `vat_amount` |  | 부가세 |
| ↳ `tax_amount` |  | 과세 |
| ↳ `order_coupons` |  | 주문서 쿠폰 |
| ↳ ↳ `coupon_no` |  |  |
| ↳ ↳ `coupon_price` |  |  |
| ↳ ↳ `benefit_type` |  |  |

응답 예시 (JSON):

```json
{
    "calculation": {
        "shop_no": 1,
        "mobile": "F",
        "device": "plusapp",
        "member_id": "sampleid",
        "payment_method": "cash",
        "shipping_type": "A",
        "country_code": "KR",
        "carrier_id": 15,
        "zipcode": "123-456",
        "address_full": "Professional Construction Hall, Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address_state": "STATE",
        "items": [
            {
                "product_no": 14,
                "variant_code": "P000000O000A",
                "option_id": "000A",
                "quantity": 1,
                "product_price": "3000.00",
                "option_price": "100.00",
                "product_bundle": "F",
                "product_bundle_no": null,
                "prepaid_shipping_fee": "P",
                "additional_discount_price": "930.00",
                "additional_discount_detail": {
                    "customer_discount_amount": null,
                    "new_product_discount_amount": null,
                    "individual_bundle_product_discount_amount": "310.00",
                    "repurchase_discount_amount": null,
                    "bulk_purchase_discount_amount": null,
                    "period_discount_amount": "620.00"
                }
            },
            {
                "product_no": 10,
                "variant_code": "P000000J000B",
                "option_id": "000B",
                "quantity": 1,
                "product_price": "10000.00",
                "option_price": "500.00",
                "product_bundle": "T",
                "product_bundle_no": 16,
                "prepaid_shipping_fee": "P",
                "additional_discount_price": "3150.00",
                "additional_discount_detail": {
                    "customer_discount_amount": null,
                    "new_product_discount_amount": null,
                    "individual_bundle_product_discount_amount": "2100.00",
                    "repurchase_discount_amount": null,
                    "bulk_purchase_discount_amount": null,
                    "period_discount_amount": "1050.00"
                },
                "product_coupons": [
                    {
                        "coupon_no": "6082815071400000089",
                        "coupon_price": "1000.00",
                        "benefit_type": "MP"
                    },
                    {
                        "coupon_no": "6082815070100000083",
                        "coupon_price": "1000.00",
                        "benefit_type": "DP"
                    },
                    {
                        "coupon_no": "6082815067600000071",
                        "coupon_price": "2700.00",
                        "benefit_type": "DS"
                    }
                ]
            }
        ],
        "points_spent_amount": "1000.00",
        "coupon_discount_amount": "5000.00",
        "membership_discount_amount": "800.00",
        "shipping_fee_discount_amount": "0.00",
        "product_discount_amount": "4080.00",
        "order_price_amount": "13600.00",
        "total_discount_amount": "9880.00",
        "shipping_fee": "2700.00",
        "total_amount_due": "2720.00",
        "shipping_fee_information": {
            "default_shipping_fee": "100.00",
            "supplier_shipping_fee": null,
            "additonal_abroad_shipping_fee": null,
            "additional_handling_fee": null
        },
        "tax_free_amount": "0.00",
        "vat_amount": "247.00",
        "tax_amount": "2473.00",
        "order_coupons": [
            {
                "coupon_no": "6082815066600000065",
                "coupon_price": "1300.00",
                "benefit_type": "DP"
            }
        ]
    }
}
```
