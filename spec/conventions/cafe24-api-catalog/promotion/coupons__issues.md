---
resource: promotion
entity: coupons__issues
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#coupons--issues
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Promotion / Coupons issues

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Coupons issues](https://developers.cafe24.com/docs/ko/api/admin/#coupons--issues)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쿠폰 발급(Coupons issues)은 생성된 쿠폰에 관한 기능입니다. · 쿠폰 발급은 하위 리소스로 쿠폰(Coupons) 하위에서만 사용할 수 있습니다. · 생성된 쿠폰에 대한 발급, 발급한 쿠폰에 대한 조회가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `coupon_no` |  | 쿠폰번호 |
| `issue_no` |  | 쿠폰 발급번호 |
| `member_id` |  | 회원아이디 |
| `group_no` |  | 발급대상 회원등급 번호 |
| `issued_date` |  | 쿠폰 발급일자 |
| `expiration_date` |  | 만료일 |
| `used_coupon` |  | 쿠폰사용 여부 |
| `used_date` |  | 쿠폰 사용 일자 |
| `related_order_id` |  | 관련 주문번호 |
| `count` |  | 카운트 |

## Operations

### `GET /api/v2/admin/coupons/{coupon_no}/issues` — Retrieve a list of issued coupons

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-issued-coupons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `coupon_no` | ✓ |  |  | 쿠폰번호 |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `group_no` |  |  |  | 회원등급번호 |
| `issued_date` |  | 날짜 |  | 쿠폰 발급일자 |
| `issued_start_date` |  | 날짜 |  | 검색 시작일 |
| `issued_end_date` |  | 날짜 |  | 검색 종료일 |
| `used_coupon` |  |  |  | 쿠폰사용 여부 T : 사용함 · F : 사용안함 |
| `since_issue_no` |  |  |  | 해당 쿠폰 발급번호 이후 검색 특정 쿠폰발급 이후의 쿠폰을 검색. · 해당 검색조건 사용시 offset과 관계 없이 모든 쿠폰 발급번호를 검색할 수 있다. · ※ 해당 검색 조건 사용시 다음 파라메터로는 사용할 수 없다. · offset |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |

### `POST /api/v2/admin/coupons/{coupon_no}/issues` — Create coupon issuance history

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-coupon-issuance-history

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `shop_no` |  |  |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `coupon_no` | ✓ |  |  | 쿠폰번호 |
| `issued_member_scope` | ✓ |  |  | 회원/조건 선택 쿠폰 발급 대상 회원의 범위를 특정하여 쿠폰을 발급할 수 있음. · 특정회원그룹(G)을 입력할 경우 group_no를 필수로 입력해야한다. · 특정회원(M)을 입력할 경우 member_id를 필수로 입력해야한다. A : 전체 회원 · G : 특정 회원 그룹 · M : 특정 회원 |
| `group_no` |  |  |  | 회원등급번호 |
| `member_id` |  |  |  | 회원아이디 |
| `send_sms_for_issue` |  |  | F | 쿠폰발급 SMS 발송 여부 쿠폰 발급정보를 SMS로 발송할지 여부 EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음. T : 발송함 · F : 발송안함 |
| `allow_duplication` |  |  | F | 중복발급설정 쿠폰의 중복발급설정 여부. T : 발급함 · F : 발급안함 · S : 발급안함(사용유무 · 사용기간 추가검증 안 함) |
| `single_issue_per_once` |  |  | T | 1회 발급시 1장만 발급할지 여부 쿠폰을 발급할 때 1회 발급시 1장만 발급할지 여부 T : 1장씩 발급 · F : 동시발행수량 설정만큼 발급 |
| `issue_count_per_once` |  | 최소값: [2]; 최대값: [10] | 2 | 다수 발행시 발행 수량 쿠폰 1회 발급시 여러장 발행하는 경우 그 수량 |
| `issued_place_type` |  |  |  | 발급처 구분 쿠폰이 발행된 출처 구분 W : 웹 · M : 모바일 · P : 브랜드앱 |
| `issued_by_action_type` |  |  |  | 앱 설치시 쿠폰 발급 앱 설치시 쿠폰이 발급되는 시점 INSTALLATION : 앱 설치시 쿠폰 발급 · ACCEPTING_PUSH : 앱 푸시 수신 On시 쿠폰 발급 |
| `issued_by_event_type` |  |  |  | 발급 사유 구분 혜택으로 인한 쿠폰발급 시 해당되는 혜택 C : 출석체크 이벤트 · U : 회원정보 수정 이벤트 · B : 배너수익쉐어프로그램 · R : 룰렛게임(CMC)팀 · Z : 브랜드앱 설치(브랜드앱) · Y : 푸시알림 ON(브랜드앱) · X : 브랜드앱 주문(브랜드앱) · M : 리마인드 Me 주문 · W : 리마인드 Me 리워드 · V : 통합멤버십 · L : 평생회원 전환 이벤트 |
| `request_admin_id` |  |  |  | 발급자 ID |
