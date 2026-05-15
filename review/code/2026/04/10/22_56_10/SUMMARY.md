파일 쓰기 권한이 필요합니다. 허용해 주시면 보고서를 저장하겠습니다. 그 전에 통합 보고서 내용을 먼저 보여드리겠습니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `portRoutingSkipped → reachable` 리팩터링은 방향이 올바르나, SKIPPED 이벤트/레코드 제거가 프론트엔드 회귀를 유발할 수 있으며, 실행 루프 핵심 로직 중복과 성능 비효율이 복수 리뷰어에 의해 지적됨

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API·DB·부작용·요구사항 | **SKIPPED 이벤트 및 NodeExecution 레코드 무음 제거** — 기존 방식은 건너뛴 노드에 `NODE_SKIPPED` WebSocket 이벤트와 `NodeExecution(SKIPPED)` DB 레코드를 생성했으나, 새 방식은 unreachable 노드를 `pointer++`로 조용히 처리해 프론트엔드 UI "pending" 상태 유지 또는 실행 이력 누락 가능 | `execution-engine.service.ts` — `runExecution`, `executeInline` 내 unreachable 처리 블록 | disabled 노드와 동일하게 `createNodeExecution(…, SKIPPED)` + `emitNodeEvent(…, NODE_SKIPPED)` 복원; 또는 의도적 제거임을 스펙에 명시하고 관련 조회 로직 일괄 수정 |
| 2 | 유지보수·아키텍처·성능 | **실행 루프 핵심 로직 중복** — `reachable` 초기화, while 루프, back-edge 처리, `propagateReachability` 호출 ~120줄이 `runExecution`과 `executeInline` 양쪽에 복사되어 버그 수정 시 동기화 누락 위험 | `execution-engine.service.ts` — `runExecution` (~726행), `executeInline` (~334행) | `executeGraphLoop(...)` private 공유 메서드로 추출; `buildInitialReachableSet`, `resetReachabilityRange` 헬퍼도 분리 |
| 3 | 성능 | **`propagateReachability` O(N×E) 선형 스캔** — `edges.filter((e) => e.sourceNodeId === nodeId)`가 노드 실행마다 호출; N=100, E=200 기준 최대 20,000회 비교. `backEdgeMap`은 이미 Map으로 최적화되어 있어 일관성 없음 | `execution-engine.service.ts` — `propagateReachability` 메서드 | 그래프 빌드 시 `outgoingEdgeMap: Map<string, GraphEdge[]>` 사전 구축; 초기화 루프도 `nodesWithIncoming = new Set(...)` 활용으로 O(N+E) 개선 |
| 4 | 문서·유지보수 | **`memory/execution-engine-analysis.md`가 구 아키텍처를 "현재 방식"으로 기술** — 삭제된 `portRoutingSkipped` 블록의 라인 번호와 문제점이 현재 문제인 것처럼 기술되어 향후 컨텍스트 로딩 시 혼동 유발 | `memory/execution-engine-analysis.md` 전체 | `reachable` 기반 신규 아키텍처로 갱신, 핵심 라인 번호 업데이트 |
| 5 | 보안 | **LLM 간접 프롬프트 인젝션** — `inputField`(사용자 제어 데이터)가 LLM user 메시지에 직접 삽입; `jsonSchema` enum 제한으로 피해 범위는 제한적 | `text-classifier.handler.ts` — `systemPrompt` 구성, `execute()` | `inputField` 최대 길이 제한 추가; system/user 역할 경계 유지 |
| 6 | 보안 | **실행 재개/취소 메서드의 호출자 권한 검증 부재** — `continueExecution()` 등이 `executionId`만으로 재개·취소하며 서비스 계층에 소유자 검증 없음 | `execution-engine.service.ts` — `continueExecution`, `cancelWaitingExecution`, `continueButtonClick` 등 | 요청자 사용자 ID를 파라미터로 받아 검증하거나, 상위 레이어 검증을 명시적으로 문서화 |
| 7 | 보안 | **인라인 서브워크플로우 `nodeOutputCache` 격리 부재** — 서브워크플로우 노드가 부모 노드 출력에 키 충돌로 접근하거나 덮어쓸 수 있음 | `execution-engine.service.ts` — `executeInline` | 서브워크플로우 실행 시 격리된 `nodeOutputCache` 스코프 사용 |
| 8 | 보안 | **텍스트 분류기 폴백 `includes()` 모호 매칭** — JSON 파싱 실패 시 짧은 카테고리명(`"A"`, `"IT"`)에 의도치 않은 매칭 가능 | `text-classifier.handler.ts` — `catch` 블록 | 단어 경계 정규식 매칭 또는 폴백 제거 후 `fallback` 포트 사용 |
| 9 | 아키텍처 | **`ExecutionEngineService` God Class 심화** — 그래프 순회부터 AI 대화 관리까지 단일 서비스 담당 (~2100줄) | `execution-engine.service.ts` 전체 | 최소 실행 루프를 별도 클래스로 분리; 장기적으로 `GraphExecutor`, `BlockingInteractionManager`, `ExecutionEventEmitter` 등 책임 분리 |
| 10 | 테스팅 | **`executeInline` reachability 로직 독립 테스트 없음** — 새 테스트들이 모두 `runExecution` 경로만 검증 | `execution-engine.service.spec.ts` | 서브워크플로 인라인 실행 시 포트 라우팅 격리 동작 검증 테스트 추가 |
| 11 | 테스팅 | **fan-in(다중 incoming edge) 시나리오 미테스트** — 비활성화 노드 외 경로로도 도달 가능한 경우 reachability 동작 미검증 | `execution-engine.service.spec.ts` | 다중 incoming edge 노드의 reachability 동작 검증 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 | **`executeInline` 내 구 용어 잔존** (`"port-routing-skipped"`) | `execution-engine.service.ts` — `_selectedPort` strip 주석 | `"it would incorrectly block downstream nodes from being marked reachable"` 식으로 수정 |
| 2 | 문서 | **`propagateReachability` JSDoc에 disabled 노드 caller 책임 미명시** | `execution-engine.service.ts:2083–2109` | `"Note: disabled nodes must NOT call this method — caller responsibility"` 추가 |
| 3 | 문서 | **`reachable` 초기화 의도 주석 부재** ("루트 노드 = 시작점" 설명 없음) | `runExecution`, `executeInline` — reachable 초기화 블록 | `// Seed reachability with root nodes (no incoming forward-edges)` 주석 추가 |
| 4 | 아키텍처 | **blocking 인터랙션 → `propagateReachability` 암묵적 순서 의존성** | `execution-engine.service.ts:825–833`, `475–483` | 순서 의존성 assertion 추가 고려 |
| 5 | 유지보수 | **테스트 노드 객체 보일러플레이트 15회+ 중복** (`containerId: undefined as unknown as string` 등) | `execution-engine.service.spec.ts` | `makeNode(id, type, label, overrides?)` 팩토리 함수 정의 후 재사용 |
| 6 | 유지보수 | **`NodeHandler` 객체 생성 패턴 불일치** (기존: `beforeEach` 밖, 신규: `it` 내 inline 혼재) | `execution-engine.service.spec.ts` | describe 블록 scope 통일 |
| 7 | 테스팅 | **`NODE_SKIPPED` 이벤트 제거 회귀 테스트 없음** | `execution-engine.service.spec.ts` | `emitNodeEvent`가 unreachable 노드에 대해 호출 안 됨을 명시적 검증 |
| 8 | 테스팅 | **병렬 브랜치 테스트에서 Q 노드 입력 미검증** | `execution-engine.service.spec.ts` — `should isolate parallel branches` | Q 노드 입력 데이터 `toEqual` 검증 추가 |
| 9 | 테스팅 | **백-엣지 이후 reachability 재전파 명시적 검증 없음** (사이클 내 포트 라우터 케이스 미검증) | `execution-engine.service.spec.ts` — `Cyclic workflow execution` | 사이클 내 포트 라우터 포함 테스트 추가 |
| 10 | 테스팅 | **unreachable 노드의 `NodeExecution` 미생성 미검증** | `execution-engine.service.spec.ts` | `expect.not.toHaveBeenCalledWith`로 명시적 검증 추가 |
| 11 | 요구사항 | **`ManualTriggerHandler` 처리 불일치** (`executeInline`은 명시 분기, `runExecution`은 일반 경로) | `execution-engine.service.ts` | `ManualTriggerHandler` 반환값에 `_selectedPort` 미포함 보장 또는 `runExecution`도 명시 분리 |
| 12 | API | **`ValidationResult.errors` non-null assertion 제거 (긍정적 변경)** | `text-classifier.handler.spec.ts:65` | 해당 없음 (올바른 수정) |
| 13 | 동시성 | **`Promise.all` 병렬화 시 `executedNodes`/`nodeOutputCache` 경쟁 조건 잠재성** (현재는 안전) | `execution-engine.service.ts` — `executeInline` | 병렬 인라인 실행 추가 시 격리된 복사본 전달 설계 필요 |
| 14 | 범위 | **`text-classifier` 파일들의 순수 포맷팅 변경이 혼재** (reachability 변경과 무관) | `text-classifier.handler.ts`, `.spec.ts` | 별도 포맷팅 커밋으로 분리 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 프롬프트 인젝션, 권한 검증 부재, nodeOutputCache 격리 미흡 |
| maintainability | MEDIUM | 실행 루프 로직 중복, 테스트 보일러플레이트 중복, memory 파일 불일치 |
| architecture | MEDIUM | 실행 루프 중복, God Class 심화, 시간적 결합 |
| side_effect | MEDIUM | SKIPPED 이벤트/레코드 제거, memory 파일 미갱신 |
| testing | MEDIUM | SKIPPED 이벤트 회귀 테스트 부재, executeInline 독립 테스트 없음 |
| requirement | MEDIUM | SKIPPED 실행 이력 가시성 공백, ManualTrigger 처리 불일치 |
| performance | LOW | propagateReachability O(N×E) 선형 스캔, 초기화 루프 이중 탐색 |
| api_contract | LOW | NODE_SKIPPED 이벤트 계약 파괴 가능성 |
| database | LOW | unreachable 노드 SKIPPED 레코드 미생성 |
| dependency | LOW | reachable 초기화 로직 중복 |
| documentation | LOW | memory 파일 stale, 구 용어 잔존, JSDoc 미비 |
| scope | LOW | 무관한 포맷팅 변경 혼재, SKIPPED 이벤트 의도 불명 |
| concurrency | LOW | 현재 구조 안전; 병렬화 시 잠재 위험 존재 |

---

## 발견 없는 에이전트
없음 — 13개 에이전트 전원이 하나 이상의 발견사항을 보고함

---

## 권장 조치사항

1. **[즉시] SKIPPED 이벤트·레코드 처리 방침 결정** — unreachable 노드에 대해 `NODE_SKIPPED` WebSocket 이벤트와 `NodeExecution(SKIPPED)` DB 레코드를 복원할지, 의도적 제거인지 합의하고 코드 또는 스펙 문서에 반영
2. **[즉시] `memory/execution-engine-analysis.md` 갱신** — `reachable` 기반 신규 아키텍처와 핵심 파일·라인 번호로 업데이트
3. **[단기] 실행 루프 공통 로직 추출** — `buildInitialReachableSet`, `resetReachabilityRange`, `executeGraphLoop` 헬퍼 분리로 `runExecution`/`executeInline` 간 중복 제거
4. **[단기] `propagateReachability` 성능 개선** — `outgoingEdgeMap` 사전 구축으로 O(N×E) → O(N+E)
5. **[단기] 누락 테스트 추가** — `executeInline` 포트 라우팅 격리, fan-in 시나리오, 백-엣지 내 포트 라우터, SKIPPED 이벤트 미발행 회귀 테스트
6. **[단기] 텍스트 분류기 폴백 매칭 강화** — 단어 경계 정규식 또는 폴백 제거
7. **[중기] 권한 검증 레이어 명확화** — `continueExecution` 등의 소유자 검증 위치를 명시·검증
8. **[중기] `nodeOutputCache` 격리** — 인라인 서브워크플로우 실행 시 격리된 캐시 스코프 사용
9. **[장기] `ExecutionEngineService` God Class 분해** — 실행 루프 최소 분리 후 인터랙션 관리·이벤트 발행 책임 분리 검토