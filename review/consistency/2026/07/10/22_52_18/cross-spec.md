# Cross-Spec 일관성 검토 — llm-usage-attr-hardening (impl-prep)

- MODE: `--impl-prep`
- base: `origin/main` @ `cc3dafa8c`
- target draft: 변경 (e) `ai-turn-executor.ts:2599` 타입 주석 1줄 + import, 변경 (g) `information-extractor.handler.spec.ts` 테스트 1개 추가
- SoT 참조: `spec/data-flow/7-llm-usage.md §1.3`, `spec/5-system/4-execution-engine.md §1.3`(불변식), `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`

## 검증 절차 요약

1. **(e) 타입 assignability** — `LlmCallContext` (`codebase/backend/src/modules/llm/llm.service.ts:41-45`) 의 필드는 `workflowId?: string | null`, `executionId?: string | null`, `nodeExecutionId?: string | null`. resume 사이트가 실제로 넘기는 값은 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2550`(`const executionId = state.executionId as string | undefined;`), `:2600`(`state.workflowId as string | undefined`), `:2602`(`state.nodeExecutionId as string | undefined`) — 세 필드 모두 `string | undefined`, `LlmCallContext` 필드 타입 `string | null | undefined` 의 서브셋이라 **assignable**. 필드명도 정확히 3개 일치(`workflowId`/`executionId`/`nodeExecutionId`), 오탈자·초과 필드 없음. `chat()` 시그니처(`llm.service.ts:154-159`)의 3번째 파라미터가 `context?: LlmCallContext` 이므로 위치도 일치. → 컴파일 실패 리스크 없음.
2. **(e) 근거 주장(excess-property-check 우회) 검증** — `ai-turn-executor.ts:1509-1526`(단발, `executeSingleTurn`)은 `chat()` 호출 인자 자리에 객체 리터럴을 **직접** 작성(fresh object literal as argument) → excess property check 적용. `ai-turn-executor.ts:2599-2614`(resume)은 동일 리터럴을 먼저 무주석 `const llmContext = {...}` 에 담은 뒤 `:2614`에서 변수로 전달 → TS 는 이 경로에서 excess property check 를 적용하지 않는다(구조적 타이핑만 검사). 이는 TypeScript 공식 동작(object literal 이 함수 인자/variable-with-type-annotation 에 "직접" 할당될 때만 엄격 검사, 무주석 `const` 를 거치면 우회)과 일치 — 코드 관찰로 재확인됨. draft 의 핵심 주장은 **사실**이며, `llmContext: LlmCallContext = {...}` 로 명시 주석을 붙이면 "타입 주석 있는 변수 선언에 직접 대입"에 해당해 다시 엄격 검사가 걸린다(TS 규칙). 부수 확인: `:2756`에서 동일 `llmContext` 변수(리터럴 아님)를 재사용하는 tool-loop 후속 호출 지점 — 주석 추가가 선언부에만 영향을 주고 이 재사용 지점의 타입/동작에는 영향 없음.
3. **(g) 루프 매 반복 attribution 전달 검증** — `information-extractor.handler.ts` `runTurnWithCollectionRetries` 의 `for (;;)` 루프(:1019-1038) 는 매 반복 `traceChat(...)` 호출의 마지막 인자로 `params.llmContext` 를 그대로 전달(:1037) — 고정 캡처이므로 2회차 이상 chat 호출도 동일 attribution 값을 받는다. resume 호출부(`processMultiTurnMessage`, :891-897)는 `state.executionId ? { executionId, workflowId, nodeExecutionId } : undefined` 로 **조건부**다. 기존 테스트 헬퍼 `retryState()`(:970-992)에는 `executionId` 필드가 없어 override 미지정 시 `llmContext` 는 `undefined` 로 평가됨 — draft 의 "신규 테스트는 세 필드를 명시 주입해야 한다"는 지적과 정확히 일치. 기존 attribution 회귀 테스트(:921-951)는 `mock.calls[0][2]`(1회차)만 단언 — draft 가 추가하려는 `mock.calls[1][2]`(2회차, collection-retry 로 유발된 2번째 chat) 단언은 현재 커버리지 갭이며, 대칭 선례 `ai-turn-executor.spec.ts:522`(tool-loop 2번째 chat, `mock.calls[1][2]`)도 확인됨.
4. **다른 spec 문서 staleness 점검** — `spec/data-flow/7-llm-usage.md:95,163,194,205`, `spec/5-system/4-execution-engine.md:171,1380,1382`, `spec/4-nodes/3-ai/1-ai-agent.md:720`, `spec/4-nodes/3-ai/3-information-extractor.md:378` 모두 "두 채널(조작 필드=node.config 재유도, 식별 필드=호출측 컨텍스트 재유도)" 동작을 이미 서술하고 있으며, 이는 코드가 이미 구현한 런타임 동작에 대한 서술이다. draft 변경은 이 동작을 바꾸지 않고(순수 타입 주석 + 테스트 추가) 오히려 §1.3 불변식("`CREDENTIAL_CONTEXT_FIELDS`/`resumeStateSchema` 리팩터 시 두 식별 필드 재주입 보존")을 컴파일 타임 가드(타입 체크)와 회귀 테스트(2회차 attribution 단언)로 강화하는 방향 — 문서와 모순되지 않으며 stale 화 되는 지점 없음.

## 발견사항

0건. Critical/Warning/Info 모두 없음.

- (e)/(g) 는 기존 §1.3 불변식·기존 회귀 테스트 선례와 완전히 정합하며, 코드 상 assignability·excess-property-check 비대칭·루프 내 매 반복 전달·resume 조건부 분기 등 draft 의 모든 사실 주장이 실제 코드로 확인됨.
- `spec/data-flow/7-llm-usage.md`, `spec/5-system/4-execution-engine.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md` 어느 것도 이번 변경으로 stale 해지지 않음(런타임 동작 무변경, 새 요구사항 ID 없음, 필드/엔드포인트/상태 머신/RBAC 무관).

## 요약

이번 draft 는 두 파일에 국한된 순수 타입 레벨 + 테스트 전용 변경으로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 충돌하지 않는다. `LlmCallContext` 필드 타입(`string | null` optional)과 resume 사이트가 실제로 공급하는 값의 타입(`string | undefined`)은 assignable 하여 컴파일 실패 우려가 없고, "excess-property check 는 fresh literal 을 직접 인자로 넘길 때만 적용되고 `const` 를 거치면 우회된다"는 draft 의 핵심 근거는 단발(:1522, 직접 리터럴)과 resume(:2599, 무주석 const 경유) 코드의 실제 비대칭으로 확인된다. 변경 (g) 의 전제(루프 매 반복 attribution 전달, resume 경로의 `executionId` 존재 여부에 따른 조건부 `undefined`, 기존 테스트가 1회차만 커버)도 코드로 검증됐다. `spec/5-system/4-execution-engine.md §1.3` 불변식·`spec/data-flow/7-llm-usage.md §1.3`·두 노드 spec 문서는 이번 변경으로 서술이 바뀌거나 stale 해지는 부분이 없으며, 오히려 이 변경은 그 불변식을 컴파일 타임/테스트 레벨에서 보강하는 방향이다.

## 위험도

NONE

STATUS: DONE
