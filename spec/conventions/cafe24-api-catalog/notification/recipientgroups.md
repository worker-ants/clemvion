---
resource: notification
entity: recipientgroups
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#recipientgroups
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Notification / Recipientgroups

> Field-level 카탈로그. Endpoint enumeration index: [`../notification.md`](../notification.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Recipientgroups](https://developers.cafe24.com/docs/ko/api/admin/#recipientgroups)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

발송 그룹(Recipientgroups)은 대량 메일 발송 그룹을 관리하는 기능입니다. · 발송 그룹의 조회, 추가, 수정, 삭제가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `group_no` |  | 발송그룹 번호 |
| `group_name` | 최대글자수 : [40자] | 발송그룹명 |
| `group_description` | 최대글자수 : [255자] | 발송그룹 설명 |
| `created_date` |  | 등록일 |
| `group_member_count` |  | 발송그룹 회원 수 |
| `news_mail` |  | 뉴스메일 수신여부 T : 수신허용 · F : 수신안함 · D : 절대수신안함 |
| `sms` |  | 모바일 메시지 수신여부 T : 수신 · F : 수신안함 |
| `member_group_no` |  | 회원등급번호 |
| `member_class` |  | 회원구분 p : 개인 · c : 사업자 · f : 외국인 |
| `member_type` |  | 회원타입 vip : 특별관리회원 · poor : 불량회원 |
| `join_path` |  | 가입경로 P : PC · M : 모바일 |
| `inflow_path` |  | 유입경로 |
| `inflow_path_detail` |  | 유입경로 상세정보 |
| `date_type` |  | 검색날짜 유형 join : 회원가입일 · birthday : 생일 · wedding : 결혼기념일 · partner : 배우자생일 |
| `start_date` | 날짜 | 검색 시작일 |
| `end_date` | 날짜 | 검색 종료일 |
| `solar_calendar` |  | 양력여부 T : 양력 · F : 음력 |
| `age_min` |  | 나이 검색 최소값 |
| `age_max` |  | 나이 검색 최대값 |
| `gender` |  | 성별 M : 남자 · F : 여자 |
| `available_points_min` |  | 적립금 검색 최소값 |
| `available_points_max` |  | 적립금 검색 최대값 |
| `use_mobile_app` |  | 모바일앱 사용여부 T : 사용 · F : 사용안함 |
| `plusapp_member_join` |  | 브랜드앱 경로 가입회원 여부 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/recipientgroups` — Retrieve distribution group list

- **Scope**: `mall.read_notification` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-list

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |

### `GET /api/v2/admin/recipientgroups/{group_no}` — Retrieve distribution group details

- **Scope**: `mall.read_notification` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `group_no` | ✓ | 최소값: [1] |  | 발송그룹 번호 |

### `POST /api/v2/admin/recipientgroups` — Create a distribution group

- **Scope**: `mall.write_notification` (write)
- **호출건수 제한**: 30
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `group_name` | ✓ | 최대글자수 : [40자] |  | 발송그룹명 |
| `group_description` |  | 최대글자수 : [255자] |  | 발송그룹 설명 |
| `news_mail` |  |  |  | 뉴스메일 수신여부 T : 수신허용 · F : 수신안함 · D : 절대수신안함 |
| `sms` |  |  |  | 모바일 메시지 수신여부 T : 수신 · F : 수신안함 |
| `member_group_no` |  | 최소값: [1] |  | 회원등급번호 |
| `member_class` |  |  |  | 회원구분 EC 일본, 베트남 버전에서는 사용할 수 없음. p : 개인 · c : 사업자 · f : 외국인 |
| `member_type` |  |  |  | 회원타입 vip : 특별관리회원 · poor : 불량회원 |
| `join_path` |  |  |  | 가입경로 P : PC · M : 모바일 |
| `inflow_path` |  |  |  | 유입경로 |
| `inflow_path_detail` |  |  |  | 유입경로 상세정보 |
| `date_type` |  |  |  | 검색날짜 유형 join : 회원가입일 · birthday : 생일 · wedding : 결혼기념일 · partner : 배우자생일 |
| `start_date` |  |  |  | 검색 시작일 |
| `end_date` |  |  |  | 검색 종료일 |
| `solar_calendar` |  |  |  | 양력여부 T : 양력 · F : 음력 |
| `age_min` |  | 최소: [1]~최대: [99] |  | 나이 검색 최소값 |
| `age_max` |  | 최소: [1]~최대: [99] |  | 나이 검색 최대값 |
| `gender` |  |  |  | 성별 M : 남자 · F : 여자 |
| `available_points_min` |  | 최소: [0]~최대: [999999999] |  | 적립금 검색 최소값 |
| `available_points_max` |  | 최소: [0]~최대: [999999999] |  | 적립금 검색 최대값 |
| `use_mobile_app` |  |  |  | 모바일앱 사용여부 T : 사용 · F : 사용안함 |
| `plusapp_member_join` |  |  |  | 브랜드앱 경로 가입회원 여부 T : 사용함 · F : 사용안함 |

### `PUT /api/v2/admin/recipientgroups/{group_no}` — Edit distribution group

- **Scope**: `mall.write_notification` (write)
- **호출건수 제한**: 30
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `group_no` | ✓ | 최소값: [1] |  | 발송그룹 번호 |
| `group_name` | ✓ | 최대글자수 : [40자] |  | 발송그룹명 |
| `group_description` |  | 최대글자수 : [255자] |  | 발송그룹 설명 |
| `news_mail` |  |  |  | 뉴스메일 수신여부 T : 수신허용 · F : 수신안함 · D : 절대수신안함 |
| `sms` |  |  |  | 모바일 메시지 수신여부 T : 수신 · F : 수신안함 |
| `member_group_no` |  | 최소값: [1] |  | 회원등급번호 |
| `member_class` |  |  |  | 회원구분 EC 일본, 베트남 버전에서는 사용할 수 없음. p : 개인 · c : 사업자 · f : 외국인 |
| `member_type` |  |  |  | 회원타입 vip : 특별관리회원 · poor : 불량회원 |
| `join_path` |  |  |  | 가입경로 P : PC · M : 모바일 |
| `inflow_path` |  |  |  | 유입경로 |
| `inflow_path_detail` |  |  |  | 유입경로 상세정보 |
| `date_type` |  |  |  | 검색날짜 유형 join : 회원가입일 · birthday : 생일 · wedding : 결혼기념일 · partner : 배우자생일 |
| `start_date` |  |  |  | 검색 시작일 |
| `end_date` |  |  |  | 검색 종료일 |
| `solar_calendar` |  |  |  | 양력여부 T : 양력 · F : 음력 |
| `age_min` |  | 최소: [1]~최대: [99] |  | 나이 검색 최소값 |
| `age_max` |  | 최소: [1]~최대: [99] |  | 나이 검색 최대값 |
| `gender` |  |  |  | 성별 M : 남자 · F : 여자 |
| `available_points_min` |  | 최소: [0]~최대: [999999999] |  | 적립금 검색 최소값 |
| `available_points_max` |  | 최소: [0]~최대: [999999999] |  | 적립금 검색 최대값 |
| `use_mobile_app` |  |  |  | 모바일앱 사용여부 T : 사용 · F : 사용안함 |
| `plusapp_member_join` |  |  |  | 브랜드앱 경로 가입회원 여부 T : 사용함 · F : 사용안함 |

### `DELETE /api/v2/admin/recipientgroups/{group_no}` — Delete distribution group

- **Scope**: `mall.write_notification` (write)
- **호출건수 제한**: 30
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `group_no` | ✓ | 최소값: [1] |  | 발송그룹 번호 |
