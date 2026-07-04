### 발견사항

- **[INFO]** "case A" / "case B" 라벨은 spec 상 신규 표기이나 식별자 충돌 아님
  - target 신규 식별자: §7.5 Δ4 에서 도입하는 서술 라벨 `case A`(waiting 재개)·`case B`(크래시 재개)
  - 기존 사용처: `spec/5-system/4-execution-engine.md` §7.5 본문에는 현재 이런 A/B 라벨 구분이 없음(단일 트리거 서술)
  - 상세: 코드 식별자·API·엔티티명이 아니라 spec 본문 내 설명용 라벨이므로 충돌 리스크는 없다. 다만 향후 §7.5 확장 시 "case C" 등 추가될 수 있어 명명 스킴(예: trigger-type 명 자체를 쓰는 대신 A/B/C 알파벳)이 문서가 커지면 참조성이 떨어질 수 있다.
  - 제안: 변경 불필요. 후속 확장 시 "case A(waiting)" 처럼 괄호 병기를 계속 유지해 라벨만으로 참조하지 않게 하면 충분(target 이 이미 그렇게 하고 있음).

- **[INFO]** target 이 사용하는 모든 핵심 식별자는 신규가 아니라 기존 재사용/정밀화
  - target 신규 식별자: `recoverStuckExecutions`, `claimResumeEntry`, `STUCK_RECOVERY_STALE_MS`, `EXECUTION_MAX_ACTIVE_RUNNING_MS`, `WORKER_HEARTBEAT_TIMEOUT`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `rehydrateContext`, `runNodeDispatchLoop`, `dispatchResumeTurn`, `_retryState`, `EXECUTION_TIME_LIMIT_EXCEEDED`
  - 기존 사용처: `spec/5-system/4-execution-engine.md` §7.1(L814-825)·§7.4(L900-906, `recoverStuckExecutions`)·§7.5(L944-993, `dispatchResumeTurn`/`rehydrateContext`/`runNodeDispatchLoop`/`RESUME_*`)·§8(L1054, L1219, `EXECUTION_MAX_ACTIVE_RUNNING_MS`); 코드 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`claimResumeEntry` L899, `STUCK_RECOVERY_STALE_MS` L2579), `execution-limits.ts`, `workflow-errors.ts`(`EXECUTION_TIME_LIMIT_EXCEEDED`), `ai-conversation-helpers.ts`(`RESUME_*` 3종)
  - 상세: target 은 이 식별자들을 **동일한 의미**로 그대로 재사용하며, 의미를 확장(§7.1 "일괄 fail"→"원자 re-claim+재구동")하거나 정밀화(§7.3 jobId 멱등 vs 재개 진입 원자 claim 구분)할 뿐 새로운 이름을 만들지 않는다. `claimResumeEntry` 는 case A(waiting_for_input→running) 전용으로 유지하고, case B(재시작 re-drive, running→running)는 **별도 함수명 없이** "started_at 조건부 re-claim"으로만 서술해 `claimResumeEntry`와 명확히 구분한다 — 좋은 설계 판단이다.
  - 제안: 변경 불필요. 구현 단계에서 case B 의 원자 UPDATE 를 별도 메서드로 추출할 경우, `claimResumeEntry`(waiting 전용)와 혼동되지 않는 이름(예: `reclaimStuckRunningExecution` 등 "reclaim"·"redrive" 계열, "claim" 단독 재사용 지양)을 developer 단계에서 채택 권장. 이는 target 자체의 결함이 아니라 후속 구현 시 참고 사항.

- **[INFO]** `WORKER_HEARTBEAT_TIMEOUT` 의미 축소가 §2.13(`Execution.error` 필드 어휘 목록)과 정합
  - target 신규 식별자: 없음 — 기존 `WORKER_HEARTBEAT_TIMEOUT` 의 의미만 "일괄 fail" → "재구동조차 불가/한도초과 잔여" 로 축소
  - 기존 사용처: `spec/1-data-model.md`(코퍼스 L985, `Execution.error` 필드 설명) 및 `spec/5-system/4-execution-engine.md` §7.1(L823, "attempts 소진 (terminal)")
  - 상세: target Δ1 이 "코드는 유지·의미만 축소"라고 명시하므로 문자열 자체(`WORKER_HEARTBEAT_TIMEOUT`)의 재사용이며 신규 충돌 아니다. 다만 §2.13/`spec/1-data-model.md` L985 의 error 어휘 설명도 이 의미 변경에 맞춰 동기화가 필요한데, target 의 "side-effect 점검 대상"(L98-103) 목록에 `spec/1-data-model.md` §2.13 갱신이 명시적으로 포함돼 있지 않다.
  - 제안: side-effect 점검 대상에 `spec/1-data-model.md` §2.13(`Execution.error` 필드, `WORKER_HEARTBEAT_TIMEOUT` 설명 부분)의 문구 동기화 확인 항목을 추가 권장(반영 시 developer/planner 후속 체크).

### 요약

target 문서(`plan/in-progress/spec-draft-crash-running-redrive.md`)가 `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.5 개정에 사용하는 모든 핵심 식별자(`recoverStuckExecutions`, `claimResumeEntry`, `STUCK_RECOVERY_STALE_MS`, `EXECUTION_MAX_ACTIVE_RUNNING_MS`, `WORKER_HEARTBEAT_TIMEOUT`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `rehydrateContext`, `runNodeDispatchLoop`, `dispatchResumeTurn`, `_retryState`, `EXECUTION_TIME_LIMIT_EXCEEDED`)는 실제로 새로 부여되는 것이 아니라 기존 spec 본문(§7.1/§7.4/§7.5/§8)과 코드(`execution-engine.service.ts` 등)에 이미 존재하는 이름을 동일한 의미로 재사용·정밀화한 것이다. `claimResumeEntry`(waiting 전용 claim)와 신규 도입되는 case B 재구동 claim 을 별도 함수명 없이 명확히 구분해 이름 충돌을 스스로 회피했고, 새 요구사항 ID·엔티티·엔드포인트·이벤트명·ENV/설정키·파일 경로도 신규 도입하지 않는다(기존 파일의 섹션 개정이며 신규 마이그레이션·컬럼도 명시적으로 "불요"). 발견된 사항은 모두 INFO 수준 — 향후 구현 단계에서의 명명 권고, 그리고 `WORKER_HEARTBEAT_TIMEOUT` 의미 변경에 따른 `spec/1-data-model.md` §2.13 동기화 확인 누락 가능성 정도다.

### 위험도
NONE
