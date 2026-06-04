---
resource: store
entity: points-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#points-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Points setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Points setting](https://developers.cafe24.com/docs/ko/api/admin/#points-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

적립금 설정(Points setting)은 적립금 사용에 필요한 설정값을 관리하기 위한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `point_issuance_standard` |  | 적립금 지급 기준 C: 배송완료 후 · P: 구매확정 후 |
| `payment_period` |  | 적립금 지급 시점 적립금 지급 기준이 C: 배송완료 후 일때 1/3/7/14/20을 입력할 수 있습니다. · 적립금 지급 기준이 P: 구매확정 후 일때 0/1/3/7/14/20을 입력할 수 있습니다. |
| `name` |  | 적립금 명칭 |
| `format` |  | 적립금 표시 방식 |
| `round_unit` |  | 적립금 절사 단위 F : 절사안함 · 0.01 : 0.01단위 · 0.1 : 0.1단위 · 1 : 1단위 · 10 : 10단위 · 100 : 100단위 · 1000 : 1000단위 |
| `round_type` |  | 적립금 절사 방식 A : 내림 · B : 반올림 · C : 올림 |
| `display_type` |  | 적립금 항목 노출 설정 P : 정율 · W : 정액 · WP : 정액/정율 · PW : 정율/정액 |
| `unusable_points_change_type` |  | 미가용 적립금 변환 기준 설정 M: 최초 상품 배송완료일/구매확정일 기준으로 적립 · T: 마지막 상품 배송완료일/구매확정일 기준으로 적립 |
| `join_point` |  | 회원가입 적립금 |
| `use_email_agree_point` |  | 이메일 수신동의 적립금 사용여부 T:사용함 · F:사용안함 |
| `use_sms_agree_point` |  | 모바일 메시지 수신동의 적립금 사용여부 T:사용함 · F:사용안함 |
| `agree_change_type` |  | 회원가입 시 수신동의 변경타입 T:변경가능 · F:변경불가 · P:일정기간 동안 변경 불가 |
| `agree_restriction_period` |  | 수신동의 변경 불가 기간 1:1개월 · 3:3개월 · 6:6개월 · 12:1년 |
| `agree_point` |  | 수신동의 적립금 |
| `available_min_price` |  | 적립금 사용 가능 최소 상품 구매 합계액 |
| `available_min_point` |  | 적립금 사용 가능 최소 누적 적립금액 |

## Operations

### `GET /api/v2/admin/points/setting` — Retrieve points settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "point": {
        "shop_no": 1,
        "point_issuance_standard": "C",
        "payment_period": 20,
        "name": "mileage",
        "format": "$[:PRICE:]",
        "round_unit": "0.01",
        "round_type": "A",
        "display_type": "PW",
        "unusable_points_change_type": "M",
        "join_point": "100.00",
        "use_email_agree_point": "T",
        "use_sms_agree_point": "F",
        "agree_change_type": "P",
        "agree_restriction_period": 12,
        "agree_point": "200.00",
        "available_min_price": "10000.00",
        "available_min_point": "1000.00"
    }
}
```

### `PUT /api/v2/admin/points/setting` — Update points settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-points-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `point_issuance_standard` |  |  |  | 적립금 지급 기준 C: 배송완료 후 · P: 구매확정 후 |
| `payment_period` |  |  |  | 적립금 지급 시점 적립금 지급 기준이 C: 배송완료 후 일때 1/3/7/14/20을 입력할 수 있습니다. · 적립금 지급 기준이 P: 구매확정 후 일때 0/1/3/7/14/20을 입력할 수 있습니다. |
| `name` |  |  |  | 적립금 명칭 |
| `format` |  |  |  | 적립금 표시 방식 |
| `round_unit` |  |  |  | 적립금 절사 단위 화폐단위가 "KRW" "JPY" "TWD" "VND"일때 "적립금 절사 단위"를 F/1/10/100/1000을 입력할 수 있습니다. · 화폐단위가 "KRW" "JPY" "TWD" "VND"가 아닐때 "적립금 절사 단위"를 F/0.01/0.1/1/10을 입력할 수 있습니다. |
| `round_type` |  |  |  | 적립금 절사 방식 A : 내림 · B : 반올림 · C : 올림 |
| `display_type` |  |  |  | 적립금 항목 노출 설정 P : 정율 · W : 정액 · WP : 정액/정율 · PW : 정율/정액 |
| `unusable_points_change_type` |  |  |  | 미가용 적립금 변환 기준 설정 M: 최초 상품 배송완료일/구매확정일 기준으로 적립 · T: 마지막 상품 배송완료일/구매확정일 기준으로 적립 |
| `join_point` |  |  |  | 회원가입 적립금 |
| `use_email_agree_point` |  |  |  | 이메일 수신동의 적립금 사용여부 T:사용함 · F:사용안함 |
| `use_sms_agree_point` |  |  |  | 모바일 메시지 수신동의 적립금 사용여부 T:사용함 · F:사용안함 |
| `agree_change_type` |  |  |  | 회원가입 시 수신동의 변경타입 T:변경가능 · F:변경불가 · P:일정기간 동안 변경 불가 |
| `agree_restriction_period` |  |  |  | 수신동의 변경 불가 기간 1:1개월 · 3:3개월 · 6:6개월 · 12:1년 |
| `agree_point` |  |  |  | 수신동의 적립금 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "point": {
        "shop_no": 1,
        "point_issuance_standard": "C",
        "payment_period": 20,
        "name": "mileage",
        "format": "$[:PRICE:]",
        "round_unit": "100",
        "round_type": "A",
        "display_type": "PW",
        "unusable_points_change_type": "M",
        "join_point": "100.00",
        "use_email_agree_point": "T",
        "use_sms_agree_point": "F",
        "agree_change_type": "P",
        "agree_restriction_period": 12,
        "agree_point": "200.00"
    }
}
```
