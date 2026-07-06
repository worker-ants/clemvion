# 정식 규약 준수 검토 — spec/data-flow/8-notifications.md (impl-done, PR3)

## 발견사항

- **[WARNING] §1.1 표의 3개 type 이 "미구현 (Planned)" 로 남아 실제 구현과 불일치**
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표 — `execution_failed`(L73) · `schedule_failed`(L74) · `team_invite`(L76) 행, 및 §1 Overview 서술(L14-18, L31-34)·§1 다이어그램 하단 표(L55-60)
  - 위반 규약: 엄밀히는 `spec/conventions/**` 의 명문 규칙 위반이 아니라, `spec/data-flow/` 문서가 "구현 현황의 단일 진실"을 표방하는 자체 서술 규율(같은 표 안 다른 행들이 상태 갱신을 성실히 반영하는 패턴)과의 정합성 문제. `spec-impl-evidence.md` §1 은 `spec/data-flow/**` 를 frontmatter(`id`/`status`/`code`) 의무 대상에서 명시적으로 제외하므로, 이 표류는 frontmatter-evidence 가드로는 잡히지 않는 영역이다.
  - 상세: 금번 diff(PR3, 커밋 `25ee6bcef`)가 `ExecutionEngineService.dispatchExecutionFailedNotification`·`ScheduleRunnerService.dispatchScheduleFailedNotification`·`WorkspaceInvitationsService.dispatchTeamInviteNotification` 를 모두 구현·테스트 완료했음에도(worktree 코드 확인: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts`, `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts`), target spec 문서의 §1.1 표는 세 type 모두 여전히 "미구현 (Planned)" 로 표기하고 "현재 어떤 코드도 본 type 발사 안 함" 이라 서술한다. 같은 문서·같은 표의 다른 행(`background_failed`, `integration_expired`, `integration_action_required`, `alert_<rule.type>`)은 구현 시점에 "구현됨" 으로 정확히 갱신된 선례가 있어, 이번 3행만 뒤처진 형태다.
  - 제안: 코드 확인 결과 이 갭은 **developer 가 이미 인지·위임**한 상태다 — `plan/in-progress/spec-update-notifications-firing.md` (owner: planner, 커밋 `9154e455f`) 가 정확히 이 3행의 "Planned → 구현됨" flip 과 §5.1 채널 정합 반영을 위임 대기 중이다. 이는 CLAUDE.md 의 "developer 는 spec read-only, spec 변경 필요 시 project-planner 위임" 규칙을 올바르게 따른 것이므로 **target 문서 자체를 지금 당장 수정할 필요는 없다** — 단, 이 PR 이 머지되기 전 또는 직후 해당 planner 위임 plan 이 신속히 처리되어야 문서 표류 기간이 짧아진다. 등급을 CRITICAL 이 아닌 WARNING 으로 매긴 이유: 코드 invariant 붕괴가 아니라 문서 신선도 문제이며, 이미 추적/위임된 known gap 이기 때문.

- **[INFO] `channel: 'both'` 하드코딩이 spec §1 Overview 의 "호출자가 preference 를 읽어 channel 계산" 서술과 문면상 다른 경로**
  - target 위치: `spec/data-flow/8-notifications.md` §1 Overview L16, L32, L45, §1.1 표(L57 "preference 확인 후 channel 계산… 호출자가 수행")
  - 위반 규약: 없음(정식 conventions 위반 아님). 참고용 INFO.
  - 상세: 새 3개 발사 소스(`execution_failed`/`schedule_failed`/`team_invite`)는 사용자 preference 조회 없이 `channel: 'both'` 를 고정 발사한다(코드 주석은 `spec/2-navigation/9-user-profile.md §5.1` 이 "채널 토글 미구현이라 기본값 고정" 임을 근거로 든다). 이는 §1 Overview 가 일반화한 "호출자가 preference 를 읽어 channel 계산" 패턴(현재 `IntegrationExpiryScanner`/`IntegrationActionRequiredNotifierService` 가 실제로 이렇게 동작)과 문면상 다른 경로라 처음 읽는 사람에게 혼동을 줄 수 있다.
  - 제안: 이미 developer 가 이 채널 정합 이슈를 impl-done cross_spec CRITICAL 로 인지해 코드 수정(`in_app`→`both`, 커밋 `c5c3ac100`)했고, 위 spec-update 위임 plan(L19-21 "채널 정합" 섹션)에 반영 방침(§5.1 변경 불요, §1.1 각주로 "토글 미구현이라 고정값" 명시)까지 정리돼 있다. planner 가 그 plan 을 실행할 때 §1 Overview 서술도 "일부 발사원은 preference 없이 고정 channel" 뉘앙스를 한 줄 보강하면 완전해진다.

- **[INFO] `resource_type='execution'` 키공간 공유 각주 — 문서에 아직 미반영**
  - target 위치: `spec/data-flow/8-notifications.md` §2.1 표 (L91, `findByResource` 행)
  - 위반 규약: 없음. 참고용 INFO.
  - 상세: 코드 주석(`execution-engine.service.ts` 신규 `dispatchExecutionFailedNotification` JSDoc)은 `execution_failed` 의 `resource_type='execution'` 이 `background_failed` 의 옛 NodeExecution fallback 과 같은 키공간을 공유함을 명시하고, 향후 `findByResource('execution', …)` 도입 시 주의가 필요하다고 self-documenting 했다. spec §2.1 의 `findByResource` 행에는 이 주의사항이 아직 없다.
  - 제안: 이 항목도 이미 developer 가 spec-update 위임 plan L25 "resource_type 공유 주의" 항목으로 명문화 대기 중이므로 별도 조치 불요 — planner 실행 시 함께 반영.

## 요약

이번 target 문서(`spec/data-flow/8-notifications.md`)는 명명·출력 포맷·문서 구조(Overview/본문/Rationale)·API 문서 데코레이터 규약 등 `spec/conventions/**` 가 명문으로 규정한 항목에는 직접 위반이 없다(`spec/data-flow/**` 는 frontmatter 의무에서 명시 제외된 영역이라 그 가드도 해당 없음). 유일한 실질 이슈는 이번 PR3 구현(3개 알림 발사 소스)이 target spec 문서의 §1.1 상태표에 아직 반영되지 않아 "미구현 (Planned)" 표기가 실제 코드와 어긋난다는 점인데, 이는 developer 가 spec read-only 원칙을 지켜 `plan/in-progress/spec-update-notifications-firing.md` 로 planner 에게 명시적으로 위임해둔 **추적 중인 known gap**이라 프로세스 위반이 아니다. 나머지 두 건(channel 고정값 서술, resource_type 키공간 공유 각주)도 같은 위임 plan 범위 안에 이미 포함돼 있다.

## 위험도
LOW
