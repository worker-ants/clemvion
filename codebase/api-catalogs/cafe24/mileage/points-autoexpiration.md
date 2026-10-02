---
resource: mileage
entity: points-autoexpiration
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#points-autoexpiration
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Mileage / Points autoexpiration

> Field-level 카탈로그. Endpoint enumeration index: [`../mileage.md`](../mileage.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Points autoexpiration](https://developers.cafe24.com/docs/ko/api/admin/#points-autoexpiration)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

포인트 자동만료(Points autoexpiration)는 포인트를 자동으로 만료시키는 것과 관련된 기능입니다. · 자동만료 설정을 조회하거나 등록 및 삭제가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `expiration_date` |  | 최초 소멸 시행일 |
| `interval_month` |  | 소멸 실행 주기 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 1년 |
| `target_period_month` |  | 소멸 대상 적립금 6: 소멸일 기준 6개월 이전 적립금 · 12: 소멸일 기준 1년 이전 적립금 · 18: 소멸일 기준 1년 6개월 이전 적립금 · 24: 소멸일 기준 2년 이전 적립금 · 30: 소멸일 기준 2년 6개월 이전 적립금 · 36: 소멸일 기준 3년 이전 적립금 |
| `group_no` |  | 소멸 대상 회원등급 0: 전체 회원 |
| `standard_point` |  | 소멸 대상 기준 금액 |
| `send_email` |  | 이메일 발송 T: 설정함 · F: 설정안함 |
| `send_sms` |  | SMS 발송 T: 설정함 · F: 설정안함 |
| `notification_time_day` |  | 알람시기 선택 3: 3일 전 발송 · 7: 7일 전 발송 · 15: 15일 전 발송 · 30: 1개월 전 발송 |

## Operations

### `GET /api/v2/admin/points/autoexpiration` — Retrieve an automatic points expiration

- **Scope**: `mall.read_mileage` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-automatic-points-expiration

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `autoexpiration` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `expiration_date` |  | 최초 소멸 시행일 |
| ↳ `interval_month` |  | 소멸 실행 주기 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 1년 |
| ↳ `target_period_month` |  | 소멸 대상 적립금 6: 소멸일 기준 6개월 이전 적립금 · 12: 소멸일 기준 1년 이전 적립금 · 18: 소멸일 기준 1년 6개월 이전 적립금 · 24: 소멸일 기준 2년 이전 적립금 · 30: 소멸일 기준 2년 6개월 이전 적립금 · 36: 소멸일 기준 3년 이전 적립금 |
| ↳ `group_no` |  | 소멸 대상 회원등급 0: 전체 회원 |
| ↳ `standard_point` |  | 소멸 대상 기준 금액 |
| ↳ `send_email` |  | 이메일 발송 T: 설정함 · F: 설정안함 |
| ↳ `send_sms` |  | SMS 발송 T: 설정함 · F: 설정안함 |
| ↳ `notification_time_day` |  | 알람시기 선택 3: 3일 전 발송 · 7: 7일 전 발송 · 15: 15일 전 발송 · 30: 1개월 전 발송 |

응답 예시 (JSON):

```json
{
    "autoexpiration": {
        "shop_no": 1,
        "expiration_date": "2021-01-26",
        "interval_month": 1,
        "target_period_month": 12,
        "group_no": 0,
        "standard_point": "10.00",
        "send_email": "T",
        "send_sms": "F",
        "notification_time_day": [
            3,
            7
        ]
    }
}
```

### `POST /api/v2/admin/points/autoexpiration` — Create an automatic points expiration

- **Scope**: `mall.write_mileage` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-automatic-points-expiration

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `expiration_date` | ✓ | 날짜 |  | 최초 소멸 시행일 |
| `interval_month` | ✓ |  |  | 소멸 실행 주기 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 1년 |
| `target_period_month` | ✓ |  |  | 소멸 대상 적립금 6: 소멸일 기준 6개월 이전 적립금 · 12: 소멸일 기준 1년 이전 적립금 · 18: 소멸일 기준 1년 6개월 이전 적립금 · 24: 소멸일 기준 2년 이전 적립금 · 30: 소멸일 기준 2년 6개월 이전 적립금 · 36: 소멸일 기준 3년 이전 적립금 |
| `group_no` |  |  | 0 | 소멸 대상 회원등급 0: 전체 회원 |
| `standard_point` | ✓ | 최소값: [1] |  | 소멸 대상 기준 금액 소멸할 적립금의 최소 기준 금액 입력 · 예) 100 기재 시, 100원 이상 적립금 보유 회원만 소멸 대상 |
| `send_email` |  |  | F | 이메일 발송 T: 설정함 · F: 설정안함 |
| `send_sms` |  |  | F | SMS 발송 T: 설정함 · F: 설정안함 |
| `notification_time_day` |  |  |  | 알람시기 선택 3: 3일 전 발송 · 7: 7일 전 발송 · 15: 15일 전 발송 · 30: 1개월 전 발송 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `autoexpiration` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `expiration_date` |  | 최초 소멸 시행일 |
| ↳ `interval_month` |  | 소멸 실행 주기 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 1년 |
| ↳ `target_period_month` |  | 소멸 대상 적립금 6: 소멸일 기준 6개월 이전 적립금 · 12: 소멸일 기준 1년 이전 적립금 · 18: 소멸일 기준 1년 6개월 이전 적립금 · 24: 소멸일 기준 2년 이전 적립금 · 30: 소멸일 기준 2년 6개월 이전 적립금 · 36: 소멸일 기준 3년 이전 적립금 |
| ↳ `group_no` |  | 소멸 대상 회원등급 0: 전체 회원 |
| ↳ `standard_point` |  | 소멸 대상 기준 금액 |
| ↳ `send_email` |  | 이메일 발송 T: 설정함 · F: 설정안함 |
| ↳ `send_sms` |  | SMS 발송 T: 설정함 · F: 설정안함 |
| ↳ `notification_time_day` |  | 알람시기 선택 3: 3일 전 발송 · 7: 7일 전 발송 · 15: 15일 전 발송 · 30: 1개월 전 발송 |

응답 예시 (JSON):

```json
{
    "autoexpiration": {
        "shop_no": 1,
        "expiration_date": "2021-01-26",
        "interval_month": 1,
        "target_period_month": 12,
        "group_no": 0,
        "standard_point": "10.00",
        "send_email": "T",
        "send_sms": "F",
        "notification_time_day": [
            3,
            7
        ]
    }
}
```

### `DELETE /api/v2/admin/points/autoexpiration` — Delete an automatic points expiration

- **Scope**: `mall.write_mileage` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-an-automatic-points-expiration

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `autoexpiration` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |

응답 예시 (JSON):

```json
{
    "autoexpiration": {
        "shop_no": 1
    }
}
```
