# 테스트(Testing) 리뷰 — M-7 ai-turn-executor 클러스터 (2026-07-02 13:08:49)

## 리뷰 범위

- `codebase/backend/src/modules/execution-engine/utils/to-record.ts` / `.spec.ts` (JSDoc caveat + 문서화 테스트 2건 추가)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `endMultiTurnConversation` / `buildMultiTurnFinalOutput` / `buildRetryState` 3메서드의 `as Record`/`as number`/`as unknown[]` 단언 제거, `ResumeState`/`RetryState` 명명 타입 도입 (behavior-preserving 표방)

commit `d089c211b` 은 production 코드(`ai-turn-executor.ts`)만 변경하고 대응 spec 파일(`ai-turn-executor.spec.ts`)은 **전혀 건드리지 않았다** (`git diff bb7c1b377 d089c211b -- ai-turn-executor.spec.ts` 결과 empty). 기존 테스트 31건은 그대로 통과하지만, 이는 "회귀 없음"을 보여줄 뿐 신규 타입 좁히기 경로 자체를 검증하지는 않는다.

## 발견사항

- **[WARNING]** `buildRetryState` 가 다루는 필드 대부분이 `_retryState` 출력 검증 테스트에서 커버되지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3124-3178` (`buildRetryState`), 대응 테스트 `ai-turn-executor.spec.ts:344-365` (`carries output.error + _retryState only for retryable errors`)
  - 상세: 이번 diff 는 `pendingFormToolCall`·`totalThinkingTokens`·`knowledgeBases`·`ragSources`·`mcpServers` 5곳의 `as` 단언을 제거하고 `ResumeState`/`RetryState` 스키마 타입에 위임했다. 그런데 `endMultiTurnConversation` 테스트의 `endState()` fixture(`ai-turn-executor.spec.ts:321-332`)는 `messages`/`turnCount`/`model`/`totalInputTokens`/`totalOutputTokens`/`toolCalls`/`ragSources` 만 채우고, `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens`는 전부 생략한다. 결과적으로 이 5개 필드는 항상 "undefined → `?? []`/`?? 0`/스프레드 생략" 분기만 실행되고, **값이 실제로 존재할 때 `_retryState`에 올바르게 실려 나가는지는 어떤 테스트도 확인하지 않는다**. `as` 단언 제거는 컴파일 타임 안전성 개선이지만, 런타임 데이터 흐름(특히 `source.mcpServers ?? []`처럼 값이 있는 경우의 통과 여부)은 별개 관심사이고 지금은 미검증이다.
  - 제안: `endState()`에 `mcpServers: ['mcp-1']`, `knowledgeBases: ['kb-1']`, `pendingFormToolCall: { toolCallId: 'x', formConfig: {} }`, `totalThinkingTokens: 7` 등 non-default 값을 채운 케이스를 추가하고, `result._retryState`에서 해당 필드들이 그대로 보존되는지(`toEqual`/`toBe`) 단언하는 테스트를 추가할 것. 특히 `pendingFormToolCall`은 "존재하면 스프레드, 없으면 키 자체 생략" 분기(`...(pendingFormToolCall ? { pendingFormToolCall } : {})`)라 존재/부재 두 케이스 모두 검증 가치가 있다.

- **[WARNING]** `isRecord`/`toRecord`가 실제로 대체한 호출부(`ai-turn-executor.ts`)에서의 통합 검증 부재
  - 위치: `to-record.spec.ts` 전체 (단위 테스트만 존재), `ai-turn-executor.ts`의 `ResumeState`/`RetryState` narrowing 경로
  - 상세: 이번 diff의 커밋 메시지(`d089c211b`)는 "resume-state.schema.ts 명명 타입을 ai-turn-executor.ts 에 처음 도입"이라 명시하지만, `to-record.ts`의 `isRecord`/`toRecord` 유틸이 `ai-turn-executor.ts`의 실제 호출부에서 쓰이는지 diff 상으로는 확인되지 않는다(`state as ResumeState` 캐스트만 사용, `toRecord()` 직접 호출 없음). 유틸 자체의 단위 테스트(class 인스턴스/`Object.create(null)` 케이스 추가)는 견고하지만, 이 커밋이 "M-7 클러스터"의 일부로 함께 리뷰되는 만큼 `to-record` 유틸이 이 파일에서 실제로 어디에 적용되는지, 적용 안 됐다면 왜 스키마 타입 캐스트(`as ResumeState`)만으로 충분한지 설명이 spec/커밋 메시지 수준에서만 있고 테스트로 뒷받침되지 않는다.
  - 제안: 만약 `to-record` 유틸이 이 파일에 아직 적용되지 않았다면(추후 클러스터 예정), 리뷰 대상 diff에서 두 변경을 분리하거나, 적용 예정 위치를 주석/PR 설명에 명시. 현재로선 테스트 관점에서 두 변경의 연결고리가 검증 불가능하다.

- **[INFO]** `endMultiTurnConversation`의 `s = state as ResumeState` 캐스트에 대한 "malformed state" 엣지 케이스 미검증
  - 위치: `ai-turn-executor.ts:2927` (`const s = state as ResumeState;`)
  - 상세: `resume-state.schema.ts`의 JSDoc은 "behavior-preserving — parse/safeParse 하지 않는다"고 명시한다. 즉 런타임에 `state`가 스키마에 맞지 않는 형태(예: `messages`가 배열이 아니거나, `turnCount`가 문자열인 malformed DB row)여도 그대로 통과해 다운스트림에서 조용히 오동작할 수 있다. `to-record.spec.ts`가 `isRecord`/`toRecord`에 대해 이런 malformed-value 케이스를 꼼꼼히 다루는 것과 대조적으로, `ai-turn-executor.spec.ts`에는 `endMultiTurnConversation`에 스키마 밖 형태(`turnCount: '3'` 같은)의 `state`를 넘겼을 때의 동작을 문서화하는 테스트가 없다. Critical은 아니다 — 원래 `as Record` 시절부터 동일하게 검증되지 않았던 부분이라 이번 diff가 새로 만든 갭은 아니지만, "타입화"라는 프레이밍이 독자에게 "이제 안전하다"는 인상을 줄 수 있어 명시적 회귀/문서화 테스트가 있으면 좋다.
  - 제안: 필수는 아니나, `resume-state.schema.ts`의 JSDoc 캐비트와 동일한 톤으로 `ai-turn-executor.spec.ts`에 "malformed state 도 그대로 통과(zod parse 없음)" 문서화 테스트 1건을 추가하면 이 설계 선택이 향후 리팩터에서 실수로 강한 검증으로 바뀌는 것을 막는 회귀 가드 역할을 한다.

- **[INFO]** `to-record.spec.ts` 신규 테스트 2건은 명확하고 의도가 잘 드러남
  - 위치: `to-record.spec.ts:39-47`
  - 상세: "class 인스턴스도 true — plain-object 가드 아님", "`Object.create(null)`도 true" 두 테스트는 각각 캐비트를 정확히 문서화하고 JSDoc과 1:1 대응한다. mock 없이 순수 함수 대상이라 격리·가독성 모두 우수하다. 별도 조치 불필요 (긍정 기록).

- **[INFO]** `toRecord`에 대한 class 인스턴스/`Object.create(null)` 대칭 테스트 부재
  - 위치: `to-record.spec.ts:99-122` (`describe('toRecord', ...)`)
  - 상세: `isRecord`에는 class 인스턴스·`Object.create(null)` 케이스가 추가됐지만, `toRecord`에는 대응하는 케이스(`toRecord(new Date())`가 원본 참조를 그대로 반환하는지 등)가 없다. `toRecord`는 `isRecord`를 그대로 위임하므로 로직상 자명하게 통과하겠지만, `isRecord`쪽에 이 caveat를 문서화 테스트로 고정한 취지라면 `toRecord`도 동일 caveat 적용 대상임을 한 줄로 확인해두면 향후 `toRecord` 구현이 바뀔 때(순수 plain-object로 강화되는 등) 회귀를 잡아준다.
  - 제안: 필수는 아님. `it('class 인스턴스는 (isRecord 를 통해) 원본 참조 그대로 반환', () => expect(toRecord(new Date())).toEqual(expect.any(Date)))` 정도 1건 추가 고려.

## 요약

`to-record.ts`/`.spec.ts` 변경은 JSDoc caveat 고정을 위한 문서화 테스트로 범위가 작고 격리·가독성 모두 양호하다. 반면 이 리뷰의 핵심인 `ai-turn-executor.ts`의 `ResumeState`/`RetryState` 타입화 리팩터는 production 코드만 수정하고 대응 스펙 파일을 전혀 갱신하지 않아, 기존 31건의 테스트가 여전히 통과한다는 사실이 "회귀 없음"의 근거는 되지만 "타입 좁히기가 실제 값 전달 경로를 올바르게 유지한다"는 근거는 되지 못한다. 특히 `buildRetryState`가 다루는 `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens` 필드는 커밋 메시지가 명시적으로 "단언 제거 대상"으로 지목했음에도 `_retryState` 출력에 non-default 값이 올바르게 실리는지 검증하는 테스트가 하나도 없다 — behavior-preserving 리팩터를 자처하는 변경에서 가장 중요한 회귀 가드가 빠진 것이므로 보강을 권한다. Critical 수준의 결함(테스트 실패·명백한 버그)은 발견되지 않았다.

## 위험도

MEDIUM
