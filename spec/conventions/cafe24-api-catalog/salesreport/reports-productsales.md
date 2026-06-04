---
resource: salesreport
entity: reports-productsales
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#reports-productsales
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Salesreport / Reports productsales

> Field-level 카탈로그. Endpoint enumeration index: [`../salesreport.md`](../salesreport.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Reports productsales](https://developers.cafe24.com/docs/ko/api/admin/#reports-productsales)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품판매통계(Reports productsales)를 활용하여 상품을 기준으로 판매된 통계를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `collection_date` |  | 정산 수집 일자 |
| `collection_hour` |  | 정산 수집 시간 |
| `product_no` |  | 상품번호 |
| `variants_code` |  | 품목코드 |
| `product_price` |  | 상품 구매금액 |
| `settle_count` |  | 결제완료 수량 |
| `refund_count` |  | 환불완료 수량 |
| `sale_count` |  | 판매완료 수량 |
| `return_product_count` |  | 반품완료 수량 |
| `exchange_product_count` |  | 교환완료 수량 |
| `cancel_product_count` |  | 취소완료 수량 |
| `total_sale_count` |  | 누적 판매 수량 |
| `total_cancel_count` |  | 누적 취소 수량 |

## Operations

### `GET /api/v2/admin/reports/productsales` — Retrieve hourly product sales statistics of a store

- **Scope**: `mall.read_salesreport` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-hourly-product-sales-statistics-of-a-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `collection_hour` |  |  |  | 정산 수집 시간 수집 시간을 특정하여 검색 · 00 ~ 23 까지의 값을 입력할 수 있다. |
| `limit` |  | 최소: [1]~최대: [1000] | 100 | 조회결과 최대건수 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "productsales": [
        {
            "shop_no": 1,
            "collection_date": "2021-02-25",
            "collection_hour": "16",
            "product_no": 25,
            "variants_code": "P000ZNEM000A",
            "product_price": "10000.00",
            "settle_count": 1,
            "refund_count": 0,
            "sale_count": 1,
            "exchange_product_count": 0,
            "cancel_product_count": 0,
            "return_product_count": 0,
            "total_sale_count": 1,
            "total_cancel_count": 0
        },
        {
            "shop_no": 1,
            "collection_date": "2021-02-25",
            "collection_hour": "15",
            "product_no": 26,
            "variants_code": "P000ZORU000A",
            "product_price": "1000.00",
            "settle_count": 1,
            "refund_count": 0,
            "sale_count": 1,
            "exchange_product_count": 0,
            "cancel_product_count": 0,
            "return_product_count": 0,
            "total_sale_count": 1,
            "total_cancel_count": 0
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/reports/productsales?limit=10&offset=10"
        }
    ]
}
```
