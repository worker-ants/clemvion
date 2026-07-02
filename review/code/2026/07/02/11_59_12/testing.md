# 테스트(Testing) 리뷰

대상: M-7 RESUME-STATE 클러스터 (`resume-state.schema.ts` 신설 + `ai-turn-orchestrator.service.ts` / `execution-engine.service.ts` / `retry-turn.service.ts` / `handler-output.adapter.ts` 의 `Record<string, unknown>` 단언을 `ResumeState`/`ResumeCheckpoint`/`RetryState` 타입 및 `isRecord` 가드로 치환)

## 발견사항

- **[WARNING]** `execution-engine.service.spec.ts` 의 builder↔schema drift 가드가 non-strict `safeParse` 를 사용해 실질적으로 credential 유입을 검출하지 못함
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5434`, `:5551` (+ `resume-state.schema.ts` 의 `resumeCheckpointSchema` 정의)
  - 상세: `resumeCheckpointSchema` 는 `z.object({...})` (기본 non-strict) 이며, Zod 의 기본 동작은 알 수 없는 키를 **에러 없이 조용히 strip** 한 뒤 `success: true` 를 반환한다. 실측: `resumeCheckpointSchema.safeParse({...base, workspaceId: 'ws-1', rawConfig: {secret:'shh'}})` → `success: true` (직접 재현 확인). 즉 `execution-engine.service.spec.ts` 의 "M-7 builder↔schema drift 가드" 주석이 달린 `expect(resumeCheckpointSchema.safeParse(checkpoint).success).toBe(true)` 단언은 실제 `buildResumeCheckpoint` 산출물에 `workspaceId`/`rawConfig` 등 credential/context-binding 필드가 미래에 실수로 섞여 들어와도 **항상 통과**한다. 해당 테스트가 실제로 drift 를 잡는 부분은 바로 다음 줄의 `for (const cred of CREDENTIAL_CONTEXT_FIELDS) expect(checkpoint).not.toHaveProperty(cred)` 뿐이며, `safeParse` 어서션 자체는 이 목적에서 실질적으로 무의미(항상-참에 가까움)하다. 반면 `resume-state.schema.spec.ts` 내부 유닛 테스트(`resumeCheckpointSchema.strict().safeParse(leaked).success` 를 `false` 로 기대)는 `.strict()` 를 명시적으로 적용해 올바르게 검증한다 — 즉 스키마 자체의 allow-list 정의는 파일 6에서 제대로 검증되지만, 파일 2(통합 테스트)의 "drift 가드" 라는 의도된 목적은 non-strict 사용으로 실제로는 달성되지 않는다.
  - 제안: `execution-engine.service.spec.ts` 두 곳 모두 `resumeCheckpointSchema.strict().safeParse(checkpoint).success` 로 바꾸거나, `safeParse` 자체를 credential 유입 검출 수단으로 홍보하는 주석을 제거하고 `.not.toHaveProperty` 어서션만 남긴다고 명확히 하는 것이 낫다. (스키마 파일의 JSDoc 은 `.strict()` 로 checkpoint drift 를 잡는다고 설명하므로 통합 테스트도 동일 강도로 맞추는 편이 일관적)

- **[INFO]** `resumeStateSchema`/`retryStateSchema` 는 `.catchall(z.unknown())` 로 정의돼 스키마 자체는 어떤 값도 통과시킴 — 이는 의도된 설계(§7.5 graceful-reset semantics 보존)이며 JSDoc 에도 명시돼 있어 문제는 아니나, 이 두 스키마의 “스키마로서의” 테스트 가치는 사실상 `.shape` 도큐먼트화(필드 존재/타입 확인)에 국한된다는 점을 리뷰어로서 확인. `resume-state.schema.spec.ts` 의 관련 테스트(“빈 객체 허용”, “credential 필드 허용”)는 이 제한된 가치에 맞게 적절히 스코프돼 있어 별도 조치 불필요.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:3091-3140`
  - 상세: 정보성 — 액션 불필요.

- **[INFO]** `ai-turn-orchestrator.service.ts` 의 타입 단언 변경(`Record<string, unknown>` → `ResumeState`/`ResumeCheckpoint`) 은 컴파일 타임 전용이며 런타임 분기(`resumeState.rawConfig`, `nextResumeState.model` 등 프로퍼티 접근)는 그대로 유지됨. 이 변경에 대해 별도 신규 유닛 테스트가 추가되지 않았으나, 기존 `ai-turn-orchestrator.service.ts` 를 구동하는 `execution-engine.service.spec.ts` 의 multi-turn 관련 테스트(waitForAiConversation / handleAiMessageTurn 경로)들이 회귀 스위트로 여전히 통과함을 확인(324 tests pass). 타입 단언만 변경되고 런타임 로직이 동일하므로 신규 단위 테스트 부재는 수용 가능.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:43-44`, `:756-757`
  - 상세: 정보성 — behavior-preserving 리팩터로 확인, 액션 불필요.

- **[INFO]** `handler-output.adapter.ts` 의 `isRecord` 치환에 대한 회귀 테스트는 이미 `handler-output.adapter.spec.ts` 에 존재(“ignores _resumeState arrays” 케이스, line 278-283)하여 배열 제외 동작이 리팩터 후에도 동일함을 커버함. 별도 추가 불필요.
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:270-283`

- **[INFO]** `retry-turn.service.ts` 의 `RetryState` 타입 도입은 `retryState.expiresAt`, `retryState.retryAfterSec` 접근부에 한정되며, 기존 `retry-turn.service` 관련 테스트(`execution-engine.service.spec.ts` 내 retry_last_turn 관련 스위트)가 그대로 통과. 타입 좁힘만 있고 런타임 검증/분기 변경 없음 — 신규 테스트 불필요 판단.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:2016`, `:2027`

## 커버리지/엣지 케이스 세부 확인

- `resume-state.schema.spec.ts` 는 3개 스키마(checkpoint/retry/state) 각각에 대해: well-formed 통과, optional 필드 유무, credential 필드 거부(`.strict()`), shape 자체에 credential 키 부재, IE 고유 필드 포함, TTL/replay 필드 분리(checkpoint ≠ retryState) 를 촘촘히 커버함. 엣지 케이스(빈 객체, catchall 알 수 없는 키 보존)도 포함돼 있어 신설 스키마 파일 자체의 테스트 밀도는 높음.
- `execution-engine.service.spec.ts` 의 두 drift 가드 테스트는 기존 checkpoint 관련 테스트 블록(대략 line 5429, 5547 부근 — ai_agent turn 및 information_extractor 후속 turn 각각)에 자연스럽게 삽입되어 테스트 격리(다른 테스트에 영향 없음)를 해치지 않음. 다만 위 WARNING 에서 지적한 대로 `safeParse` (non-strict) 사용은 실효성이 제한적.
- 실행 검증: `resume-state.schema.spec.ts`(17 tests), `handler-output.adapter.spec.ts`, `to-record.spec.ts` 를 포함한 관련 스위트 및 `execution-engine.service.spec.ts` 전체(324 tests) 모두 그린 상태를 직접 실행해 확인함.

## Mock / 격리/ 가독성

- Mock 사용은 기존 패턴(Repository/Queue/WebsocketService mock)을 그대로 재사용하며 이번 변경으로 새로 추가된 mock 은 없음 — 실제 동작과의 괴리 문제 없음.
- 테스트 가독성: `resume-state.schema.spec.ts` 는 `describe` 블록과 한글 주석으로 각 스키마의 존재 이유(I-5/I-8)를 명확히 표현하고 있어 의도 파악이 쉬움. `execution-engine.service.spec.ts` 에 삽입된 두 어서션도 "M-7 builder↔schema drift 가드" 주석으로 목적을 밝히고 있으나, 위 WARNING 대로 실제 동작이 주석의 기대(“drift 를 잡는다”)에 못 미쳐 주석과 실효성 사이 괴리가 있음.

## 요약

신설된 `resume-state.schema.ts` 자체에 대한 유닛 테스트(`resume-state.schema.spec.ts`)는 allow-list/라이프사이클 구분(checkpoint/retryState/resumeState)의 불변식을 `.strict()` 를 적절히 활용해 촘촘히 검증하고 있어 품질이 높다. 반면 `execution-engine.service.ts` 통합 테스트에 추가된 "builder↔schema drift 가드" 두 곳은 non-strict `safeParse` 를 사용해 스키마 자체의 credential 거부력을 실질적으로 활용하지 못하고, 실제 방어는 별도의 `not.toHaveProperty` 어서션에만 의존한다 — 테스트 이름/주석이 표방하는 "schema 기반 drift 감지"라는 의도가 구현과 어긋난 오탐성 안전망(false sense of coverage)이다. 이 외 4개 파일(`ai-turn-orchestrator`, `execution-engine.service.ts` 본체, `handler-output.adapter`, `retry-turn.service`)의 변경은 타입 단언 치환에 그치는 behavior-preserving 리팩터이며 기존 회귀 스위트가 그대로 통과함을 실행으로 확인했다. 전체적으로 심각한 회귀 위험은 없으나, drift 가드 테스트의 실효성 보강이 권장된다.

## 위험도

LOW
