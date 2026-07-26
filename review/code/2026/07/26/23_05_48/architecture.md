# Architecture Review — ie-resume-turn-boundary-cancel (2026-07-26 23:05, 4차 라운드)

## 발견사항

- **[WARNING]** 동일 불변식("Execution 이 non-terminal 인지 행 잠금으로 확인")을 지키는 트랜잭션 블록이 이번 라운드에서 두 곳으로 늘었다 — 새 choke point 가 기존 것과 SQL·구조를 그대로 복제
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8049`~`:8073` (`assertActiveExecutionAndSaveNodeExec` 전체), 특히 SELECT 문 `:8056`~`:8059`. 대조: 같은 파일 `updateExecutionStatus` 의 `linkedNodeExec` 분기 트랜잭션 `:8230`~`:8248`, 특히 SELECT 문 `:8233`~`:8236`.
  - 상세: 3차 라운드 WARNING #1 fix 로 추가된 `assertActiveExecutionAndSaveNodeExec` 은 `updateExecutionStatus` 의 `linkedNodeExec` 분기와 `SELECT id FROM execution WHERE id = $1 AND status IN (${NON_TERMINAL_STATUSES_SQL}) FOR UPDATE` → `live.length === 0` 시 no-op 반환 → 아니면 `manager.save` 라는 동일한 구조를 그대로 복제한다(둘 다 `this.dataSource.transaction` 블록 안). 두 메서드가 이렇게 갈라진 근본 원인은 `state-machine.ts` 의 `assertTransition`/`ALLOWED_TRANSITIONS` 가 자기 자신으로의 전이(RUNNING→RUNNING)를 허용하지 않아, `finalizeAiNode` 의 "이미 RUNNING 유지" 분기가 `updateExecutionStatus` 를 호출하면 곧바로 `Invalid state transition` 예외가 나기 때문이다(코드 주석 `execution-engine.service.ts:8038`~`8041` 이 이 회피 이유를 정확히 서술하고 있다). 즉 "Execution 이 non-terminal 이면 행을 잠그고 관련 엔티티를 save" 라는 하나의 개념이 지금 두 개의 이름(`updateExecutionStatus`/`assertActiveExecutionAndSaveNodeExec`)과 두 개의 SQL 사본으로 존재한다. `NON_TERMINAL_STATUSES_SQL` 상수는 공유되므로 상태 목록 자체의 drift 위험은 없지만, 잠금·트랜잭션 경계·no-op 판정 로직이 두 곳에 물리적으로 복제돼 있어 한쪽만 수정되면(예: 잠금 방식을 `FOR UPDATE SKIP LOCKED` 로 바꾸거나 타임아웃을 추가하는 등) 다른 쪽이 조용히 뒤처질 수 있다. 이미 plan(`ie-resume-turn-boundary-cancel.md` "3차 라운드 추가 후속" SUMMARY#6)에 등재된 항목은 `updateExecutionStatus` **자체의** `linkedNodeExec`/else 두 분기가 공유하는 4줄 마무리 블록(`recordRunningSegmentStart`+`emitTerminalExecutionMetrics`+`return`) 중복을 가리키는 것으로, 본 항목( `updateExecutionStatus` ↔ `assertActiveExecutionAndSaveNodeExec` 간의 잠금-트랜잭션 자체 중복)과는 범위가 다르다 — 아직 어느 라운드에서도 이 조합으로는 지적되지 않았다.
  - 제안: (a) `SELECT ... FOR UPDATE` + no-op 판정을 `private async lockNonTerminalExecutionRow(manager, executionId): Promise<boolean>` 류의 공유 헬퍼로 뽑아 두 소비처(그리고 향후 유사 요구가 생길 세 번째 소비처)가 재사용하게 하거나, (b) 근본적으로 `canTransition`/`assertTransition` 에 "동일 상태 유지" 를 명시적 opt-in(예: `allowSelfTransition`)으로 허용해 `finalizeAiNode` 의 RUNNING 유지 분기도 `updateExecutionStatus` 하나의 choke point 를 그대로 쓰게 하는 방향을 검토한다 — 후자는 "상태 전이의 단일 choke point" 라는 이 모듈의 기존 설계 원칙과 더 잘 맞는다.

- **[INFO]** (이미 추적됨, 신규 아님) `markNodeCancelled` 사전 `outputData`/`error` 초기화 계약이 타입이 아닌 caller 관례로만 강제
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:369`~`:377` (`assertLinkedTransitionApplied` 내부 수동 초기화), 대조: `execution-engine.service.ts:4586`~`:4615` (`markNodeCancelled` 자체는 `outputData` 를 건드리지 않음)
  - 상세: 이 갭은 2026-07-26 22:11 라운드 architecture 리뷰가 이미 WARNING 으로 지적했고(`review/code/2026/07/26/22_11_22/architecture.md`), `plan/in-progress/ie-resume-turn-boundary-cancel.md` "3차 라운드 추가 후속"(SUMMARY#4)에 "코드 변경 없음, 후속 form/button PR 착수 시 흡수" 로 명시적으로 defer 돼 있다. 이번 라운드 diff 에도 이 부분의 코드 변경은 없어 상태가 그대로다 — 새 결함이 아니라 이미 알려진 채 의도적으로 미룬 항목임을 재확인한다.
  - 제안: 별도 조치 불요 (추적 유지). 후속 form/button PR 착수 시 `markNodeCancelled` 자신이 초기화를 흡수하거나 `clearPayload?` 옵션을 시그니처에 명시할 것.

- **[INFO]** (양성 관찰) ISP·상태-전이 choke point 원칙이 이번 라운드에도 일관되게 유지됨
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:118`~`:187` (`AiTurnEngineDriver`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:507`~`:512` (`NON_TERMINAL_STATUSES_SQL`)
  - 상세: `assertExecutionNotCancelled`/`markNodeCancelled`/`assertActiveExecutionAndSaveNodeExec` 셋 다 실제 유일 호출자인 `AiTurnOrchestrator` 전용 `AiTurnEngineDriver` 표면에만 추가됐다(`CoreEngineDriver`/`RetryEngineDriver` 오염 없음) — 기존 C-1 후속 ④ ISP 방향과 일치. `engine-driver.interface.ts` JSDoc 의 멤버 수 실측(distinct 15 / AiTurn 10)도 실제 인터페이스 선언과 코드로 직접 대조해 정확함을 확인했다(문서-코드 drift 없음).

## 요약

3차 라운드까지 이어진 architecture 리뷰의 핵심 지적(`finalizeAiNode` "RUNNING 유지" 분기의 약한 원자성 — 잠금 없는 재조회+무보호 save)은 이번 라운드에서 `assertActiveExecutionAndSaveNodeExec`(같은 트랜잭션의 `FOR UPDATE` 행 잠금)로 완전히 닫혔고, `assertLinkedTransitionApplied` 를 통한 4개 소비처 계약 통일도 그대로 유지된다 — 전체적으로 이 PR 계열은 M-3 이 "범위 밖"으로 남겼던 짝 전이 lost-update 를 견고한 단일 원자성 모델로 수렴시키는 데 성공했다. 다만 그 수렴 과정에서 "Execution non-terminal 을 행 잠금으로 확인" 이라는 같은 개념이 `updateExecutionStatus`(짝 전이 분기)와 신설 `assertActiveExecutionAndSaveNodeExec` 두 곳에 SQL 수준까지 복제된 채 남았다 — 근본 원인은 상태-머신이 자기-전이(RUNNING→RUNNING)를 표현하지 못해 "단일 choke point" 원칙에서 벗어난 두 번째 진입점을 만들 수밖에 없었기 때문이다. 이는 이미 tracked 된 SUMMARY#6(4줄 마무리 블록 중복)과는 범위가 다른, 이번 라운드에서 새로 확인된 구조적 중복이라 별도로 등재할 가치가 있다. 그 외 항목(`markNodeCancelled` 초기화 계약 등)은 이미 이전 라운드에서 발견·defer 된 상태 그대로이며 코드 변경이 없어 재차 WARNING 으로 올리지 않았다. 즉시 차단할 결함은 없다.

## 위험도
LOW
