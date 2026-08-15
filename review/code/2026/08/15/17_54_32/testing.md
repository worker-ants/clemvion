# 테스트(Testing) 리뷰

## 검증 방법
- 프롬프트 diff 게이트 + `Read`/`Grep`으로 원본 소스(`execution-engine.service.ts`, `retry-turn.service.ts`, `execution-event-emitter.service.ts`, `terminal-error-payload.ts`)를 직접 열어 대조.
- `emitExecution` 직접 호출 잔존 여부를 리포지토리 전수 grep으로 확인(종결 3종 관련 호출부가 전부 `emitTerminalExecution`/`emitCancellationEvent` 경유로 전환됐는지).
- 관련 3개 spec 파일을 실제로 실행해 GREEN을 확인:
  - `execution-event-emitter.service.spec.ts` + `retry-turn.service.spec.ts` → 2 suites / 52 tests pass
  - `execution-engine.service.spec.ts` → 1 suite / 454 tests pass

## 발견사항

- **[WARNING]** `TerminalEventPayload` 판별 union의 핵심 가치("컴파일 타임에 필수 필드를 강제한다")를 고정하는 영구 회귀 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:31`(`TerminalEventPayload` 정의) 및 `plan/in-progress/eia-terminal-emit-facade.md:103`("판별력 — `cancelledBy` 제거 → TS2345, `durationMs` 제거 → TS2345")
  - 상세: plan 체크리스트는 "cancelledBy를 지우면 TS2345, durationMs를 지우면 TS2345"를 판별력 증거로 제시하지만, 이는 개발 중 수작업 확인으로 보이고 저장소에 `@ts-expect-error` 류의 영구 type-level 테스트로 박제되어 있지 않다(검색 결과 `TerminalEventPayload`를 참조하는 파일은 정의부 하나뿐). 이 union의 존재 이유가 "필드 하나를 빠뜨려도 아무도 못 잡는" 결함(#1170/#1171/#1172)의 재발 방지인데, 정작 그 판별력 자체는 어떤 테스트로도 지켜지지 않는다 — 예컨대 누군가 `cancelledBy`를 optional로 완화하거나 `error`를 `failed` variant에서 optional로 바꿔도 기존 unit 테스트(구체적인 payload를 넘기는 형태)는 전부 그대로 GREEN이다. `ts-jest`가 기본적으로 타입체크를 수행하므로 이런 회귀 테스트는 `pnpm test` 단계에서도 실효성이 있다.
  - 제안: `execution-event-emitter.service.spec.ts`에 최소 1개의 컴파일 타임 판별력 테스트를 추가한다(예: 각 variant에서 필수 필드를 하나씩 제거한 리터럴에 `// @ts-expect-error` 를 붙인 no-op 함수/변수 선언). 이러면 필드가 optional로 완화되는 순간 `@ts-expect-error`가 "불필요한 지시어"로 잡혀 타입체크가 실패한다.

- **[INFO]** `failed` variant의 `error: null` 경로가 emitter spec에서 검증되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts` (`describe('emitTerminalExecution — 종결 payload wire 형태'` 블록, `it('failed — error 객체를 그대로 싣는다 (§6.4)'` 테스트)
  - 상세: `TerminalEventPayload`의 `failed.error` 타입은 `TerminalErrorPayload | null`로 `null`을 명시적으로 허용한다(`toTerminalErrorPayload()`도 입력이 없으면 `null`을 반환한다, `codebase/backend/src/shared/utils/terminal-error-payload.ts:50`). 그런데 emitter spec의 `failed` 테스트는 항상 non-null 객체만 넘긴다. `wire.error = payload.error;`가 무조건 대입이라 `error: null`이 들어와도 키 자체는 유지되는(§6.4 "명시적 null" 요구와 부합) 동작이지만, 이 케이스를 직접 잠그는 테스트가 없어 향후 `if (payload.error)` 같은 조건부 대입으로 잘못 리팩터링돼도 잡히지 않는다.
  - 제안: `type: 'failed', error: null` 케이스를 하나 추가해 `wire`에 `error: null` 키가 유지됨을 (user-cancel 테스트처럼 `'error' in wire`로) 명시적으로 단언한다.

- **[INFO]** `retry-turn.service.spec.ts` 내 `TYPE_TO_EVENT` 매핑 상수가 파일 내 두 곳에 중복 정의됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` (라인 788 부근과 963 부근, 각각 다른 `describe` 블록 안의 지역 `const TYPE_TO_EVENT`)
  - 상세: 두 정의가 완전히 동일한 리터럴(`completed`/`failed`/`cancelled` → `ExecutionEventType.*`)이다. `ExecutionEventType`에 새 값이 추가되거나 매핑이 바뀌면 두 곳을 함께 갱신해야 하는데, 하나만 고치면 그 describe 블록의 단언만 조용히 stale해진다.
  - 제안: 파일 상단(모듈 스코프)으로 한 번만 선언해 공유하거나, 최소한 두 선언 옆에 "동기화 필요" 주석을 남긴다.

## 강점 (회귀 테스트 관점에서 특기할 점)
- `execution-engine.service.spec.ts`의 기존 테스트 다수(`finalizeFailedExecution`/`finalizeStalledExhausted`/`applyCancellation`/`finalizeCancelledExecution` 등)는 `eventEmitter.emitExecution`(내부 위임 지점)을 스파이하는 방식으로 짜여 있어, 이번 리팩터(호출부가 `emitExecution` 직접 호출 → `emitTerminalExecution`/`emitCancellationEvent` 경유로 변경)에도 **한 줄도 수정 없이** 그대로 GREEN이며 wire 계약을 계속 검증한다 — 실제 실행으로 454/454 pass 확인. 내부 구현이 아니라 안정적인 경계(websocket으로 나가기 직전 payload)를 테스트한 좋은 설계다.
- `execution-event-emitter.service.spec.ts`의 신규 4개 테스트는 판별 union의 세 variant + "user cancel은 error 키가 아예 없다"는 까다로운 부재-표현 케이스까지 `Object.keys(wire).sort()` + `'error' in wire`로 직접 검증한다 — `toHaveBeenCalledWith`가 `{error: undefined}`도 통과시키는 함정을 테스트 작성자가 주석으로 명시하고 회피했다(이 저장소가 과거 반복적으로 겪은 "제3상태에서 참"이 되는 vacuous assertion 패턴을 정확히 피함).
- `retry-turn.service.spec.ts`는 `failRetryExecution`의 cancelled 분기(이 PR이 `retry-turn-terminal-guard` #2를 흡수해 신규로 채운 `cancelledBy: 'user'`)를 정확 매칭(`toHaveBeenCalledWith(EXEC, {type:'cancelled', durationMs, cancelledBy:'user'})`)으로 고정했고, mock index 변경(`emitExecution(id, type, payload)`의 `payload`가 인덱스 2 → `emitTerminalExecution(id, payload)`의 `payload`가 인덱스 1)도 전 호출부에서 정확히 따라갔다(라인 1388 부근 `cancelCall![1]`로 갱신).
- 종결 3종(`EXECUTION_COMPLETED`/`FAILED`/`CANCELLED`) 직접 호출부가 저장소 전체에서 0곳(비-종결 이벤트인 `EXECUTION_STARTED`/`EXECUTION_MESSAGE`/`TOOL_CALL_*`/`EXECUTION_WAITING_FOR_INPUT`/`EXECUTION_RESUMED`/`USER_MESSAGE`/`AI_MESSAGE`만 `emitExecution` 직접 호출로 남음)임을 grep으로 재확인 — plan 문서의 "11곳 → 0곳" 주장과 실측이 일치한다.

## 요약
핵심 리팩터(종결 이벤트 판별 union 도입)의 wire-형태 회귀 테스트는 emitter 레벨에서 세밀하고(부재-vs-null 구분까지 포함), 두 호출부(`execution-engine.service.ts`/`retry-turn.service.ts`)의 기존 테스트는 안정적인 경계(내부 `emitExecution`/`websocketService.emitExecutionEvent`)를 스파이하고 있어 리팩터 자체로 인한 파손 없이 3개 spec 전부(52+454 tests) 그대로 GREEN임을 직접 실행으로 확인했다. 남은 갭은 경미하다 — union의 "판별력"(설계의 핵심 가치)을 지키는 영구 type-level 회귀 테스트가 없다는 점(WARNING), `failed.error: null` 케이스 미검증과 테스트 내 매핑 테이블 중복(둘 다 INFO) 정도다. Critical/Blocking 수준의 결함은 없다.

## 위험도
LOW
