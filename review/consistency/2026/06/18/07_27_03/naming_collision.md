# 신규 식별자 충돌 검토 결과

검토 범위: C-1 step4 구현 변경 (diff base: claude/engine-split-s3-formbutton)  
대상 코드 영역: `codebase/backend/src/modules/execution-engine/`

---

## 발견사항

충돌에 해당하는 발견사항 없음.

---

## 식별자별 검토 결과

### RetryTurnService (신규 클래스)

- 정의: `/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (새 파일)
- 기존 사용처: 없음. `grep -r "RetryTurnService"` 결과 전부 본 diff 범위 파일 (engine-driver.interface.ts, execution-engine.module.ts, execution-engine.service.ts, 두 spec 파일) 만 참조.
- 파일명 `retry-turn.service.ts` / `retry-turn.service.spec.ts` 는 동일 디렉터리 내 기존 파일과 겹치지 않음. 명명 컨벤션(`<domain>.service.ts`) 준수.
- 판정: 충돌 없음.

### ExecutionGraphState / NodeDispatchLoopParams (visibility 변경: private → export)

- 정의: `execution-engine.service.ts` 단일 파일, 각각 line 403 / line 443.
- 이번 diff 에서 `interface` 에 `export` 가 추가됨. 중복 정의 없음.
- `engine-driver.interface.ts` 가 동일 파일에서 `import type { ExecutionGraphState, NodeDispatchLoopParams }` 로 단일 소스 참조. 지식 베이스 모듈의 `GraphTraversalSummary` (search-result.interface.ts) 와는 이름이 다르고 의미도 다르므로 혼동 가능성 없음 (`execution-engine.service.ts` 주석이 명시적으로 분리 설명).
- 판정: 충돌 없음.

### ExecutionCancelledError (로컬 클래스 → workflow-errors.ts 이관)

- 이전: `execution-engine.service.ts` 내 로컬 `class ExecutionCancelledError extends Error` 정의.
- 이번 diff: 로컬 클래스 제거 + `workflow-errors.ts` export 추가 + `execution-engine.service.ts` 가 import 로 전환.
- 현재 canonical 정의: `workflow-errors.ts` line 288 단 하나.
- `shared/execution-resume/park-release-signal.ts` 는 주석에서만 언급 (import 아님).
- `retry-turn.service.spec.ts` 가 `./workflow-errors` 에서 import — 동일 소스 경유.
- 판정: 이관으로 정리됨, 충돌 없음.

### 신규 EngineDriver 멤버 (rehydrateContext, loadAndBuildGraph, runNodeDispatchLoop, findActivatedBackEdge, clearLlmDefaultConfigCache)

- 정의: `engine-driver.interface.ts` — 각 메서드 단일 선언.
- 구현: `execution-engine.service.ts` 에 각 메서드가 `private` → `public` 으로 변경, 별도 중복 정의 없음.
- 동일 이름의 메서드가 다른 인터페이스/클래스에 존재하는지 확인: `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 모두 execution-engine 및 engine-driver 파일 외에 동일 이름 정의 없음.
- `runNodeDispatchLoop` 는 주석(park-release-signal.ts, process-turn-result.ts, workflow.handler.ts)에서 이름이 등장하나 import/export 없음 — 충돌 아님.
- 판정: 충돌 없음.

### RetryLastTurnError (기존 식별자, 이동 없음)

- `workflow-errors.ts` 에 이미 정의돼 있었음. 이번 diff 에서 `execution-engine.service.ts` import 목록에서 제거됨 (retryLastTurn 로직이 RetryTurnService 로 이관됐으므로 엔진이 더 이상 직접 사용 안 함).
- `retry-turn.service.ts` 가 `./workflow-errors` 에서 import — 단일 소스.
- 외부 소비자(websocket.gateway.ts / websocket.gateway.spec.ts) 는 기존과 동일 경로(`workflow-errors`) 에서 import 중.
- 판정: 이동 없음, 충돌 없음.

### 파일 경로

- 신규: `retry-turn.service.ts`, `retry-turn.service.spec.ts`
- 디렉터리: `codebase/backend/src/modules/execution-engine/`
- 기존 컨벤션(`ai-turn-orchestrator.service.ts`, `form-interaction.service.ts`, `button-interaction.service.ts`) 과 동일 패턴.
- 충돌 없음.

---

## 요약

이번 C-1 step4 변경이 도입하는 신규 식별자(`RetryTurnService`, `ExecutionGraphState` export, `NodeDispatchLoopParams` export, `rehydrateContext`/`loadAndBuildGraph`/`runNodeDispatchLoop`/`findActivatedBackEdge`/`clearLlmDefaultConfigCache` EngineDriver 멤버)는 기존 코드베이스에서 다른 의미로 사용 중인 동명 식별자가 없다. `ExecutionCancelledError` 는 로컬 클래스 제거 후 `workflow-errors.ts` 단일 canonical 정의로 정리됐고, `GraphTraversalSummary` 등 유사 이름 타입은 다른 모듈(knowledge-base)에 위치해 혼동 가능성이 낮다. 파일 경로도 기존 컨벤션에 부합하며 겹치는 파일이 없다. 식별자 충돌 관점에서 차단 사유 없음.

---

## 위험도

NONE
