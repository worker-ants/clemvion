---
resource: product
entity: products__hits
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--hits
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products hits

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products hits](https://developers.cafe24.com/docs/ko/api/admin/#products--hits)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 조회수(Hits)는 상품을 쇼핑몰 고객들이 얼마나 조회했는지를 나타내는 지표입니다. · 상품 조회수를 확인하면, 고객들이 어떤 상품을 가장 많이 조회하는지 알 수 있습니다. · 상품 조회수는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

## Operations

### `GET /api/v2/admin/products/{product_no}/hits/count` — Retrieve a count of product views

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-views

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플.

```json
{
    "count": 3
}
```
