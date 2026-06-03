---
resource: store
entity: paymentservices
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#paymentservices
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Paymentservices

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Paymentservices](https://developers.cafe24.com/docs/ko/api/admin/#paymentservices)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

국내PG의 세팅사항을 관리할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `payment_gateway_name` |  | PG사 명 |
| `partner_id` |  | PG사 발급 가맹점 ID |
| `hash_code` |  | PG사 해시코드 |
| `etc_code` |  | PG사 기타정보 |
| `payment_methods` |  | 등록 결제수단 리스트 |

## Operations

### `GET /api/v2/admin/paymentservices` — Retrieve a list of PG settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-pg-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
