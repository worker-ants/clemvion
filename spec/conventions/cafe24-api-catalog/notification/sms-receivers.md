---
resource: notification
entity: sms-receivers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#sms-receivers
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
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
