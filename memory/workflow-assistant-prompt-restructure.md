# Workflow AI Assistant 시스템 프롬프트 재구조 (2026-04-22)

`backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 를 5블록 구조로 재편한 작업의 핵심 결정 사항과 향후 주의점을 정리한다.

## 왜 바꿨나

### 이전 구조의 문제

1. **규칙 중복.** "plan-only vs execution turn" 분기가 5군데(L84/L85/L129/L138–153/L251)에 흩어져 LLM이 매 턴 파싱해야 했다. `planStepId` 태깅 규칙도 4군데, `get_node_schema` 선행 규칙도 4군데 반복.
2. **토큰/캐시 비효율.** 매 턴 변하는 `workflow snapshot JSON`(L121)과 `activePlanSection`(L87 근처)이 프롬프트 상단에 있어 provider prefix cache가 사실상 매 턴 무효화.
3. **시각적 우선순위 부재.** 섹션이 전부 `##` 동일 레벨, MUST/SHOULD 계층 구분 없음. 서술형 문장 안에 분기 로직이 숨어 있었음.
4. **부정문 지배.** DO NOT / NEVER / MUST NOT 위주. 긍정형 격언이 드물었다.
5. **예시 중복.** 6개 예시 중 3개가 사실상 같은 교훈(trigger 연결 + dynamic-ports + label/id) 반복.

## 새 구조 (5블록)

1. **ROLE & TURN-OP PROTOCOL** — 역할 1문장 + 툴 호출 규약 + **turn 결정표** (Markdown table: `Turn type | Emit prose? | finish call? | Further tools | When it applies`)
2. **CONTRACTS (MUST)** — Node output contract (CONVENTIONS 0/1.1/2/8), Label vs identifier, Entry-point connectivity, Dynamic-ports (schema-first + stable ids), Plan gating (openQuestions / planStepId / completeness)
3. **EDIT PLAYBOOK** — Closing the turn, pendingUserConfig, Editing existing node's config, Layout guidance, Error handling, Examples (3개)
4. **REFERENCE** — Node catalog, Expression language
5. **DYNAMIC STATE** — Active plan context + Current workflow snapshot JSON (**반드시 프롬프트 끝에 위치**)

### 주요 효과

- **Prefix cache 친화.** 정적 콘텐츠가 앞, 동적 상태가 뒤로 이동해 prefix-cache hit rate가 크게 개선될 것으로 기대.
- **규칙 단일 소스.** "Call `finish` immediately after `propose_plan`" 문구가 **딱 한 곳(turn 결정표)** 에만 존재. 다른 섹션에서는 "the decision table above" 로만 참조.
- **Expression reference 캐시.** `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 변수로 한 번만 문자열화. 이전엔 매 턴 `getAllFunctionNames().sort().join()` 을 재실행.
- **예시 3개로 축소** — Ex1 단순 edit / Ex2 dynamic-ports+pendingUserConfig (label/id 동시 커버) / Ex3 openQuestions 포함 복잡 요청.

## 새 구조를 고정하는 테스트

`system-prompt.spec.ts` 에 `5-block structural layout (cache-friendly ordering)` describe 블록 추가. 향후 변경 시 다음이 깨지면 안 된다:

- `## Expression language` 이후에 workflow snapshot JSON(`"nodes":[`) 이 위치.
- `## Expression language` 이후에 `## Active plan context` 위치.
- `Label vs identifier` (CONTRACTS) 는 `## Expression language` (REFERENCE) 보다 앞.
- Turn 결정표 헤더 `| Turn ... | ... prose ... | ... finish ...` 형태가 존재하고 `plan-only` / `execution` 두 턴 종류가 본문에 등장.
- `Call finish immediately after propose_plan` 정규식 매치가 **1회 이하** (중복 금지).

## 보존한 계약 (기존 테스트가 보장하는 것)

다음은 절대 문구를 깨면 안 된다 (regex 매칭됨):

- `[dynamic-ports]` 카탈로그 마커
- P0 guard rail: `manual_trigger` entry-point / `openQuestions` finish 금지 / `get_node_schema` MANDATORY
- Label vs identifier 예시: `btn_approve`, `승인`, `interaction.data.buttonId`, `interaction.data.email`, `data["승인"]` 금지 사례
- `## Closing the turn ... execution turn` 헤더 (동일 라인에 두 문구)
- `pendingUserConfig`, 4종 selector: `integration-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`
- `TODO|placeholder` 금지 가드
- `## Expression language`, `validate()`, `INVALID_EXPRESSION`, `Optional chaining`, `` `??` ``, `Arrow`, `Template literal`
- `Editing an existing node's config`, `shallow-merged`, `[REDACTED]`, `minimum patch`, "keep .* id"
- Active plan rendering: `[x] s1 · add_node` / `[ ] s2 · add_edge` / `• [note] ...` / `awaiting approval` / XML fence `<user-request>...</user-request>`

## 이번 작업에서 발견한 pre-existing 이슈

TEST WORKFLOW 중 다음 테스트가 **main 브랜치에서도 실패** 함을 확인 (git stash 로 재현):

- `backend/src/modules/workflow-assistant/tools/validate-expressions.spec.ts` — "accepts optional chaining" 케이스
- `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts` — "accepts add_node with optional chaining (supported syntax)"

원인은 `@workflow/expression-engine` 패키지의 optional chaining 파서가 한글 키 인덱싱(`$node["1depth 음식 종류"]?.output?.interaction?.data.field`)을 거부하는 것으로 보인다. 최근 커밋 `6f6cfe1 표현식에 ? 지원` 에서 도입하려던 수정이 불완전한 듯하다.

**이번 프롬프트 재구조 작업 범위 밖**이므로 별도 이슈로 처리해야 한다. 프롬프트 재구조는 이 실패들과 독립적으로 완결.

## 유지보수 시 체크

- 섹션을 추가할 때 **블록 경계를 넘지 말 것.** 정적 내용은 BLOCK 1~4, 동적 내용은 BLOCK 5. 이 규율이 캐시 효과의 근간.
- `STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*` 모듈 스코프 상수로 빌드 타임에 1회만 문자열화됨. 동적 값이 필요하면 이 상수에 넣지 말고 `buildSystemPrompt` 본체에서 조립.
- 새 규칙을 추가하기 전, **기존 섹션에 흡수 가능한지 먼저 검토.** 규칙을 여러 곳에 반복 넣으면 이번 리팩토링이 무효화된다.
- Harmony control token 경고(`<|channel|>` 등) 는 OpenAI gpt-oss 계열 대비 유산. 현 provider (OpenAI/Anthropic/Google) 모두에서 발생하지 않는다는 것이 확인되면 제거 가능.
