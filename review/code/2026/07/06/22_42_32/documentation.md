### 발견사항

- **[INFO]** 이전 리뷰(SUMMARY 21_23_13) WARNING #5·#16 이 정확히 해소됨
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:266-268, 300-301` (notify/createMany JSDoc), `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:43-45` (클래스 docstring)
  - 상세: `notify`/`createMany` JSDoc 에 `resourceType`/`resourceId`(딥링크 라우팅 키) vs `backgroundRunId`(per-run attribution 전용, REST 미노출, migration V107, `{@link findByBackgroundRun}`) 구분이 정확히 추가됐다. processor 클래스 docstring 도 "이 알림은 딥링크와 per-run attribution 을 분리해 적재한다 — `dispatchFailureNotification` 참조" 로 갱신되어 실제 동작과 일치한다. 조치 불필요.

- **[INFO]** `getNotificationsService()` 신규 private 헬퍼에 목적·캐싱 동작을 설명하는 JSDoc 존재 — 양호
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:92-96`
  - 상세: "생성자 @Optional 주입이 순환 그래프 인스턴스화 순서로 undefined 인 경우를 대비해 ModuleRef(strict:false)로 지연 해석하고 결과를 캐시한다. 어느 경로로도 못 찾으면 undefined → 호출부가 no-op 한다." — 캐싱 semantics(`resolvedNotificationsService`: `undefined`=미시도, `null`=시도했으나 실패, 값=성공)까지는 코드를 봐야 알 수 있지만 핵심 동작(지연 해석 + 캐시 + no-op fallback)은 잘 설명됨.
  - 제안: 없음 (경미). 원한다면 `resolvedNotificationsService` 필드 자체에 3-state 캐시(`undefined`/`null`/값) 의미를 한 줄 주석으로 남기면 다음 유지보수자가 `!== undefined` 체크의 의도를 더 빨리 파악 가능.

- **[WARNING]** `finalizeResumedExecutionOutcome` 메서드 docstring 이 신규 side-effect(execution_failed 알림 dispatch)를 반영하지 않음 — 오래된 주석
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2444-2450` (메서드 docstring), 실제 dispatch 는 2503-2507행
  - 상세: 메서드 상단 JSDoc은 "Resume(rehydration) 중 입력 처리 / 그래프 구동 실패를 Execution 단말 상태로 마감한다. `ExecutionCancelledError` → `cancelled`, 그 외 → `failed`." 라고만 서술한다. 이번 커밋으로 FAILED 분기 끝에 `dispatchExecutionFailedNotification` 호출이 추가되어 메서드의 책임이 "상태 마감" 에서 "상태 마감 + 알림 발사" 로 확장됐으나, 메서드 docstring 자체는 갱신되지 않았다. 인라인 주석(2503-2506행)은 훌륭하게 설명되어 있어 dispatch 지점만 보면 이해 가능하지만, 메서드 전체 계약을 확인하려는 사람은 상단 JSDoc만 보고 "알림 미발사" 로 오인할 수 있다 (이번 버그 자체가 바로 이런 유형의 문서-구현 괴리에서 비롯됐다는 점에서 재발 방지 가치가 있음).
  - 제안: 메서드 docstring 끝에 "FAILED 종결 시 `execution_failed` 알림도 발사한다(best-effort, spec §1.1)" 한 줄 추가.

- **[INFO]** 커밋 메시지가 버그 A/B 근인·수정 내용·리뷰 반영 사항을 매우 상세히 기술 — 모범 사례
  - 위치: 커밋 656fc7cce 메시지 전체
  - 상세: 버그 재현 경로, 근인(forwardRef 순환 인스턴스화 순서), 수정 방향, e2e 결과(2/2 pass, 회귀 없음)까지 명시해 향후 `git blame`/`git log` 로 이 변경을 되짚는 사람에게 충분한 컨텍스트를 제공한다. 조치 불필요.

- **[INFO]** `notification.entity.ts` `backgroundRunId` 컬럼 주석이 `select: false` 도입 이유와 한계를 정확히 설명
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:256-263`
  - 상세: "`select: false` — 목록/카운트 등 엔티티 기본 SELECT 에서 배제해 REST 응답에 노출되지 않도록 강제한다 (ClassSerializer 계층 부재 대비 방어). attribution 조회(findByBackgroundRun)는 WHERE 절만 쓰므로 미노출과 무관하게 동작한다" — 이전 리뷰 WARNING #1(REST 미노출 의도-구현 괴리)에 대한 정확한 근본 수정이자, 왜 `findByBackgroundRun`은 영향받지 않는지까지 사전에 설명해 향후 "이 컬럼이 갑자기 안 보이는데 왜?" 류의 혼란을 방지한다. 모범 사례.
  - 제안: 없음.

- **[INFO]** `notifications.service.spec.ts` 신규 unit 3건이 이전 리뷰 WARNING #2(backgroundRunId 처리 로직 unit 테스트 부재)를 정확히 해소하며 테스트 자체에 목적을 설명하는 `describe` 제목이 명확함
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.spec.ts:293-306, 309-380` (`findByBackgroundRun — background_run_id 기준 attribution (V107)`, `backgroundRunId attribution 세팅 (V107)`)
  - 상세: `describe`/`it` 문구 자체가 검증 대상과 버전(V107) 근거를 담고 있어 별도 주석 없이도 테스트 의도가 읽힌다. `createMany` 테스트가 "부재 시 미설정"까지 커버해 옵셔널 필드 처리 계약을 문서화하는 효과도 겸함.
  - 제안: 없음.

- **[INFO]** CHANGELOG.md 가 이번 버그 픽스 커밋에서 갱신되지 않음
  - 위치: `CHANGELOG.md` (`## Unreleased — 알림 신규 발사 소스 execution_failed·schedule_failed·team_invite (알림 파이프라인 PR3)` 섹션), 커밋 656fc7cce
  - 상세: CHANGELOG.md 는 직전 PR3(`7eabf1d73`)에서 `execution_failed`/`schedule_failed`/`team_invite` 알림 신규 발사를 "Unreleased" 로 기록해뒀다. 이번 커밋은 바로 그 `execution_failed` 가 **실제로는 전혀 발사되지 않던** 2개 결함(재개 세그먼트 dispatch 누락, notificationsService undefined)을 고치는 것으로, "Unreleased" 항목이 아직 release 되지 않았다면 CHANGELOG 상의 PR3 서술 자체를 정정하거나(당시 발사되지 않았다는 사실 반영) 최소한 이번 fix 를 같은 Unreleased 섹션에 추가해 "PR3 발표 당시 실제로는 미발사였고 본 fix 로 실동작함" 이라는 릴리스 노트 관점의 사실을 남기는 것이 유용하다. 단, 아직 Unreleased 상태이므로 CRITICAL 은 아니고, 최종 릴리스 노트 정리 시점에 통합 반영해도 무방한 수준.
  - 제안: 릴리스 노트/CHANGELOG 정리 시점에 "PR3 execution_failed 발사가 재개 세그먼트 경로에서는 실제로 동작하지 않았고 본 후속 fix 로 실동작 확인" 을 한 줄 보강. 이미 Unreleased 상태라 급하지 않음 — INFO 수준으로 하향.

- **[INFO]** `plan/in-progress/notif-hardening-followups.md` 항목 2 갱신이 버그 A/B 발견 경위·근인·수정 내용을 상세히 기록 — plan 문서로서 추적성 우수
  - 위치: `plan/in-progress/notif-hardening-followups.md` (항목 2 블록 전체)
  - 상세: "핵심 성과" 콜아웃으로 e2e 가 적발한 선존 결함의 가치를 명시하고, 버그 A/B 각각의 근인·수정 방향·검증 결과(TEST WORKFLOW 격리 실행 2/2 pass)를 체크리스트에 정확히 반영했다. `spec-update-notifications-background-run-id.md` 에도 "backfill 없음" 노트가 Rationale 섹션 초안에 추가돼 이전 리뷰 WARNING #4 를 해소한다. 두 plan 문서 모두 spec 은 developer read-only 라는 규약(CLAUDE.md)에 맞춰 실제 `spec/` 파일은 건드리지 않고 draft 로만 쌓아 planner 위임을 유지한 점도 일관적.
  - 제안: 없음.

- **[INFO]** README 갱신 불요 판단이 타당함
  - 위치: 전체 diff
  - 상세: 이번 변경은 내부 버그 픽스(알림 미발사 결함 수정) + 리뷰 반영(컬럼 select:false, JSDoc, unit 테스트)으로 신규 공개 API·CLI·환경변수·설정 옵션이 추가되지 않았다. README/API 문서/설정 문서 갱신 대상 없음.
  - 제안: 없음.

### 요약

이번 커밋은 실제 미발사 버그 2건을 수정하면서 직전 리뷰(SUMMARY 21_23_13)의 documentation 관련 WARNING(#5 notify/createMany JSDoc, #16 processor docstring)을 정확히 해소했고, entity 컬럼 주석(`select:false` 근거)·플랜 문서(버그 근인·해소 기록)·신규 unit 테스트의 `describe` 제목까지 문서화 품질이 전반적으로 높다. 유일한 잔여 갭은 `finalizeResumedExecutionOutcome` 메서드 상단 JSDoc이 이번에 추가된 알림 dispatch side-effect를 반영하지 않는다는 점인데, 이는 인라인 주석으로 실질적으로 보완돼 있어 경미하며, 이번 버그 자체가 "핸들러 docstring과 실제 책임 범위의 괴리"에서 비롯됐다는 점을 감안하면 재발 방지 차원에서 보강할 가치가 있다. CHANGELOG는 아직 Unreleased 상태의 PR3 항목을 정정할 시점이 아니라 급하지 않다. README/API/설정 문서 갱신 대상은 없다.

### 위험도
LOW
