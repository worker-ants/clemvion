---
resource: salesreport
entity: reports-salesvolume
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#reports-salesvolume
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Salesreport / Reports salesvolume

> Field-level 카탈로그. Endpoint enumeration index: [`../salesreport.md`](../salesreport.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Reports salesvolume](https://developers.cafe24.com/docs/ko/api/admin/#reports-salesvolume)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

판매수량 통계(Reports salesvolume)는 쇼핑몰의 상품이 판매된 수량의 통계에 대한 기능입니다. · 판매수량은 주기적으로 집계하여 업데이트 되므로 실시간의 데이터는 아닌 점 참고 부탁 드립니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `collection_date` |  | 정산 수집 일자 판매량 통계가 수집된 수집 날짜 |
| `collection_hour` |  | 정산 수집 시간 판매량 통계가 수집된 수집 시간 |
| `product_price` |  | 상품 판매가 해당 상품의 가격 |
| `product_option_price` |  | 상품 옵션 가격 해당 품목의 옵션 추가 가격. |
| `settle_count` |  | 결제완료 수량 조회 기간동안 해당 품목이 결제 완료된 수량 |
| `exchane_product_count` |  | 교환완료 수량 조회 기간동안 해당 품목이 교환된 수량 |
| `cancel_product_count` |  | 취소완료 수량 조회 기간동안 해당 품목이 취소된 수량 |
| `return_product_count` |  | 반품완료 수량 조회 기간동안 해당 품목이 반품된 수량 |
| `updated_date` |  | 최종 데이터 갱신 시간 판매 수량 통계 데이터가 갱신된 시간 표시 |
| `variants_code` |  | 품목코드 해당 품목의 품목 코드 |
| `product_no` |  | 상품번호 |
| `total_sales` |  | 총 판매 건수 해당 품목이 검색한 기간 동안 총 판매된 수량 |

## Operations

### `GET /api/v2/admin/reports/salesvolume` — Retrieve a sales report

- **Scope**: `mall.read_salesreport` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sales-report

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` |  |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. · 조회시 상품번호(product_no)와 품목코드(variant_code) 둘 중에 하나는 반드시 포함하여야한다. ,(콤마)로 여러 건을 검색할 수 있다. |
| `variants_code` |  |  |  | 품목코드 판매 수량을 검색할 품목 코드 · 조회시 상품번호(product_no)와 품목코드(variant_code) 둘 중에 하나는 반드시 포함하여야한다. |
| `category_no` |  |  |  | 분류 번호 판매 수량 중 특정 카테고리에서 판매된 수량 조회 |
| `mobile` |  |  |  | 모바일 PC 여부 판매 수량 중 모바일 웹에서 판매된 수량 조회 T : 모바일 · F : 그외 |
| `delivery_type` |  |  |  | 배송 유형 판매 수량 중 국내 또는 해외 배송 수량 조회 A : 국내 · B : 해외 |
| `group_no` |  |  |  | 회원 등급 번호 |
| `supplier_id` |  | 최대글자수 : [20자] |  | 공급사 아이디 판매 수량 중 특정 공급사 ID로 등록된 수량 조회 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 판매 수량을 조회할 검색 시작일(결제일 기준) · 검색 종료일과 같이 사용해야함. |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 판매 수량을 조회할 검색 종료일(결제일 기준) · 검색 시작일과 같이 사용해야함. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "salesvolume": [
        {
            "shop_no": "1",
            "collection_date": "2018-10-27",
            "collection_hour": "12",
            "product_price": "10000.00",
            "product_option_price": "0.00",
            "settle_count": "2",
            "exchane_product_count": "0",
            "cancel_product_count": "0",
            "return_product_count": "0",
            "updated_date": "2018-10-27T14:51+09:00",
            "product_no": 16,
            "variants_code": "P0000BKE000A",
            "total_sales": "2"
        },
        {
            "shop_no": "1",
            "collection_date": "2018-10-27",
            "collection_hour": "12",
            "product_price": "10000.00",
            "product_option_price": "0.00",
            "settle_count": "23",
            "exchane_product_count": "0",
            "cancel_product_count": "0",
            "return_product_count": "0",
            "updated_date": "2018-10-27T14:51+09:00",
            "product_no": 16,
            "variants_code": "P0000BKE000B",
            "total_sales": "23"
        }
    ]
}
```
