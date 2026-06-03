---
resource: supply
entity: shipping-suppliers__additionalfees
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shipping-suppliers--additionalfees
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Supply / Shipping suppliers additionalfees

> Field-level 카탈로그. Endpoint enumeration index: [`../supply.md`](../supply.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shipping suppliers additionalfees](https://developers.cafe24.com/docs/ko/api/admin/#shipping-suppliers--additionalfees)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

멀티쇼핑몰 번호

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `oversea_additional_fee` |  | 해외배송 부가금액 사용여부 T : 사용함 · F : 사용안함 |
| `country_code` |  | 국가코드 |
| `fee_name` |  | 부과금액 명칭 |
| `min_value` |  | 조건 최소값 |
| `max_value` |  | 조건 최대값 |
| `additional_fee` |  | 부가금액 |
| `unit` |  | 해외배송 부가금액 단위 W : 정액 · P : 퍼센트 |
| `rounding_unit` |  | 절사단위 F : 절사안함 · 0 : 1원단위 · 1 : 10원단위 · 2 : 100원단위 · 3 : 1000원단위 |
| `rounding_rule` |  | 절사 방법 L : 내림 · U : 반올림 · C : 올림 |

## Operations

### `GET /api/v2/admin/shipping/suppliers/{supplier_id}/additionalfees` — Retrieve additional handling fees for supplier international shipping

- **Scope**: `mall.read_supply` (read)
- **호출건수 제한**: 30
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-handling-fees-for-supplier-international-shipping

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `supplier_id` | ✓ |  |  | 공급사 아이디 |
| `limit` |  | 최소: [1]~최대: [500] | 100 | 조회결과 최대건수 |
| `offset` |  | 최대값: [500] | 0 | 조회결과 시작위치 |
