---
resource: application
entity: databridge-logs
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#databridge-logs
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `logs` |  | (목록) |
| ↳ `log_id` |  | 로그 ID |
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
            "log_id": "zj5sMJEBRpZEwGZ0UOOC",
            "mall_id": "bestshop",
            "trace_id": "ebc26aa3-fe56-4810-bb6f-5dcbc6db8933",
            "requested_time": "2024-08-03T10:10:10+09:00",
            "request_endpoint": "https://api.linkd.kr/webhook/simplepay-order",
            "request_body": "{\"event_name\":\"create_order\",\"event_time\":\"2024-08-07T06:16:07+09:00\",\"event_data\":{\"mall_id\":\"bestshop\",\"shop_no\":1,\"member_id\":\"3456956195@k\",\"order_id\":\"20240807-0012613\",\"product_list\":[{\"product_no\":8991,\"variant_code\":\"P0000NHV00DL\",\"product_name\":\"[풀스택] NEW 에어스트 맨즈 아이스 슬랙스\",\"option_value\":\"사이즈=2XL (34~36), 색상=[MMSPT-08CHA] 숏 차콜그레이\",\"cate_no\":2088,\"cate_name\":\"맨즈 - 하의\",\"quantity\":1,\"product_price\":\"72000.00\",\"option_extra_price\":\"0.00\"},{\"product_no\":7288,\"variant_code\":\"P0000KUI00BR\",\"product_name\":\"에어윈드 맨즈 조거팬츠\",\"option_value\":\"색상=[MLSJT-06BEG] 모카베이지, 사이즈=2XL (34~36)\",\"cate_no\":2088,\"cate_name\":\"맨즈 - 하의\",\"quantity\":1,\"product_price\":\"59000.00\",\"option_extra_price\":\"0.00\"},{\"product_no\":11682,\"variant_code\":\"P0000RHI000C\",\"product_name\":\"[사은품] 에어프레시 크루 삭스 1개 (쿠폰 선택 시 재선택 필요)\",\"option_value\":\"사이즈=L (255~280mm), 색상=화이트\",\"cate_no\":-3,\"cate_name\":null,\"quantity\":1,\"product_price\":\"0.00\",\"option_extra_price\":\"0.00\"}],\"payment_method\":\"card\",\"is_paid\":\"T\",\"order_date\":\"2024-08-07T06:16:07+09:00\",\"pay_date\":\"2024-08-07T06:16:07+09:00\",\"first_order\":\"F\",\"regularpays\":\"F\",\"currency\":\"KRW\",\"payment_amount\":\"124450.00\",\"points_spent_amount\":\"0.00\",\"credits_spent_amount\":\"0.00\",\"shipping_fee\":\"0.00\"},\"analytics_data\":{\"event_source_url\":\"https://m.andar.co.kr/order/orderform.html?basket_type=all_buy&delvtype=A\",\"client_user_agent\":\"Mozilla/5.0 (Linux; Android 14; SM-F721N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.0.0 Whale/1.0.0.0 Crosswalk/28.114.0.23 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.7.1)\",\"CVID\":\"CVID.505c50554a05016602.1722976985702\",\"CVID_Y\":\"CVID_Y.505c50554a05016602.1705717224905\",\"CVID_AD\":\"1722976985702.naverDA\",\"CVID_E\":null}}",
            "success": "T",
            "response_http_code": "200",
            "response_body": "Message received okay."
        },
        {
            "log_id": "dV7Ur3oBsq3B53njJIbP",
            "mall_id": "bestshop",
            "trace_id": "ebc26aa3-fe56-4810-bb6f-5dcbc6db8933",
            "requested_time": "2024-08-03T10:10:10+09:00",
            "request_endpoint": "https://api.linkd.kr/webhook/simplepay-order",
            "request_body": "{\"event_name\":\"create_order\",\"event_time\":\"2024-08-07T06:16:07+09:00\",\"event_data\":{\"mall_id\":\"bestshop\",\"shop_no\":1,\"member_id\":\"3456956195@k\",\"order_id\":\"20240807-0012613\",\"product_list\":[{\"product_no\":8991,\"variant_code\":\"P0000NHV00DL\",\"product_name\":\"[풀스택] NEW 에어스트 맨즈 아이스 슬랙스\",\"option_value\":\"사이즈=2XL (34~36), 색상=[MMSPT-08CHA] 숏 차콜그레이\",\"cate_no\":2088,\"cate_name\":\"맨즈 - 하의\",\"quantity\":1,\"product_price\":\"72000.00\",\"option_extra_price\":\"0.00\"},{\"product_no\":7288,\"variant_code\":\"P0000KUI00BR\",\"product_name\":\"에어윈드 맨즈 조거팬츠\",\"option_value\":\"색상=[MLSJT-06BEG] 모카베이지, 사이즈=2XL (34~36)\",\"cate_no\":2088,\"cate_name\":\"맨즈 - 하의\",\"quantity\":1,\"product_price\":\"59000.00\",\"option_extra_price\":\"0.00\"},{\"product_no\":11682,\"variant_code\":\"P0000RHI000C\",\"product_name\":\"[사은품] 에어프레시 크루 삭스 1개 (쿠폰 선택 시 재선택 필요)\",\"option_value\":\"사이즈=L (255~280mm), 색상=화이트\",\"cate_no\":-3,\"cate_name\":null,\"quantity\":1,\"product_price\":\"0.00\",\"option_extra_price\":\"0.00\"}],\"payment_method\":\"card\",\"is_paid\":\"T\",\"order_date\":\"2024-08-07T06:16:07+09:00\",\"pay_date\":\"2024-08-07T06:16:07+09:00\",\"first_order\":\"F\",\"regularpays\":\"F\",\"currency\":\"KRW\",\"payment_amount\":\"124450.00\",\"points_spent_amount\":\"0.00\",\"credits_spent_amount\":\"0.00\",\"shipping_fee\":\"0.00\"},\"analytics_data\":{\"event_source_url\":\"https://m.andar.co.kr/order/orderform.html?basket_type=all_buy&delvtype=A\",\"client_user_agent\":\"Mozilla/5.0 (Linux; Android 14; SM-F721N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.0.0 Whale/1.0.0.0 Crosswalk/28.114.0.23 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.7.1)\",\"CVID\":\"CVID.505c50554a05016602.1722976985702\",\"CVID_Y\":\"CVID_Y.505c50554a05016602.1705717224905\",\"CVID_AD\":\"1722976985702.naverDA\",\"CVID_E\":null}}",
            "success": "F",
            "response_http_code": "404",
            "response_body": "{\"success\":false,\"error\":{\"message\" : \"\"\"Token \"4f735d6b-f18f-4eaf-969b-04f494ae29c0\" not found\"\"\",\"id\":null}}"
        }
    ]
}
```
