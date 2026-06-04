---
resource: store
entity: menus
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#menus
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Menus

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Menus](https://developers.cafe24.com/docs/ko/api/admin/#menus)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

메뉴(Menus)는 쇼핑몰의 메뉴 모드에 관한 기능입니다. · 쇼핑몰의 메뉴 모드와 경로 등을 조회할 수 있습니다. · 쇼핑몰의 메뉴 모드로는 프로모드, 스마트모드, 모바일 어드민이 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `mode` |  | 메뉴 모드 new_pro: PC 어드민 · mobile_admin : 모바일 어드민 |
| `menu_no` |  | 메뉴 번호 |
| `name` |  | 메뉴명 |
| `path` |  | 메뉴 경로 |
| `contains_app_url` |  | 앱 URL 포함 여부 T : 포함 · F : 미포함 |

## Operations

### `GET /api/v2/admin/menus` — Retrieve menus

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-menus

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `mode` |  |  | new_pro | 메뉴 모드 new_pro: PC 어드민 · mobile_admin : 모바일 어드민 |
| `menu_no` |  |  |  | 메뉴 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `contains_app_url` |  |  |  | 앱 URL 포함 여부 T : 포함 · F : 미포함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `menus` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `mode` |  | 메뉴 모드 new_pro: PC 어드민 · mobile_admin : 모바일 어드민 |
| ↳ `menu_no` |  | 메뉴 번호 |
| ↳ `name` |  | 메뉴명 |
| ↳ `path` |  | 메뉴 경로 |
| ↳ `contains_app_url` |  | 앱 URL 포함 여부 T : 포함 · F : 미포함 |

응답 예시 (JSON):

```json
{
    "menus": [
        {
            "shop_no": 1,
            "mode": "new_pro",
            "menu_no": "2",
            "name": "Themes (PC)",
            "path": "https://sample.cafe24.com/disp/admin/shop1/Manage/Index",
            "contains_app_url": "F"
        },
        {
            "shop_no": 1,
            "mode": "new_pro",
            "menu_no": "78",
            "name": "Returns",
            "path": "https://sample.cafe24.com/admin/php/shop1/s_new/order_returns.php",
            "contains_app_url": "T"
        }
    ]
}
```
