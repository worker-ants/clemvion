---
resource: application
entity: webhooks-logs
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#webhooks-logs
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Application / Webhooks logs

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Webhooks logs](https://developers.cafe24.com/docs/ko/api/admin/#webhooks-logs)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

웹훅 로그(Webhooks logs)를 통해 앱에서 발생한 웹훅의 로그를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `log_id` |  | 로그 ID |
| `log_type` |  | 로그 종류 G : 일반 발송 · R : 재발송 · T : 테스트 발송 |
| `event_no` |  | 이벤트 번호 |
| `mall_id` |  | 쇼핑몰 ID |
| `trace_id` |  | Trace ID |
| `requested_time` |  | 전송일시 |
| `request_endpoint` |  | 요청 URL |
| `request_body` |  | 요청 내용 |
| `success` |  | 웹훅 발송 성공 여부 T : 성공 · F : 실패 |
| `response_http_code` |  | 응답 http code |
| `response_body` |  | 응답 내용 |

## Operations

### `GET /api/v2/admin/webhooks/logs` — Retrieve a list of webhook logs

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `event_no` |  |  |  | 이벤트 번호 |
| `requested_start_date` |  | 날짜 |  | 발송 시작일시 |
| `requested_end_date` |  | 날짜 |  | 발송 종료일시 |
| `success` |  |  |  | 웹훅 발송 성공 여부 T : 성공 · F : 실패 |
| `log_type` |  |  |  | 로그 종류 G : 일반 발송 · R : 재발송 · T : 테스트 발송 |
| `since_log_id` |  |  |  | 해당 로그 ID 이후 검색 |
| `limit` |  | 최소: [1]~최대: [10000] |  | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `logs` |  | (목록) |
| ↳ `log_id` |  | 로그 ID |
| ↳ `log_type` |  | 로그 종류 G : 일반 발송 · R : 재발송 · T : 테스트 발송 |
| ↳ `event_no` |  | 이벤트 번호 |
| ↳ `mall_id` |  | 쇼핑몰 ID |
| ↳ `trace_id` |  | Trace ID |
| ↳ `requested_time` |  | 전송일시 |
| ↳ `request_endpoint` |  | 요청 URL |
| ↳ `request_body` |  | 요청 내용 |
| ↳ `success` |  | 웹훅 발송 성공 여부 T : 성공 · F : 실패 |
| ↳ `response_http_code` |  | 응답 http code |
| ↳ `response_body` |  | 응답 내용 |

응답 예시 (JSON):

```json
{
    "logs": [
        {
            "log_id": "zV7Ur3oBsq3B53njmYm-",
            "log_type": "G",
            "event_no": 90001,
            "mall_id": "bestshop",
            "trace_id": "0d492786-ae82-4073-aa88-0991b08ee732",
            "requested_time": "2020-08-03T10:10:10+09:00",
            "request_endpoint": "https://app.com/webhooks/regist_product",
            "request_body": "{\"event_no\":90001,\"resource\":{\"mall_id\":\"cafe24bestshop\",\"event_shop_no\":\"1\",\"product_code\":\"P000CCAO\"}}",
            "success": "T",
            "response_http_code": null,
            "response_body": null
        },
        {
            "log_id": "dV7Ur3oBsq3B53njJIbP",
            "log_type": "G",
            "event_no": 90001,
            "mall_id": "bestshop",
            "trace_id": "518e78fd-e59e-45e4-8fe7-46620ea9b000",
            "requested_time": "2020-08-03T10:10:10+09:00",
            "request_endpoint": "https://app.com/webhooks/regist_product",
            "request_body": "{\"event_no\":90001,\"resource\":{\"mall_id\":\"cafe24bestshop\",\"event_shop_no\":\"1\",\"product_code\":\"P000CCAP\"}}",
            "success": "F",
            "response_http_code": 403,
            "response_body": "<html><head><title>403 Forbidden</title></head><body><center><h1>403 Forbidden</h1></center></body></html>"
        }
    ]
}
```
