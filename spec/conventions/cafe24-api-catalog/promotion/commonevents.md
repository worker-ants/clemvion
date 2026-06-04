---
resource: promotion
entity: commonevents
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#commonevents
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Promotion / Commonevents

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Commonevents](https://developers.cafe24.com/docs/ko/api/admin/#commonevents)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `event_no` |  | 이벤트 번호 |
| `name` |  | 이벤트 이름 |
| `status` |  | 이벤트 상태 |
| `category_no` |  | 카테고리 번호 |
| `register_date` |  | 등록일 |
| `display_position` |  | 표시 위치 |
| `content` |  | 내용 |

## Operations

### `GET /api/v2/admin/commonevents` — Retrieve a list of storewide promotions

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-storewide-promotions

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `limit` |  | 최대값: [100] | 20 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] |  | 조회결과 시작위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `commonevents` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `event_no` |  | 이벤트 번호 |
| ↳ `name` |  | 이벤트 이름 |
| ↳ `status` |  | 이벤트 상태 |
| ↳ `category_no` |  | 카테고리 번호 |
| ↳ `register_date` |  | 등록일 |
| `links` |  | (목록) |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "commonevents": [
        {
            "shop_no": 1,
            "event_no": 3,
            "name": "Outwear Common Event",
            "status": "T",
            "category_no": 24,
            "register_date": "2025-08-18 11:05:01"
        },
        {
            "shop_no": 1,
            "event_no": 2,
            "name": "All Common Event",
            "status": "T",
            "category_no": 0,
            "register_date": "2025-08-18 11:01:54"
        }
    ],
    "links": [
        {
            "rel": "prev",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/commonevents?limit=10&offset=0"
        },
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/commonevents?limit=10&offset=20"
        }
    ]
}
```

### `POST /api/v2/admin/commonevents` — Create a storewide promotion

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-storewide-promotion

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `name` | ✓ | 최대글자수 : [255자] |  | 이벤트 이름 |
| `status` |  |  | T | 이벤트 상태 T: 진행 · F: 진행안함 |
| `category_no` |  | 최소값: [0] | 0 | 카테고리 번호 0: 전체 |
| `display_position` |  |  | top_detail | 표시 위치 top_detail: 상품상세정보 위 · side_image: 상품이미지 옆 |
| `content` |  |  |  | 내용 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `commonevent` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `event_no` |  | 이벤트 번호 |
| ↳ `name` |  | 이벤트 이름 |
| ↳ `status` |  | 이벤트 상태 |
| ↳ `category_no` |  | 카테고리 번호 |
| ↳ `display_position` |  | 표시 위치 |
| ↳ `content` |  | 내용 |
| ↳ `register_date` |  | 등록일 |

응답 예시 (JSON):

```json
{
    "commonevent": {
        "shop_no": 1,
        "event_no": 4,
        "name": "Common Event",
        "status": "T",
        "category_no": 24,
        "display_position": "top_detail",
        "content": "Common Event Content",
        "register_date": "2025-08-21 11:05:01"
    }
}
```

### `PUT /api/v2/admin/commonevents/{event_no}` — Update a storewide promotion

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-storewide-promotion

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `event_no` | ✓ | 최소값: [1] |  | 이벤트 번호 |
| `name` |  | 최대글자수 : [255자] |  | 이벤트 이름 |
| `status` |  |  |  | 이벤트 상태 T: 진행 · F: 진행안함 |
| `category_no` |  | 최소값: [0] |  | 카테고리 번호 0: 전체 |
| `display_position` |  |  |  | 표시 위치 top_detail: 상품상세정보 위 · side_image: 상품이미지 옆 |
| `content` |  |  |  | 내용 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `commonevent` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `event_no` |  | 이벤트 번호 |
| ↳ `name` |  | 이벤트 이름 |
| ↳ `status` |  | 이벤트 상태 |
| ↳ `category_no` |  | 카테고리 번호 |
| ↳ `display_position` |  | 표시 위치 |
| ↳ `content` |  | 내용 |
| ↳ `register_date` |  | 등록일 |

응답 예시 (JSON):

```json
{
    "commonevent": {
        "shop_no": 1,
        "event_no": 123,
        "name": "Updated Event Name",
        "status": "T",
        "category_no": 24,
        "display_position": "top_detail",
        "content": "This is updated event content.",
        "register_date": "2025-08-21 11:20:30"
    }
}
```

### `DELETE /api/v2/admin/commonevents/{event_no}` — Delete a storewide promotion

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-storewide-promotion

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `event_no` | ✓ | 최소값: [1] |  | 이벤트 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `commonevent` |  | (응답 객체) |
| ↳ `event_no` |  | 이벤트 번호 |

응답 예시 (JSON):

```json
{
    "commonevent": {
        "event_no": 4
    }
}
```
