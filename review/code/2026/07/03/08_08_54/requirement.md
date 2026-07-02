# 요구사항(Requirement) 리뷰 — 06 C-2 재개 진입 DB 원자 claim

대상: `claimResumeEntry` 도입(`execution-engine.service.ts`) + `continuation-execution.processor.ts` 소비 + `ai-turn-orchestrator.service.ts` re-park 수정 + `recoverStuckExecutions` cascade + 관련 spec(`4-execution-engine.md`, `data-flow/3-execution.md`) 갱신 + plan draft/consistency-check 산출물.

### 발견사항

- **[INFO]** plan 추적 항목(`06-concurrency.md` C-2) 체크박스가 구현 완료 후에도 "착수 대기" 로 미갱신
  - 위치: `plan/in-progress/refactor/06-concurrency.md` L40 (`- [ ] **결정: Option A 승인 (사용자, 2026-07-02)** … **착수 대기**`)
  - 상세: 본 changeset 은 `claimResumeEntry` 구현·테스트·spec 반영까지 C-2 의 "개선 방안 1~3" 을 모두 완료했으나, 추적 plan 파일은 changeset 에 포함되지 않아 여전히 "착수 대기" 상태로 남아 있다(`git log` 확인 결과 최신 커밋도 `25a470be1`(결정 기록)에서 멈춰 있고 이번 구현 커밋에서 갱신되지 않음). CLAUDE.md 의 "plan 체크박스 = 실제 상태" 원칙과 어긋난다.
  - 제안: `06-concurrency.md` C-2 체크박스를 `[x] 구현 완료` 로 갱신(별도 developer/plan 후속 커밋으로도 무방, 이번 PR 병합 직후 처리 권장).

- **[INFO]** spec draft(`spec-draft-c2-atomic-claim.md`) Rationale 의 "구현: `state-machine.ts` `ALLOWED_TRANSITIONS` 에 `waiting_for_input → running`(재개 진입 claim) 추가" 서술이 실제 구현과 불일치
  - 위치: `plan/in-progress/spec-draft-c2-atomic-claim.md` L924, `spec/5-system/4-execution-engine.md` Rationale 동일 문구(구현 노트)
  - 상세: `git log`/`git diff` 로 확인한 결과 `state-machine.ts` 는 이번 changeset 에서 전혀 수정되지 않았고, `WAITING_FOR_INPUT → RUNNING` 전이는 과거 커밋(`3213a4a55`)에서 이미 `ALLOWED_TRANSITIONS` 에 존재했다. 또한 `claimResumeEntry` 자체는 `manager.createQueryBuilder().update(...)` raw UPDATE 로 `assertTransition`/`ALLOWED_TRANSITIONS` 를 아예 경유하지 않는다(§1.1 "단일 choke point" 인 `updateExecutionStatus` 우회). 즉 spec 문구가 지시하는 "ALLOWED_TRANSITIONS 추가 작업"은 실제로 필요하지도, 수행되지도 않았다 — spec 의 구현 노트가 부정확하다.
  - 제안: spec 반영 시(project-planner) 이 구현 노트를 "`waiting_for_input → running` 전이는 기존 `ALLOWED_TRANSITIONS` 에 이미 존재 — claim 은 `updateExecutionStatus` 를 우회하는 raw UPDATE 이므로 state-machine 정렬 불요" 로 정정 권장. 코드 자체는 문제 없음(불필요한 변경을 하지 않았으므로).

- **[WARNING]** `claimResumeEntry` 가 `updateExecutionStatus`("Execution 상태 전이의 단일 choke point") 를 우회하면서 그 부수효과(`segmentStartMs` 등)를 별도로 수동 복제
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L862-901 (`claimResumeEntry`), 대비 L6855-6864 (`updateExecutionStatus` JSDoc: "Execution 상태 전이의 단일 choke point")
  - 상세: `claimResumeEntry` 는 `dataSource.transaction` 안에서 `Execution`/`NodeExecution` 을 raw `createQueryBuilder().update()` 로 직접 갱신하고, `claimed===true` 일 때 `segmentStartMs.set(executionId, Date.now())` 를 수동으로 다시 호출해 `updateExecutionStatus` 의 부수효과를 재현한다(주석에 명시적으로 인지·문서화됨). 현재는 정확히 대응되지만, `updateExecutionStatus` 에 향후 다른 부수효과(예: WS 이벤트, 메트릭)가 추가되면 `claimResumeEntry` 경로가 자동으로 누락시킬 구조적 위험이 있다 — "단일 choke point" 라는 기존 설계 원칙이 이 경로에서 사실상 깨졌다.
  - 제안: 코드 수정을 요구하는 수준은 아님(트랜잭션 제약상 `updateExecutionStatus` 재사용이 어려웠을 가능성 높음) — 다만 `updateExecutionStatus` JSDoc 에 "claim 경로(`claimResumeEntry`)는 예외적으로 이 choke point 를 우회한다" 는 1줄 상호 참조를 추가해 향후 `updateExecutionStatus` 확장 시 이 경로도 함께 검토하도록 표시 권장.

- **[INFO]** rehydration 진입 가드가 `WAITING_FOR_INPUT` 외 `RUNNING` 도 "재개 가능"으로 허용해 기존 invariant 를 의도적으로 완화
  - 위치: `execution-engine.service.ts` L949-958 (`rehydrateAndResume` 의 Execution 상태 검사), L1001 부근 (`nodeExec` 상태 검사)
  - 상세: 기존에는 `Execution.status !== WAITING_FOR_INPUT` 이면 무조건 `RESUME_CHECKPOINT_MISSING`. 변경 후에는 `WAITING_FOR_INPUT` 또는 `RUNNING` 이면 통과한다. claim 이 유일한 `WAITING_FOR_INPUT → RUNNING` 쓰기 경로라는 전제 하에는 안전하지만, 검사 자체는 "claim 이 정상 동작했는지" 를 구분하지 못하는 방향으로 느슨해졌다(테스트/코드 리뷰상 claim 은 견고해 보이나, 이 지점의 invariant 는 이제 claim 의 정확성에 암묵적으로 의존한다). spec 본문(`4-execution-engine.md` §7.5)도 동일하게 이 완화를 명시하고 있어 spec-code 정합은 확인됨 — CRITICAL 아님.
  - 제안: 조치 불요(spec fidelity 통과, 설계상 의도된 트레이드오프). 참고로만 기록.

- **[INFO] spec fidelity 확인 — 코드가 spec 과 line-level 로 일치**
  - `claimResumeEntry` 시그니처(`executionId`, `nodeExecutionId` → `Promise<boolean>`), 단일 트랜잭션 내 NodeExecution→Execution 순서(레이스 결정자=NodeExecution), affected=0→false, `__no_node_exec__`/빈 문자열 legacy 우회는 `spec/5-system/4-execution-engine.md` §7.5·§1.1 개정 문구·`spec-draft-c2-atomic-claim.md` 변경 1/3/4 와 정확히 일치.
  - `markNodeExecutionFailed` 의 `status IN (WAITING_FOR_INPUT, RUNNING)` 확장은 spec "Rehydration 실패 케이스" 개정("claim 후 running 잔류 금지")과 일치. `markExecutionCancelled` 는 이미 두 상태를 다뤄 왔음(사전 존재, 회귀 없음).
  - `recoverStuckExecutions` 의 `.returning('id')` + 자식 NodeExecution cascade FAILED 는 spec Rationale "재개 race … 부분 수정" 소절의 "크래시 잔여 running row 는 recoverStuckExecutions(RUNNING 대상)가 회수" 서술과 일치. cascade 대상이 claim-pair 된 노드로 한정되지 않고 해당 Execution 의 모든 RUNNING NodeExecution 을 포괄하는데, 이는 spec 서술("자식 RUNNING NodeExecution 도 cascade FAILED")과 부합하며 오히려 더 안전한 방향(broader)이라 문제 없음.
  - `reparkAiResumeTurn` 의 `nodeExec.status = WAITING_FOR_INPUT` 명시 설정은 claim 도입으로 발생한 실제 회귀(claim 후 nodeExec 가 RUNNING 으로 로드되는데 재설정 없이 save 하면 RUNNING 이 영속됨)를 정확히 겨냥한 수정이며, `ALLOWED_TRANSITIONS[RUNNING]` 에 `RUNNING` 자기전이가 없어 `assertTransition` 이 이를 방치했다면 별도 오류가 났을 것 — `driveResumeAwaited`/`driveResumeFrame` 의 `if (savedExecution.status !== RUNNING)` 가드도 동일하게 `assertTransition(RUNNING, RUNNING)` throw 를 정확히 회피.
  - `continuation-execution.processor.ts` 의 `claimResumeEntry` 치환은 `retry_last_turn`/`cancel` 제외 로직을 그대로 유지하며 spec §7.5/§4.2 서술과 일치.

- **[INFO] TODO/FIXME/HACK/XXX 주석 없음.** 신규 코드 전 구간에서 미완성을 시사하는 주석 미발견.

- **[INFO] 테스트 커버리지 양호.** `claimResumeEntry` 의 성공/실패/동시 레이스/legacy 우회 4 케이스, `markNodeExecutionFailed` RUNNING 포함 회귀 가드, `recoverStuckExecutions` cascade 신규 테스트, `continuation-execution.processor.spec.ts` 의 `isNodeExecutionWaiting → claimResumeEntry` 리네임이 전부 정합적으로 갱신됨. 엣지 케이스(빈 nodeExecutionId, `__no_node_exec__` sentinel, affected=0 동시 레이스)를 실질적으로 검증.

### 요약

이번 변경은 `spec/5-system/4-execution-engine.md` §7.5 가 "정상-경로 race 까지 닫는다" 고 선언했음에도 실제로는 비원자 SELECT 재검증에 그쳤던 갭을, `waiting_for_input → running` 조건부 원자 UPDATE(단일 트랜잭션, Execution·NodeExecution 짝 전이)로 메우는 구현이다. `claimResumeEntry` 도입·`continuation-execution.processor.ts` 소비·`ai-turn-orchestrator.service.ts` re-park 상태 재설정·`markNodeExecutionFailed`/`recoverStuckExecutions` 의 RUNNING 포함 롤백·cascade 까지 claim 도입이 파급시키는 모든 지점을 빠짐없이 손봤고, 테스트도 레이스·엣지케이스를 포함해 견고하다. spec(§7.5/§1.1/§1.2/§7.4/Rationale)과 `data-flow/3-execution.md` 갱신도 코드 구현과 line-level 로 일치하며, 이전 consistency-check(rev1 CRITICAL rationale_continuity)가 이미 해소된 rev2 spec draft 를 정확히 반영했다. 실질 결함은 발견되지 않았고, 남은 지적사항은 모두 비차단(INFO)·낮은 우선순위(WARNING 1건, "claim 의 updateExecutionStatus choke-point 우회에 대한 문서화 보강")에 그친다 — 특히 plan 체크박스 미갱신은 코드 결함이 아니라 프로세스 후속 조치 누락이다.

### 위험도
LOW
