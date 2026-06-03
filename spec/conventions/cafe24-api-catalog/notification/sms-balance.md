---
resource: notification
entity: sms-balance
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#sms-balance
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
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
