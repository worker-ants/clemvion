# 테스트(Testing) Review — M-7 ai-turn-executor 클러스터 (fix 반영 후 재검증, 2026-07-02 13:21:27)

## 리뷰 범위

이번 diff 는 직전 리뷰 세션(`review/code/2026/07/02/13_08_49`)에서 testing reviewer 가 지적한 두 WARNING(W-1/W-2 — `buildRetryState` 의 `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens` non-default 값 passthrough 미검증)에 대한 fix 커밋이다. 대상:

- `codebase/backend/src/modules/execution-engine/utils/to-record.ts` / `.spec.ts` — 변경 없음(직전 세션과 동일, 문서화 테스트 2건 유지)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `Record<string, unknown>` 단언을 `ResumeState`/`RetryState` 로 좁히는 production 코드(직전 세션과 동일)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` — **신규 회귀 테스트 1건 추가** (`carries resume-state allow-list fields into _retryState`)
- `review/code/**`, `review/consistency/**` — 리뷰 산출물(직전 세션 기록물), 코드 아님

## 발견사항

- **[INFO]** 신규 회귀 테스트가 W-1/W-2 갭을 정확히 해소
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts:213-238`
  - 상세: 새 테스트는 `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens` 4개 필드에 명시적 non-default 값(`[{ id: 'srv-1', tools: ['t'] }]`, `[{ id: 'kb-1' }]`, `{ toolCallId: 'call-1', formSchema: {} }`, `7`)을 채운 `state` 를 만들고, retryable error(`LLM_TIMEOUT`)로 `endMultiTurnConversation` 을 호출한 뒤 `result._retryState` 에 해당 값이 `toEqual`/`toBe` 로 그대로 보존되는지 검증한다. 이는 직전 리뷰가 "이 필드들은 항상 undefined→기본값 분기만 실행되고 값이 있을 때의 전달 경로는 미검증"이라 지적한 지점을 정확히 커버하며, `as` 단언 제거가 실제 데이터 흐름을 깨지 않았음을 확인하는 의미 있는 behavior-preserving 회귀 가드다.
  - 제안: 없음. 기존 테스트 스타일(설명 주석 + `expect` 나열)과 일관되고 의도(cast 제거 회귀 가드)가 테스트명·주석에 명확히 드러나 가독성도 양호하다.

- **[INFO]** `pendingFormToolCall` 의 "부재" 분기는 여전히 별도 케이스로 검증되지 않음 (기존 테스트로 이미 커버되는지 확인 필요)
  - 위치: `ai-turn-executor.ts` `buildRetryState` 의 `pendingFormToolCall` spread 로직(`...(pendingFormToolCall ? { pendingFormToolCall } : {})` 패턴, 직전 리뷰가 언급) vs 신규 테스트는 존재(present) 케이스만 다룸
  - 상세: 신규 테스트는 `pendingFormToolCall` 이 **존재할 때** `_retryState.pendingFormToolCall` 에 그대로 실리는지만 검증한다. `pendingFormToolCall` 이 `undefined` 일 때 `_retryState` 객체에 해당 키 자체가 생성되지 않는지(스프레드 조건부 분기)는 기존 `endState()` fixture 를 쓰는 다른 테스트들(`omits _retryState for non-retryable errors` 등)이 간접적으로 다루고 있을 가능성이 높지만, 이번 diff 만으로는 "키 부재" 회귀 가드가 명시적으로 존재하는지 확인되지 않는다.
  - 제안: 필수는 아님. 기존 `carries output.error + _retryState only for retryable errors` 류 테스트가 `pendingFormToolCall` undefined 상태에서 `_retryState` 에 해당 키가 없음을 이미 확인하고 있다면 조치 불필요. 그렇지 않다면 `expect(retryState).not.toHaveProperty('pendingFormToolCall')` 한 줄 추가로 존재/부재 대칭성을 완성할 수 있다.

- **[INFO]** `to-record.spec.ts`/`to-record.ts` 는 변경 없음 — 직전 세션 INFO(class 인스턴스·`Object.create(null)` 허용, `toRecord` 측 대칭 테스트 부재)가 그대로 유효
  - 위치: `to-record.spec.ts:39-47`, `:99-122`
  - 상세: 이번 fix 커밋은 `to-record.*` 를 건드리지 않았으므로 직전 리뷰의 INFO 항목(비차단, RESOLUTION.md 에서도 "조치 불필요"로 판단됨)이 그대로 유지된다. 회귀는 없다.
  - 제안: 없음(직전 판단 유지).

- **[INFO]** malformed-state 엣지 케이스(스키마 밖 타입의 `state`)는 여전히 문서화 테스트로 고정되지 않음 — pre-existing, 이번 fix 범위 밖
  - 위치: `ai-turn-executor.ts:2916-2927` (`const s = state as ResumeState`)
  - 상세: 직전 리뷰가 INFO 로 지적한 사항으로, `resume-state.schema.ts` 가 런타임 `parse`/`safeParse` 를 하지 않는다는 설계(§7.5 graceful-reset 보존, RESOLUTION.md 에서 "조치 불필요"로 명시)를 그대로 유지한다. 이번 diff 는 W-1/W-2 fix 에 집중된 test-only 변경이라 이 갭을 넓히거나 좁히지 않았다. Critical 아님, 이전과 동일하게 defer 대상.
  - 제안: 없음(범위 밖, 이전 판단 유지).

## Mock/격리/가독성 점검

- 신규 테스트는 mock 없이 `buildExecutor()` 헬퍼와 순수 입력 객체(`state`)만 사용해 `endMultiTurnConversation` 을 직접 호출한다 — 다른 테스트 상태에 의존하지 않고 완전히 독립적으로 실행 가능. `beforeEach`/공유 fixture 오염 없음.
- `endState()` 헬퍼에 필드를 스프레드로 덧붙이는 패턴(`{ ...endState(), totalThinkingTokens: 7, mcpServers, knowledgeBases, pendingFormToolCall }`)은 기존 테스트 스타일과 일치하며, 어떤 필드가 "새로 채워진 non-default 값"인지 한눈에 드러나 가독성이 좋다.
- `result._retryState as Record<string, unknown>` 캐스트는 테스트 코드 내 관용적 패턴(파일 전체에서 반복 사용)과 일치해 이질적이지 않다.

## 회귀 테스트 확인

- RESOLUTION.md 기록에 따르면 fix 적용 후 `ai-turn-executor.spec.ts` 23 tests PASS(신규 포함), production 코드 무변경(test-only diff). 이번 diff 범위(파일 3만 실제 코드 변경) 내에서 기존 테스트를 깨뜨릴 요소는 없다.

## 요약

직전 세션에서 테스트 리뷰어가 제기한 두 WARNING(non-default 값의 `_retryState` passthrough 미검증)이 `ai-turn-executor.spec.ts` 에 추가된 단일 회귀 테스트로 정확하고 적절하게 해소되었다. 새 테스트는 mock 없이 순수 함수 호출로 격리되어 있고, cast 제거의 핵심 리스크(스키마 타입으로 좁힌 뒤에도 값이 실제로 운반되는지)를 직접 검증하며, 명명·주석이 의도(M-7 cast 제거 회귀 가드)를 명확히 드러낸다. `pendingFormToolCall` 의 "부재 시 키 미생성" 대칭 케이스와 malformed-state 문서화 테스트는 여전히 갭으로 남아있으나 둘 다 이전 세션에서 이미 INFO/비차단으로 판단된 사안이고 이번 fix 의 목적(WARNING 해소)과 무관한 범위이므로 차단 사유가 아니다. `to-record.*` 는 변경이 없어 회귀 없음.

## 위험도
NONE
