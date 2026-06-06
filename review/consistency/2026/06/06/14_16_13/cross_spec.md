# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
대상 scope: `spec/5-system/4-execution-engine.md`
diff-base: `origin/main`

---

## 발견사항

### 1. 발견사항 없음 — 데이터 모델 충돌 (INFO)

- target 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus`
- 충돌 대상: `spec/1-data-model.md §2.14 NodeExecution.status` enum
- 상세: PR 이 다루는 `status` 값(`running`, `pending`, `waiting_for_input`, `completed`, `failed`, `skipped`, `cancelled`)은 data-model spec §2.14 의 enum 정의와 완전히 일치한다. `reconcilePreParkWaitingStatus` 가 `running`/`pending` 에서만 봉투 채택하고 terminal(`completed`/`failed`/`skipped`/`cancelled`)을 제외하는 로직은 spec 의 enum 경계와 정합적이다.
- 제안: 없음 (일치).

### 2. **[INFO]** 실행 엔진 spec §1.1 원자성 보장 설명과 pre-park window 현실의 간극 — spec 미문서화

- target 위치: `codebase/backend/src/modules/executions/executions.service.ts` JSDoc(lines 190–237) 및 `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` JSDoc(lines 744–777)
- 충돌 대상: `spec/5-system/4-execution-engine.md §1.1` — "원자성 보장: `running ↔ waiting_for_input` 전이는 짝이 되는 `NodeExecution` 상태 변경과 **단일 DB 트랜잭션**으로 묶여 commit/rollback 된다"
- 상세: spec §1.1 은 `Execution ↔ NodeExecution` 의 **cross-query straddle** 문제를 트랜잭션으로 막는다고 기술한다. PR 구현의 주석은 이 원자성이 "intra-row inconsistency"(NodeExecution 내부의 `status` 컬럼과 `outputData.status` 봉투의 불일치)는 막지 못한다고 정확히 설명하며, 두 레이어(backend read-side normalization + frontend defense-in-depth)에서 보정한다. 이 pre-park window 패턴과 그에 따른 read-side normalization 정책이 spec §1.1 어디에도 명시되어 있지 않다. spec 을 읽는 다른 개발자가 "원자성 보장" 절만 보고 이 창이 존재하지 않는다고 오해할 수 있다.
- 제안: `spec/5-system/4-execution-engine.md §1.1` 의 원자성 보장 블록 아래에 **note** 문단 추가 권장 — "위 원자성은 Execution ↔ NodeExecution cross-row 불일치를 방지한다. 단, blocking 노드 핸들러가 `outputData`를 먼저 저장하고 `waitForXxx`가 `status` 컬럼을 전이하기 전의 짧은 pre-park window에서 `NodeExecution.status=running` + `outputData.status='waiting_for_input'` intra-row inconsistency가 발생할 수 있으며, `executions.service.findById`(backend read-side normalization)와 `applyExecutionSnapshot`(frontend defense-in-depth)가 이를 정규화한다." 이 INFO 는 코드가 spec 을 위반하는 것이 아니라 spec 에 문서화되지 않은 동작이 구현에 존재하는 것이다.

### 3. **[INFO]** `spec/5-system/15-chat-channel.md` 및 `spec/conventions/chat-channel-adapter.md` 의 `outputData.status === 'waiting_for_input'` 직접 비교 — `isNodeWaitingForInput` 로직과 잠재적 비대칭

- target 위치: `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` — `isNodeWaitingForInput` export (lines 768–777)
- 충돌 대상:
  - `spec/5-system/15-chat-channel.md §3.1 CCH-AD-07` — "blocking 진입 케이스 (`nodeExec.outputData.status === 'waiting_for_input'`)"
  - `spec/conventions/chat-channel-adapter.md §5.4 (d)` — "어댑터 sub-filter 가 `nodeExec.outputData.status === 'waiting_for_input'` 케이스를 사전 제외"
- 상세: chat-channel spec 은 `outputData.status === 'waiting_for_input'` 을 `ne.status` 컬럼과 관계없이 직접 비교한다(terminal row 제외 조건 없음). PR 의 `isNodeWaitingForInput` 는 `ne.status` 가 terminal(`completed`/`failed`/`skipped`/`cancelled`)이면 `outputData.status` 봉투를 무시한다. 두 로직이 서로 다른 판정 기준을 쓰고 있다. chat-channel-adapter 는 `node.completed` 이벤트 context 에서 비교하므로 이 시점의 `outputData.status` 는 stale 봉투가 아닌 실제 blocking 봉투인 경우만 해당하지만, spec 자체의 표현이 terminal 제외 조건을 명시하지 않아 불일치 인상을 준다. 현행 코드 경로가 서로 다른 시점(WS event vs REST snapshot)을 다루므로 실제 충돌은 없으나 spec 차원의 명확화가 필요하다.
- 제안: `spec/conventions/chat-channel-adapter.md §5.4 (d)` 에 "이 비교는 `node.completed` WS 이벤트 핸들러 컨텍스트이며, 해당 시점의 `outputData.status`는 blocking 진입 직후이므로 terminal row stale 봉투와 혼동 없다. REST snapshot 경로의 정규화 (`isNodeWaitingForInput`) 와 판정 기준이 다름은 의도적" 이라는 주석을 추가하면 혼란을 방지할 수 있다.

### 4. 요구사항 ID 충돌 — 없음

- PR 의 변경사항은 새 요구사항 ID 를 정의하지 않는다. 기존 ID 재사용 없음.

### 5. 권한·RBAC 모델 충돌 — 없음

- `executions.service.findById` 의 RBAC 범위는 변경되지 않았다. `reconcilePreParkWaitingStatus` 는 순수 함수로 권한 체계에 영향이 없다.

### 6. 계층 책임 충돌 — 없음

- 코드 주석에 "모든 snapshot 소비자(웹 앱·channel-web-chat·external-interaction-api)에 일관 적용"이라고 기술되어 있으며, backend read-side normalization + frontend defense-in-depth 의 이중 레이어 구조는 spec §0-overview 의 Core API Service / Client SPA 책임 분할과 일치한다.

---

## 요약

PR 구현(carousel waiting status 정규화)은 기존 `spec/**` 의 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어느 면에서도 직접 충돌을 일으키지 않는다. 단, `spec/5-system/4-execution-engine.md §1.1` 의 원자성 보장 절이 Execution ↔ NodeExecution cross-row 원자성만 설명하고 blocking 노드 핸들러의 **pre-park window intra-row inconsistency**는 기술하지 않아, 이 창의 존재와 read-side normalization 정책이 spec 에 반영되어 있지 않은 문서화 갭이 있다(INFO). 또한 `spec/conventions/chat-channel-adapter.md` 가 `outputData.status === 'waiting_for_input'` 을 terminal 제외 없이 직접 비교하는 표현과 PR 의 `isNodeWaitingForInput` 의 terminal 제외 로직 사이에 표현 비대칭이 존재하지만, 두 경로의 이벤트 컨텍스트가 달라 실제 동작 충돌은 없다(INFO). CRITICAL·WARNING 급 발견사항은 없다.

---

## 위험도

LOW
