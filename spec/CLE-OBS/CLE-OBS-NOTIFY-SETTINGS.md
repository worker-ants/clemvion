---
id: "CLE-OBS-NOTIFY-SETTINGS"
title: "알림 — 알림 설정과 이메일"
type: "design"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-OBS-NOTIFY"
ancestors: ["CLE-VISION", "CLE-OBS", "CLE-OBS-NOTIFY"]
area: "CLE-OBS"
content_hash: "93f826aa62941218141e0c8dc53eccc5d7941e699c68e133094714291da16a43"
read_as: "approved_fallback"
task: "CLE-T-EJFQ1Y"
source_paths: []
mirror_sha256: "09cc42d000b8aa73b63225cf96646f247cb249980286fc6bc16a9a3f72b0ef6d"
etag: "sha256-f6f733c08497cdf3d0a3dd88e86800efce5d59b57254647eb5f50904a9a24a4b"
---
## 개요

이 문서는 [알림](CLE-OBS-NOTIFY.md) 의 하위 문서로 알림 설정(notification preferences, `notification_preferences`)을 정한다. 유형별 인앱 토글과 이메일 토글, 토글로 알림 채널을 계산하는 규칙, 이메일 알림(즉시 발송 · 일일 요약 · 수신 거부 링크), 알림 설정 화면이 범위다. 알림 저장과 이메일 발송 · 실패 처리는 [알림 「저장과 전달」](CLE-OBS-NOTIFY.md#저장과-전달) 이 정한다.

## 설정 키

사용자는 알림 유형별로 인앱(벨)과 이메일을 따로 켜고 끈다. 키는 `<유형><채널>` 꼴의 평평한 이름으로 `User.notification_preferences` 에 둔다.

| 알림 유형 | 인앱 키 (기본) | 이메일 키 (기본) |
| --- | --- | --- |
| 워크플로우 실행 실패 `execution_failed` | `executionFailedInApp` (켜짐, opt-out) | `executionFailedEmail` (켜짐, opt-out) |
| 스케줄 실행 실패 `schedule_failed` | `scheduleFailedInApp` (켜짐, opt-out) | `scheduleFailedEmail` (켜짐, opt-out) |
| 통합 만료 `integration_expired` | `integrationExpiryInApp` (켜짐, opt-out) | `integrationExpiryEmail` (꺼짐, opt-in) |
| 통합 조치 필요 `integration_action_required` | 없음. 늘 인앱으로 보낸다 | `integrationExpiryEmail` 을 함께 쓴다 |
| 실패 일일 요약 | 해당 없음 | `dailyDigestEmail` (꺼짐, opt-in) |
| 팀 초대 `team_invite` | 없음. 늘 보낸다 | 없음. 초대 링크 이메일이 맡는다 |
| 마켓플레이스 업데이트 `marketplace_update` | 없음 | 없음. 도입하면 opt-in. 아직 보내지 않는다 |

- 설정 API 가 다루는 키는 위 표의 일곱 개다(`NotificationsService` 의 `SETTINGS_KEYS`). 인앱 키 셋, 이메일 키 셋, `dailyDigestEmail` 이다.
- 조회(`GET /api/notifications/settings`)는 저장값이 없는 키에 위 기본값을 채워 일곱 키를 모두 돌려준다(`resolveSettings`). 수정(`PATCH`)은 보낸 키만 기존 JSONB 에 합치고 같은 해소값을 돌려준다. 저장된 사용자가 없으면 404 `USER_NOT_FOUND` 다.
- Background 본문 실패(`background_failed`)와 알림 규칙 알림(`alert_*`)에는 키가 없다. 끌 수 없는 이유는 [인앱 끄기](#인앱-끄기) 에 있다.

## 이메일 수신 토글

- 새로 더하는 이메일 키는 opt-in(기본 꺼짐)이다. 이미 있는 `executionFailedEmail` · `scheduleFailedEmail` 의 opt-out 은 그대로 둔다([Rationale](#새-이메일-키는-opt-in-으로-둔다)).
- 실행 실패 · 스케줄 실패 · 통합 만료는 발사원이 수신자의 인앱 키와 이메일 키를 읽어 채널을 계산한다([채널 계산](#채널-계산)).
- 통합 조치 필요는 `integrationExpiryEmail === true` 일 때만 이메일을 붙인다. 키가 없으면 이메일을 보내지 않는다.
- 통합 알림 두 유형의 채널 규칙은 이 문서의 [설정 키](#설정-키) 와 [채널 계산](#채널-계산) 이 정본이다. 만료 스캐너와 조치 필요 알림기가 이 규칙을 적용하는 방식은 [통합 상태와 만료 알림 — 만료 스캐너와 알림 「채널과 이메일」](../CLE-INT/CLE-INT-STATUS-SCAN.md#채널과-이메일) 에 있다.
- **팀 초대의 이메일은 초대 링크 이메일이다.** 기존 가입자(비멤버)를 초대하면 수락 토큰을 담은 초대 링크 이메일(`MailService.sendWorkspaceInvitationEmail`)을 보낸다. `team_invite` 알림 행은 `in_app`(벨)으로만 저장한다. 사용자는 인앱 알림과 이메일을 모두 받고, 이메일을 보내는 주체가 초대 흐름일 뿐이다([Rationale](#팀-초대-알림은-인앱-채널로만-보낸다)).
- `/profile/alerts` 는 알림 설정 화면이 아니라 [알림 규칙](CLE-OBS-NOTIFY-RULES.md) 화면이다.

## 인앱 끄기

인앱 키를 끄면 그 유형의 알림이 벨에 보이지 않는다.

- 인앱 끔 · 이메일 켬: 알림 행을 채널 `email` 로 저장한다. 이메일은 다른 채널과 똑같이 보내고 성공하면 `email_sent_at` 을 채운다.
- 인앱 끔 · 이메일 끔: 알림 행을 만들지 않는다.
- 채널이 `email` 인 행은 벨의 알림 목록, 읽지 않은 알림 수, 모두 읽음, 모두 지우기, `notification.new` 실시간 전송에서 뺀다. 조회 네 곳은 `channel <> 'email'` 조건(`bellChannelClause`)을 붙이고 `emitNew` 는 이 행을 보내지 않는다. 조회 정의는 [벨 · 읽음과 닫기 · API · 데이터 「목록과 수에 미치는 영향」](CLE-OBS-NOTIFY-INBOX.md#목록과-수에-미치는-영향) 에 있다.
- DB 채널 값(`in_app` · `email` · `both`)은 그대로라 마이그레이션이 없다. 이 기능 전에는 채널 `email` 로 저장하는 발사원이 없었다. 알림 규칙은 규칙 채널 `email` 을 `both` 로 바꿔 저장한다. 그래서 `email` 행을 벨에서 빼도 기존 알림은 사라지지 않는다.
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
| 끔 | 끔 | 보내지 않음(`null`). 발사원이 그 수신자를 건너뛴다 |

- 키가 없으면 [설정 키](#설정-키) 의 기본값으로 본다. opt-out 키는 값이 `false` 일 때만 끔이고 opt-in 키는 값이 `true` 일 때만 켬이다.
- 계산 함수는 `computeNotificationChannel(prefs, type)`(`notification-channel.ts`) 하나다. 유형별 키와 opt-in 여부는 같은 파일의 `CHANNEL_KEYS` 가 가진다.
- `NotificationsService.resolveNotificationChannels(userIds, type)` 는 수신자들의 설정을 한 번에 읽어 이 함수로 계산한 결과를 사용자별로 돌려준다. 조회되지 않은 사용자는 설정이 없는 것으로 보고 기본값을 쓴다. 실행 실패 발사원(`ExecutionEngineService`)과 스케줄 실패 발사원(`ScheduleRunnerService`)이 이 헬퍼를 쓴다.
- 통합 만료 발사원(`IntegrationExpiryScanner`)은 이미 읽은 수신자 설정으로 `computeNotificationChannel` 을 직접 부른다. 임계 선점과 당일 격하는 수신자와 상관없이 먼저 끝난다.
- 헬퍼와 계산 함수는 설정을 조회만 하고 저장 경로에 끼어들지 않는다.

## 일일 요약

`dailyDigestEmail` 을 켠 사용자에게 하루치 실패를 모은 이메일을 한 통 보낸다. 작업은 `NotificationDigestService` 다.

| 항목 | 규칙 |
| --- | --- |
| 원천 | `notification` 행이다. 채널과 `dismissed_at` 으로 거르지 않는다. 인앱만 끈 유형(채널 `email`)과 닫은 알림도 들어간다 |
| 두 채널을 끈 유형 | 인앱과 이메일을 모두 끈 유형은 알림 행이 없으므로 요약에도 들어가지 않는다(사용자 결정 2026-11-20, [Rationale](#요약-원천을-알림-행으로-정하고-두-채널을-끈-유형은-뺐다)). 알림 설정 화면에 이 사실을 적는다 |
| 모으는 유형 | `execution_failed` · `schedule_failed` · `background_failed`(`DIGEST_TYPES`). `background_failed` 는 워크스페이스 관리자만 받으므로 관리자의 요약에만 들어간다. 통합 알림과 알림 규칙 알림은 넣지 않는다 |
| 모으는 기간 | 보내는 시각부터 거꾸로 24시간이다. `created_at >= now - 24시간 AND created_at < now` |
| 받는 사람 | `notification_preferences ->> 'dailyDigestEmail' = 'true'` 인 사용자. id 순으로 500명씩 읽는다(`DIGEST_RECIPIENT_BATCH`) |
| 보내지 않는 경우 | 모은 행이 없는 사람에게는 보내지 않는다(사용자 결정 2026-11-20) |
| 묶는 단위 | 수신자마다 한 통이다. 본문은 워크스페이스 이름 순으로 묶고 워크스페이스마다 최근 10건까지 싣는다(`DIGEST_ITEMS_PER_WORKSPACE`). 나머지는 "외 N건" 으로 건수만 적는다 |
| 메일 | 제목은 `[Clemvion] 지난 24시간 실패 알림 N건` 이다. 본문에 모은 기간, 워크스페이스별 건수, 항목별 시각 · 유형 · 제목이 있다. "알림 보기" 버튼은 `/dashboard` 로 간다. 하단에 [수신 거부 링크](#알림-설정-화면과-수신-거부-링크) 가 있다(`MailService.sendDailyDigestEmail`) |
| 보내는 시각 | 매일 09:00 Asia/Seoul. BullMQ 큐 `notification-digest` 의 job scheduler `notification-digest-daily` 가 패턴 `0 9 * * *`, 시간대 `PRODUCT_DEFAULT_TIMEZONE` 으로 돈다. 등록이 멱등이라 서버 인스턴스가 여럿이어도 한 번만 돈다. 큐 등록 정보는 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다 |
| 시간대 | 보내는 시각과 메일 안 시각 모두 제품 기본 시간대 상수 `PRODUCT_DEFAULT_TIMEZONE`(`common/utils/timezone.ts`, `Asia/Seoul`)를 쓴다. 사용자에게는 시간대가 없고 언어(`locale`)만 있다. 한 사용자가 여러 워크스페이스에 속하므로 워크스페이스 시간대도 쓸 수 없다 |
| 실패 처리 | 한 사람의 발송이 실패하면 경고 로그만 남기고 다음 사람으로 넘어간다. 재시도하지 않는다. 작업 처리 중 예외는 에러 로그만 남기고 삼킨다. 그래서 BullMQ 작업은 실패로 남지 않는다 |
| 즉시 메일과의 관계 | 독립이다. 즉시 메일 키(`executionFailedEmail` · `scheduleFailedEmail`)를 꺼도 요약에는 모은다. 요약만 받으려면 즉시 메일 키를 끈다 |
| 토글 | `dailyDigestEmail`, opt-in(기본 꺼짐) |

e2e 는 매일 한 번 도는 작업을 기다릴 수 없다. 그래서 `POST /api/notifications/_test/send-daily-digest` 가 지금 시각으로 한 번 돌리고 `{ recipients, sent, failed }` 를 돌려준다. `NODE_ENV=test` 와 `E2E_TEST_HOOKS=1` 이 함께 맞을 때만 동작하고 아니면 404 다. 소유자 역할(`@Roles('owner')`)을 요구하고 OpenAPI 문서에서 뺀다. 제품 기능이 아니다.

## 알림 설정 화면과 수신 거부 링크

- 알림 설정 화면은 `/profile/notifications` 이고 실제 URL 은 `/w/<slug>/profile/notifications` 다.
- 화면 위쪽은 [설정 키](#설정-키) 의 인앱 키가 있는 세 유형을 행으로 두고 벨 · 이메일 체크박스를 둔 표다. 키가 없는 유형에는 토글이 없다. 두 칸을 모두 끈 행에는 이 알림을 받지 않는다는 안내가 붙는다. 표 아래에는 여기서 끌 수 없는 유형(팀 초대, Background 실패, 알림 규칙, 통합 조치 필요)을 적는다.
- 아래쪽 일일 요약 칸에는 `dailyDigestEmail` 체크박스, 보내는 시각과 모으는 유형, 보낼 알림이 없는 날은 보내지 않는다는 설명이 있다. 벨과 이메일을 모두 끈 알림은 요약에도 들어가지 않는다는 안내(`profile.notifications.digestExcludedNote`)도 함께 둔다.
- 체크박스를 바꾸면 그 키 하나만 `PATCH` 로 바로 저장하고 결과를 토스트로 알린다. 저장하는 동안에는 체크박스를 잠근다.
- 알림 설정 화면으로 들어가는 길은 [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) 이 정한다.
- 알림 이메일과 일일 요약 이메일의 하단에 수신 거부 링크를 둔다. 링크 주소는 슬러그 없는 `<FRONTEND_URL>/profile/notifications` 다. 메일을 만드는 서버는 사용자가 어느 워크스페이스를 보는지 모르기 때문이다. 프런트엔드의 흡수 라우트(`(main)/[...rest]`)가 현재 워크스페이스의 `/w/<slug>/profile/notifications` 로 보낸다.
- 서명 토큰으로 로그인 없이 끄는 공개 엔드포인트는 두지 않는다([Rationale](#일일-요약은-매일-0900-asiaseoul-에-따로-모아-보낸다)).

## 알림 설정 저장

알림 설정은 `User.notification_preferences` JSONB(V010, 기본 `{}`)에 둔다. 컬럼 정의는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 에 있고 키와 기본값은 위 [설정 키](#설정-키) 가 정한다. 이 컬럼은 알림 채널을 계산하는 발사원과 일일 요약 작업이 읽는다([알림 「저장과 전달」](CLE-OBS-NOTIFY.md#저장과-전달)).

## 이메일 알림

| 항목 | 설명 |
| --- | --- |
| 즉시 발송 | 채널이 `email` · `both` 인 알림 행마다 한 통. 실행 실패, 스케줄 실패, 통합 만료 · 조치 필요, 알림 규칙 위반이 해당한다. 팀 초대는 초대 링크 이메일이 따로 보낸다 |
| 일일 요약 | [일일 요약](#일일-요약) |
| 수신 거부 | 이메일 하단의 알림 설정 화면 링크([알림 설정 화면과 수신 거부 링크](#알림-설정-화면과-수신-거부-링크)) |

## 구현 위치

- `codebase/backend/src/modules/notifications/notification-channel.ts` (`computeNotificationChannel`, `CHANNEL_KEYS`)
- `codebase/backend/src/modules/notifications/notifications.service.ts` (`SETTINGS_KEYS`, `getSettings`, `updateSettings`, `resolveSettings`, `resolveNotificationChannels`, `bellChannelClause`, `emitNew`)
- `codebase/backend/src/modules/notifications/jobs/notification-digest.service.ts` · `notification-digest.constants.ts` (일일 요약 작업과 상수)
- `codebase/backend/src/modules/notifications/notifications.controller.ts` (설정 API, e2e 전용 훅 `_test/send-daily-digest`)
- `codebase/backend/src/modules/mail/mail.service.ts` (`sendNotificationEmail`, `sendDailyDigestEmail`)
- `codebase/frontend/src/app/(main)/w/[slug]/profile/notifications/**` (알림 설정 화면, `notification-settings-panel.tsx`)
- `codebase/frontend/src/lib/i18n/dict/ko/profile.ts` · `en/profile.ts` 의 `notifications` 묶음
- `codebase/backend/test/notification-settings-channel.e2e-spec.ts`, `codebase/backend/test/notification-daily-digest.e2e-spec.ts`, `codebase/frontend/e2e/profile/notification-settings.spec.ts`

## Rationale

### 알림 설정을 JSONB 로 둔다

알림 유형이 늘 때마다 `user` 테이블에 컬럼을 더하지 않으려고 JSONB 로 둔다(V010). 키가 없을 때의 해석은 키마다 다르며 [설정 키](#설정-키) 가 정한다. 통합 알림의 두 발사원(`IntegrationExpiryScanner`, `IntegrationActionRequiredNotifierService`)은 `prefs.integrationExpiryEmail === true` 로 엄격하게 비교한다. 키가 없으면 false 라 이메일을 붙이지 않는다.

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

### 요약 원천을 알림 행으로 정하고 두 채널을 끈 유형은 뺐다

결정일: 2026-11-20

요약은 따로 기록을 두지 않고 이미 저장된 `notification` 행을 모은다. 발사 조건, 수신자, 하위 실행 제외 같은 규칙을 알림 발사원이 이미 적용했으므로 요약이 같은 규칙을 다시 구현하지 않는다. 채널과 닫힘 여부로 거르지 않는 것은 요약이 벨 표시와 다른 전달 수단이라서다. 인앱만 끈 사용자나 벨에서 닫은 사용자도 요약은 받는다. 닫기는 벨에 보일지만 정하는 표시 결정이다. 중복 방지가 닫힌 행을 세는 것과 같은 근거다([알림 「중복 방지에 닫힌 알림도 센다」](CLE-OBS-NOTIFY.md#중복-방지에-닫힌-알림도-센다)).

그 결과 인앱과 이메일을 모두 끈 유형은 행이 없어 요약에도 들어가지 않는다. 사용자가 2026-11-20 에 이 동작을 받아들이기로 했고 알림 설정 화면에 그 사실을 적었다.

기각한 대안: `dailyDigestEmail` 이 켜져 있으면 두 채널을 꺼도 행을 만든다. 그 행은 벨에도 즉시 메일에도 나오면 안 되므로 지금 채널 값으로는 표시할 수 없다. 채널 `none` 같은 값을 더하는 마이그레이션이 들고, [인앱 끄기는 알림 행을 남기고 벨에서 숨긴다](#인앱-끄기는-알림-행을-남기고-벨에서-숨긴다) 에서 기각한 (c) 와 같은 길이 된다. 「둘 다 끄면 행을 만들지 않는다」 는 규칙이 다른 키의 값에 따라 달라지는 문제도 생긴다.

보낼 행이 없는 사람에게는 보내지 않기로 했다(사용자 결정 2026-11-20). 0건 메일은 매일 같은 내용이라 읽히지 않고 수신 거부를 부른다.

### 새 이메일 키는 opt-in 으로 둔다

결정일: 2026-11-20

예전에는 키마다 방향이 달랐고 새 키의 기본을 정할 규칙이 없었다. `integrationExpiryEmail` 은 opt-in 이고 실행 실패 · 스케줄 실패 키는 opt-out 이다. 이제 새로 더하는 이메일 키는 opt-in 으로 둔다. 사용자가 켜지 않은 메일을 늘리지 않으려는 것이다. 기존 opt-out 키 둘은 그대로 둔다. 기본 방향을 뒤집으면 설정을 건드린 적 없는 사용자의 실패 메일이 알림 없이 끊긴다.
