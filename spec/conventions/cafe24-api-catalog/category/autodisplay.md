---
resource: category
entity: autodisplay
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#autodisplay
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Category / Autodisplay

> Field-level 카탈로그. Endpoint enumeration index: [`../category.md`](../category.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Autodisplay](https://developers.cafe24.com/docs/ko/api/admin/#autodisplay)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

자동 진열(Autodisplay)은 상품 분류에 특정 조건에 따라 상품을 자동으로 진열해주는 기능입니다. · 예를 들어 가장 판매량이 높은 순서대로 상품을 진열하거나 좋아요 수가 높은 수 등으로 진열되도록 설정할 수 있습니다. · 해당 리소스에서는 자동 진열 조건을 생성하거나, 수정, 삭제하고 자동 진열 조건을 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `display_no` |  | 자동진열 번호 |
| `use_main` |  | 메인분류 여부 T: 메인분류 · F: 상품분류 |
| `category_no` |  | 분류 번호 |
| `display_group` |  | 상세 상품분류 |
| `display_count` | 최소: [1]~최대: [200] | 자동진열 최대 상품 수 |
| `use_reservation` |  | 예약진열 사용여부 T: 사용함 · F: 사용안함 |
| `start_date` |  | 예약 시작일 |
| `use_hashtag` |  | 해시태그 사용여부 T: 사용함 · F: 사용안함 |
| `hash_tags` |  | 해시태그 |
| `display_sort` |  | 정렬순서 AOD: 주문 수 높은 순서대로 · AOA: 주문 수 낮은 순서대로 · AVD: 조회 수 높은 순서대로 · AVA: 조회 수 낮은 순서대로 · ARD: 주문율 높은 순서대로 · ARA: 주문율 낮은 순서대로 · ACD: 클릭 가치 높은 순서대로 · AND: 신규 등록된 순서대로 · APD: 판매가 높은 순서대로 · APA: 판매가 낮은 순서대로 · RD : 최근 등록상품이 위로 · RA : 최근 등록상품이 아래로 · UD : 최근 수정상품이 위로 · UA : 최근 수정상품이 아래로 · NA : 상품명 가나다순 · ND : 상품명 가나다역순 · PD : 판매가 높은 상품이 위로 · PA : 판매가 높은 상품이 아래로 · SD : 판매량 높은 상품이 위로 · SA : 판매량 높은 상품이 아래로 · CD : 조회수가 높은 상품이 위로 · CA : 조회수가 높은 상품이 아래로 · LD : 좋아요수가 높은 상품이 위로 · LA : 좋아요수가 높은 상품이 아래로 |
| `timetable` | 배열 최대사이즈: [24] | 업데이트 시간 |
| `period` |  | 데이터 집계 기간 1: 1일 · 3: 3일 · 7: 1주(7일) · 30: 30일 |
| `except_categories_scope` |  | 제외 분류 설정 A: 모든 분류에 적용 · C : 이 분류만 적용 |
| `except_categories` |  | 제외 분류 |

## Operations

### `GET /api/v2/admin/autodisplay` — Retrieve a list of auto layouts

- **Scope**: `mall.read_category` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_no` |  |  |  | 자동진열 번호 |

### `POST /api/v2/admin/autodisplay` — Create auto layout for selected product category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `use_main` | ✓ |  |  | 메인분류 여부 T: 메인분류 · F: 상품분류 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `display_group` | ✓ |  |  | 상세 상품분류 |
| `display_count` | ✓ | 최소: [1]~최대: [200] |  | 자동진열 최대 상품 수 |
| `use_reservation` | ✓ |  |  | 예약진열 사용여부 T: 사용함 · F: 사용안함 |
| `start_date` |  |  |  | 예약 시작일 |
| `use_hashtag` | ✓ |  |  | 해시태그 사용여부 T: 사용함 · F: 사용안함 |
| `hash_tags` |  |  |  | 해시태그 |
| `display_sort` |  |  |  | 정렬순서 정렬 조건(RD, RA, UD, UA, NA, ND, PD, PA, SD, SA, AD, AA, LD, LA)은 use_hashtag가 "T"일 경우에만 사용 가능 AOD: 주문 수 높은 순서대로 · AOA: 주문 수 낮은 순서대로 · AVD: 조회 수 높은 순서대로 · AVA: 조회 수 낮은 순서대로 · ARD: 주문율 높은 순서대로 · ARA: 주문율 낮은 순서대로 · ACD: 클릭 가치 높은 순서대로 · AND: 신규 등록된 순서대로 · APD: 판매가 높은 순서대로 · APA: 판매가 낮은 순서대로 · RD : 최근 등록상품이 위로 · RA : 최근 등록상품이 아래로 · UD : 최근 수정상품이 위로 · UA : 최근 수정상품이 아래로 · NA : 상품명 가나다순 · ND : 상품명 가나다역순 · PD : 판매가 높은 상품이 위로 · PA : 판매가 높은 상품이 아래로 · SD : 판매량 높은 상품이 위로 · SA : 판매량 높은 상품이 아래로 · CD : 조회수가 높은 상품이 위로 · CA : 조회수가 높은 상품이 아래로 · LD : 좋아요수가 높은 상품이 위로 · LA : 좋아요수가 높은 상품이 아래로 |
| `timetable` |  | 배열 최대사이즈: [24] |  | 업데이트 시간 |
| `period` |  |  |  | 데이터 집계 기간 1: 1일 · 3: 3일 · 7: 1주(7일) · 30: 30일 |
| `except_categories_scope` |  |  | A | 제외 분류 설정 A: 모든 분류에 적용 · C : 이 분류만 적용 |
| `except_categories` |  |  |  | 제외 분류 |

### `PUT /api/v2/admin/autodisplay/{display_no}` — Update auto layout for selected product category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_no` | ✓ |  |  | 자동진열 번호 |
| `display_count` |  | 최소: [1]~최대: [200] |  | 자동진열 최대 상품 수 |
| `use_reservation` |  |  |  | 예약진열 사용여부 T: 사용함 · F: 사용안함 |
| `start_date` |  |  |  | 예약 시작일 |
| `use_hashtag` |  |  |  | 해시태그 사용여부 T: 사용함 · F: 사용안함 |
| `hash_tags` |  |  |  | 해시태그 |
| `display_sort` |  |  |  | 정렬순서 정렬 조건(RD, RA, UD, UA, NA, ND, PD, PA, SD, SA, AD, AA, LD, LA)은 use_hashtag가 "T"일 경우에만 사용 가능 AOD: 주문 수 높은 순서대로 · AOA: 주문 수 낮은 순서대로 · AVD: 조회 수 높은 순서대로 · AVA: 조회 수 낮은 순서대로 · ARD: 주문율 높은 순서대로 · ARA: 주문율 낮은 순서대로 · ACD: 클릭 가치 높은 순서대로 · AND: 신규 등록된 순서대로 · APD: 판매가 높은 순서대로 · APA: 판매가 낮은 순서대로 · RD : 최근 등록상품이 위로 · RA : 최근 등록상품이 아래로 · UD : 최근 수정상품이 위로 · UA : 최근 수정상품이 아래로 · NA : 상품명 가나다순 · ND : 상품명 가나다역순 · PD : 판매가 높은 상품이 위로 · PA : 판매가 높은 상품이 아래로 · SD : 판매량 높은 상품이 위로 · SA : 판매량 높은 상품이 아래로 · CD : 조회수가 높은 상품이 위로 · CA : 조회수가 높은 상품이 아래로 · LD : 좋아요수가 높은 상품이 위로 · LA : 좋아요수가 높은 상품이 아래로 |
| `timetable` |  | 배열 최대사이즈: [24] |  | 업데이트 시간 |
| `period` |  |  |  | 데이터 집계 기간 1: 1일 · 3: 3일 · 7: 1주(7일) · 30: 30일 |
| `except_categories_scope` |  |  |  | 제외 분류 설정 A: 모든 분류에 적용 · C : 이 분류만 적용 |
| `except_categories` |  |  |  | 제외 분류 |

### `DELETE /api/v2/admin/autodisplay/{display_no}` — Delete auto layout for selected product category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_no` | ✓ |  |  | 자동진열 번호 |
