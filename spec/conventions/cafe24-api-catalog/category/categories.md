---
resource: category
entity: categories
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#categories
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Category / Categories

> Field-level 카탈로그. Endpoint enumeration index: [`../category.md`](../category.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Categories](https://developers.cafe24.com/docs/ko/api/admin/#categories)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품분류(Categories)는 쇼핑몰에 노출할 카테고리를 설정하는 기능입니다. · 상품분류는 대분류 하위에 중분류, 소분류, 상세 분류까지 세분화해서 설정할 수 있습니다. · 상품분류 리소스를 사용하면 쇼핑몰의 분류들을 조회하거나 분류를 생성, 수정, 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `category_no` |  | 분류 번호 상품분류의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품분류 번호는 중복되지 않음. |
| `category_depth` | 최소: [1]~최대: [4] | 분류 Depth 해당 상품분류가 하위 몇 차 상품분류에 있는 카테고리인지 표시함. 1~4차까지 상품분류가 존재한다. |
| `parent_category_no` |  | 부모 분류 번호 해당 상품분류가 2차(중분류), 3차(소분류), 4차(세분류)일 경우 상위에 있는 상품분류의 번호를 표시함. · parent_category_no = 1일 경우 해당 분류는 대분류를 의미한다. |
| `category_name` | 최대글자수 : [50자] | 분류명 해당 상품분류의 이름을 나타낸다. |
| `display_type` |  | 쇼핑몰 표시설정 해당 상품분류가 PC 쇼핑몰이나 모바일 쇼핑몰, 둘 다에 노출되는지 표시. A : PC + 모바일 · P : PC · M : 모바일 · F : 모두 사용안함 |
| `full_category_name` |  | 분류 전체 이름 해당 상품분류가 속해있는 상위 상품분류의 이름을 모두 표시. |
| `full_category_no` |  | 분류 전체 번호 해당 상품분류가 속해있는 상위 상품분류의 번호를 모두 표시. |
| `root_category_no` |  | 최상위 분류 번호 해당 상품분류가 속해있는 최상위 상품분류의 분류 번호 표시. |
| `use_main` |  | 메인분류 표시상태 해당 상품분류가 쇼핑몰 메인에 표시되는지 여부. 메인분류에 표시하는 경우 중/소/상세 분류도 대분류처럼 최상위에 표시된다. T : 표시함 · F : 표시안함 |
| `use_display` |  | 표시상태 해당 상품분류의 표시 여부. 표시안함 일 경우 해당 상품분류에 접근할 수 없다. · 해당 설정은 멀티쇼핑몰별로 설정할 수 없으며 모든 쇼핑몰에 적용된다. T : 표시함 · F : 표시안함 |
| `display_order` |  | 진열 순서 상품분류를 쇼핑몰 운영자가 배치한 순서. |
| `soldout_product_display` |  | 품절상품진열 품절 상품을 상품 분류의 맨 앞 또는 맨 뒤에 진열할 것인지 여부 · 상품의 품절 여부는 List all products를 통해 sold_out 파라메터로 알 수 있다. B : 품절상품 맨 뒤로 · N : 품절상품 상관없음 |
| `sub_category_product_display` |  | 하위분류 상품진열 현재 상품 분류 하위 분류에 진열된 상품들까지 포함하여 진열할 것인지 여부 T : 진열함 · F : 진열안함 |
| `hashtag_product_display` |  | 쇼핑 큐레이션 해시태그 상품진열 해시태그 상품 진열 기능을 사용할 것인지 여부 · ※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다. T : 진열함 · F : 진열안함 |
| `hash_tags` |  | 쇼핑 큐레이션 해시태그 해당 상품분류의 해시태그 목록 · ※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다. |
| `product_display_scope` |  | 상품분류 진열영역 구분 상품 분류에 상품을 동일하게 정렬할 것인지, 영역별로 정렬할 것인지 설정 · "전체"로 설정된 경우 다음 항목을 통해 정렬 설정 가능하다. · product_display_type · product_display_key · product_display_sort · product_display_period · "영역별"로 설정된 경우 다음 항목을 통해 영역별로 정렬 설정이 가능하다. · normal_product_display_type · normal_product_display_key · normal_product_display_sort · normal_product_display_period · recommend_product_display_type · recommend_product_display_key · recommend_product_display_sort · recommend_product_display_period · new_product_display_type · new_product_display_key · new_product_display_sort · new_product_display_period A : 전체 · G : 영역별 |
| `product_display_type` |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "전체"일 경우 해당 상품 분류의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `product_display_key` |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "전체"이고, 상품분류 진열방법이 "자동정렬" 또는 "자동정렬 + 사용자지정"일 경우 해당 상품 분류를 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `product_display_sort` |  | 상품분류 진열방법 순서 상품분류 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `product_display_period` |  | 진열순서에 대한 기간 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `normal_product_display_type` |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `normal_product_display_key` |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `normal_product_display_sort` |  | 상품분류 진열방법 순서 일반 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `normal_product_display_period` |  | 진열순서에 대한 기간 일반 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `recommend_product_display_type` |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `recommend_product_display_key` |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `recommend_product_display_sort` |  | 상품분류 진열방법 순서 추천 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `recommend_product_display_period` |  | 진열순서에 대한 기간 추천 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `new_product_display_type` |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `new_product_display_key` |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `new_product_display_sort` |  | 상품분류 진열방법 순서 신상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `new_product_display_period` |  | 진열순서에 대한 기간 신상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `access_authority` |  | 접근권한 F : 모두 이용 가능 · T : 회원만 이용가능 · G : 특정회원등급만 이용 가능 · A : 특정 운영자만 이용 가능 |

## Operations

### `GET /api/v2/admin/categories` — Retrieve a list of product categories

- **Scope**: `mall.read_category` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-categories

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `category_depth` |  | 최소: [1]~최대: [4] |  | 분류 Depth 조회하고자 하는 상품분류의 차수 검색 |
| `category_no` |  |  |  | 분류 번호 조회하고자 하는 상품분류의 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `parent_category_no` |  |  |  | 부모 분류 번호 조회하고자 하는 상품분류의 부모 상품분류 번호 검색 · 대분류만 검색하고자 할 경우 parent_category_no =1 로 검색한다. |
| `category_name` |  |  |  | 분류명 검색어를 분류명에 포함하고 있는 상품분류 검색 |
| `use_main` |  |  |  | 메인분류 표시상태 T : 표시함 · F : 표시안함 |
| `use_display` |  |  |  | 표시상태 T : 표시함 · F : 표시안함 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

### `GET /api/v2/admin/categories/count` — Retrieve a count of product categories

- **Scope**: `mall.read_category` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `category_depth` |  | 최소: [1]~최대: [4] |  | 분류 Depth 조회하고자 하는 상품분류의 차수 검색 |
| `category_no` |  |  |  | 분류 번호 조회하고자 하는 상품분류의 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `parent_category_no` |  |  |  | 부모 분류 번호 조회하고자 하는 상품분류의 부모 상품분류 번호 검색 · 대분류만 검색하고자 할 경우 parent_category_no =1 로 검색한다. |
| `category_name` |  |  |  | 분류명 검색어를 분류명에 포함하고 있는 상품분류 검색 |
| `use_main` |  |  |  | 메인분류 표시상태 T : 표시함 · F : 표시안함 |
| `use_display` |  |  |  | 표시상태 T : 표시함 · F : 표시안함 |

### `GET /api/v2/admin/categories/{category_no}` — Retrieve a product category

- **Scope**: `mall.read_category` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `category_no` | ✓ |  |  | 분류 번호 조회하고자 하는 상품분류의 번호 |

### `POST /api/v2/admin/categories` — Create a product category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `parent_category_no` |  |  |  | 부모 분류 번호 등록하고자 하는 상품분류의 부모 분류 번호 · 상품분류를 특정 분류 하위에 등록하고자 할 경우 해당 분류 번호를 입력하여 등록 가능하다. |
| `category_name` | ✓ |  |  | 분류명 해당 상품분류의 이름 |
| `shop_no` |  |  |  | 멀티쇼핑몰 번호 |
| `display_type` |  |  |  | 쇼핑몰 표시설정 해당 상품분류가 PC 쇼핑몰이나 모바일 쇼핑몰, 둘 다에 노출되는지 설정 A : PC + 모바일 · P : PC · M : 모바일 · F : 모두 사용안함 |
| `use_main` |  |  |  | 메인분류 표시상태 해당 상품분류가 쇼핑몰 메인에 표시되는지 여부. 메인분류에 표시하는 경우 중/소/상세 분류도 대분류처럼 최상위에 표시된다. T : 표시함 · F : 표시안함 |
| `use_display` |  |  |  | 표시상태 해당 상품분류의 표시 여부. 표시안함 일 경우 해당 상품분류에 접근할 수 없다. · 해당 설정은 멀티쇼핑몰별로 설정할 수 없으며 모든 쇼핑몰에 적용된다. T : 표시함 · F : 표시안함 |
| `soldout_product_display` |  |  |  | 품절상품진열 품절 상품을 상품 분류의 맨 앞 또는 맨 뒤에 진열할 것인지 여부 B : 품절상품 맨 뒤로 · N : 품절상품 상관없음 |
| `sub_category_product_display` |  |  |  | 하위분류 상품진열 현재 상품 분류 하위 분류에 진열된 상품들까지 포함하여 진열할 것인지 여부 T : 진열함 · F : 진열안함 |
| `hashtag_product_display` |  |  |  | 쇼핑 큐레이션 해시태그 상품진열 해시태그 상품 진열 기능을 사용할 것인지 여부 · ※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다. T : 진열함 · F : 진열안함 |
| `hash_tags` |  |  |  | 쇼핑 큐레이션 해시태그 해당 상품분류의 해시태그 목록 · ※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다. |
| `product_display_scope` |  |  |  | 상품분류 진열영역 구분 상품 분류에 상품을 동일하게 정렬할 것인지, 영역별로 정렬할 것인지 설정 · "전체"로 설정할 경우 다음 필드는 반드시 입력되어야 한다. · product_display_type · product_display_key · product_display_sort · product_display_period (key가 S, C일 때만 필수) · "영역별"로 설정할 경우 다음 필드는 반드시 입력되어야 한다. · normal_product_display_type · normal_product_display_key · normal_product_display_sort · normal_product_display_period (key가 S, C일 때만 필수) · recommend_product_display_type · recommend_product_display_key · recommend_product_display_sort · recommend_product_display_period (key가 S, C일 때만 필수) · new_product_display_type · new_product_display_key · new_product_display_sort · new_product_display_period (key가 S, C일 때만 필수) A : 전체 · G : 영역별 |
| `product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "전체"일 경우 해당 상품 분류의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "전체"이고, 상품분류 진열방법이 "자동정렬" 또는 "자동정렬 + 사용자지정"일 경우 해당 상품 분류를 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `product_display_sort` |  |  |  | 상품분류 진열방법 순서 상품분류 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `product_display_period` |  |  |  | 진열순서에 대한 기간 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `normal_product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `normal_product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `normal_product_display_sort` |  |  |  | 상품분류 진열방법 순서 일반 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `normal_product_display_period` |  |  |  | 진열순서에 대한 기간 일반 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `recommend_product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `recommend_product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `recommend_product_display_sort` |  |  |  | 상품분류 진열방법 순서 추천 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `recommend_product_display_period` |  |  |  | 진열순서에 대한 기간 추천 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `new_product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `new_product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `new_product_display_sort` |  |  |  | 상품분류 진열방법 순서 신상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `new_product_display_period` |  |  |  | 진열순서에 대한 기간 신상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |

### `PUT /api/v2/admin/categories/{category_no}` — Update a product category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `category_name` |  |  |  | 분류명 해당 상품분류의 이름 |
| `shop_no` |  |  |  | 멀티쇼핑몰 번호 |
| `display_type` |  |  |  | 쇼핑몰 표시설정 해당 상품분류가 PC 쇼핑몰이나 모바일 쇼핑몰, 둘 다에 노출되는지 설정 A : PC + 모바일 · P : PC · M : 모바일 · F : 모두 사용안함 |
| `use_main` |  |  |  | 메인분류 표시상태 해당 상품분류가 쇼핑몰 메인에 표시되는지 여부. 메인분류에 표시하는 경우 중/소/상세 분류도 대분류처럼 최상위에 표시된다. T : 표시함 · F : 표시안함 |
| `use_display` |  |  |  | 표시상태 해당 상품분류의 표시 여부. 표시안함 일 경우 해당 상품분류에 접근할 수 없다. · 해당 설정은 멀티쇼핑몰별로 설정할 수 없으며 모든 쇼핑몰에 적용된다. T : 표시함 · F : 표시안함 |
| `soldout_product_display` |  |  |  | 품절상품진열 품절 상품을 상품 분류의 맨 앞 또는 맨 뒤에 진열할 것인지 여부 B : 품절상품 맨 뒤로 · N : 품절상품 상관없음 |
| `sub_category_product_display` |  |  |  | 하위분류 상품진열 현재 상품 분류 하위 분류에 진열된 상품들까지 포함하여 진열할 것인지 여부 T : 진열함 · F : 진열안함 |
| `hashtag_product_display` |  |  |  | 쇼핑 큐레이션 해시태그 상품진열 해시태그 상품 진열 기능을 사용할 것인지 여부 · ※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다. T : 진열함 · F : 진열안함 |
| `hash_tags` |  |  |  | 쇼핑 큐레이션 해시태그 해당 상품분류의 해시태그 목록 · ※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다. |
| `product_display_scope` |  |  |  | 상품분류 진열영역 구분 상품 분류에 상품을 동일하게 정렬할 것인지, 영역별로 정렬할 것인지 설정 · "전체"로 설정할 경우 다음 필드는 반드시 입력되어야 한다. · product_display_type · product_display_key · product_display_sort · product_display_period (key가 S, C일 때만 필수) · "영역별"로 설정할 경우 다음 필드는 반드시 입력되어야 한다. · normal_product_display_type · normal_product_display_key · normal_product_display_sort · normal_product_display_period (key가 S, C일 때만 필수) · recommend_product_display_type · recommend_product_display_key · recommend_product_display_sort · recommend_product_display_period (key가 S, C일 때만 필수) · new_product_display_type · new_product_display_key · new_product_display_sort · new_product_display_period (key가 S, C일 때만 필수) A : 전체 · G : 영역별 |
| `product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "전체"일 경우 해당 상품 분류의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "전체"이고, 상품분류 진열방법이 "자동정렬" 또는 "자동정렬 + 사용자지정"일 경우 해당 상품 분류를 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `product_display_sort` |  |  |  | 상품분류 진열방법 순서 상품분류 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `product_display_period` |  |  |  | 진열순서에 대한 기간 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `normal_product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `normal_product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `normal_product_display_sort` |  |  |  | 상품분류 진열방법 순서 일반 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `normal_product_display_period` |  |  |  | 진열순서에 대한 기간 일반 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `recommend_product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `recommend_product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `recommend_product_display_sort` |  |  |  | 상품분류 진열방법 순서 추천 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `recommend_product_display_period` |  |  |  | 진열순서에 대한 기간 추천 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |
| `new_product_display_type` |  |  |  | 상품분류 진열방법 상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역의 진열 방법 A : 자동정렬 · U : 사용자 지정 · M : 자동정렬 + 사용자 지정 |
| `new_product_display_key` |  |  |  | 상품분류 진열방법 키 상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역을 어떤 기준으로 정렬할 것인지 설정 A : 최근 추가된 상품 · R : 최근 등록상품 · U : 최근 수정상품 · N : 상품명 가나다순 · P : 판매가 높은 상품 · S : 판매량 높은 상품 · C : 조회수가 높은 상품 · L : 좋아요수가 높은 상품 |
| `new_product_display_sort` |  |  |  | 상품분류 진열방법 순서 신상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정 D: 내림차순 · A : 오름차순 |
| `new_product_display_period` |  |  |  | 진열순서에 대한 기간 신상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간 W : 전체기간 · 1D : 1일 · 3D : 3일 · 7D : 7일 · 15D : 15일 · 1M : 1개월 · 3M : 3개월 · 6M : 6개월 |

### `DELETE /api/v2/admin/categories/{category_no}` — Delete a product category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `category_no` | ✓ |  |  | 분류 번호 |
