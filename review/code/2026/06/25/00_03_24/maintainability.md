# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `applySingleTurnMemoryInjection` 반환 타입 명시 누락
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `private async applySingleTurnMemoryInjection(args: { ... })` 시그니처
- 상세: `buildSingleTurnSystemPrompt`는 `: string`, `buildSingleTurnMessages`는 `: ChatMessage[]` 반환 타입이 명시되어 있으나, `applySingleTurnMemoryInjection`에는 반환 타입 annotation 이 없다. 세 메서드 중 가장 복잡한 메서드에만 타입이 생략되어 시그니처만 보고 반환 shape 를 파악할 수 없으며 일관성도 떨어진다.
- 제안: `Promise<{ messages: ChatMessage[]; finalSystemPrompt: string; memoryMeta: ... | undefined; singleTurnInjection: ... }>` 형태의 명시적 반환 타입 또는 별도 인터페이스(`SingleTurnMemoryInjectionResult`)를 추가한다.

### [INFO] `applySingleTurnMemoryInjection` args 타입 선언 내부에 `//` 라인 주석 혼입
- 위치: `applySingleTurnMemoryInjection` args 타입 블록 내 `// memoryStrategy 는 caller(executeSingleTurn) scope 에서 1회 resolve 해 전달한다 —` 주석
- 상세: TypeScript 인터페이스/타입 리터럴 필드 주석은 `/** ... */` JSDoc 이 관례이며 IDE 툴팁에 노출된다. `//` 주석이 타입 선언 블록 중간에 삽입되면 파라미터 목록을 한눈에 파악하기 어렵고, 동일 파일의 `buildSingleTurnSystemPrompt` / `buildSingleTurnMessages` JSDoc 스타일과도 불일치한다.
- 제안: 필드별 `/** ... */` JSDoc 으로 전환하거나, 해당 라인 주석을 메서드 JSDoc 본문으로 이동한다.

### [INFO] `buildSingleTurnMessages` 시그니처에 `config` 파라미터가 포함되나 본문에서 직접 사용되지 않음
- 위치: `buildSingleTurnMessages(context, config, finalSystemPrompt, userPrompt)` — 파라미터 `config: Record<string, unknown>`
- 상세: 메서드 본문은 `config`를 `this.buildAiNodeRefFromContext(context, config)` 호출에만 전달한다. 메서드 시그니처만 보면 `config` 전체가 왜 필요한지 즉시 파악되지 않아 caller 가 어떤 값을 넘겨야 하는지 판단하기 어렵다.
- 제안: 중기적으로 `nodeRef: NodeRef` 를 직접 수신하도록 시그니처를 좁히거나, 현재 behavior-preserving 범위를 유지할 경우 메서드 JSDoc 에 `config` 가 `nodeRef` 구성에만 사용됨을 명기한다.

### [INFO] 호출부(`executeSingleTurn`)에서 `memInjection` 결과를 4행 개별 재할당으로 처리
- 위치: `executeSingleTurn` 내 memInjection 결과 처리 블록
- 상세: `messages`, `finalSystemPrompt` 는 `let` 재할당 필요성 때문에 구조 분해가 바로 적용되지 않으나, `memoryMeta`·`singleTurnInjection` 도 `memInjection.x` 참조를 거쳐 새 `const` 로 선언된다. 4행 개별 재할당 블록은 반환 shape 가 변경될 때 누락 위험이 있다.
- 제안: `const { memoryMeta, singleTurnInjection } = memInjection;` 로 상수 2개를 구조 분해하고, `let` 변수 2개는 별도 재할당 2행으로 분리해 가독성을 높인다.

### [INFO] `maxToolCalls` 기본값 `10` 이 인라인 매직 넘버
- 위치: `executeSingleTurn` 내 `const maxToolCalls = (config.maxToolCalls as number) || 10;`
- 상세: 같은 파일에서 `DEFAULT_RETRY_STATE_TTL_MINUTES`, `MAX_RESUME_RAG_SOURCES`, `TOOL_RESULT_PREVIEW_CHARS` 는 모두 파일 상단 이름 붙은 상수로 추출되어 있다. `10` 만 인라인으로 남아 일관성이 떨어진다. 이번 diff 에서 이동된 기존 코드이므로 이번 PR 범위에서 수정하지 않아도 되나, 다음 리팩토링 기회에 처리할 만하다.
- 제안: `const DEFAULT_MAX_TOOL_CALLS = 10;` 을 파일 상단 상수 영역에 추가하고 관련 spec 섹션(§3.f-g 또는 §6.1 단계 단계 참조) 주석을 달아 의도를 명확히 한다.

## 요약

이번 변경은 ~545줄 god-method `executeSingleTurn` 의 setup 단계를 spec §6.1 단계 번호와 1:1 대응하는 private 메서드 3개(`buildSingleTurnSystemPrompt` / `buildSingleTurnMessages` / `applySingleTurnMemoryInjection`)로 추출한 behavior-preserving 리팩토링으로, 유지보수성을 명확히 개선한다. JSDoc 에 §6.1 단계 번호가 명기되어 spec 추적성이 우수하고, `executeSingleTurn` 호출부는 선형 흐름으로 각 setup 단계의 의도가 드러난다. 개선 기회는 `applySingleTurnMemoryInjection` 반환 타입 생략과 args 타입 내 `//` 주석 혼입으로, 세 추출 메서드 간 스타일 일관성을 낮추는 요인이다. 나머지(`maxToolCalls` 매직 넘버, `config` 파라미터 불투명성)는 기존 코드에서 이월된 이슈이며 이번 PR 에서 새롭게 도입한 문제는 아니다. Critical·Warning 해당 사항 없음.

## 위험도

LOW
