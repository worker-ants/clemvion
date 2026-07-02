# Side Effect Review — M-7 ai-turn-executor 클러스터 (resume-state 타입화)

## 발견사항

- **[INFO]** `endMultiTurnConversation` 파라미터 시그니처(공개 인터페이스)는 불변, 내부 지역 캐스팅만 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2915-2934` vs `codebase/backend/src/nodes/core/node-handler.interface.ts:378-379` (`state: Record<string, unknown>` 유지)
  - 상세: `ResumableNodeHandler.endMultiTurnConversation`의 공개 파라미터 타입은 여전히 `state: Record<string, unknown>`이며, `AiTurnOrchestrator.handleAiEndConversation`/`handleAiTurnError`(`ai-turn-orchestrator.service.ts:875`, `:934`)의 `resumeState: Record<string, unknown>` 호출부도 그대로다. `AiTurnExecutor.endMultiTurnConversation` 함수 본문에서만 `const s = state as ResumeState;`로 지역 타입 좁힘을 추가했다. 즉 호출자(엔진)에는 어떤 시그니처 변경도 전파되지 않는다.
  - 제안: 없음 — 의도한 대로 캡슐화됨.

- **[INFO]** `buildMultiTurnFinalOutput`/`buildRetryState`의 파라미터 타입 변경(`Record<string, unknown>` → `ResumeState`/`RetryState`)이 실제 호출자에 영향 없음
  - 위치: `ai-turn-executor.ts:3007`(`retryStateSource?: ResumeState`), `:3124-3136`(`buildRetryState(source: ResumeState, ...): RetryState`)
  - 상세: `buildMultiTurnFinalOutput`은 public 메서드지만 `retryStateSource`는 optional 파라미터다. 기존 유일한 non-executor 호출자인 `AiAgentHandler.buildMultiTurnFinalOutput`(`ai-agent.handler.ts:212-216`)은 `Parameters<AiTurnExecutor['buildMultiTurnFinalOutput']>`/`ReturnType<...>`으로 시그니처를 유도(`...args` 위임)하므로 타입 변경이 자동으로 전파되어 drift 위험이 없다. `buildRetryState`는 `private static`이라 외부 호출자가 없다. executor 자신의 `buildMultiTurnFinalOutput` 내부 호출부(`endMultiTurnConversation`에서 `s`를 넘기는 경로, `:2934` 인근)만 `ResumeState` 인자를 실제로 전달하고, `isLastTurn`(max_turns) 분기(`:2760`)는 이 인자를 아예 생략(undefined)해 타입 변경의 영향이 없다.
  - 제안: 없음.

- **[INFO]** `ResumeState`/`RetryState` 타입 좁힘은 컴파일 타임 전용, 런타임 동작 불변 (behavior-preserving 주장 검증됨)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:81-130` (`.partial().catchall(z.unknown())`)
  - 상세: `resumeStateSchema`/`retryStateSchema` 모두 `.partial()`(전 필드 optional) + `.catchall(z.unknown())`(임의 추가 키 허용)로, `parse`/`safeParse`가 코드 어디에서도 호출되지 않는다(리뷰 대상 diff 및 스키마 파일 전체 확인). 따라서 `state as ResumeState` 캐스팅은 malformed/부분 state 에 대한 실제 거부·coerce 를 일으키지 않고, 이전 `state.foo as X` 개별 단언과 동일하게 런타임에서 아무 검증 없이 통과한다. "의도치 않은 상태 변경"이나 새로운 예외 경로는 발견되지 않았다.
  - 제안: 없음.

- **[INFO]** `isRecord`/`toRecord` 순수 함수 로직 무변경 — 기존 3개 소비처(`telegram-client.ts`, `handler-output.adapter.ts`, `execution-engine.service.ts`) 모두 이번 diff 범위 밖
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts:186-193`
  - 상세: 이번 diff 는 `isRecord`/`toRecord` 구현 자체를 변경하지 않고 JSDoc·단위 테스트만 추가했다(파일 1·2). grep 결과 두 함수의 실제 소비처(`telegram-client.ts`, `handler-output.adapter.ts`, `execution-engine.service.ts`)는 이번 diff 대상 파일 목록에 없어 부작용 영향권 밖이다.
  - 제안: 없음.

- **[INFO]** `resolveRetryStateTtlMinutes()`(환경변수 읽기)·`Date.now()` 사용부는 diff 로 인한 변경 없음
  - 위치: `ai-turn-executor.ts:184`(정의), `:3137`(호출)
  - 상세: `buildRetryState` 내부에서 TTL 계산에 쓰이는 환경변수 읽기 함수와 `Date.now()`/`new Date(...).toISOString()` 호출은 diff 전후 동일한 위치·로직으로 유지된다. 이번 변경은 그 앞뒤의 필드 접근 방식(`as` 단언 제거)만 건드렸다.
  - 제안: 없음.

- **[INFO]** 신규 테스트(`ai-turn-executor.spec.ts`)는 순수 read-only 검증, 신규 mock/spy/전역 상태 변경 없음
  - 위치: `ai-turn-executor.spec.ts:213-238`
  - 상세: 추가된 테스트는 `buildExecutor()`로 생성한 인스턴스에 `endMultiTurnConversation`을 호출하고 반환값만 단언한다. 전역 mock 교체, module-level 상태 변경, 파일시스템/네트워크 호출은 없다. `to-record.spec.ts` 신규 테스트 역시 `isRecord`/`toRecord`를 순수 호출해 반환값만 검증한다.
  - 제안: 없음.

## 요약

diff 는 `Record<string, unknown>` 기반 `as` 단언들을 zod 파생 `ResumeState`/`RetryState` 타입으로 대체하는 순수 컴파일타임 리팩터로, 공개 인터페이스(`ResumableNodeHandler.endMultiTurnConversation`)의 파라미터 타입은 그대로이며 시그니처가 바뀐 `buildMultiTurnFinalOutput`/`buildRetryState`의 유일한 외부 호출자(`AiAgentHandler`)는 `Parameters`/`ReturnType` 유도로 자동 동기화되어 drift 위험이 없다. 관련 zod 스키마는 `.partial().catchall(z.unknown())`로 런타임 `parse`를 전혀 호출하지 않아 malformed state 에 대한 기존 permissive 동작이 그대로 보존되며, `isRecord`/`toRecord`는 로직 변경 없이 문서·테스트만 추가되고 실제 소비처(`telegram-client.ts` 등)는 diff 범위 밖이다. 환경변수 읽기·전역 상태·이벤트 발행·네트워크 호출 경로 어디에도 새로운 부작용이 발견되지 않았다.

## 위험도
NONE
