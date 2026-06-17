# Maintainability Review — AiTurnOrchestrator + EngineDriver 추출 (C-1 step2)

## 발견사항

### [INFO] 서비스 파일 길이 (1,332줄) — 추출 후에도 여전히 대형 클래스
- 위치: `/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 전체
- 상세: god-class 분해를 목적으로 한 추출임에도 불구하고, `AiTurnOrchestrator` 자체가 1,332줄에 달한다. `emitAiWaitingForInput`(약 130줄), `handleAiMessageTurn`(약 250줄), `finalizeAiNode`(약 160줄) 등 개별 메서드도 각각 단일 책임 이상을 수행한다. 이 시점에서 하나의 추출 단계(`C-1 step2`)로 완전히 해소할 수는 없지만, 후속 단계 없이 여기서 멈추면 "작은 god-class"로 굳어질 위험이 있다.
- 제안: 현재 PR의 범위를 벗어나지만, `emitAiWaitingForInput` / `handleAiMessageTurn`은 각각 별도 private helper(예: `buildWaitingForInputPayload`, `persistTurnSnapshot`)로 분해하거나, 다음 C-1 step에서 추가 추출 대상으로 plan에 명시할 것을 권장한다.

### [WARNING] `handleAiMessageTurn` — 함수 길이 및 다중 책임
- 위치: `/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 약 L1597–L1882
- 상세: 단일 메서드가 (1) 핸들러 타입 검증, (2) user-message live signal emit, (3) LLM 호출, (4) 오류 처리 위임, (5) structured/flat cache 갱신, (6) NodeExecution DB persist, (7) AI_MESSAGE emit, (8) EXECUTION_WAITING_FOR_INPUT emit 등 8개의 서로 다른 관심사를 직렬로 처리한다. 이는 약 250줄에 달하며, 내부에서 `if (resultObj.status === 'waiting_for_input')` 블록이 약 200줄을 차지해 중첩도가 높아진다. 리뷰어나 유지보수자가 이 메서드의 단일 분기를 이해하기 위해서도 전체를 읽어야 한다.
- 제안: `waiting_for_input` 분기의 DB persist 로직을 `persistTurnSnapshot(nodeExec, adaptedNext, node)` 형태의 private 메서드로 추출하고, `AI_MESSAGE` + `EXECUTION_WAITING_FOR_INPUT` emit을 `emitTurnResponse(...)` helper로 묶는 것을 권장한다.

### [WARNING] `emitAiWaitingForInput` 내 IIFE(`(() => { ... })()`) 패턴 — 가독성 저해
- 위치: `ai-turn-orchestrator.service.ts` L1856–L1860
  ```
  conversationThread: (() => {
    const t = this.contextService.getContext(contextKey)?.conversationThread;
    return t ? cloneThread(t) : undefined;
  })(),
  ```
- 상세: 객체 리터럴 내 인라인 IIFE는 의도를 불분명하게 만든다. 코드 리뷰 및 향후 수정 시 이 패턴이 의도적인지(복잡한 로직) 또는 리팩터링 부산물인지 구분하기 어렵다. 또한 hot-path 객체 리터럴에서 스코프 생성 비용이 미미하게 발생한다.
- 제안: 인라인 직전 지역 변수로 추출할 것. `const conversationThreadSnapshot = cloneThread(this.contextService.getContext(contextKey)?.conversationThread ?? undefined);`

### [INFO] `as unknown as` 캐스팅의 광범위한 사용 — 타입 안전성 경계 불명확
- 위치: `ai-turn-orchestrator.service.spec.ts` 전반, `execution-engine.service.spec.ts` 수정 부분
- 상세: 테스트 코드에서 `private` 메서드에 접근하기 위해 `as unknown as { methodName: ... }` 패턴이 반복적으로 사용된다(예: `extractAiTurnErrorPayload`, `reparkAiResumeTurn` 테스트). 이는 TypeScript의 타입 시스템을 우회하며, 향후 메서드 시그니처 변경 시 테스트가 컴파일 오류 없이 조용히 틀려질 위험이 있다.
- 제안: `extractAiTurnErrorPayload`처럼 독립적으로 테스트해야 하는 순수 함수는 `public` 또는 `package-visible`(같은 모듈 내 re-export)로 노출하거나, 별도 utility 모듈로 분리하는 것을 고려할 것. 현재 PR에서 `static` 메서드로 구성된 것은 긍정적이나, private 접근을 위한 타입 캐스팅 반복은 유지보수 부채다.

### [INFO] 테스트에서 반복되는 `driveResumeTurn` helper 구조 — DRY 기회 존재
- 위치: `ai-turn-orchestrator.service.spec.ts` L282–L330, `execution-engine.service.spec.ts` (제거된 블록)
- 상세: `driveResumeTurn` helper가 spec 파일 이동 시 거의 동일한 형태로 `ai-turn-orchestrator.service.spec.ts`에 재구현됐다. 추출은 적절하지만, handler mock 구조(`processMultiTurnMessage` + `endMultiTurnConversation`)가 여러 describe 블록에서 유사하게 반복된다.
- 제안: `makeTestHandler({ multiTurnResult, endResult })` 형태의 팩토리 함수를 테스트 파일 상단에 정의해 공유할 것.

### [INFO] 인라인 타입 별칭의 반복 선언
- 위치: `ai-turn-orchestrator.service.spec.ts` L151–L157, L389–L393
  ```ts
  type ReparkSubject = {
    reparkAiResumeTurn: (...) => Promise<void>;
  };
  // ...
  type ExtractFn = (err: unknown) => { code: string; message: string; details?: unknown; };
  ```
- 상세: 각 describe 블록 내에서 지역적으로 선언된 타입 별칭들이 테스트 파일 전반에 흩어져 있다. 이는 `as unknown as` 캐스팅의 부산물로, 동일 타입을 참조하는 다른 테스트가 생길 때 중복 선언으로 이어질 수 있다.
- 제안: 파일 상단에 모아서 한 번만 정의하거나, 앞서 언급한 대로 해당 메서드를 public으로 노출해 타입 별칭 자체를 제거하는 것이 바람직하다.

### [INFO] `void _stripped` 패턴 — 의도 주석 없이 사용 시 혼란
- 위치: `ai-turn-orchestrator.service.ts` L1748, L979
- 상세: `void _stripped;`는 lint 경고(unused variable)를 억제하기 위한 관용구지만, 이 패턴이 익숙하지 않은 개발자에게는 의도가 불명확하다. 두 곳 모두 주석이 없다.
- 제안: 인라인 주석 추가. `void _stripped; // intentional no-op: suppress unused-var lint (already destructured above)`

### [INFO] `finalizeAiNode` — `isFailed` 분기 내 에러 메시지 추출 로직 중복
- 위치: `ai-turn-orchestrator.service.ts` L1210–L1218 및 L1241–1250
- 상세: `nodeExec.error.message` 또는 `output.error.message`에서 에러 문자열을 추출하는 로직이 같은 `finalizeAiNode` 메서드 안에서 두 번 등장하며 미묘하게 다른 변수명을 사용한다. 향후 에러 추출 로직 변경 시 두 곳을 모두 수정해야 한다.
- 제안: `extractErrorMessage(nodeExec: NodeExecution): string` private helper로 추출할 것.

### [INFO] `ENGINE_DRIVER` 토큰 — string literal vs Symbol
- 위치: `engine-driver.interface.ts` L2031
  ```ts
  export const ENGINE_DRIVER = 'ENGINE_DRIVER';
  ```
- 상세: NestJS에서 DI 토큰을 문자열 리터럴로 정의하면 다른 모듈에서 동일 문자열을 우연히 사용하는 경우 충돌 위험이 있다. 프로젝트 내 `WORKFLOW_EXECUTOR` 등 선례를 확인할 필요가 있으나, `Symbol('ENGINE_DRIVER')`가 더 안전하다.
- 제안: `export const ENGINE_DRIVER = Symbol('ENGINE_DRIVER');`로 변경하면 충돌을 원천 방지할 수 있다. 단, 기존 프로젝트 패턴과 일관성을 먼저 확인할 것.

### [INFO] `forwardRef` 순환 DI — 모듈 주석은 있으나 코드 레벨 힌트 부재
- 위치: `execution-engine.module.ts` L2088–2094, commit message 언급
- 상세: 커밋 메시지에 "엔진↔orchestrator forwardRef 순환 DI"가 언급되지만, 실제 모듈 코드에는 `forwardRef` 적용 증거가 보이지 않는다(diff에 `forwardRef` wrapper 없음). 순환 DI가 실제로 존재한다면 런타임에 `undefined` 주입 위험이 있고, 해소됐다면 커밋 메시지가 오해를 유발한다.
- 제안: 순환 DI 여부를 명확히 하고, 필요하다면 `forwardRef()` wrapper를 명시적으로 코드에 추가하고 주석으로 이유를 기록할 것. 해소됐다면 커밋 메시지/문서에서 제거할 것.

---

## 요약

이 변경은 ~1,250줄 규모의 AI 멀티턴 생명주기를 god-class `ExecutionEngineService`에서 `AiTurnOrchestrator`로 분리한 strangler-fig 단계로, 방향성은 올바르다. `EngineDriver` 인터페이스를 통한 DI 경계 설정, 테스트의 의도적 이동, 커밋 단위의 명확한 근거 등 유지보수성 관점에서 긍정적인 요소가 많다. 그러나 추출 후 단일 서비스 파일이 1,332줄에 달하고, `handleAiMessageTurn`이 약 250줄의 다중 책임 메서드로 남아 있어 "작은 god-class"로 전환된 양상이 있다. 테스트에서 `as unknown as` 캐스팅이 광범위하게 사용되어 private 메서드 변경 시 타입 안전망이 없는 점, `emitAiWaitingForInput` 내 인라인 IIFE와 에러 메시지 추출 로직의 중복은 즉시는 아니더라도 후속 단계에서 해소해야 할 유지보수 부채다.

## 위험도

LOW
