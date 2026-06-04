---
resource: promotion
entity: customerevents
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customerevents
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Promotion / Customerevents

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customerevents](https://developers.cafe24.com/docs/ko/api/admin/#customerevents)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원정보 이벤트관리와 관련하여 SMS 수신동의 유도, 이메일 등록 유도 등 프로모션 연계 및 등록된 이벤트 목록과 실행 여부 파악할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `no` |  | 이벤트 번호 |
| `type` |  | 이벤트 유형 E: 회원정보수정 · P: 비밀번호변경 · L: 평생회원전환 |
| `name` |  | 이벤트 이름 |
| `description` |  | 이벤트 설명 |
| `start_date` |  | 이벤트 시작 시간 |
| `end_date` |  | 이벤트 종료 시간 |
| `created_date` |  | 이벤트 생성일 |
| `items` |  | 이벤트 항목 zipcode: 새 우편번호 주소 · address: 주소 수정 · cellphone: 휴대폰번호 · password: 비밀번호 수정 · 모바일 메시지: 모바일 메시지 수신 동의 · email: 이메일 수신 동의 |
| `reward_condition` |  | 이벤트 조건 O: 설정한 항목 중 1개 이상 수정한 경우 혜택 지급 · A: 설정한 항목을 모두 수정한 경우 혜택 지급 |
| `agree_restriction` |  | 이메일/모바일 메시지 수신동의 지급 제한 설정 사용 여부 T: 사용함 · F: 사용안함 |
| `agree_restriction_period` |  | 이메일/모바일 메시지 수신동의 변경 불가 기간 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 12개월 · -1: 무기한 |
| `auto_reward` |  | 혜택 자동 지급 설정 여부 T: 사용함 · F: 사용안함 |
| `use_point` |  | 혜택 자동 지급 적립금 사용 여부 T: 사용함 · F: 사용안함 |
| `point_amount` |  | 혜택 자동 지급 적립금 |
| `use_coupon` |  | 혜택 자동 지급 쿠폰 사용 여부 T: 사용함 · F: 사용안함 |
| `coupon_no` |  | 혜택 자동 지급 쿠폰 |
| `popup_notification` |  | 평생회원 전환 이벤트 안내 팝업 사용 여부 T: 사용함 · F: 사용안함 |
| `status` |  | 이벤트 상태 |

## Operations

### `GET /api/v2/admin/customerevents` — View member information event

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#view-member-information-event

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `name` |  | 최대글자수 : [200자] |  | 이벤트 이름 |
| `search_date` |  |  | created_date | 검색 기준일 created_date: 이벤트 생성일 · start_date: 이벤트 시작일 · end_date: 이벤트 종료일 |
| `start_date` |  | 날짜 |  | 검색 시작일 |
| `end_date` |  | 날짜 |  | 검색 종료일 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customerevents` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `no` |  | 이벤트 번호 |
| ↳ `type` |  | 이벤트 유형 E: 회원정보수정 · P: 비밀번호변경 · L: 평생회원전환 |
| ↳ `name` |  | 이벤트 이름 |
| ↳ `description` |  | 이벤트 설명 |
| ↳ `start_date` |  | 이벤트 시작 시간 |
| ↳ `end_date` |  | 이벤트 종료 시간 |
| ↳ `created_date` |  | 이벤트 생성일 |
| ↳ `items` |  | 이벤트 항목 zipcode: 새 우편번호 주소 · address: 주소 수정 · cellphone: 휴대폰번호 · password: 비밀번호 수정 · 모바일 메시지: 모바일 메시지 수신 동의 · email: 이메일 수신 동의 |
| ↳ `reward_condition` |  | 이벤트 조건 O: 설정한 항목 중 1개 이상 수정한 경우 혜택 지급 · A: 설정한 항목을 모두 수정한 경우 혜택 지급 |
| ↳ `agree_restriction` |  | 이메일/모바일 메시지 수신동의 지급 제한 설정 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `agree_restriction_period` |  | 이메일/모바일 메시지 수신동의 변경 불가 기간 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 12개월 · -1: 무기한 |
| ↳ `auto_reward` |  | 혜택 자동 지급 설정 여부 T: 사용함 · F: 사용안함 |
| ↳ `use_point` |  | 혜택 자동 지급 적립금 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `point_amount` |  | 혜택 자동 지급 적립금 |
| ↳ `use_coupon` |  | 혜택 자동 지급 쿠폰 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `coupon_no` |  | 혜택 자동 지급 쿠폰 |
| ↳ `popup_notification` |  | 평생회원 전환 이벤트 안내 팝업 사용 여부 T: 사용함 · F: 사용안함 |
| `links` |  | (목록) |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "customerevents": [
        {
            "shop_no": 1,
            "no": 1,
            "type": "E",
            "name": "Member Information Update Event",
            "description": "This is a description for the member information update event.",
            "start_date": "2025-01-31T00:00:00+09:00",
            "end_date": "2025-02-28T00:00:00+09:00",
            "created_date": "2025-01-30T12:34:56+09:00",
            "items": [
                "zipcode",
                "email"
            ],
            "reward_condition": "A",
            "agree_restriction": "T",
            "agree_restriction_period": 3,
            "auto_reward": "T",
            "use_point": "T",
            "point_amount": "1000.00",
            "use_coupon": "T",
            "coupon_no": "9000000000000000033",
            "popup_notification": "F"
        },
        {
            "shop_no": 1,
            "no": 2,
            "type": "L",
            "name": "Lifetime Member Event",
            "description": "This is a description for the lifetime member event.",
            "start_date": "2025-01-30T12:34:56+09:00",
            "end_date": "9999-12-31T23:59:59+09:00",
            "created_date": "2025-01-30T12:34:56+09:00",
            "items": null,
            "reward_condition": null,
            "agree_restriction": null,
            "agree_restriction_period": null,
            "auto_reward": "T",
            "use_point": null,
            "point_amount": null,
            "use_coupon": "T",
            "coupon_no": "9000000000000000034",
            "popup_notification": "T"
        }
    ],
    "links": [
        {
            "rel": "prev",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/customerevents?limit=10&offset=0"
        },
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/customerevents?limit=10&offset=20"
        }
    ]
}
```

### `POST /api/v2/admin/customerevents` — Create a member information modification event

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-member-information-modification-event

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `type` | ✓ |  |  | 이벤트 유형 E: 회원정보수정 · P: 비밀번호변경 · L: 평생회원전환 |
| `name` | ✓ | 최대글자수 : [200자] |  | 이벤트 이름 |
| `description` |  | 최대글자수 : [200자] |  | 이벤트 설명 |
| `start_date` |  | 날짜 |  | 이벤트 시작 시간 |
| `end_date` |  | 날짜 |  | 이벤트 종료 시간 |
| `items` |  | 배열 최대사이즈: [6] |  | 이벤트 항목 zipcode: 새 우편번호 주소 · address: 주소 수정 · cellphone: 휴대폰번호 · password: 비밀번호 수정 · 모바일 메시지: 모바일 메시지 수신 동의 · email: 이메일 수신 동의 |
| `reward_condition` |  |  |  | 이벤트 조건 O: 설정한 항목 중 1개 이상 수정한 경우 혜택 지급 · A: 설정한 항목을 모두 수정한 경우 혜택 지급 |
| `agree_restriction` |  |  |  | 이메일/모바일 메시지 수신동의 지급 제한 설정 사용 여부 T: 사용함 · F: 사용안함 |
| `agree_restriction_period` |  |  |  | 이메일/모바일 메시지 수신동의 변경 불가 기간 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 12개월 · -1: 무기한 |
| `auto_reward` |  |  |  | 혜택 자동 지급 설정 여부 T: 사용함 · F: 사용안함 |
| `use_point` |  |  |  | 혜택 자동 지급 적립금 사용 여부 T: 사용함 · F: 사용안함 |
| `point_amount` |  |  |  | 혜택 자동 지급 적립금 |
| `use_coupon` |  |  |  | 혜택 자동 지급 쿠폰 사용 여부 T: 사용함 · F: 사용안함 |
| `coupon_no` |  |  |  | 혜택 자동 지급 쿠폰 |
| `popup_notification` |  |  |  | 평생회원 전환 이벤트 안내 팝업 사용 여부 T: 사용함 · F: 사용안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customerevent` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `no` |  | 이벤트 번호 |
| ↳ `type` |  | 이벤트 유형 E: 회원정보수정 · P: 비밀번호변경 · L: 평생회원전환 |
| ↳ `name` |  | 이벤트 이름 |
| ↳ `description` |  | 이벤트 설명 |
| ↳ `start_date` |  | 이벤트 시작 시간 |
| ↳ `end_date` |  | 이벤트 종료 시간 |
| ↳ `created_date` |  | 이벤트 생성일 |
| ↳ `items` |  | 이벤트 항목 zipcode: 새 우편번호 주소 · address: 주소 수정 · cellphone: 휴대폰번호 · password: 비밀번호 수정 · 모바일 메시지: 모바일 메시지 수신 동의 · email: 이메일 수신 동의 |
| ↳ `reward_condition` |  | 이벤트 조건 O: 설정한 항목 중 1개 이상 수정한 경우 혜택 지급 · A: 설정한 항목을 모두 수정한 경우 혜택 지급 |
| ↳ `agree_restriction` |  | 이메일/모바일 메시지 수신동의 지급 제한 설정 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `agree_restriction_period` |  | 이메일/모바일 메시지 수신동의 변경 불가 기간 1: 1개월 · 3: 3개월 · 6: 6개월 · 12: 12개월 · -1: 무기한 |
| ↳ `auto_reward` |  | 혜택 자동 지급 설정 여부 T: 사용함 · F: 사용안함 |
| ↳ `use_point` |  | 혜택 자동 지급 적립금 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `point_amount` |  | 혜택 자동 지급 적립금 |
| ↳ `use_coupon` |  | 혜택 자동 지급 쿠폰 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `coupon_no` |  | 혜택 자동 지급 쿠폰 |
| ↳ `popup_notification` |  | 평생회원 전환 이벤트 안내 팝업 사용 여부 T: 사용함 · F: 사용안함 |

응답 예시 (JSON):

```json
{
    "customerevent": {
        "shop_no": 1,
        "no": 1,
        "type": "E",
        "name": "Member Information Update Event",
        "description": "This is a description for the member information update event.",
        "start_date": "2025-01-31T00:00:00+09:00",
        "end_date": "2025-02-28T00:00:00+09:00",
        "created_date": "2025-01-30T12:34:56+09:00",
        "items": [
            "zipcode",
            "email"
        ],
        "reward_condition": "A",
        "agree_restriction": "T",
        "agree_restriction_period": 3,
        "auto_reward": "T",
        "use_point": "T",
        "point_amount": "1000.00",
        "use_coupon": "T",
        "coupon_no": "9000000000000000033",
        "popup_notification": "F"
    }
}
```

### `PUT /api/v2/admin/customerevents` — Update information update campaign status

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-information-update-campaign-status

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `no` | ✓ |  |  | 이벤트 번호 |
| `status` | ✓ |  |  | 이벤트 상태 S: 이벤트종료 · D: 이벤트삭제 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customerevent` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `no` |  | 이벤트 번호 |
| ↳ `status` |  | 이벤트 상태 |

응답 예시 (JSON):

```json
{
    "customerevent": {
        "shop_no": 1,
        "no": [
            1,
            2
        ],
        "status": "D"
    }
}
```
