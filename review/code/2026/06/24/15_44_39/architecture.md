# 아키텍처(Architecture) 리뷰

## 발견사항

### **[INFO]** Registry 패턴 추출 — park-entry/resume-turn 대칭 달성
- 위치: `park-entry-dispatch.ts` 전체, `execution-engine.service.ts` `parkEntryRegistry` getter + `dispatchParkEntry`
- 상세: M-4 리팩토링이 3개 사이트(runExecution/executeInline/runNodeDispatchLoop)에 중복돼 있던 form/buttons/ai if/else 분기를 `buildParkEntryRegistry` 순수 factory + ordered first-match-wins registry 로 일원화했다. resume 측 `ResumeTurnDispatch`(PR #507)와 인터페이스 shape이 대칭 — `kind`, `selects(sel)`, `handle(ctx)` 3-member 계약이 동일하다. 이는 개방-폐쇄 원칙(신규 blocking 노드 타입 추가 시 registry 항목 1줄 등록으로 완결)과 단일 책임(선택 로직 vs. escape control-flow 분리)을 잘 지킨다.
- 제안: 현재 상태 양호. 향후 `resume-turn-dispatch.ts` registry도 inline 에서 같은 factory 분리 패턴으로 통일하면 두 경로 모두 서비스 인스턴스 없이 단위 테스트 가능하게 된다(commit 메시지에 "resume 측은 registry 인라인이라 e2e 만 커버" 로 언급된 점을 개선 여지로 명시해 두면 좋다).

### **[INFO]** Dependency Inversion — `ParkEntryDispatchDeps` 인터페이스로 waitForX 추상화
- 위치: `park-entry-dispatch.ts` `ParkEntryDispatchDeps` 인터페이스, `execution-engine.service.ts` `parkEntryRegistry` getter
- 상세: factory `buildParkEntryRegistry(deps: ParkEntryDispatchDeps)` 는 구체 서비스(`FormInteractionService`, `ButtonInteractionService`, `AiTurnOrchestrator`)를 모르고 함수 시그니처만 받는다. 의존성 역전이 명확하게 적용됐다. `handleForm`/`handleButtons`/`handleAiConversation`의 시그니처가 모두 `(ctx: ParkEntryContext) => Promise<ProcessTurnResult>` 로 통일돼 인터페이스 분리도 충족한다.
- 제안: 현재 설계 적절.

### **[WARNING]** `dispatchParkEntry`의 반환 타입 `Promise<ProcessTurnResult>` — `undefined` 포함 계약 미명시
- 위치: `execution-engine.service.ts` 라인 198-211 (`dispatchParkEntry` 메서드 시그니처)
- 상세: 메서드 선언은 `Promise<ProcessTurnResult>` 이나 핸들러 미매칭 시 `undefined` 를 반환한다(`return handler ? handler.handle(ctx) : undefined`). `ProcessTurnResult` 가 `undefined` 를 포함하는 타입이면 문제없지만, 미래에 이 타입이 강화될 경우 호출 사이트 3곳(bare `return`, `ParkReleaseSignal` throw, `{parked:true}`)이 `undefined` 를 `PARK_RELEASED` 로 오인할 여지가 있다. 주석에 "매칭 없으면 undefined(추출 전 else-fallthrough 와 동일)" 라고 명시돼 있으나 타입 선언과 구현이 불일치 상태다.
- 제안: `ProcessTurnResult`가 `undefined`를 유니온으로 포함함을 타입 정의 파일에 명시적으로 문서화하거나, `dispatchParkEntry`의 반환 타입을 `Promise<ProcessTurnResult | undefined>` 로 명시해 "undefined = 매칭 없음" 계약을 타입 레벨에서 고정한다.

### **[INFO]** `forwardRef` 순환 DI — 설계 상 불가피하나 모듈 경계 비용 존재
- 위치: `execution-engine.service.ts` 생성자, `AiTurnOrchestrator`/`FormInteractionService`/`ButtonInteractionService` 주입부
- 상세: 세 서비스가 `ENGINE_DRIVER(=엔진)` 를 주입받으므로 `forwardRef`로 순환 DI를 해소한다. 이 구조는 C-1 리팩토링의 의도된 결과이고, M-4는 이 DI 구조를 그대로 유지하면서 park-entry dispatch만 추출했다. `forwardRef`는 NestJS의 모듈 초기화 순서 의존성을 숨기므로 런타임 오류 진단이 어렵고, 신규 서비스 추가 시 동일 패턴 반복 압박이 생긴다.
- 제안: 현재는 수용 가능한 수준. 장기적으로 `EngineDriver` 인터페이스(`engine-driver.interface.ts`)를 실제로 분리된 모듈(별도 NestJS module)로 격리해 forwardRef 없이 단방향 의존이 가능한지 검토 가치가 있다.

### **[INFO]** `ParkEntryContext.graphEdges` — 버튼 전용 필드의 컨텍스트 오염
- 위치: `park-entry-dispatch.ts` `ParkEntryContext` 인터페이스, 라인 1538-1539
- 상세: `graphEdges`는 buttons 핸들러만 사용하는 필드로, 인터페이스 주석에 "form/ai 는 무시" 라고 명시돼 있다. 인터페이스 분리 원칙(ISP) 관점에서 이상적이지 않다. 다만, `ParkEntryContext`가 단일 목적의 private dispatch 계약이고 실제 필드 수도 소수라 현시점 유지 비용은 낮다.
- 제안: 향후 park 대상 노드 타입이 늘어날 경우 `graphEdges` 같은 핸들러 전용 필드가 누적될 수 있다. 그 시점에 컨텍스트를 공통 base + 타입별 확장으로 분리하는 것을 고려한다(현재는 조기 최적화 회피가 더 합리적).

### **[INFO]** 선택 우선순위 hardwired 배열 순서 — 명시적이나 extensibility 제약
- 위치: `park-entry-dispatch.ts` `buildParkEntryRegistry` 함수, 라인 1561-1579
- 상세: form → buttons → ai 순서가 배열 리터럴 순서로 인코딩된다. 현재 3종류로 고정된 점에서 충분하지만, 향후 여러 팀이 독립적으로 핸들러를 등록하는 시나리오(예: 채널별 커스텀 blocking 타입)에서는 순서 충돌이 발생할 수 있다. `resume-turn-dispatch.ts`와 동일한 패턴이므로 기존 결정과 일관성은 있다.
- 제안: 현재 규모에서 적절. 향후 플러그인 방식으로 전환한다면 명시적 priority 필드(숫자 가중치)를 도입하고 factory 내부에서 정렬하는 방식을 고려한다.

---

## 요약

M-4 리팩토링은 park-entry 분기 3중복을 single `dispatchParkEntry` + ordered registry 로 제거해 resume-turn-dispatch와의 대칭 구조를 완성했다. SOLID 중 단일 책임(dispatch 선택 vs. escape control-flow)과 개방-폐쇄(registry 항목 추가로 확장)가 잘 적용됐으며, `ParkEntryDispatchDeps` 인터페이스를 통한 의존성 역전으로 factory가 구체 서비스에 무관하게 단위 테스트 가능한 구조다. `forwardRef` 순환 DI는 상위 C-1 설계의 inherited trade-off이며 이번 변경이 새로 도입한 것은 아니다. 주된 개선 여지는 `dispatchParkEntry` 반환 타입에서 `undefined` 가능성이 타입 선언 수준에서 명시되지 않은 점(WARNING)이며, `ParkEntryContext.graphEdges` 필드의 ISP 위반은 현 규모에서 허용 범위 내다. 전체적으로 아키텍처 품질이 향상됐고 확장성 구조가 올바르게 배치됐다.

## 위험도

LOW

STATUS: SUCCESS
