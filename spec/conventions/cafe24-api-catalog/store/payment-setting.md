---
resource: store
entity: payment-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#payment-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Payment setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Payment setting](https://developers.cafe24.com/docs/ko/api/admin/#payment-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

결제수단의 설정정보를 관리하는 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_escrow` |  | 에스크로 사용여부 |
| `use_escrow_account_transfer` |  | 에스크로(계좌이체) 사용여부 |
| `use_escrow_virtual_account` |  | 에스크로(가상계좌) 사용여부 |
| `pg_shipping_registration` |  | PG사 배송등록 |
| `purchase_protection_amount` |  | 매매보호 적용 결제금액 설정 |
| `use_direct_pay` |  | 빠른 결제 수단 사용여부 |
| `payment_display_type` |  | 결제수단 표기 방식 T : 텍스트 · L : 로고 아이콘 |

## Operations

### `GET /api/v2/admin/payment/setting` — Retrieve payment settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/payment/setting` — Update payment settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-payment-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_escrow` |  |  |  | 에스크로 사용여부 T : 사용함 · F : 사용안함 |
| `use_escrow_account_transfer` |  |  |  | 에스크로(계좌이체) 사용여부 T : 사용함 · F : 사용안함 |
| `use_escrow_virtual_account` |  |  |  | 에스크로(가상계좌) 사용여부 T : 사용함 · F : 사용안함 |
| `pg_shipping_registration` |  |  |  | PG사 배송등록 A : 자동 등록(매일 오후 8시 수집) · M : 수동 등록 |
| `use_direct_pay` |  |  |  | 빠른 결제 수단 사용여부 T : 사용함 · F : 사용안함 |
| `payment_display_type` |  |  |  | 결제수단 표기 방식 T : 텍스트 · L : 로고 아이콘 |
