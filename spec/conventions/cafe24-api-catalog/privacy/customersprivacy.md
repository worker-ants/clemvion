---
resource: privacy
entity: customersprivacy
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customersprivacy
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Privacy / Customersprivacy

> Field-level 카탈로그. Endpoint enumeration index: [`../privacy.md`](../privacy.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customersprivacy](https://developers.cafe24.com/docs/ko/api/admin/#customersprivacy)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원 개인정보(Customersprivacy)는 특정 회원의 개인정보에 대한 리소스입니다. · 민감한 개인정보가 포함되어 있으므로 사용에 주의를 기울여야 합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `member_id` | 최대글자수 : [20자] | 회원아이디 |
| `name` |  | 이름 해당 회원의 이름 |
| `name_english` |  | 영문이름 해당 회원의 영문 이름 |
| `name_phonetic` |  | 발음표기 이름 (일본어) 해당 회원의 발음 표기 이름(일본어) |
| `phone` |  | 전화번호 해당 회원의 일반전화 |
| `cellphone` |  | 휴대전화 해당 회원의 휴대전화 |
| `email` |  | 이메일 해당 회원의 이메일 |
| `sms` |  | 모바일 메시지 수신여부 SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| `news_mail` |  | 뉴스메일 수신여부 이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| `wedding_anniversary` | 날짜 | 결혼기념일 해당 회원의 결혼기념일 |
| `birthday` | 날짜 | 생일 해당 회원의 생일 |
| `solar_calendar` |  | 양력여부 생일이 양력인지 음력인지 여부 T : 양력 · F : 음력 |
| `total_points` |  | 총 적립금 |
| `available_points` |  | 가용 적립금 |
| `used_points` |  | 사용 적립금 |
| `city` | 최대글자수 : [255자] | 시/군/도시 |
| `state` | 최대글자수 : [255자] | 주/도 |
| `address1` | 최대글자수 : [255자] | 기본 주소 해당 회원의 기본주소(시/군/도) |
| `address2` | 최대글자수 : [255자] | 상세 주소 해당 회원의 상세주소 |
| `group_no` |  | 회원등급번호 해당 회원의 회원등급의 번호 |
| `job_class` |  | 직종 해당 회원의 직종 |
| `job` |  | 직업 해당 회원의 직업 |
| `zipcode` | 최대글자수 : [14자] | 우편번호 |
| `created_date` |  | 가입일 해당 회원의 가입일시 |
| `member_authentication` |  | 회원인증여부 회원 인증여부. 인증에 따라 회원은 4종류로 구분된다. 인증회원을 특별관리회원으로 설정할 경우 해당 회원은 가장 마지막에 설정한 특별관리회원으로 표시된다. T : 인증 · F : 미인증 · B : 특별관리회원 · J : 14세미만회원 |
| `use_blacklist` |  | 불량회원설정 불량회원 여부. 불량회원일 경우 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음. T : 설정함 · F : 설정안함 |
| `blacklist_type` |  | 불량회원 차단설정 해당 회원의 불량회원 타입. 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음. P : 상품구매차단 · L : 로그인차단 · A : 로그인&상품구매 차단 |
| `last_login_date` |  | 최근 접속일시 해당 회원의 최종 로그인 일시 |
| `member_authority` |  | 회원권한구분 회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨. C : 일반회원 · P : 대표 운영자 · A : 부운영자 · S : 공급사 |
| `nick_name` | 최대글자수 : [50자] | 운영자 별명 해당 회원의 별명 |
| `recommend_id` |  | 추천인아이디 해당 회원의 가입당시 입력한 추천인 아이디 |
| `residence` |  | 지역코드 해당 회원의 주거지역 |
| `interest` |  | 관심분야 해당 회원의 관심사 |
| `gender` |  | 해당 회원의 성별 |
| `member_type` |  | 회원타입 해당 회원의 회원 타입 p : 개인 · c : 사업자 · f : 외국인 |
| `company_type` |  | 사업자 구분 해당 회원의 회원타입이 사업자일경우 p : 개인사업자 · c : 법인사업자 |
| `foreigner_type` |  | 외국인 인증방법 해당 외국인 회원의 인증방법 f : 외국인등록번호 · p : 여권번호 · d : 국제운전면허증 |
| `authentication_method` |  | 인증 수단 null : 인증안함 · i : 아이핀인증 · m : 휴대폰 본인인증 · e : 이메일인증 · d : 휴대폰 인증(중복 확인) · a : 앱 인증(기타 인증) |
| `lifetime_member` |  | 평생회원 동의여부 T : 동의함 F : 동의안함 |
| `corporate_name` |  | 법인명 해당 회원의 법인명 |
| `nationality` |  | 국적 해당 회원이 "외국인 회원"일 경우, 해당 회원의 국적 |
| `shop_name` |  | 쇼핑몰명 해당 회원의 상호명 |
| `country_code` |  | 국가코드 해당 회원이 가입시 입력한 국가 |
| `use_mobile_app` |  | 모바일앱 사용여부 해당 회원의 모바일앱 사용여부 T : 사용 · F : 사용안함 |
| `join_path` |  | 가입경로 P : PC · M : 모바일 |
| `fixed_group` |  | 회원등급 고정 여부 특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부 · 회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다. T : 고정함 · F : 고정안함 |
| `refund_bank_code` | 최대글자수 : [20자] | 환불 은행 코드 |
| `refund_bank_account_no` | 최대글자수 : [40자] | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 환불계좌 예금주 명의 |
| `company_condition` | 최대글자수 : [50자] | 업태 |
| `company_line` | 최대글자수 : [50자] | 종목 |
| `sns_list` |  | 연동중인 SNS |
| `account_reactivation_date` |  | 휴면회원 해제일 |
| `available_credits` |  | 가용 예치금 |
| `additional_information` |  | 추가항목 해당 회원의 추가항목 |

## Operations

### `GET /api/v2/admin/customersprivacy` — Retrieve a list of customer information

- **Scope**: `mall.read_privacy` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `search_type` |  |  | customer_info | 검색 타입 Youtube shopping 이용 시에는 미제공 회원 검색을 회원정보 기반으로 할지 가입일 기준으로 할지 선택하여 검색할 수 있다. · 가입일 기준으로 검색할 경우 offset과 관계 없이 전체 회원을 검색할 수 있다. · ※ 가입일 기준 사용시 created_start_date 외의 모든 검색 조건은 사용할 수 없다. customer_info : 회원정보 기반 검색 · created_date : 가입일 기준 검색 |
| `created_start_date` |  | 날짜 |  | 가입일 기준 검색시 검색 시작일 Youtube shopping 이용 시에는 미제공 search_type이 created_date 일 경우 가입일 기준의 검색 시작일. 해당 가입일 이후에 가입한 회원을 검색할 수 있다. |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `news_mail` |  |  |  | 뉴스메일 수신여부 Youtube shopping 이용 시에는 미제공 이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| `sms` |  |  |  | 모바일 메시지 수신여부 SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| `thirdparty_agree` |  |  |  | 제3자 제공 동의 여부 Youtube shopping 이용 시에는 미제공 T : 동의함 · F : 동의안함 |
| `group_no` |  |  |  | 회원등급번호 Youtube shopping 이용 시에는 미제공 해당 회원의 회원등급의 번호 |
| `search_field` |  |  |  | 검색필드 Youtube shopping 이용 시에는 미제공 조회하고자 하는 회원의 검색필드. id : 아이디 · name : 이름 · hp : 핸드폰 · tel : 전화번호 · mail : 이메일 · shop_name : 상호명 |
| `keyword` |  |  |  | 검색어 Youtube shopping 이용 시에는 미제공 조회하고자 하는 회원의 검색필드에 대한 검색어를 입력함. · ex) search_field : mail · keyword : cafe24@cafe24.com ,(콤마)로 여러 건을 검색할 수 있다. |
| `date_type` |  |  |  | 검색날짜 유형 Youtube shopping 이용 시에는 미제공 조회의 기준이 되는 검색필드. '회원가입일' 기준으로 검색할 경우 검색시작일과 검색종료일의 기간은 회원가입일 기준이 됨. join : 회원가입일 · login : 최근접속일 · age : 생년월일 · account_reactivation : 휴면해제일 · wedding : 결혼기념일 |
| `start_date` |  | 날짜 |  | 검색 시작일 Youtube shopping 이용 시에는 미제공 특정 조회기준에 대한 검색 시작일. · 검색 종료일과 같이 사용해야함. · 검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함. · ex) 2018-12-31 00:00:00 |
| `end_date` |  | 날짜 |  | 검색 종료일 Youtube shopping 이용 시에는 미제공 특정 조회기준에 대한 검색 종료일. · 검색 시작일과 같이 사용해야함. · 검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함. · ex) 2018-12-31 23:59:59 |
| `member_type` |  |  |  | 회원타입 Youtube shopping 이용 시에는 미제공 해당 회원의 회원 타입 vip : 특별관리회원 · poor : 블랙리스트 · pointfy : 통합멤버쉽 사용자 |
| `member_class` |  |  |  | 회원구분 p : 개인 · c : 사업자 · f : 외국인 |
| `residence` |  |  |  | 지역코드 Youtube shopping 이용 시에는 미제공 해당 회원의 주거지역 ,(콤마)로 여러 건을 검색할 수 있다. |
| `gender` |  |  |  | 성별 Youtube shopping 이용 시에는 미제공 해당 회원의 성별 M : 남자 · F : 여자 |
| `member_authority` |  |  | C | 회원권한구분 Youtube shopping 이용 시에는 미제공 회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨. C : 일반회원 · P : 대표 운영자 · A : 부운영자 · S : 공급사 |
| `join_path` |  |  |  | 가입경로 Youtube shopping 이용 시에는 미제공 P : PC · M : 모바일 |
| `use_mobile_app` |  |  |  | 모바일앱 사용여부 Youtube shopping 이용 시에는 미제공 T : 사용 · F : 사용안함 |
| `fixed_group` |  |  |  | 회원등급 고정 여부 Youtube shopping 이용 시에는 미제공 T : 고정함 · F : 고정안함 |
| `is_simple_join` |  |  |  | 주문서 간단회원가입 조회 여부 Youtube shopping 이용 시에는 미제공 T : 조회 · F : 조회 안 함 |
| `limit` |  | 최소: [1]~최대: [1000] | 30 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 search_type이 created_date 일 경우 creted_start_date를 증가시키면서 전체 회원을 검색할 수 있으므로 offset은 사용할 수 없다. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customersprivacy` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `member_id` | 최대글자수 : [20자] | 회원아이디 |
| ↳ `name` |  | 이름 해당 회원의 이름 |
| ↳ `name_english` |  | 영문이름 해당 회원의 영문 이름 |
| ↳ `name_phonetic` |  | 발음표기 이름 (일본어) 해당 회원의 발음 표기 이름(일본어) |
| ↳ `phone` |  | 전화번호 해당 회원의 일반전화 |
| ↳ `cellphone` |  | 휴대전화 해당 회원의 휴대전화 |
| ↳ `email` |  | 이메일 해당 회원의 이메일 |
| ↳ `wedding_anniversary` | 날짜 | 결혼기념일 해당 회원의 결혼기념일 |
| ↳ `birthday` | 날짜 | 생일 해당 회원의 생일 |
| ↳ `solar_calendar` |  | 양력여부 생일이 양력인지 음력인지 여부 T : 양력 · F : 음력 |
| ↳ `total_points` |  | 총 적립금 |
| ↳ `available_points` |  | 가용 적립금 |
| ↳ `used_points` |  | 사용 적립금 |
| ↳ `city` | 최대글자수 : [255자] | 시/군/도시 |
| ↳ `state` | 최대글자수 : [255자] | 주/도 |
| ↳ `address1` | 최대글자수 : [255자] | 기본 주소 해당 회원의 기본주소(시/군/도) |
| ↳ `address2` | 최대글자수 : [255자] | 상세 주소 해당 회원의 상세주소 |
| ↳ `group_no` |  | 회원등급번호 해당 회원의 회원등급의 번호 |
| ↳ `job` |  | 직업 해당 회원의 직업 |
| ↳ `job_class` |  | 직종 해당 회원의 직종 |
| ↳ `zipcode` | 최대글자수 : [14자] | 우편번호 |
| ↳ `created_date` |  | 가입일 해당 회원의 가입일시 |
| ↳ `member_authentication` |  | 회원인증여부 회원 인증여부. 인증에 따라 회원은 4종류로 구분된다. 인증회원을 특별관리회원으로 설정할 경우 해당 회원은 가장 마지막에 설정한 특별관리회원으로 표시된다. T : 인증 · F : 미인증 · B : 특별관리회원 · J : 14세미만회원 |
| ↳ `use_blacklist` |  | 불량회원설정 불량회원 여부. 불량회원일 경우 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음. T : 설정함 · F : 설정안함 |
| ↳ `blacklist_type` |  | 불량회원 차단설정 해당 회원의 불량회원 타입. 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음. P : 상품구매차단 · L : 로그인차단 · A : 로그인&상품구매 차단 |
| ↳ `last_login_date` |  | 최근 접속일시 해당 회원의 최종 로그인 일시 |
| ↳ `member_authority` |  | 회원권한구분 회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨. C : 일반회원 · P : 대표 운영자 · A : 부운영자 · S : 공급사 |
| ↳ `nick_name` | 최대글자수 : [50자] | 운영자 별명 해당 회원의 별명 |
| ↳ `recommend_id` |  | 추천인아이디 해당 회원의 가입당시 입력한 추천인 아이디 |
| ↳ `residence` |  | 지역코드 해당 회원의 주거지역 |
| ↳ `interest` |  | 관심분야 해당 회원의 관심사 |
| ↳ `gender` |  | 해당 회원의 성별 |
| ↳ `member_type` |  | 회원타입 해당 회원의 회원 타입 p : 개인 · c : 사업자 · f : 외국인 |
| ↳ `company_type` |  | 사업자 구분 해당 회원의 회원타입이 사업자일경우 p : 개인사업자 · c : 법인사업자 |
| ↳ `foreigner_type` |  | 외국인 인증방법 해당 외국인 회원의 인증방법 f : 외국인등록번호 · p : 여권번호 · d : 국제운전면허증 |
| ↳ `authentication_method` |  | 인증 수단 null : 인증안함 · i : 아이핀인증 · m : 휴대폰 본인인증 · e : 이메일인증 · d : 휴대폰 인증(중복 확인) · a : 앱 인증(기타 인증) |
| ↳ `lifetime_member` |  | 평생회원 동의여부 T : 동의함 F : 동의안함 |
| ↳ `corporate_name` |  | 법인명 해당 회원의 법인명 |
| ↳ `nationality` |  | 국적 해당 회원이 "외국인 회원"일 경우, 해당 회원의 국적 |
| ↳ `shop_name` |  | 쇼핑몰명 해당 회원의 상호명 |
| ↳ `country_code` |  | 국가코드 해당 회원이 가입시 입력한 국가 |
| ↳ `use_mobile_app` |  | 모바일앱 사용여부 해당 회원의 모바일앱 사용여부 T : 사용 · F : 사용안함 |
| ↳ `join_path` |  | 가입경로 P : PC · M : 모바일 |
| ↳ `fixed_group` |  | 회원등급 고정 여부 특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부 · 회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다. T : 고정함 · F : 고정안함 |
| ↳ `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| ↳ `refund_bank_code` | 최대글자수 : [20자] | 환불 은행 코드 |
| ↳ `refund_bank_account_no` | 최대글자수 : [40자] | 환불 계좌번호 |
| ↳ `refund_bank_account_holder` |  | 환불계좌 예금주 명의 |
| ↳ `company_condition` | 최대글자수 : [50자] | 업태 |
| ↳ `company_line` | 최대글자수 : [50자] | 종목 |
| ↳ `sns_list` |  | 연동중인 SNS |
| ↳ `account_reactivation_date` |  | 휴면회원 해제일 |

응답 예시 (JSON):

```json
{
    "customersprivacy": [
        {
            "shop_no": 1,
            "member_id": "sampleid",
            "name": "John Doe",
            "name_english": "John Doe",
            "name_phonetic": "John Doe",
            "phone": "02-0000-0000",
            "cellphone": "010-000-0000",
            "email": "sample@sample.com",
            "wedding_anniversary": "2018-06-20",
            "birthday": "2018-06-20",
            "solar_calendar": "T",
            "total_points": "0.00",
            "available_points": "0.00",
            "used_points": "0.00",
            "city": "Seoul",
            "state": "Sindaebang dong Dongjak-gu",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "group_no": 1,
            "job": "self-employment",
            "job_class": "service",
            "zipcode": "07071",
            "created_date": "2018-01-18T11:19:27+09:00",
            "member_authentication": "T",
            "use_blacklist": "F",
            "blacklist_type": "",
            "last_login_date": "2018-01-18T11:19:27+09:00",
            "member_authority": "C",
            "nick_name": "nickname",
            "recommend_id": "testid2",
            "residence": "Seoul",
            "interest": "animation, movie/theater",
            "gender": "F",
            "member_type": "p",
            "company_type": "p",
            "foreigner_type": "f",
            "authentication_method": "m",
            "lifetime_member": "T",
            "corporate_name": "Sample company",
            "nationality": "Korea",
            "shop_name": "Sample Shop",
            "country_code": "KR",
            "use_mobile_app": "F",
            "join_path": "P",
            "fixed_group": "T",
            "thirdparty_agree": "T",
            "refund_bank_code": "bank_02",
            "refund_bank_account_no": "1234-1234-1234567",
            "refund_bank_account_holder": "John Doe",
            "company_condition": null,
            "company_line": null,
            "sns_list": [
                "FACEBOOK(2022-05-23 16:12:22)",
                "KAKAO(2022-05-23 16:12:47)"
            ],
            "account_reactivation_date": "2018-01-18T11:19:27+09:00"
        },
        {
            "shop_no": 1,
            "member_id": "sampleid01",
            "name": "Jane Doe",
            "name_english": "Jane Doe",
            "name_phonetic": "Jane Doe",
            "phone": "02-0000-0000",
            "cellphone": "010-000-0000",
            "email": "sample@sample.com",
            "wedding_anniversary": "2018-06-20",
            "birthday": "2018-06-20",
            "solar_calendar": "T",
            "total_points": "0.00",
            "available_points": "0.00",
            "used_points": "0.00",
            "city": "Seoul",
            "state": "Sindaebang dong Dongjak-gu",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "group_no": 1,
            "job": "self-employment",
            "job_class": "service",
            "zipcode": "07071",
            "created_date": "2018-01-18T11:19:27+09:00",
            "member_authentication": "T",
            "use_blacklist": "F",
            "blacklist_type": "",
            "last_login_date": "2018-01-18T11:19:27+09:00",
            "member_authority": "C",
            "nick_name": "nickname",
            "recommend_id": "testid2",
            "residence": "Seoul",
            "interest": "animation, movie/theater",
            "gender": "F",
            "member_type": "p",
            "company_type": "p",
            "foreigner_type": "f",
            "authentication_method": "i",
            "lifetime_member": "T",
            "corporate_name": "Sample company",
            "nationality": "Korea",
            "shop_name": "Sample Shop",
            "country_code": "KR",
            "use_mobile_app": "F",
            "join_path": "M",
            "fixed_group": "F",
            "thirdparty_agree": "T",
            "refund_bank_code": "bank_01",
            "refund_bank_account_no": "1234-1234-1234567",
            "refund_bank_account_holder": "John Doe",
            "company_condition": null,
            "company_line": null,
            "sns_list": [
                "FACEBOOK(2022-05-23 16:12:22)",
                "KAKAO(2022-05-23 16:12:47)"
            ],
            "account_reactivation_date": "2018-01-18T11:19:27+09:00"
        }
    ]
}
```

### `GET /api/v2/admin/customersprivacy/count` — Retrieve a count of customer information

- **Scope**: `mall.read_privacy` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `search_type` |  |  | customer_info | 검색 타입 Youtube shopping 이용 시에는 미제공 회원 검색을 회원정보 기반으로 할지 가입일 기준으로 할지 선택하여 검색할 수 있다. · 가입일 기준으로 검색할 경우 offset과 관계 없이 전체 회원을 검색할 수 있다. · ※ 가입일 기준 사용시 created_start_date 외의 모든 검색 조건은 사용할 수 없다. customer_info : 회원정보 기반 검색 · created_date : 가입일 기준 검색 |
| `created_start_date` |  | 날짜 |  | 가입일 기준 검색시 검색 시작일 Youtube shopping 이용 시에는 미제공 search_type이 created_date 일 경우 가입일 기준의 검색 시작일. 해당 가입일 이후에 가입한 회원을 검색할 수 있다. |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `news_mail` |  |  |  | 뉴스메일 수신여부 Youtube shopping 이용 시에는 미제공 이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| `sms` |  |  |  | 모바일 메시지 수신여부 이벤트 SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| `thirdparty_agree` |  |  |  | 제3자 제공 동의 여부 Youtube shopping 이용 시에는 미제공 T : 동의함 · F : 동의안함 |
| `group_no` |  |  |  | 회원등급번호 Youtube shopping 이용 시에는 미제공 해당 회원의 회원등급의 번호 |
| `search_field` |  |  |  | 검색필드 Youtube shopping 이용 시에는 미제공 조회하고자 하는 회원의 검색필드. id : 아이디 · name : 이름 · hp : 핸드폰 · tel : 전화번호 · mail : 이메일 · shop_name : 상호명 |
| `keyword` |  |  |  | 검색어 Youtube shopping 이용 시에는 미제공 ,(콤마)로 여러 건을 검색할 수 있다. |
| `date_type` |  |  |  | 검색날짜 유형 Youtube shopping 이용 시에는 미제공 join : 회원가입일 · login : 최근접속일 · age : 생년월일 · account_reactivation : 휴면해제일 · wedding : 결혼기념일 |
| `start_date` |  | 날짜 |  | 검색 시작일 Youtube shopping 이용 시에는 미제공 특정 조회기준에 대한 검색 시작일. · 검색 종료일과 같이 사용해야함. · 검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함. · ex) 2018-12-31 00:00:00 |
| `end_date` |  | 날짜 |  | 검색 종료일 Youtube shopping 이용 시에는 미제공 특정 조회기준에 대한 검색 종료일. · 검색 시작일과 같이 사용해야함. · 검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함. · ex) 2018-12-31 23:59:59 |
| `member_type` |  |  |  | 회원타입 Youtube shopping 이용 시에는 미제공 해당 회원의 회원 타입 vip : 특별관리회원 · poor : 블랙리스트 · pointfy : 통합멤버쉽 사용자 |
| `member_class` |  |  |  | 회원구분 p : 개인 · c : 사업자 · f : 외국인 |
| `residence` |  |  |  | 지역코드 Youtube shopping 이용 시에는 미제공 해당 회원의 주거지역 · (,(콤마)로 여러 건을 검색할 수 있다.)누락 ,(콤마)로 여러 건을 검색할 수 있다. |
| `gender` |  |  |  | 성별 Youtube shopping 이용 시에는 미제공 해당 회원의 성별 M : 남자 · F : 여자 |
| `member_authority` |  |  | C | 회원권한구분 Youtube shopping 이용 시에는 미제공 회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨. C : 일반회원 · P : 대표 운영자 · A : 부운영자 · S : 공급사 |
| `join_path` |  |  |  | 가입경로 Youtube shopping 이용 시에는 미제공 P : PC · M : 모바일 |
| `use_mobile_app` |  |  |  | 모바일앱 사용여부 Youtube shopping 이용 시에는 미제공 T : 사용 · F : 사용안함 |
| `fixed_group` |  |  |  | 회원등급 고정 여부 Youtube shopping 이용 시에는 미제공 T : 고정함 · F : 고정안함 |
| `is_simple_join` |  |  |  | 주문서 간단회원가입 조회 여부 Youtube shopping 이용 시에는 미제공 T : 조회 · F : 조회 안 함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `count` |  |  |

응답 예시 (JSON):

```json
{
    "count": 3
}
```

### `GET /api/v2/admin/customersprivacy/{member_id}` — Retrieve a customer information

- **Scope**: `mall.read_privacy` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customersprivacy` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `member_id` | 최대글자수 : [20자] | 회원아이디 |
| ↳ `name` |  | 이름 해당 회원의 이름 |
| ↳ `name_english` |  | 영문이름 해당 회원의 영문 이름 |
| ↳ `name_phonetic` |  | 발음표기 이름 (일본어) 해당 회원의 발음 표기 이름(일본어) |
| ↳ `phone` |  | 전화번호 해당 회원의 일반전화 |
| ↳ `cellphone` |  | 휴대전화 해당 회원의 휴대전화 |
| ↳ `email` |  | 이메일 해당 회원의 이메일 |
| ↳ `wedding_anniversary` | 날짜 | 결혼기념일 해당 회원의 결혼기념일 |
| ↳ `birthday` | 날짜 | 생일 해당 회원의 생일 |
| ↳ `solar_calendar` |  | 양력여부 생일이 양력인지 음력인지 여부 T : 양력 · F : 음력 |
| ↳ `total_points` |  | 총 적립금 |
| ↳ `available_points` |  | 가용 적립금 |
| ↳ `used_points` |  | 사용 적립금 |
| ↳ `available_credits` |  | 가용 예치금 |
| ↳ `city` | 최대글자수 : [255자] | 시/군/도시 |
| ↳ `state` | 최대글자수 : [255자] | 주/도 |
| ↳ `address1` | 최대글자수 : [255자] | 기본 주소 해당 회원의 기본주소(시/군/도) |
| ↳ `address2` | 최대글자수 : [255자] | 상세 주소 해당 회원의 상세주소 |
| ↳ `group_no` |  | 회원등급번호 해당 회원의 회원등급의 번호 |
| ↳ `job` |  | 직업 해당 회원의 직업 |
| ↳ `job_class` |  | 직종 해당 회원의 직종 |
| ↳ `zipcode` | 최대글자수 : [14자] | 우편번호 |
| ↳ `created_date` |  | 가입일 해당 회원의 가입일시 |
| ↳ `member_authentication` |  | 회원인증여부 회원 인증여부. 인증에 따라 회원은 4종류로 구분된다. 인증회원을 특별관리회원으로 설정할 경우 해당 회원은 가장 마지막에 설정한 특별관리회원으로 표시된다. T : 인증 · F : 미인증 · B : 특별관리회원 · J : 14세미만회원 |
| ↳ `use_blacklist` |  | 불량회원설정 불량회원 여부. 불량회원일 경우 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음. T : 설정함 · F : 설정안함 |
| ↳ `blacklist_type` |  | 불량회원 차단설정 해당 회원의 불량회원 타입. 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음. P : 상품구매차단 · L : 로그인차단 · A : 로그인&상품구매 차단 |
| ↳ `last_login_date` |  | 최근 접속일시 해당 회원의 최종 로그인 일시 |
| ↳ `member_authority` |  | 회원권한구분 회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨. C : 일반회원 · P : 대표 운영자 · A : 부운영자 · S : 공급사 |
| ↳ `nick_name` | 최대글자수 : [50자] | 운영자 별명 해당 회원의 별명 |
| ↳ `recommend_id` |  | 추천인아이디 해당 회원의 가입당시 입력한 추천인 아이디 |
| ↳ `residence` |  | 지역코드 해당 회원의 주거지역 |
| ↳ `interest` |  | 관심분야 해당 회원의 관심사 |
| ↳ `gender` |  | 해당 회원의 성별 |
| ↳ `member_type` |  | 회원타입 해당 회원의 회원 타입 p : 개인 · c : 사업자 · f : 외국인 |
| ↳ `company_type` |  | 사업자 구분 해당 회원의 회원타입이 사업자일경우 p : 개인사업자 · c : 법인사업자 |
| ↳ `foreigner_type` |  | 외국인 인증방법 해당 외국인 회원의 인증방법 f : 외국인등록번호 · p : 여권번호 · d : 국제운전면허증 |
| ↳ `authentication_method` |  | 인증 수단 null : 인증안함 · i : 아이핀인증 · m : 휴대폰 본인인증 · e : 이메일인증 · d : 휴대폰 인증(중복 확인) · a : 앱 인증(기타 인증) |
| ↳ `lifetime_member` |  | 평생회원 동의여부 T : 동의함 F : 동의안함 |
| ↳ `corporate_name` |  | 법인명 해당 회원의 법인명 |
| ↳ `nationality` |  | 국적 해당 회원이 "외국인 회원"일 경우, 해당 회원의 국적 |
| ↳ `shop_name` |  | 쇼핑몰명 해당 회원의 상호명 |
| ↳ `country_code` |  | 국가코드 해당 회원이 가입시 입력한 국가 |
| ↳ `use_mobile_app` |  | 모바일앱 사용여부 해당 회원의 모바일앱 사용여부 T : 사용 · F : 사용안함 |
| ↳ `additional_information` |  | 추가항목 해당 회원의 추가항목 |
| ↳ `join_path` |  | 가입경로 P : PC · M : 모바일 |
| ↳ `fixed_group` |  | 회원등급 고정 여부 특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부 · 회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다. T : 고정함 · F : 고정안함 |
| ↳ `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| ↳ `refund_bank_code` | 최대글자수 : [20자] | 환불 은행 코드 |
| ↳ `refund_bank_account_no` | 최대글자수 : [40자] | 환불 계좌번호 |
| ↳ `refund_bank_account_holder` |  | 환불계좌 예금주 명의 |
| ↳ `company_condition` | 최대글자수 : [50자] | 업태 |
| ↳ `company_line` | 최대글자수 : [50자] | 종목 |
| ↳ `sns_list` |  | 연동중인 SNS |

응답 예시 (JSON):

```json
{
    "customersprivacy": {
        "shop_no": 1,
        "member_id": "sampleid",
        "name": "John Doe",
        "name_english": "John Doe",
        "name_phonetic": "John Doe",
        "phone": "02-0000-0000",
        "cellphone": "010-000-0000",
        "email": "sample@sample.com",
        "wedding_anniversary": "2018-06-20",
        "birthday": "2018-06-20",
        "solar_calendar": "T",
        "total_points": "0.00",
        "available_points": "0.00",
        "used_points": "0.00",
        "available_credits": "0.00",
        "city": "Seoul",
        "state": "Sindaebang dong Dongjak-gu",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "group_no": 1,
        "job": "self-employment",
        "job_class": "service",
        "zipcode": "07071",
        "created_date": "2018-01-18T11:19:27+09:00",
        "member_authentication": "T",
        "use_blacklist": "F",
        "blacklist_type": "",
        "last_login_date": "2018-01-18T11:19:27+09:00",
        "member_authority": "C",
        "nick_name": "nickname",
        "recommend_id": "testid2",
        "residence": "Seoul",
        "interest": "animation, movie/theater",
        "gender": "F",
        "member_type": "p",
        "company_type": "p",
        "foreigner_type": "f",
        "authentication_method": "i",
        "lifetime_member": "T",
        "corporate_name": "Sample company",
        "nationality": "Korea",
        "shop_name": "Sample Shop",
        "country_code": "KR",
        "use_mobile_app": "F",
        "additional_information": [],
        "join_path": "M",
        "fixed_group": "F",
        "thirdparty_agree": "T",
        "refund_bank_code": "bank_01",
        "refund_bank_account_no": "1234-1234-1234567",
        "refund_bank_account_holder": "John Doe",
        "company_condition": null,
        "company_line": null,
        "sns_list": [
            "FACEBOOK(2022-05-23 16:12:22)",
            "KAKAO(2022-05-23 16:12:47)"
        ]
    }
}
```

### `PUT /api/v2/admin/customersprivacy/{member_id}` — Update a customer information

- **Scope**: `mall.write_privacy` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |
| `cellphone` |  |  |  | 휴대전화 |
| `email` |  | 이메일 |  | 이메일 |
| `sms` |  |  |  | 모바일 메시지 수신여부 T : 수신 · F : 수신안함 |
| `news_mail` |  |  |  | 뉴스메일 수신여부 Youtube shopping 이용 시에는 미제공 T : 수신 · F : 수신안함 |
| `thirdparty_agree` |  |  |  | 제3자 제공 동의 여부 Youtube shopping 이용 시에는 미제공 T : 동의함 · F : 동의안함 |
| `birthday` |  | 날짜 |  | 생일 Youtube shopping 이용 시에는 미제공 |
| `solar_calendar` |  |  |  | 양력여부 Youtube shopping 이용 시에는 미제공 T : 양력 · F : 음력 |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 Youtube shopping 이용 시에는 미제공 |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 Youtube shopping 이용 시에는 미제공 |
| `zipcode` |  | 최대글자수 : [14자] |  | 우편번호 Youtube shopping 이용 시에는 미제공 |
| `recommend_id` |  | 최대글자수 : [20자] |  | 추천인아이디 Youtube shopping 이용 시에는 미제공 |
| `gender` |  |  |  | 성별 Youtube shopping 이용 시에는 미제공 M : 남자 · F : 여자 |
| `country_code` |  |  |  | 국가코드 Youtube shopping 이용 시에는 미제공 |
| `additional_information` |  |  |  | 추가항목 Youtube shopping 이용 시에는 미제공 |
| ↳ `key` |  |  |  | 추가항목 키 |
| ↳ `value` |  |  |  | 추가항목 값 |
| `city` |  | 최대글자수 : [255자] |  | 시/군/도시 Youtube shopping 이용 시에는 미제공 |
| `state` |  | 최대글자수 : [255자] |  | 주/도 Youtube shopping 이용 시에는 미제공 |
| `refund_bank_code` |  | 최대글자수 : [20자] |  | 환불 은행 코드 Youtube shopping 이용 시에는 미제공 |
| `refund_bank_account_no` |  | 최대글자수 : [40자] |  | 환불 계좌번호 Youtube shopping 이용 시에는 미제공 |
| `refund_bank_account_holder` |  |  |  | 환불계좌 예금주 명의 Youtube shopping 이용 시에는 미제공 |
| `fixed_group` |  |  |  | 회원등급 고정 여부 Youtube shopping 이용 시에는 미제공 T : 고정함 · F : 고정안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customersprivacy` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `member_id` | 최대글자수 : [20자] | 회원아이디 |
| ↳ `cellphone` |  | 휴대전화 해당 회원의 휴대전화 |
| ↳ `email` |  | 이메일 해당 회원의 이메일 |
| ↳ `birthday` | 날짜 | 생일 해당 회원의 생일 |
| ↳ `solar_calendar` |  | 양력여부 생일이 양력인지 음력인지 여부 T : 양력 · F : 음력 |
| ↳ `country_code` |  | 국가코드 해당 회원이 가입시 입력한 국가 |
| ↳ `state` | 최대글자수 : [255자] | 주/도 |
| ↳ `city` | 최대글자수 : [255자] | 시/군/도시 |
| ↳ `address1` | 최대글자수 : [255자] | 기본 주소 해당 회원의 기본주소(시/군/도) |
| ↳ `address2` | 최대글자수 : [255자] | 상세 주소 해당 회원의 상세주소 |
| ↳ `zipcode` | 최대글자수 : [14자] | 우편번호 |
| ↳ `sms` |  | 모바일 메시지 수신여부 SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| ↳ `news_mail` |  | 뉴스메일 수신여부 이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함. T : 수신 · F : 수신안함 |
| ↳ `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| ↳ `fixed_group` |  | 회원등급 고정 여부 특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부 · 회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다. T : 고정함 · F : 고정안함 |
| ↳ `additional_information` |  | 추가항목 해당 회원의 추가항목 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `value` |  |  |
| ↳ `refund_bank_code` | 최대글자수 : [20자] | 환불 은행 코드 |
| ↳ `refund_bank_account_no` | 최대글자수 : [40자] | 환불 계좌번호 |
| ↳ `refund_bank_account_holder` |  | 환불계좌 예금주 명의 |
| ↳ `gender` |  | 해당 회원의 성별 |

응답 예시 (JSON):

```json
{
    "customersprivacy": {
        "shop_no": 1,
        "member_id": "sampleid",
        "cellphone": "010-000-0000",
        "email": "sample@sample.com",
        "birthday": "2018-06-20",
        "solar_calendar": "T",
        "country_code": "KOR",
        "state": "Sindaebang dong Dongjak-gu",
        "city": "Seoul",
        "address1": "Sindaebang dong Dongjak-gu Seoul Republic of Korea",
        "address2": "Professional Construction Hall",
        "zipcode": "07071",
        "sms": "T",
        "news_mail": "T",
        "thirdparty_agree": "T",
        "fixed_group": "F",
        "additional_information": [
            {
                "key": "add1",
                "value": "add value 1"
            },
            {
                "key": "add2",
                "value": "add value 2"
            }
        ],
        "refund_bank_code": "bank_01",
        "refund_bank_account_no": "1234-1234-1234567",
        "refund_bank_account_holder": "John Doe",
        "gender": "F"
    }
}
```
