# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.spec.ts (신규 테스트)

- **[WARNING]** 테스트가 `continueAiConversation` 후속 turn 의 실제 핸들러 재실행을 보장하지 않음
  - 위치: 라인 86-88 (`service.continueAiConversation(executionId, 'hi'); await flushPromises();`)
  - 상세: `continueAiConversation` 은 내부적으로 continuation bus 를 통해 비동기로 `handleAiMessageTurn` 을 재진입한다. `flushPromises()` 가 `setImmediate` 기반이므로, 실제 메서드 호출 체인이 micro-task 큐 이후의 macro-task 나 추가 비동기 단계를 포함하는 경우 단 한 번의 flush 로 모든 경로가 완료되지 않을 수 있다. 기존 유사 테스트들이 같은 패턴을 사용하고 있다면 통과하겠지만, 타이밍 의존성이 있는 취약한 구조다.
  - 제안: `flushPromises()` 를 두 번 호출하거나, continuation bus 가 동기적으로 resolve 됨을 주석으로 명시. 혹은 `jest.runAllTimers()` 를 함께 사용.

- **[WARNING]** `savedAgentRows` 필터 기준 `nodeId === 'node-agent'` 가 테스트 픽스처와 정합성 검증 없음
  - 위치: 라인 96 (`.filter((e) => e?.nodeId === 'node-agent')`)
  - 상세: 테스트 픽스처에서 `makeAiAgentHandler` 로 등록된 노드가 실제로 `nodeId === 'node-agent'` 인지 명시적으로 확인하는 코드가 없다. 픽스처 구조 변경 시 이 필터가 빈 배열을 반환하고, 이후 `expect(savedAgentRows.length).toBeGreaterThanOrEqual(1)` 이 실패하여 문제를 조기에 잡겠지만, 실패 메시지가 "nodeId 불일치" 임을 알기 어렵다.
  - 제안: 필터 이후 `expect(savedAgentRows.length).toBeGreaterThanOrEqual(1)` 에 `'no NodeExecution with nodeId=node-agent was saved'` 같은 명시적 메시지 추가.

- **[INFO]** `_resumeState` 의 모든 민감 필드(예: `systemPrompt`, `llmConfigId`)를 테스트에서 명시적으로 검증하나, `totalInputTokens`/`totalOutputTokens` 같은 비민감 내부 상태 필드가 persisted payload 에 포함되어도 무방한지 spec 관점 검증 없음
  - 위치: 라인 122-128
  - 상세: 테스트는 `_resumeState` 키 자체의 부재와 `systemPrompt`, `llmConfigId` 직렬화 누출만 검증한다. `_resumeState` 하위의 `turnDebugHistory`, `totalInputTokens`, `model` 등이 `adaptedNext` 최상위에 직접 노출될 경우를 커버하지 않는다. 현재 구현(`delete persistedOutput._resumeState`)이 이 경우를 막는다면 충분하지만, 테스트 의도가 "내부 상태 전체 누출 방지"라면 `turnDebugHistory` 에 대한 canary 검증도 추가하면 더 명확하다.
  - 제안: `_resumeState.turnDebugHistory` 의 sentinel 값도 `INTERNAL_*` 패턴으로 설정하고 serialized 에 포함 안 됨을 검증.

- **[INFO]** 케이스 A(messages 누적), B(_resumeState strip), C(interactionType) 가 단일 `it` 블록에 통합됨
  - 위치: 전체 테스트 블록
  - 상세: 세 케이스가 plan 에서 별도 케이스 A/B/C 로 명시되었으나 하나의 `it` 에 통합되었다. 실패 시 어느 케이스가 실패했는지 Jest 출력에서 구분하기 어렵다.
  - 제안: 리뷰 목적으로는 현재 구조도 허용 가능하나, 향후 케이스 추가 시 별도 `it` 로 분리를 권장.

---

### 파일 2: execution-engine.service.ts (핵심 버그 수정)

- **[CRITICAL]** `nodeExec` 가 `null/undefined` 인 경우 save 를 건너뛰지만 이후 로직이 여전히 `nextResumeState` 를 기반으로 상태를 갱신하여 in-memory 와 DB 간 불일치가 발생할 수 있음
  - 위치: 라인 368 (`if (nodeExec) { ... }`)
  - 상세: `nodeExec` 가 없을 때 save 를 skip 하는 것은 안전하지만, 이 분기가 실제로 어떤 상황에서 발생하는지(예: 실행 중단 경쟁 조건, 잘못된 executionId) spec 에서 명시되지 않는다. `nodeExec` 가 없는 채로 후속 turn 을 진행하면 메시지 누락 외에도 상태 기계가 비정상 상태로 진행될 수 있다. 현재 코드는 이 경우 아무런 경고 로그도 남기지 않는다.
  - 제안: `nodeExec` 가 `null` 인 경우 `this.logger.warn('handleAiMessageTurn: nodeExec not found, skipping DB persist')` 추가 또는 throw + rollback 처리.

- **[WARNING]** `adaptedNext` 에서 shallow copy(`{ ...adaptedNext }`) 후 `_resumeState` 만 삭제하는 방식은 `adaptedNext` 의 다른 내부 필드(향후 추가될 수 있는 `_internalX`)가 자동으로 strip 되지 않음
  - 위치: 라인 369-370 (`const persistedOutput = { ...adaptedNext }; delete persistedOutput._resumeState;`)
  - 상세: 현재 WARN #6 대상이 `_resumeState` 하나이므로 즉각적인 위험은 없다. 그러나 향후 `_` prefix 규약의 내부 필드가 추가될 경우, 각 필드를 개별 삭제해야 한다는 것을 인지하지 못하면 누출이 재발한다. `emitAiWaitingForInput` 와 동일한 패턴이므로 일관성은 유지되나, 방어적 설계 관점에서 취약하다.
  - 제안: 명시적 allowlist 방식(`const { _resumeState: _, ...safe } = adaptedNext`) 또는 `_` prefix 필드를 일괄 strip 하는 유틸리티 함수로 중앙화.

- **[WARNING]** 수정이 `Execution` 상태 row 를 갱신하지 않고 `NodeExecution` 만 save 함 — spec 원자성 요건과의 정합성 명시 필요
  - 위치: 라인 368-376
  - 상세: plan 문서에서 "self-transition 이므로 `Execution` row 는 건드리지 않음" 이라고 명시되어 있고, 주석에도 "Execution row stays WAITING_FOR_INPUT (self-transition) so we save just the NodeExecution" 이라고 적혀있다. 그러나 spec/5-system/4-execution-engine.md:43 의 원자성 요건("running ↔ waiting_for_input 전이는 짝이 되는 NodeExecution 상태 변경과 단일 DB 트랜잭션")이 self-transition 에도 적용되는지 코드 레벨에서 명시가 없다. 주석이 이를 설명하므로 현재 수준은 허용 가능하지만, 트랜잭션 없이 단독 `save` 만 호출하므로 DB 오류 시 in-memory 캐시와 불일치가 남는다.
  - 제안: `try/catch` 추가 후 DB 오류 시 `logger.error` 로 남기거나, 혹은 기존 `updateExecutionStatus` 메서드가 self-transition 을 지원하는지 확인하여 활용.

- **[INFO]** 나머지 diff(라인 포맷 변경, `buildEdgeIndexes`/`isPortFiltered` 호출 줄바꿈)는 동작 변경 없음 — 요구사항 관점 이슈 없음

---

### 파일 3: catalog-sync.spec.ts (경로 수정)

- **[INFO]** `CATALOG_DIR` 경로가 주석(`7 hops back`)과 실제 `..` 개수(7개)가 일치함을 확인 — 기능 완전성 이상 없음
  - 위치: 라인 431-441
  - 상세: `__dirname` 이 `codebase/backend/src/nodes/integration/cafe24/metadata` (7단계 하위)이고, 7번의 `..` 으로 repo root 에 도달한 뒤 `spec/conventions/cafe24-api-catalog` 를 붙이는 것이 맞다. `codebase/` 래퍼 추가로 하나의 `..` 가 추가되어야 했던 버그를 수정한 것이며, 의도와 구현이 일치한다.
  - 제안: 없음.

- **[WARNING]** `loadCatalog()` 가 테스트 모듈 최상위(describe 밖)에서 즉시 실행되어, 파일 시스템 접근 실패 시 모든 테스트가 모듈 로드 단계에서 터진다
  - 위치: 라인 638 (`const catalog = loadCatalog();`)
  - 상세: 기존 패턴이므로 이번 diff 에서 새로 도입된 문제는 아니다. 다만 `CATALOG_DIR` 경로가 올바르지 않으면 `readFileSync` 가 throw 하고 Jest 는 모든 테스트를 "could not collect" 로 표시하여 어느 단언이 실패했는지 알 수 없다. 경로 수정의 정확성을 사람이 직접 계산해야 하는 취약점이 있다.
  - 제안: `beforeAll` 로 이동하거나, 적어도 `CATALOG_DIR` 존재 여부를 명시적으로 검증하는 assertion 을 추가.

---

### 파일 4: registry.test.ts (경로 수정)

- **[INFO]** `repoRoot` 경로 수정(`5단계 → 6단계`)이 주석 설명과 일치하며 의도와 구현이 정합함
  - 위치: 라인 955 (`path.resolve(__dirname, "..", "..", "..", "..", "..", "..")`)
  - 상세: `__dirname` 이 `codebase/frontend/src/lib/docs/__tests__` (6단계 하위)이므로 6번의 `..` 가 맞다. 버그 수정 정확성 문제 없음.
  - 제안: 없음.

- **[INFO]** `it.runIf(hasRealDocs)` 조건부 실행은 CI 환경에서 `content/docs` 부재 시 테스트가 skip 되는 정책이 문서화되어 있어 요구사항 관점 이슈 없음

---

### 파일 5: plan/in-progress/ai-agent-multiturn-waiting-persist.md

- **[WARNING]** 체크리스트 항목 중 `consistency-check --impl-prep`, 테스트 선작성, 구현, TEST WORKFLOW, REVIEW WORKFLOW, plan complete 이동이 모두 미완료(`[ ]`) 상태인데 plan 이 `in-progress/` 에 있음 — 라이프사이클 정합성 문제는 아니나(미완인 plan 이 in-progress 에 있는 것은 정상), 리뷰 시점에 이 항목들이 실제 구현 PR 에서 완료되었는지 확인이 필요함
  - 위치: 라인 1278-1286 (작업 체크리스트)
  - 상세: 코드 변경(파일 1, 2)이 PR 에 포함되어 있으므로 "테스트 선작성"과 "구현" 항목은 완료된 것으로 보이지만, plan 체크박스는 갱신되지 않았다. 만약 이 plan 이 PR 완료 후에도 체크박스 갱신 없이 머지된다면 lifecycle 위반이다.
  - 제안: PR merge 전 완료된 항목을 `[x]` 로 갱신할 것.

- **[INFO]** Follow-up 항목(spec/5-system/6-websocket-protocol.md §4.4.6 source 마커 영속 정책)이 `[ ]` 로 남아 있어 plan 이 `complete/` 로 이동될 수 없음 — 의도적인 follow-up 이며 현 상태는 적절

---

### 파일 6: consistency/SUMMARY.md

- **[INFO]** 문서 형식 및 내용 이상 없음. BLOCK 사유가 본 작업과 무관함을 명시하고 있으며, 권장 조치 절차가 CLAUDE.md 규약과 일치함.

---

### 파일 7: _retry_state.json

- **[INFO]** 모든 5개 checker 가 `agents_success` 에 기록되어 있으며 `agents_pending`, `agents_fatal` 이 비어있음. 요구사항 관점 이슈 없음.

---

## 요약

본 PR 의 핵심 요구사항은 "AI Agent multi-turn 후속 turn 에서 `NodeExecution.outputData` 를 DB 에 영속하여, REST 로 실행 상세를 읽는 다른 탭/클라이언트가 완전한 대화 내역을 볼 수 있도록 한다"이다. 구현(`execution-engine.service.ts` 의 `if (nodeExec)` 블록)은 이 요구사항을 직접 충족하며, `_resumeState` strip 및 `withInteractionMeta` 를 통해 기존 첫 turn 대기 패턴과 일관성을 유지한다. 테스트 코드(케이스 A/B/C 통합 `it`)도 save 호출 여부, messages 누적, _resumeState 누출 방지, interactionType 마킹을 모두 커버한다. 그러나 CRITICAL 수준의 미흡 사항이 1건 있다: `nodeExec` 가 `null` 인 예외 경로에서 save 가 조용히 skip 되며 경고 로그 없이 진행되어, 경쟁 조건 발생 시 데이터 누락이 무성 오류로 남는다. 또한 `_resumeState` 만 명시적으로 삭제하는 allowlist 접근의 부재와 트랜잭션 격리 미적용은 중간 위험도의 설계 취약점이다. 경로 수정 두 건(catalog-sync, registry.test)은 정확하게 수정되었으며 요구사항 이슈가 없다.

## 위험도

MEDIUM
