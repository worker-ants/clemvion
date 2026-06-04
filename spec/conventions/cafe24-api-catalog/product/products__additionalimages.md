---
resource: product
entity: products__additionalimages
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--additionalimages
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products additionalimages

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products additionalimages](https://developers.cafe24.com/docs/ko/api/admin/#products--additionalimages)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 추가 이미지(Products additionalimages)는 상품의 추가이미지를 나타내는 하위 리소스로, 상품(Products)리소스의 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `additional_image` |  | 추가이미지 |
| `product_no` |  | 상품번호 |

## Operations

### `POST /api/v2/admin/products/{product_no}/additionalimages` — Create an additional product image

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-product-image

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `additional_image` | ✓ |  |  | 추가이미지 ● 최대요청건수 : 20개 · ● 이미지 파일 용량 제한 : 5MB · ● 한 호출당 이미지 전체 용량 제한 : 30MB |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "additionalimage": {
        "shop_no": 1,
        "additional_image": [
            {
                "big": "http://{domain}/web/product/extra/big/201801/995feab7d359875e073ae82b4819a7.jpeg",
                "medium": "http://{domain}/web/product/extra/medium/201801/995feab7d359875e073ae82b4819a7.jpeg",
                "small": "http://{domain}/web/product/extra/small/201801/995feab7d359875e073ae82b4819a7.jpeg"
            },
            {
                "big": "http://{domain}/web/product/extra/big/201801/95feab7d359875e073ae82b48192a.jpeg",
                "medium": "http://{domain}/web/product/extra/medium/201801/95feab7d359875e073ae82b48192a.jpeg",
                "small": "http://{domain}/web/product/extra/small/201801/95feab7d359875e073ae82b48192a.jpeg"
            },
            {
                "big": "http://{domain}/web/product/extra/big/201801/995feab7d359875e073ae82b481.jpeg",
                "medium": "http://{domain}/web/product/extra/medium/201801/995feab7d359875e073ae82b481.jpeg",
                "small": "http://{domain}/web/product/extra/small/201801/995feab7d359875e073ae82b481.jpeg"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/additionalimages` — Update an additional product image

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-product-image

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `additional_image` | ✓ |  |  | 추가이미지 ● 최대요청건수 : 20개 · ● 이미지 파일 용량 제한 : 5MB · ● 한 호출당 이미지 전체 용량 제한 : 30MB |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "additionalimage": {
        "shop_no": 1,
        "additional_image": [
            {
                "big": "http://{domain}/web/product/extra/big/201801/995feab7d359875e073ae82b4819a7.jpeg",
                "medium": "http://{domain}/web/product/extra/medium/201801/995feab7d359875e073ae82b4819a7.jpeg",
                "small": "http://{domain}/web/product/extra/small/201801/995feab7d359875e073ae82b4819a7.jpeg"
            },
            {
                "big": "http://{domain}/web/product/extra/big/201801/95feab7d359875e073ae82b48192a.jpeg",
                "medium": "http://{domain}/web/product/extra/medium/201801/95feab7d359875e073ae82b48192a.jpeg",
                "small": "http://{domain}/web/product/extra/small/201801/95feab7d359875e073ae82b48192a.jpeg"
            },
            {
                "big": "http://{domain}/web/product/extra/big/201801/995feab7d359875e073ae82b481.jpeg",
                "medium": "http://{domain}/web/product/extra/medium/201801/995feab7d359875e073ae82b481.jpeg",
                "small": "http://{domain}/web/product/extra/small/201801/995feab7d359875e073ae82b481.jpeg"
            }
        ]
    }
}
```

### `DELETE /api/v2/admin/products/{product_no}/additionalimages` — Delete an additional product image

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-product-image

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "additionalimage": {
        "shop_no": 1,
        "product_no": 20
    }
}
```
