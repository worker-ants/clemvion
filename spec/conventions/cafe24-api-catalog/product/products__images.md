---
resource: product
entity: products__images
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--images
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products images

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products images](https://developers.cafe24.com/docs/ko/api/admin/#products--images)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 이미지(Products Images)는 상품의 판매를 위해서 업로드한 상품의 사진이나 그림을 의미합니다. · 상품 이미지 API를 사용해 상품 상세설명에서 사용할 이미지를 업로드하거나, 상품의 이미지를 업로드할 수 있습니다. · 상품의 이미지는 Base64 코드 로 인코딩하여 업로드할 수 있습니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `detail_image` |  | 상세이미지 상품 상세 화면에 표시되는 상품 이미지. |
| `list_image` |  | 목록이미지 상품 분류 화면, 메인 화면, 상품 검색 화면에 표시되는 상품의 목록 이미지. |
| `tiny_image` |  | 작은목록이미지 상품 상세 화면 하단에 표시되는 상품 목록 이미지. |
| `small_image` |  | 축소이미지 최근 본 상품 영역에 표시되는 상품의 목록 이미지. |

## Operations

### `POST /api/v2/admin/products/{product_no}/images` — Upload product images

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#upload-product-images

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `detail_image` |  |  |  | 상세이미지 상품 상세 화면에 표시되는 상품 이미지. |
| `list_image` |  |  |  | 목록이미지 Youtube shopping 이용 시에는 미제공 상품 분류 화면, 메인 화면, 상품 검색 화면에 표시되는 상품의 목록 이미지. |
| `tiny_image` |  |  |  | 작은목록이미지 Youtube shopping 이용 시에는 미제공 상품 상세 화면 하단에 표시되는 상품 목록 이미지. |
| `small_image` |  |  |  | 축소이미지 Youtube shopping 이용 시에는 미제공 최근 본 상품 영역에 표시되는 상품의 목록 이미지. |
| `image_upload_type` | ✓ |  |  | 이미지 업로드 타입 Youtube shopping 이용 시에는 미제공 이미지 타입이 대표 이미지 인지, 개별 이미지 인지 업로드 타입을 지정할 수 있음. 대표 이미지(A)로 업로드 하는 경우 상세이미지(detail_image)에 이미지를 업로드하면 다른 나머지 이미지에도 모두 반영됨. A : 대표이미지등록 · B : 개별이미지등록 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "image": {
        "shop_no": 1,
        "product_no": 20,
        "detail_image": "https://{domain}/web/product/big/201801/995feab7d359875e073ae82b48192a7b.jpeg",
        "list_image": "https://{domain}/web/product/medium/201801/995feab7d359875e073ae82b48192a7b.jpeg",
        "tiny_image": "https://{domain}/web/product/tiny/201801/995feab7d359875e073ae82b48192a7b.jpeg",
        "small_image": "https://{domain}/web/product/small/201801/995feab7d359875e073ae82b48192a7b.jpeg"
    }
}
```

### `DELETE /api/v2/admin/products/{product_no}/images` — Delete product images

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-product-images

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "image": {
        "shop_no": 1,
        "product_no": 20
    }
}
```
