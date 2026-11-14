---
id: "CLE-OBS-NOTIFY-SETTINGS"
title: "알림 — 알림 설정과 이메일"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-OBS-NOTIFY"
ancestors: ["CLE-VISION", "CLE-OBS", "CLE-OBS-NOTIFY"]
area: "CLE-OBS"
content_hash: "5f90ee4c5da1e5e0ba3a36a36e67e2647973be0477ee2a2764c50063d94426e2"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "deb44f2b6eb314ead44aecf70339e82db23d705ef3cd1a17ec5309f39dd3cfa9"
etag: "sha256-1e1505c5e04eece45d7586cf1621565bb46a39034e9c4d16418faad8ef9bd461"
---
## 개요

이 문서는 [알림](CLE-OBS-NOTIFY.md) 의 하위 문서로 알림 설정(notification preferences, `notification_preferences`)의 유형별 이메일 수신 토글과 이메일 알림(즉시 발송·일일 요약·수신 거부)을 정한다. 알림 이메일 발송과 실패 처리는 [알림 「저장과 전달」](CLE-OBS-NOTIFY.md#저장과-전달) 이 정한다.

## 이메일 수신 토글

사용자는 알림 유형별로 이메일을 받을지 정한다. 저장 위치는 `User.notification_preferences` JSONB(V010)다. API 는 구현됐다(`GET`·`PATCH /api/notifications/settings`). 설정 화면의 구현 여부는 정의가 갈린다. [미결 사항](CLE-OBS-NOTIFY.md#미결-사항) 참조.

| 알림 유형 | 기본 채널 | 사용자 변경 | 설정 키와 기본값 |
| --- | --- | --- | --- |
| 워크플로우 실행 실패 | 인앱 + 이메일 | 가능. 이메일을 끄는 방식(opt-out) | `executionFailedEmail`, 기본 켜짐 |
| 스케줄 실행 실패 | 인앱 + 이메일 | 가능. 이메일을 끄는 방식(opt-out) | `scheduleFailedEmail`, 기본 켜짐 |
| 통합 만료·조치 필요 | 인앱. 이메일은 켜야 받는다 | 가능. 이메일을 켜는 방식(opt-in) | `integrationExpiryEmail`, 기본 꺼짐 |
| 마켓플레이스 업데이트 | 인앱 | 아직 보내지 않는다. 도입하면 이메일을 켜는 방식(opt-in) | 없음 |
| 팀 초대 | 인앱 + 이메일 | 불가(항상 보낸다) | 없음 |

- 조회(`GET`)는 저장값이 없는 키에 기본값을 채워 돌려준다. 현재 구현은 `integrationExpiryEmail` 이 없으면 `false`, `executionFailedEmail`·`scheduleFailedEmail` 이 없으면 `true` 로 채운다. 수정(`PATCH`)은 보낸 키만 합친다.
- 통합 알림 노티파이어는 `notification_preferences.integrationExpiryEmail === true` 일 때만 이메일을 붙인다. 표의 "인앱" 은 기본 상태이고 "이메일은 켜야 받는다" 는 켠 뒤에 닿는 채널이다. 통합 알림의 채널 규칙은 [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md) 과 같다.
- 실행 실패·스케줄 실패는 발사원이 `resolveOptOutEmailChannels` 로 수신자의 토글을 반영한다.
- **팀 초대의 이메일은 초대 링크 이메일이다.** 기존 가입자(비멤버)를 초대하면 이메일은 수락 토큰을 담은 초대 링크 이메일(`MailService.sendWorkspaceInvitationEmail`)이 보내고 `team_invite` 알림 행은 `in_app`(벨)으로만 저장한다. 표의 "인앱 + 이메일" 은 제품 수준에서 맞고 이메일을 보내는 주체가 초대 흐름일 뿐이다([Rationale](#팀-초대-알림은-인앱-채널로만-보낸다)).

범위와 빈칸:

- 인앱 채널 끄기는 미구현이다. 인앱 알림은 늘 벨에 보인다.
- 마켓플레이스 업데이트는 아직 보내지 않아 토글 대상이 아니다. 도입할 때 opt-in 으로 둔다.
- 이메일 일일 요약은 미구현이다(아래).
- `/profile/alerts` 는 알림 설정 화면이 아니라 [알림 규칙](CLE-OBS-NOTIFY-RULES.md) 화면이다.

## 알림 설정 저장

알림 설정은 `User.notification_preferences` JSONB(V010, 기본 `{}`)에 둔다. 컬럼 정의는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 에 있고 키와 기본값은 위 [이메일 수신 토글](#이메일-수신-토글) 이 정한다. 이 컬럼은 알림 채널을 계산하는 발사원이 읽는다([알림 「저장과 전달」](CLE-OBS-NOTIFY.md#저장과-전달)).

## 이메일 알림

| 항목 | 설명 |
| --- | --- |
| 즉시 발송 | 실행 실패, 통합 만료, 팀 초대 |
| 일일 요약 | 하루 동안의 실패 요약. 미구현. 설정 저장소(`notification_preferences`)는 있지만 요약을 모아 보내는 작업과 전용 토글이 없어 아직 동작하지 않는다 |
| 수신 거부 | 이메일 하단의 수신 거부(unsubscribe) 링크. 정의가 갈린다. [미결 사항](CLE-OBS-NOTIFY.md#미결-사항) 참조 |

## Rationale

### 알림 설정을 JSONB 로 둔다

알림 유형이 늘 때마다 `user` 테이블에 컬럼을 더하지 않으려고 JSONB 로 둔다(V010). 키가 없을 때의 해석은 키마다 다르며 [이메일 수신 토글](#이메일-수신-토글) 이 정한다. 통합 알림의 두 발사원(`IntegrationExpiryScanner`, `IntegrationActionRequiredNotifierService`)은 `prefs.integrationExpiryEmail === true` 로 엄격하게 비교한다. 키가 없으면 false 라 이메일을 붙이지 않는다(`channel='in_app'`).

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

표의 "팀 초대 | 인앱 + 이메일" 은 **제품 수준에서 맞다**(사용자는 여전히 인앱 알림과 이메일을 모두 받는다). 나중에 알림 설정의 채널 켜고 끄기가 구현돼 사용자가 팀 초대 이메일을 끄는 기능이 필요해지면 초대 링크 이메일을 그 설정과 묶을지는 그때 따로 정한다.
