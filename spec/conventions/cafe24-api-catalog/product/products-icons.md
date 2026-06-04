---
resource: product
entity: products-icons
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-icons
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products icons

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products icons](https://developers.cafe24.com/docs/ko/api/admin/#products-icons)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 아이콘은 상품을 강조하기 위해 상품 옆에 추가할 수 있는 작은 이미지들입니다. 진열된 상품에 할인 정보, "매진 임박" 등의 메시지를 추가하여 상품을 강조할 수 있습니다. · 상품 아이콘는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `code` |  | 아이콘 코드 |
| `path` |  | 아이콘 URL |

## Operations

### `GET /api/v2/admin/products/icons` — Retrieve a list of icons

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-icons

_요청 파라미터 없음._

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `icons` |  | (목록) |
| ↳ `code` |  | 아이콘 코드 |
| ↳ `path` |  | 아이콘 URL |

응답 예시 (JSON):

```json
{
    "icons": [
        {
            "code": "icon_01_01",
            "path": "https://img.echosting.cafe24.com/icon/product/ko_KR/icon_01_01.gif"
        },
        {
            "code": "icon_02_01",
            "path": "https://img.echosting.cafe24.com/icon/product/ko_KR/icon_02_01.gif"
        },
        {
            "code": "icon_05_01",
            "path": "https://img.echosting.cafe24.com/icon/product/ko_KR/icon_05_01.gif"
        },
        {
            "code": "custom_1",
            "path": "https://{domain}/web/upload/custom_115855429954932.gif"
        }
    ]
}
```
