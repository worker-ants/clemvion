---
resource: notification
entity: sms
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#sms
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Notification / Sms

> Field-level 카탈로그. Endpoint enumeration index: [`../notification.md`](../notification.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Sms](https://developers.cafe24.com/docs/ko/api/admin/#sms)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

SMS를 통해 회원 혹은 특정 휴대전화 번호로 SMS메시지를 발송할 수 있습니다. · SMS API를 사용하기 위해서는 먼저 쇼핑몰에서 SMS 발송 서비스를 사용하고 있는지 확인이 필요합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `queue_code` |  | 큐 코드 |

## Operations

### `POST /api/v2/admin/sms` — Send a SMS

- **Scope**: `mall.write_notification` (write)
- **호출건수 제한**: 1
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#send-a-sms

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `sender_no` | ✓ |  |  | 발신자 아이디 발신자의 고유한 일련번호 |
| `content` | ✓ |  |  | 메시지 |
| `recipients` |  | 배열 최대사이즈: [100] |  | 수신자 전화번호 |
| `member_id` |  | 배열 최대사이즈: [100] |  | 회원아이디 |
| `group_no` |  |  |  | 회원등급번호 0 : 전체 등급 |
| `exclude_unsubscriber` |  |  | T | 수신거부자 제외 발송 여부 수신거부자를 제외하고 발송할지 여부를 설정할 수 있음. T : 제외 · F : 포함 |
| `type` |  |  | SMS | 발송 타입 SMS 의 발송 타입. · SMS 는 1건당 최대 90byte 까지 입력 가능하고 90byte 초과 시 여러 개로 나눠서 발송한다. · LMS 는 1건당 최대 2000byte 까지 입력 가능하다. SMS : 단문 · LMS : 장문 |
| `title` |  |  |  | 제목 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "sms": {
        "queue_code": "Q1810191529096VAeUD"
    }
}
```
