---
resource: promotion
entity: discountcodes
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#discountcodes
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Promotion / Discountcodes

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Discountcodes](https://developers.cafe24.com/docs/ko/api/admin/#discountcodes)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

할인코드를 관리하는 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `discount_code_no` |  | 할인코드 번호 |
| `discount_code_name` |  | 할인코드 이름 |
| `discount_code` |  | 할인코드 |
| `available_start_date` |  | 시작일 |
| `available_end_date` |  | 종료일 |
| `available_product_type` |  | 할인코드 적용범위 할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available_product) 및 할인코드적용 분류(available_category) 는 입력 필요 없음 · 할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available_product) 은 필수 입력 · 할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available_category)는 필수 입력 · A : 전체상품 · P : 특정상품 · C : 특정분류 |
| `created_date` |  | 혜택 등록일 |
| `available_issue_count` |  | 최대 발급 횟수 |
| `issued_count` |  | 발급된 수량 |
| `discount_value` |  | 할인 값 |
| `discount_truncation_unit` |  | 절사 단위 C : 0.01단위 · B : 0.1단위 · F : 절사안함 · O : 1원단위 · T : 10원단위 · M : 100원단위 · H : 1000원 단위 |
| `discount_max_price` |  | 혜택 최대 금액 |
| `available_product` |  | 특정상품 리스트 할인코드 적용범위(available_product_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다. |
| `available_category` |  | 특정분류 리스트 할인코드 적용범위(available_product_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다. |
| `available_min_price` |  | 이용 주문 최소 금액 |
| `available_user` |  | 사용가능 대상 |
| `max_usage_per_user` |  | 회원당 사용가능 횟수 |

## Operations

### `GET /api/v2/admin/discountcodes` — Retrieve a list of discount codes

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-discount-codes

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `discount_code_name` |  |  |  | 할인코드 이름 |
| `discount_code` |  |  |  | 할인코드 |
| `search_date_type` |  |  |  | available_start_date : 시작일 available_end_date : 종료일 created_date : 등록일 available_start_date : 시작일 · available_end_date : 종료일 · created_date : 등록일 |
| `start_date` |  | 날짜 |  | 검색 시작일 |
| `end_date` |  | 날짜 |  | 검색 종료일 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |
| `sort` |  |  | created_date | 정렬 순서 값 discount_code_name : 혜택이름 · discount_code : 할인코드 · created_date : 등록시간 · available_start_date : 시작시간 · available_end_date : 종료시간 |
| `order` |  |  | desc | 정렬 순서 asc : 순차정렬 · desc : 역순 정렬 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `discountcodes` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `discount_code_no` |  | 할인코드 번호 |
| ↳ `discount_code` |  | 할인코드 |
| ↳ `discount_code_name` |  | 할인코드 이름 |
| ↳ `available_product_type` |  | 할인코드 적용범위 할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available_product) 및 할인코드적용 분류(available_category) 는 입력 필요 없음 · 할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available_product) 은 필수 입력 · 할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available_category)는 필수 입력 · A : 전체상품 · P : 특정상품 · C : 특정분류 |
| ↳ `available_start_date` |  | 시작일 |
| ↳ `available_end_date` |  | 종료일 |
| ↳ `created_date` |  | 혜택 등록일 |
| ↳ `issued_count` |  | 발급된 수량 |
| ↳ `available_issue_count` |  | 최대 발급 횟수 |

응답 예시 (JSON):

```json
{
    "discountcodes": [
        {
            "shop_no": 1,
            "discount_code_no": 1,
            "discount_code": "DISCOUNT1",
            "discount_code_name": "123456",
            "available_product_type": "P",
            "available_start_date": "2024-09-10T11:10:34+09:00",
            "available_end_date": "2024-09-20T13:10:34+09:00",
            "created_date": "2019-12-13T10:10:10:34+09:00",
            "issued_count": 30,
            "available_issue_count": 100
        },
        {
            "shop_no": 1,
            "discount_code_no": 2,
            "discount_code": "DISCOUNT2",
            "discount_code_name": "123456",
            "available_product_type": "P",
            "available_start_date": "2024-09-10T11:10:34+09:00",
            "available_end_date": "2024-09-20T13:10:34+09:00",
            "created_date": "2019-12-13T10:10:10:34+09:00",
            "issued_count": 30,
            "available_issue_count": 100
        }
    ]
}
```

### `GET /api/v2/admin/discountcodes/{discount_code_no}` — Retrieve a discount code

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-discount-code

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `discount_code_no` | ✓ | 최소값: [1] |  | 할인코드 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `discountcode` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `discount_code_no` |  | 할인코드 번호 |
| ↳ `discount_code` |  | 할인코드 |
| ↳ `discount_code_name` |  | 할인코드 이름 |
| ↳ `discount_value` |  | 할인 값 |
| ↳ `discount_truncation_unit` |  | 절사 단위 C : 0.01단위 · B : 0.1단위 · F : 절사안함 · O : 1원단위 · T : 10원단위 · M : 100원단위 · H : 1000원 단위 |
| ↳ `discount_max_price` |  | 혜택 최대 금액 |
| ↳ `available_start_date` |  | 시작일 |
| ↳ `available_end_date` |  | 종료일 |
| ↳ `available_product_type` |  | 할인코드 적용범위 할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available_product) 및 할인코드적용 분류(available_category) 는 입력 필요 없음 · 할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available_product) 은 필수 입력 · 할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available_category)는 필수 입력 · A : 전체상품 · P : 특정상품 · C : 특정분류 |
| ↳ `available_product` |  | 특정상품 리스트 할인코드 적용범위(available_product_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다. |
| ↳ `available_category` |  | 특정분류 리스트 할인코드 적용범위(available_product_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다. |
| ↳ `available_min_price` |  | 이용 주문 최소 금액 |
| ↳ `available_issue_count` |  | 최대 발급 횟수 |
| ↳ `available_user` |  | 사용가능 대상 |
| ↳ `max_usage_per_user` |  | 회원당 사용가능 횟수 |

응답 예시 (JSON):

```json
{
    "discountcode": {
        "shop_no": 1,
        "discount_code_no": 23,
        "discount_code": "DISCOUNT1",
        "discount_code_name": "discount for customer",
        "discount_value": 10,
        "discount_truncation_unit": "M",
        "discount_max_price": 10000,
        "available_start_date": "2024-09-10T11:10:34+09:00",
        "available_end_date": "2024-09-20T13:10:34+09:00",
        "available_product_type": "P",
        "available_product": [
            10,
            12
        ],
        "available_category": null,
        "available_min_price": 1000,
        "available_issue_count": 1000,
        "available_user": "A",
        "max_usage_per_user": 3
    }
}
```

### `POST /api/v2/admin/discountcodes` — Create a discount code

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-discount-code

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `discount_code` | ✓ | 최소글자수 : [1자]; 최대글자수 : [35자] |  | 할인코드 |
| `discount_code_name` | ✓ | 글자수 최소: [1자]~최대: [50자] |  | 할인코드 이름 |
| `discount_value` | ✓ | 최소값: [1]; 최대값: [99] |  | 할인 값 |
| `discount_truncation_unit` | ✓ |  |  | 절사 단위 C : 0.01단위 · B : 0.1단위 · F : 절사안함 · O : 1원단위 · T : 10원단위 · M : 100원단위 · H : 1000원 단위 |
| `discount_max_price` | ✓ | 최소값: [1]; 최대값: [999999999] |  | 혜택 최대 금액 |
| `available_start_date` | ✓ | 날짜 |  | 시작일 |
| `available_end_date` | ✓ | 날짜 |  | 종료일 |
| `available_product_type` |  |  | A | 할인코드 적용범위 할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available_product) 및 할인코드적용 분류(available_category) 는 입력 필요 없음 · 할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available_product) 은 필수 입력 · 할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available_category)는 필수 입력 · A : 전체상품 · P : 특정상품 · C : 특정분류 |
| `available_product` |  |  |  | 특정상품 리스트 할인코드 적용범위(available_product_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다. |
| `available_category` |  |  |  | 특정분류 리스트 할인코드 적용범위(available_product_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다. |
| `available_min_price` |  | 최대값: [999999999] | 0 | 이용 주문 최소 금액 |
| `available_issue_count` |  | 최대값: [10000] | 0 | 최대 발급 횟수 |
| `available_user` |  |  | A | 사용가능 대상 M : 회원 · A : 전체 |
| `max_usage_per_user` |  | 최대값: [999] | 0 | 회원당 사용가능 횟수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `discountcode` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `discount_code_no` |  | 할인코드 번호 |
| ↳ `discount_code` |  | 할인코드 |
| ↳ `discount_code_name` |  | 할인코드 이름 |
| ↳ `discount_value` |  | 할인 값 |
| ↳ `discount_truncation_unit` |  | 절사 단위 C : 0.01단위 · B : 0.1단위 · F : 절사안함 · O : 1원단위 · T : 10원단위 · M : 100원단위 · H : 1000원 단위 |
| ↳ `discount_max_price` |  | 혜택 최대 금액 |
| ↳ `available_start_date` |  | 시작일 |
| ↳ `available_end_date` |  | 종료일 |
| ↳ `available_product_type` |  | 할인코드 적용범위 할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available_product) 및 할인코드적용 분류(available_category) 는 입력 필요 없음 · 할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available_product) 은 필수 입력 · 할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available_category)는 필수 입력 · A : 전체상품 · P : 특정상품 · C : 특정분류 |
| ↳ `available_product` |  | 특정상품 리스트 할인코드 적용범위(available_product_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다. |
| ↳ `available_category` |  | 특정분류 리스트 할인코드 적용범위(available_product_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다. |
| ↳ `available_min_price` |  | 이용 주문 최소 금액 |
| ↳ `available_issue_count` |  | 최대 발급 횟수 |
| ↳ `available_user` |  | 사용가능 대상 |
| ↳ `max_usage_per_user` |  | 회원당 사용가능 횟수 |

응답 예시 (JSON):

```json
{
    "discountcode": {
        "shop_no": 1,
        "discount_code_no": 23,
        "discount_code": "DISCOUNT1",
        "discount_code_name": "discount for customer",
        "discount_value": 10,
        "discount_truncation_unit": "M",
        "discount_max_price": 10000,
        "available_start_date": "2036-10-05T11:10:34+09:00",
        "available_end_date": "2036-10-20T13:10:34+09:00",
        "available_product_type": "P",
        "available_product": [
            9,
            10
        ],
        "available_category": null,
        "available_min_price": 1000,
        "available_issue_count": 1000,
        "available_user": "A",
        "max_usage_per_user": 3
    }
}
```

### `PUT /api/v2/admin/discountcodes/{discount_code_no}` — Update a discount code

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-discount-code

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `discount_code_no` | ✓ | 최소값: [1] |  | 할인코드 번호 |
| `discount_code` |  | 최소글자수 : [1자]; 최대글자수 : [35자] |  | 할인코드 |
| `discount_code_name` | ✓ | 글자수 최소: [1자]~최대: [50자] |  | 할인코드 이름 |
| `discount_value` |  | 최소값: [1]; 최대값: [99] |  | 할인 값 |
| `discount_truncation_unit` |  |  |  | 절사 단위 C : 0.01단위 · B : 0.1단위 · F : 절사안함 · O : 1원단위 · T : 10원단위 · M : 100원단위 · H : 1000원 단위 |
| `discount_max_price` |  | 최소값: [1]; 최대값: [999999999] |  | 혜택 최대 금액 |
| `available_start_date` |  | 날짜 |  | 시작일 |
| `available_end_date` |  | 날짜 |  | 종료일 |
| `available_product_type` |  |  |  | 할인코드 적용범위 할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available_product) 및 할인코드적용 분류(available_category) 는 입력 필요 없음 · 할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available_product) 은 필수 입력 · 할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available_category)는 필수 입력 · A : 전체상품 · P : 특정상품 · C : 특정분류 |
| `available_product` |  |  |  | 특정상품 리스트 할인코드 적용범위(available_product_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다. |
| `available_category` |  |  |  | 특정분류 리스트 할인코드 적용범위(available_product_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다. |
| `available_min_price` |  | 최대값: [999999999] |  | 이용 주문 최소 금액 |
| `available_issue_count` |  | 최대값: [10000] |  | 최대 발급 횟수 |
| `available_user` |  |  |  | 사용가능 대상 M : 회원 · A : 전체 |
| `max_usage_per_user` |  | 최대값: [999] |  | 회원당 사용가능 횟수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `discountcode` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `discount_code_no` |  | 할인코드 번호 |
| ↳ `discount_code` |  | 할인코드 |
| ↳ `discount_code_name` |  | 할인코드 이름 |
| ↳ `discount_value` |  | 할인 값 |
| ↳ `discount_truncation_unit` |  | 절사 단위 C : 0.01단위 · B : 0.1단위 · F : 절사안함 · O : 1원단위 · T : 10원단위 · M : 100원단위 · H : 1000원 단위 |
| ↳ `discount_max_price` |  | 혜택 최대 금액 |
| ↳ `available_start_date` |  | 시작일 |
| ↳ `available_end_date` |  | 종료일 |
| ↳ `available_product_type` |  | 할인코드 적용범위 할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available_product) 및 할인코드적용 분류(available_category) 는 입력 필요 없음 · 할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available_product) 은 필수 입력 · 할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available_category)는 필수 입력 · A : 전체상품 · P : 특정상품 · C : 특정분류 |
| ↳ `available_product` |  | 특정상품 리스트 할인코드 적용범위(available_product_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다. |
| ↳ `available_category` |  | 특정분류 리스트 할인코드 적용범위(available_product_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다. |
| ↳ `available_min_price` |  | 이용 주문 최소 금액 |
| ↳ `available_issue_count` |  | 최대 발급 횟수 |
| ↳ `available_user` |  | 사용가능 대상 |
| ↳ `max_usage_per_user` |  | 회원당 사용가능 횟수 |

응답 예시 (JSON):

```json
{
    "discountcode": {
        "shop_no": 1,
        "discount_code_no": 23,
        "discount_code": "DISCOUNT1",
        "discount_code_name": "discount for customer",
        "discount_value": 10,
        "discount_truncation_unit": "M",
        "discount_max_price": 10000,
        "available_start_date": "2036-09-10T11:10:34+09:00",
        "available_end_date": "2036-09-20T13:10:34+09:00",
        "available_product_type": "P",
        "available_product": [
            9,
            10
        ],
        "available_category": null,
        "available_min_price": 1000,
        "available_issue_count": 1000,
        "available_user": "A",
        "max_usage_per_user": 3
    }
}
```

### `DELETE /api/v2/admin/discountcodes/{discount_code_no}` — Delete a discount code

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-discount-code

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `discount_code_no` | ✓ | 최소값: [1] |  | 할인코드 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `discountcode` |  | (응답 객체) |
| ↳ `discount_code_no` |  | 할인코드 번호 |

응답 예시 (JSON):

```json
{
    "discountcode": {
        "discount_code_no": 23
    }
}
```
