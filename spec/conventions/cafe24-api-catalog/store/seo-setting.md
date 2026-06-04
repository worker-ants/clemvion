---
resource: store
entity: seo-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#seo-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Seo setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Seo setting](https://developers.cafe24.com/docs/ko/api/admin/#seo-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

SEO 설정(Seo setting)은 검색결과 상위에 쇼핑몰이 노출되고 방문자가 증가하도록 하는 검색엔진 최적화(SEO) 작업입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 DEFAULT 1 |
| `common_page_title` |  | 공통페이지 title 태그 |
| `common_page_meta_description` |  | 공통페이지 description 태그 |
| `favicon` | URL | 파비콘 |
| `use_google_search_console` |  | 구글 서치 콘솔 사용여부 T : 사용함 · F : 사용안함 |
| `google_search_console` |  | 구글 서치 콘솔 |
| `use_naver_search_advisor` |  | 네이버 서치 어드바이저 사용여부 T : 사용함 · F : 사용안함 |
| `naver_search_advisor` |  | 네이버 서치 어드바이저 |
| `sns_share_image` | URL | SNS 공유 이미지 |
| `use_twitter_card` |  | 트위터 카드 사용여부 T : 사용함 · F : 사용안함 |
| `robots_text` |  | 검색로봇 접근 제어(PC) |
| `mobile_robots_text` |  | 검색로봇 접근 제어(모바일) |
| `use_missing_page_redirect` |  | 없는 페이지 연결 리다이렉션 여부(PC) T : 사용함 · F : 사용안함 |
| `missing_page_redirect_url` |  | 없는 페이지 연결 리다이렉션 연결 경로(PC) |
| `mobile_use_missing_page_redirect` |  | 없는 페이지 연결 리다이렉션 여부(모바일) T : 사용함 · F : 사용안함 |
| `mobile_missing_page_redirect_url` |  | 없는 페이지 연결 리다이렉션 연결 경로(모바일) |
| `use_sitemap_auto_update` |  | 사이트맵 사용여부 T : 사용함 · F : 사용안함 |
| `use_rss` |  | RSS 피드 사용여부 T : 사용함 · F : 사용안함 |
| `display_group` |  | 메인분류 명 |
| `header_tag` |  | Head HTML(PC) |
| `footer_tag` |  | Body HTML(PC) |
| `mobile_header_tag` |  | Head HTML(모바일) |
| `mobile_footer_tag` |  | Body HTML(모바일) |
| `og_main` |  | 메인 화면 설정 |
| `og_product` |  | 상품 상세 설정 |
| `og_category` |  | 상품 분류 설정 |
| `og_board` |  | 게시판 설정 |
| `llms_text` |  | AI 크롤러 접근 제어 |

## Operations

### `GET /api/v2/admin/seo/setting` — Retrieve SEO settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `seo` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `common_page_title` |  | 공통페이지 title 태그 |
| ↳ `common_page_meta_description` |  | 공통페이지 description 태그 |
| ↳ `favicon` | URL | 파비콘 |
| ↳ `use_google_search_console` |  | 구글 서치 콘솔 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `google_search_console` |  | 구글 서치 콘솔 |
| ↳ `use_naver_search_advisor` |  | 네이버 서치 어드바이저 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `naver_search_advisor` |  | 네이버 서치 어드바이저 |
| ↳ `sns_share_image` | URL | SNS 공유 이미지 |
| ↳ `use_twitter_card` |  | 트위터 카드 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `robots_text` |  | 검색로봇 접근 제어(PC) |
| ↳ `mobile_robots_text` |  | 검색로봇 접근 제어(모바일) |
| ↳ `use_missing_page_redirect` |  | 없는 페이지 연결 리다이렉션 여부(PC) T : 사용함 · F : 사용안함 |
| ↳ `missing_page_redirect_url` |  | 없는 페이지 연결 리다이렉션 연결 경로(PC) |
| ↳ `mobile_use_missing_page_redirect` |  | 없는 페이지 연결 리다이렉션 여부(모바일) T : 사용함 · F : 사용안함 |
| ↳ `mobile_missing_page_redirect_url` |  | 없는 페이지 연결 리다이렉션 연결 경로(모바일) |
| ↳ `use_sitemap_auto_update` |  | 사이트맵 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `use_rss` |  | RSS 피드 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `display_group` |  | 메인분류 명 |
| ↳ `header_tag` |  | Head HTML(PC) |
| ↳ `footer_tag` |  | Body HTML(PC) |
| ↳ `mobile_header_tag` |  | Head HTML(모바일) |
| ↳ `mobile_footer_tag` |  | Body HTML(모바일) |
| ↳ `og_main` |  | 메인 화면 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `og_product` |  | 상품 상세 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `og_category` |  | 상품 분류 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `og_board` |  | 게시판 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `llms_text` |  | AI 크롤러 접근 제어 |

응답 예시 (JSON):

```json
{
    "seo": {
        "shop_no": 1,
        "common_page_title": "Sample mall | Outerwear, Tops, Dresses, Bottoms, Accessories",
        "common_page_meta_description": "Sample mall | Outerwear, Tops, Dresses, Bottoms, Accessories",
        "favicon": "https://sample.cafe24.com/web/upload/favicon-b8141fe545ef3dda08cfd2d6ec5a9972.ico",
        "use_google_search_console": "T",
        "google_search_console": "<meta name=\"google-site-verification\" content=\"code\" />",
        "use_naver_search_advisor": "T",
        "naver_search_advisor": "<meta name=\"naver-site-verification\" content=\"code\" />",
        "sns_share_image": "https://sample.cafe24.com/web/upload/share-image-1-974433be4123fea4fa711fd0443a0b51.jpeg",
        "use_twitter_card": "T",
        "robots_text": "User-agent: *\nDisallow: /admin\nDisallow: /api\nAllow: /\nUser-agent: bingbot\nCrawl-delay: 10",
        "mobile_robots_text": "User-agent: *\nDisallow: /admin\nDisallow: /api\nAllow: /\nUser-agent: bingbot\nCrawl-delay: 10",
        "use_missing_page_redirect": "T",
        "missing_page_redirect_url": "/",
        "mobile_use_missing_page_redirect": "F",
        "mobile_missing_page_redirect_url": "/",
        "use_sitemap_auto_update": "T",
        "use_rss": "T",
        "display_group": 3,
        "header_tag": "<meta name=\"googlebot\" content=\"noindex\"><meta name=\"googlebot-news\" content=\"nosnippet\">",
        "footer_tag": "",
        "mobile_header_tag": "<meta name=\"googlebot\" content=\"noindex\"><meta name=\"googlebot-news\" content=\"nosnippet\">",
        "mobile_footer_tag": "",
        "og_main": {
            "site_name": "Sample Mall",
            "title": "[MALL_NAME]",
            "description": "Welcome to Sample Mall"
        },
        "og_product": {
            "site_name": "Sample Mall",
            "title": "[PRODUCT_NAME] - [MALL_NAME]",
            "description": "[PRODUCT_SUMMARY]"
        },
        "og_category": {
            "site_name": "Sample Mall",
            "title": "[CATEGORY_NAME] - [MALL_NAME]",
            "description": "[CATEGORY_NAME] category products"
        },
        "og_board": {
            "site_name": "Sample Mall",
            "title": "[BOARD_TITLE] - [MALL_NAME]",
            "description": "[BOARD_CONTENT]"
        },
        "llms_text": "AI LLM crawlers may access public content only;\nsensitive areas such as orders, payments, and member data are prohibited."
    }
}
```

### `PUT /api/v2/admin/seo/setting` — Update store SEO settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-store-seo-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `common_page_title` |  |  |  | 공통페이지 title 태그 |
| `common_page_meta_description` |  |  |  | 공통페이지 description 태그 |
| `favicon` |  | URL |  | 파비콘 |
| `use_google_search_console` |  |  |  | 구글 서치 콘솔 사용여부 T : 사용함 · F : 사용안함 |
| `google_search_console` |  |  |  | 구글 서치 콘솔 |
| `use_naver_search_advisor` |  |  |  | 네이버 서치 어드바이저 사용여부 T : 사용함 · F : 사용안함 |
| `naver_search_advisor` |  |  |  | 네이버 서치 어드바이저 |
| `sns_share_image` |  | URL |  | SNS 공유 이미지 |
| `use_twitter_card` |  |  |  | 트위터 카드 사용여부 T : 사용함 · F : 사용안함 |
| `robots_text` |  |  |  | 검색로봇 접근 제어(PC) |
| `mobile_robots_text` |  |  |  | 검색로봇 접근 제어(모바일) |
| `use_missing_page_redirect` |  |  |  | 없는 페이지 연결 리다이렉션 여부(PC) T : 사용함 · F : 사용안함 |
| `missing_page_redirect_url` |  |  |  | 없는 페이지 연결 리다이렉션 연결 경로(PC) |
| `mobile_use_missing_page_redirect` |  |  |  | 없는 페이지 연결 리다이렉션 여부(모바일) T : 사용함 · F : 사용안함 |
| `mobile_missing_page_redirect_url` |  |  |  | 없는 페이지 연결 리다이렉션 연결 경로(모바일) |
| `use_sitemap_auto_update` |  |  |  | 사이트맵 사용여부 T : 사용함 · F : 사용안함 |
| `use_rss` |  |  |  | RSS 피드 사용여부 T : 사용함 · F : 사용안함 |
| `display_group` |  |  |  | 메인분류 명 |
| `header_tag` |  |  |  | Head HTML(PC) |
| `footer_tag` |  |  |  | Body HTML(PC) |
| `mobile_header_tag` |  |  |  | Head HTML(모바일) |
| `mobile_footer_tag` |  |  |  | Body HTML(모바일) |
| `og_main` |  |  |  | 메인 화면 설정 |
| ↳ `site_name` |  |  |  | 사이트 이름 |
| ↳ `title` |  |  |  | 제목 |
| ↳ `description` |  |  |  | 페이지 설명 |
| `og_product` |  |  |  | 상품 상세 설정 |
| ↳ `site_name` |  |  |  | 사이트 이름 |
| ↳ `title` |  |  |  | 제목 |
| ↳ `description` |  |  |  | 페이지 설명 |
| `og_category` |  |  |  | 상품 분류 설정 |
| ↳ `site_name` |  |  |  | 사이트 이름 |
| ↳ `title` |  |  |  | 제목 |
| ↳ `description` |  |  |  | 페이지 설명 |
| `og_board` |  |  |  | 게시판 설정 |
| ↳ `site_name` |  |  |  | 사이트 이름 |
| ↳ `title` |  |  |  | 제목 |
| ↳ `description` |  |  |  | 페이지 설명 |
| `llms_text` |  |  |  | AI 크롤러 접근 제어 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `seo` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `common_page_title` |  | 공통페이지 title 태그 |
| ↳ `common_page_meta_description` |  | 공통페이지 description 태그 |
| ↳ `favicon` | URL | 파비콘 |
| ↳ `use_google_search_console` |  | 구글 서치 콘솔 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `google_search_console` |  | 구글 서치 콘솔 |
| ↳ `use_naver_search_advisor` |  | 네이버 서치 어드바이저 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `naver_search_advisor` |  | 네이버 서치 어드바이저 |
| ↳ `sns_share_image` | URL | SNS 공유 이미지 |
| ↳ `use_twitter_card` |  | 트위터 카드 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `robots_text` |  | 검색로봇 접근 제어(PC) |
| ↳ `mobile_robots_text` |  | 검색로봇 접근 제어(모바일) |
| ↳ `use_missing_page_redirect` |  | 없는 페이지 연결 리다이렉션 여부(PC) T : 사용함 · F : 사용안함 |
| ↳ `missing_page_redirect_url` |  | 없는 페이지 연결 리다이렉션 연결 경로(PC) |
| ↳ `mobile_use_missing_page_redirect` |  | 없는 페이지 연결 리다이렉션 여부(모바일) T : 사용함 · F : 사용안함 |
| ↳ `mobile_missing_page_redirect_url` |  | 없는 페이지 연결 리다이렉션 연결 경로(모바일) |
| ↳ `use_sitemap_auto_update` |  | 사이트맵 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `use_rss` |  | RSS 피드 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `display_group` |  | 메인분류 명 |
| ↳ `header_tag` |  | Head HTML(PC) |
| ↳ `footer_tag` |  | Body HTML(PC) |
| ↳ `mobile_header_tag` |  | Head HTML(모바일) |
| ↳ `mobile_footer_tag` |  | Body HTML(모바일) |
| ↳ `og_main` |  | 메인 화면 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `og_product` |  | 상품 상세 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `og_category` |  | 상품 분류 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `og_board` |  | 게시판 설정 |
| ↳ ↳ `site_name` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ ↳ `description` |  |  |
| ↳ `llms_text` |  | AI 크롤러 접근 제어 |

응답 예시 (JSON):

```json
{
    "seo": {
        "shop_no": 1,
        "common_page_title": "Sample mall | Outerwear, Tops, Dresses, Bottoms, Accessories",
        "common_page_meta_description": "Sample mall | Outerwear, Tops, Dresses, Bottoms, Accessories",
        "favicon": "https://sample.cafe24.com/web/upload/favicon-b8141fe545ef3dda08cfd2d6ec5a9972.ico",
        "use_google_search_console": "T",
        "google_search_console": "<meta name=\"google-site-verification\" content=\"code\" />",
        "use_naver_search_advisor": "T",
        "naver_search_advisor": "<meta name=\"naver-site-verification\" content=\"code\" />",
        "sns_share_image": "https://sample.cafe24.com/web/upload/share-image-1-974433be4123fea4fa711fd0443a0b51.jpeg",
        "use_twitter_card": "T",
        "robots_text": "User-agent: *\nDisallow: /admin\nDisallow: /api\nAllow: /\nUser-agent: bingbot\nCrawl-delay: 10",
        "mobile_robots_text": "User-agent: *\nDisallow: /admin\nDisallow: /api\nAllow: /\nUser-agent: bingbot\nCrawl-delay: 10",
        "use_missing_page_redirect": "T",
        "missing_page_redirect_url": "/",
        "mobile_use_missing_page_redirect": "T",
        "mobile_missing_page_redirect_url": "/",
        "use_sitemap_auto_update": "T",
        "use_rss": "T",
        "display_group": 3,
        "header_tag": "<meta name=\"googlebot\" content=\"noindex\"><meta name=\"googlebot-news\" content=\"nosnippet\">",
        "footer_tag": "",
        "mobile_header_tag": "<meta name=\"googlebot\" content=\"noindex\"><meta name=\"googlebot-news\" content=\"nosnippet\">",
        "mobile_footer_tag": "",
        "og_main": {
            "site_name": "Sample Mall",
            "title": "[MALL_NAME]",
            "description": "Welcome to Sample Mall"
        },
        "og_product": {
            "site_name": "Sample Mall",
            "title": "[PRODUCT_NAME] - [MALL_NAME]",
            "description": "[PRODUCT_SUMMARY]"
        },
        "og_category": {
            "site_name": "Sample Mall",
            "title": "[CATEGORY_NAME] - [MALL_NAME]",
            "description": "[CATEGORY_NAME] category products"
        },
        "og_board": {
            "site_name": "Sample Mall",
            "title": "[BOARD_TITLE] - [MALL_NAME]",
            "description": "[BOARD_CONTENT]"
        },
        "llms_text": "AI LLM crawlers may access public content only;\nsensitive areas such as orders, payments, and member data are prohibited."
    }
}
```
