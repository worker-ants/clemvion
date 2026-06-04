---
resource: store
entity: paymentgateway
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#paymentgateway
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Paymentgateway

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Paymentgateway](https://developers.cafe24.com/docs/ko/api/admin/#paymentgateway)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

PG(Paymentgateway)를 통해 PG앱의 조회, 등록, 수정, 삭제가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `partner_id` |  | PG사 발급 가맹점 ID |
| `client_id` |  | 앱 클라이언트 ID |
| `additional_information` |  | 추가 정보 |
| `membership_fee_type` |  | 가입비 분류 PRE : 선불 · PAD : 후불 · FREE : 무료 |
| `service_limit_type` |  | 서비스 제한 A : 회원/비회원 제한 없음 · M : 회원만 제공 |
| `review_status` |  | 심사상태 AWAITING_PAYMENT : 결제대기 · PENDING_REVIEW : 심사대기 · APPROVED : 심사완료 |
| `review_date` |  | 심사일자 |

## Operations

### `POST /api/v2/admin/paymentgateway` — Create a Payment Gateway

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `partner_id` | ✓ | 최대글자수 : [50자] |  | PG사 발급 가맹점 ID |
| `additional_information` |  | 배열 최대사이즈: [5] |  | 추가 정보 |
| ↳ `key` |  |  |  | 추가항목 키 |
| ↳ `value` |  |  |  | 추가항목 값 |
| `membership_fee_type` |  | 최대글자수 : [4자] |  | 가입비 분류 PRE : 선불 · PAD : 후불 · FREE : 무료 |
| `service_limit_type` |  | 최대글자수 : [1자] | A | 서비스 제한 A : 회원/비회원 제한 없음 · M : 회원만 제공 |
| `review_status` |  |  | AWAITING_PAYMENT | 심사상태 AWAITING_PAYMENT : 결제대기 · PENDING_REVIEW : 심사대기 · APPROVED : 심사완료 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `paymentgateway` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `partner_id` |  | PG사 발급 가맹점 ID |
| ↳ `client_id` |  | 앱 클라이언트 ID |
| ↳ `additional_information` |  | 추가 정보 |
| ↳ ↳ `key` |  | 추가항목 키 |
| ↳ ↳ `value` |  | 추가항목 값 |
| ↳ `membership_fee_type` |  | 가입비 분류 PRE : 선불 · PAD : 후불 · FREE : 무료 |
| ↳ `service_limit_type` |  | 서비스 제한 A : 회원/비회원 제한 없음 · M : 회원만 제공 |
| ↳ `review_status` |  | 심사상태 AWAITING_PAYMENT : 결제대기 · PENDING_REVIEW : 심사대기 · APPROVED : 심사완료 |
| ↳ `review_date` |  | 심사일자 |

응답 예시 (JSON):

```json
{
    "paymentgateway": {
        "shop_no": 1,
        "partner_id": "partner1",
        "client_id": "t9v2be4eYDif11NVvHbSsG",
        "additional_information": [
            {
                "key": "version",
                "value": "s1.6"
            },
            {
                "key": "hash_code",
                "value": "aXKB4Pe"
            }
        ],
        "membership_fee_type": "FREE",
        "service_limit_type": "A",
        "review_status": "AWAITING_PAYMENT",
        "review_date": "2025-04-23 10:00:00"
    }
}
```

### `PUT /api/v2/admin/paymentgateway/{client_id}` — Update a Payment Gateway

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-gateway

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `client_id` | ✓ | 최대글자수 : [50자] |  | 앱 클라이언트 ID |
| `partner_id` |  | 최대글자수 : [50자] |  | PG사 발급 가맹점 ID |
| `additional_information` |  | 배열 최대사이즈: [5] |  | 추가 정보 |
| ↳ `key` |  |  |  | 추가항목 키 |
| ↳ `value` |  |  |  | 추가항목 값 |
| `membership_fee_type` |  | 최대글자수 : [4자] |  | 가입비 분류 PRE : 선불 · PAD : 후불 · FREE : 무료 |
| `service_limit_type` |  | 최대글자수 : [1자] | A | 서비스 제한 A : 회원/비회원 제한 없음 · M : 회원만 제공 |
| `review_status` |  |  |  | 심사상태 AWAITING_PAYMENT : 결제대기 · PENDING_REVIEW : 심사대기 · APPROVED : 심사완료 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `paymentgateway` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `partner_id` |  | PG사 발급 가맹점 ID |
| ↳ `client_id` |  | 앱 클라이언트 ID |
| ↳ `additional_information` |  | 추가 정보 |
| ↳ ↳ `key` |  | 추가항목 키 |
| ↳ ↳ `value` |  | 추가항목 값 |
| ↳ `membership_fee_type` |  | 가입비 분류 PRE : 선불 · PAD : 후불 · FREE : 무료 |
| ↳ `service_limit_type` |  | 서비스 제한 A : 회원/비회원 제한 없음 · M : 회원만 제공 |
| ↳ `review_status` |  | 심사상태 AWAITING_PAYMENT : 결제대기 · PENDING_REVIEW : 심사대기 · APPROVED : 심사완료 |
| ↳ `review_date` |  | 심사일자 |

응답 예시 (JSON):

```json
{
    "paymentgateway": {
        "shop_no": 1,
        "partner_id": "partner1",
        "client_id": "t9v2be4eYDif11NVvHbSsG",
        "additional_information": [
            {
                "key": "version",
                "value": "s1.6"
            },
            {
                "key": "hash_code",
                "value": "aXKB4Pe"
            }
        ],
        "membership_fee_type": "FREE",
        "service_limit_type": "A",
        "review_status": "PENDING_REVIEW",
        "review_date": "2025-04-23 10:00:00"
    }
}
```

### `DELETE /api/v2/admin/paymentgateway/{client_id}` — Delete a Payment Gateway

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-gateway

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `client_id` | ✓ | 최대글자수 : [50자] |  | 앱 클라이언트 ID |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `paymentgateway` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `client_id` |  | 앱 클라이언트 ID |

응답 예시 (JSON):

```json
{
    "paymentgateway": {
        "shop_no": 1,
        "client_id": "t9v2be4eYDif11NVvHbSsG"
    }
}
```
