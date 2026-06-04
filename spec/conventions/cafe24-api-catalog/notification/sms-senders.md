---
resource: notification
entity: sms-senders
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#sms-senders
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Notification / Sms senders

> Field-level 카탈로그. Endpoint enumeration index: [`../notification.md`](../notification.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Sms senders](https://developers.cafe24.com/docs/ko/api/admin/#sms-senders)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

SMS 발신자(Sms senders)는 SMS를 발송할 발신번호를 나타냅니다. SMS 발신자의 발신번호는 반드시 본인인증이 되어있어야 합니다. · SMS 발신자는 SMS에 속해있는 하위 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `sender_no` |  | 발신자 아이디 발신자의 고유한 일련번호 |
| `sender` |  | 발신자 번호 발신자의 전화번호 |
| `auth_status` |  | 인증 상태 발신자의 전화번호의 인증 상태. · 인증완료 상태인 발신자로만 SMS 를 발송할 수 있다. 00 : 삭제 · 10 : 등록 · 20 : 심사중 · 30 : 인증완료 · 40 : 반려 |
| `memo` |  | 메모 request_reason: 요청 사유 · reject_reason: 반려 사유 |

## Operations

### `GET /api/v2/admin/sms/senders` — Retrieve a list of SMS senders

- **Scope**: `mall.read_notification` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sms-senders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `senders` |  | (목록) |
| ↳ `sender_no` |  | 발신자 아이디 발신자의 고유한 일련번호 |
| ↳ `sender` |  | 발신자 번호 발신자의 전화번호 |
| ↳ `auth_status` |  | 인증 상태 발신자의 전화번호의 인증 상태. · 인증완료 상태인 발신자로만 SMS 를 발송할 수 있다. 00 : 삭제 · 10 : 등록 · 20 : 심사중 · 30 : 인증완료 · 40 : 반려 |
| ↳ `memo` |  | 메모 request_reason: 요청 사유 · reject_reason: 반려 사유 |
| ↳ ↳ `request_reason` |  |  |
| ↳ ↳ `reject_reason` |  |  |

응답 예시 (JSON):

```json
{
    "senders": [
        {
            "sender_no": 3,
            "sender": "010-1234-5678",
            "auth_status": "30",
            "memo": {
                "request_reason": "This is a number for emergency sms.",
                "reject_reason": "Invalid phone number."
            }
        },
        {
            "sender_no": 2,
            "sender": "01012345678",
            "auth_status": "20",
            "memo": {
                "request_reason": "This is a number for regular sms.",
                "reject_reason": "Invalid request reason."
            }
        }
    ]
}
```
