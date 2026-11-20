---
id: "CLE-OBS-NOTIFY-SETTINGS"
title: "알림 — 알림 설정과 이메일"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-OBS-NOTIFY"
ancestors: ["CLE-VISION", "CLE-OBS", "CLE-OBS-NOTIFY"]
area: "CLE-OBS"
content_hash: "642c848b0aa8c17a913c2da107f83ef7243a9871f1c4b5cc8c99cce5ed157e99"
read_as: "approved_fallback"
task: "CLE-T-BW72A8"
source_paths: []
mirror_sha256: "a963985828f23e62c12230c4782f18d0a9c2f1cec4ef036e3a67f42387a21ddb"
etag: "sha256-2dd2679b5e34d33865daf71d2af40a3fd6237172625d4cf0695c70021ff6d8b4"
---
## 개요

이 문서는 [알림](CLE-OBS-NOTIFY.md) 의 하위 문서로 알림 설정(notification preferences, `notification_preferences`)을 정한다. 유형별 인앱 토글과 이메일 토글, 토글로 알림 채널을 계산하는 규칙, 이메일 알림(즉시 발송 · 일일 요약 · 수신 거부 링크), 알림 설정 화면이 범위다. 알림 저장과 이메일 발송 · 실패 처리는 [알림 「저장과 전달」](CLE-OBS-NOTIFY.md#저장과-전달) 이 정한다.

## 설정 키

사용자는 알림 유형별로 인앱(벨)과 이메일을 따로 켜고 끈다. 키는 `<유형><채널>` 꼴의 평평한 이름으로 `User.notification_preferences` 에 둔다.

| 알림 유형 | 인앱 키 (기본) | 이메일 키 (기본) | 구현 |
| --- | --- | --- | --- |
| 워크플로우 실행 실패 `execution_failed` | `executionFailedInApp` (켜짐, opt-out) | `executionFailedEmail` (켜짐, opt-out) | 이메일 키는 구현됨. 인앱 키는 미구현(CLE-T-EJFQ1Y) |
| 스케줄 실행 실패 `schedule_failed` | `scheduleFailedInApp` (켜짐, opt-out) | `scheduleFailedEmail` (켜짐, opt-out) | 이메일 키는 구현됨. 인앱 키는 미구현(CLE-T-EJFQ1Y) |
| 통합 만료 `integration_expired` | `integrationExpiryInApp` (켜짐, opt-out) | `integrationExpiryEmail` (꺼짐, opt-in) | 이메일 키는 구현됨. 인앱 키는 미구현(CLE-T-EJFQ1Y) |
| 통합 조치 필요 `integration_action_required` | 없음. 늘 인앱으로 보낸다 | `integrationExpiryEmail` 을 함께 쓴다 | 구현됨 |
| 실패 일일 요약 | 해당 없음 | `dailyDigestEmail` (꺼짐, opt-in) | 미구현(CLE-T-BAXAN4) |
| 팀 초대 `team_invite` | 없음. 늘 보낸다 | 없음. 초대 링크 이메일이 맡는다 | 구현됨 |
| 마켓플레이스 업데이트 `marketplace_update` | 없음 | 없음. 도입하면 opt-in | 아직 보내지 않는다 |

- 조회(`GET /api/notifications/settings`)는 저장값이 없는 키에 위 기본값을 채워 돌려준다. 수정(`PATCH`)은 보낸 키만 합친다.
- 지금 API 가 다루는 키는 이메일 키 셋(`integrationExpiryEmail` · `executionFailedEmail` · `scheduleFailedEmail`)이다. 인앱 키 셋은 CLE-T-EJFQ1Y 가, `dailyDigestEmail` 은 CLE-T-BAXAN4 가 더한다.
- Background 본문 실패(`background_failed`)와 알림 규칙 알림(`alert_*`)에는 키가 없다. 끌 수 없는 이유는 [인앱 끄기](#인앱-끄기) 에 있다.

## 이메일 수신 토글

- 새로 더하는 이메일 키는 opt-in(기본 꺼짐)이다. 이미 있는 `executionFailedEmail` · `scheduleFailedEmail` 의 opt-out 은 그대로 둔다([Rationale](#새-이메일-키는-opt-in-으로-둔다)).
- 실행 실패와 스케줄 실패는 발사원이 수신자의 키를 읽어 채널을 계산한다([채널 계산](#채널-계산)). 지금 구현은 이메일 키가 `false` 면 `in_app`, 그 밖에는 `both` 다.
- 통합 알림 두 유형은 `integrationExpiryEmail === true` 일 때만 이메일을 붙인다. 키가 없으면 이메일을 보내지 않는다. 통합 알림의 채널 규칙은 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md) 과 같다.
- **팀 초대의 이메일은 초대 링크 이메일이다.** 기존 가입자(비멤버)를 초대하면 수락 토큰을 담은 초대 링크 이메일(`MailService.sendWorkspaceInvitationEmail`)을 보낸다. `team_invite` 알림 행은 `in_app`(벨)으로만 저장한다. 사용자는 인앱 알림과 이메일을 모두 받고, 이메일을 보내는 주체가 초대 흐름일 뿐이다([Rationale](#팀-초대-알림은-인앱-채널로만-보낸다)).
- `/profile/alerts` 는 알림 설정 화면이 아니라 [알림 규칙](CLE-OBS-NOTIFY-RULES.md) 화면이다.

## 인앱 끄기

인앱 키를 끄면 그 유형의 알림이 벨에 보이지 않는다. 미구현이다(CLE-T-EJFQ1Y).

- 인앱 끔 · 이메일 켬: 알림 행을 채널 `email` 로 저장한다. 이메일은 지금처럼 보내고 성공하면 `email_sent_at` 을 채운다.
- 인앱 끔 · 이메일 끔: 알림 행을 만들지 않는다.
- 채널이 `email` 인 행은 벨의 알림 목록, 읽지 않은 알림 수, `notification.new` 실시간 전송에서 뺀다.
- DB 채널 값(`in_app` · `email` · `both`)은 그대로라 마이그레이션이 없다. 지금 코드에는 채널 `email` 로 저장하는 발사원이 없다. 알림 규칙은 규칙 채널 `email` 을 `both` 로 바꿔 저장한다. 그래서 `email` 행을 벨에서 빼도 기존 알림은 사라지지 않는다.
- 행이 남으므로 [중복 방지](CLE-OBS-NOTIFY.md#중복-방지)(`hasRecentByResource`)는 인앱을 꺼도 그대로 동작한다. 둘 다 끄면 보낼 것이 없어 중복 방지가 필요 없다.

끌 수 없는 유형과 이유는 다음과 같다.

| 유형 | 인앱을 끌 수 없는 이유 |
| --- | --- |
| `team_invite` | 늘 보낸다 |
| `marketplace_update` | 아직 보내지 않는다 |
| `background_failed` | 노드 설정 `notifyOnFailure` 가 이미 켜고 끈다([Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md)) |
| `alert_failure_rate` · `alert_duration` · `alert_llm_cost` | 알림 규칙의 활성 토글이 켜고 끈다([알림 규칙](CLE-OBS-NOTIFY-RULES.md)) |
| `integration_action_required` | 바로 손봐야 하는 능동 경보라 늘 인앱으로 보낸다. 이메일도 기본 꺼짐이라 인앱까지 끄면 통합 장애를 알 길이 없다 |

## 채널 계산

알림 채널은 발사원이 수신자마다 계산해 저장 경로(`notify` · `createMany`)에 넘긴다. 저장 경로는 알림 설정을 읽지 않는다([알림 「저장과 전달」](CLE-OBS-NOTIFY.md#저장과-전달)). 인앱 키가 있는 세 유형은 두 키로 네 결과 가운데 하나를 고른다.

| 인앱 키 | 이메일 키 | 결과 |
| --- | --- | --- |
| 켬 | 켬 | `both` |
| 켬 | 끔 | `in_app` |
| 끔 | 켬 | `email` |
| 끔 | 끔 | 보내지 않음. 발사원이 그 수신자를 건너뛴다 |

- 키가 없으면 [설정 키](#설정-키) 의 기본값으로 본다. opt-out 키는 값이 `false` 일 때만 끔이고 opt-in 키는 값이 `true` 일 때만 켬이다.
- 지금 헬퍼 `NotificationsService.resolveOptOutEmailChannels` 는 이메일 키만 보고 `both` · `in_app` 두 결과를 돌려준다. 실행 실패 발사원(`ExecutionEngineService`)과 스케줄 실패 발사원(`ScheduleRunnerService`)이 이 헬퍼를 쓴다.
- 이 헬퍼를 인앱 키까지 읽어 `both` · `in_app` · `email` · 보내지 않음 네 결과를 돌려주도록 넓힌다(CLE-T-EJFQ1Y). 헬퍼는 설정을 조회만 하고 저장 경로에 끼어들지 않는다.
- 통합 만료 발사원(`IntegrationExpiryScanner`)은 지금 안에서 `both` · `in_app` 을 직접 계산한다. 인앱 키가 생기면 같은 네 결과로 계산한다.

## 일일 요약

`dailyDigestEmail` 을 켠 사용자에게 하루치 실패를 모은 이메일을 보낸다. 미구현이다(CLE-T-BAXAN4).

| 항목 | 규칙 |
| --- | --- |
| 모으는 유형 | `execution_failed` · `schedule_failed` · `background_failed`. `background_failed` 는 워크스페이스 관리자만 받으므로 관리자의 요약에만 들어간다. 통합 알림과 알림 규칙 알림은 넣지 않는다 |
| 묶는 단위 | 수신자마다 한 통이다. 본문은 워크스페이스별로 묶는다 |
| 보내는 시각 | 매일 09:00 Asia/Seoul. 보낼 때 직전 24시간을 모은다 |
| 시간대 | 제품 기본 시간대 상수와 같은 값이다(CLE-T-TNZ3J9 에서 정했고 CLE-T-TV4VA8 이 상수로 모은다). 사용자에게는 시간대가 없고 언어(`locale`)만 있다. 한 사용자가 여러 워크스페이스에 속하므로 워크스페이스 시간대도 쓸 수 없다 |
| 즉시 메일과의 관계 | 독립이다. 즉시 메일 키(`executionFailedEmail` · `scheduleFailedEmail`)를 꺼도 요약에는 모은다. 요약만 받으려면 즉시 메일 키를 끈다 |
| 토글 | `dailyDigestEmail`, opt-in(기본 꺼짐) |

## 알림 설정 화면과 수신 거부 링크

- 알림 설정 화면은 [설정 키](#설정-키) 의 인앱 토글, 이메일 토글, 일일 요약 토글을 한 화면에 보인다. 키가 없는 유형에는 토글이 없다. 미구현이다(CLE-T-EJFQ1Y).
- 알림 설정 화면으로 들어가는 길은 [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) 이 정한다.
- 알림 이메일과 일일 요약 이메일의 하단에 수신 거부 링크를 둔다. 링크는 알림 설정 화면으로 간다.
- 서명 토큰으로 로그인 없이 끄는 공개 엔드포인트는 두지 않는다([Rationale](#일일-요약은-매일-0900-asiaseoul-에-따로-모아-보낸다)).
- 알림 이메일의 링크는 CLE-T-EJFQ1Y 가, 일일 요약 이메일의 링크는 CLE-T-BAXAN4 가 만든다.

## 알림 설정 저장

알림 설정은 `User.notification_preferences` JSONB(V010, 기본 `{}`)에 둔다. 컬럼 정의는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 에 있고 키와 기본값은 위 [설정 키](#설정-키) 가 정한다. 이 컬럼은 알림 채널을 계산하는 발사원과 일일 요약 작업이 읽는다([알림 「저장과 전달」](CLE-OBS-NOTIFY.md#저장과-전달)).

## 이메일 알림

| 항목 | 설명 |
| --- | --- |
| 즉시 발송 | 채널이 `email` · `both` 인 알림 행마다 한 통. 실행 실패, 스케줄 실패, 통합 만료 · 조치 필요, 알림 규칙 위반이 해당한다. 팀 초대는 초대 링크 이메일이 따로 보낸다 |
| 일일 요약 | [일일 요약](#일일-요약). 미구현 |
| 수신 거부 | 이메일 하단의 알림 설정 화면 링크([알림 설정 화면과 수신 거부 링크](#알림-설정-화면과-수신-거부-링크)). 미구현 |

## Rationale

### 알림 설정을 JSONB 로 둔다

알림 유형이 늘 때마다 `user` 테이블에 컬럼을 더하지 않으려고 JSONB 로 둔다(V010). 키가 없을 때의 해석은 키마다 다르며 [설정 키](#설정-키) 가 정한다. 통합 알림의 두 발사원(`IntegrationExpiryScanner`, `IntegrationActionRequiredNotifierService`)은 `prefs.integrationExpiryEmail === true` 로 엄격하게 비교한다. 키가 없으면 false 라 이메일을 붙이지 않는다(`channel='in_app'`).

### 팀 초대 알림은 인앱 채널로만 보낸다

기존 가입자(비멤버)를 팀에 초대하면 `WorkspaceInvitationsService.invite()` 가 이메일을 보낼 수 있는 발송 두 가지를 차례로 한다.

1. `dispatchEmail` → `MailService.sendWorkspaceInvitationEmail`: **수락 토큰을 담은 초대 링크 이메일**. 제목은 `Clemvion - "<ws>" 워크스페이스 초대`, 버튼은 "초대 수락하기" 로 초대 가입 경로(`invitationToken` 쿼리 포함)를 가리킨다. 링크는 `/register?invitationToken=…` 이다. 이미 로그인한 기존 가입자는 수락 페이지로, 로그인하지 않은 기존 가입자는 로그인 뒤 수락 페이지로 간다([워크스페이스와 멤버 「초대 가입 화면」](../CLE-ACCT/CLE-ACCT-WS.md#초대-가입-화면), [미가입자 가입 경로](../CLE-ACCT/CLE-ACCT-WS.md#미가입자-가입-경로)).
2. `dispatchTeamInviteNotification` → `team_invite` 알림 행: 벨(`in_app`)과, 채널이 `email`·`both` 면 `MailService.sendNotificationEmail`. 뒤쪽은 **토큰 없는 범용 알림 템플릿**이다. 제목은 알림 제목(`워크스페이스 초대`), 버튼은 "알림 보기" 로 `/dashboard` 를 가리킨다.

알림 설정 표의 "팀 초대 = 인앱 + 이메일" 을 글자 그대로 읽어 알림 행을 `both` 로 보내면 기존 가입자는 **제목이 비슷한 이메일 2통**을 받는다. 두 번째(알림 이메일)는 수락 토큰이 없어 `/dashboard` 로만 안내하는 **기능이 더 약한** 쪽이라, 사용자가 그 이메일을 먼저 열면 수락 경로를 찾지 못해 헷갈린다.

**결정: 알림 행을 `in_app` 으로 낮춘다.** 채널별 책임을 나눈다.

- **이메일 채널**은 초대 링크 이메일(위 1)이 혼자 맡는다. 수락 토큰을 담은 유일한 이메일이고 기능적으로 맞는 발송이다. 알림 설정 표가 팀 초대에 요구하는 "이메일" 은 이 이메일로 채워진다.
- **인앱(벨) 채널**은 `team_invite` 알림 행이 맡는다. 로그인한 기존 가입자가 앱 안에서 초대를 알아보도록 인앱 알림을 남긴다.

검토한 대안:

- **(a) 그대로 두기(`both`, 2통)**: 표를 글자 그대로 지키고 코드 변경이 없다. 하지만 중복과 혼란이 남고 약한 이메일이 겹쳐 채택하지 않았다.
- **(b) 기존 가입자에게 초대 링크 이메일을 보내지 않기**: 이메일은 1통이 된다. 하지만 빠지는 것이 **수락 토큰을 담은 유일한 이메일**이다. 남는 알림 이메일에는 토큰이 없다. 인앱 알림 행도 `resource_id` 로 초대 ID 만 갖고 토큰이 없으며 딥링크도 `workspace_invitation` 을 매핑하지 않는다. 이메일로 수락할 길이 사라지는 기능 후퇴라 기각했다.
- **(c) `in_app` 으로 낮추기**: 채택. 중복 이메일을 없애면서 초대 링크 이메일과 인앱 알림을 모두 지키고 (b) 와 달리 수락 경로를 깨지 않는다. 코드 변경은 `channel: 'both'` 를 `'in_app'` 으로 바꾼 것뿐이다.

표의 "팀 초대 | 인앱 + 이메일" 은 **제품 수준에서 맞다**(사용자는 여전히 인앱 알림과 이메일을 모두 받는다). 팀 초대는 끌 수 없는 유형으로 정했다([인앱 끄기](#인앱-끄기)). 나중에 팀 초대 이메일을 끄는 기능이 필요해지면 초대 링크 이메일을 그 설정과 묶을지는 그때 따로 정한다.

### 인앱 끄기는 알림 행을 남기고 벨에서 숨긴다

결정일: 2026-11-20

인앱을 끄고 이메일은 켠 경우를 저장하는 방법 세 가지를 견줬다(NERV Task CLE-T-BW72A8).

- (a) 행을 채널 `email` 로 저장하고 벨 목록 · 읽지 않은 수 · `notification.new` 에서 뺀다: 채택. 채널 값이 이미 `email` 을 받아 마이그레이션이 없다. 이메일 발송 결과가 `email_sent_at` 에 남고 `hasRecentByResource` 중복 방지가 그 행을 센다.
- (b) 행을 만들지 않고 이메일만 보낸다: 기각. 발송 결과를 적을 `email_sent_at` 이 없어 운영자가 실패한 발송을 찾지 못한다. 중복 방지가 셀 행도 없어 같은 사건의 이메일이 창 안에서 되풀이된다.
- (c) 채널 값에 `none` 을 더해 숨김을 표시한다: 기각. DB CHECK 제약을 바꾸는 마이그레이션이 든다. (a) 는 이미 있는 `email` 값으로 같은 뜻을 낸다.

둘 다 끄면 행을 만들지 않는다. 보낼 것이 없으니 발송 기록도 중복 방지도 필요 없다.

채널 계산은 지금처럼 발사원이 한다. 저장 경로가 설정을 읽게 바꾸면 발사원마다 다른 기본값(opt-in · opt-out)과 끌 수 없는 유형의 예외를 저장 경로가 모두 알아야 한다. 그래서 헬퍼를 넓혀 발사원이 결과를 넘기게 한다.

끌 수 있는 유형을 셋으로 둔 이유: `background_failed` 와 `alert_*` 는 끄는 수단이 이미 있어 키를 더하면 같은 알림을 끄는 곳이 둘이 된다. `integration_action_required` 는 인앱이 사용자가 통합 장애를 아는 기본 경로다. `team_invite` 는 늘 보내고 `marketplace_update` 는 아직 보내지 않는다.

### 일일 요약은 매일 09:00 Asia/Seoul 에 따로 모아 보낸다

결정일: 2026-11-20

- 보내는 시각: 원문의 「하루가 끝나면」은 누구의 하루인지 정할 시간대가 없다. 사용자에게는 시간대가 없고, 한 사용자가 여러 워크스페이스에 속하므로 워크스페이스 시간대도 고를 수 없다. 그래서 제품 기본 시간대의 고정 시각으로 정했다. 09:00 은 업무를 시작할 때 전날 실패를 한 번에 보는 시각이다.
- opt-in: 실행 실패와 스케줄 실패의 즉시 메일은 기본 켜짐이다. 요약까지 기본으로 켜면 설정을 건드리지 않은 사용자가 같은 실패를 두 번 받는다.
- 즉시 메일과 독립: 요약 키가 즉시 메일을 끄는 뜻까지 가지면 키 하나가 두 동작을 바꾼다. 둘을 따로 두면 사용자가 즉시 메일, 요약, 둘 다, 둘 다 받지 않음을 고를 수 있다.
- 수신 거부 링크: 서명 토큰을 담은 링크로 로그인 없이 끄는 공개 엔드포인트는 기각했다. 토큰 발급 · 검증 · 만료와 인증 없는 쓰기 경로가 새로 생긴다. 알림 설정 화면을 만들기로 했으므로 링크는 그 화면으로 보낸다.

### 새 이메일 키는 opt-in 으로 둔다

결정일: 2026-11-20

예전에는 키마다 방향이 달랐고 새 키의 기본을 정할 규칙이 없었다. `integrationExpiryEmail` 은 opt-in 이고 실행 실패 · 스케줄 실패 키는 opt-out 이다. 이제 새로 더하는 이메일 키는 opt-in 으로 둔다. 사용자가 켜지 않은 메일을 늘리지 않으려는 것이다. 기존 opt-out 키 둘은 그대로 둔다. 기본 방향을 뒤집으면 설정을 건드린 적 없는 사용자의 실패 메일이 알림 없이 끊긴다.
