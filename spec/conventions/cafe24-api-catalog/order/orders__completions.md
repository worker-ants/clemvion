---
resource: order
entity: orders__completions
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--completions
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders completions

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders completions](https://developers.cafe24.com/docs/ko/api/admin/#orders--completions)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `payment_code` |  | 결제코드 |
| `return_code` |  | 처리 결과 코드 |
| `return_message` |  | 처리 결과 메시지 |

## Operations

### `POST /api/v2/admin/orders/{order_id}/completions` — Complete an order after PG payment

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#complete-an-order-after-pg-payment

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `payment_code` | ✓ |  |  | 결제코드 |
| `data` | ✓ |  |  | 암호화된 PG 결제 데이터 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `completion` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `payment_code` |  | 결제코드 |
| ↳ `return_code` |  | 처리 결과 코드 |
| ↳ `return_message` |  | 처리 결과 메시지 |

응답 예시 (JSON):

```json
{
    "completion": {
        "shop_no": 1,
        "order_id": "20241208-0000001",
        "payment_code": "P00000000000001",
        "return_code": "0000",
        "return_message": "Success"
    }
}
```
