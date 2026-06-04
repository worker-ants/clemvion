---
resource: product
entity: products__approve
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--approve
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products approve

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products approve](https://developers.cafe24.com/docs/ko/api/admin/#products--approve)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 승인(Products approve)은 공급사가 업로드한 상품을 검토 후 승인하는 기능입니다. · 해당 기능은 일부 쇼핑몰에만 적용된 상태로, 공급사 상품 승인 기능을 사용중인 몰에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `status` |  | 상태 공급사가 승인 요청한 해당 상품의 승인 상태 N : 승인요청 (신규상품) 상태값 · E : 승인요청 (상품수정) 상태값 · C : 승인완료 상태값 · R : 승인거절 상태값 · I : 검수진행중 상태값 · Empty Value : 요청된적 없음 |
| `product_no` |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |

## Operations

### `GET /api/v2/admin/products/{product_no}/approve` — Retrieve a product approval status

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-approval-status

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "approve": {
        "shop_no": 1,
        "status": "C",
        "product_no": 7
    }
}
```

### `POST /api/v2/admin/products/{product_no}/approve` — Create a product approval request

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-approval-request

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `user_id` | ✓ |  |  | 공급사 운영자 아이디 승인 요청한 공급사의 아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "approve": {
        "shop_no": 1,
        "status": "N",
        "product_no": 7
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/approve` — Update a product approval status

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-approval-status

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `user_id` | ✓ |  |  | 공급사 운영자 아이디 승인 요청한 공급사의 아이디 |
| `status` | ✓ |  |  | 상태 공급사가 승인 요청한 해당 상품의 승인 상태 C : 승인완료 상태값 · R : 승인거절 상태값 · I : 검수진행중 상태값 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "approve": {
        "shop_no": 1,
        "status": "C",
        "product_no": 7
    }
}
```
