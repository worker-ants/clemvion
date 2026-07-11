# Rationale 연속성 검토 — EIA `getStatus` context 스키마화 + PR #903 rebase (--impl-done, re-run)

## 검토 범위

- diff-base: `origin/main` (581d16811, PR #905 까지 반영 — PR #903 `perf(external-interaction): getStatus() 2단계 컬럼 projection` 포함)
- target: `spec/5-system/14-external-interaction-api.md` (닫힌 union 스키마화 변경)
- 검증 대상 merged 코드: 이 워킹트리 HEAD (`ee271026e` — ai-review Warning 반영까지 포함)
- 대조한 Rationale: `spec/conventions/swagger.md` §Rationale, `spec/5-system/2-api-convention.md` §Rationale, `spec/5-system/14-external-interaction-api.md` §R17

payload(`_prompts/rationale_continuity.md`)의 "관련 Rationale 발췌" 절은 `swagger.md`/`2-api-convention.md`/`14-external-interaction-api.md` 자신의 Rationale 을 포함하지 않고 잘려 있었다(다른 무관 spec 들의 Rationale 만 담고 미완결). 따라서 세 문서를 워킹트리에서 직접 Read 해 근거로 삼았다.

## 코드 검증 방법

- `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` (HEAD) 직접 Read.
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (HEAD, PR #903 의 2단계 projection 포함) 직접 Read.
- `git -C <worktree> log --oneline -- interaction.service.ts` 로 PR #903(`49c2185d1`)이 이 브랜치 히스토리에 실제 편입됐음을 확인.
- `redactThreadForPublic` 전체 사용처를 grep 해 REST(`interaction.service.ts`)와 SSE 3개 emit site(`form-interaction.service.ts`/`ai-turn-orchestrator.service.ts`/`button-interaction.service.ts`)가 동일 helper 를 호출하는지 확인.
- `responses.dto.spec.ts`(15 tests) · `interaction.service.spec.ts`(45 tests) 실행 — 전량 통과.

## 발견사항

없음. CRITICAL/WARNING/INFO 모두 검출되지 않았다.

### 확인한 4개 항목 상세

**(a) discriminator 미선언**
`responses.dto.ts:152` `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` 이후 `ExecutionStatusDto.context` 는 `oneOf: [...]` 만 선언하고 `discriminator` 키를 두지 않는다(`discriminator` 문자열이 코드에 등장하는 유일한 위치는 그것을 선언하지 않는 이유를 설명하는 JSDoc 주석, line 189). `responses.dto.spec.ts` 의 `context 는 discriminator 를 선언하지 않는다` 테스트가 실제 OpenAPI 문서 생성으로 이를 회귀 가드한다 — `swagger.md` §Rationale "`discriminator` 는 판별자가 sound 할 때만" 이 기술한 EIA `interactionType` unsound 판별자 사례(버튼 fallthrough)와 정확히 일치.

**(b) `conversationThread` 여전히 키 생략, PR #903 의 `threadRow` 도 동일 계약**
`interaction.service.ts:295-315` — PR #903 이 도입한 2단계 조회(`threadRow = executionRepository.findOne({select:['id','conversationThread']})`)의 결과를 `const conversationThread = threadRow?.conversationThread ? redactThreadForPublic(...) : undefined` 로 받고, `base: WaitingContextBaseDto` 조립부(`interaction.service.ts:348-352`)는 `...(conversationThread ? { conversationThread } : {})` 로 값이 있을 때만 키를 얹는다. `null` 정규화가 아니라 여전히 present-when-available. `2-api-convention.md` §Rationale "왜 `conversationThread` 를 `null` 로 정규화하지 않는가" 와 `14-external-interaction-api.md` §R17 의 "부재 표현이 형제 필드와 다른 이유"(SSE wire parity 요구) 를 그대로 따른다. `interaction.service.spec.ts` 의 신규 `waiting_for_input(buttons) — durable thread 부재 시 conversationThread 키 자체를 생략` 테스트, e2e `I-2` 테스트가 이를 고정한다.

**(c) `ConversationThreadDto` 미생성**
`responses.dto.ts` 전체에 `ConversationThreadDto` 클래스가 없다(`grep "class .*Dto"` 결과에 없음). `WaitingContextBaseDto.conversationThread` 는 `type: 'object', additionalProperties: true` 로 열어 두고 description 이 `conversation-thread.md` 를 SoT 로 지목한다(`responses.dto.ts:104-113`). `swagger.md` §Rationale "왜 EIA `context` 는 봉투만 스키마화하고 내부는 열어 두는가" 가 이 결정을 명시적으로 근거화하며, `responses.dto.spec.ts` 의 `ConversationThreadDto 를 만들지 않는다` 테스트가 이를 회귀 가드한다.

**(d) runtime wire 불변 + PR #903 perf 분리가 §R17 "REST/SSE 단일 helper" invariant 위반하지 않음**
`interaction.service.ts:313-314` 의 `redactThreadForPublic(threadRow.conversationThread)` 는 SSE 측 세 emit site(`form-interaction.service.ts:138`, `ai-turn-orchestrator.service.ts:466`/`793`, `button-interaction.service.ts:422`)가 호출하는 것과 **동일한 단일 helper**(`shared/conversation-thread/thread-renderer.ts` 의 `redactThreadForPublic`)다. PR #903 의 2단계 projection(`STATUS_PROJECTION_COLUMNS` 에서 `conversationThread` 제외 → `waiting_for_input` 분기에서만 별도 `threadRow` 재조회)은 **조회 시점만 지연**시켰을 뿐, 마스킹 경로 자체를 우회하거나 새 마스킹 로직을 도입하지 않았다 — egress 직전에 여전히 같은 helper 를 거친다. `interaction.service.ts:309-311` 주석이 이 대응을 "SSE 와 동일 helper 로 secret-mask 하여 REST·SSE 양 경로 일관" 이라고 명시적으로 재확인한다. `14-external-interaction-api.md` §R17 "`conversationThread`(강제됨)" 항의 "REST `getStatus` 와 SSE `waiting_for_input` emit 이 공유하는 단일 helper `redactThreadForPublic`" invariant 는 그대로 유지된다.

### 테스트 실행 결과 (참고 근거)

- `responses.dto.spec.ts`: 15 passed — variant 등재, oneOf 닫힌 union, discriminator 부재, `context` nullable, additionalProperties 미사용, `conversationThread` 키 생략(2 variant), `ConversationThreadDto` 부재, variant 필수 필드 전부 회귀 가드.
- `interaction.service.spec.ts`: 45 passed — buttons fallthrough(interactionType 이 sound discriminator 아님 고정) + `conversationThread` 키 생략(buttons variant) 신규 테스트 포함.

## 요약

이번 재검토(origin/main 리베이스, PR #903 two-stage projection 반영 후) 대상 diff(`responses.dto.ts`/`responses.dto.spec.ts`/`interaction.service.ts`/`interaction.service.spec.ts`/e2e/`eia-types.ts`)는 `swagger.md`·`2-api-convention.md`·`14-external-interaction-api.md §R17` 세 문서의 Rationale 이 명시적으로 기각한 대안(discriminator 선언, `conversationThread` null 정규화, `ConversationThreadDto` 신설)을 재도입하지 않는다. PR #903 이 도입한 `getStatus` 2단계 컬럼 projection(`STATUS_PROJECTION_COLUMNS` + `waiting_for_input` 분기 한정 `threadRow` 재조회)은 순수 조회 최적화로, redaction 경로(`redactThreadForPublic`)를 그대로 관통하며 REST/SSE 가 동일 helper 를 공유한다는 §R17 invariant 를 우회하지 않는다. 코드 레벨 테스트(총 60개)도 이 네 항목을 회귀 가드로 고정하고 있어, 이번 rebase 로 인한 Rationale 연속성 위반은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
