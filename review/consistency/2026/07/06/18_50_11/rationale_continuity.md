STATUS: OK

### 발견사항

- **[INFO]** `notify()`/WS emit/이메일 발송 "미구현 (Planned)" 서술이 origin/main 시점에 이미 stale
  - target 위치: `spec/data-flow/8-notifications.md` Overview "구현 현황 주의" 및 §1 다이어그램 표 ("`notification.new` WS emit — 미구현 (Planned)", "이메일 발송 — 미구현 (Planned)")
  - 과거 결정 출처: 없음 (Rationale 항목이 아니라 본문의 현재 상태 서술). 코드 근거: `codebase/backend/src/modules/notifications/notifications.service.ts`(HEAD) `notify()` 메서드가 이미 `emitNew()` + `dispatchEmails()` 를 수행하며, `git show origin/main:.../notifications.service.ts` 로 확인한 결과 이 구현은 이 PR(diff) 이전 커밋 `69d0f0a24`(WS emit + notify PR1, #836)·`550f971cf`(이메일 발송 PR2, #837) 에서 이미 origin/main 에 병합되어 있었음.
  - 상세: 이번 diff(PR3, `execution_failed`/`schedule_failed`/`team_invite` 발사 소스 추가)는 이 staleness 를 만들지 않았다 — origin/main 에 이미 존재하던 문서 지연이다. 다만 Rationale 연속성 관점에서 "합의 원칙 위반"은 아니지만, target spec 영역 문서가 스스로 선언한 현재 상태와 실제 코드가 어긋난 채로 이번 PR 의 근거 주석(`// spec/data-flow/8-notifications.md §1.1`)들이 그 위에 얹혔다는 점을 표시해둔다.
  - 제안: 이번 PR 범위는 아니지만, 후속 spec 갱신(PR1/PR2 반영) 시 §1 표의 "미구현 (Planned)" 행과 Overview 주의 문구를 "구현됨"으로 승격하고 `## Rationale` 에 WS emit·이메일 발송 도입 근거를 추가할 것을 권고. 본 PR3 자체 조치 불필요.

- **[INFO]** `execution_failed`/`schedule_failed`/`team_invite` 발사 구현이 §1.1·§5.1 Planned 기술과 정합
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `dispatchExecutionFailedNotification`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts` `dispatchScheduleFailedNotification`, `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `dispatchTeamInviteNotification`
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` §1.1 표 (execution_failed: "워크플로우 owner / 실행자에게", schedule_failed: "스케줄 발사 후 execution 이 즉시 실패 또는 enqueue 자체 실패", team_invite: "해당 이메일이 이미 가입자인 경우에만 in-app 알림 + 이메일 둘 다") + `spec/2-navigation/9-user-profile.md` §5.1 (워크플로우/스케줄 실행 실패 기본 채널 = 인앱+이메일, 채널 on/off 미구현)
  - 상세: 코드의 top-level-only 발사(`!parentExecutionId`), `channel: 'both'` 하드코딩(토글 미구현이라 기본값 고정), team_invite 의 "기존 가입자(비멤버)만" 조건 모두 스펙 §1.1/§5.1 서술과 정확히 일치한다. Rationale 에 기각된 대안을 재도입하거나 원칙을 위반하는 지점 없음.
  - 제안: 없음 (정합 확인).

- **[INFO]** `hasRecentByResource` dismissed-row 포함 원칙 및 `dismissed_at` soft-delete 설계에 대한 변경 없음
  - target 위치: 신규 발사 경로(`dispatchExecutionFailedNotification`/`dispatchScheduleFailedNotification`/`dispatchTeamInviteNotification`) 어디에도 중복 방지(`hasRecentByResource`) 호출이 없음
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` Rationale "중복 방지에 dismissed row 포함"
  - 상세: 세 신규 type 모두 24h 중복 방지 로직을 적용하지 않는다(스펙 §1.1 에도 명시 없음 — `execution_failed`/`schedule_failed`/`team_invite` 는 애초에 반복 발사 우려가 낮은 1회성 이벤트). 기존 Rationale 원칙(중복 방지는 dismissed row 도 카운트)과 충돌하지 않으며, 단순히 이 원칙이 적용될 필요가 없는 신규 type 이다.
  - 제안: 없음.

### 요약
이번 diff(PR3)는 `spec/data-flow/8-notifications.md` §1.1 이 이미 "미구현 (Planned)"으로 명시해 둔 `execution_failed`/`schedule_failed`/`team_invite` 세 발사 소스를 구현한 것으로, spec 본문·`9-user-profile.md §5.1`(기본 채널 인앱+이메일)과 정확히 합치하며 기존 `## Rationale` 의 어떤 결정도 재도입·번복·위반하지 않는다. best-effort 예외 처리(발사 실패가 원 트랜잭션/재시도 판단을 흔들지 않음), top-level 실행 한정(background_failed 와의 중복 회피), team_invite 의 기존 가입자 한정 조건 모두 스펙에 이미 기록된 의도를 코드로 옮긴 것이다. 유일하게 짚을 점은 spec Overview/§1 표의 "notify()·WS emit·이메일 발송 미구현 (Planned)" 서술이 이 PR 이전 커밋(#836/#837)에서 이미 stale 해졌다는 것인데, 이는 이번 PR 의 책임 범위가 아니다.

### 위험도
NONE
