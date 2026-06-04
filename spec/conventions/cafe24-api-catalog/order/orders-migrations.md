---
resource: order
entity: orders-migrations
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-migrations
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders migrations

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders migrations](https://developers.cafe24.com/docs/ko/api/admin/#orders-migrations)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

이전된 몰의 주문에 대한 주문정보를 등록, 조회, 수정, 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `order_date` |  | 주문일 |
| `member_id` |  | 회원아이디 |
| `payment_status` |  | 결제상태 |
| `order_status` |  | 주문상태 |
| `payed_amount` |  | 실결제금액 |
| `bank_code_name` |  | 입금자 은행명 |
| `bank_account_owner_name` |  | 예금주 |
| `payment_method` |  | 결제수단 코드 |
| `mileage_used` |  | 적립금사용금액 |
| `deposit_used` |  | 예치금사용금액 |
| `buyer` |  | 주문자정보 리소스 |
| `receivers` |  | 수령자정보 리소스 |
| `items` |  | 품주 리소스 |

## Operations

### `GET /api/v2/admin/orders/migrations` — Retrieve order from migrated store

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-from-migrated-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `start_date` |  | 날짜 |  | 검색 시작일 |
| `end_date` |  | 날짜 |  | 검색 종료일 |
| `order_id` |  |  |  | 주문번호 |
| `order_status` |  |  |  | 주문상태 |
| `payment_status` |  |  |  | 결제상태 |
| `buyer_name` |  |  |  | 주문자 이름 |
| `member_id` |  |  |  | 회원아이디 |
| `receiver_name` |  |  |  | 수령자명 |
| `buyer_cellphone` |  |  |  | 주문자 휴대 전화 |
| `buyer_phone` |  |  |  | 주문자 일반 전화 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |
| `order` |  |  | desc | 정렬 순서 asc : 순차정렬 · desc : 역순 정렬 |
| `sort` |  |  | order_date | 정렬 순서 값 order_date : 주문일 · paid_amount : 결제금액 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "migrations": [
        {
            "shop_no": 1,
            "order_id": "2024071112345678",
            "order_date": "2024-07-11T10:30:00+09:00",
            "member_id": "sampleuser1",
            "payment_status": "T",
            "order_status": "Payment Completed",
            "payed_amount": "40000.00",
            "bank_code_name": "KB Kookmin Bank",
            "bank_account_owner_name": "John Doe",
            "payment_method": "Card",
            "mileage_used": "0.00",
            "deposit_used": "0.00",
            "buyer": {
                "name": "buyer1",
                "zipcode": "12345",
                "address": "123-456, Sample Residence, 789, Sample-ro, Sample City, Sample-do, South Korea",
                "email": "buyer1@example.com",
                "phone": "010-1234-5678",
                "cellphone": "010-1234-5678",
                "message": "Sample Message1"
            },
            "receivers": {
                "name": "receiver1",
                "zipcode": "12345",
                "address": "123-456, Sample Residence, 789, Sample-ro, Sample City, Sample-do, South Korea",
                "email": "receiver1@example.com",
                "phone": "02-1234-5678",
                "cellphone": "010-1234-5678"
            },
            "items": [
                {
                    "order_item_code": "2024071112345678-01",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "10000.00",
                    "product_no": "1",
                    "product_name": "Sample Product 1",
                    "option": "Option 1",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "total_payed_amount": "10000.00"
                },
                {
                    "order_item_code": "2024071112345678-02",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "30000.00",
                    "product_no": "2",
                    "product_name": "Sample Product 2",
                    "option": "Option 2",
                    "quantity": 1,
                    "product_price": "30000.00",
                    "total_payed_amount": "30000.00"
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "2024071112345679",
            "order_date": "2024-07-11T11:00:00+09:00",
            "member_id": "sampleuser2",
            "payment_status": "T",
            "order_status": "In Transit",
            "payed_amount": "25000.00",
            "bank_code_name": "Shinhan Bank",
            "bank_account_owner_name": "Jane Smith",
            "payment_method": "PayPal",
            "mileage_used": "0.00",
            "deposit_used": "0.00",
            "buyer": {
                "name": "buyer1",
                "zipcode": "67890",
                "address": "456-789, Another Residence, 101, Another-ro, Another City, Another-do, South Korea",
                "email": "buyer2@example.com",
                "phone": "010-5678-1234",
                "cellphone": "010-5678-1234",
                "message": "Sample Message2"
            },
            "receivers": {
                "name": "receiver2",
                "zipcode": "67890",
                "address": "456-789, Another Residence, 101, Another-ro, Another City, Another-do, South Korea",
                "email": "receiver2@example.com",
                "phone": "02-5678-1234",
                "cellphone": "010-5678-1234"
            },
            "items": [
                {
                    "order_item_code": "2024071112345679-01",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "15000.00",
                    "product_no": "3",
                    "product_name": "Sample Product 3",
                    "option": "Option A",
                    "quantity": 3,
                    "product_price": "5000.00",
                    "total_payed_amount": "15000.00"
                },
                {
                    "order_item_code": "2024071112345679-02",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "10000.00",
                    "product_no": "4",
                    "product_name": "Sample Product 4",
                    "option": "Option B",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "total_payed_amount": "10000.00"
                }
            ]
        }
    ]
}
```

### `POST /api/v2/admin/orders/migrations` — Create order from migrated store

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-order-from-migrated-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 최대글자수 : [32자] |  | 주문번호 |
| `order_date` |  | 날짜 |  | 주문일 |
| `member_id` |  | 최대글자수 : [32자] |  | 회원아이디 |
| `mileage_used` |  | 최소값: [0]; 최대값: [99999999999999] |  | 적립금사용금액 |
| `deposit_used` |  | 최소값: [0]; 최대값: [99999999999999] |  | 예치금사용금액 |
| `payment_status` |  |  | F | 결제상태 T : 결제 · F : 미결제 |
| `order_status` |  | 최대글자수 : [20자] |  | 주문상태 |
| `payed_amount` |  | 최소값: [0]; 최대값: [99999999999999] |  | 실결제금액 |
| `bank_code_name` |  | 최대글자수 : [64자] |  | 입금자 은행명 |
| `bank_account_owner_name` |  | 최대글자수 : [32자] |  | 예금주 |
| `payment_method` |  | 최대글자수 : [10자] |  | 결제수단 코드 |
| `buyer` |  |  |  | 주문자정보 리소스 |
| ↳ `name` |  |  |  | 주문자 이름 |
| ↳ `zipcode` |  |  |  | 주문자 우편번호 |
| ↳ `address` |  |  |  | 주문자 기본 주소 |
| ↳ `email` |  |  |  | 주문자 이메일 |
| ↳ `phone` |  |  |  | 주문자 일반 전화 |
| ↳ `cellphone` |  |  |  | 주문자 휴대 전화 |
| ↳ `message` |  |  |  | 배송 메세지 |
| `receivers` |  |  |  | 수령자정보 리소스 |
| ↳ `name` |  |  |  | 수령자명 |
| ↳ `zipcode` |  |  |  | 수령자 우편번호 |
| ↳ `address` |  |  |  | 수령자 기본 주소 |
| ↳ `phone` |  |  |  | 수령자 일반 전화 |
| ↳ `cellphone` |  |  |  | 수령자 휴대 전화 |
| `items` |  |  |  | 품주 리소스 |
| ↳ `product_no` |  |  |  | 상품번호 |
| ↳ `product_name` |  |  |  | 상품명 |
| ↳ `option` |  |  |  | 상품 옵션 리소스 |
| ↳ `quantity` |  |  |  | 수량 |
| ↳ `product_price` |  |  |  | 상품 판매가 |
| ↳ `payment_status` |  |  |  | 결제상태 · T : 결제 · F : 미결제 |
| ↳ `order_status` |  |  |  | 주문상태 |
| ↳ `payed_amount` |  |  |  | 상품구매금액 |
| ↳ `total_payed_amount` |  |  |  | 품목별 실결제금액 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "migrations": [
        {
            "shop_no": 1,
            "order_id": "2024071112345678",
            "order_date": "2024-07-11T10:30:00+09:00",
            "member_id": "sampleuser1",
            "payment_status": "T",
            "order_status": "Payment Completed",
            "payed_amount": "40000.00",
            "bank_code_name": "KB Kookmin Bank",
            "bank_account_owner_name": "John Doe",
            "payment_method": "Card",
            "mileage_used": "100.00",
            "deposit_used": "100.00",
            "buyer": {
                "name": "buyer1",
                "zipcode": "12345",
                "address": "123-456, Sample Residence, 789, Sample-ro, Sample City, Sample-do, South Korea",
                "email": "buyer1@example.com",
                "phone": "010-1234-5678",
                "cellphone": "010-1234-5678",
                "message": "Sample Message1"
            },
            "receivers": {
                "name": "receiver1",
                "zipcode": "12345",
                "address": "123-456, Sample Residence, 789, Sample-ro, Sample City, Sample-do, South Korea",
                "email": "receiver1@example.com",
                "phone": "02-1234-5678",
                "cellphone": "010-1234-5678"
            },
            "items": [
                {
                    "order_item_code": "2024071112345678-01",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "10000.00",
                    "product_no": "1",
                    "product_name": "Sample Product 1",
                    "option": "Option 1",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "total_payed_amount": "10000.00"
                },
                {
                    "order_item_code": "2024071112345678-02",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "30000.00",
                    "product_no": "2",
                    "product_name": "Sample Product 2",
                    "option": "Option 2",
                    "quantity": 1,
                    "product_price": "30000.00",
                    "total_payed_amount": "30000.00"
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "2024071112345679",
            "order_date": "2024-07-11T11:00:00+09:00",
            "member_id": "sampleuser2",
            "payment_status": "T",
            "order_status": "In Transit",
            "payed_amount": "25000.00",
            "bank_code_name": "Shinhan Bank",
            "bank_account_owner_name": "Jane Smith",
            "payment_method": "PayPal",
            "mileage_used": "100.00",
            "deposit_used": "100.00",
            "buyer": {
                "name": "buyer2",
                "zipcode": "67890",
                "address": "456-789, Another Residence, 101, Another-ro, Another City, Another-do, South Korea",
                "email": "buyer2@example.com",
                "phone": "010-5678-1234",
                "cellphone": "010-5678-1234",
                "message": "Sample Message2"
            },
            "receivers": {
                "name": "receiver2",
                "zipcode": "67890",
                "address": "456-789, Another Residence, 101, Another-ro, Another City, Another-do, South Korea",
                "email": "receiver2@example.com",
                "phone": "02-5678-1234",
                "cellphone": "010-5678-1234"
            },
            "items": [
                {
                    "order_item_code": "2024071112345679-01",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "15000.00",
                    "product_no": "3",
                    "product_name": "Sample Product 3",
                    "option": "Option A",
                    "quantity": 3,
                    "product_price": "5000.00",
                    "total_payed_amount": "15000.00"
                },
                {
                    "order_item_code": "2024071112345679-02",
                    "payment_status": "T",
                    "order_status": "Shipping",
                    "payed_amount": "10000.00",
                    "product_no": "4",
                    "product_name": "Sample Product 4",
                    "option": "Option B",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "total_payed_amount": "10000.00"
                }
            ]
        }
    ]
}
```

### `PUT /api/v2/admin/orders/migrations` — Update order from migrated store

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-order-from-migrated-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 최대글자수 : [32자] |  | 주문번호 |
| `order_date` |  | 날짜 |  | 주문일 |
| `member_id` |  | 최대글자수 : [32자] |  | 회원아이디 |
| `mileage_used` |  | 최소값: [0]; 최대값: [99999999999999] |  | 적립금사용금액 |
| `deposit_used` |  | 최소값: [0]; 최대값: [99999999999999] |  | 예치금사용금액 |
| `payment_status` |  |  |  | 결제상태 T : 결제 · F : 미결제 |
| `order_status` |  | 최대글자수 : [20자] |  | 주문상태 |
| `payed_amount` |  | 최소값: [0]; 최대값: [99999999999999] |  | 실결제금액 |
| `bank_code_name` |  | 최대글자수 : [64자] |  | 입금자 은행명 |
| `bank_account_owner_name` |  | 최대글자수 : [32자] |  | 예금주 |
| `payment_method` |  | 최대글자수 : [10자] |  | 결제수단 코드 |
| `buyer` |  |  |  | 주문자정보 리소스 |
| ↳ `name` |  |  |  | 주문자 이름 |
| ↳ `zipcode` |  |  |  | 주문자 우편번호 |
| ↳ `address` |  |  |  | 주문자 기본 주소 |
| ↳ `email` |  |  |  | 주문자 이메일 |
| ↳ `phone` |  |  |  | 주문자 일반 전화 |
| ↳ `cellphone` |  |  |  | 주문자 휴대 전화 |
| ↳ `message` |  |  |  | 배송 메세지 |
| `receivers` |  |  |  | 수령자정보 리소스 |
| ↳ `name` |  |  |  | 수령자명 |
| ↳ `zipcode` |  |  |  | 수령자 우편번호 |
| ↳ `address` |  |  |  | 수령자 기본 주소 |
| ↳ `phone` |  |  |  | 수령자 일반 전화 |
| ↳ `cellphone` |  |  |  | 수령자 휴대 전화 |
| `items` |  |  |  | 품주 리소스 |
| ↳ `order_item_code` |  |  |  | 품주코드 |
| ↳ `product_no` |  |  |  | 상품번호 |
| ↳ `product_name` |  |  |  | 상품명 |
| ↳ `option` |  |  |  | 상품 옵션 리소스 |
| ↳ `quantity` |  |  |  | 수량 |
| ↳ `product_price` |  |  |  | 상품 판매가 |
| ↳ `payment_status` |  |  |  | 결제상태 · T : 결제 · F : 미결제 |
| ↳ `order_status` |  |  |  | 주문상태 |
| ↳ `payed_amount` |  |  |  | 상품구매금액 |
| ↳ `total_payed_amount` |  |  |  | 품목별 실결제금액 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "migrations": [
        {
            "shop_no": 1,
            "order_id": "2024071112345678",
            "order_date": "2024-07-11T10:30:00+09:00",
            "member_id": "sampleuser1",
            "payment_status": "T",
            "order_status": "Payment Completed",
            "payed_amount": "40000.00",
            "bank_code_name": null,
            "bank_account_owner_name": null,
            "payment_method": "Card",
            "mileage_used": "0.00",
            "deposit_used": "0.00",
            "buyer": {
                "name": "buyer1",
                "zipcode": "12345",
                "address": "123-456, Sample Residence, 789, Sample-ro, Sample City, Sample-do, South Korea",
                "email": "buyer1@example.com",
                "phone": "010-1234-5678",
                "cellphone": "010-1234-5678",
                "message": "Sample Message1"
            },
            "receivers": {
                "name": "receiver1",
                "zipcode": "12345",
                "address": "123-456, Sample Residence, 789, Sample-ro, Sample City, Sample-do, South Korea",
                "email": "receiver1@example.com",
                "phone": "02-1234-5678",
                "cellphone": "010-1234-5678"
            },
            "items": [
                {
                    "order_item_code": "2024071112345678-01",
                    "payment_status": "T",
                    "order_status": "Payment Completed",
                    "payed_amount": "10000.00",
                    "product_no": "1",
                    "product_name": "Sample Product 1",
                    "option": "Option 1",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "total_payed_amount": "10000.00"
                },
                {
                    "order_item_code": "2024071112345678-02",
                    "payment_status": "T",
                    "order_status": "Payment Completed",
                    "payed_amount": "30000.00",
                    "product_no": "2",
                    "product_name": "Sample Product 2",
                    "option": "Option 2",
                    "quantity": 1,
                    "product_price": "30000.00",
                    "total_payed_amount": "30000.00"
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "2024071112345679",
            "order_date": "2024-07-11T11:00:00+09:00",
            "member_id": "sampleuser2",
            "payment_status": "T",
            "order_status": "In Transit",
            "payed_amount": "25000.00",
            "bank_code_name": "Shinhan Bank",
            "bank_account_owner_name": "Jane Smith",
            "payment_method": "Cash",
            "mileage_used": "0.00",
            "deposit_used": "0.00",
            "buyer": {
                "name": "buyer2",
                "zipcode": "67890",
                "address": "456-789, Another Residence, 101, Another-ro, Another City, Another-do, South Korea",
                "email": "buyer2@example.com",
                "phone": "010-5678-1234",
                "cellphone": "010-5678-1234",
                "message": "Sample Message2"
            },
            "receivers": {
                "name": "receiver2",
                "zipcode": "67890",
                "address": "456-789, Another Residence, 101, Another-ro, Another City, Another-do, South Korea",
                "email": "receiver2@example.com",
                "phone": "02-5678-1234",
                "cellphone": "010-5678-1234"
            },
            "items": [
                {
                    "order_item_code": "2024071112345679-01",
                    "payment_status": "T",
                    "order_status": "In Transit",
                    "payed_amount": "15000.00",
                    "product_no": "3",
                    "product_name": "Sample Product 3",
                    "option": "Option A",
                    "quantity": 3,
                    "product_price": "5000.00",
                    "total_payed_amount": "15000.00"
                },
                {
                    "order_item_code": "2024071112345679-02",
                    "payment_status": "T",
                    "order_status": "In Transit",
                    "payed_amount": "10000.00",
                    "product_no": "4",
                    "product_name": "Sample Product 4",
                    "option": "Option B",
                    "quantity": 2,
                    "product_price": "5000.00",
                    "total_payed_amount": "10000.00"
                }
            ]
        }
    ]
}
```

### `DELETE /api/v2/admin/orders/migrations/{order_id}` — Delete order from migrated store

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-order-from-migrated-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 최대글자수 : [32자] |  | 주문번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "migration": {
        "shop_no": 1,
        "order_id": "2024071112345678"
    }
}
```
