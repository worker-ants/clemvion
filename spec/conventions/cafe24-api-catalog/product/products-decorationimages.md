---
resource: product
entity: products-decorationimages
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-decorationimages
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Product / Products decorationimages

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products decorationimages](https://developers.cafe24.com/docs/ko/api/admin/#products-decorationimages)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

꾸미기 이미지(Decorationimages)는 쇼핑몰에 진열된 상품 이미지 위에 추가하여 상품에 포인트를 줄 수 있는 기능입니다. · 쇼핑몰에 등록되어있는 꾸미기 이미지를 조회하여 상품별로 꾸미기 이미지를 지정하거나, 상품에 등록되어있는 꾸미기 이미지를 조회할 수 있습니다. · 꾸미기 이미지는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `code` |  | 꾸미기 이미지 코드 |
| `path` |  | 꾸미기 이미지 URL |

## Operations

### `GET /api/v2/admin/products/decorationimages` — Retrieve a list of decoration images

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-decoration-images

_요청 파라미터 없음._
