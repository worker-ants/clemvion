---
resource: order
entity: orders-memos
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-memos
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders memos

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders memos](https://developers.cafe24.com/docs/ko/api/admin/#orders-memos)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 메모(Orders memos)는 특정 주문의 메모에 대한 주문의 하위 리소스 입니다. · 주문에 대하여 관리자 메모의 조회, 등록, 수정, 삭제를 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `memo_no` |  | 메모 번호 |
| `order_id` |  | 주문번호 |
| `created_date` |  | 메모 등록일 |
| `author_id` |  | 작성자 아이디 |
| `ip` |  | 작성자 아이피 |
| `use_customer_inquiry` |  | 고객상담 동시등록 여부 T : 사용함 · F : 사용안함 |
| `attach_type` |  | 등록기준 O : 주문별 · P : 품목별 |
| `content` |  | 메모 내용 |
| `starred_memo` |  | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| `fixed` |  | 상단고정 여부 T : 사용함 · F : 사용안함 |
| `product_list` |  | 상품 목록 |

## Operations

### `GET /api/v2/admin/orders/memos` — Retrieve a list of admin memos for an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-memos-for-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "memos": [
        {
            "shop_no": 1,
            "memo_no": 13,
            "order_id": "20200113-0000011",
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
            "order_id": "20200113-0000011",
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
