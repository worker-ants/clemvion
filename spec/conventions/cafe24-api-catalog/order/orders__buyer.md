---
resource: order
entity: orders__buyer
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--buyer
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders buyer

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders buyer](https://developers.cafe24.com/docs/ko/api/admin/#orders--buyer)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문자(Buyer)는 쇼핑몰의 상품을 주문한 사람을 나타냅니다. · 주문자 리소스를 통해 특정 주문의 주문자의 이름, 주소, 전화번호, 이메일 등의 정보를 조회하거나 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `member_id` |  | 회원아이디 |
| `member_group_no` |  | 주문당시 주문자 회원 등급 번호 |
| `name` |  | 주문자명 |
| `names_furigana` |  | 주문자 이름 후리가나 |
| `email` |  | 주문자 이메일 해당 회원의 이메일 |
| `phone` |  | 주문자 일반 전화 |
| `cellphone` |  | 주문자 휴대 전화 |
| `customer_notification` |  | 고객 알림 고객에게 알릴 문구 |
| `updated_date` |  | 수정일 |
| `user_id` |  | 주문자 수정자 ID 주문자정보를 수정한 사람의 ID |
| `user_name` |  | 주문자 수정자 명 주문자정보를 수정한 사람의 이름 |
| `company_name` |  | 상호명 |
| `company_registration_no` |  | 사업자등록번호 |
| `buyer_zipcode` |  | 주문자 우편번호 |
| `buyer_address1` |  | 주문자 기본주소 |
| `buyer_address2` |  | 주문자 상세주소 |
| `order_id` | 주문번호 | 주문번호 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/buyer` — Retrieve customer details of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-details-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `buyer` |  | 주문자정보 리소스 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `member_group_no` |  | 주문당시 주문자 회원 등급 번호 |
| ↳ `name` |  | 주문자명 |
| ↳ `names_furigana` |  | 주문자 이름 후리가나 |
| ↳ `email` |  | 주문자 이메일 해당 회원의 이메일 |
| ↳ `phone` |  | 주문자 일반 전화 |
| ↳ `cellphone` |  | 주문자 휴대 전화 |
| ↳ `customer_notification` |  | 고객 알림 고객에게 알릴 문구 |
| ↳ `updated_date` |  | 수정일 |
| ↳ `user_id` |  | 주문자 수정자 ID 주문자정보를 수정한 사람의 ID |
| ↳ `user_name` |  | 주문자 수정자 명 주문자정보를 수정한 사람의 이름 |
| ↳ `company_name` |  | 상호명 |
| ↳ `company_registration_no` |  | 사업자등록번호 |
| ↳ `buyer_zipcode` |  | 주문자 우편번호 |
| ↳ `buyer_address1` |  | 주문자 기본주소 |
| ↳ `buyer_address2` |  | 주문자 상세주소 |

응답 예시 (JSON):

```json
{
    "buyer": {
        "shop_no": 1,
        "member_id": "sampleid",
        "member_group_no": 1,
        "name": "Floyd Mayweather",
        "names_furigana": "John Doe",
        "email": "sample@gmail.com",
        "phone": "02-0000-0000",
        "cellphone": "010-0000-0000",
        "customer_notification": "Customer Notify Sample",
        "updated_date": "2018-09-03T17:20:49+09:00",
        "user_id": "sampleid",
        "user_name": "John Doe",
        "company_name": "sample business name",
        "company_registration_no": "123-45-67890",
        "buyer_zipcode": "01234",
        "buyer_address1": "sample street New York",
        "buyer_address2": "34"
    }
}
```

### `PUT /api/v2/admin/orders/{order_id}/buyer` — Update customer information of an order

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-customer-information-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `name` |  |  |  | 주문자명 |
| `email` |  | 이메일 |  | 주문자 이메일 해당 회원의 이메일 |
| `phone` |  |  |  | 주문자 일반 전화 |
| `cellphone` |  |  |  | 주문자 휴대 전화 |
| `customer_notification` |  |  |  | 고객 알림 고객에게 알릴 문구 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `buyer` |  | 주문자정보 리소스 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `order_id` | 주문번호 | 주문번호 |
| ↳ `name` |  | 주문자명 |
| ↳ `email` |  | 주문자 이메일 해당 회원의 이메일 |
| ↳ `phone` |  | 주문자 일반 전화 |
| ↳ `cellphone` |  | 주문자 휴대 전화 |
| ↳ `customer_notification` |  | 고객 알림 고객에게 알릴 문구 |

응답 예시 (JSON):

```json
{
    "buyer": {
        "shop_no": 1,
        "order_id": "20180903-0000243",
        "name": "Floyd Mayweather",
        "email": "sample@gmail.com",
        "phone": "02-0000-0000",
        "cellphone": "010-0000-0000",
        "customer_notification": "Customer Notify Sample"
    }
}
```
