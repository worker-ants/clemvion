---
resource: product
entity: products__discountprice
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--discountprice
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products discountprice

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products discountprice](https://developers.cafe24.com/docs/ko/api/admin/#products--discountprice)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 할인가(Discountprice)는 상품의 할인가격을 표시하는 리소스입니다. 혜택(Benefits)이 적용된 상품의 경우 상품의 할인가를 조회할 수 있습니다. · 상품 할인가는 하위 리소스로서 상품(Products) 하위에서만 사용가능하며, 상품 목록 조회시 Embed 파라메터로 호출가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `pc_discount_price` |  | PC 할인 판매가 |
| `mobile_discount_price` |  | 모바일 할인 판매가 |
| `app_discount_price` |  | 앱 할인 판매가 |

## Operations

### `GET /api/v2/admin/products/{product_no}/discountprice` — Retrieve a product discounted price

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-discounted-price

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "discountprice": {
        "pc_discount_price": "7000.00",
        "mobile_discount_price": "6000.00",
        "app_discount_price": "5000.00"
    }
}
```
