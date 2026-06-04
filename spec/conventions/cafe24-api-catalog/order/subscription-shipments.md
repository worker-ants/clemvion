---
resource: order
entity: subscription-shipments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Subscription shipments

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Subscription shipments](https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

정기배송(Subscription shipments)은 정기배송에 대한 조회, 등록, 수정, 삭제를 할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `subscription_id` |  | 정기배송 신청번호 |
| `member_id` |  | 회원아이디 |
| `buyer_name` |  | 주문자 이름 |
| `buyer_zipcode` |  | 주문자 우편번호 |
| `buyer_address1` |  | 주문자 기본 주소 |
| `buyer_address2` |  | 주문자 상세 주소 |
| `buyer_phone` |  | 주문자 일반 전화 |
| `buyer_cellphone` |  | 주문자 휴대 전화 |
| `buyer_email` |  | 주문자 이메일 |
| `receiver_name` | 최대글자수 : [100자] | 수령자 명 |
| `receiver_zipcode` |  | 수령자 우편번호 |
| `receiver_address1` |  | 수령자 기본 주소 |
| `receiver_address2` |  | 수령자 상세 주소 |
| `receiver_phone` |  | 수령자 일반 전화 |
| `receiver_cellphone` |  | 수령자 휴대 전화 |
| `shipping_message` |  | 배송 메세지 |
| `delivery_type` |  | 배송 유형 A : 국내 · B : 해외 |
| `wished_delivery` |  | 희망배송일 사용여부 T : 사용함 · F : 사용안함 |
| `wished_delivery_start_hour` |  | 희망배송시작시간 |
| `wished_delivery_end_hour` |  | 희망배송종료시간 |
| `wished_delivery_hour_asap` |  | 가능한 빠른 배송시간 T : 사용함 · F : 사용안함 |
| `store_pickup` |  | 스토어픽업 T : 사용함 · F : 사용안함 |
| `use_virtual_phone_no` |  | 안심번호 T : 사용함 · F : 사용안함 |
| `created_date` |  | 신청일자 |
| `subscription_state` |  | 정기배송 상태 U:이용중 · P: 일시정지 · C:해지 |
| `items` |  | 주문상품목록 |

## Operations

### `GET /api/v2/admin/subscription/shipments` — Retrieve a subscription

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-subscription

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `date_type` |  |  | created_date | 검색날짜 유형 created_date : 신청일 · expected_pay_date : 결제예정일 · terminated_date : 해지일 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `subscription_id` |  |  |  | 정기배송 신청번호 |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `buyer_name` |  | 최대글자수 : [100자] |  | 주문자 이름 |
| `buyer_phone` |  |  |  | 주문자 일반 전화 |
| `buyer_cellphone` |  |  |  | 주문자 휴대 전화 |
| `product_no` |  |  |  | 상품번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `product_name` |  | 최대글자수 : [250자] |  | 상품명 |
| `product_code` |  |  |  | 상품코드 |
| `variant_code` |  |  |  | 품목코드 |
| `subscription_shipments_cycle` |  |  |  | 배송주기 ,(콤마)로 여러 건을 검색할 수 있다. 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `subscription_state` |  |  |  | 정기배송 상태 U:이용중 · P: 일시정지 · C:해지 |
| `limit` |  | 최소: [1]~최대: [100] | 20 | 조회결과 최대건수 |
| `offset` |  | 최대값: [5000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipments` |  | (목록) |
| ↳ `subscription_id` |  | 정기배송 신청번호 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `buyer_name` |  | 주문자 이름 |
| ↳ `buyer_zipcode` |  | 주문자 우편번호 |
| ↳ `buyer_address1` |  | 주문자 기본 주소 |
| ↳ `buyer_address2` |  | 주문자 상세 주소 |
| ↳ `buyer_phone` |  | 주문자 일반 전화 |
| ↳ `buyer_cellphone` |  | 주문자 휴대 전화 |
| ↳ `buyer_email` |  | 주문자 이메일 |
| ↳ `receiver_name` | 최대글자수 : [100자] | 수령자 명 |
| ↳ `receiver_zipcode` |  | 수령자 우편번호 |
| ↳ `receiver_address1` |  | 수령자 기본 주소 |
| ↳ `receiver_address2` |  | 수령자 상세 주소 |
| ↳ `receiver_phone` |  | 수령자 일반 전화 |
| ↳ `receiver_cellphone` |  | 수령자 휴대 전화 |
| ↳ `shipping_message` |  | 배송 메세지 |
| ↳ `shipping_type` |  |  |
| ↳ `wished_delivery` |  | 희망배송일 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `wished_delivery_start_hour` |  | 희망배송시작시간 |
| ↳ `wished_delivery_end_hour` |  | 희망배송종료시간 |
| ↳ `wished_delivery_hour_asap` |  | 가능한 빠른 배송시간 T : 사용함 · F : 사용안함 |
| ↳ `created_date` |  | 신청일자 |
| ↳ `terminated_date` |  |  |
| ↳ `subscription_state` |  | 정기배송 상태 U:이용중 · P: 일시정지 · C:해지 |
| ↳ `items` |  | 주문상품목록 |
| ↳ ↳ `variants_code` |  |  |
| ↳ ↳ `product_code` |  | 상품코드 |
| ↳ ↳ `subscription_item_id` |  | 정기배송 아이템 번호 |
| ↳ ↳ `product_no` |  | 상품번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| ↳ ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ ↳ `option_value` |  |  |
| ↳ ↳ `option_value_default` |  | 기본옵션값 |
| ↳ ↳ `option_id` |  | 상품옵션 아이디 · DEFAULT 000A |
| ↳ ↳ `quantity` |  | 주문 수량 |
| ↳ ↳ `product_price` |  | 상품 판매가 |
| ↳ ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ ↳ `shipping_payment_option` |  | 선/착불 구분 · C : 착불 · P : 선결제 · F : 무료 |
| ↳ ↳ `subscription_shipments_sequence` |  |  |
| ↳ ↳ `subscription_state` |  | 정기배송 상태 U:이용중 · P: 일시정지 · C:해지 |
| ↳ ↳ `expected_pay_date` |  |  |
| ↳ ↳ `terminated_date` |  |  |
| ↳ ↳ `product_bundle` |  | 세트상품 여부 · T : 세트상품 · F : 세트상품 아님 · DEFAULT F |
| ↳ ↳ `product_bundle_price` |  |  |
| ↳ ↳ `bundle_product_components` |  | 세트상품의 구성상품 정보 |
| ↳ ↳ ↳ `variants_code` |  |  |
| ↳ ↳ ↳ `product_code` |  | 상품코드 |
| ↳ ↳ ↳ `product_no` |  | 상품번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| ↳ ↳ ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ ↳ ↳ `option_value` |  |  |
| ↳ ↳ ↳ `option_value_default` |  | 기본옵션값 |
| ↳ ↳ ↳ `option_id` |  | 상품옵션 아이디 · DEFAULT 000A |
| ↳ ↳ ↳ `quantity` |  | 주문 수량 |
| ↳ ↳ ↳ `product_price` |  | 상품 판매가 |
| ↳ ↳ ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ ↳ `max_delivery_limit` | 최소값: [0]; 최대값: [12] | 정기배송 횟수 0 : 제한없음 · 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 10 : 10회 · 12 : 12회 |

응답 예시 (JSON):

```json
{
    "shipments": [
        {
            "subscription_id": "S-20210716-00000001",
            "member_id": "sampleid",
            "buyer_name": "John Doe",
            "buyer_zipcode": "123-456",
            "buyer_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "buyer_address2": "Professional Construction Hall",
            "buyer_phone": "02-0000-0000",
            "buyer_cellphone": "010-0000-0000",
            "buyer_email": "sample@sample.com",
            "receiver_name": "Jane Doe",
            "receiver_zipcode": "123-456",
            "receiver_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "receiver_address2": "Professional Construction Hall",
            "receiver_phone": "02-0000-0000",
            "receiver_cellphone": "010-0000-0000",
            "shipping_message": "Do Not Knock or Ring Bell",
            "shipping_type": "A",
            "wished_delivery": "T",
            "wished_delivery_start_hour": "10",
            "wished_delivery_end_hour": "18",
            "wished_delivery_hour_asap": "F",
            "created_date": "2021-05-16",
            "terminated_date": null,
            "subscription_state": "U",
            "items": [
                {
                    "variants_code": "P000000I000A",
                    "product_code": "P000000I",
                    "subscription_item_id": 21,
                    "product_no": "9",
                    "product_name": "iPhone X",
                    "option_value": "Color=Black, Size=XL",
                    "option_value_default": "Color=Black, Size=XL",
                    "option_id": "000A",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "option_price": "0.00",
                    "shipping_payment_option": "P",
                    "subscription_shipments_sequence": 1,
                    "subscription_state": "U",
                    "expected_pay_date": "2021-07-20",
                    "terminated_date": null,
                    "product_bundle": "F",
                    "product_bundle_price": null,
                    "bundle_product_components": [
                        {
                            "variants_code": null,
                            "product_code": null,
                            "product_no": null,
                            "product_name": null,
                            "option_value": null,
                            "option_value_default": null,
                            "option_id": null,
                            "quantity": null,
                            "product_price": null,
                            "option_price": null
                        }
                    ],
                    "max_delivery_limit": 0
                },
                {
                    "variants_code": "P000000A000B",
                    "product_code": "P000000A",
                    "subscription_item_id": 22,
                    "product_no": "10",
                    "product_name": "Galaxy S",
                    "option_value": "Color=Black, Size=XL",
                    "option_value_default": "Color=Black, Size=XL",
                    "option_id": "000B",
                    "quantity": 2,
                    "product_price": "10000.00",
                    "option_price": "0.00",
                    "shipping_payment_option": "C",
                    "subscription_shipments_sequence": 1,
                    "subscription_state": "U",
                    "expected_pay_date": "2021-07-20",
                    "terminated_date": null,
                    "product_bundle": "F",
                    "product_bundle_price": null,
                    "bundle_product_components": [
                        {
                            "variants_code": null,
                            "product_code": null,
                            "product_no": null,
                            "product_name": null,
                            "option_value": null,
                            "option_value_default": null,
                            "option_id": null,
                            "quantity": null,
                            "product_price": null,
                            "option_price": null
                        }
                    ],
                    "max_delivery_limit": 6
                }
            ]
        },
        {
            "subscription_id": "S-20210716-00000002",
            "member_id": "sampleid",
            "buyer_name": "John Doe",
            "buyer_zipcode": "123-456",
            "buyer_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "buyer_address2": "Professional Construction Hall",
            "buyer_phone": "02-0000-0000",
            "buyer_cellphone": "010-0000-0000",
            "buyer_email": "sample@sample.com",
            "receiver_name": "Jane Doe",
            "receiver_zipcode": "123-456",
            "receiver_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "receiver_address2": "Professional Construction Hall",
            "receiver_phone": "02-0000-0000",
            "receiver_cellphone": "010-0000-0000",
            "shipping_message": "Do Not Knock or Ring Bell",
            "shipping_type": "A",
            "wished_delivery": "F",
            "wished_delivery_start_hour": "0",
            "wished_delivery_end_hour": "23",
            "wished_delivery_hour_asap": "F",
            "created_date": "2021-05-16",
            "terminated_date": null,
            "subscription_state": "C",
            "items": [
                {
                    "variants_code": "P000000I000A",
                    "product_code": "P000000I",
                    "subscription_item_id": 15,
                    "product_no": "9",
                    "product_name": "iPhone X",
                    "option_value": "Color=Black, Size=XL",
                    "option_value_default": "Color=Black, Size=XL",
                    "option_id": "000A",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "option_price": "0.00",
                    "shipping_payment_option": "P",
                    "subscription_shipments_sequence": 1,
                    "subscription_state": "M",
                    "expected_pay_date": "2021-07-20",
                    "terminated_date": null,
                    "product_bundle": "F",
                    "product_bundle_price": null,
                    "bundle_product_components": [
                        {
                            "variants_code": null,
                            "product_code": null,
                            "product_no": null,
                            "product_name": null,
                            "option_id": null,
                            "option_value": null,
                            "option_value_default": null,
                            "quantity": null,
                            "product_price": null,
                            "option_price": null
                        }
                    ],
                    "max_delivery_limit": 0
                },
                {
                    "variants_code": "P000000A000B",
                    "product_code": "P000000A",
                    "subscription_item_id": 16,
                    "product_no": "10",
                    "product_name": "Galaxy S",
                    "option_value": null,
                    "option_value_default": "",
                    "option_id": "000B",
                    "quantity": 2,
                    "product_price": "10000.00",
                    "option_price": "0.00",
                    "shipping_payment_option": "C",
                    "subscription_shipments_sequence": 1,
                    "subscription_state": "O",
                    "expected_pay_date": "2021-07-20",
                    "terminated_date": null,
                    "product_bundle": "T",
                    "product_bundle_price": "1000.00",
                    "bundle_product_components": [
                        {
                            "variants_code": "P000000Z000A",
                            "product_code": "P000000Z",
                            "product_no": "25",
                            "product_name": "Protection Film",
                            "option_id": "000A",
                            "option_value": "Color=Black, Size=XL",
                            "option_value_default": "Color=Black, Size=XL",
                            "quantity": 1,
                            "product_price": "6000.00",
                            "option_price": "0.00"
                        },
                        {
                            "variants_code": "P000000J000A",
                            "product_code": "P000000J",
                            "product_no": "26",
                            "product_name": "Case",
                            "option_id": "000A",
                            "option_value": "Color=Black, Size=XL",
                            "option_value_default": "Color=Black, Size=XL",
                            "quantity": 1,
                            "product_price": "5000.00",
                            "option_price": "0.00"
                        }
                    ],
                    "max_delivery_limit": 4
                }
            ]
        }
    ]
}
```

### `POST /api/v2/admin/subscription/shipments` — Create a subscription

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |
| `buyer_name` | ✓ | 최대글자수 : [100자] |  | 주문자 이름 |
| `buyer_zipcode` | ✓ | 글자수 최소: [2자]~최대: [14자] |  | 주문자 우편번호 |
| `buyer_address1` | ✓ | 최대글자수 : [250자] |  | 주문자 기본 주소 |
| `buyer_address2` | ✓ |  |  | 주문자 상세 주소 |
| `buyer_phone` |  | 최대글자수 : [20자] |  | 주문자 일반 전화 |
| `buyer_cellphone` | ✓ | 최대글자수 : [20자] |  | 주문자 휴대 전화 |
| `buyer_email` | ✓ | 이메일 |  | 주문자 이메일 |
| `receiver_name` | ✓ | 최대글자수 : [100자] |  | 수령자 명 |
| `receiver_zipcode` | ✓ | 글자수 최소: [2자]~최대: [13자] |  | 수령자 우편번호 |
| `receiver_address1` | ✓ |  |  | 수령자 기본 주소 |
| `receiver_address2` | ✓ |  |  | 수령자 상세 주소 |
| `receiver_phone` | ✓ | 최대글자수 : [20자] |  | 수령자 일반 전화 |
| `receiver_cellphone` | ✓ | 최대글자수 : [20자] |  | 수령자 휴대 전화 |
| `shipping_message` |  |  |  | 배송 메세지 |
| `delivery_type` |  |  | A | 배송 유형 A : 국내 · B : 해외 |
| `expected_delivery_date` | ✓ | 날짜 |  | 배송시작일 |
| `subscription_shipments_cycle` | ✓ |  |  | 배송주기 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `wished_delivery` |  |  | F | 희망배송일 사용여부 T : 사용함 · F : 사용안함 |
| `wished_delivery_start_hour` |  | 최소: [0]~최대: [23] |  | 희망배송시작시간 |
| `wished_delivery_end_hour` |  | 최소: [0]~최대: [23] |  | 희망배송종료시간 |
| `wished_delivery_hour_asap` |  |  |  | 가능한 빠른 배송시간 T : 사용함 · F : 사용안함 |
| `store_pickup` |  |  | F | 스토어픽업 T : 사용함 · F : 사용안함 |
| `use_virtual_phone_no` |  |  | F | 안심번호 T : 사용함 · F : 사용안함 |
| `max_delivery_limit` |  | 최소값: [0]; 최대값: [12] | 0 | 정기배송 횟수 0 : 제한없음 · 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 10 : 10회 · 12 : 12회 |
| `items` |  |  |  | 주문상품목록 |
| ↳ `product_code` | ✓ |  |  | 상품코드 |
| ↳ `product_no` | ✓ |  |  | 상품번호 |
| ↳ `product_name` | ✓ |  |  | 상품명 |
| ↳ `options` |  | Array |  |  |
| ↳ ↳ `name` |  |  |  | 옵션명 |
| ↳ ↳ `value` |  |  |  | 옵션값 |
| ↳ ↳ `option_code` |  |  |  | 연동형 옵션코드 |
| ↳ ↳ `value_no` |  |  |  | 연동형 옵션값 |
| ↳ `option_id` | ✓ |  |  | 상품옵션 아이디 · DEFAULT 000A |
| ↳ `quantity` | ✓ |  |  | 주문 수량 |
| ↳ `product_price` | ✓ |  |  | 상품 판매가 |
| ↳ `option_price` |  |  |  | 옵션 추가 가격 |
| ↳ `shipping_payment_option` |  |  |  | 선/착불 구분 · C : 착불 · P : 선결제 · F : 무료 |
| ↳ `category_no` |  |  |  | 분류 번호 |
| ↳ `product_bundle` |  |  |  | 세트상품 여부 · T : 세트상품 · F : 세트상품 아님 · DEFAULT F |
| ↳ `bundle_product_components` |  | Array |  |  |
| ↳ ↳ `product_code` |  |  |  | 상품코드 |
| ↳ ↳ `product_no` |  |  |  | 상품번호 |
| ↳ ↳ `option_id` |  |  |  | 상품옵션 아이디 |
| ↳ ↳ `quantity` |  |  |  | 주문 수량 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipments` |  | (목록) |
| ↳ `subscription_id` |  | 정기배송 신청번호 |
| ↳ `items` |  | 주문상품목록 |
| ↳ ↳ `variant_code` |  | 품목코드 |
| ↳ ↳ `option_id` |  | 상품옵션 아이디 · DEFAULT 000A |

응답 예시 (JSON):

```json
{
    "shipments": [
        {
            "subscription_id": "S-20180302-0000016",
            "items": [
                {
                    "variant_code": "P000000I000A",
                    "option_id": "000A"
                },
                {
                    "variant_code": "P000000A000B",
                    "option_id": "000B"
                }
            ]
        },
        {
            "subscription_id": "S-20180302-0000017",
            "items": [
                {
                    "variant_code": "P000000I000A",
                    "option_id": "000A"
                },
                {
                    "variant_code": "P000000A000B",
                    "option_id": "000B"
                }
            ]
        }
    ]
}
```

### `PUT /api/v2/admin/subscription/shipments/{subscription_id}` — Update a subscription

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-subscription

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `subscription_id` | ✓ |  |  | 정기배송 신청번호 |
| `receiver_name` |  | 최대글자수 : [100자] |  | 수령자 명 |
| `receiver_zipcode` |  | 글자수 최소: [2자]~최대: [14자] |  | 수령자 우편번호 |
| `receiver_address1` |  |  |  | 수령자 기본 주소 |
| `receiver_address2` |  |  |  | 수령자 상세 주소 |
| `receiver_phone` |  | 최대글자수 : [20자] |  | 수령자 일반 전화 |
| `receiver_cellphone` |  | 최대글자수 : [20자] |  | 수령자 휴대 전화 |
| `shipping_message` |  |  |  | 배송 메세지 |
| `subscription_state` |  |  |  | 정기배송 상태 U:이용중 · P:일시정지 · C:해지 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipments` |  | (응답 객체) |
| ↳ `receiver_name` | 최대글자수 : [100자] | 수령자 명 |
| ↳ `receiver_zipcode` |  | 수령자 우편번호 |
| ↳ `receiver_address1` |  | 수령자 기본 주소 |
| ↳ `receiver_address2` |  | 수령자 상세 주소 |
| ↳ `receiver_phone` |  | 수령자 일반 전화 |
| ↳ `receiver_cellphone` |  | 수령자 휴대 전화 |
| ↳ `shipping_message` |  | 배송 메세지 |
| ↳ `subscription_state` |  | 정기배송 상태 U:이용중 · P: 일시정지 · C:해지 |

응답 예시 (JSON):

```json
{
    "shipments": {
        "receiver_name": "Jane Doe",
        "receiver_zipcode": "123-456",
        "receiver_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "receiver_address2": "Professional Construction Hall",
        "receiver_phone": "02-0000-0000",
        "receiver_cellphone": "010-0000-0000",
        "shipping_message": "Do Not Knock or Ring Bell",
        "subscription_state": "C"
    }
}
```
