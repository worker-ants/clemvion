---
resource: category
entity: mains
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#mains
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Category / Mains

> Field-level 카탈로그. Endpoint enumeration index: [`../category.md`](../category.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Mains](https://developers.cafe24.com/docs/ko/api/admin/#mains)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

메인분류(Mains)는 쇼핑몰의 상품을 메인화면에 진열할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `module_code` |  | 모듈 코드 각 메인분류에 지정된 모듈 코드 |
| `display_group` |  | 메인분류 번호 |
| `group_name` |  | 메인분류 명 메인분류 생성 당시 지정한 분류명 |
| `soldout_sort_type` |  | 품절상품진열 품절상품을 진열할 위치 |
| `use_autodisplay` |  | 자동진열 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/mains` — Retrieve a list of main categories

- **Scope**: `mall.read_category` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `mains` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `module_code` |  | 모듈 코드 각 메인분류에 지정된 모듈 코드 |
| ↳ `display_group` |  | 메인분류 번호 |
| ↳ `group_name` |  | 메인분류 명 메인분류 생성 당시 지정한 분류명 |
| ↳ `soldout_sort_type` |  | 품절상품진열 품절상품을 진열할 위치 |
| ↳ `use_autodisplay` |  | 자동진열 T : 사용함 · F : 사용안함 |

응답 예시 (JSON):

```json
{
    "mains": [
        {
            "shop_no": 1,
            "module_code": "product_listmain_1",
            "display_group": 2,
            "group_name": "Main Recommendations",
            "soldout_sort_type": "B",
            "use_autodisplay": "T"
        },
        {
            "shop_no": 1,
            "module_code": "product_listmain_2",
            "display_group": 3,
            "group_name": "New Arrival",
            "soldout_sort_type": "N",
            "use_autodisplay": "F"
        }
    ]
}
```

### `POST /api/v2/admin/mains` — Add main category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#add-main-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `group_name` | ✓ | 최대글자수 : [50자] |  | 메인분류 명 |
| `soldout_sort_type` |  |  | N | 품절상품진열 B : 품절상품 맨 뒤로 · N : 품절상품 상관없음 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `mains` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `module_code` |  | 모듈 코드 각 메인분류에 지정된 모듈 코드 |
| ↳ `display_group` |  | 메인분류 번호 |
| ↳ `group_name` |  | 메인분류 명 메인분류 생성 당시 지정한 분류명 |
| ↳ `soldout_sort_type` |  | 품절상품진열 품절상품을 진열할 위치 |

응답 예시 (JSON):

```json
{
    "mains": {
        "shop_no": 1,
        "module_code": "product_listmain_1",
        "display_group": 2,
        "group_name": "Main Recommendations",
        "soldout_sort_type": "B"
    }
}
```

### `PUT /api/v2/admin/mains/{display_group}` — Update main category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-main-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_group` | ✓ |  |  | 메인분류 번호 |
| `group_name` |  | 최대글자수 : [50자] |  | 메인분류 명 |
| `soldout_sort_type` |  |  |  | 품절상품진열 B : 품절상품 맨 뒤로 · N : 품절상품 상관없음 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `mains` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `module_code` |  | 모듈 코드 각 메인분류에 지정된 모듈 코드 |
| ↳ `display_group` |  | 메인분류 번호 |
| ↳ `group_name` |  | 메인분류 명 메인분류 생성 당시 지정한 분류명 |
| ↳ `soldout_sort_type` |  | 품절상품진열 품절상품을 진열할 위치 |

응답 예시 (JSON):

```json
{
    "mains": {
        "shop_no": 1,
        "module_code": "product_listmain_1",
        "display_group": 2,
        "group_name": "Main Recommendations",
        "soldout_sort_type": "B"
    }
}
```

### `DELETE /api/v2/admin/mains/{display_group}` — Delete main category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_group` | ✓ |  |  | 메인분류 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `mains` |  | (응답 객체) |
| ↳ `display_group` |  | 메인분류 번호 |

응답 예시 (JSON):

```json
{
    "mains": {
        "display_group": 6
    }
}
```
