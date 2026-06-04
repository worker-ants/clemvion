---
resource: personal
entity: carts
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#carts
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Personal / Carts

> Field-level 카탈로그. Endpoint enumeration index: [`../personal.md`](../personal.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Carts](https://developers.cafe24.com/docs/ko/api/admin/#carts)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

장바구니(Carts)는 상품을 주문하기 전 한번에 주문할 수 있도록 상품을 미리 담아두는 기능입니다. · 장바구니 리소스에서는 Front API를 사용하여 특정 상품을 장바구니에 담을 수 있고 Admin API에서는 특정 회원의 장바구니를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `basket_product_no` |  | 장바구니 상품번호 |
| `member_id` |  | 회원아이디 |
| `created_date` |  | 담은일자 |
| `product_no` |  | 상품번호 |
| `additional_option_values` |  | 추가입력 옵션 |
| `variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 상품 품목 코드 |
| `quantity` |  | 수량 |
| `product_price` |  | 상품 판매가 |
| `option_price` |  | 옵션 추가 가격 |
| `product_bundle` |  | 세트상품 여부 T : 세트상품 · F : 세트상품 아님 |
| `shipping_type` |  | 배송 유형 A : 국내 · B : 해외 |
| `category_no` |  | 분류 번호 |

## Operations

### `GET /api/v2/admin/carts` — Retrieve a shopping cart

- **Scope**: `mall.read_personal` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shopping-cart

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 ,(콤마)로 여러 건을 검색할 수 있다. |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `carts` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `basket_product_no` |  | 장바구니 상품번호 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `created_date` |  | 담은일자 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `additional_option_values` |  | 추가입력 옵션 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `type` |  |  |
| ↳ ↳ `value` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ `variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 상품 품목 코드 |
| ↳ `quantity` |  | 수량 |
| ↳ `product_price` |  | 상품 판매가 |
| ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ `product_bundle` |  | 세트상품 여부 T : 세트상품 · F : 세트상품 아님 |
| ↳ `shipping_type` |  | 배송 유형 A : 국내 · B : 해외 |
| ↳ `category_no` |  | 분류 번호 |

응답 예시 (JSON):

```json
{
    "carts": [
        {
            "shop_no": 1,
            "basket_product_no": 5,
            "member_id": "sampleid",
            "created_date": "2019-08-09T10:49:11+09:00",
            "product_no": 9,
            "additional_option_values": [
                {
                    "key": "item_option_add",
                    "type": "text",
                    "value": "Custom Option",
                    "name": "Custom Option Value"
                },
                {
                    "key": "file_option",
                    "type": "url",
                    "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif",
                    "name": "Attached File"
                }
            ],
            "variant_code": "P000000R000C",
            "quantity": 2,
            "product_price": "5000.00",
            "option_price": "5000.00",
            "product_bundle": "F",
            "shipping_type": "A",
            "category_no": 1
        },
        {
            "shop_no": 1,
            "basket_product_no": 6,
            "member_id": "sampleid2",
            "created_date": "2019-08-08T10:26:05+09:00",
            "product_no": 10,
            "additional_option_values": [],
            "variant_code": "P000000J000A",
            "quantity": 1,
            "product_price": "10000.00",
            "option_price": "0.00",
            "product_bundle": "F",
            "shipping_type": "A",
            "category_no": 1
        }
    ]
}
```
