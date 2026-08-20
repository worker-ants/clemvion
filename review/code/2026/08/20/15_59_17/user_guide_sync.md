STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — eia-inputdata-marker-guard

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(§`자주 누락되는 항목`)을 SSOT 로 사용. 변경 파일은 `git diff origin/main...HEAD --stat` (143 files, merge-base `82a967afb`) 로 prompt 목록과 대조 확인.

## 발견사항

없음 — 매칭된 trigger 전부 같은 변경 set 안에서 동반 갱신이 완결돼 있다.

매칭된 trigger 와 확인 근거:

- **`new-ui-string`** (`codebase/frontend/src/**/*.tsx`, semantic) — `editor-toolbar.tsx`(`t("editor.runWithInputMasked")`), `rerun-modal.tsx`(`t("history.rerun.maskedInputBlocked")`) 가 신규 문자열을 도입했지만 둘 다 하드코딩이 아니라 `useT()` 경유이고, 대응 키가 같은 diff 안에서 ko/en 양쪽에 존재:
  - `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:62-63` / `codebase/frontend/src/lib/i18n/dict/en/editor.ts:64-65` — `runWithInputMasked`
  - `codebase/frontend/src/lib/i18n/dict/ko/history.ts:12-13` / `codebase/frontend/src/lib/i18n/dict/en/history.ts:14-15` — `maskedInputBlocked`
  - grep 으로 두 키 모두 정확히 4곳(ko×2 + en×2)에서만 나타나 parity 확인 완료. `Dict["editor"]`/`Dict["history"]` 타입 단언으로 구조적 동기도 컴파일 타임에 강제된다.

- **`run-debug-flow-change`** (semantic — 실행·디버깅 흐름 변경 → `05-run-and-debug/`) — `background-runs.service.ts`/`executions.service.ts`/`rerun-modal.tsx`/`editor-toolbar.tsx` 가 `Execution.inputData` 마스킹·Re-run 차단·JSON 히스토리 로드 차단이라는 사용자 가시 흐름을 바꿨고, 대응하는 4개 문서가 같은 diff 에 포함돼 있다:
  - `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` / `.en.mdx` — Re-run 버튼 마스킹·차단·"원본 입력 그대로 사용" 안내 반영
  - `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` / `.en.mdx` — `Load from History` 마스킹 차단 안내 반영

- **`backend-api-change`** (`**/*.controller.ts`, `**/dto/**`, semantic — swagger jsdoc + 관련 user-guide) — 변경된 DTO 2곳의 swagger `description`/JSDoc 이 새 마스킹 정책(두 레벨 모두 대상)으로 갱신됨:
  - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (`ExecutionDto.inputData`, `NodeExecutionSummaryDto.inputData`)
  - `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
  - 관련 user-guide 페이지는 위 `run-debug-flow-change` 항목과 동일 파일로 이미 커버.

`new-node`/`node-schema-change`(`codebase/backend/src/nodes/**` 미매치), `integration-provider-change`, `new-userguide-section-dir`, `auth-session-flow-change`(`codebase/backend/src/modules/auth/**` 미매치), `expression-language-change`(`codebase/packages/expression-engine/**` 미매치), `new-warning-code`/`new-error-code`(이번 diff 는 `sanitize-error-message.ts` JSDoc 만 변경, `SECRET_LEAK_PATTERNS`/`ErrorCode` enum 값 자체는 무변경 — 새 코드 미발행) 는 트리거 미매칭.

이번 PR 은 이미 4라운드 code-review(`14_08_45`→`15_32_34`)를 거치며 "유저 가이드 4파일(ko/en × running-a-workflow/run-results) 마커 차단 UX 반영"이 WARNING 으로 지적되고 같은 세션 내 RESOLUTION 으로 이미 적용된 상태다(`review/code/2026/08/20/14_08_45/RESOLUTION.md` WARNING 6). 본 라운드(최종 diff 기준)는 그 적용 결과가 실제로 반영돼 있음을 재확인했다.

## 요약

매트릭스 21행 중 `new-ui-string`·`run-debug-flow-change`·`backend-api-change` 3행이 이번 변경에 매칭되고(node/integration/auth/expression/warning-error 등 나머지는 미매칭), 3행 모두 동반 갱신(ko/en dict parity, 05-run-and-debug 4개 MDX, DTO swagger JSDoc)이 같은 diff 안에 완결돼 있어 누락 0건이다.

## 위험도

NONE
