---
resource: notification
entity: sms-receivers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#sms-receivers
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Notification / Sms receivers

> Field-level 카탈로그. Endpoint enumeration index: [`../notification.md`](../notification.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Sms receivers](https://developers.cafe24.com/docs/ko/api/admin/#sms-receivers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

수신자 등록 여부에 따라 운영자, 부운영자, 공급사의 알람 메시지 발송 여부를 확인할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `no` |  | 번호 |
| `recipient_type` |  | 수신자 구분 |
| `supplier_name` |  | 공급사명 |
| `supplier_id` |  | 공급사 아이디 |
| `user_name` |  | 운영자명 |
| `user_id` |  | 운영자 아이디 |
| `manager_name` |  | 담당자명 |
| `cellphone` |  | 휴대전화 |

## Operations

### `GET /api/v2/admin/sms/receivers` — Retrieve a SMS recipient

- **Scope**: `mall.read_notification` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sms-recipient

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `recipient_type` |  |  |  | 수신자 구분 ALL:전체 · S:공급사 · A:운영자 |
| `supplier_name` |  |  |  | 공급사명 |
| `supplier_id` |  |  |  | 공급사 아이디 |
| `user_name` |  |  |  | 운영자명 |
| `user_id` |  |  |  | 운영자 아이디 |
| `manager_name` |  |  |  | 담당자명 |
| `cellphone` |  | 모바일 |  | 휴대전화 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `receivers` |  | (목록) |
| ↳ `no` |  | 번호 |
| ↳ `recipient_type` |  | 수신자 구분 |
| ↳ `supplier_name` |  | 공급사명 |
| ↳ `supplier_id` |  | 공급사 아이디 |
| ↳ `user_name` |  | 운영자명 |
| ↳ `user_id` |  | 운영자 아이디 |
| ↳ `manager_name` |  | 담당자명 |
| ↳ `cellphone` |  | 휴대전화 |
| `links` |  | link |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "receivers": [
        {
            "no": 1,
            "recipient_type": "S",
            "supplier_name": "Oliver Johnson",
            "supplier_id": "supplier1",
            "user_name": null,
            "user_id": null,
            "manager_name": "James Anderson",
            "cellphone": "010-1234-5678"
        },
        {
            "no": 2,
            "recipient_type": "A",
            "supplier_name": null,
            "supplier_id": null,
            "user_name": "Henrry",
            "user_id": "admin1",
            "manager_name": "John Doe",
            "cellphone": "010-2345-6789"
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/sms/receivers?limit=10&offset=10"
        }
    ]
}
```
