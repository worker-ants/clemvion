---
resource: store
entity: automessages-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#automessages-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Automessages setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Automessages setting](https://developers.cafe24.com/docs/ko/api/admin/#automessages-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

자동메시지 설정(Automessages setting)은 메시지 자동 발송 시 사용 중인 발송 수단을 확인 및 어떤 발송 수단으로 우선발송할 지 조회, 변경하는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `use_sms` |  | SMS 사용 여부 T: 사용함 · F: 사용안함 |
| `use_kakaoalimtalk` |  | 카카오알림톡 사용 여부 T: 사용함 · F: 사용안함 |
| `use_push` |  | PUSH 사용 여부 T: 사용함 · F: 사용안함 |
| `send_method` |  | 자동 발송 메시지 발송 방법 S: SMS · K: 카카오알림톡(발송 실패 시 · SMS로 대체 발송) |
| `send_method_push` |  | 푸시 수신 대상에게 푸시 우선 발송 여부 T : 우선 발송함 · F : 우선 발송 안함 |

## Operations

### `GET /api/v2/admin/automessages/setting` — Retrieve the automated message settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-automated-message-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `automessages` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `use_sms` |  | SMS 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `use_kakaoalimtalk` |  | 카카오알림톡 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `use_push` |  | PUSH 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `send_method` |  | 자동 발송 메시지 발송 방법 S: SMS · K: 카카오알림톡(발송 실패 시 · SMS로 대체 발송) |
| ↳ `send_method_push` |  | 푸시 수신 대상에게 푸시 우선 발송 여부 T : 우선 발송함 · F : 우선 발송 안함 |

응답 예시 (JSON):

```json
{
    "automessages": {
        "shop_no": 1,
        "use_sms": "T",
        "use_kakaoalimtalk": "T",
        "use_push": "T",
        "send_method": "S",
        "send_method_push": "F"
    }
}
```

### `PUT /api/v2/admin/automessages/setting` — Update an automated message

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-automated-message

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `send_method` | ✓ |  |  | 자동 발송 메시지 발송 방법 S: SMS · K: 카카오알림톡(발송 실패 시 · SMS로 대체 발송) |
| `send_method_push` |  |  |  | 푸시 수신 대상에게 푸시 우선 발송 여부 Youtube shopping 이용 시에는 미제공 T : 우선 발송함 · F : 우선 발송 안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `automessages` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `send_method` |  | 자동 발송 메시지 발송 방법 S: SMS · K: 카카오알림톡(발송 실패 시 · SMS로 대체 발송) |
| ↳ `send_method_push` |  | 푸시 수신 대상에게 푸시 우선 발송 여부 T : 우선 발송함 · F : 우선 발송 안함 |

응답 예시 (JSON):

```json
{
    "automessages": {
        "shop_no": 1,
        "send_method": "S",
        "send_method_push": "F"
    }
}
```
