### 발견사항

없음 (Critical/Warning 없음).

- **[INFO]** 리팩터링이 behavior-preserving 하게 정확히 구현됨 (검증 완료)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4409-4453` (`finalizeFailedExecution`), 호출부 `2483-2487`(`finalizeResumedExecutionOutcome`)·`4388-4390`(`runExecution` catch)
  - 상세: 제거된 두 블록(재개 세그먼트 43줄, 초기 세그먼트 34줄)을 diff 로 대조한 결과 로직이 완전히 동일 — status 마킹(`FAILED`)·`error.message`/sentinel `code`(§1.4, `ErrorPortFallbackError`/`ExecutionTimeLimitError`)·`finishedAt`/`durationMs`·`executionRepository.save`·`eventEmitter.emitExecution(EXECUTION_FAILED)`·`dispatchExecutionFailedNotification` 호출까지 1:1 이관됐다. 유일한 차이는 로그 라벨(`(rehydrated)` 접미사)을 `opts.rehydrated` 플래그로 흡수한 것뿐이며, 이는 새 헬퍼 JSDoc·plan 문서(`notif-followup-refactor.md`)가 명시한 대로다. 경로별로 다른 `finalizeResumedExecutionOutcome`(`resumeCallStack = null` 리셋, `ExecutionCancelledError` 분기)과 `runExecution` catch(`ParkReleaseSignal`/`ExecutionCancelledError` 분기, `finally` 의 context/cache 정리)는 각 호출자에 그대로 남아 헬퍼로 흡수되지 않았다 — 계획서가 "경로별 상이 정리는 호출자 finally 유지"라 명시한 것과 일치.
  - 확인: `npx jest src/modules/execution-engine/execution-engine.service.spec.ts` 전체 375 테스트 통과(신규 회귀 가드 포함), `-t "finalizeFailedExecution"` 단독 실행도 통과.

- **[INFO]** spec fidelity — `spec/data-flow/8-notifications.md §1.1` 의 `execution_failed` 행이 이미 "초기 세그먼트 `runExecution` catch **및** 재개(rehydration) 세그먼트 `finalizeResumedExecutionOutcome` 양쪽에서 발사"로 갱신돼 있어(라인 71), 리팩터 후 코드의 실제 동작(두 호출자 모두 동일 헬퍼로 dispatch 수행)과 line-level 로 일치한다. 이 spec 갱신은 이번 diff 범위 밖(선행 PR #841/`ee540383a`)이며, 현재 diff(파일 3: `plan/complete/spec-update-notifications-background-run-id.md`)는 이미 반영된 사실을 완료 상태로 재확인하는 plan-lifecycle 이동으로, 코드와 모순되지 않는다.
  - `spec/5-system/4-execution-engine.md §4.4` 신규 표(파일 12)가 인용하는 두 구현 사례(`getNotificationsService` — `execution-engine.service.ts:701`, `NotificationsService.getWebsocket` — `notifications.service.ts:35`)는 실제 코드에 그대로 존재함을 grep 으로 확인 — 표 내용이 실 구현과 정확히 대응한다.

- **[INFO]** 신규 회귀 가드 테스트(`execution-engine.service.spec.ts:900-953`)가 "재개(rehydrated) 종결이 status·save·EXECUTION_FAILED emit·execution_failed dispatch 를 모두 수행"을 직접 검증한다. `finalizeFailedExecution`을 private 캐스팅으로 직접 호출해 4가지 side-effect(상태 마킹/`executionRepository.save`/`eventEmitter.emitExecution`/`notificationsService.createMany`)를 모두 단언 — PR #841 "버그 A"(재개 경로 dispatch 누락) 재발을 구조적으로 방지하는 목적에 정확히 부합한다. `createMany` 호출 페이로드의 `type: 'execution_failed'` 까지 검증해 의도-구현 일치도가 높다.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음. `plan/in-progress/notif-hardening-followups.md`에 남은 미완 항목("DI 순환 그래프 근본 축소")은 명시적으로 별도 backlog 로 분리돼 있고 본 PR 범위에서 제외됨이 plan 문서에 명확히 기술돼 있다 — 은폐된 미완성 작업이 아니다.

### 요약
`finalizeFailedExecution` 공통 헬퍼 추출은 순수 behavior-preserving 리팩터링으로, 제거된 두 FAILED 종결 블록과 신규 헬퍼의 로직을 line-level 대조한 결과 완전히 동일하며(로그 라벨만 opt 로 흡수), 경로별 고유 정리(`resumeCallStack`, `ExecutionCancelledError`/`ParkReleaseSignal` 분기, finally 캐시 정리)는 정확히 호출자에 남아 있다. 신규 회귀 가드 유닛 테스트가 재개 경로의 4대 side-effect(상태/save/emit/dispatch)를 직접 검증해 PR #841 버그 A 재발 방지 목적을 충족하며, 전체 375개 유닛 테스트가 통과했다. spec 측면에서도 `spec/data-flow/8-notifications.md §1.1`(선행 PR 반영분)과 신규 `spec/5-system/4-execution-engine.md §4.4` ModuleRef 문서화 표가 실제 구현과 line-level 로 일치함을 확인했다. TODO/FIXME 등 미완성 표식이나 기능 누락, 에러 시나리오 미정의, spec-코드 불일치는 발견되지 않았다.

### 위험도
NONE
