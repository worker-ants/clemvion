# 아키텍처(Architecture) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `handleSingleTurnConditionRoute`의 파라미터 객체가 17개 필드를 포함하며 인터페이스 분리(ISP) 경계를 넘고 있음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `handleSingleTurnConditionRoute` args 타입 (diff 라인 ~187-208)
  - 상세: 추출된 private 메서드가 caller(`executeSingleTurn`)의 거의 모든 accumulator를 통째로 전달받는 구조이다. 메서드 시그니처가 사실상 "caller 지역 스코프의 스냅샷"이 되어, 추상화 이전에 인라인으로 있던 코드와 정보 커플링이 동일하게 유지된다. 분리를 통해 얻는 모듈 경계 이득이 반감된다.
  - 제안: `ragAcc`/`turnRagAcc`를 묶는 `RagAccumulatorGroup`처럼, presentation 3종(`presentationPayloads`, `presentationCalls`, `presentationSchemaViolations`)과 LLM 진단 2종(`llmCalls`, `toolCallTraces`)도 각각 thin 집합 타입으로 묶어 파라미터 수를 줄일 것. 공통 패턴이 이미 `RagAccumulatorGroup`으로 선례가 있으므로 동일 접근이 적합하다.

### 발견사항 2
- **[WARNING]** `handleMultiTurnConditionRoute`와 `handleSingleTurnConditionRoute` 사이 동작 분기(condition `toolCallCount` 합산 여부)가 타입이 아닌 주석과 문서로만 구별됨
  - 위치: `recordSingleTurnNonProviderToolResults` JSDoc "single-turn 은 toolCallCount 미합산" vs `recordMultiTurnNonProviderToolResults` 내부 `toolCallCount++` (diff 라인 ~112-113, 534-535)
  - 상세: single-turn condition deferral은 `toolCallCount`를 증가시키지 않고, multi-turn은 증가시킨다. 두 메서드가 이름은 대칭이지만 동작이 다르다. 이를 보호하는 타입-레벨 메커니즘이 없어서 미래 수정자가 실수로 동기화할 위험이 있다. 개방-폐쇄 원칙(OCP) 측면에서 새 분기 추가 시 두 메서드를 모두 열어야 한다.
  - 제안: 단기적으로는 두 메서드 상단에 `// INVARIANT:` 주석으로 의도적 비대칭을 명시하는 것으로 충분하다. 장기적으로는 `ConditionCountPolicy: 'count' | 'no-count'` 같은 파라미터로 통합하거나, spec §3.f-g 동작을 Strategy 패턴으로 분리해 컴파일 시 강제할 수 있다.

### 발견사항 3
- **[INFO]** `MultiTurnMemoryMeta` 타입이 파일 내 두 위치에 중복 정의됨
  - 위치: diff 라인 ~65-75 (파일 중간부)와 전체 파일 컨텍스트 라인 ~1741-1755 (`export class AiTurnExecutor` 직전)
  - 상세: 타입 선언이 동일 파일에 두 번 나타난다. 이는 리팩토링 중 발생한 잔여 아티팩트로 보인다. TypeScript는 동일 스코프의 동명 타입을 오류로 처리하므로 컴파일 시 감지되겠지만 코드 가독성을 해친다.
  - 제안: 한 위치(클래스 외부, 파일 상단 또는 사용 위치에 가까운 단일 위치)만 남기고 중복을 제거해야 한다.

### 발견사항 4
- **[INFO]** `applyMultiTurnTurnMemory`가 `messages` 배열을 in-place 변이(`messages.length = 0; messages.push(...)`)하면서 `MultiTurnMemoryMeta`를 반환하는 이중 계약 구조
  - 위치: `applyMultiTurnTurnMemory` 내부 (diff 라인 ~823-836)
  - 상세: 단일 책임 원칙(SRP) 측면에서 메서드가 메모리 메타를 계산하는 동시에 caller의 배열을 물리 변이한다. JSDoc이 이를 명시하지만, 반환값(`MultiTurnMemoryMeta`)과 side-effect(`messages` 변이)의 이중 계약은 테스트에서 인자 참조를 잃을 위험이 있다. 동일 패턴이 `recordSingleTurnNonProviderToolResults`에서도 반복된다.
  - 제안: 불변 함수형 스타일 `(messages) => { newMessages, meta }`로 변경해 side-effect를 제거하거나, 적어도 메서드 시그니처에 `@mutates messages` 주석 컨벤션을 도입해 계약을 명확히 할 것. 현재 리팩토링의 behavior-preserving 목표를 고려할 때 후속 작업으로 분류 가능하다.

### 발견사항 5
- **[INFO]** `handleMultiTurnUserMessageEntry`가 `state` 객체(persistence 레이어)와 `messages` 배열(LLM 컨텍스트 레이어)을 동시에 변이 — 레이어 경계가 단일 메서드에서 혼재
  - 위치: `handleMultiTurnUserMessageEntry` (diff 라인 ~873-886)
  - 상세: 메서드가 `void`를 반환하면서 외부 변이로만 동작하는 구조는 레이어 책임이 불명확하다. `state`는 resume/persistence 레이어 데이터(`pendingFormToolCall` delete), `messages`는 LLM 컨텍스트 레이어 데이터인데 같은 메서드에서 동시에 변경된다.
  - 제안: 반환 타입을 `{ messagesToAdd: ChatMessage[]; clearPendingFormToolCall: boolean }` 형태로 변경해 caller가 상태 변이를 제어하도록 하면 레이어 분리가 명확해진다. 행동 보존 리팩토링 원칙상 후속 PR로 분류가 적합하다.

### 발견사항 6
- **[INFO]** `Record<string, unknown>` 타입이 `state`와 `config`에 반복적으로 사용되어 타입 안전성 없음 — 기존 `RawAiAgentMultiTurnConfig` 인터페이스가 활용되지 않음
  - 위치: `processMultiTurnMessage`, `handleMultiTurnUserMessageEntry`, `recordMultiTurnNonProviderToolResults` 등 전반
  - 상세: 이번 diff가 새로 도입한 문제가 아니라 기존 코드 패턴이나, 추출된 private 메서드들이 `state.rawConfig as Record<string, unknown> | undefined` 같은 이중 캐스팅을 수행하면서 타입 불안정 표면이 확대되었다. 파일 내에 `RawAiAgentMultiTurnConfig` 인터페이스가 이미 정의되어 있음에도 새 메서드들에 적용되지 않았다.
  - 제안: 추출된 private 메서드들의 `state` 파라미터를 점진적으로 typed interface로 교체하면 향후 메서드 추가 시 타입 안전성을 확보할 수 있다. 즉각 수정보다는 다음 리팩토링 클러스터 과제로 등록하는 것이 적합하다.

## 요약

이번 리팩토링은 `processMultiTurnMessage`(768→459라인)와 `executeSingleTurn`(545→395라인)에서 form entry 처리, 메모리 재주입, condition 라우팅, tool result 기록 등 명확한 관심사를 private 메서드로 분리하여 SRP를 의미있게 향상시켰다. LLM 컨텍스트 조립, 툴 루프, 출력 조립의 레이어 경계가 이전보다 명확해졌으며, 순환 의존성과 모듈 경계 침해는 발견되지 않았다. 주요 아키텍처 부채는 추출된 메서드들의 과대 파라미터 객체(ISP 경계 미달)와 single/multi-turn 간 의도적 비대칭이 타입으로 강제되지 않는 점이다. `MultiTurnMemoryMeta` 타입 중복 정의는 이번 리팩토링에서 생긴 즉시 정리가 필요한 결함이다. 나머지 발견사항은 behavior-preserving 리팩토링의 범위를 벗어나는 후속 개선이다.

## 위험도

LOW
