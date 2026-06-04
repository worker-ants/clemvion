---
resource: design
entity: icons
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#icons
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Design / Icons

> Field-level 카탈로그. Endpoint enumeration index: [`../design.md`](../design.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Icons](https://developers.cafe24.com/docs/ko/api/admin/#icons)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

디자인 아이콘은 상품, 게시판, 이벤트, 카드, 결제수단 로고로 사용 중인 작은 이미지입니다. · PC 쇼핑몰과 모바일 쇼핑몰의 아이콘을 모두 확인할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `id` |  | 아이콘 아이디 |
| `type` |  | 디자인 타입 pc : PC · mobile : 모바일 |
| `group_code` |  | 그룹 코드 A : 상품 아이콘 · B : 게시판 아이콘 · C : 카드 아이콘 · E : 이벤트 아이콘 |
| `path` |  | 아이콘 URL |
| `display` |  | 아이콘 노출여부 T : 노출함 · F : 노출안함 |
| `description` |  | 아이콘 설명 |

## Operations

### `GET /api/v2/admin/icons` — Retrieve a list of desgin icons

- **Scope**: `mall.read_design` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-desgin-icons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `type` |  |  | pc | 디자인 타입 pc : PC · mobile : 모바일 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "icons": [
        {
            "shop_no": 1,
            "id": 2,
            "type": "pc",
            "group_code": "A",
            "path": "https://img.echosting.cafe24.com/design/skin/admin/ko_KR/ico_product_point.gif",
            "display": "T",
            "description": "Points for purchase"
        },
        {
            "shop_no": 1,
            "id": 8,
            "type": "pc",
            "group_code": "A",
            "path": "https://img.echosting.cafe24.com/design/skin/admin/ko_KR/btn_prd_zoom.gif",
            "display": "T",
            "description": "Zoom-in"
        }
    ]
}
```

### `PUT /api/v2/admin/icons` — Update store icon settings

- **Scope**: `mall.write_design` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-store-icon-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `id` | ✓ | 최소값: [1] |  | 아이콘 아이디 |
| `group_code` | ✓ |  |  | 그룹 코드 A : 상품 아이콘 · B : 게시판 아이콘 · C : 카드 아이콘 · E : 이벤트 아이콘 |
| `type` |  |  | pc | 디자인 타입 pc : PC · mobile : 모바일 |
| `path` |  | URL |  | 아이콘 URL |
| `display` |  |  |  | 아이콘 노출여부 T : 노출함 · F : 노출안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "icons": {
        "shop_no": 1,
        "id": 3,
        "type": "pc",
        "group_code": "A",
        "path": "/web/upload/icon_202511241132420800.gif",
        "display": "T",
        "description": "Out of stock"
    }
}
```
