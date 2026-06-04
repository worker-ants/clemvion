---
resource: store
entity: paymentgateway__paymentmethods
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#paymentgateway--paymentmethods
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Paymentgateway paymentmethods

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Paymentgateway paymentmethods](https://developers.cafe24.com/docs/ko/api/admin/#paymentgateway--paymentmethods)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

PG의 결제수단(Paymentgateway paymentmethods)은 쇼핑몰에 등록된 PG의 결제수단에 대한 기능입니다. · 특정 PG에서 제공하고 있는 결제수단의 등록, 조회, 수정, 삭제가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `client_id` |  | 앱 클라이언트 ID |
| `payment_method_code` |  | 결제수단 코드 |
| `payment_method` |  | 결제수단 card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · cell : 휴대폰 · cvs : 편의점 · deferpay : 후불결제 · etc : 기타 |
| `payment_method_name` |  | 결제수단명 |
| `payment_method_url` |  | 결제수단 이미지 경로 |
| `available_shop_no` |  | 이용가능한 멀티쇼핑몰 번호 |

## Operations

### `GET /api/v2/admin/paymentgateway/{client_id}/paymentmethods` — Retrieve a list of Payment Gateway methods

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-methods

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `client_id` | ✓ | 최대글자수 : [50자] |  | 앱 클라이언트 ID |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentmethods": [
        {
            "client_id": "t9v2be4eYDif11NVvHbSsG",
            "payment_method_code": "fd23rerewr45678",
            "payment_method": "tcash",
            "payment_method_name": "hello123",
            "payment_method_url": "http://img.cafe24.com/img/simplexi/common/h1_logo.png",
            "available_shop_no": "1,3"
        }
    ]
}
```

### `POST /api/v2/admin/paymentgateway/{client_id}/paymentmethods` — Create a Payment Gateway method

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway-method

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `client_id` | ✓ | 최대글자수 : [50자] |  | 앱 클라이언트 ID |
| `payment_method_code` | ✓ | 최대글자수 : [50자] |  | 결제수단 코드 |
| `payment_method` | ✓ |  |  | 결제수단 card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · cell : 휴대폰 · cvs : 편의점 · deferpay : 후불결제 · etc : 기타 |
| `payment_method_name` | ✓ | 최대글자수 : [50자] |  | 결제수단명 |
| `payment_method_url` | ✓ | 최대글자수 : [200자] |  | 결제수단 이미지 경로 지원 확장자 : 'png', 'jpg', 'jpeg' |
| `available_shop_no` |  |  |  | 이용가능한 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentmethod": {
        "client_id": "t9v2be4eYDif11NVvHbSsG",
        "payment_method_code": "fd23rerewr45678",
        "payment_method": "tcash",
        "payment_method_name": "hello123",
        "payment_method_url": "http://img.cafe24.com/img/simplexi/common/h1_logo.png",
        "available_shop_no": "1,3"
    }
}
```

### `PUT /api/v2/admin/paymentgateway/{client_id}/paymentmethods/{payment_method_code}` — Update a payment method of a Payment Gateway

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-method-of-a-payment-gateway

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `client_id` | ✓ | 최대글자수 : [50자] |  | 앱 클라이언트 ID |
| `payment_method_code` | ✓ | 최대글자수 : [50자] |  | 결제수단 코드 |
| `payment_method` |  |  |  | 결제수단 card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · cell : 휴대폰 · cvs : 편의점 · deferpay : 후불결제 · etc : 기타 |
| `payment_method_name` |  | 최대글자수 : [50자] |  | 결제수단명 |
| `payment_method_url` |  | 최대글자수 : [200자] |  | 결제수단 이미지 경로 지원 확장자 : 'png', 'jpg', 'jpeg' |
| `available_shop_no` |  |  |  | 이용가능한 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentmethod": {
        "client_id": "t9v2be4eYDif11NVvHbSsG",
        "payment_method_code": "fd23rerewr45678",
        "payment_method": "tcash",
        "payment_method_name": "hello123",
        "payment_method_url": "http://img.cafe24.com/img/simplexi/common/h1_logo.png",
        "available_shop_no": "1,3,4"
    }
}
```

### `DELETE /api/v2/admin/paymentgateway/{client_id}/paymentmethods/{payment_method_code}` — Delete a payment method of a Payment Gateway

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-method-of-a-payment-gateway

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `client_id` | ✓ | 최대글자수 : [50자] |  | 앱 클라이언트 ID |
| `payment_method_code` | ✓ | 최대글자수 : [50자] |  | 결제수단 코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentmethod": {
        "client_id": "t9v2be4eYDif11NVvHbSsG",
        "payment_method_code": "fd23rerewr45678"
    }
}
```
