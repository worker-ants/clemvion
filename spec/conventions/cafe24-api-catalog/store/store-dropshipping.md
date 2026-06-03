---
resource: store
entity: store-dropshipping
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#store-dropshipping
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Store dropshipping

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Store dropshipping](https://developers.cafe24.com/docs/ko/api/admin/#store-dropshipping)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `name` |  | 드롭쉬핑 공급사명 |
| `use` |  | 드롭쉬핑 계정연동 여부 T : 연동함 · F : 연동안함 |

## Operations

### `GET /api/v2/admin/store/dropshipping` — Retrieve dropshipping settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-dropshipping-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/store/dropshipping` — Manage dropshipping settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#manage-dropshipping-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `name` | ✓ | 최대글자수 : [50자] |  | 드롭쉬핑 공급사명 |
| `use` | ✓ |  |  | 드롭쉬핑 계정연동 여부 T : 연동함 · F : 연동안함 |
