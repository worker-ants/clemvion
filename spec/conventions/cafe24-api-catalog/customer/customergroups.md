---
resource: customer
entity: customergroups
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customergroups
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Customer / Customergroups

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customergroups](https://developers.cafe24.com/docs/ko/api/admin/#customergroups)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원등급(CustomerGroups)은 쇼핑몰 회원을 등급별로 검색하여 관리할 수 있습니다. · 각 회원 등급 전체에게 메일, 적립금 지급, 선택한 회원의 등급 해제 및 변경을 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `group_no` |  | 회원등급번호 |
| `group_name` |  | 회원등급명 |
| `group_description` |  | 회원 등급설명 |
| `group_icon` |  | 회원등급 아이콘 |
| `benefits_paymethod` |  | 혜택 결제조건 A : 모든 결제 · B : 현금 결제(무통장) · C : 현금 결제 외 모든 결제 |
| `buy_benefits` |  | 구매시 할인/적립 혜택 F : 혜택없음 · D : 구매금액 할인 · M : 적립금 지급 · P : 할인/적립 동시 적용 |
| `ship_benefits` |  | 배송비 혜택 T : 배송비무료설정 · F : 배송비무료설정안함 |
| `product_availability` |  | 상품별 할인 중복설정 P : 상품별 가격할인만 적용 · M : 회원등급별 가격할인만 적용 · A : 둘다적용 |
| `discount_information` |  | 구매금액 할인설정 |
| `points_information` |  | 적립금 지급설정 |
| `mobile_discount_information` |  | 모바일 추가 할인설정 |
| `mobile_points_information` |  | 모바일 추가 적립금설정 |
| `discount_limit_information` |  | 할인 제한설정 멀티쇼핑몰에서 등급별 할인 혜택 제한 사용 시 등급 별로 적용되는 할인 혜택 제한 설정 및 최대 할인 한도 정보. · 멀티쇼핑몰에서 등급별 할인 혜택 제한을 사용하지 않거나, · buy_benefits(구매 시 할인/적립 혜택)이 F(혜택없음) 또는 M(적립금 지급)일 경우 null로 반환 · discount_limit_type(할인 혜택 제한 설정) · - A : 제한없음 · - B : 할인금액 제한 · - C : 할인횟수 제한 · discount_amount_limit(최대 할인금액 한도) : discount_limit_type이 B가 아닐 경우 null · number_of_discount_limit(최대 할인횟수 한도) : discount_limit_type이 C가 아닐 경우 null로 반환. |

## Operations

### `GET /api/v2/admin/customergroups` — Retrieve a list of customer tiers

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-tiers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `group_no` |  |  |  | 회원등급번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `group_name` |  | 최대글자수 : [20자] |  | 회원등급명 ,(콤마)로 여러 건을 검색할 수 있다. |

### `GET /api/v2/admin/customergroups/count` — Retrieve a count of customer tiers

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-tiers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `group_no` |  |  |  | 회원등급번호 시스템이 회원등급에 부여한 번호. ,(콤마)로 여러 건을 검색할 수 있다. |
| `group_name` |  | 최대글자수 : [20자] |  | 회원등급명 회원등급을 만들 당시 지정한 회원등급의 이름. ,(콤마)로 여러 건을 검색할 수 있다. |

### `GET /api/v2/admin/customergroups/{group_no}` — Retrieve a customer tier

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-tier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `group_no` | ✓ |  |  | 회원등급번호 시스템이 회원등급에 부여한 번호. |
