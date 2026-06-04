---
resource: store
entity: customers-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Customers setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers setting](https://developers.cafe24.com/docs/ko/api/admin/#customers-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원관련 설정 시 회원가입항목을 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `simple_member_join` |  | 회원가입항목 표시 T:기본항목 표시 · F:상세항목 표시 |
| `member_authentication` |  | 회원 가입인증 T:사용함 · F:사용안함 |
| `minimum_age_restriction` |  | 14세미만 가입제한 M:인증 후 이용 · T:인증없이 바로 이용 · F:가입 불가 |
| `adult_age_restriction` |  | 19세미만 가입제한 T:사용함 · F:사용안함 |
| `adult_purchase_restriction` |  | 성인인증 사용 시 구매차단 설정 T:사용함 · F:사용안함 |
| `adult_image_restriction` |  | 성인인증 사용 시 19금 이미지 노출 설정 T:사용함 · F:사용안함 |
| `gender_restriction` |  | 성별 가입제한 B:사용안함 · M:남성만 · F:여성만 |
| `member_rejoin_restriction` |  | 회원 재가입제한 T:사용함 · F:사용안함 |
| `member_rejoin_restriction_day` |  | 회원 재가입제한 기간 |
| `password_authentication` |  | 회원정보수정 페이지 접속 시 비밀번호 인증 T:사용함 · F:사용안함 |
| `member_join_confirmation` |  | 회원가입 입력 정보 확인 T:사용함 · F:사용안함 |
| `email_duplication` |  | 이메일 중복 체크 T:사용함 · F:사용안함 |
| `password_recovery` |  | 비밀번호 찾기 방법 설정 T:임시 비밀번호 전송 · N:비밀번호 즉시변경 |
| `link_social_account` |  | 회원가입 시 SNS 계정 연동 T:SNS 가입 시 동일한 이메일을 가진 계정이 있으면 연동 화면을 제공 · F:연동 화면을 제공하지 않음 |
| `save_member_id` |  | 아이디저장 T:사용함 · F:사용안함 |
| `unregistration_admin_approval` |  | 탈퇴회원 관리자 승인 T:사용함 · F:사용안함 |
| `unregistration_reason` |  | 탈퇴사유 T:사용함 · F:사용안함 |
| `display_group` |  | 회원등급 표시 T:사용 · F:사용안함 |
| `join_standard` |  | 가입기준 id:아이디 · email:이메일 |
| `use_update_birthday` |  | 생년월일 수정 T:허용함 · F:허용안함 |

## Operations

### `GET /api/v2/admin/customers/setting` — Retrieve member-related settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-member-related-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customer` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `simple_member_join` |  | 회원가입항목 표시 T:기본항목 표시 · F:상세항목 표시 |
| ↳ `member_authentication` |  | 회원 가입인증 T:사용함 · F:사용안함 |
| ↳ `minimum_age_restriction` |  | 14세미만 가입제한 M:인증 후 이용 · T:인증없이 바로 이용 · F:가입 불가 |
| ↳ `adult_age_restriction` |  | 19세미만 가입제한 T:사용함 · F:사용안함 |
| ↳ `adult_purchase_restriction` |  | 성인인증 사용 시 구매차단 설정 T:사용함 · F:사용안함 |
| ↳ `adult_image_restriction` |  | 성인인증 사용 시 19금 이미지 노출 설정 T:사용함 · F:사용안함 |
| ↳ `gender_restriction` |  | 성별 가입제한 B:사용안함 · M:남성만 · F:여성만 |
| ↳ `member_rejoin_restriction` |  | 회원 재가입제한 T:사용함 · F:사용안함 |
| ↳ `member_rejoin_restriction_day` |  | 회원 재가입제한 기간 |
| ↳ `password_authentication` |  | 회원정보수정 페이지 접속 시 비밀번호 인증 T:사용함 · F:사용안함 |
| ↳ `member_join_confirmation` |  | 회원가입 입력 정보 확인 T:사용함 · F:사용안함 |
| ↳ `email_duplication` |  | 이메일 중복 체크 T:사용함 · F:사용안함 |
| ↳ `password_recovery` |  | 비밀번호 찾기 방법 설정 T:임시 비밀번호 전송 · N:비밀번호 즉시변경 |
| ↳ `link_social_account` |  | 회원가입 시 SNS 계정 연동 T:SNS 가입 시 동일한 이메일을 가진 계정이 있으면 연동 화면을 제공 · F:연동 화면을 제공하지 않음 |
| ↳ `save_member_id` |  | 아이디저장 T:사용함 · F:사용안함 |
| ↳ `unregistration_admin_approval` |  | 탈퇴회원 관리자 승인 T:사용함 · F:사용안함 |
| ↳ `unregistration_reason` |  | 탈퇴사유 T:사용함 · F:사용안함 |
| ↳ `display_group` |  | 회원등급 표시 T:사용 · F:사용안함 |
| ↳ `join_standard` |  | 가입기준 id:아이디 · email:이메일 |

응답 예시 (JSON):

```json
{
    "customer": {
        "shop_no": 1,
        "simple_member_join": "T",
        "member_authentication": "T",
        "minimum_age_restriction": "T",
        "adult_age_restriction": "F",
        "adult_purchase_restriction": "F",
        "adult_image_restriction": "F",
        "gender_restriction": "B",
        "member_rejoin_restriction": "T",
        "member_rejoin_restriction_day": 30,
        "password_authentication": "T",
        "member_join_confirmation": "T",
        "email_duplication": "T",
        "password_recovery": "T",
        "link_social_account": "T",
        "save_member_id": "T",
        "unregistration_admin_approval": "T",
        "unregistration_reason": "T",
        "display_group": "T",
        "join_standard": "id"
    }
}
```

### `PUT /api/v2/admin/customers/setting` — Update customers setting

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-customers-setting

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `simple_member_join` |  |  |  | 회원가입항목 표시 "F"(상세항목 표시)에서 "T"(기본항목 표시)로 변경할 경우, 아래 기능은 자동으로 사용 불가 상태로 변경됨. · - 회원 가입인증 · - 14세 미만 가입제한 · - 19세 미만 가입제한 · - 성별 가입제한 · - 회원가입 입력 정보 확인 · - 본인인증 서비스 설정 · - 비밀번호 확인시 질문/답변 T:기본항목 표시 · F:상세항목 표시 |
| `member_authentication` |  |  |  | 회원 가입인증 T:사용함 · F:사용안함 |
| `minimum_age_restriction` |  |  |  | 14세미만 가입제한 M:인증 후 이용 · T:인증없이 바로 이용 · F:가입 불가 |
| `join_standard` |  |  |  | 가입기준 id:아이디 · email:이메일 |
| `use_update_birthday` |  |  |  | 생년월일 수정 T:허용함 · F:허용안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customer` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `simple_member_join` |  | 회원가입항목 표시 T:기본항목 표시 · F:상세항목 표시 |
| ↳ `member_authentication` |  | 회원 가입인증 T:사용함 · F:사용안함 |
| ↳ `minimum_age_restriction` |  | 14세미만 가입제한 M:인증 후 이용 · T:인증없이 바로 이용 · F:가입 불가 |
| ↳ `adult_age_restriction` |  | 19세미만 가입제한 T:사용함 · F:사용안함 |
| ↳ `adult_purchase_restriction` |  | 성인인증 사용 시 구매차단 설정 T:사용함 · F:사용안함 |
| ↳ `adult_image_restriction` |  | 성인인증 사용 시 19금 이미지 노출 설정 T:사용함 · F:사용안함 |
| ↳ `gender_restriction` |  | 성별 가입제한 B:사용안함 · M:남성만 · F:여성만 |
| ↳ `member_rejoin_restriction` |  | 회원 재가입제한 T:사용함 · F:사용안함 |
| ↳ `member_rejoin_restriction_day` |  | 회원 재가입제한 기간 |
| ↳ `password_authentication` |  | 회원정보수정 페이지 접속 시 비밀번호 인증 T:사용함 · F:사용안함 |
| ↳ `member_join_confirmation` |  | 회원가입 입력 정보 확인 T:사용함 · F:사용안함 |
| ↳ `email_duplication` |  | 이메일 중복 체크 T:사용함 · F:사용안함 |
| ↳ `password_recovery` |  | 비밀번호 찾기 방법 설정 T:임시 비밀번호 전송 · N:비밀번호 즉시변경 |
| ↳ `link_social_account` |  | 회원가입 시 SNS 계정 연동 T:SNS 가입 시 동일한 이메일을 가진 계정이 있으면 연동 화면을 제공 · F:연동 화면을 제공하지 않음 |
| ↳ `save_member_id` |  | 아이디저장 T:사용함 · F:사용안함 |
| ↳ `unregistration_admin_approval` |  | 탈퇴회원 관리자 승인 T:사용함 · F:사용안함 |
| ↳ `unregistration_reason` |  | 탈퇴사유 T:사용함 · F:사용안함 |
| ↳ `display_group` |  | 회원등급 표시 T:사용 · F:사용안함 |
| ↳ `join_standard` |  | 가입기준 id:아이디 · email:이메일 |
| ↳ `use_update_birthday` |  | 생년월일 수정 T:허용함 · F:허용안함 |

응답 예시 (JSON):

```json
{
    "customer": {
        "shop_no": 1,
        "simple_member_join": "T",
        "member_authentication": "F",
        "minimum_age_restriction": "T",
        "adult_age_restriction": "F",
        "adult_purchase_restriction": "F",
        "adult_image_restriction": "F",
        "gender_restriction": "B",
        "member_rejoin_restriction": "T",
        "member_rejoin_restriction_day": 30,
        "password_authentication": "T",
        "member_join_confirmation": "T",
        "email_duplication": "T",
        "password_recovery": "T",
        "link_social_account": "T",
        "save_member_id": "T",
        "unregistration_admin_approval": "T",
        "unregistration_reason": "T",
        "display_group": "T",
        "join_standard": "id",
        "use_update_birthday": "T"
    }
}
```
