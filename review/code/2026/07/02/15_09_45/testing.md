# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `turnDebugHistory`/`allPresentations` non-default 값 전달 회귀 가드 부재
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `endMultiTurnConversation` (구 `s.turnDebugHistory as unknown[] | undefined`, `s.allPresentations as PresentationPayload[] | undefined` → `resumeState.turnDebugHistory`/`resumeState.allPresentations`), `ai-turn-executor.spec.ts:320-403` `endMultiTurnConversation` 테스트 그룹
  - 상세: 같은 `describe('endMultiTurnConversation', ...)` 블록에 "M-7 cast 제거 회귀 가드"라는 명시적 테스트(`carries resume-state allow-list fields into _retryState`, 367번 줄)가 이미 존재하지만, 이 테스트는 `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens`만 검증하고 이번 diff 의 실제 캐스트 제거 대상인 `messages`/`turnDebugHistory`/`allPresentations`/`rawConfig`는 다루지 않는다. `endState()` 헬퍼(321번 줄)도 이 4개 필드를 전혀 채우지 않아, 4개 기존 테스트 모두 `?? []`/`undefined` fallback 경로만 지나간다. `z.custom<T>()`는 런타임 무검증이므로, 만약 향후 `buildMultiTurnFinalOutput` 시그니처나 `resumeState` 접근 로직이 실수로 깨져도(예: 배열이 아닌 객체가 들어와도) 이 스위트는 잡지 못한다.
  - 제안: `endState()`에 `turnDebugHistory: [{ turnIndex: 0, llmCalls: [], totalDurationMs: 1 }]`, `allPresentations: [{ ... }]`, `rawConfig: { foo: 'bar' }` 등 non-default 값을 채운 케이스를 추가하고, `buildMultiTurnFinalOutput` 결과(`meta.turnDebugHistory` 또는 `meta.allPresentations`, `output.result` 등 실제 노출 지점)에 그 값이 그대로 전달됐는지 단언한다. 기존 367번 줄 테스트와 동일한 패턴으로 확장하면 됨.

- **[WARNING]** `ai-turn-executor.ts` 상단부(2107번째 줄 부근 `resumeState = state as ResumeState` 도입 지점, `processMultiTurnMessage` 루프)의 `turnDebugHistory`/`allPresentations`/`ragSources` 실사용 경로에 값이 실제로 누적되는지 검증하는 단위 테스트 부재
  - 위치: `ai-turn-executor.ts` 약 2107-2181행 (`prevHistory = resumeState.turnDebugHistory || []`), 2284행 부근 (`resumeState.ragSources ?? []`), `ai-turn-executor.spec.ts:232-318` `processMultiTurnMessage` 그룹
  - 상세: `processMultiTurnMessage` 테스트에 쓰이는 `resumeState()` 헬퍼(233번 줄)는 `ragSources: []`만 포함하고 `turnDebugHistory`/`allPresentations`는 아예 키 자체가 없다. 즉 diff 로 캐스트가 제거된 두 필드는 "완전 부재" 시나리오로만 지나가며, 2턴째 이상 재개 시 "이전 turn 의 배열을 이어받아 누적"하는 핵심 로직(`[...prevHistory, {...}]`, `[...(resumeState.allPresentations ?? []), ...presentationPayloads]`)은 어떤 테스트도 실행하지 않는다. 이는 멀티턴 대화에서 가장 흔한 실제 시나리오(2번째 이상 재개 시 히스토리 누적)이므로 커버리지 갭이 크다.
  - 제안: `processMultiTurnMessage` 재개 케이스 중 하나에 `turnDebugHistory: [{ turnIndex: 0, ... }]`, `allPresentations: [{ type: 'table', ... }]`를 미리 채워 넣고, 결과의 `_resumeState.turnDebugHistory`/`.allPresentations` 길이가 누적(prepend 유지 + 신규 항목 append)되었는지 검증하는 테스트를 추가.

- **[INFO]** `resume-state.schema.spec.ts`에 `z.custom<T>()`의 "무검증" 계약 자체를 고정하는 테스트 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (diff 전체), `resume-state.schema.spec.ts`
  - 상세: 스키마 파일 주석(43-47행, 117-121행)에 "`z.array(z.custom<ChatMessage>())`는 배열 여부만 검사하고 원소는 미검증"이라는 강한 주장이 있다. 실제로 `messages: 'not-array'` → 거부, `messages: [1,2,3]`(원소가 ChatMessage shape 아님) → 통과됨을 직접 확인했다(zod 동작 재현 완료). 이 계약은 향후 zod 버전 업그레이드나 `z.custom` 대체 시 조용히 깨질 수 있는 미묘한 지점인데, 이를 고정하는 회귀 테스트(`resumeCheckpointSchema.safeParse({ messages: [1,2,3] }).success === true` 같은)가 스펙 파일에 없다.
  - 제안: `resume-state.schema.spec.ts`에 "messages 배열 원소는 검증하지 않는다(z.custom 계약)"는 명시적 테스트 한 줄 추가 권장. 크지 않은 리스크지만 이 스키마가 "런타임 미검증" semantics 를 의도적으로 유지한다는 것이 코드의 핵심 설계 의도이므로, 그 의도를 코드로 고정할 가치가 있음.

- **[INFO]** `z.custom<T>()` 도입이 순수 타입 레벨 변경이라 실질적으로 새 런타임 경로는 없음 — 회귀 리스크 낮음
  - 위치: 전체 diff
  - 상세: `messages`/`turnDebugHistory`/`allPresentations` 필드는 스키마상 `z.unknown()` → `z.custom<T>()`로 바뀌었을 뿐 런타임 검증 강도는 동일(둘 다 사실상 통과)하며, `ai-turn-executor.ts` 변경도 `as X` 캐스트를 `resumeState.field` 직접 읽기로 치환한 것으로 값 자체의 흐름(계산 로직)은 변경되지 않았다(behavior-preserving 리팩터링). 따라서 위 WARNING 들은 "새 버그를 만들었을 가능성"보다는 "기존에 암묵적으로 성립하던 불변식이 이제 타입 레벨에서 강제되므로, 이 불변식이 깨지는 미래 변경을 잡아줄 테스트가 없다"는 선제적 갭에 가깝다.
  - 제안: 없음(정보 제공).

## 요약

이번 diff 는 `resume-state.schema.ts`의 `z.unknown()` 필드를 `z.custom<T>()`로 sharpen 해 `ai-turn-executor.ts` 여러 지점의 `as ChatMessage[]`/`as PresentationPayload[]`/`as unknown[]` 도메인 캐스트를 제거하는 behavior-preserving 타입 정제 작업이며, 실제로 런타임 로직 변경은 없다. 같은 클러스터의 유사 변경(`endMultiTurnConversation`의 `mcpServers`/`knowledgeBases` 등)에 대해서는 이미 "M-7 cast 제거 회귀 가드" 테스트가 추가되어 좋은 선례를 보였으나, 이번 diff 의 실제 대상인 `messages`/`turnDebugHistory`/`allPresentations`/`rawConfig`(특히 `endMultiTurnConversation`과 `processMultiTurnMessage`)에는 동일한 패턴의 non-default 값 회귀 가드가 빠져 있다. 기존 테스트 헬퍼(`resumeState()`/`endState()`)들이 이 필드들을 아예 채우지 않아 fallback(`?? []`) 경로만 지나가는 구조적 공백이 반복되고 있다. 코드 자체는 변경 없이 안전하지만, 향후 이 경로를 만지는 회귀를 잡을 안전망이 약하므로 테스트 보강을 권장한다.

## 위험도

LOW
