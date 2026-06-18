# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md` (--impl-done, diff-base=origin/main)
도입 파일: `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts`
변경 파일: `engine-driver.interface.ts`, `execution-engine.service.ts`, `workflow-errors.ts`

---

## 발견사항

발견된 충돌 없음.

아래는 신규 식별자 각각에 대한 확인 결과다.

### [INFO] `ExecutionGraphState` — 이동(move), 신규 도입 아님

- target 신규 식별자: `ExecutionGraphState` (새 위치: `types/graph-dispatch.types.ts`)
- 기존 사용처: `execution-engine.service.ts` (이전 선언 위치), `engine-driver.interface.ts` (import 소비자), `execution-engine.service.ts` (implementation 소비자 — lines 1184, 1261, 1741)
- 상세: 타입 자체는 신규가 아니다. origin/main 에서 `execution-engine.service.ts` 에 `export interface ExecutionGraphState` 로 선언되어 있던 것을 leaf 모듈 `types/graph-dispatch.types.ts` 로 이동한 것이다. `execution-engine.service.ts` 는 이제 동일 이름을 `./types/graph-dispatch.types` 에서 `import type` 하고, 내부 사용처(return type, local type annotation)에서 그대로 소비한다. `engine-driver.interface.ts` 도 마찬가지로 새 경로에서 import 한다. 외부 모듈(execution-engine 모듈 바깥)에서 이 타입을 직접 import 하는 코드는 존재하지 않음을 확인했다.
- 제안: 충돌 없음. 식별자 의미가 동일하게 보존되어 있고 외부 노출이 없으므로 변경 불필요.

### [INFO] `NodeDispatchLoopParams` — 이동(move), 신규 도입 아님

- target 신규 식별자: `NodeDispatchLoopParams` (새 위치: `types/graph-dispatch.types.ts`)
- 기존 사용처: `execution-engine.service.ts` (이전 선언 위치 및 implementation 소비자), `engine-driver.interface.ts` (interface 시그니처 소비자)
- 상세: `ExecutionGraphState` 와 동일 패턴. origin/main 에서 `execution-engine.service.ts` 에 `export interface NodeDispatchLoopParams` 로 선언됐던 타입을 동일 leaf 모듈로 이동. 외부 모듈에서 직접 참조하는 코드 없음 확인.
- 제안: 충돌 없음.

### [INFO] `ExecutionGraphState` vs `GraphTraversalSummary` — 의미 분리 명확함

- target 신규 식별자: `ExecutionGraphState`
- 기존 사용처: `codebase/backend/src/modules/knowledge-base/search/search-result.interface.ts:15` — `GraphTraversalSummary` (별도 타입)
- 상세: 두 타입의 이름이 그래프 관련 도메인 용어를 공유하지만 의미가 완전히 다르다. `GraphTraversalSummary` 는 RAG 검색 결과 메타데이터(seedChunkCount, traversedEntityCount 등 집계 수치)를 담으며 knowledge-base 모듈에 속한다. `ExecutionGraphState` 는 워크플로 노드/엣지 재구축 결과(edges, nodes, topological sort, edge maps 등)를 담으며 execution-engine 모듈에 속한다. 새 파일 JSDoc 에도 명시적으로 "GraphTraversalSummary (knowledge-base RAG) 와 의미 분리" 가 설명되어 있다.
- 제안: 충돌 없음. 기존 문서화가 혼동 방지를 이미 명시함.

### [INFO] `@internal` JSDoc 태그 — 기존 컨벤션과 일치

- target 신규 식별자: `@internal` 태그 (EngineDriver 인터페이스 멤버 5개, `ExecutionCancelledError` 클래스)
- 기존 사용처: `src/instrumentation.ts:31,42`, `src/nodes/data/code/code.handler.ts:33,367`, `src/nodes/flow/workflow/workflow.handler.ts:249`, `src/modules/auth/auth.service.ts:785`
- 상세: `@internal` 은 이미 여러 파일에서 동일 의미("단위 테스트 전용 export" 또는 "모듈 외부 참조 금지")로 사용 중이다. 이번 변경은 그 컨벤션을 execution-engine 모듈 내 인터페이스 멤버에 추가 적용한 것이다. 의미 충돌 없음.
- 제안: 충돌 없음.

### [INFO] `graph-dispatch.types.ts` 파일명 — 기존 컨벤션 충돌 없음

- target 신규 식별자: `types/graph-dispatch.types.ts` (파일 경로)
- 기존 사용처: `types/trigger-parameter.types.ts` (기존 파일, 동일 디렉터리)
- 상세: `<domain>.<category>.ts` 네이밍 패턴(`trigger-parameter.types.ts`)을 그대로 따른다. 디렉터리 내 기존 파일과 이름 충돌 없음.
- 제안: 충돌 없음.

### [INFO] `ExecutionCancelledError` — `@internal` 추가, 식별자 신규 도입 아님

- target 신규 식별자: `@internal` 태그만 추가 (클래스명·export 변경 없음)
- 기존 사용처: `execution-engine.service.ts`, `retry-turn.service.ts`, `retry-turn.service.spec.ts` (모두 `workflow-errors.ts` 에서 import). `shared/execution-resume/park-release-signal.ts` 는 `ExecutionCancelledError` 의 동작 패턴을 JSDoc 에서 언급만 하며 직접 import 하지 않음.
- 상세: 클래스명은 변경되지 않았고 `workflow-errors.ts` 에서 계속 export 된다. `@internal` 태그는 IDE 경고용 convention 이며 런타임 영향 없음. 외부 모듈(execution-engine 바깥)에서 `ExecutionCancelledError` 를 직접 import 하는 코드는 없음을 확인함.
- 제안: 충돌 없음.

---

## 요약

이번 변경이 도입하는 신규 식별자는 사실상 `types/graph-dispatch.types.ts` 라는 새 파일과 그 안의 두 타입 `ExecutionGraphState` / `NodeDispatchLoopParams` 다. 두 타입 모두 기존에 `execution-engine.service.ts` 에 선언되어 있던 것을 순환 import 해소 목적으로 중립 leaf 파일로 이동한 것이며, 의미 변경이 없고 외부 모듈에서 직접 참조하는 코드도 없다. `@internal` JSDoc 태그 추가는 기존 프로젝트 컨벤션과 일치한다. 명명이 유사한 `GraphTraversalSummary`(knowledge-base RAG) 와의 혼동 가능성은 새 파일 JSDoc 에서 명시적으로 해소되어 있다. 기존 식별자와 다른 의미로 충돌하는 케이스는 발견되지 않았다.

---

## 위험도

NONE
