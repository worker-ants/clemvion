---
resource: application
entity: databridge-logs
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#databridge-logs
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Application / Databridge logs

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Databridge logs](https://developers.cafe24.com/docs/ko/api/admin/#databridge-logs)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰의 전환추적 이벤트 웹훅 정보를 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `log_id` |  | 로그 ID |
| `mall_id` |  | 쇼핑몰 ID |
| `trace_id` |  | Trace ID |
| `requested_time` |  | 전송일시 |
| `request_endpoint` |  | 요청 URL |
| `request_body` |  | 요청 내용 |
| `success` |  | 웹훅 발송 성공 여부 T : 성공 · F : 실패 |
| `response_http_code` |  | 응답 http code |
| `response_body` |  | 응답 내용 |

## Operations

### `GET /api/v2/admin/databridge/logs` — Retrieve a list of Databridge webhook logs

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `requested_start_date` |  | 날짜 |  | 발송 시작일시 |
| `requested_end_date` |  | 날짜 |  | 발송 종료일시 |
| `success` |  |  |  | 웹훅 발송 성공 여부 T : 성공 · F : 실패 |
| `since_log_id` |  |  |  | 해당 로그 ID 이후 검색 |
| `limit` |  | 최소: [1]~최대: [10000] |  | 조회결과 최대건수 |
