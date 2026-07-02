# 요구사항(Requirement) Review — M-7 ai-turn-executor 클러스터 (2차, W-1/W-2 fix 포함)

대상: `to-record.ts`/`to-record.spec.ts`(JSDoc + 문서화 테스트), `ai-turn-executor.ts`(`ResumeState`/`RetryState` 타입화), `ai-turn-executor.spec.ts`(신규 회귀 테스트), `review/code/2026/07/02/13_08_49/{RESOLUTION,SUMMARY,...}.md`(이전 리뷰 세션 산출물).

## 발견사항

- **[INFO]** `isRecord`/`toRecord` JSDoc 캐비엇과 신규 유닛 테스트가 실제 구현과 line-level 로 정확히 일치
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts:154-155` (`typeof value === 'object' && value !== null && !Array.isArray(value)`), `to-record.spec.ts:40-48`
  - 상세: JSDoc 이 명시한 "class 인스턴스(`Date`/`Map`/`RegExp`)도 true", "`Object.create(null)`도 true" 주장을 테스트가 정확히 검증한다. 실행 결과도 확인(`jest to-record.spec.ts` PASS, 9/9 in file combined with isRecord/toRecord describes). 함수명·주석·구현·테스트 간 괴리 없음.
  - 제안: 없음.

- **[INFO]** `endMultiTurnConversation`/`buildMultiTurnFinalOutput`/`buildRetryState` 의 `ResumeState`/`RetryState` 타입 전환이 spec §7.9·§4.2.1·§7.4 와 line-level 로 합치
  - 위치: `ai-turn-executor.ts:2915-2960`(`endMultiTurnConversation`), `:3124-3179`(`buildRetryState`)
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 는 `_retryState` shape 을 "§7.4 `_resumeState` 의 부분집합 + `expiresAt`"으로, `spec/conventions/node-output.md` §4.2.1 은 "`_resumeState` 동일 shape(messages/turnCount/model/.../pendingFormToolCall?) + `expiresAt` + `lastUserMessage?` + `lastUserMessageSource?`, credential 미포함"으로 규정한다. `buildRetryState` 반환 객체(`messages`, `turnCount`, `totalInputTokens`, `totalOutputTokens`, `totalThinkingTokens`, `toolCalls`, `model`, `temperature`, `maxTokens`, `knowledgeBases`, `ragTopK`, `ragThreshold`, `ragSources`, `mcpServers`, 조건부 `pendingFormToolCall`, 조건부 `lastUserMessage`/`lastUserMessageSource`, `expiresAt`)와 `credential`/`context-binding` 필드(`llmConfigId`, `workspaceId`, `executionId`, `presentationTools`, `conditions`, `maxTurns`) 의도적 미동봉이 정확히 일치한다. `ResumeState`/`RetryState` 타입 전환은 `as` 단언 제거일 뿐 allow-list 자체나 값 흐름은 변경하지 않음(behavior-preserving) — 새 회귀 테스트(`ai-turn-executor.spec.ts:367-392`)가 `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens` non-default passthrough 를 실측 검증(PASS 확인, `npx jest ai-turn-executor.spec.ts` 32 tests 전체 통과).
  - 제안: 없음.

- **[INFO]** 신규 회귀 테스트의 `pendingFormToolCall` mock 값이 실제 런타임 shape(`{toolCallId, formConfig}`)과 다른 필드명(`formSchema`) 사용 — 기능 결함은 아니나 테스트 fixture 의 오도 소지
  - 위치: `ai-turn-executor.spec.ts:374` (`const pendingFormToolCall = { toolCallId: 'call-1', formSchema: {} };`)
  - 상세: spec(`spec/4-nodes/3-ai/1-ai-agent.md` §7.4 표 "`_resumeState.pendingFormToolCall`" 행)과 코드 전체(`ai-turn-executor.ts:884, 908, 2312-2313, 2480, 2896`, `spec.ts:520`)는 일관되게 `{ toolCallId: string, formConfig: Record<string, unknown> }` 를 사용한다. 이번 신규 테스트만 `formSchema` 라는 다른 키를 쓴다. `RetryState.pendingFormToolCall` 이 `z.record(z.string(), z.unknown()).optional()` (open record, `resume-state.schema.ts:60`)이라 타입 체크는 통과하고, `buildRetryState` 로직도 값을 그대로 스프레드(`...(pendingFormToolCall ? { pendingFormToolCall } : {})`, `ai-turn-executor.ts:3164`)하므로 테스트는 의도한 "임의 객체가 그대로 통과하는가"를 검증하는 데는 문제없이 PASS 한다. 다만 이 테스트가 "실제 운영 시나리오"를 흉내 내는 것처럼 보이는 이름(`pendingFormToolCall`)과 실제 shape(`formConfig`)의 불일치는, 이 테스트만 보고 shape 을 학습하는 후속 개발자에게 오도된 필드명을 각인시킬 위험이 있다.
  - 제안: `formSchema: {}` → `formConfig: {}` 로 정정 (fixture 정확도 향상 목적, behavior 영향 없음 — non-blocking).

- **[INFO]** `review/code/2026/07/02/13_08_49/RESOLUTION.md` 의 "23 tests PASS" 수치와 실제 파일 전체 테스트 수 불일치 가능성 — 문서 정합성 사소한 흠
  - 위치: `RESOLUTION.md:420`
  - 상세: `npx jest ai-turn-executor.spec.ts to-record.spec.ts` 실행 결과 두 파일 합계 32 tests PASS(개별 실행 시 ai-turn-executor.spec.ts 단독 파일 기준 정확한 개수는 명시되지 않았으나, RESOLUTION 이 인용한 "23 tests"가 `ai-turn-executor.spec.ts` 전체 파일 기준인지 특정 describe 블록 기준인지 문면상 불명확). 기능 결함이 아니라 리뷰 산출물 메타 정보의 근거 표기 정밀도 이슈이며 비차단.
  - 제안: 없음 (조치 불필요, 참고만).

- **[INFO]** spec §7.9/§4.2.1 관련 코드 주석(§7.9, §4.2.1 citation)이 실제 spec 문서 내용과 정확히 대응 — spec 누락/drift 없음
  - 위치: `ai-turn-executor.ts:2951-2953`, `:3113-3123`
  - 상세: `spec/4-nodes/3-ai/1-ai-agent.md:941-949`(§7.9 `_retryState` top-level, TTL, credential 미포함, expression resolver 비노출)과 `spec/conventions/node-output.md:200-214`(§4.2.1 보존 예외 표)를 대조한 결과 주석이 인용한 정책(보존 예외, credential-strip, TTL 기본 60분, `lastUserMessage` truncate)이 spec 본문과 일치한다. spec 문서 결함도 발견되지 않음.
  - 제안: 없음.

## TODO/FIXME/HACK/XXX 스캔
- diff 범위(`to-record.ts`/`.spec.ts`, `ai-turn-executor.ts`/`.spec.ts`) 전체에서 TODO/FIXME/HACK/XXX 마커 없음 (grep 0건).

## 엣지 케이스 / 에러 시나리오
- `isRecord`/`toRecord`: null/undefined/원시값/배열/class 인스턴스/`Object.create(null)` 전부 신규·기존 테스트로 커버. 경계값 회귀 없음.
- `endMultiTurnConversation`/`buildRetryState`: `retryable: false` 케이스에서 `_retryState` 키 자체 미생성(`omits _retryState for non-retryable errors` 테스트로 기존 커버, 이번 diff 로 깨지지 않음 — 실행 확인 PASS). `totalThinkingTokens`/`knowledgeBases`/`ragSources`/`mcpServers` 등 allow-list 필드 부재 시 `?? 0` / `?? []` 기본값 처리도 타입 전환 후에도 동일 유지(`s.turnCount ?? 0` 등, 라인 2934/2938-2942/3148-3157).

## 요약
이번 변경은 순수 behavior-preserving 타입 내로잉 리팩터(`Record<string, unknown>` 단언 → `ResumeState`/`RetryState` 도메인 타입) + 문서화 테스트 추가 + 직전 ai-review WARNING 2건(W-1/W-2, `_retryState` allow-list 필드 passthrough 커버리지 부재)에 대한 test-only fix 다. `buildRetryState`/`endMultiTurnConversation` 의 필드 목록·기본값·credential 제외 정책은 `spec/4-nodes/3-ai/1-ai-agent.md` §7.4/§7.9 및 `spec/conventions/node-output.md` §4.2.1 과 line-level 로 정확히 일치하며, 신규 회귀 테스트가 실제로 non-default 값 4종의 passthrough 를 검증하고 전체 스펙 32개 테스트가 PASS 한다. TODO/FIXME 등 미완성 마커 없음, 반환값·에러 시나리오·기본값 경로 모두 이전 동작을 그대로 보존한다. 유일하게 지적할 사소한 흠은 신규 테스트의 `pendingFormToolCall` mock 이 실제 shape(`formConfig`)과 다른 키(`formSchema`)를 써서 fixture 로서의 정확도가 떨어진다는 점이며, 이는 기능적 결함이 아니고 테스트 통과에도 영향이 없어 INFO 로 분류한다. spec 자체의 결함이나 spec-drift 는 발견되지 않았다.

## 위험도
NONE
