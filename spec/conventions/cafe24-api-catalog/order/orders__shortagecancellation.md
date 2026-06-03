---
resource: order
entity: orders__shortagecancellation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--shortagecancellation
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders shortagecancellation

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders shortagecancellation](https://developers.cafe24.com/docs/ko/api/admin/#orders--shortagecancellation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문의 재고부족취소(Orders shortagecancellation)는 이벤트 혹은 재고설정의 착오 등으로 인해 보유한 재고보다 많은 수량이 판매되었을 때 · 취소완료 및 환불까지 처리할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `status` |  | 주문상태 canceled : 취소완료 · canceling : 취소처리중 |
| `claim_code` |  | 취소 번호 |
| `items` |  | 품주코드 |

## Operations

### `POST /api/v2/admin/orders/{order_id}/shortagecancellation` — Create an order cancellation on stock shortage

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation-on-stock-shortage

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] |  | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `payment_gateway_cancel` |  |  | F | PG 취소 요청 여부 T : 취소함 · F : 취소안함 |
| `keep_auto_calculation` |  |  | F | 할인금액 자동계산 플래그 보존여부 보존함 : T · 제거함 : F |
| `collect_gift` |  |  | F | 사은품 자동 회수 T : 사용함 · F : 사용안함 |
| `status` | ✓ |  |  | 주문상태 accepted: 취소접수 · canceling : 취소처리중 · canceled : 취소완료 |
| `recover_inventory` |  |  | F | 재고복구 T : 복구함 · F : 복구안함 |
| `recover_coupon` |  |  | F | 쿠폰 복원 T : 복구함 · F : 복구안함 |
| `recover_coupon_no` |  |  |  | 복원할 쿠폰 번호 |
| `add_memo_too` |  |  | F | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `reason` |  | 최대글자수 : [2000자] |  | 취소사유 |
| `claim_reason_type` |  |  |  | 취소사유 구분 A : 고객변심 · B : 배송지연 · C : 배송불가지역 · L : 수출/통관 불가 · D : 포장불량 · E : 상품불만족 · F : 상품정보상이 · G : 서비스불만족 · H : 품절 · I : 기타 |
| `naverpay_cancel_reason_type` |  |  |  | 네이버페이 취소사유 구분 EC 베트남, 필리핀 버전에서는 사용할 수 없음. 51 : 구매 의사 취소 · 52 : 색상 및 사이즈 변경 · 53 : 다른 상품 잘못 주문 · 54 : 서비스 및 상품 불만족 · 55 : 배송 지연 · 56 : 상품 품절 · 60 : 상품 정보 상이 |
| `kakaopay_cancel_reason_type` |  |  |  | 카카오페이 취소사유 구분 K1 : 변심에 의한 상품 취소 · K2 : 다른 옵션이나 상품을 잘못 주문함 · K3 : 배송지연 · K4 : 상품 파손 또는 불량 · K5 : 다른 상품 오배송 또는 구성품 누락 · K6 : 상품정보와 다름 · K7 : 품절로 인한 배송 불가 |
| `refund_method_code` |  |  |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |
