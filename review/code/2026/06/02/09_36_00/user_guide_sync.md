# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

동반 갱신 누락 없음.

매트릭스의 각 trigger 에 대해 아래와 같이 매칭 및 이행 상태를 확인했다.

**run-debug-flow-change (id: run-debug-flow-change)**
- 변경 파일: `codebase/packages/graph-warning-rules/src/rules/parallel.ts`, `codebase/packages/graph-warning-rules/src/evaluator.ts`, `codebase/packages/graph-warning-rules/src/types.ts`
- 매핑된 target: `codebase/frontend/src/content/docs/05-run-and-debug/`
- 이행 상태: `codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.mdx` + `.en.mdx` 양쪽 신규 작성됨. KO 파일은 frontmatter(title/section/order:5/summary) 완비. EN 파일은 companion 방식으로 frontmatter 없이 본문만 — 기존 섹션 내 관례와 동일. SATISFIED.

**new-warning-code (id: new-warning-code)**
- 변경 파일: `codebase/packages/graph-warning-rules/src/rules/parallel.ts` (2개 ruleId 발행), `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (P3-C-1/P3-C-2 가드 신설)
- 매핑된 target: `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `WARNING_KO` / `GRAPH_WARNING_KO` 매핑
- 이행 상태: `backend-labels.ts` 에 `GRAPH_WARNING_KO` 신설(`parallel:nested-depth-exceeded`, `parallel:nested-concurrency-cap` 양쪽 ko 템플릿 등록) + `ERROR_KO`(`GRAPH_VALIDATION_FAILED`) 신설. `translateGraphWarning()` / `translateBackendError()` 함수도 동일 파일에 추가. P3-C-1/P3-C-2 자동 가드(`backend-labels.test.ts`)로 향후 누락 방지. SATISFIED.

**new-ui-string (id: new-ui-string)**
- 변경 파일: `codebase/frontend/src/components/editor/canvas/custom-node.tsx`, `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`
- 매핑된 target: `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 양쪽 등록
- 이행 상태: 두 TSX 파일의 변경은 기존 코드에서 raw `r.message` 접근을 `translateGraphWarning(r, locale)` 호출로 교체하는 것이며, 신규 한국어 리터럴을 TSX 본문에 직접 추가하지 않는다. dict `{ko,en}` 에 추가해야 할 새 키 없음. SATISFIED.

**new-userguide-section-dir (id: new-userguide-section-dir)**
- `validation-errors.mdx` 는 기존 `05-run-and-debug/` 섹션 내 신규 파일이며, 새 섹션 디렉토리 생성이 아님.
- `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 갱신 불필요. SATISFIED.

**backend-api-change (id: backend-api-change)**
- 변경 파일: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`
- `GraphWarningResultDto` 에 `params?: Record<string, string | number>` 추가. `@ApiPropertyOptional` 데코레이터 포함 — Swagger 문서 동반 갱신 이행. SATISFIED.

**새 섹션 locale 등록, 인증·권한·세션 흐름 변경, 표현식 언어 변경, 신규 errorCode enum, 신규 cross-cutting enum, 신규 handler output field, 통합/제공자 변경** — 해당 변경 없음. 무관.

---

## 요약

매트릭스 총 19 trigger 중 실질 매칭 4건(run-debug-flow-change / new-warning-code / new-ui-string / backend-api-change)이며, 4건 모두 동반 갱신이 완료됐다. `05-run-and-debug/validation-errors.mdx` + `.en.mdx` 신규 작성, `backend-labels.ts` 의 `GRAPH_WARNING_KO` / `ERROR_KO` 신설, `translateGraphWarning` 배선, Swagger DTO 갱신이 동일 변경 set 에 포함돼 있어 누락 건수 0 건이다.

## 위험도

NONE

STATUS=success ISSUES=0
