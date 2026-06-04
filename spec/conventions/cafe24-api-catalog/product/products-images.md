---
resource: product
entity: products-images
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-images
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products images

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products images](https://developers.cafe24.com/docs/ko/api/admin/#products-images)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 이미지(Products Images)는 상품의 판매를 위해서 업로드한 상품의 사진이나 그림을 의미합니다. · 상품 이미지 API를 사용해 상품 상세설명에서 사용할 이미지를 업로드하거나, 상품의 이미지를 업로드할 수 있습니다. · 상품의 이미지는 Base64 코드 로 인코딩하여 업로드할 수 있습니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `path` |  | 상세이미지 |

## Operations

### `POST /api/v2/admin/products/images` — Upload images

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 20
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#upload-images

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `image` | ✓ |  |  | 상세이미지 ● 이미지 파일 용량 제한 : 10MB · ● 한 호출당 이미지 전체 용량 제한 : 30MB |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "images": [
        {
            "path": "https://{domain}/web/upload/NNEditor/20180130/12ecf27747401c8502ddd6b2e79e1e64.png"
        },
        {
            "path": "https://{domain}/web/upload/NNEditor/20180130/4672d70e72991f3e54627a8be4aea995.png"
        }
    ]
}
```
