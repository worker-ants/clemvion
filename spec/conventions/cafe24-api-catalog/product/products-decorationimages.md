---
resource: product
entity: products-decorationimages
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-decorationimages
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `decorationimages` |  | 꾸미기 이미지 리소스 |
| ↳ `code` |  | 꾸미기 이미지 코드 |
| ↳ `path` |  | 꾸미기 이미지 URL |

응답 예시 (JSON):

```json
{
    "decorationimages": [
        {
            "code": "imageicon_28_02",
            "path": "https://img.echosting.cafe24.com/skin/admin_ko_KR/product/ico_thumb_recommend2.png"
        },
        {
            "code": "imageicon_27_01",
            "path": "https://img.echosting.cafe24.com/skin/admin_ko_KR/product/ico_thumb_plan1.png"
        },
        {
            "code": "imageicon_26_02",
            "path": "https://img.echosting.cafe24.com/skin/admin_ko_KR/product/ico_thumb_own2.png"
        },
        {
            "code": "image_custom_3",
            "path": "https://{domain}/web/upload/image_custom_615421761805558.gif"
        }
    ]
}
```
