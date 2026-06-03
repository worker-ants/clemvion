---
resource: translation
entity: translations-themes
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#translations-themes
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Translation / Translations themes

> Field-level 카탈로그. Endpoint enumeration index: [`../translation.md`](../translation.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Translations themes](https://developers.cafe24.com/docs/ko/api/admin/#translations-themes)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

테마 번역 정보(Translations themes)는, 다국어 코드화된 디자인 스킨에 탑재된 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `skin_no` |  | 디자인 번호 |
| `translations` |  | 번역 정보 |
| `skin_code` |  | 디자인 코드 |
| `skin_translation` |  | 디자인 번역 정보 |

## Operations

### `GET /api/v2/admin/translations/themes` — Retrieve a list of theme translations

- **Scope**: `mall.read_translation` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-theme-translations

_요청 파라미터 없음._

### `GET /api/v2/admin/translations/themes/{skin_no}` — Retrieve a theme translation

- **Scope**: `mall.read_translation` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-translation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `skin_no` | ✓ |  |  | 디자인 번호 |
| `language_code` | ✓ |  |  | 언어 코드 |

### `PUT /api/v2/admin/translations/themes/{skin_no}` — Update a theme translation

- **Scope**: `mall.write_translation` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-translation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `skin_no` | ✓ |  |  | 디자인 번호 |
| `skin_translation` |  |  |  | 디자인 번역 정보 |
| ↳ `language_code` | ✓ |  |  | 언어 코드 |
| ↳ `source` | ✓ |  |  | 소스 코드 |
