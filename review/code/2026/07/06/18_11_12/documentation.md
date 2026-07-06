### 발견사항

- **[WARNING]** PR3(본 diff, `execution_failed`/`schedule_failed`/`team_invite` 발사 소스)에 CHANGELOG.md 항목 없음
  - 위치: `CHANGELOG.md` (실제 diff 범위 `origin/main..HEAD`, 즉 550f971cf..9154e455f — `git diff origin/main -- CHANGELOG.md` 결과 없음)
  - 상세: 직전 PR2(알림 이메일 발송)는 CHANGELOG.md 에 상세 항목이 추가됐고, 이 저장소는 최근 커밋들(V-12, V-14, V-10, V-05, V-09 등)마다 예외 없이 "Unreleased — <제목>" 섹션 + SoT 링크를 CHANGELOG 에 남기는 확립된 관례가 있다. 그러나 이번 PR3 는 사용자向으로 관찰 가능한 새 동작(워크플로우 실행 실패 시 owner/실행자 알림, 스케줄 발사 실패 시 owner 알림, 워크스페이스 초대 시 기존 가입자에게 team_invite 알림 — 3개의 신규 알림 발사 소스)을 추가함에도 CHANGELOG 갱신이 누락됐다.
  - 제안: PR2 항목과 동일한 형식으로 "Unreleased — 알림 신규 발사 소스 execution_failed·schedule_failed·team_invite (알림 파이프라인 PR3)" 섹션을 CHANGELOG.md 에 추가. `!parentExecutionId` top-level 게이트, schedule enqueue-실패 전용 조건, team_invite 의 기존 가입자 한정 조건, SoT(`spec/data-flow/8-notifications.md §1.1`)를 요약.

- **[INFO]** spec §1.1 표가 3개 type 모두 여전히 "미구현 (Planned)" 로 서술 — 코드와 불일치하나 의도적 위임 상태
  - 위치: `spec/data-flow/8-notifications.md` §1.1 (L73, L74, L76)
  - 상세: PR3 구현 후에도 spec 은 `execution_failed`/`schedule_failed`/`team_invite` 를 "미구현 (Planned)" 로 표기해 코드와 어긋난다. 다만 이는 developer 의 `spec/` read-only 제약에 따른 의도된 임시 상태이며, `plan/in-progress/spec-update-notifications-firing.md` 가 flip 대상·조건 정교화(top-level 게이트, enqueue-실패 조건, resource_type 공유 주의, team_invite 이메일 2통 결정 등)를 이미 상세히 위임해 두었다. 코드 결함 아님 — planner 트랙에서 처리될 항목이라 CRITICAL 로 올리지 않음.
  - 제안: 없음(이미 올바른 프로세스 — `spec-update-notifications-firing.md` 완료 확인만 후속 추적).

- **[INFO]** `resource_type='execution'` 키 공간 공유는 코드 주석·plan 문서에 이미 명시적으로 문서화됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `dispatchExecutionFailedNotification` JSDoc (L242-245), `plan/in-progress/spec-update-notifications-firing.md` naming_collision 섹션
  - 상세: `execution_failed` 알림이 `background_failed` 의 옛 NodeExecution fallback 과 동일한 `(resource_type='execution', resource_id)` 키 공간을 공유한다는 잠재 혼선을, JSDoc 이 "향후 `findByResource('execution', …)` 도입 시 두 계열이 같은 키공간을 공유함에 주의 — 현재 소비처는 `background_run` 스코프로 한정" 이라고 명확히 남겨 두었다. 문서화 관점에서 모범 사례.
  - 제안: 없음.

- **[INFO]** 신규 private 메서드 3종(`dispatchExecutionFailedNotification`, `dispatchScheduleFailedNotification`, `dispatchTeamInviteNotification`) 모두 목적·best-effort 정책·수신자 산출 근거·spec 앵커를 포함한 JSDoc 보유
  - 위치: `execution-engine.service.ts`, `schedule-runner.service.ts`, `workspace-invitations.service.ts`
  - 상세: 세 메서드 모두 (a) 발사 조건, (b) best-effort/예외 삼킴 이유, (c) spec 섹션 앵커(`§1.1`)를 JSDoc 에 담고 있어 독스트링 품질 기준을 충족한다. `execution-engine.service.ts` 생성자의 `@Optional() notificationsService` 도 프로덕션 항상 주입 vs 테스트 optional 배경을 인라인 주석으로 설명해 오해 소지가 낮다.
  - 제안: 없음.

- **[INFO]** 각 모듈 파일의 신규 import(NotificationsModule/Workflow) 에 순환 의존 안전성 근거 주석 포함
  - 위치: `schedules.module.ts` L995-996, `workspaces.module.ts` L1238
  - 상세: `NotificationsModule` 도입이 기존 순환 의존 회피 설계(WebsocketModule 지연 해석)를 깨지 않는다는 근거("MailModule/forFeature 만 의존")를 모듈 파일에 남겨, 향후 유지보수자가 다시 순환 의존을 우려해 재조사할 필요를 줄인다. 양호.
  - 제안: 없음.

- **[INFO]** tracker plan(`spec-sync-data-flow-8-notifications-gaps.md`) 체크박스가 실제 구현과 정합
  - 위치: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`
  - 상세: PR3 로 완료된 3개 항목이 `[x]` 로 갱신되고 각각 구현 파일·메서드명·spec-update plan 위임처를 정확히 기록했다(project CLAUDE.md "plan 체크박스=실제 상태" 관례 준수). `marketplace_update` 만 스코프 밖으로 명확히 남김.
  - 제안: 없음.

### 요약

PR3 코드 자체의 문서화 품질(JSDoc, 인라인 근거 주석, 모듈 의존성 주석, plan tracker 정합)은 전반적으로 우수하며 특히 `resource_type` 키 공간 공유 같은 잠재적 혼선 지점을 코드·plan 양쪽에 명시적으로 남긴 점이 눈에 띈다. spec 본문이 아직 "미구현 (Planned)" 으로 남아 코드와 어긋나지만 이는 developer 의 spec read-only 제약에 따라 `spec-update-notifications-firing.md` planner 트랙에 의도적으로 위임된 상태라 결함이 아니다. 유일한 실질 공백은 CHANGELOG.md — 직전 PR2 는 상세 항목을 남겼고 리포지토리 관례상 사용자向 변경마다 CHANGELOG 갱신이 일관되게 이루어지는데, 이번 PR3(신규 알림 발사 소스 3종)에는 항목이 빠져 있다.

### 위험도
LOW
