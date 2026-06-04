---
resource: personal
entity: products__carts
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--carts
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Personal / Products carts

> Field-level 카탈로그. Endpoint enumeration index: [`../personal.md`](../personal.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products carts](https://developers.cafe24.com/docs/ko/api/admin/#products--carts)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 장바구니(Products carts)는 특정 상품을 장바구니에 담은 회원과 그 숫자를 조회할 수 있는 리소스입니다. · 특정 상품을 장바구니에 담은 회원의 ID, 담은날짜와 회원의 수 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `member_id` |  | 회원아이디 |
| `created_date` |  | 담은일자 |
| `product_no` |  | 상품번호 |
| `variant_code` |  | 상품 품목 코드 |
| `quantity` |  | 수량 |
| `product_bundle` |  | 세트상품 여부 T : 세트상품 · F : 세트상품 아님 |

## Operations

### `GET /api/v2/admin/products/{product_no}/carts/count` — Retrieve a count of carts containing a product

- **Scope**: `mall.read_personal` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-carts-containing-a-product

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 7
}
```

### `GET /api/v2/admin/products/{product_no}/carts` — Retrieve a list of carts containing a product

- **Scope**: `mall.read_personal` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-carts-containing-a-product

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "carts": [
        {
            "shop_no": 1,
            "member_id": "sampleid",
            "created_date": "2020-05-06T10:49:11+09:00",
            "product_no": 11,
            "variant_code": "P000000L000A",
            "quantity": 2,
            "product_bundle": "T"
        },
        {
            "shop_no": 1,
            "member_id": "sampleid2",
            "created_date": "2020-05-07T09:49:11+09:00",
            "product_no": 11,
            "variant_code": "P000000L000A",
            "quantity": 1,
            "product_bundle": "F"
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/products/11/carts?limit=10&offset=10"
        }
    ]
}
```
