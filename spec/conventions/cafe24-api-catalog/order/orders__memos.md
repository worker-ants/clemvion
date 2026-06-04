---
resource: order
entity: orders__memos
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--memos
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders memos

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders memos](https://developers.cafe24.com/docs/ko/api/admin/#orders--memos)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 메모(Orders memos)는 특정 주문의 메모에 대한 주문의 하위 리소스 입니다. · 주문에 대하여 관리자 메모의 조회, 등록, 수정, 삭제를 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `memo_no` |  | 메모 번호 |
| `created_date` |  | 메모 등록일 |
| `author_id` |  | 작성자 아이디 |
| `ip` |  | 작성자 아이피 |
| `use_customer_inquiry` |  | 고객상담 동시등록 여부 T : 사용함 · F : 사용안함 |
| `attach_type` |  | 등록기준 O : 주문별 · P : 품목별 |
| `content` |  | 메모 내용 |
| `starred_memo` |  | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| `fixed` |  | 상단고정 여부 T : 사용함 · F : 사용안함 |
| `product_list` |  | 상품 목록 |
| `topic_type` |  | 상담분류 cs_01 : 배송문의 · cs_02 : 상품문의 · cs_03 : 결제문의 · cs_04 : 주문취소 · cs_05 : 상품변경 |
| `status` |  | 상담결과 F : 처리중 · T : 처리완료 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/memos` — Retrieve a list of order memos

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-memos

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `memos` |  | 메모 리소스 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `memo_no` |  | 메모 번호 |
| ↳ `created_date` |  | 메모 등록일 |
| ↳ `author_id` |  | 작성자 아이디 |
| ↳ `ip` |  | 작성자 아이피 |
| ↳ `use_customer_inquiry` |  | 고객상담 동시등록 여부 T : 사용함 · F : 사용안함 |
| ↳ `attach_type` |  | 등록기준 O : 주문별 · P : 품목별 |
| ↳ `content` |  | 메모 내용 |
| ↳ `starred_memo` |  | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| ↳ `fixed` |  | 상단고정 여부 T : 사용함 · F : 사용안함 |
| ↳ `product_list` |  | 상품 목록 |
| ↳ ↳ `product_no` |  |  |
| ↳ ↳ `option_code` |  | 연동형 옵션코드 |

응답 예시 (JSON):

```json
{
    "memos": [
        {
            "shop_no": 1,
            "memo_no": 13,
            "created_date": "2020-01-13T09:53:33+09:00",
            "author_id": "sampleid",
            "ip": "127.0.0.1",
            "use_customer_inquiry": "F",
            "attach_type": "P",
            "content": "sample memo content",
            "starred_memo": "F",
            "fixed": "F",
            "product_list": [
                {
                    "product_no": 11,
                    "option_code": "000A"
                },
                {
                    "product_no": 12,
                    "option_code": "000A"
                }
            ]
        },
        {
            "shop_no": 1,
            "memo_no": 14,
            "created_date": "2020-01-14T10:53:41+09:00",
            "author_id": "sampleid",
            "ip": "127.0.0.1",
            "use_customer_inquiry": "F",
            "attach_type": "P",
            "content": "sample memo content",
            "starred_memo": "F",
            "fixed": "F",
            "product_list": [
                {
                    "product_no": 11,
                    "option_code": "000A"
                },
                {
                    "product_no": 12,
                    "option_code": "000A"
                }
            ]
        }
    ]
}
```

### `POST /api/v2/admin/orders/{order_id}/memos` — Create an order memo

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `content` | ✓ | 최대글자수 : [1000자] |  | 메모 내용 |
| `use_customer_inquiry` |  |  | F | 고객상담 동시등록 여부 T : 사용함 · F : 사용안함 |
| `topic_type` |  |  |  | 상담분류 cs_01 : 배송문의 · cs_02 : 상품문의 · cs_03 : 결제문의 · cs_04 : 주문취소 · cs_05 : 상품변경 |
| `status` |  |  |  | 상담결과 F : 처리중 · T : 처리완료 |
| `attach_type` |  |  | O | 등록기준 O : 주문별 · P : 품목별 |
| `starred_memo` |  |  | F | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| `fixed` |  |  | F | 상단고정 여부 T : 사용함 · F : 사용안함 |
| `product_list` |  |  |  | 상품 목록 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `memo` |  | 메모 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `memo_no` |  | 메모 번호 |
| ↳ `author_id` |  | 작성자 아이디 |
| ↳ `use_customer_inquiry` |  | 고객상담 동시등록 여부 T : 사용함 · F : 사용안함 |
| ↳ `topic_type` |  | 상담분류 cs_01 : 배송문의 · cs_02 : 상품문의 · cs_03 : 결제문의 · cs_04 : 주문취소 · cs_05 : 상품변경 |
| ↳ `status` |  | 상담결과 F : 처리중 · T : 처리완료 |
| ↳ `attach_type` |  | 등록기준 O : 주문별 · P : 품목별 |
| ↳ `content` |  | 메모 내용 |
| ↳ `starred_memo` |  | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| ↳ `fixed` |  | 상단고정 여부 T : 사용함 · F : 사용안함 |
| ↳ `product_list` |  | 상품 목록 |
| ↳ ↳ `product_no` |  |  |
| ↳ ↳ `option_code` |  | 연동형 옵션코드 |

응답 예시 (JSON):

```json
{
    "memo": {
        "shop_no": 1,
        "memo_no": 13,
        "author_id": "sampleid",
        "use_customer_inquiry": "F",
        "topic_type": null,
        "status": null,
        "attach_type": "P",
        "content": "sample memo content",
        "starred_memo": "F",
        "fixed": "F",
        "product_list": [
            {
                "product_no": 11,
                "option_code": "000A"
            },
            {
                "product_no": 12,
                "option_code": "000A"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/orders/{order_id}/memos/{memo_no}` — Update an order memo

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `memo_no` | ✓ |  |  | 메모 번호 |
| `content` |  | 최대글자수 : [1000자] |  | 메모 내용 |
| `use_customer_inquiry` |  |  | F | 고객상담 동시등록 여부 T : 사용함 · F : 사용안함 |
| `topic_type` |  |  |  | 상담분류 cs_01 : 배송문의 · cs_02 : 상품문의 · cs_03 : 결제문의 · cs_04 : 주문취소 · cs_05 : 상품변경 |
| `status` |  |  |  | 상담결과 F : 처리중 · T : 처리완료 |
| `attach_type` |  |  | O | 등록기준 O : 주문별 · P : 품목별 |
| `starred_memo` |  |  | F | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| `fixed` |  |  | F | 상단고정 여부 T : 사용함 · F : 사용안함 |
| `product_list` |  |  |  | 상품 목록 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `memo` |  | 메모 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `memo_no` |  | 메모 번호 |
| ↳ `use_customer_inquiry` |  | 고객상담 동시등록 여부 T : 사용함 · F : 사용안함 |
| ↳ `topic_type` |  | 상담분류 cs_01 : 배송문의 · cs_02 : 상품문의 · cs_03 : 결제문의 · cs_04 : 주문취소 · cs_05 : 상품변경 |
| ↳ `status` |  | 상담결과 F : 처리중 · T : 처리완료 |
| ↳ `attach_type` |  | 등록기준 O : 주문별 · P : 품목별 |
| ↳ `content` |  | 메모 내용 |
| ↳ `starred_memo` |  | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| ↳ `fixed` |  | 상단고정 여부 T : 사용함 · F : 사용안함 |
| ↳ `product_list` |  | 상품 목록 |
| ↳ ↳ `product_no` |  |  |
| ↳ ↳ `option_code` |  | 연동형 옵션코드 |

응답 예시 (JSON):

```json
{
    "memo": {
        "shop_no": 1,
        "memo_no": 13,
        "use_customer_inquiry": "F",
        "topic_type": null,
        "status": null,
        "attach_type": "P",
        "content": "sample memo content",
        "starred_memo": "F",
        "fixed": "F",
        "product_list": [
            {
                "product_no": 11,
                "option_code": "000A"
            },
            {
                "product_no": 12,
                "option_code": "000A"
            }
        ]
    }
}
```

### `DELETE /api/v2/admin/orders/{order_id}/memos/{memo_no}` — Delete an order memo

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `memo_no` | ✓ |  |  | 메모 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `memo` |  | 메모 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `memo_no` |  | 메모 번호 |

응답 예시 (JSON):

```json
{
    "memo": {
        "shop_no": 1,
        "memo_no": 13
    }
}
```
