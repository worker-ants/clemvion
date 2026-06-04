---
resource: order
entity: reservations
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#reservations
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Reservations

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Reservations](https://developers.cafe24.com/docs/ko/api/admin/#reservations)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

예약주문관련 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `order_date` |  | 주문일 |
| `payment_date` |  | 결제일 |
| `member_id` |  | 회원아이디 |
| `order_status` |  | 주문상태 |
| `shipping_code` |  | 배송번호 |
| `payment_method` |  | 결제수단 코드 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · coupon : 쿠폰 · market_discount : 마켓할인 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| `payment_method_name` |  | 결제수단명 |
| `product_no` |  | 상품번호 |
| `product_name` |  | 상품명 |
| `product_name_default` |  | 기본 상품명 |
| `product_price` |  | 상품 판매가 |
| `option_price` |  | 옵션 추가 가격 |
| `quantity` |  | 수량 |
| `option_value` |  | 옵션값 |
| `option_value_default` |  | 기본옵션값 |
| `additional_option_values` |  | 추가입력 옵션 목록 |
| `payment_amount` |  | 품목별 결제금액 |
| `paid` |  | 결제 여부 T : 결제 · F : 미결제 · M : 부분 결제 |
| `service_use_date` |  | 서비스 이용일 |
| `service_available_start_date` |  | 서비스 이용가능기간 시작일 |
| `service_available_end_date` |  | 서비스 이용가능기간 종료일 |
| `service_completion_date` |  | 서비스 이용 완료일 |
| `cancel_fee_amount` |  | 취소수수료 |

## Operations

### `GET /api/v2/admin/reservations` — Retrieve a booked item

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-booked-item

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `date_type` |  |  | order_date | 검색날짜 유형 order_date: 주문일 · pay_date: 결제일 · service_use_date: 서비스 이용일 |
| `start_date` |  | 날짜 |  | 검색 시작일 |
| `end_date` |  | 날짜 |  | 검색 종료일 |
| `order_id` |  | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `order_item_code` |  |  |  | 품주코드 ,(콤마)로 여러 건을 검색할 수 있다. |
| `buyer_name` |  |  |  | 주문자명 |
| `member_id` |  |  |  | 회원아이디 |
| `member_email` |  |  |  | 회원 이메일 |
| `buyer_email` |  |  |  | 주문자 이메일 |
| `buyer_cellphone` |  |  |  | 주문자 휴대 전화 |
| `product_no` |  |  |  | 상품번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `order_status` |  |  |  | 주문상태 ,(콤마)로 여러 건을 검색할 수 있다. N00 : 입금전 · N02 : 주문접수중 · N10 : 상품준비중 · N20 : 배송준비중 · N21 : 배송대기 · N22 : 배송보류 · N30 : 배송중 · N40 : 배송완료 · N50 : 구매확정 · C00 : 취소신청 · C10 : 취소접수 - 관리자 · C11 : 취소접수거부 - 관리자 · C34 : 취소처리중 - 환불전 · C35 : 취소처리중 - 환불완료 · C36 : 취소처리중 - 환불보류 · C40 : 취소완료 · C41 : 취소 완료 - 환불전 · C42 : 취소 완료 - 환불요청중 · C43 : 취소 완료 - 환불보류 · C47 : 입금전취소 - 구매자 · C48 : 입금전취소 - 자동취소 · C49 : 입금전취소 - 관리자 · R00 : 반품신청 · R10 : 반품접수 · R11 : 반품 접수 거부 · R12 : 반품보류 · R13 : 반품접수 - 수거완료(자동) · R20 : 반품 수거 완료 · R30 : 반품처리중 - 수거전 · R31 : 반품처리중 - 수거완료 · R34 : 반품처리중 - 환불전 · R36 : 반품처리중 - 환불보류 · R40 : 반품완료 - 환불완료 · R41 : 반품완료 - 환불전 · R42 : 반품완료 - 환불요청중 · R43 : 반품완료 - 환불보류 · E00 : 교환신청 · E10 : 교환접수 · N01 : 교환접수 - 교환상품 · E11 : 교환접수거부 · E12 : 교환보류 · E13 : 교환접수 - 수거완료(자동) · E20 : 교환준비 · E30 : 교환처리중 - 수거전 · E31 : 교환처리중 - 수거완료 · E32 : 교환처리중 - 입금전 · E33 : 교환처리중 - 입금완료 · E34 : 교환처리중 - 환불전 · E35 : 교환처리중 - 환불완료 · E36 : 교환처리중 - 환불보류 · E40 : 교환완료 · E41 : 교환 완료 - 교환철회 · E50 : 교환철회 - 판매자 · E51 : 교환철회 - 구매자 |
| `payment_status` |  |  |  | 결제상태 F : 입금전 · M : 추가입금대기 · P : 결제완료 |
| `receiver_name` |  |  |  | 수령자명 |
| `receiver_cellphone` |  |  |  | 수령자 휴대 전화 |
| `supplier_id` |  |  |  | 공급사 아이디 ,(콤마)로 여러 건을 검색할 수 있다. |
| `supplier_name` |  | 최대글자수 : [100자] |  | 공급사명 |
| `sort` |  |  | order_date | 정렬 순서 값 order_date: 주문일 · service_use_date: 서비스 이용일 |
| `order` |  |  | desc | 정렬 순서 asc : 순차정렬 · desc : 역순 정렬 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `reservations` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `order_date` |  | 주문일 |
| ↳ `payment_date` |  | 결제일 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `buyer_name` |  |  |
| ↳ `order_status` |  | 주문상태 |
| ↳ `paid` |  | 결제 여부 T : 결제 · F : 미결제 · M : 부분 결제 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `product_name` |  | 상품명 |
| ↳ `product_price` |  | 상품 판매가 |
| ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ `quantity` |  | 수량 |
| ↳ `option_value` |  | 옵션값 |
| ↳ `additional_option_values` |  | 추가입력 옵션 목록 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `type` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `value` |  |  |
| ↳ `payment_amount` |  | 품목별 결제금액 |
| ↳ `service_use_date` |  | 서비스 이용일 |
| ↳ `service_available_start_date` |  | 서비스 이용가능기간 시작일 |
| ↳ `service_available_end_date` |  | 서비스 이용가능기간 종료일 |
| ↳ `service_completion_date` |  | 서비스 이용 완료일 |
| ↳ `cancel_fee_amount` |  | 취소수수료 |
| `links` |  | (목록) |
| ↳ `rel` |  |  |
| ↳ `hredf` |  |  |

응답 예시 (JSON):

```json
{
    "reservations": [
        {
            "shop_no": 1,
            "order_id": "20240205-0000023",
            "order_item_code": "20240205-0000023-01",
            "order_date": "2024-02-05T12:30:00+09:00",
            "payment_date": "2024-02-05T12:30:00+09:00",
            "member_id": "sampleid",
            "buyer_name": "John Doe",
            "order_status": "N30",
            "paid": "T",
            "product_no": 7,
            "product_name": "Standard double 1",
            "product_price": "100000.00",
            "option_price": "15000.00",
            "quantity": 1,
            "option_value": "Extra Bed=1",
            "additional_option_values": [
                {
                    "key": "item_option_add",
                    "type": "text",
                    "name": "Additional Customer Requests",
                    "value": "I would like an extra bed, please."
                },
                {
                    "key": "file_option",
                    "type": "path",
                    "name": "Additional Image",
                    "value": "https://sample.cafe24.com/api/product/fileupload/?cmd=download&path=0%2F8%2F08de7dfa5d61611e346856522c50a6d965c9fe563edbd&filename=2302131754.jpg"
                }
            ],
            "payment_amount": "115000.00",
            "service_use_date": "2024-02-26T00:00:00+09:00",
            "service_available_start_date": "2024-02-01T00:00:00+09:00",
            "service_available_end_date": "2024-05-01T00:00:00+09:00",
            "service_completion_date": "2024-02-27T11:00:00+09:00",
            "cancel_fee_amount": null
        },
        {
            "shop_no": 1,
            "order_id": "20240210-0000723",
            "order_item_code": "20240210-0000723-01",
            "order_date": "2024-02-10T07:30:00+09:00",
            "payment_date": "2024-02-10T07:30:00+09:00",
            "member_id": "sampleid",
            "buyer_name": "John Doe",
            "order_status": "N20",
            "payment_method": [
                "card"
            ],
            "product_no": 7,
            "product_name": "Standard double 1",
            "product_price": "120000.00",
            "option_price": "15000.00",
            "quantity": 1,
            "option_value": "Extra Bed=1",
            "additional_option_values": [
                {
                    "key": "item_option_add",
                    "type": "text",
                    "name": "Additional Customer Requests",
                    "value": "I would like an extra bed, please."
                },
                {
                    "key": "file_option",
                    "type": "path",
                    "name": "Additional Image",
                    "value": "https://sample.cafe24.com/api/product/fileupload/?cmd=download&path=0%2F8%2F08de7dfa5d61611e346856522c50a6d965c9fe563edbd&filename=2402111754.jpg"
                }
            ],
            "payment_amount": "135000.00",
            "paid": "T",
            "service_use_date": "2024-02-27T00:00:00+09:00",
            "service_available_start_date": "2024-02-01T00:00:00+09:00",
            "service_available_end_date": "2024-05-01T00:00:00+09:00",
            "service_completion_date": "2024-02-28T11:00:00+09:00",
            "cancel_fee_amount": null
        }
    ],
    "links": [
        {
            "rel": "next",
            "hredf": "https://sample.cafe24api.com/api/v2/admin/reservations?limit=10&offset=10"
        }
    ]
}
```
