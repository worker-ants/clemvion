---
resource: store
entity: dashboard
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#dashboard
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Dashboard

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Dashboard](https://developers.cafe24.com/docs/ko/api/admin/#dashboard)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

대시보드(Dashboard)는 쇼핑몰의 주문 현황과 매출 현황 등 쇼핑몰 운영에 필요한 정보를 간략하게 요약해놓은 정보입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `daily_sales_stats` |  | 일일 현황 정보 일 단위의 매출 현황 정보 |
| `weekly_sales_stats` |  | 주간 매출 현황 주간 단위의 매출 현황 정보 |
| `monthly_sales_stats` |  | 월간 매출 현황 월간 단위의 매출 현황 정보 |
| `sold_out_products_count` |  | 품절된 상품 수 품절된 상품의 수. 재고관리기능과 품절기능이 활성화 되어있을 경우 집계에 포함됨. |
| `new_members_count` |  | 신규회원 수 신규가입한 회원의 숫자 |
| `board_list` |  | 게시판 목록 해당 몰의 게시판의 리스트 |

## Operations

### `GET /api/v2/admin/dashboard` — Retrieve a dashboard

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-dashboard

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `dashboard` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `daily_sales_stats` |  | 일일 현황 정보 일 단위의 매출 현황 정보 |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `date` |  | 날짜 |
| ↳ ↳ `order_price` |  |  |
| ↳ ↳ `paid_price` |  |  |
| ↳ ↳ `refund_price` |  |  |
| ↳ ↳ `order_count` |  | 주문수 |
| ↳ ↳ `payed_count` |  |  |
| ↳ ↳ `refund_count` |  | 환불완료 수량 |
| ↳ ↳ `prepareproduct_count` |  |  |
| ↳ ↳ `prepare_count` |  |  |
| ↳ ↳ `standby_count` |  |  |
| ↳ ↳ `shipping_count` |  |  |
| ↳ ↳ `shipped_count` |  |  |
| ↳ ↳ `canceled_count` |  |  |
| ↳ ↳ `returned_count` |  |  |
| ↳ ↳ `exchanged_count` |  |  |
| ↳ ↳ `ordered_total_count` |  |  |
| ↳ `weekly_sales_stats` |  | 주간 매출 현황 주간 단위의 매출 현황 정보 |
| ↳ ↳ `ordered_total_price` |  |  |
| ↳ ↳ `payed_total_price` |  |  |
| ↳ ↳ `refunded_total_price` |  |  |
| ↳ ↳ `ordered_count` |  |  |
| ↳ ↳ `payed_count` |  |  |
| ↳ ↳ `refunded_count` |  |  |
| ↳ ↳ `ordered_average_total_price` |  |  |
| ↳ ↳ `payed_average_total_price` |  |  |
| ↳ ↳ `refunded_average_total_price` |  |  |
| ↳ ↳ `ordered_average_count` |  |  |
| ↳ ↳ `payed_average_count` |  |  |
| ↳ ↳ `refunded_average_count` |  |  |
| ↳ `monthly_sales_stats` |  | 월간 매출 현황 월간 단위의 매출 현황 정보 |
| ↳ ↳ `ordered_total_price` |  |  |
| ↳ ↳ `payed_total_price` |  |  |
| ↳ ↳ `refunded_total_price` |  |  |
| ↳ ↳ `ordered_count` |  |  |
| ↳ ↳ `payed_count` |  |  |
| ↳ ↳ `refunded_count` |  |  |
| ↳ ↳ `ordered_average_total_price` |  |  |
| ↳ ↳ `payed_average_total_price` |  |  |
| ↳ ↳ `refunded_average_total_price` |  |  |
| ↳ ↳ `ordered_average_count` |  |  |
| ↳ ↳ `payed_average_count` |  |  |
| ↳ ↳ `refunded_average_count` |  |  |
| ↳ `sold_out_products_count` |  | 품절된 상품 수 품절된 상품의 수. 재고관리기능과 품절기능이 활성화 되어있을 경우 집계에 포함됨. |
| ↳ `new_members_count` |  | 신규회원 수 신규가입한 회원의 숫자 |
| ↳ `board_list` |  | 게시판 목록 해당 몰의 게시판의 리스트 |
| ↳ ↳ `type` |  |  |
| ↳ ↳ `board_no` |  | 게시판 번호 |
| ↳ ↳ `board_name` |  | 게시판 이름 |
| ↳ ↳ `new_registered_count` |  |  |
| ↳ ↳ `page_url` |  |  |

응답 예시 (JSON):

```json
{
    "dashboard": [
        {
            "shop_no": 1,
            "daily_sales_stats": [
                {
                    "title": "December 20",
                    "date": "2017-12-20",
                    "order_price": "0.00",
                    "paid_price": "0.00",
                    "refund_price": "0.00",
                    "order_count": 0,
                    "payed_count": 0,
                    "refund_count": 0,
                    "prepareproduct_count": 0,
                    "prepare_count": 0,
                    "standby_count": 0,
                    "shipping_count": 0,
                    "shipped_count": 0,
                    "canceled_count": 0,
                    "returned_count": 0,
                    "exchanged_count": 0,
                    "ordered_total_count": 0
                },
                {
                    "title": "December 21 (Today)",
                    "date": "2017-12-21",
                    "order_price": "0.00",
                    "paid_price": "0.00",
                    "refund_price": "0.00",
                    "order_count": 0,
                    "payed_count": 0,
                    "refund_count": 0,
                    "prepareproduct_count": 0,
                    "prepare_count": 0,
                    "standby_count": 0,
                    "shipping_count": 0,
                    "shipped_count": 0,
                    "canceled_count": 0,
                    "returned_count": 0,
                    "exchanged_count": 0,
                    "ordered_total_count": 0
                }
            ],
            "weekly_sales_stats": {
                "ordered_total_price": "0.00",
                "payed_total_price": "0.00",
                "refunded_total_price": "0.00",
                "ordered_count": 0,
                "payed_count": 0,
                "refunded_count": 0,
                "ordered_average_total_price": "0.00",
                "payed_average_total_price": "0.00",
                "refunded_average_total_price": "0.00",
                "ordered_average_count": 0,
                "payed_average_count": 0,
                "refunded_average_count": 0
            },
            "monthly_sales_stats": {
                "ordered_total_price": "0.00",
                "payed_total_price": "0.00",
                "refunded_total_price": "0.00",
                "ordered_count": 0,
                "payed_count": 0,
                "refunded_count": 0,
                "ordered_average_total_price": "0.00",
                "payed_average_total_price": "0.00",
                "refunded_average_total_price": "0.00",
                "ordered_average_count": 0,
                "payed_average_count": 0,
                "refunded_average_count": 0
            },
            "sold_out_products_count": 0,
            "new_members_count": 0,
            "board_list": [
                {
                    "type": "B",
                    "board_no": 1,
                    "board_name": "공지사항",
                    "new_registered_count": 0,
                    "page_url": "/disp/admin/mobile/index#/bulletins?board_no=1"
                },
                {
                    "type": "B",
                    "board_no": 2,
                    "board_name": "뉴스/이벤트",
                    "new_registered_count": 0,
                    "page_url": "/disp/admin/mobile/index#/bulletins?board_no=2"
                }
            ]
        }
    ]
}
```
