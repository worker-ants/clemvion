파일 쓰기 권한을 허용해 주시면 보고서를 저장하겠습니다. 그 전에 통합 보고서 내용을 먼저 보여드리겠습니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `portRoutingSkipped → reachable` 전환은 올바른 방향이나, unreachable 노드의 실행 이력·이벤트 누락 및 실행 루프 중복·보안 취약점 등 다수의 WARNING 이슈 존재

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API·DB·부작용·요구사항 | **SKIPPED 이벤트 및 NodeExecution 레코드 무음 제거** — 기존 방식은 건너뛴 노드에 `NODE_SKIPPED` WebSocket 이벤트와 `NodeExecution(SKIPPED)` DB 레코드를 생성했으나, 새 방식은 unreachable 노드를 `pointer++`로 조용히 처리. `isDisabled` 처리와 일관성 없음 | `execution-engine.service.ts` — `runExecution`, `executeInline` 내 unreachable 처리 블록 | disabled 노드와 동일하게 `createNodeExecution(…, SKIPPED)` + `emitNodeEvent(…, NODE_SKIPPED)` 복원; 또는 의도적 제거임을 스펙에 명시하고 관련 조회 로직 일괄 수정 |
| 2 | 유지보수·아키텍처 | **실행 루프 핵심 로직 중복** — `reachable` 초기화, while 루프, back-edge 처리, `propagateReachability` 호출 ~120줄이 `runExecution`과 `executeInline` 양쪽에 복사 | `execution-engine.service.ts` — `runExecution` (~726행), `executeInline` (~334행) | `executeGraphLoop(...)` private 공유 메서드로 추출; `buildInitialReachableSet`, `resetReachabilityRange` 헬퍼도 분리 |
| 3 | 성능·아키텍처 | **`propagateReachability` O(N×E) 선형 스캔** — `edges.filter((e) => e.sourceNodeId === nodeId)`가 노드 실행마다 호출. `backEdgeMap`은 이미 Map으로 최적화되어 있어 일관성 없음. 초기화 루프도 O(N×E) 이중 탐색 | `execution-engine.service.ts` — `propagateReachability` 메서드, `runExecution`·`executeInline` 초기화 블록 | `outgoingEdgeMap: Map<string, GraphEdge[]>` 사전 구축으로 O(N+E) 개선 |
| 4 | 문서·유지보수 | **`memory/execution-engine-analysis.md`가 구 아키텍처를 "현재 방식"으로 기술** — 삭제된 `portRoutingSkipped` 블록의 라인 번호와 해결된 버그가 현재 문제로 기술 | `memory/execution-engine-analysis.md` 전체 | `reachable` 기반 신규 아키텍처로 갱신 |
| 5 | 보안 | **LLM 프롬프트 인젝션** — `inputField`(사용자 제어 데이터)가 LLM user 메시지에 길이 제한 없이 직접 삽입 | `text-classifier.handler.ts` — `execute()` user 메시지 구성 | `validate()` 단계에서 최대 길이 제한(예: 10,000자) 강제 |
| 6 | 보안 | **텍스트 분류기 폴백 `includes()` 모호 매칭** — JSON 파싱 실패 시 짧은 카테고리명(`"A"`, `"IT"`)에 의도치 않은 매칭 발생 가능 | `text-classifier.handler.ts` — `catch` 블록 | 단어 경계 정규식(`\b${name}\b`) 매칭 또는 폴백 제거 후 `fallback` 포트 사용 |
| 7 | 보안 | **실행 재개/취소 메서드의 서비스 계층 인가 검증 부재** | `execution-engine.service.ts` — `continueExecution`, `cancelWaitingExecution` 등 | `userId`/`workspaceId` 파라미터 추가 후 검증 또는 상위 레이어 책임 명시 |
| 8 | 부작용 | **back-edge 점프 시 루프 범위 밖 노드의 stale reachability 잔존** — 이전 패스에서 추가된 `pointer` 이후 노드가 back-edge 리셋 시 해제되지 않음 | `execution-engine.service.ts` — `:493-497` (executeInline), `:843-848` (runExecution) | `pointer` 이후 노드도 초기화하거나 현재 한계를 주석으로 명시 |
| 9 | 아키텍처 | **`propagateReachability`와 블로킹 인터랙션 간 시간적 결합** — 순서 제약이 주석으로만 표현, 타입 시스템으로 강제되지 않음 | `execution-engine.service.ts` — `:825-833` (runExecution), `:475-483` (executeInline) | `waitForButtonInteraction` 내부에서 reachability 업데이트를 캡슐화 |
| 10 | 테스팅 | **`executeInline` reachability 로직 독립 테스트 없음** — 모든 신규 테스트가 `runExecution` 경로만 검증 | `execution-engine.service.spec.ts` | 서브워크플로우 통합 테스트 추가 |
| 11 | 테스팅·요구사항 | **fan-in 케이스(port1→X, port2→X) 테스트 누락** | `execution-engine.service.spec.ts` | fan-in 시나리오 테스트 케이스 추가 |
| 12 | 테스팅 | **unreachable 노드의 NodeExecution 레코드 미생성 및 NODE_SKIPPED 미발행을 명시적으로 검증하는 테스트 부재** | `execution-engine.service.spec.ts` — `Reachability-based execution` | `expect(mockNodeExecutionRepo.create).not.toHaveBeenCalledWith(...)` 등 검증 추가 |
| 13 | 테스팅 | **병렬 브랜치 테스트에서 Q 노드 입력 데이터 미검증** | `execution-engine.service.spec.ts` — `should isolate parallel branches` | `expect(calls[1][0]).toEqual(expect.objectContaining({ done: true, input: { branch: 2 } }))` 추가 |
| 14 | 문서 | **`propagateReachability` JSDoc에 disabled 노드 caller 책임 미명시** | `execution-engine.service.ts` — `propagateReachability` JSDoc | `Note: disabled nodes must NOT call this method — caller's responsibility` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 | **`executeInline` 내 구 용어 잔존** (`"port-routing-skipped"`) | `execution-engine.service.ts` — `_selectedPort` strip 주석 | `"it would incorrectly block downstream nodes from being marked reachable"` 식으로 수정 |
| 2 | 문서 | **`reachable` 초기화 의도 주석 부재** (루트 노드 = 시작점 설명 없음) | `runExecution`, `executeInline` — 초기화 블록 | `// Seed reachability with root nodes (no incoming forward-edges).` 주석 추가 |
| 3 | 문서 | **back-edge 재실행 범위 불변식 미문서화** | `execution-engine.service.ts` — back-edge 처리 블록 | 재전파 의도를 설명하는 주석 추가 |
| 4 | 보안 | **`nodeOutputCache` 공유로 서브워크플로우 데이터 격리 미흡** | `execution-engine.service.ts` — `executeInline` | `Object.create(parentCache)`로 격리된 캐시 전달 |
| 5 | 유지보수 | **테스트 노드 객체 보일러플레이트 15회+ 중복** | `execution-engine.service.spec.ts` | `makeNode(id, type, label, overrides?)` 팩토리 함수 추출 |
| 6 | 테스팅 | **백-엣지 + 포트 라우터 복합 시나리오 테스트 없음** | `execution-engine.service.spec.ts` — `Cyclic workflow execution` | 루프 내 포트 라우터 포함 시나리오 테스트 추가 |
| 7 | 아키텍처 | **`ExecutionEngineService` God Class 심화** (~2100줄) | `execution-engine.service.ts` 전체 | `executeGraphLoop` 추출 후 장기적으로 `GraphExecutor`, `BlockingInteractionManager` 분리 |
| 8 | 동시성 | **병렬화 시 `executedNodes`/`nodeOutputCache` 경쟁 조건 잠재성** (현재 순차 구조에서는 안전) | `execution-engine.service.ts` — `executeInline` | 병렬 인라인 실행 추가 시 격리된 복사본 전달 설계 필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 프롬프트 인젝션, 폴백 부분 문자열 취약점, 인가 검증 부재 |
| testing | MEDIUM | SKIPPED 행동 변화 미검증, executeInline 경로 테스트 부재, fan-in 누락 |
| maintainability | MEDIUM | 실행 루프 중복, memory 파일 불일치, O(N×E) 패턴 불일치 |
| architecture | MEDIUM | 실행 루프 중복, God Class 심화, 시간적 결합 |
| side_effect | MEDIUM | NODE_SKIPPED 이벤트/레코드 누락, stale reachability 잔존 |
| requirement | MEDIUM | SKIPPED 이력 가시성 공백, fan-in/executeInline 경로 미검증 |
| performance | LOW | O(N×E) 선형 스캔, 초기화 루프 이중 탐색 |
| api_contract | LOW | NODE_SKIPPED WebSocket 이벤트 계약 파괴 가능성 |
| database | LOW | unreachable 노드 SKIPPED 레코드 미생성 |
| dependency | LOW | 초기화·리셋 로직 중복으로 내부 유지보수 의존성 |
| documentation | LOW | memory 파일 stale, 구 용어 잔존, JSDoc 미비 |
| scope | LOW | text-classifier 무관 포맷팅 혼재 |
| concurrency | LOW | 현재 안전; 병렬화 시 잠재 위험 |

---

## 발견 없는 에이전트
없음 — 13개 에이전트 전원이 발견사항을 보고함

---

## 권장 조치사항

1. **[즉시] SKIPPED 이벤트·레코드 처리 방침 결정** — unreachable 노드에 대해 복원할지 의도적 제거인지 합의 후 코드/스펙 반영 (WARNING #1)
2. **[즉시] `memory/execution-engine-analysis.md` 갱신** — `reachable` 기반 아키텍처와 현행 라인 번호로 업데이트 (WARNING #4)
3. **[즉시] 누락 테스트 추가** — unreachable 행동 변화 명시 검증, `executeInline` 격리 테스트, fan-in 시나리오, Q 노드 입력 검증 (WARNING #10-13)
4. **[단기] 실행 루프 공통 로직 추출** — `executeGraphLoop`, `buildInitialReachableSet`, `resetReachabilityRange` (WARNING #2)
5. **[단기] `propagateReachability` 성능 개선** — `outgoingEdgeMap` 사전 구축으로 O(N+E) (WARNING #3)
6. **[단기] 텍스트 분류기 폴백 매칭 강화** — 단어 경계 정규식 또는 fallback 포트 (WARNING #6)
7. **[단기] 문서 정비** — 구 용어 수정, 초기화 주석, back-edge 불변식 주석, JSDoc caller 책임 (INFO #1-3, WARNING #14)
8. **[중기] 권한 검증 레이어 명확화** — `continueExecution` 등 소유자 검증 (WARNING #7)
9. **[중기] `nodeOutputCache` 격리** — `Object.create(parentCache)`로 서브워크플로우 격리 (INFO #4)
10. **[장기] `ExecutionEngineService` God Class 분해** — `executeGraphLoop` 추출 선행 후 책임 분리 (INFO #7)