---
resource: design
entity: themes__pages
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#themes--pages
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Design / Themes pages

> Field-level 카탈로그. Endpoint enumeration index: [`../design.md`](../design.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Themes pages](https://developers.cafe24.com/docs/ko/api/admin/#themes--pages)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

테마 페이지(Themes pages)는 쇼핑몰의 디자인 테마의 페이지에 대한 조회, 설정, 수정, 삭제를 하는 기능입니다. · 테마 페이지는 하위 리소스로 테마(Themes) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `skin_no` |  | 디자인 번호 |
| `skin_code` |  | 디자인 코드 |
| `path` |  | 파일 경로 |
| `source` |  | 소스 코드 |
| `display_location` |  | 화면 분류 |

## Operations

### `GET /api/v2/admin/themes/{skin_no}/pages` — Retrieve a theme page

- **Scope**: `mall.read_design` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-page

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `skin_no` | ✓ |  |  | 디자인 번호 |
| `path` | ✓ |  |  | 파일 경로 |

### `POST /api/v2/admin/themes/{skin_no}/pages` — Create a theme page

- **Scope**: `mall.write_design` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-theme-page

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `skin_no` | ✓ |  |  | 디자인 번호 |
| `path` | ✓ |  |  | 파일/디렉토리 경로 |
| `source` |  |  |  | 소스 코드 |
| `display_location` |  |  |  | 화면 분류 |

### `PUT /api/v2/admin/themes/{skin_no}/pages` — Update a theme page

- **Scope**: `mall.write_design` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-page

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `skin_no` | ✓ |  |  | 디자인 번호 |
| `path` | ✓ |  |  | 파일 경로 |
| `source` | ✓ |  |  | 소스 코드 |

### `DELETE /api/v2/admin/themes/{skin_no}/pages` — Delete a theme page

- **Scope**: `mall.write_design` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-theme-page

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `skin_no` | ✓ |  |  | 디자인 번호 |
| `path` | ✓ |  |  | 파일 경로 |
