파일 저장이 거부되어 결과를 텍스트로 출력합니다.

---

# Code Review 통합 보고서

> 리뷰 대상: `system-prompt.ts`, `system-prompt.spec.ts`, `memory/workflow-assistant-prompt-restructure.md`
> 참여 에이전트: 13개

---

## 전체 위험도

**MEDIUM** — 프롬프트 prefix-cache 최적화 방향은 옳으나, 테스트 격리 구조 결함 1건(CRITICAL)과 sanitize 로직 버그 2건(보안 WARNING)이 조치 필요

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 모듈 스코프 `EXPRESSION_REFERENCE_CACHE`가 테스트 격리를 구조적으로 파괴. Jest 프로세스 내 첫 번째 호출 결과가 영구 고착되어, `getAllFunctionNames()`를 모킹하는 테스트가 추가되면 무음 캐시 오염 버그 발생. 현재는 모킹 테스트 없어 실패하지 않지만 시한폭탄 구조. | `system-prompt.ts` `let EXPRESSION_REFERENCE_CACHE` + `getExpressionReferenceSection()` | `__resetExpressionCacheForTest()` export 제공 또는 `getAllFunctionNames`를 주입 인자로 받아 테스트에서 독립 제어. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `sanitizeUserText`의 regex 실행 순서 오류로 markdown 헤더 중화 무효화. `\s+` 압축이 먼저 실행되어 이후 `\n#+` 패턴이 절대 매칭되지 않음. `"text\n# inject"` → `"text # inject"`로 정규화되며 `#` 잔존. | `system-prompt.ts` `sanitizeUserText()` | 개행 처리를 whitespace 압축 **이전**에 수행하거나, 압축 이후 `/ #+/g` 패턴으로 보완. |
| 2 | Security | `sanitizeLabel`에 `<`, `>` 중화 누락. `openQuestions` 등 LLM 출력이 이 함수를 통과하며 XML fence 경계 문자가 그대로 잔존. | `system-prompt.ts` `sanitizeLabel()` | `<`/`>` → `〈`/`〉` 치환 추가. |
| 3 | Testing | 5-블록 순서 검증이 BLOCK 1→2→3 구간을 미검증. CONTRACTS < EDIT PLAYBOOK < REFERENCE 순서 테스트 없어, EDIT PLAYBOOK이 CONTRACTS 앞으로 이동해도 통과. | `system-prompt.spec.ts` `5-block structural layout` | `indexOf('## Contracts') < indexOf('## Closing the turn')` 등 순서 쌍 추가. |
| 4 | Testing | `## Error handling` 섹션 전용 테스트 없음. `LABEL_CONFLICT`, `PLAN_AWAITING_APPROVAL`, `PLAN_NOT_COMPLETE` 에러 코드 삭제/오타 변경이 탐지 불가. | `system-prompt.ts` `STATIC_BLOCK_3_EDIT_PLAYBOOK` | `expect(prompt).toMatch(/LABEL_CONFLICT/)` 등 에러 코드 존재 검증 추가. |
| 5 | Testing | `(no nodes registered)` 폴백 경로 미테스트. 빈 `nodeDefs` 배열 호출 케이스 없음. | `system-prompt.ts:57` `${catalog \|\| '(no nodes registered)'}` | `buildSystemPrompt([], emptySnapshot)` 폴백 문자열 단언 추가. |
| 6 | Testing | Turn 결정표 검증이 5개 행 중 2개(`plan-only`, `execution`)만 확인. 나머지 3개 행 미검증. | `system-prompt.spec.ts` `'surfaces a turn-type decision table'` | `Question-only`, `openQuestions unanswered` 키워드 단언 추가. |
| 7 | Requirement | 순서 테스트에서 `labelIdx === -1`일 때 오탐 통과. `-1 < exprIdx(양수)`가 참이 되어 문구 누락 퇴행이 통과됨. | `system-prompt.spec.ts` CONTRACTS before REFERENCE 테스트 | 순서 비교 전 `expect(labelIdx).toBeGreaterThanOrEqual(0)` 가드 추가. |
| 8 | Maintainability | BLOCK 1~3은 `STATIC_BLOCK_*` 상수로 추출됐으나 BLOCK 4·5는 `buildSystemPrompt` 본체 인라인으로 남아 패턴 불일치. | `system-prompt.ts` `buildSystemPrompt` 반환 템플릿 | `STATIC_BLOCK_4_REFERENCE_INTRO` 등으로 분리하거나 최소 JSDoc에 "블록 4·5는 인라인" 명시. |
| 9 | Scope | Plan-only 턴 explore 도구 금지 규칙이 결정표 형식으로 옮기며 명시성 약화. `get_current_workflow` 등 금지가 암시적이 됨. | `system-prompt.ts` 결정표 "Further tools this turn?" 열 | "none (edits blocked; explore tools also waste tokens)"처럼 명시 보강. |
| 10 | Side Effect | `activePlanContext`가 null일 때 `###` 헤더 레벨이 달라짐. active plan 유무에 따라 LLM에 전달되는 마크다운 계층 구조 변동. | `system-prompt.ts` `buildSystemPrompt` 반환 템플릿 | `### Current workflow snapshot`을 `##`로 통일. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `renderNodeCatalog`가 매 LLM 턴마다 재계산. 정적 레지스트리 데이터임에도 `EXPRESSION_REFERENCE_CACHE`와 달리 캐시 없음. | `renderNodeCatalog()` 호출부 | 서비스 레이어에서 1회 계산·저장 또는 모듈 스코프 캐시 적용. |
| 2 | Performance | `sanitizeUserText` 6회 연쇄 `.replace()`. 200자 상한 문자열이라 실측 오버헤드 미미. | `sanitizeUserText()` | 핫패스 아니면 현행 유지. |
| 3 | Performance | `renderActivePlanSection`에 step 수 상한 없음. | `renderActivePlanSection` | `ctx.plan.steps.length > N` 가드 추가 검토. |
| 4 | Documentation | `STATIC_BLOCK_1/2/3` 상수에 JSDoc 없음. 특히 `STATIC_BLOCK_3`에 레이아웃 상수 인터폴레이션 사실 미문서화. | 세 STATIC_BLOCK 상수 선언부 | 각 상수 위 한 줄 JSDoc 추가. |
| 5 | Documentation | `renderActivePlanSection` JSDoc에 `@returns` 없음. null → 빈 문자열 반환 동작 미명시. | `renderActivePlanSection` JSDoc | `@returns {string} "" when ctx is null` 추가. |
| 6 | Documentation | `memory/workflow-assistant-prompt-restructure.md` 구버전 라인 번호(`L84`, `L129` 등)가 리팩터링 후 무효화. | memory 문서 "이전 구조의 문제" 섹션 | 라인 번호 대신 함수명·섹션명으로 대체. |
| 7 | Documentation | Memory 문서 "pre-existing 이슈" 항목에 추적 링크 없음. optional chaining 파서 실패 이슈 부유 상태. | memory 문서 | `plan/` 하위 파일 생성 또는 이슈 번호 연결. |
| 8 | Architecture | `let EXPRESSION_REFERENCE_CACHE`에 `SCREAMING_SNAKE_CASE` 사용. TypeScript 관례상 재할당 불가 상수로 오독 유발. | `let EXPRESSION_REFERENCE_CACHE` | `expressionReferenceCache`로 camelCase 변경. |
| 9 | Architecture | 섹션 헤더 문자열이 상수로 추출되지 않아 테스트와 구현 간 string drift 가능. | `spec.ts` indexOf 패턴들 | `SECTION_HEADER_EXPR_LANG = '## Expression language'` 등 상수 추출. |
| 10 | Maintainability | `render*` vs `get*` 네이밍 혼용. 동일 책임인 함수들이 이름 규칙이 다름. | `renderNodeCatalog` vs `getExpressionReferenceSection` | `render*`로 통일 후 JSDoc에 캐시 동작 명시. |
| 11 | Maintainability | `STATIC_BLOCK_1_`, `_2_`, `_3_` 숫자 접두사가 순서 정보를 중복. 중간 삽입 시 대규모 이름 변경 강제. | STATIC_BLOCK 상수명 | 내용 중심 명명(`ROLE_AND_TURN_OP_PROMPT` 등)으로 교체. |
| 12 | Testing | 5-block describe 내 `activePlan` 픽스처가 바깥 describe의 것과 동명. | `spec.ts` L341 근방 | `minimalActivePlan`으로 변경해 의도 명확화. |
| 13 | Requirement | `renderActivePlanSection`의 `status` 분기가 `completed`와 묵시적 `else`만. 미래 상태 추가 시 무음 실패. | `renderActivePlanSection` | TypeScript `never` 패턴으로 exhaustive 처리. |
| 14 | Security | `[REDACTED]` 필드가 스냅샷 JSON에 키로 존재. 정교한 prompt injection 시 LLM이 원래 값 추론·노출 유도 가능. XML fence가 1차 방어선. | `buildSystemPrompt()` snapshotJson 조립 | redacted 필드를 키 자체로 제거하거나 bool 존재 여부만 표현 검토. |
| 15 | Security | Harmony control token 열거가 역설적으로 해당 토큰 생성 few-shot 유도 효과 가능. | `STATIC_BLOCK_1` 토큰 목록 | provider에서 발생하지 않는다고 확인되면 제거. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **MEDIUM** | `EXPRESSION_REFERENCE_CACHE` 테스트 격리 파괴(CRITICAL), 5-블록 순서 검증 커버리지 불완전 |
| Security | **LOW** | `sanitizeUserText` regex 순서 버그(헤더 중화 무효), `sanitizeLabel` `<>` 누락 |
| Scope | **LOW** | Plan-only 턴 explore 도구 금지 규칙 명시성 약화 |
| Side Effect | **LOW** | 캐시 테스트 오염 가능성, heading 계층 변동 |
| Maintainability | **LOW** | 블록 4-5 인라인 패턴 불일치, `render*`/`get*` 네이밍 혼용 |
| Architecture | **LOW** | 모듈 스코프 mutable 싱글턴 캐시, 레이아웃 상수 빌드타임 캡처 |
| Performance | **LOW** | `renderNodeCatalog` 미캐시 |
| Dependency | **LOW** | Jest 모듈 공유 시 캐시 오염 이론적 가능성 |
| Concurrency | **LOW** | lazy-init (Node.js 단일 스레드에서 실질 안전) |
| Requirement | **LOW** | `labelIdx === -1` 오탐 통과, non-exhaustive status |
| Documentation | **LOW** | JSDoc 누락, memory 문서 구버전 라인 번호 |
| Database | **NONE** | 해당 없음 |
| API Contract | **NONE** | `buildSystemPrompt` 시그니처 완전 보존 |

---

## 발견 없는 에이전트

- **Database** — DB 관련 코드 없음
- **API Contract** — 함수 시그니처 변경 없음, HTTP 엔드포인트 무관

---

## 권장 조치사항

1. **[즉시] `EXPRESSION_REFERENCE_CACHE` 테스트 리셋 진입점 제공** — `export const __resetExpressionCacheForTesting` 또는 DI로 이동.
2. **[즉시] `sanitizeUserText` regex 순서 수정** — 개행 후 `#` 중화를 whitespace 압축 이전에 실행.
3. **[단기] `sanitizeLabel`에 `<>` 중화 추가** — XML fence 오염 경로 차단.
4. **[단기] 테스트 커버리지 보강** — `labelIdx >= 0` 가드, BLOCK 1→2→3 순서 쌍, Error handling 에러 코드 검증, 폴백 검증.
5. **[단기] Plan-only 턴 결정표 explore 도구 금지 명시** — "none (edits blocked; explore tools also waste tokens)" 추가.
6. **[중기] BLOCK 4-5 상수 추출 또는 JSDoc 보완** — 5-블록 패턴 일관성 확보.
7. **[중기] `EXPRESSION_REFERENCE_CACHE` → `expressionReferenceCache` camelCase 변경** — TypeScript 관례 준수.
8. **[중기] `renderActivePlanSection` heading 레벨 통일** — active plan 유무 무관하게 `##` 유지.
9. **[여유 시] `renderNodeCatalog` 캐시 추가** — 매 턴 재계산 제거.
10. **[여유 시] Memory 문서 구버전 라인 번호 → 함수명으로 교체** — 미래 유지보수자 혼란 방지.