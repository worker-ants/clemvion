---
resource: product
entity: products-customproperties
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-customproperties
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Product / Products customproperties

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products customproperties](https://developers.cafe24.com/docs/ko/api/admin/#products-customproperties)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품에 등록된 사용자정의 속성을 관리 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `custom_properties` |  | 자체 정의 속성 |

## Operations

### `GET /api/v2/admin/products/customproperties` — Retrieve user-defined properties

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-user-defined-properties

_요청 파라미터 없음._

### `POST /api/v2/admin/products/customproperties` — Create user-defined properties

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-user-defined-properties

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `custom_properties` |  |  |  | 자체 정의 속성 |
| ↳ `property_name` | ✓ |  |  | 자체 정의 속성 이름 |

### `PUT /api/v2/admin/products/customproperties/{property_no}` — Update user-defined properties

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-user-defined-properties

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `property_no` | ✓ |  |  | 자체 정의 속성 번호 |
| `property_name` | ✓ | 최대글자수 : [250자] |  | 자체 정의 속성 이름 |

### `DELETE /api/v2/admin/products/customproperties/{property_no}` — Delete user-defined properties

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-user-defined-properties

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `property_no` | ✓ |  |  | 자체 정의 속성 번호 |
