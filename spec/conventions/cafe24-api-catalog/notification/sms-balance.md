---
resource: notification
entity: sms-balance
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#sms-balance
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Notification / Sms balance

> Field-level 카탈로그. Endpoint enumeration index: [`../notification.md`](../notification.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Sms balance](https://developers.cafe24.com/docs/ko/api/admin/#sms-balance)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

문자발송건수는 장문, 단문발송건수에 대한 정보를 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `balance` |  | SMS 잔여 건수 |
| `sms_count` |  | 단문(SMS) 발송 가능 건수 |
| `lms_count` |  | 장문(LMS) 발송 가능 건수 |

## Operations

### `GET /api/v2/admin/sms/balance` — Retrieve the SMS balance

- **Scope**: `mall.read_notification` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-sms-balance

_요청 파라미터 없음._

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `sms` |  | (응답 객체) |
| ↳ `balance` |  | SMS 잔여 건수 |
| ↳ `sms_count` |  | 단문(SMS) 발송 가능 건수 |
| ↳ `lms_count` |  | 장문(LMS) 발송 가능 건수 |

응답 예시 (JSON):

```json
{
    "sms": {
        "balance": "10.3",
        "sms_count": 10,
        "lms_count": 3
    }
}
```
