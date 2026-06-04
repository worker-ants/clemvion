---
resource: application
entity: scripttags
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#scripttags
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Application / Scripttags

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Scripttags](https://developers.cafe24.com/docs/ko/api/admin/#scripttags)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

스크립트태그(Scripttags)는 앱에서 쇼핑몰의 특정 화면(Page)에 스크립트를 설치하기 위해 사용할 수 있는 기능입니다. · 스크립트 API를 사용해 쇼핑몰의 디자인을 변경하지 않고 쇼핑몰 화면에 스크립트를 쉽게 추가할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `script_no` |  | script의 고유번호 스크립트의 고유 번호 |
| `client_id` |  | Client ID 스크립트를 설치한 Client의 ID |
| `src` | URL | 원본 script 경로 설치할 스크립트의 원본 경로(절대 경로) |
| `display_location` |  | 화면 경로 스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함. · (예 : 상품분류(product_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨) · 화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 [쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정']에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음. · "all" 일 경우 전체 페이지에 스크립트가 적용됨. · display_location_code |
| `exclude_path` |  | 제외 경로 |
| `skin_no` |  | 스킨 번호 스크립트를 적용할 스킨 번호 |
| `integrity` |  | 하위 리소스 무결성 스크립트 위변조를 방지하기위한 무결성 검증용 해시. (sha384, sha512 해시 알고리즘 지원) · Integrity 해시 생성방법 참고 |
| `created_date` |  | 생성일 스크립트 설치 날짜 |
| `updated_date` |  | 수정일 스크립트 수정 날짜 |

## Operations

### `GET /api/v2/admin/scripttags` — Retrieve a list of script tags

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-script-tags

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `script_no` |  |  |  | script의 고유번호 스크립트의 고유 번호 검색 |
| `src` |  | URL |  | 원본 script 경로 원본 스크립트 경로 검색 |
| `display_location` |  |  |  | 화면 경로 스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함. · (예 : 상품분류(product_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨) · 화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 [쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정']에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음. · "all" 일 경우 전체 페이지에 스크립트가 적용됨. · display_location_code ,(콤마)로 여러 건을 검색할 수 있다. |
| `exclude_path` |  |  |  | 제외 경로 ,(콤마)로 여러 건을 검색할 수 있다. |
| `skin_no` |  |  |  | 스킨 번호 스크립트를 적용할 스킨 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `integrity` |  |  |  | 하위 리소스 무결성 |
| `created_start_date` |  | 날짜 |  | 스크립트 설치일 검색 시작일 스크립트 설치 날짜가 해당 날짜 이후인 스크립트 검색 · 검색 종료일과 같이 사용해야함. |
| `created_end_date` |  | 날짜 |  | 스크립트 설치일 검색 종료일 스크립트 설치 날짜가 해당 날짜 이전인 스크립트 검색 · 검색 시작일과 같이 사용해야함. |
| `updated_start_date` |  | 날짜 |  | 스크립트 수정일 검색 시작일 스크립트 수정 날짜가 해당 날짜 이후인 스크립트 검색 · 검색 종료일과 같이 사용해야함. |
| `updated_end_date` |  | 날짜 |  | 스크립트 수정일 검색 종료일 스크립트 수정 날짜가 해당 날짜 이전인 스크립트 검색 · 검색 시작일과 같이 사용해야함. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "scripttags": [
        {
            "shop_no": 1,
            "script_no": "1509432821494844",
            "client_id": "AMj8UZhBC9zsyTlFGI6PzC",
            "src": "https://yourdomain-sample.com/sample-script.js",
            "display_location": [
                "BOARD_FREE_LIST"
            ],
            "skin_no": [
                1,
                2
            ],
            "exclude_path": [
                "/board/free/list.html"
            ],
            "integrity": "sha384-UttGu98Tj02YSyWJ5yU0dHmx4wisywedBShWqEz+TL3vFOCXdeMWmo6jMVR8IdFo",
            "created_date": "2017-10-31T15:53:41+09:00",
            "updated_date": "2017-11-03T18:05:32+09:00"
        },
        {
            "shop_no": 1,
            "script_no": "1509699932016345",
            "client_id": "AMj8UZhBC9zsyTlFGI6PzC",
            "src": "https://yourdomain-sample.com/sample-script.js",
            "display_location": [
                "PRODUCT_LIST",
                "PRODUCT_DETAIL"
            ],
            "skin_no": null,
            "exclude_path": null,
            "integrity": "sha512-liS6Zvj8DUdCw4DyxdGvS3Bo1REcsEQBia6/MKKl2xgVGlUspT5MlCmFfdbtM32rwqwEgIUzJrgUYZFUsKcEeg==",
            "created_date": "2017-11-03T18:05:32+09:00",
            "updated_date": "2017-11-03T18:05:32+09:00"
        }
    ]
}
```

### `GET /api/v2/admin/scripttags/count` — Retrieve a count of script tags

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `script_no` |  |  |  | script의 고유번호 스크립트의 고유 번호 검색 |
| `src` |  | URL |  | 원본 script 경로 원본 스크립트 경로 검색 |
| `display_location` |  |  |  | 화면 경로 스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함. · (예 : 상품분류(product_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨) · 화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 [쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정']에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음. · "all" 일 경우 전체 페이지에 스크립트가 적용됨. · display_location_code |
| `skin_no` |  |  |  | 스킨 번호 스크립트를 적용할 스킨 번호. ,(콤마)로 여러 건을 검색할 수 있다. |
| `created_start_date` |  | 날짜 |  | 스크립트 설치일 검색 시작일 스크립트 설치 날짜가 해당 날짜 이후인 스크립트 검색 · 검색 종료일과 같이 사용해야함. |
| `created_end_date` |  | 날짜 |  | 스크립트 설치일 검색 종료일 스크립트 설치 날짜가 해당 날짜 이전인 스크립트 검색 · 검색 종료일과 같이 사용해야함. |
| `updated_start_date` |  | 날짜 |  | 스크립트 수정일 검색 시작일 스크립트 수정 날짜가 해당 날짜 이후인 스크립트 검색 · 검색 종료일과 같이 사용해야함. |
| `updated_end_date` |  | 날짜 |  | 스크립트 수정일 검색 종료일 스크립트 수정 날짜가 해당 날짜 이전인 스크립트 검색 · 검색 시작일과 같이 사용해야함. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 2
}
```

### `GET /api/v2/admin/scripttags/{script_no}` — Retrieve a script tag

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `script_no` |  |  |  | script의 고유번호 스크립트의 고유 번호 검색 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "scripttag": {
        "shop_no": 1,
        "script_no": "1509699932016345",
        "client_id": "AMj8UZhBC9zsyTlFGI6PzC",
        "src": "https://yourdomain-sample.com/sample-script.js",
        "display_location": [
            "PRODUCT_LIST",
            "PRODUCT_DETAIL"
        ],
        "exclude_path": [
            "/product/list.html",
            "/product/detail.html"
        ],
        "skin_no": [
            3,
            4
        ],
        "integrity": "sha384-UttGu98Tj02YSyWJ5yU0dHmx4wisywedBShWqEz+TL3vFOCXdeMWmo6jMVR8IdFo",
        "created_date": "2017-11-03T18:05:32+09:00",
        "updated_date": "2017-11-03T18:05:32+09:00"
    }
}
```

### `POST /api/v2/admin/scripttags` — Create a script tag

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 10
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `src` |  | URL |  | 원본 script 경로 설치할 스크립트의 원본 경로(절대 경로) |
| `display_location` | ✓ |  |  | 화면 경로 스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함. · (예 : 상품분류(product_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨) · 화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 [쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정']에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음. · "all" 일 경우 전체 페이지에 스크립트가 적용됨. · display_location_code |
| `exclude_path` |  |  |  | 제외 경로 |
| `skin_no` |  |  |  | 스킨 번호 스크립트를 적용할 스킨 번호. |
| `integrity` |  |  |  | 하위 리소스 무결성 스크립트 위변조를 방지하기위한 무결성 검증용 해시. (sha384, sha512 해시 알고리즘 지원) · Integrity 해시 생성방법 참고 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "scripttag": {
        "shop_no": 1,
        "script_no": "1527128695613925",
        "client_id": "AMj8UZhBC9zsyTlFGI6PzC",
        "src": "https://yourdomain-sample.com/sample-script.js",
        "display_location": [
            "PRODUCT_LIST",
            "PRODUCT_DETAIL"
        ],
        "exclude_path": [
            "/product/list.html",
            "/product/detail.html"
        ],
        "skin_no": [
            3,
            4
        ],
        "integrity": "sha384-UttGu98Tj02YSyWJ5yU0dHmx4wisywedBShWqEz+TL3vFOCXdeMWmo6jMVR8IdFo",
        "created_date": "2017-03-15T13:27:53+09:00",
        "updated_date": "2017-03-15T13:27:53+09:00"
    }
}
```

### `PUT /api/v2/admin/scripttags/{script_no}` — Update a script tag

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 10
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `script_no` | ✓ |  |  | script의 고유번호 스크립트의 고유 번호 |
| `src` |  | URL |  | 원본 script 경로 설치할 스크립트의 원본 경로(절대 경로) |
| `display_location` |  |  |  | 화면 경로 스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함. · (예 : 상품분류(product_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨) · 화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 [쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정']에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음. · "all" 일 경우 전체 페이지에 스크립트가 적용됨. · display_location_code |
| `exclude_path` |  |  |  | 제외 경로 |
| `skin_no` |  |  |  | 스킨 번호 스크립트를 적용할 스킨 번호. |
| `integrity` |  |  |  | 하위 리소스 무결성 스크립트 위변조를 방지하기위한 무결성 검증용 해시. (sha384, sha512 해시 알고리즘 지원) · Integrity 해시 생성방법 참고 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "scripttag": {
        "shop_no": 1,
        "script_no": "1509432821494844",
        "client_id": "AMj8UZhBC9zsyTlFGI6PzC",
        "src": "https://yourdomain-sample.com/sample-script.js",
        "display_location": [
            "PRODUCT_LIST",
            "PRODUCT_DETAIL"
        ],
        "exclude_path": [
            "/product/list.html",
            "/product/detail.html"
        ],
        "skin_no": [
            3,
            4
        ],
        "integrity": "sha384-UttGu98Tj02YSyWJ5yU0dHmx4wisywedBShWqEz+TL3vFOCXdeMWmo6jMVR8IdFo",
        "created_date": "2017-10-31T15:53:41+09:00",
        "updated_date": "2017-11-06T10:33:57+09:00"
    }
}
```

### `DELETE /api/v2/admin/scripttags/{script_no}` — Delete a script tag

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `script_no` | ✓ |  |  | script의 고유번호 스크립트의 고유 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "scripttag": {
        "script_no": "1509699932016345"
    }
}
```
