---
resource: community
entity: boards__seo
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#boards--seo
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Community / Boards seo

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Boards seo](https://developers.cafe24.com/docs/ko/api/admin/#boards--seo)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

게시판 SEO의 설정을 관리하기 위한 기능을 제공합니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `board_no` |  | 게시판 번호 |
| `meta_title` |  | 브라우저 타이틀 [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| `meta_author` |  | 메타태그1 : Author [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| `meta_description` |  | 메타태그2 : Description [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| `meta_keywords` |  | 메타태그3 : Keywords [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |

## Operations

### `GET /api/v2/admin/boards/{board_no}/seo` — Retrieve SEO settings for board

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-for-board

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `seo` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `board_no` |  | 게시판 번호 |
| ↳ `meta_title` |  | 브라우저 타이틀 [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| ↳ `meta_author` |  | 메타태그1 : Author [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| ↳ `meta_description` |  | 메타태그2 : Description [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| ↳ `meta_keywords` |  | 메타태그3 : Keywords [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |

응답 예시 (JSON):

```json
{
    "seo": {
        "shop_no": 1,
        "board_no": 4,
        "meta_title": "[ARTICLE_TITLE] [BOARD_NAME] - [MALL_NAME]",
        "meta_author": "[MALL_NAME]",
        "meta_description": "[BOARD_GUIDE]",
        "meta_keywords": "[MALL_NAME], keyword1, keyword2"
    }
}
```

### `PUT /api/v2/admin/boards/{board_no}/seo` — Update SEO settings for board

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-seo-settings-for-board

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |
| `meta_title` |  | 최대글자수 : [100자] |  | 브라우저 타이틀 [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| `meta_author` |  |  |  | 메타태그1 : Author [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| `meta_description` |  |  |  | 메타태그2 : Description [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| `meta_keywords` |  |  |  | 메타태그3 : Keywords [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `seo` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `board_no` |  | 게시판 번호 |
| ↳ `meta_title` |  | 브라우저 타이틀 [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| ↳ `meta_author` |  | 메타태그1 : Author [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| ↳ `meta_description` |  | 메타태그2 : Description [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |
| ↳ `meta_keywords` |  | 메타태그3 : Keywords [MALL_NAME] : 쇼핑몰명 · [BOARD_NAME] : 게시판 제목 · [BOARD_GUIDE] : 게시판 안내글 · [ARTICLE_TITLE] : 게시물 제목 |

응답 예시 (JSON):

```json
{
    "seo": {
        "shop_no": 1,
        "board_no": 4,
        "meta_title": "[ARTICLE_TITLE] [BOARD_NAME] - [MALL_NAME]",
        "meta_author": "[MALL_NAME]",
        "meta_description": "[BOARD_GUIDE]",
        "meta_keywords": "[MALL_NAME], keyword1, keyword2"
    }
}
```
