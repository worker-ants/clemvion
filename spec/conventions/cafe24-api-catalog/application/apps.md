---
resource: application
entity: apps
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#apps
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Application / Apps

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Apps](https://developers.cafe24.com/docs/ko/api/admin/#apps)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

앱(Apps)는 앱의 정보를 조회하고 수정할 수 있는 리소스입니다. · 해당 정보는 앱의 정보이므로, 서로 다른 쇼핑몰에서 호출해도 동일한 정보가 조회되는게 특징입니다. · 앱의 버전 정보를 조회하거나 앱의 버전을 API를 통해 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `version` |  | 버전 |
| `version_expiration_date` |  | 버전 만료일 |
| `initial_version` |  | 최초 버전 |
| `previous_version` |  | 이전 버전 |
| `extension_type` |  | 확장 타입 section : 섹션(쇼핑몰 프론트에 html 삽입이 필요한 앱 타입) · embedded : 임베디드(쇼핑몰 프론트에 임베디드되어 자동으로 구동되는 앱 타입) |

## Operations

### `GET /api/v2/admin/apps` — Retrieve an app information

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-app-information

_요청 파라미터 없음._

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "app": {
        "version": "2020-03-01",
        "version_expiration_date": null,
        "initial_version": "2019-06-26",
        "previous_version": "2019-12-11",
        "extension_type": "section"
    }
}
```

### `PUT /api/v2/admin/apps` — Update an app information

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `version` |  |  |  | 버전 |
| `extension_type` |  |  |  | 확장 타입 section : 섹션(쇼핑몰 프론트에 html 삽입이 필요한 앱 타입) · embedded : 임베디드(쇼핑몰 프론트에 임베디드되어 자동으로 구동되는 앱 타입) |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "app": {
        "version": "2019-12-11",
        "extension_type": "section"
    }
}
```
