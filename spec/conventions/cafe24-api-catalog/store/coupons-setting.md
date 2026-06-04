---
resource: store
entity: coupons-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#coupons-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Coupons setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Coupons setting](https://developers.cafe24.com/docs/ko/api/admin/#coupons-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쿠폰 설정(Coupons setting)은 쇼핑몰에서 사용할 쿠폰의 기본적인 설정을 입력할 수 있습니다. · 쿠폰의 할인, 적립 기능의 사용여부와 제한조건, 진열 등 다양한 측면의 설정이 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `use_coupon` |  | 쿠폰사용 T:사용함 · F:사용안함 |
| `available_issue_type` |  | 쿠폰 사용 제한 A:주문서+상품별 쿠폰 사용 · O:주문서 쿠폰만 사용 · P:상품별 쿠폰만 사용 |
| `allow_using_coupons_with_points` |  | 적립금 동시사용 T:사용함 · F:사용안함 |
| `allow_using_coupons_with_discounts` |  | 할인 동시사용 A:쿠폰+회원등급 할인 동시 사용 · C:쿠폰만 사용 · G:회원등급 할인만 사용 |
| `allow_using_product_and_order_coupons` |  | 상품/주문서 동시사용 T:사용함 · F:사용안함 |
| `recover_coupon_setting` |  | 쿠폰 복원 설정 |
| `max_coupon_count` |  | 쿠폰 사용 개수 제한 |
| `use_additional_coupon` |  | 추가 사용 쿠폰 T:사용함 · F:사용안함 |
| `additional_coupon_no` |  | 추가 사용 쿠폰 번호 |
| `expiration_notice_date_setting` |  | 쿠폰 만료일 안내 발송 기준 설정 |
| `show_coupon_to_non_members` |  | 비회원 노출설정 T:노출함 · F:노출안함 |
| `show_group_coupon_to_non_members` |  | 회원등급할인이 지정된 쿠폰 포함 T : 포함 · F : 미포함 |
| `show_issued_coupon` |  | 발급된 쿠폰 표시 여부 T:노출함 · F:노출안함 |
| `sorting_type` |  | 정렬 기준 A:쿠폰 시작일자 · B:쿠폰 종료일자 · C:쿠폰 발급일자 · D:할인/적립금액 · E:할인/적립율 |
| `download_image_type` |  | 기본 쿠폰 다운로드 이미지 1:TYPE1 · 2:TYPE2 · 3:TYPE3 · 4:TYPE4 · 5:TYPE5 |
| `background_image_type` |  | 기본 쿠폰 배경 이미지 1:TYPE1 · 2:TYPE2 · 3:TYPE3 · 4:TYPE4 · 5:TYPE5 |

## Operations

### `GET /api/v2/admin/coupons/setting` — Retrieve coupon settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-coupon-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "coupon": {
        "shop_no": 1,
        "use_coupon": "T",
        "available_issue_type": "A",
        "allow_using_coupons_with_points": "T",
        "allow_using_coupons_with_discounts": "A",
        "allow_using_product_and_order_coupons": "T",
        "recover_coupon_setting": {
            "restore_viewpoint": "A",
            "cancel_before_pay": "M",
            "cancel_after_pay": "T",
            "return": "F",
            "exchange": "F",
            "part": "F"
        },
        "max_coupon_count": {
            "product_per_product": 0,
            "order_per_order": 1,
            "product_and_order_per_order": 0,
            "product_per_order": 0,
            "product_and_order_per_day": 1
        },
        "use_additional_coupon": "T",
        "additional_coupon_no": [
            {
                "coupon_no": "6067316237600000009"
            },
            {
                "coupon_no": "6066806189000000005"
            }
        ],
        "expiration_notice_date_setting": {
            "expiration_notice_date_type": "C",
            "expiration_notice_date": {
                "one_day": "T",
                "three_day": "F",
                "seven_day": "F"
            }
        },
        "show_coupon_to_non_members": "T",
        "show_group_coupon_to_non_members": "F",
        "show_issued_coupon": "T",
        "sorting_type": "B",
        "download_image_type": "1",
        "background_image_type": "2"
    }
}
```

### `PUT /api/v2/admin/coupons/setting` — Update coupon settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-coupon-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_coupon` |  |  |  | 쿠폰사용 T:사용함 · F:사용안함 |
| `available_issue_type` |  |  |  | 쿠폰 사용 제한 A:주문서+상품별 쿠폰 사용 · O:주문서 쿠폰만 사용 · P:상품별 쿠폰만 사용 |
| `allow_using_coupons_with_points` |  |  |  | 적립금 동시사용 T:사용함 · F:사용안함 |
| `allow_using_coupons_with_discounts` |  |  |  | 할인 동시사용 A:쿠폰+회원등급 할인 동시 사용 · C:쿠폰만 사용 · G:회원등급 할인만 사용 |
| `allow_using_product_and_order_coupons` |  |  |  | 상품/주문서 동시사용 T:사용함 · F:사용안함 |
| `recover_coupon_setting` |  |  |  | 쿠폰 복원 설정 |
| ↳ `restore_viewpoint` |  |  |  | 쿠폰 복원 시점 · A: 취소/교환/반품 접수 · B: 취소/교환/반품 완료 |
| ↳ `cancel_before_pay` |  |  |  | 입금전취소 · T:자동 복원함 · F:자동 복원 안함 · M:쿠폰복원 여부를 확인함 |
| ↳ `cancel_after_pay` |  |  |  | 입금후 취소 · T:자동 복원함 · F:자동 복원 안함 · M:쿠폰복원 여부를 확인함 |
| ↳ `return` |  |  |  | 반품 · T:자동 복원함 · F:자동 복원 안함 · M:쿠폰복원 여부를 확인함 |
| ↳ `exchange` |  |  |  | 교환 · T:자동 복원함 · F:자동 복원 안함 · M:쿠폰복원 여부를 확인함 |
| ↳ `part` |  |  |  | 부분 취소/반품/교환 · F:쿠폰 복원 안함 · M:쿠폰복원 여부를 확인함 |
| `max_coupon_count` |  |  |  | 쿠폰 사용 개수 제한 |
| ↳ `product_per_product` |  |  |  | 상품당 상품쿠폰 사용 개수 제한 |
| ↳ `order_per_order` |  |  |  | 주문당 주문서 쿠폰 개수 제한 |
| ↳ `product_and_order_per_order` |  |  |  | 주문당 쿠폰 사용 개수 제한 |
| ↳ `product_per_order` |  |  |  | 주문당 상품쿠폰 쿠폰 개수 제한 |
| ↳ `product_and_order_per_day` |  |  |  | 일일 쿠폰 사용 개수 제한 |
| ↳ `product_per_item` |  |  |  | 품목당 상품쿠폰 사용 개수 제한 |
| `use_additional_coupon` |  |  |  | 추가 사용 쿠폰 T:사용함 · F:사용안함 |
| `additional_coupon_no` |  | 배열 최대사이즈: [5] |  | 추가 사용 쿠폰 번호 |
| ↳ `coupon_no` |  |  |  | 쿠폰번호 |
| `expiration_notice_date_setting` |  |  |  | 쿠폰 만료일 안내 발송 기준 설정 |
| ↳ `expiration_notice_date_type` |  |  |  | 발송 기준 설정 · 발송기간 기준 설정:C · 발송기간 전체 설정:A |
| ↳ `expiration_notice_date` |  |  |  | 발송기간 기준 설정 만료일 · 1일 전:one_day · 3일 전:three_day · 7일 전:seven_day |
| `show_coupon_to_non_members` |  |  |  | 비회원 노출설정 T:노출함 · F:노출안함 |
| `show_group_coupon_to_non_members` |  |  |  | 회원등급할인이 지정된 쿠폰 포함 T : 포함 · F : 미포함 |
| `show_issued_coupon` |  |  |  | 발급된 쿠폰 표시 여부 T:노출함 · F:노출안함 |
| `sorting_type` |  |  |  | 정렬 기준 A:쿠폰 시작일자 · B:쿠폰 종료일자 · C:쿠폰 발급일자 · D:할인/적립금액 · E:할인/적립율 |
| `download_image_type` |  |  |  | 기본 쿠폰 다운로드 이미지 1:TYPE1 · 2:TYPE2 · 3:TYPE3 · 4:TYPE4 · 5:TYPE5 |
| `background_image_type` |  |  |  | 기본 쿠폰 배경 이미지 1:TYPE1 · 2:TYPE2 · 3:TYPE3 · 4:TYPE4 · 5:TYPE5 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "coupon": {
        "shop_no": 1,
        "use_coupon": "T",
        "available_issue_type": "A",
        "allow_using_coupons_with_points": "T",
        "allow_using_coupons_with_discounts": "A",
        "allow_using_product_and_order_coupons": "T",
        "recover_coupon_setting": {
            "restore_viewpoint": "B",
            "cancel_before_pay": "M",
            "cancel_after_pay": "T",
            "return": "F",
            "exchange": "F",
            "part": "F"
        },
        "max_coupon_count": {
            "product_per_product": 0,
            "product_per_item": 0,
            "order_per_order": 1,
            "product_and_order_per_order": 0,
            "product_per_order": 0,
            "product_and_order_per_day": 1
        },
        "use_additional_coupon": "T",
        "additional_coupon_no": [
            {
                "coupon_no": "6067316237600000009"
            },
            {
                "coupon_no": "6066806189000000005"
            }
        ],
        "expiration_notice_date_setting": {
            "expiration_notice_date_type": "C",
            "expiration_notice_date": {
                "one_day": "T",
                "three_day": "F",
                "seven_day": "F"
            }
        },
        "show_coupon_to_non_members": "T",
        "show_group_coupon_to_non_members": "F",
        "show_issued_coupon": "T",
        "sorting_type": "B",
        "download_image_type": "1",
        "background_image_type": "2"
    }
}
```
