---
resource: order
entity: subscription-shipments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Subscription shipments

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Subscription shipments](https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

정기배송(Subscription shipments)은 정기배송에 대한 조회, 등록, 수정, 삭제를 할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `subscription_id` |  | 정기배송 신청번호 |
| `member_id` |  | 회원아이디 |
| `buyer_name` |  | 주문자 이름 |
| `buyer_zipcode` |  | 주문자 우편번호 |
| `buyer_address1` |  | 주문자 기본 주소 |
| `buyer_address2` |  | 주문자 상세 주소 |
| `buyer_phone` |  | 주문자 일반 전화 |
| `buyer_cellphone` |  | 주문자 휴대 전화 |
| `buyer_email` |  | 주문자 이메일 |
| `receiver_name` | 최대글자수 : [100자] | 수령자 명 |
| `receiver_zipcode` |  | 수령자 우편번호 |
| `receiver_address1` |  | 수령자 기본 주소 |
| `receiver_address2` |  | 수령자 상세 주소 |
| `receiver_phone` |  | 수령자 일반 전화 |
| `receiver_cellphone` |  | 수령자 휴대 전화 |
| `shipping_message` |  | 배송 메세지 |
| `delivery_type` |  | 배송 유형 A : 국내 · B : 해외 |
| `wished_delivery` |  | 희망배송일 사용여부 T : 사용함 · F : 사용안함 |
| `wished_delivery_start_hour` |  | 희망배송시작시간 |
| `wished_delivery_end_hour` |  | 희망배송종료시간 |
| `wished_delivery_hour_asap` |  | 가능한 빠른 배송시간 T : 사용함 · F : 사용안함 |
| `store_pickup` |  | 스토어픽업 T : 사용함 · F : 사용안함 |
| `use_virtual_phone_no` |  | 안심번호 T : 사용함 · F : 사용안함 |
| `created_date` |  | 신청일자 |
| `subscription_state` |  | 정기배송 상태 U:이용중 · P: 일시정지 · C:해지 |
| `items` |  | 주문상품목록 |

## Operations

### `GET /api/v2/admin/subscription/shipments` — Retrieve a subscription

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-subscription

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `date_type` |  |  | created_date | 검색날짜 유형 created_date : 신청일 · expected_pay_date : 결제예정일 · terminated_date : 해지일 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `subscription_id` |  |  |  | 정기배송 신청번호 |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `buyer_name` |  | 최대글자수 : [100자] |  | 주문자 이름 |
| `buyer_phone` |  |  |  | 주문자 일반 전화 |
| `buyer_cellphone` |  |  |  | 주문자 휴대 전화 |
| `product_no` |  |  |  | 상품번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `product_name` |  | 최대글자수 : [250자] |  | 상품명 |
| `product_code` |  |  |  | 상품코드 |
| `variant_code` |  |  |  | 품목코드 |
| `subscription_shipments_cycle` |  |  |  | 배송주기 ,(콤마)로 여러 건을 검색할 수 있다. 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `subscription_state` |  |  |  | 정기배송 상태 U:이용중 · P: 일시정지 · C:해지 |
| `limit` |  | 최소: [1]~최대: [100] | 20 | 조회결과 최대건수 |
| `offset` |  | 최대값: [5000] | 0 | 조회결과 시작위치 |

### `POST /api/v2/admin/subscription/shipments` — Create a subscription

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |
| `buyer_name` | ✓ | 최대글자수 : [100자] |  | 주문자 이름 |
| `buyer_zipcode` | ✓ | 글자수 최소: [2자]~최대: [14자] |  | 주문자 우편번호 |
| `buyer_address1` | ✓ | 최대글자수 : [250자] |  | 주문자 기본 주소 |
| `buyer_address2` | ✓ |  |  | 주문자 상세 주소 |
| `buyer_phone` |  | 최대글자수 : [20자] |  | 주문자 일반 전화 |
| `buyer_cellphone` | ✓ | 최대글자수 : [20자] |  | 주문자 휴대 전화 |
| `buyer_email` | ✓ | 이메일 |  | 주문자 이메일 |
| `receiver_name` | ✓ | 최대글자수 : [100자] |  | 수령자 명 |
| `receiver_zipcode` | ✓ | 글자수 최소: [2자]~최대: [13자] |  | 수령자 우편번호 |
| `receiver_address1` | ✓ |  |  | 수령자 기본 주소 |
| `receiver_address2` | ✓ |  |  | 수령자 상세 주소 |
| `receiver_phone` | ✓ | 최대글자수 : [20자] |  | 수령자 일반 전화 |
| `receiver_cellphone` | ✓ | 최대글자수 : [20자] |  | 수령자 휴대 전화 |
| `shipping_message` |  |  |  | 배송 메세지 |
| `delivery_type` |  |  | A | 배송 유형 A : 국내 · B : 해외 |
| `expected_delivery_date` | ✓ | 날짜 |  | 배송시작일 |
| `subscription_shipments_cycle` | ✓ |  |  | 배송주기 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `wished_delivery` |  |  | F | 희망배송일 사용여부 T : 사용함 · F : 사용안함 |
| `wished_delivery_start_hour` |  | 최소: [0]~최대: [23] |  | 희망배송시작시간 |
| `wished_delivery_end_hour` |  | 최소: [0]~최대: [23] |  | 희망배송종료시간 |
| `wished_delivery_hour_asap` |  |  |  | 가능한 빠른 배송시간 T : 사용함 · F : 사용안함 |
| `store_pickup` |  |  | F | 스토어픽업 T : 사용함 · F : 사용안함 |
| `use_virtual_phone_no` |  |  | F | 안심번호 T : 사용함 · F : 사용안함 |
| `max_delivery_limit` |  | 최소값: [0]; 최대값: [12] | 0 | 정기배송 횟수 0 : 제한없음 · 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 10 : 10회 · 12 : 12회 |
| `items` |  |  |  | 주문상품목록 |
| ↳ `product_code` | ✓ |  |  | 상품코드 |
| ↳ `product_no` | ✓ |  |  | 상품번호 |
| ↳ `product_name` | ✓ |  |  | 상품명 |
| ↳ `options` |  | Array |  |  |
| ↳ ↳ `name` |  |  |  | 옵션명 |
| ↳ ↳ `value` |  |  |  | 옵션값 |
| ↳ ↳ `option_code` |  |  |  | 연동형 옵션코드 |
| ↳ ↳ `value_no` |  |  |  | 연동형 옵션값 |
| ↳ `option_id` | ✓ |  |  | 상품옵션 아이디 · DEFAULT 000A |
| ↳ `quantity` | ✓ |  |  | 주문 수량 |
| ↳ `product_price` | ✓ |  |  | 상품 판매가 |
| ↳ `option_price` |  |  |  | 옵션 추가 가격 |
| ↳ `shipping_payment_option` |  |  |  | 선/착불 구분 · C : 착불 · P : 선결제 · F : 무료 |
| ↳ `category_no` |  |  |  | 분류 번호 |
| ↳ `product_bundle` |  |  |  | 세트상품 여부 · T : 세트상품 · F : 세트상품 아님 · DEFAULT F |
| ↳ `bundle_product_components` |  | Array |  |  |
| ↳ ↳ `product_code` |  |  |  | 상품코드 |
| ↳ ↳ `product_no` |  |  |  | 상품번호 |
| ↳ ↳ `option_id` |  |  |  | 상품옵션 아이디 |
| ↳ ↳ `quantity` |  |  |  | 주문 수량 |

### `PUT /api/v2/admin/subscription/shipments/{subscription_id}` — Update a subscription

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-subscription

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `subscription_id` | ✓ |  |  | 정기배송 신청번호 |
| `receiver_name` |  | 최대글자수 : [100자] |  | 수령자 명 |
| `receiver_zipcode` |  | 글자수 최소: [2자]~최대: [14자] |  | 수령자 우편번호 |
| `receiver_address1` |  |  |  | 수령자 기본 주소 |
| `receiver_address2` |  |  |  | 수령자 상세 주소 |
| `receiver_phone` |  | 최대글자수 : [20자] |  | 수령자 일반 전화 |
| `receiver_cellphone` |  | 최대글자수 : [20자] |  | 수령자 휴대 전화 |
| `shipping_message` |  |  |  | 배송 메세지 |
| `subscription_state` |  |  |  | 정기배송 상태 U:이용중 · P:일시정지 · C:해지 |
