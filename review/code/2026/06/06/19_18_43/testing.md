# Testing 리뷰 — exec-park B-1 follow-up (dispatchResumeTurn registry)

## 발견사항

### **[INFO]** 신규 `dispatchResumeTurn` 단위 테스트 7개 추가 — 핵심 라우팅 경로 커버
- 위치: `execution-engine.service.spec.ts` L10937~10221 (diff 기준)
- 상세: form/buttons/ai_conversation 라우팅·PARK_RELEASED 전파·우선순위(form > buttons)·미지원 throw·checkpoint 부재 throw 7가지 케이스를 망라. 기존 spec §7.5 의 계약 항목과 일대일로 대응하며 `as unknown as DispatchSubject` 패턴으로 private 메서드를 직접 spy 해 라우팅만 검증하는 설계는 적절하다.
- 제안: 현 상태 유지 — 추가 조치 불필요.

---

### **[WARNING]** `handleAiResumeTurn` 추출 메서드의 독립 단위 테스트 없음
- 위치: `execution-engine.service.ts` — 신규 `handleAiResumeTurn` (diff L1093~1132)
- 상세: `dispatchResumeTurn` 테스트의 ai 케이스 3개(라우팅 확인·PARK_RELEASED·checkpoint 부재)는 모두 `handleAiResumeTurn` 자체를 spy 로 대체하고 있어, 그 내부 로직—`buildRetryReentryState` 실패 시 `RESUME_INCOMPATIBLE_STATE` throw, `contextService.setNodeOutput` 호출로 `_resumeState` 주입—은 어떤 테스트도 직접 실행하지 않는다. 이전에 `driveResumeAwaited` 내 인라인이었을 때도 단위 테스트가 없었을 수 있지만, 추출 후 독립 메서드가 된 지금이 보완 적기다.
- 제안: `DispatchSubject` 확장 또는 별도 describe 블록에서 `handleAiResumeTurn`을 직접 spy 없이 호출하는 케이스 추가:
  1. `buildRetryReentryState` throw → `RESUME_INCOMPATIBLE_STATE` 에러 전파
  2. 정상 경로: `contextService.setNodeOutput` 호출 여부 + `processAiResumeTurn` 결과 전달

---

### **[WARNING]** `resumeTurnRegistry` lazy init 의 동일성(identity) 검증 미흡
- 위치: `execution-engine.service.ts` L1011~1050 (`private _resumeTurnRegistry?`, `get resumeTurnRegistry()`)
- 상세: lazy 초기화(`??=`)로 singleton 배열을 생성하는 구조다. 테스트가 service 인스턴스 재생성 없이 `_resumeTurnRegistry` 를 null 로 리셋할 방법이 없어, 다른 테스트에서 `resumeTurnRegistry` getter 에 접근한 후 registry 내부 처리기 클로저(`this` 바인딩)가 변질될 가능성이 있다. 특히 `jest.restoreAllMocks()` 가 spy 는 복원하지만 `_resumeTurnRegistry` 캐시는 그대로 유지한다. 현재 테스트는 `handlerRegistry.getMetadata` spy 로 메타데이터를 제어하고 spy 자체를 대체 처리기로 쓰므로 실질 문제가 없으나, 향후 registry 항목이 늘거나 순서 테스트가 추가될 때 상태 누수 위험이 존재한다.
- 제안: `dispatchResumeTurn` describe 블록의 `afterEach` 에 `(service as any)._resumeTurnRegistry = undefined;` 를 추가해 각 테스트마다 registry 를 강제 재구성하도록 명시.

---

### **[INFO]** `driveResumeFrame(isInnermost=true)` 에서의 `dispatchResumeTurn` 경로 — 중첩 통합 테스트 기존 커버 여부 확인 필요
- 위치: `execution-engine.service.ts` diff L2315~2338 (`driveResumeFrame` innermost 분기)
- 상세: diff 에서 `driveResumeFrame` 의 innermost 분기도 `dispatchResumeTurn` 으로 일원화됐다. 신규 테스트는 `dispatchResumeTurn` 의 직접 호출만 검증하며, `driveResumeFrame` → `dispatchResumeTurn` 경로를 통과하는 중첩 재개 통합 테스트가 spec.ts 의 기존 중첩 재개 describe 블록에 있는지 확인이 필요하다. 파일이 truncated 돼 확인 불가이나, 기존 중첩 테스트(`driveResumeFrame` 관련)가 이전 인라인 if/else 를 테스트한 것이라면 리팩터링 후에도 동일하게 통과해야 한다(회귀 보호 유지).
- 제안: CI 실행 결과로 확인. 만약 중첩 AI park → rehydration 경로의 통합 테스트가 없다면 추가 권장.

---

### **[INFO]** `process-turn-result.ts` 신규 공유 모듈 — 별도 단위 테스트 불필요하나 타입 계약 주석 완비
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts`
- 상세: `PARK_RELEASED` 는 Symbol, `ParkSignal` / `ProcessTurnResult` 는 type-level 추상화다. 런타임 로직 없음 — `Symbol('park_released')` 값 자체의 동일성은 import 가 동일 모듈 경로를 사용하는 한 보장되며 테스트 대상 아님. 두 park 채널(return-기반 vs throw-기반)을 JSDoc 으로 명확히 분리한 점은 이후 테스트 작성 시 mock 선택 기준으로 유용하다.
- 제안: 현 상태 유지.

---

### **[INFO]** `resume-turn-dispatch.ts` 인터페이스 파일 — 테스트 불필요
- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts`
- 상세: 순수 TypeScript interface/type 선언 파일이므로 런타임 로직 없음. 테스트 불필요.
- 제안: 현 상태 유지.

---

### **[INFO]** `makeCtx` 헬퍼의 `node` 필드 타입이 `Record<string, unknown>` — 실 `Node` 타입 불일치
- 위치: `execution-engine.service.spec.ts` L57~69 (`makeCtx` 정의)
- 상세: `dispatchResumeTurn` 의 `ctx.node` 는 `Node` 엔티티 타입(`Node` from entities)이나, `makeCtx` 에서 `node: { id: 'n1', type: 'form' }` 처럼 최소 stub 을 사용한다. `as unknown as DispatchSubject` 캐스팅 안에서 호출되므로 TypeScript 컴파일 에러는 없고, `dispatchResumeTurn` 이 `node.type` 과 `node.id` 만 사용하므로 실질 문제는 없다. 다만 `Node` 가 향후 필수 필드를 추가하거나 `dispatchResumeTurn` 이 `node` 의 다른 필드에 접근하기 시작하면 테스트가 런타임 에러 없이 조용히 틀린 동작을 하게 될 수 있다.
- 제안: 엄격성보다 간결성이 중요한 단위 테스트 맥락에서는 현 stub 수준이 적절. 다만 `Partial<Node>` 로 타입을 명시해 두면 타입 추론이 개선된다(`as never` 캐스팅 반복 줄임).

---

### **[INFO]** `flushResumeDrive(200ms)` 실시간 타이머 의존 — CI 환경 고부하 시 sporadic 위험
- 위치: `execution-engine.service.spec.ts` L316~318 (`flushResumeDrive` 정의)
- 상세: 신규 테스트(`dispatchResumeTurn` describe)는 직접 `flushResumeDrive` 를 사용하지 않아 이 문제와 무관하다. 단, 기존 테스트 코드의 주석(L313~314)이 "200ms 가 CI 고부하 시 충분한가"에 대한 우려를 이미 문서화하고 있다. 신규 테스트는 `jest.spyOn` 으로 비동기 경로를 완전히 제어하므로 타이머 의존 없음 — 올바른 설계.
- 제안: 현 상태 유지.

---

## 요약

이번 변경의 핵심인 `dispatchResumeTurn` 라우팅 registry 에 대해 7개의 단위 테스트가 추가됐으며, form/buttons/ai 우선순위·PARK_RELEASED 전파·미지원 throw·checkpoint 부재 throw 등 spec §7.5 의 주요 계약을 빠짐없이 검증하고 있다. spy-only 라우팅 검증 패턴은 처리기 내부와 dispatch 로직을 분리해 테스트 격리를 잘 유지한다. 다만 추출된 `handleAiResumeTurn` 의 내부 로직(buildRetryReentryState 실패 경로·setNodeOutput 주입)이 어떤 테스트도 직접 통과하지 않는 커버리지 갭이 Warning 수준으로 남아 있으며, lazy registry 캐시의 afterEach 리셋 부재가 향후 테스트 격리를 저해할 수 있다. 전체 변경은 기존 테스트 구조와 일관되고, 회귀 위험은 낮다.

## 위험도

LOW
