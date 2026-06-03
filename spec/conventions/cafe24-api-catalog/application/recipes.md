---
resource: application
entity: recipes
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#recipes
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Application / Recipes

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Recipes](https://developers.cafe24.com/docs/ko/api/admin/#recipes)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

레시피(Recipes)와 관련된 기능으로, · 쇼핑몰에 레시피를 등록하거나, 등록된 레시피를 목록으로 조회하거나, 등록된 레시피를 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `recipe_code` |  | 레시피 코드 |
| `recipe_name` | 최대글자수 : [200자] | 레시피 이름 |
| `active` |  | 활성화 여부 T : 활성화 · F : 비활성화 |

## Operations

### `GET /api/v2/admin/recipes` — Retrieve a list of recipes

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes

_요청 파라미터 없음._

### `POST /api/v2/admin/recipes` — Create a recipe

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `recipe_code` | ✓ |  |  | 레시피 코드 |
| `trigger_settings` |  |  |  | 트리거 설정 |
| ↳ `required_filters` |  | Array |  |  |
| ↳ ↳ `name` |  |  |  | 조건 이름 |
| ↳ ↳ `value` |  |  |  | 조건 값 |
| ↳ ↳ `operator` |  |  |  | 조건 연산자 |
| ↳ `optional_filters` |  | Array |  |  |
| ↳ ↳ `condition` |  | Array |  |  |
| ↳ ↳ ↳ `name` |  |  |  | 조건 이름 |
| ↳ ↳ ↳ `value` |  |  |  | 조건 값 |
| ↳ ↳ ↳ `operator` |  |  |  | 조건 연산자 |

### `DELETE /api/v2/admin/recipes/{recipe_code}` — Delete a recipe

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `recipe_code` | ✓ |  |  | 레시피 코드 |
