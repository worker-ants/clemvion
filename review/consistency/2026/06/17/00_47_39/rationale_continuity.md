# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (구현 diff, scope=실행 엔진 engine-split)
검토 기준: 기존 spec Rationale 의 기각 결정·합의 원칙과의 정합성

---

## 발견사항

### [INFO] `WORKFLOW_EXECUTOR` DI 토큰 도입 — C-1 Rationale 의 "내부 통신 재사용 기각" 과의 관계 명료화 필요

- **target 위치**: `codebase/backend/src/nodes/core/workflow-executor.interface.ts` (신규 export `WORKFLOW_EXECUTOR` 상수) + `execution-engine.module.ts` (`useExisting: ExecutionEngineService` 바인딩)
- **과거 결정 출처**: `plan/in-progress/refactor/02-architecture.md` C-1 spec 대조 항 — "분리 서비스는 `WorkflowExecutor` 인터페이스 경유" 는 **재고 대상**: 그 인터페이스는 spec 상 engine↔**노드** 계약이라 엔진 내부 통신에 재사용하면 계약 의미가 과적됨"; 같은 파일 m-3 항 — "C-1 의 내부 통신과 달리 **여기는 그 계약의 정확한 용처**" (WorkflowExecutor 를 `NodeBootstrapService` 에서 DI token 으로 쓰는 것은 engine↔노드 계약의 정확한 사용).
- **상세**: 구현 diff 는 `WORKFLOW_EXECUTOR` 토큰을 `WorkflowExecutor` 인터페이스 파일에 추가하고, `NodeBootstrapService` 가 `handlerDeps.build(executor)` 에서 이 토큰을 주입받는다. 이는 m-3 에서 명시적으로 "권장 A" 로 결정된 경로이며, engine↔노드 계약(`WorkflowExecutor`)을 노드 핸들러 bootstrap 목적으로 사용하는 것은 Rationale 에서 기각된 "엔진 내부 통신 재사용(과적)" 케이스가 아니다. 충돌은 없으나, diff 의 코드 주석 — "옛 `handlerDeps.build(this)` 자기참조를 DI 경계로 대체" — 이 m-3 Rationale 의 맥락을 명시하고 있어 의도가 명확하다. 다만 spec 본문(4-execution-engine.md) 에는 이 bootstrap 책임 이전에 대한 언급이 없어, spec Rationale 갱신 없이 구현만 착지한 상태.
- **제안**: `spec/5-system/4-execution-engine.md` 의 §Rationale 에 "NodeBootstrapService 분리 (C-1 step1 m-3)" 항을 신설해 (a) `registerHandlers()`가 god-class 에서 분리된 결정 배경, (b) `WORKFLOW_EXECUTOR` DI 토큰이 engine↔노드 계약의 정확한 용처로 사용된다는 점(C-1 내부 통신 재사용 기각과의 구별), (c) `forwardRef(() => NodeHandlerDependenciesProvider)` 자기참조 제거 효과를 명시하면 차후 리뷰어가 C-1 옵션 B("엔진 내부 통신에 WorkflowExecutor 재사용")와 혼동하지 않는다. 현재는 plan 파일(m-3)에만 결정 근거가 있고 spec Rationale 에 부재.

---

### [INFO] `NodeBootstrapService` 를 `execution-engine` 모듈에 배치 — m-3 권장안(`nodes` 모듈 배치)과 다소 차이

- **target 위치**: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts` (execution-engine 모듈 하위 신설)
- **과거 결정 출처**: `plan/in-progress/refactor/02-architecture.md` m-3 개선 방안 항 2 — "nodes 모듈에 `NodeBootstrapService`(`OnModuleInit`) — bootstrap 호출 이관, deps 는 token 주입"
- **상세**: m-3 권장안은 `NodeBootstrapService` 를 `nodes` 모듈에 두는 것을 제안했으나, 구현은 `execution-engine` 모듈 하위에 두었다. 이는 기각된 대안의 재도입이 아니며, m-3 개선 방안이 모듈 배치를 규범적으로 확정한 것인지 여부가 불명확하다. spec 본문(`4-nodes/0-overview.md §1.0`)은 bootstrap 주체(`NodeComponentRegistry`)만 명시하고 호출 위치는 무언급이므로, 이 배치 선택은 구현 재량 범위다. 그러나 m-3 이 `nodes` 모듈을 명시한 의도는 `nodes→execution-engine` 의존 역전(레이어 위반) 해소였는데, execution-engine 모듈에 배치하면 `NodeBootstrapService` 가 `ALL_NODE_COMPONENTS`를 여전히 execution-engine 레이어에서 알아야 할 수 있다. diff 코드(`import { ALL_NODE_COMPONENTS } from '../../nodes'`)를 보면 execution-engine 레이어가 nodes 레이어를 여전히 import 하고 있으므로, m-3 의 "nodes 레이어 의존 역전" 해소 목표를 완전히 달성했는지 확인이 필요하다.
- **제안**: nodes 모듈 배치 vs execution-engine 모듈 배치의 최종 결정을 plan/in-progress/refactor/02-architecture.md m-3 에 반영하거나, `NodeBootstrapService` 의 위치와 레이어 의존 방향이 m-3 목표를 달성하는 이유를 코드 주석 이상으로 Rationale 에 남긴다. 레이어 의존 역전 해소가 m-3 의 핵심 목표였으므로, 달성 여부에 대한 명시적 판정이 spec 또는 plan 에 필요하다.

---

### [INFO] `nodes.module.ts` 의 `forwardRef` 제거 — spec §4.4 의 "forwardRef 는 안티패턴이 아님" 원칙과의 무관 확인 메모 필요

- **target 위치**: `codebase/backend/src/modules/nodes/nodes.module.ts` (`forwardRef(() => ExecutionEngineModule)` → `ExecutionEngineModule` 직접 import 로 교체)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §4.4` — "`ExecutionEngineService ↔ WebsocketService` 의 순환은 NestJS 표준 패턴인 `forwardRef(() => WebsocketService)` 로 해결. 이는 Nest 권장 패턴이며 **회피해야 할 안티패턴이 아님**"; `plan/in-progress/refactor/02-architecture.md` C-2 항 — "엔진↔WS forwardRef 유지가 spec 준수"
- **상세**: diff 가 제거한 `forwardRef` 는 `NodesModule ↔ ExecutionEngineModule` 순환이며, spec §4.4 가 보존을 명시한 `ExecutionEngineService ↔ WebsocketService` forwardRef 와 다른 쌍이다. diff 코드 주석도 "순환 아님(ExecutionEngineModule 은 NodesModule 을 import 하지 않으며, NodesModule 을 import 하는 건 AppModule 뿐)" 으로 이를 명시한다. 따라서 §4.4 Rationale 위반이 아니다. 다만 리뷰어가 "forwardRef 제거" 를 보고 §4.4 의 "forwardRef 는 안티패턴이 아님" 선언과 혼동할 가능성이 있으므로, 코드 주석의 설명이 이미 이를 해소하고 있어 실질 충돌은 없다.
- **제안**: 현 코드 주석 수준으로 충분. 추가 spec Rationale 갱신은 선택 사항.

---

## 요약

검토한 diff(engine-split: `NodeBootstrapService` 신설, `WORKFLOW_EXECUTOR` DI 토큰 도입, `forwardRef` 제거)는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하지 않는다. `WORKFLOW_EXECUTOR` 토큰의 도입은 plan/in-progress/refactor/02-architecture.md m-3 에서 "권장 A"로 결정된 경로와 일치하며, spec `4-nodes/0-overview.md §1.0` 의 bootstrap 계약(호출 위치는 구현 재량)을 따른다. `nodes.module.ts` 의 forwardRef 제거는 spec §4.4 가 보존을 명시한 `엔진↔WebsocketService` 쌍과 무관한 별도 쌍이다. 주요 보완 사항은 spec Rationale 부재 — `NodeBootstrapService` 분리 결정이 plan 파일(m-3)에만 있고 `spec/5-system/4-execution-engine.md` Rationale 에 미반영된 점이다. 이는 INFO 수준이며 차단 사항이 아니다.

## 위험도

LOW

---

STATUS: SUCCESS
