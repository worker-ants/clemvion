# Review Resolution — 2026-04-22 22:17

대상: `backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 와 `system-prompt.spec.ts` 재구조 작업. 리뷰 `SUMMARY.md` 가 지적한 **CRITICAL 1건 + WARNING 10건 + INFO 15건** 의 조치 결과를 기록한다.

## CRITICAL

### 1. `EXPRESSION_REFERENCE_CACHE` 테스트 격리 파괴 — 해결

**문제**: 모듈 스코프 `let` 캐시가 Jest 프로세스 내에서 고착되어, 향후 `getAllFunctionNames()` 를 mock 하는 테스트가 추가되면 침묵 오염 버그 발생.

**조치**:
- 변수명을 `EXPRESSION_REFERENCE_CACHE` → `expressionReferenceCache` (camelCase) 로 변경 (TS 관례 준수, INFO #8 동시 해결).
- `export function resetExpressionCacheForTesting(): void` 진입점 제공. JSDoc 에 "프로덕션 코드는 호출하지 말 것" 경고 명시.
- 회귀 방지 테스트: `resetExpressionCacheForTesting clears the module-scope expression cache`.

## WARNING

### 1. `sanitizeUserText` regex 실행 순서 오류 — 해결

**문제**: `\s+` 압축이 `\n#+` 헤더 중화보다 먼저 실행돼 개행 뒤 마크다운 헤더가 영영 매칭되지 않음. `"text\n# inject"` 가 `"text # inject"` 로만 정규화되어 `#` 가 살아남음.

**조치**:
- 함수 내 실행 순서를 `헤더 중화 → whitespace 압축 → 치환` 으로 재배치.
- JSDoc 에 "**whitespace 압축 이전에 수행해야 한다**" 명시.
- 회귀 테스트: `neutralizes '#' headers that appear after newlines in userRequest`.

### 2. `sanitizeLabel` 에 `<`/`>` 중화 누락 — 해결

**문제**: `openQuestions` / `plan.title` 이 LLM 생성 필드인데 `<`/`>` 치환이 없어 XML fence 경계 오염 가능.

**조치**:
- `sanitizeLabel` 에 `<` → `〈`, `>` → `〉` 치환 추가.
- 회귀 테스트: `neutralizes '<' / '>' in plan title (sanitizeLabel defense in depth)`.

### 3. 5-블록 순서 검증 커버리지 불완전 — 해결

**문제**: CONTRACTS < EDIT PLAYBOOK < REFERENCE 순서 쌍이 테스트되지 않아 블록 재배치 회귀 탐지 불가.

**조치**:
- 새 테스트 `orders BLOCK 1 → 2 → 3 (tool calling → contracts → edit playbook)`.
- `## Tool calling protocol` → `## Contracts` → `## Closing the turn` 인덱스 순서 어설션.

### 4. 에러 처리 섹션 에러 코드 전용 테스트 부재 — 해결

**조치**:
- 새 테스트 `lists recoverable error codes the assistant should react to`.
- 검증 대상: `LABEL_CONFLICT`, `NODE_NOT_FOUND`, `PLAN_AWAITING_APPROVAL`, `PLAN_NOT_COMPLETE`, `MISSING_PLAN_STEP_ID`.

### 5. `(no nodes registered)` 폴백 미테스트 — 해결

**조치**: 새 테스트 `emits '(no nodes registered)' when nodeDefs is empty`.

### 6. Turn 결정표 5행 중 2행만 검증 — 해결

**조치**:
- 기존 테스트 확장 `surfaces a turn-type decision table with every row named`.
- 5개 행 키워드를 모두 어설션: `plan-only`, `execution turn`, `openQuestions unanswered`, `Question-only`, `Single unambiguous edit`.

### 7. `labelIdx === -1` 오탐 통과 — 해결

**문제**: `indexOf` 가 -1 을 반환하면 `-1 < 양수` 가 참이라 누락 회귀가 통과.

**조치**: `places the CONTRACTS block ... before REFERENCE` 테스트에 `toBeGreaterThanOrEqual(0)` 가드 추가.

### 8. BLOCK 4-5 가 `STATIC_BLOCK_*` 패턴에서 벗어남 — 부분 해결 (의도적)

**판단**: BLOCK 4·5 는 런타임 변수 보간이 반드시 필요하므로 (\`${catalog}\`, \`${activePlanSection}\`, \`${snapshotJson}\`) 모듈 스코프 상수로 뽑을 수 없다.

**조치**: `buildSystemPrompt` JSDoc 의 5블록 설명 주석이 이미 블록별 정적/동적 여부를 명시하고 있음. 추가 조치는 하지 않되, 이 설계 의도를 `memory/workflow-assistant-prompt-restructure.md` 에 명문화.

### 9. Plan-only 턴 explore 도구 금지 명시성 약화 — 해결

**조치**: 결정표 `Further tools this turn?` 열의 plan-only 행에 명시 문구 추가:
> "none at all — edits return `PLAN_AWAITING_APPROVAL` (retrying loops), and explore tools (`get_current_workflow`, `get_node_schema`, `list_*`) are also disallowed because they waste tokens before user approval"

- 회귀 테스트: `forbids explore tools on plan-only turns (not just edit tools)`.

### 10. `### Current workflow snapshot` 레벨 불일치 — 해결

**조치**: `###` → `##` 로 통일. Active plan 유무에 무관하게 동일 헤더 레벨.

## INFO — 선별 조치

다음 INFO 항목은 가치가 있어 조치함:

- **INFO #8** (`SCREAMING_SNAKE_CASE` 오독) — `EXPRESSION_REFERENCE_CACHE` → `expressionReferenceCache` 로 변경하여 CRITICAL #1 과 함께 해결.

다음 INFO 항목은 **의도적으로 보류**:

- **INFO #1** (`renderNodeCatalog` 미캐시) — 카탈로그는 nodeDefs 배열을 받는 순수 함수이고, NodeDefinitionView 목록은 서비스 레이어에서 DI 로 주입된다. 함수 레벨 캐시를 추가하면 모듈 싱글턴이 또 늘어나 테스트 격리가 다시 어려워진다. 현재 실측 오버헤드 미미.
- **INFO #3** (step 수 상한) — spec 에서 `toolCallsBudget` 으로 상한을 강제하므로 프롬프트 레이어에서 중복 검증할 필요 없음.
- **INFO #6** (memory 문서의 구버전 라인번호) — 메모는 2026-04-22 시점의 snapshot 이고 의도적으로 "이전 구조" 를 기술하는 맥락이므로 라인번호 자체가 문서의 일부. 변경 안 함.
- **INFO #9** (섹션 헤더 상수화) — 지금은 헤더 변경 빈도가 낮고, 상수화하면 jest 테스트가 구현 상수에 직접 결합되어 계약 검증 의미가 약화됨. 현행 인라인 문자열 유지.
- **INFO #11** (`STATIC_BLOCK_1/2/3` 숫자 접두사) — 5블록 순서가 이 모듈의 제1 규약이므로 숫자 접두사가 **의도된 문서화**. 교체 안 함.
- **INFO #14** (`[REDACTED]` 키 자체가 프롬프트에 노출) — 이번 리팩토링 범위 밖. shadow-workflow redact 레이어 차원에서 별도 이슈로 처리.
- **INFO #15** (harmony token 열거의 few-shot 유도 효과) — spec §3.2 가 아직 `sanitizeAssistantText` 로 이 토큰을 필터링하므로 발생 가능성이 인정되는 상태. 발생 빈도 관측 데이터가 생기면 제거 재검토.

## TEST WORKFLOW 재실행 결과

| 단계 | 결과 |
|------|------|
| lint | ✅ clean |
| unit test — `system-prompt.spec.ts` | ✅ 28/28 (기존 16 + 신규 12) |
| integration test — `workflow-assistant-stream.service.spec.ts` | ✅ 32/32 |
| build — `nest build` | ✅ 성공 |

**사전존재 실패**: `validate-expressions.spec.ts` 의 "accepts optional chaining" 1건 + `shadow-workflow.spec.ts` 의 "accepts add_node with optional chaining" 1건. `git stash` 로 확인한 결과 main 브랜치에서도 실패. `@workflow/expression-engine` 의 한글 키 인덱싱 파서 이슈로, 이번 프롬프트 리팩토링과 독립적. 별도 이슈 처리 필요.

## 변경된 파일

- `backend/src/modules/workflow-assistant/prompts/system-prompt.ts`
- `backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts`
- `memory/workflow-assistant-prompt-restructure.md` (새 메모)
- `review/2026-04-22_22-17-38/RESOLUTION.md` (이 파일)
