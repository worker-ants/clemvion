# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` — 19개 row 확인 완료.

## 변경 파일 식별

코드 변경 파일 (review/plan/spec 산출물 제외):

- `codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts`
- `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`
- `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`
- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`
- `codebase/frontend/src/lib/i18n/dict/en/editor.ts`
- `codebase/frontend/src/lib/i18n/dict/ko/editor.ts`
- `spec/4-nodes/6-presentation/4-form.md`

## trigger 매칭 결과

| 매트릭스 row | trigger | 매칭 여부 | 근거 |
|---|---|---|---|
| new-node | `codebase/backend/src/nodes/**` (glob) | 미매칭 | 변경 파일 중 nodes/ 경로 없음 |
| node-schema-change | `codebase/backend/src/nodes/**` (glob) | 미매칭 | 동일 |
| new-ui-string | `codebase/frontend/src/**/*.tsx` (semantic) | **매칭** | `dynamic-form-ui.tsx` 에 `t()` 신규 키 4종 추가 |
| integration-provider-change | semantic | 미매칭 | 신규 provider 없음 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` (glob) | 미매칭 | 신규 섹션 디렉토리 없음 |
| backend-api-change | `*.controller.ts`, `**/dto/**` (semantic) | 미매칭 | controller/DTO 변경 없음 |
| new-warning-code | semantic | 미매칭 | warningRules 변경 없음 |
| new-error-code | `codebase/backend/src/nodes/core/error-codes.ts` (glob) | 미매칭 | 해당 파일 변경 없음 |
| new-cross-cutting-enum | semantic | 미매칭 | interaction-type enum 변경 없음 |
| new-backend-ui-zod-value | semantic | 미매칭 | zod ui.label/hint/group 값 변경 없음 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` (semantic) | 미매칭 | auth 변경 없음 |
| expression-language-change | `codebase/packages/expression-engine/**` (semantic) | 미매칭 | 표현식 엔진 변경 없음 |
| run-debug-flow-change | semantic | 미매칭* | execution-engine 내부 form 검증 plumbing (assertFormSubmissionValid 분기 리팩터) — 실행·디버깅 흐름 자체가 아니라 제출 검증 내부 로직 변경. 사용자 가시 실행/디버깅 동작 불변 |
| spec-major-change | `spec/4-*/**` (glob) | 매칭 (범위 외) | `spec/4-nodes/6-presentation/4-form.md` 변경 — 이 row 의 target 은 frontmatter code:/status:/pending_plans: 정합이며, 유저 가이드 MDX 갱신 의무가 아님 |
| userguide-gui-flow-section | `codebase/frontend/src/content/docs/02-nodes/**.mdx` (semantic) | 미매칭 | MDX 파일 변경 없음 |

## 동반 갱신 누락 검출 — new-ui-string trigger

매칭된 trigger: **new-ui-string** (id)

대상 요건: `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 양쪽 등록 필수 (parity 가드).

신규 키 4종:
- `editor.runResults.formFileMimeRejected`
- `editor.runResults.formFileSizeExceeded`
- `editor.runResults.formFileTotalExceeded`
- `editor.runResults.formFileCountExceeded`

실제 변경 set 확인:
- `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` — 4종 전부 추가됨 (확인)
- `codebase/frontend/src/lib/i18n/dict/en/editor.ts` — 4종 전부 추가됨 (확인)

parity 충족. 누락 없음.

## 추가 확인: 노드 문서 MDX 현황

`codebase/frontend/src/content/docs/02-nodes/presentation.mdx` 와 `presentation.en.mdx` 는 이 변경 set 에 포함되지 않았으나, 현재 파일 내 `file` 필드 FieldTable 에 `allowedMimeTypes`, `maxFileSize`, `maxTotalSize`, `maxFiles` 항목이 이미 올바른 기본값과 함께 등재되어 있음을 직접 확인. 선행 커밋에서 반영된 것으로 판단되며, 본 변경 set 에서 별도 갱신 불필요.

## 발견사항

해당 없음. 모든 매트릭스 trigger 에 대해 동반 갱신이 충족되어 있거나 변경이 해당 trigger 에 매칭되지 않는다.

## 요약

매트릭스 19개 row 전수 검토. 매칭된 trigger 는 `new-ui-string` 1건 — `dynamic-form-ui.tsx` 에 `t()` 키 4종 신규 사용. `dict/ko/editor.ts` 와 `dict/en/editor.ts` 양쪽에 동일 키 4종이 같은 변경 set 에 포함되어 i18n parity 충족. 노드 경로(`codebase/backend/src/nodes/**`) 변경 없어 new-node/node-schema-change trigger 미발동. auth/expression/run-debug 등 semantic trigger 비해당. 동반 갱신 누락 0건.

## 위험도

NONE
