---
resource: design
entity: themes
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#themes
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Design / Themes

> Field-level 카탈로그. Endpoint enumeration index: [`../design.md`](../design.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Themes](https://developers.cafe24.com/docs/ko/api/admin/#themes)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

디자인(Themes)은 쇼핑몰에 사용하기 위해 구매하거나 혹은 직접 만든 디자인과 관련된 기능입니다. · PC 쇼핑몰과 모바일 쇼핑몰의 디자인을 모두 확인할 수 있습니다. · 디자인 목록에 있는 디자인 중 대표 디자인을 지정하면 쇼핑몰의 디자인이 해당 디자인으로 변경됩니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `skin_no` | 최소값: [1] | 디자인 번호 |
| `skin_code` |  | 디자인 코드 |
| `skin_name` | 최대글자수 : [100자] | 디자인명 |
| `skin_thumbnail_url` | 최대글자수 : [255자] | 디자인 썸네일 이미지 URL |
| `usage_type` |  | 디자인 용도 구분 S : PC 기본스킨 · C : PC 복사된 스킨 · I : PC 상속된 스킨 · M : 모바일 기본스킨/상속된 스킨 · N : 모바일 복사된 스킨 |
| `editor_type` |  | 에디터 타입 H : 스마트 디자인 (HTML) · D : 에디봇 디자인 (Drag & Drop) · W : 심플 디자인 (WYSIWYG) · E : 스마트디자인Easy · C : 콘텐츠스튜디오(Contents Studio) |
| `parent_skin_no` |  | 부모 디자인 번호 |
| `seller_id` |  | 판매자 디자인센터 아이디 |
| `seller_skin_code` |  | 판매자 디자인 코드 |
| `design_purchase_no` | 최소값: [0] | 디자인 구매 번호 |
| `design_product_code` |  | 디자인센터 상품 코드 |
| `language_code` | 최소글자수 : [5자]; 최대글자수 : [5자] | 언어 코드 ko_KR : 국문 · en_US : 영문 · zh_CN : 중문(간체) · zh_TW : 중문(번체) · ja_JP : 일문 · pt_PT : 포르투갈어 · es_ES : 스페인어 · vi_VN : 베트남어 |
| `published_in` |  | 대표디자인 설정 멀티쇼핑몰 번호 |
| `created_date` | 날짜 | 생성일 |
| `updated_date` | 날짜 | 수정일 |
| `preview_domain` |  | 도메인 조회 |
| `skin_lock` |  | 디자인 잠금 T : 잠금 · F : 해제 |

## Operations

### `GET /api/v2/admin/themes` — Retrieve a list of themes

- **Scope**: `mall.read_design` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-themes

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `type` |  |  | pc | 디자인 타입 pc : PC · mobile : 모바일 |

### `GET /api/v2/admin/themes/count` — Retrieve a count of themes

- **Scope**: `mall.read_design` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-themes

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `type` |  |  | pc | 디자인 타입 pc : PC · mobile : 모바일 |

### `GET /api/v2/admin/themes/{skin_no}` — Retrieve a theme

- **Scope**: `mall.read_design` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `skin_no` |  | 최소값: [1] |  | 디자인 번호 |
