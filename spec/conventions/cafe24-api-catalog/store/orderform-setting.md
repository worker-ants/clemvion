---
resource: store
entity: orderform-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orderform-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Orderform setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orderform setting](https://developers.cafe24.com/docs/ko/api/admin/#orderform-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문서 입력항목을 설정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `buy_limit_type` |  | 구매 제한 M:회원만 구매 · A:모두 구매 가능 |
| `guest_purchase_button_display` |  | 비회원 구매버튼 노출 buy_limit_type를 M(회원만 구매)으로 선택 하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| `junior_purchase_block` |  | 14세 미만 구매 차단 buy_limit_type를 A(모두 구매 가능)으로 선택하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| `reservation_order` |  | 예약주문 T : 사용함 · F : 사용안함 |
| `discount_amount_display` |  | 주문상품 할인금액 표시 T : 사용함 · F : 사용안함 |
| `order_item_delete` |  | 주문서 내 상품삭제 T : 사용함 · F : 사용안함 |
| `quick_signup` |  | 주문서 간단회원가입 T : 사용함 · F : 사용안함 |
| `check_order_info` |  | 주문서 입력정보 확인 T : 사용함 · F : 사용안함 |
| `order_form_input_type` |  | 주문서 입력정보 구성 A : 배송정보만 입력 · S : 주문/배송정보 개별입력 |
| `shipping_info` |  | 주문서 입력정보 상세설정 > 배송 정보 |
| `order_info` |  | 주문서 입력정보 상세설정 > 주문 정보 order_form_input_type이 A일때 order_info 입력 불가 |
| `china_taiwan_id_input` |  | 중국/대만 신분증 ID 입력 T : 사용함 · F : 사용안함 |
| `print_type` |  | 인쇄버튼 타입 |
| `orderform_additional_enabled` |  | 주문서 추가항목 사용여부 T : 사용 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/orderform/setting` — Retrieve the order/order form settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-order-order-form-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `orderform` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `buy_limit_type` |  | 구매 제한 M:회원만 구매 · A:모두 구매 가능 |
| ↳ `guest_purchase_button_display` |  | 비회원 구매버튼 노출 buy_limit_type를 M(회원만 구매)으로 선택 하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| ↳ `junior_purchase_block` |  | 14세 미만 구매 차단 buy_limit_type를 A(모두 구매 가능)으로 선택하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| ↳ `reservation_order` |  | 예약주문 T : 사용함 · F : 사용안함 |
| ↳ `discount_amount_display` |  | 주문상품 할인금액 표시 T : 사용함 · F : 사용안함 |
| ↳ `order_item_delete` |  | 주문서 내 상품삭제 T : 사용함 · F : 사용안함 |
| ↳ `quick_signup` |  | 주문서 간단회원가입 T : 사용함 · F : 사용안함 |
| ↳ `check_order_info` |  | 주문서 입력정보 확인 T : 사용함 · F : 사용안함 |
| ↳ `order_form_input_type` |  | 주문서 입력정보 구성 A : 배송정보만 입력 · S : 주문/배송정보 개별입력 |
| ↳ `shipping_info` |  | 주문서 입력정보 상세설정 > 배송 정보 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `required` |  |  |
| ↳ `order_info` |  | 주문서 입력정보 상세설정 > 주문 정보 order_form_input_type이 A일때 order_info 입력 불가 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `required` |  |  |
| ↳ `china_taiwan_id_input` |  | 중국/대만 신분증 ID 입력 T : 사용함 · F : 사용안함 |
| ↳ `print_type` |  | 인쇄버튼 타입 |
| ↳ ↳ `invoice_print` |  |  |
| ↳ ↳ `receipt_print` |  |  |
| ↳ ↳ `address_print` |  |  |
| ↳ `orderform_additional_enabled` |  | 주문서 추가항목 사용여부 T : 사용 · F : 사용안함 |

응답 예시 (JSON):

```json
{
    "orderform": {
        "shop_no": 1,
        "buy_limit_type": "M",
        "guest_purchase_button_display": "T",
        "junior_purchase_block": "F",
        "reservation_order": "F",
        "discount_amount_display": "T",
        "order_item_delete": "F",
        "quick_signup": "F",
        "check_order_info": "F",
        "order_form_input_type": "S",
        "shipping_info": [
            {
                "key": "phone",
                "use": "T",
                "required": "F"
            },
            {
                "key": "cellphone",
                "use": "T",
                "required": "F"
            }
        ],
        "order_info": [
            {
                "key": "phone",
                "use": "T",
                "required": "F"
            },
            {
                "key": "cellphone",
                "use": "T",
                "required": "F"
            }
        ],
        "china_taiwan_id_input": "F",
        "print_type": {
            "invoice_print": "T",
            "receipt_print": "F",
            "address_print": "F"
        },
        "orderform_additional_enabled": "T"
    }
}
```

### `PUT /api/v2/admin/orderform/setting` — Update the order/order form settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-the-order-order-form-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `buy_limit_type` |  |  |  | 구매 제한 M:회원만 구매 · A:모두 구매 가능 |
| `guest_purchase_button_display` |  |  |  | 비회원 구매버튼 노출 buy_limit_type를 M(회원만 구매)으로 선택 하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| `junior_purchase_block` |  |  |  | 14세 미만 구매 차단 buy_limit_type를 A(모두 구매 가능)으로 선택하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| `reservation_order` |  |  |  | 예약주문 T : 사용함 · F : 사용안함 |
| `discount_amount_display` |  |  |  | 주문상품 할인금액 표시 T : 사용함 · F : 사용안함 |
| `order_item_delete` |  |  |  | 주문서 내 상품삭제 T : 사용함 · F : 사용안함 |
| `quick_signup` |  |  |  | 주문서 간단회원가입 T : 사용함 · F : 사용안함 |
| `check_order_info` |  |  |  | 주문서 입력정보 확인 T : 사용함 · F : 사용안함 |
| `order_form_input_type` |  |  |  | 주문서 입력정보 구성 A : 배송정보만 입력 · S : 주문/배송정보 개별입력 |
| `shipping_info` |  |  |  | 주문서 입력정보 상세설정 > 배송 정보 |
| ↳ `key` |  |  |  | 배송정보 설정항목키 · name(이름) · address(주소) · detail_address(상세주소) · phone(전화번호) · cellphone(휴대폰번호) · shipping_message(배송메시지) · email(이메일) : order_form_input_type이 S일때 입력 불가 |
| ↳ `use` |  |  |  | 배송정보 설정항목 사용여부 |
| ↳ `required` |  |  |  | 배송정보 설정항목 필수여부 |
| `order_info` |  |  |  | 주문서 입력정보 상세설정 > 주문 정보 order_form_input_type이 A일때 order_info 입력 불가 |
| ↳ `key` |  |  |  | 주문정보 설정항목키 · name(이름) · address(주소) · detail_address(상세주소) · phone(전화번호) · cellphone(휴대폰번호) · email(이메일) |
| ↳ `use` |  |  |  | 주문정보 설정항목 사용여부 |
| ↳ `required` |  |  |  | 주문정보 설정항목 필수여부 |
| `china_taiwan_id_input` |  |  |  | 중국/대만 신분증 ID 입력 T : 사용함 · F : 사용안함 |
| `print_type` |  |  |  | 인쇄버튼 타입 |
| ↳ `invoice_print` |  |  |  | 거래명세서 인쇄버튼 · T : 표시함 · F : 표시안함 |
| ↳ `receipt_print` |  |  |  | 매출전표 인쇄버튼 · T : 표시함 · F : 표시안함 |
| ↳ `address_print` |  |  |  | 수령지정보 인쇄버튼 · T : 표시함 · F : 표시안함 |
| `orderform_additional_enabled` |  |  |  | 주문서 추가항목 사용여부 T:사용 · F:사용안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `orderform` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `buy_limit_type` |  | 구매 제한 M:회원만 구매 · A:모두 구매 가능 |
| ↳ `guest_purchase_button_display` |  | 비회원 구매버튼 노출 buy_limit_type를 M(회원만 구매)으로 선택 하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| ↳ `junior_purchase_block` |  | 14세 미만 구매 차단 buy_limit_type를 A(모두 구매 가능)으로 선택하였을때만 설정 가능 T : 사용함 · F : 사용안함 |
| ↳ `reservation_order` |  | 예약주문 T : 사용함 · F : 사용안함 |
| ↳ `discount_amount_display` |  | 주문상품 할인금액 표시 T : 사용함 · F : 사용안함 |
| ↳ `order_item_delete` |  | 주문서 내 상품삭제 T : 사용함 · F : 사용안함 |
| ↳ `quick_signup` |  | 주문서 간단회원가입 T : 사용함 · F : 사용안함 |
| ↳ `check_order_info` |  | 주문서 입력정보 확인 T : 사용함 · F : 사용안함 |
| ↳ `order_form_input_type` |  | 주문서 입력정보 구성 A : 배송정보만 입력 · S : 주문/배송정보 개별입력 |
| ↳ `shipping_info` |  | 주문서 입력정보 상세설정 > 배송 정보 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `required` |  |  |
| ↳ `order_info` |  | 주문서 입력정보 상세설정 > 주문 정보 order_form_input_type이 A일때 order_info 입력 불가 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `required` |  |  |
| ↳ `china_taiwan_id_input` |  | 중국/대만 신분증 ID 입력 T : 사용함 · F : 사용안함 |
| ↳ `print_type` |  | 인쇄버튼 타입 |
| ↳ ↳ `invoice_print` |  |  |
| ↳ ↳ `receipt_print` |  |  |
| ↳ ↳ `address_print` |  |  |
| ↳ `orderform_additional_enabled` |  | 주문서 추가항목 사용여부 T : 사용 · F : 사용안함 |

응답 예시 (JSON):

```json
{
    "orderform": {
        "shop_no": 1,
        "buy_limit_type": "A",
        "guest_purchase_button_display": "T",
        "junior_purchase_block": "F",
        "reservation_order": "T",
        "discount_amount_display": "T",
        "order_item_delete": "T",
        "quick_signup": "T",
        "check_order_info": "T",
        "order_form_input_type": "S",
        "shipping_info": [
            {
                "key": "phone",
                "use": "T",
                "required": "F"
            },
            {
                "key": "cellphone",
                "use": "T",
                "required": "F"
            }
        ],
        "order_info": [
            {
                "key": "phone",
                "use": "T",
                "required": "F"
            },
            {
                "key": "cellphone",
                "use": "T",
                "required": "F"
            }
        ],
        "china_taiwan_id_input": "T",
        "print_type": {
            "invoice_print": "T",
            "receipt_print": "F",
            "address_print": "F"
        },
        "orderform_additional_enabled": "T"
    }
}
```
