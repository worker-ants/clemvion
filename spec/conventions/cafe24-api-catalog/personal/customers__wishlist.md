---
resource: personal
entity: customers__wishlist
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--wishlist
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Personal / Customers wishlist

> Field-level 카탈로그. Endpoint enumeration index: [`../personal.md`](../personal.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers wishlist](https://developers.cafe24.com/docs/ko/api/admin/#customers--wishlist)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원 관심상품(Customers wishlist)은 회원의 관심상품을 조회할 수 있는 관계형 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `wishlist_no` |  | 관심상품번호 |
| `product_no` |  | 상품번호 |
| `variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 품목코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음. |
| `additional_option` |  | 추가입력 옵션 |
| `attached_file_option` |  | 파일 첨부 옵션 |
| `price` |  | 상품 판매가 상품의 판매 가격. 쿠폰 및 혜택을 적용하기 전의 가격. · 상품 등록시엔 모든 멀티 쇼핑몰에 동일한 가격으로 등록하며, 멀티쇼핑몰별로 다른 가격을 입력하고자 할 경우 상품 수정을 통해 가격을 다르게 입력할 수 있다. · ※ 판매가 = [ 공급가 + (공급가 * 마진율) + 추가금액 ] |
| `product_bundle` |  | 세트상품 여부 |
| `created_date` |  | 담은일자 관심상품을 담은 일자 |
| `price_content` | 최대글자수 : [20자] | 판매가 대체문구 |

## Operations

### `GET /api/v2/admin/customers/{member_id}/wishlist/count` — Retrieve a count of products in customer wishlist

- **Scope**: `mall.read_personal` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-customer-wishlist

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `member_id` | ✓ |  |  | 회원아이디 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `count` |  |  |

응답 예시 (JSON):

```json
{
    "count": 2
}
```

### `GET /api/v2/admin/customers/{member_id}/wishlist` — Retrieve a list of products in customer wishlist

- **Scope**: `mall.read_personal` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-in-customer-wishlist

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `member_id` | ✓ |  |  | 회원아이디 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `wishlist` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `wishlist_no` |  | 관심상품번호 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 품목코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음. |
| ↳ `additional_option` |  | 추가입력 옵션 |
| ↳ ↳ `option_name` |  | 옵션명 |
| ↳ ↳ `option_value` |  | 옵션값 |
| ↳ `attached_file_option` |  | 파일 첨부 옵션 |
| ↳ ↳ `file_path` |  |  |
| ↳ `price` |  | 상품 판매가 상품의 판매 가격. 쿠폰 및 혜택을 적용하기 전의 가격. · 상품 등록시엔 모든 멀티 쇼핑몰에 동일한 가격으로 등록하며, 멀티쇼핑몰별로 다른 가격을 입력하고자 할 경우 상품 수정을 통해 가격을 다르게 입력할 수 있다. · ※ 판매가 = [ 공급가 + (공급가 * 마진율) + 추가금액 ] |
| ↳ `product_bundle` |  | 세트상품 여부 |
| ↳ `created_date` |  | 담은일자 관심상품을 담은 일자 |
| ↳ `price_content` | 최대글자수 : [20자] | 판매가 대체문구 |

응답 예시 (JSON):

```json
{
    "wishlist": [
        {
            "shop_no": 1,
            "wishlist_no": 1,
            "product_no": 3,
            "variant_code": "P000000R000C",
            "additional_option": [
                {
                    "option_name": "Custom Option",
                    "option_value": "Custom Option Value"
                }
            ],
            "attached_file_option": [
                {
                    "file_path": "https://{domain}/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                }
            ],
            "price": "10000.00",
            "product_bundle": "F",
            "created_date": "2018-12-17T11:36:28+09:00",
            "price_content": null
        },
        {
            "shop_no": 1,
            "wishlist_no": 2,
            "product_no": 5,
            "variant_code": "P000000S000D",
            "additional_option": null,
            "attached_file_option": null,
            "price": "20000.00",
            "product_bundle": "F",
            "created_date": "2018-11-17T14:36:28+09:00",
            "price_content": null
        }
    ]
}
```
