# 아키텍처(Architecture) 리뷰

대상 커밋: `6faefe48` — refactor(ai-agent): M-1 3단계 — AiTurnExecutor 추출

---

## 발견사항

### [INFO] SOLID — 단일 책임 원칙(SRP): 분할 목표 달성, 잔여 복수 책임에 대한 의식적 트레이드오프
- 위치: `ai-turn-executor.ts` 전체 (2911줄)
- 상세: 핸들러(2999줄 → 219줄)의 god-class 분해는 성공했다. `AiTurnExecutor`는 single-turn/multi-turn 루프·tool 실행·출력 조립·ConversationThread push·RagAccumulator·retry state 생성을 한 클래스에서 담당한다. 이는 커밋 메시지가 "경계 결정"으로 명시한 의식적 트레이드오프다 — `executeSingleTurn`과 multi-turn 루프가 공유 헬퍼 셋(`buildTools`, `executeProviderToolBatch`, `buildConditionOutput`)을 사용하므로 부분 추출은 양방향 결합을 강제한다는 근거가 타당하다. 장기적으로 `AiTurnExecutor`가 M-2 이후 규모 성장을 계속한다면 `OutputBuilder`, `ToolOrchestrator` 등 추가 분리를 고려할 수 있으나, 현 단계에서 강제하면 득보다 실이 크다. INFO 수준.
- 제안: 현 상태 유지. 다음 god-class 임계(~3000줄) 근접 시 `buildConditionOutput` / `buildMultiTurnFinalOutput` 를 별도 `AiOutputBuilder` collaborator로 선제 추출 계획을 plan에 등록.

### [INFO] SOLID — 개방-폐쇄 원칙(OCP): AgentToolProvider 인터페이스로 tool 확장 가능
- 위치: `ai-turn-executor.ts` L459 (`AgentToolProvider`), `buildTools` 메서드
- 상세: 신규 tool provider 추가 시 `AgentToolProvider` 인터페이스를 구현하고 생성자에 주입하면 되므로 `executeProviderToolBatch`·`buildTools` 수정 없이 확장 가능하다. Strategy 패턴의 올바른 적용이다.
- 제안: 없음.

### [INFO] SOLID — 의존성 역전(DIP): 인라인 `import()` 타입 사용의 의도와 한계
- 위치: `ai-turn-executor.ts` L962–968 (`eventEmitter`, `conversationThreadService` 타입)
- 상세: 두 optional 의존성이 인라인 `import()` 타입으로 선언되어 `nodes/` → `modules/execution-engine/` 직접 top-level import를 회피한다. 순환 의존 방지 목적이 명확하고 핸들러와 동일 패턴이어서 일관성도 있다. 다만 이 패턴은 타입 레벨에서만 경계를 강제하며 실제 DI 컨테이너(NestJS)가 인터페이스가 아닌 구체 클래스를 주입한다. 타입 정의를 별도 인터페이스 파일로 분리하면 의존 방향이 더 명시적으로 드러나나, 현재 규모에서 강제는 오버엔지니어링이다. INFO 수준.
- 제안: 장기적으로 `ExecutionEventEmitter`, `ConversationThreadService`의 facade 인터페이스를 `nodes/` 경계에 두는 방안을 검토.

### [INFO] 결합도/응집도: `state: Record<string, unknown>` 의 비구조화 결합
- 위치: `ai-turn-executor.ts` `processMultiTurnMessage` (L2126~2882), `endMultiTurnConversation` (L2894~2933)
- 상세: resume state가 `Record<string, unknown>`로 넘어오고 내부에서 as-cast로 필드를 꺼낸다. 타입 안전성이 없어 필드 오타/누락이 런타임 에러로만 표면화된다. 이는 엔진의 직렬화/역직렬화 경계 설계 문제(state는 DB에 JSONB로 저장)이므로 executor 단독으로 해결하기 어렵다. 기존 핸들러와 동일 패턴이며 verbatim 이동 원칙에 따른 의식적 선택이다. 하지만 누적 turn 수가 늘어날수록 `state` 접근 필드가 분산되어 추적성이 떨어진다.
- 제안: `ResumeState` interface(또는 Zod schema)를 `ai-turn-executor.ts` 혹은 공용 타입 파일에 정의하고 진입부에서 parse-once해 내부 메서드에 typed 객체를 전달하면 타입 안전성이 크게 개선된다. M-1 완료 이후 점진 적용 권장.

### [WARNING] 레이어 책임: `AiTurnExecutor`가 env var(`process.env.AI_RETRY_STATE_TTL_MINUTES`)를 직접 읽음
- 위치: `ai-turn-executor.ts` L615–623 (`resolveRetryStateTtlMinutes`)
- 상세: `process.env` 직접 접근은 비즈니스 로직 레이어 내부에 인프라/설정 관심사가 혼입된 패턴이다(레이어 책임 위반). 테스트에서 환경변수를 mocking 해야 하며, NestJS 의 `ConfigService` 를 통한 주입 경로가 이미 있음에도 우회하고 있다. 현재 단위 테스트에서 이 분기를 커버하지 않는다(기본값에만 의존).
- 제안: `AiTurnExecutor` 생성자에 `retryStateTtlMinutes: number` 선택 인자를 추가하거나, `ConfigService`를 주입받아 사용하도록 변경. 최소한 `resolveRetryStateTtlMinutes`를 executor 외부(handler 혹은 NestJS 모듈 팩토리)에서 호출해 값을 주입하는 방식을 권장.

### [INFO] 디자인 패턴: Composition Root 패턴의 올바른 적용
- 위치: `ai-agent.handler.ts` (Handler가 Composition Root 역할)
- 상세: 핸들러가 세 collaborator(`AiConditionEvaluator`, `AiMemoryManager`, `AiTurnExecutor`)의 생성자를 호출하는 Composition Root이다. 의존성 그래프가 핸들러 한 곳에서 조립되어 명확하다. 1·2단계(#665, #668)와 동형 패턴으로 일관성도 유지된다.
- 제안: 없음.

### [INFO] 디자인 패턴: `RagAccumulatorGroup` wrapper — 이중 누적 불변식의 타입 강제
- 위치: `ai-turn-executor.ts` L907–922 (`RagAccumulatorGroup`)
- 상세: 노드 누적과 turn delta 두 accumulator를 단일 push 호출로 동기화하는 thin wrapper다. "두 accumulator가 항상 동기 상태"라는 불변식을 타입 레벨에서 강제하는 적절한 설계 선택이다.
- 제안: 없음.

### [INFO] 순환 의존성: 단방향 의존 확인됨
- 위치: `ai-turn-executor.ts` import 구조 전반
- 상세: executor → handler 역참조가 없음을 확인했다. executor는 handler 타입을 import하지 않는다. `nodes/` → `modules/llm`, `modules/websocket`, `shared/` 방향의 단방향 의존이다. `modules/execution-engine/` 향 import는 인라인 타입으로 제한되어 컴파일 타임 순환을 차단한다.
- 제안: 없음.

### [INFO] 추상화 수준: `processMultiTurnMessage` 메서드의 길이 (756줄)
- 위치: `ai-turn-executor.ts` L2126–2882
- 상세: 단일 메서드가 form_submitted/bypass 분기·memory 재주입·tool 루프·resume state 조립을 직렬로 처리한다. 추상화 수준 혼재가 있다(form JSON parse ~ 고수준 LLM 호출이 같은 depth에 존재). 그러나 이 복잡성은 multi-turn 상태 기계의 본질적 복잡성에서 비롯되며, 중간 상태를 헬퍼 메서드로 빼면 오히려 상태 흐름 파악이 어려워진다. verbatim 이동 원칙 하에서 수용 가능.
- 제안: 장기적으로 form 처리 단계(`pendingFormToolCall` 분기)와 tool loop를 별도 private 메서드로 추출해 가독성을 개선 가능. 기능 변경 없는 순수 리팩터링으로 후속 M-1 follow-up 시 처리 권장.

### [INFO] 모듈 경계: `capFormDataBytes`, `FORM_SUBMITTED_MAX_BYTES` export — 테스트 접근을 위한 공개
- 위치: `ai-turn-executor.ts` L694, L710
- 상세: `capFormDataBytes`는 순수 유틸리티 함수로 executor 내부 상태와 무관하다. 별도 `form-utils.ts` 혹은 `shared/` 유틸로 이동하면 모듈 경계가 더 명확해지나, 현 사용처가 executor 단독이므로 co-location 원칙에도 맞다.
- 제안: 향후 다른 노드/서비스에서 동일 cap 로직이 필요하면 `shared/` 추출. 현재는 현 위치 유지.

### [INFO] 확장성: multi-provider tool 병렬 실행 설계
- 위치: `ai-turn-executor.ts` L1278–1292 (`executeProviderToolBatch` 내 `Promise.all`)
- 상세: tool 호출이 `Promise.all`로 병렬화되어 있어 신규 provider 추가 시 자동으로 병렬 실행 혜택을 받는다. budget 초과분은 well-formed tool_result로 처리해 확장 시에도 LLM 페어링 요건을 만족한다.
- 제안: 없음.

---

## 요약

M-1 3단계 리팩터는 god-handler(2999줄)를 facade handler(219줄)와 단방향 collaborator `AiTurnExecutor`로 분해하는 목표를 명확히 달성했다. SOLID 원칙 중 SRP 개선이 핵심이며, 공유 헬퍼 셋으로 인한 경계 결정(전체 turn 실행 표면 일괄 이동)이 문서화된 트레이드오프로 정당화된다. 단방향 의존·Composition Root·Strategy 패턴이 일관되게 적용되어 순환 의존 위험이 없다. 주요 아키텍처 위험은 `process.env` 직접 접근(인프라 레이어 혼입, WARNING)과 `Record<string, unknown>` resume state 비구조화(타입 안전성 부재, INFO)이며, 전자는 후속 단계에서 수정을 권장한다. 전반적으로 god-handler 분할 완료 시점의 건전한 아키텍처 상태다.

---

## 위험도

LOW
