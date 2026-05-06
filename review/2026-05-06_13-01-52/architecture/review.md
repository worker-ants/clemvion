---

### 발견사항

---

#### **[WARNING] AiAgentHandler의 God Object — SRP 위반**
- **위치**: `ai-agent.handler.ts`, `AiAgentHandler` 클래스 전체
- **상세**: 단일 클래스가 다음 책임을 모두 수행한다: LLM 호출 오케스트레이션, 도구 분류(`classifyToolCalls`), WebSocket 텔레메트리 발행, RAG 누적/진단, 조건 라우팅, 출력 shape 생성(`buildMultiTurnFinalOutput`, `buildConditionOutput`), provider 생명주기 관리(`cleanupProviders`). 1,370줄 단일 파일에 복잡도가 집중되어 있다.
- **제안**: 도구 루프 실행 책임을 별도 `ToolLoopRunner` 또는 전략 패턴으로 분리하고, 출력 빌더를 별도 순수 함수 모듈로 추출하는 것을 고려한다.

---

#### **[WARNING] 도구 루프 로직 중복 — DRY 위반**
- **위치**: `executeSingleTurn` (lines 492–623) vs `processMultiTurnMessageInner` (lines 877–1010)
- **상세**: `classifyToolCalls` 호출, provider 도구 실행 for 루프, condition 도구 처리, normal 도구 stub 처리, LLM 재호출, `llmCalls` 기록이 두 메서드에 구조적으로 동일하게 반복된다. 변경 발생 시 두 곳을 동시에 수정해야 하며 한 곳만 수정될 위험이 있다.
- **제안**: `private async runToolLoop(params)` 메서드로 공통 루프를 추출하고, 두 메서드는 진입 설정만 다르게 호출하도록 리팩토링한다.

---

#### **[WARNING] `conditionToolCalls` 카운터 비대칭 — 동작 불일치**
- **위치**: `executeSingleTurn` line 575–585 vs `processMultiTurnMessageInner` line 966–975
- **상세**: 단일 턴에서 condition 도구 호출은 `toolCallCount`를 증가시키지 않는다. 반면 멀티 턴 resume에서는 `toolCallCount++`가 실행된다. 동일 로직의 두 복사본에서 카운터 의미가 다르게 처리되며, `maxToolCalls` 도달 조건에 영향을 미친다.
- **제안**: condition 도구가 `toolCallCount`에 포함되어야 하는지 명시적으로 결정하고, 루프 추출 시 단일 정책으로 통일한다.

---

#### **[WARNING] `ConditionDef` 타입 이중 정의 — 스키마 SSOT 위반**
- **위치**: `handler.ts` lines 91–95 (interface), `schema.ts` lines 71–93 (Zod schema)
- **상세**: 동일한 구조체가 TypeScript interface와 Zod schema로 각각 독립적으로 정의되어 있다. 두 정의가 diverge하면 런타임 동작과 타입 안전성 간 불일치가 생긴다. 핸들러는 `z.infer<typeof conditionDefSchema>`를 사용해야 할 위치에서 자체 정의 interface를 참조한다.
- **제안**: `handler.ts`의 `ConditionDef` interface를 제거하고 `schema.ts`에서 `export type ConditionDef = z.infer<typeof conditionDefSchema>`를 export하여 단일 SSOT를 유지한다.

---

#### **[WARNING] `_resumeState`의 `...state` 스프레드 — 불명확한 상태 경계**
- **위치**: `processMultiTurnMessageInner` line 1063
- **상세**: `_resumeState: { ...state, messages, turnCount, ... }` 패턴은 이전 state의 모든 알 수 없는 필드를 암묵적으로 전파한다. 이는 오래된/불필요한 필드가 조용히 누적되는 "state blob" 안티패턴으로, feature-out 처리된 `toolNodeIds`/`toolOverrides`가 state에 그대로 남아 전파되는 현재 상황이 이를 보여준다.
- **제안**: 상태 타입 interface를 명시적으로 정의하고, resume state를 구성할 때 필드를 명시적으로 나열한다.

---

#### **[WARNING] `buildMultiTurnFinalOutput` public / `buildConditionOutput` private — 비대칭 가시성**
- **위치**: `handler.ts` lines 1112, 1167
- **상세**: 두 메서드는 유사한 시그니처를 가지는데 한 쪽만 public이다. `buildMultiTurnFinalOutput`이 테스트에서 직접 호출되기 때문에 public으로 노출된 것으로 보이며, 이는 테스트가 내부 구현 세부 사항에 직접 결합되어 있다는 신호다.
- **제안**: 두 메서드를 private `buildOutput(...)` 하나로 통합하고, 테스트는 `execute`/`processMultiTurnMessage`의 공개 인터페이스를 통해 검증한다.

---

#### **[WARNING] WebSocket 서비스 직접 임포트 — 레이어 결합**
- **위치**: `handler.ts` lines 22–27
- **상세**: `AiAgentHandler`(도메인 로직 레이어)가 `WebsocketService`와 특정 이벤트 타입(`ExecutionEventType`, `ToolCallStartedPayload`)을 직접 임포트한다. 이는 비즈니스 로직 레이어가 인프라 레이어에 직접 의존하는 DIP 위반이다.
- **제안**: `interface AgentEventEmitter { emit(type: string, payload: unknown): void }` 형태의 추상 인터페이스를 도입하고, `WebsocketService`는 이 인터페이스를 구현하는 어댑터로 주입한다.

---

#### **[INFO] `aiAgentNodeOutputSchema` — 실제 출력 shape와 불일치**
- **위치**: `schema.ts` lines 386–426
- **상세**: 주석에 "FLAT output"이라고 명시되어 있으나 핸들러는 CONVENTIONS §8에 따라 `{ output: { result: { ... } }, meta: { ... } }` 중첩 구조를 반환한다. 자동완성 힌트로만 사용된다고 설명되어 있으나, 실제 출력 구조와 schema가 불일치하면 frontend 자동완성이 실제 경로를 잘못 안내할 수 있다.
- **제안**: output schema를 실제 핸들러 출력 구조(`output.result.response`, `output.result.messages` 등)로 갱신한다.

---

#### **[INFO] 테스트 state 객체 반복 — 테스트 유지보수성**
- **위치**: `handler.spec.ts`, `processMultiTurnMessage` describe 블록 내 다수 테스트
- **상세**: 동일한 형태의 state 객체가 8개 이상의 테스트에서 반복 선언된다. 공통 필드가 변경될 때 여러 곳을 수정해야 한다.
- **제안**: `makeResumeState(overrides?)` 팩토리 함수를 describe 블록 스코프에 정의하여 공유한다.

---

#### **[INFO] Feature-out 분기의 dead code 형태**
- **위치**: `handler.ts` `buildTools` lines 1315–1321
- **상세**: `toolNodeIds`와 `toolOverrides`를 로컬 빈 배열로 강제 초기화하고 아래 코드(`normalTools` 생성)는 항상 빈 배열을 반환한다. 코드가 "실행되지만 아무 효과 없는" 상태다.
- **제안**: feature-out 기간에는 `normalTools` 생성 블록 자체를 `[]`로 교체하여 의도를 더 명확히 한다. 복원 시 단일 지점만 수정하면 된다.

---

### 요약

`AiAgentHandler`는 LLM 오케스트레이션, 도구 분류, 텔레메트리, RAG 누적, 조건 라우팅, 출력 빌딩, provider 생명주기를 하나의 1,370줄 클래스에 집중시킨 God Object다. 가장 시급한 구조적 문제는 단일/멀티 턴 도구 루프의 ~120줄 중복으로, condition 도구 카운터 비대칭이라는 버그성 불일치를 이미 내포하고 있다. `ConditionDef` 타입이 schema와 handler 양쪽에 독립적으로 정의된 것은 향후 divergence 위험을 만들며, `...state` 스프레드를 통한 암묵적 상태 전파는 feature-out 필드가 조용히 남아있는 현 상황에서도 이미 문제를 보여준다. 테스트 커버리지 자체는 우수하나, 핸들러가 모든 메서드에서 `unknown`을 반환하여 테스트 코드 전반에 `as Record<string, unknown>` 캐스팅이 만연하고, `buildMultiTurnFinalOutput`이 public으로 노출된 것은 내부 구현이 테스트에 직접 결합된 신호다.

### 위험도

**MEDIUM**