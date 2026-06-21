# RESOLUTION — ai-review 18_38_11 (review-2)

원 리뷰: `review/code/2026/06/21/18_38_11/SUMMARY.md` (RISK=LOW, CRITICAL=0, WARNING=1).
처리 주체: main (developer 직접 Edit). 후속 fresh 리뷰: `review/code/2026/06/21/18_50_15/`.

## WARNING (1건) — 해소

### W-1 `buildConditionTools` 의 `parameters.required` 누락 (spec §5.1)
- **발견**: spec `4-nodes/3-ai/1-ai-agent.md §5.1`(L323)은 조건 도구 parameters 를 `{ type:"object", properties:{ reason:{...} }, required: [] }` 로 명시. 구현은 `required` 를 누락(기존 핸들러에서 그대로 이전된 pre-existing 갭).
- **fix**: `ai-condition-evaluator.ts` `buildConditionTools` 의 `parameters` 에 `required: []` 추가 + 근거 주석. JSON Schema 상 `required` 생략 ≡ `required: []` 이므로 **런타임/LLM 동작 무변경**, spec 문언과만 정합.
- **테스트**: `ai-condition-evaluator.spec.ts` 의 `buildConditionTools` 기대 객체 2건에 `required: []` 반영. (핸들러 spec `buildTools - tool naming` 은 이름만 단언 → 무영향.)

## INFO (선택 권장) — 함께 처리

- **#16 `CONDITION_REASON_MAX_CHARS` 비export** → `export const` 승격, 테스트가 하드코딩 `500` 대신 상수 참조.
- **#15 `extractConditionReason([], id)` 빈 toolCalls 케이스** → 테스트 추가.
- (멀티바이트 절단 케이스도 함께 추가 — char(코드유닛) 단위 동작 고정.)

## 미처리 (의도적 — 후속/위임)

- 보안 INFO (condition.prompt prompt-injection, sanitizeId 충돌): **pre-existing**, ConditionDef admin 신뢰 경계라 현재 수용. `ai/shared/` 승격 단계에서 검증 강화 후보.
- SPEC-DRIFT (§6.1 step 3a 포인터, `code:` frontmatter): **project-planner 위임** (코드 fix 불요).
- JSDoc KO/EN 통일, `condToolName` @internal, `beforeEach` 인스턴스 재생성: 낮은 우선순위 후속.

## 검증

- lint·build PASS · ai-agent unit 439 PASS (rebase onto origin/main `253ce8c2` 후 재검증).
- fix 가 LLM-facing tool schema 의미를 바꾸지 않음을 spec §5.1 문언 대조로 확인.
