---
resource: product
entity: products__memos
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--memos
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products memos

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products memos](https://developers.cafe24.com/docs/ko/api/admin/#products--memos)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 메모(Products memos)는 상품에 관한 특이사항을 메모하거나 운영자 간의 의사소통을 위한 도구로 활용할 수 있습니다. · 상품 메모는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `memo_no` |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `author_id` | 최대글자수 : [20자] | 작성자 아이디 메모를 작성한 관리자의 아이디 정보. |
| `created_date` |  | 생성일 메모를 작성한 시간. |
| `memo` |  | 메모 메모의 내용. HTML을 사용하여 등록할 수 있다. |

## Operations

### `GET /api/v2/admin/products/{product_no}/memos` — Retrieve a list of product memos

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-memos

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "memos": [
        {
            "memo_no": 4,
            "author_id": "subadmin1",
            "created_date": "2018-01-18T11:19:27+09:00",
            "memo": "This is a sample memo."
        },
        {
            "memo_no": 3,
            "author_id": "subadmin2",
            "created_date": "2018-01-18T11:19:27+09:00",
            "memo": "This is a sample memo."
        }
    ]
}
```

### `GET /api/v2/admin/products/{product_no}/memos/{memo_no}` — Retrieve a product memo

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `memo_no` | ✓ |  |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "memo": {
        "memo_no": 12,
        "author_id": "subadmin1",
        "created_date": "2018-01-18T11:19:27+09:00",
        "memo": "This is a sample memo."
    }
}
```

### `POST /api/v2/admin/products/{product_no}/memos` — Create a product memo

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `author_id` | ✓ | 최대글자수 : [20자] |  | 작성자 아이디 메모를 작성한 관리자의 아이디 정보. |
| `memo` | ✓ |  |  | 메모 메모의 내용. HTML을 사용하여 등록할 수 있다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "memo": {
        "memo_no": 7,
        "author_id": "subadmin1",
        "created_date": "2018-01-18T11:19:27+09:00",
        "memo": "This is a sample memo."
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/memos/{memo_no}` — Update a product memo

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `memo_no` | ✓ |  |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `author_id` | ✓ | 최대글자수 : [20자] |  | 작성자 아이디 메모를 작성한 관리자의 아이디 정보. |
| `memo` | ✓ |  |  | 메모 메모의 내용. HTML을 사용하여 등록할 수 있다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "memo": {
        "memo_no": 7,
        "author_id": "subadmin2",
        "created_date": "2018-01-18T11:19:27+09:00",
        "memo": "Curabitur mollis consequat ipsum ac."
    }
}
```

### `DELETE /api/v2/admin/products/{product_no}/memos/{memo_no}` — Delete a product memo

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `memo_no` | ✓ |  |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "memo": {
        "memo_no": 12
    }
}
```
