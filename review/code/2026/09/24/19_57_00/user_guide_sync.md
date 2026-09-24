# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

없음.

## 근거

1. **매트릭스 적재**: `.claude/config/doc-sync-matrix.json` (`rows[]` 23행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(§자주 누락되는 항목 포함)을 Read.
2. **변경 파일 식별**: `git diff --name-only origin/main...HEAD` 로 changeset 전수 확인 — 13개 파일, prompt 에 포함된 목록과 정확히 일치(추가 파일 없음, `git status --short` 도 review 산출물 디렉터리 외 clean).
   - `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`
   - `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts`
   - `plan/in-progress/pending-plan-is-plan.md`
   - `plan/in-progress/spec-draft-nullable-notation-followups.md`
   - `review/consistency/2026/09/24/19_35_41/*` (7개 — SUMMARY/retry_state/convention_compliance/cross_spec/meta/naming_collision/plan_coherence/rationale_continuity)
3. **trigger 매칭**: 23개 행 전수를 대조.
   - `new-node`/`node-schema-change` (`codebase/backend/src/nodes/**`) — 매칭 없음.
   - `new-ui-string` (`codebase/frontend/src/**/*.tsx`) — 변경 파일은 `.ts`(테스트/헬퍼)이지 `.tsx` 가 아니며, 사용자 노출 UI 문자열도 아님. 매칭 없음.
   - `new-widget-chrome-string` (`codebase/channel-web-chat/src/**/*.tsx`) — 매칭 없음.
   - `integration-provider-change` (semantic) — provider 변경 없음.
   - `new-userguide-section-dir` (`codebase/frontend/src/content/docs/*/`) — 매칭 없음.
   - `backend-api-change` (`*.controller.ts`, `dto/**`) — 매칭 없음.
   - `new-bullmq-queue` — 매칭 없음.
   - `new-warning-code`/`new-error-code` (`codebase/backend/src/nodes/core/error-codes.ts` 등) — 매칭 없음.
   - `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field` — 매칭 없음(백엔드 zod/enum/handler 변경 자체가 없음).
   - `auth-session-flow-change` (`codebase/backend/src/modules/auth/**`) — 매칭 없음.
   - `auth-config-type-enum-change`, `expression-language-change`(`codebase/packages/expression-engine/**`), `run-debug-flow-change`, `env-runtime-change` — 매칭 없음.
   - `spec-major-change` (`spec/2-*/**` 등 `spec/**`) — 이번 changeset 은 `spec/` 파일을 **하나도** 건드리지 않음(plan 문서가 `spec/conventions/spec-impl-evidence.md` 를 참조·인용할 뿐). 매칭 없음.
   - `userguide-gui-flow-section` (`docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx`) — 매칭 없음.
   - `spec-defect-found` — 이 changeset 은 정반대로 "구현이 SoT 보다 좁았다"(가드가 허술)는 케이스이고, plan 본문 §A 가 명시하듯 **"규약은 바꾸지 않는다 — SoT 가 이미 옳다. 구현을 SoT 에 맞춘다"** — spec 결함 제안이 아니라 구현 보강이므로 이 행도 매칭 대상이 아님.
4. **본질 판정**: 변경된 3개 `.ts` 파일(`spec-frontmatter-parse.{ts,test.ts}`, `spec-pending-plan-existence.test.ts`)은 `codebase/frontend/src/lib/docs/__tests__/` 아래의 **spec/plan frontmatter 검증 하니스**다. `PROJECT.md` §304-309 이 이 디렉터리의 `plan-frontmatter.test.ts`·`spec-plan-completion.test.ts`·`spec-link-integrity.test.ts` 등을 명시적으로 "harness/가드 테스트" 계열로 분류하고 있고, 이번 변경(`isPendingPlanPath` 신설)도 같은 계열 — `pending_plans:` frontmatter 항목이 실제 work-plan 경로인지 판별하는 순수 함수 + 그 가드를 검증하는 테스트다. 사용자에게 노출되는 노드/UI/문서/통합/인증/표현식/실행 흐름 중 어느 것도 바꾸지 않는다. `spec-draft-nullable-notation-followups.md` 안의 새 등재 항목 자체도 "id 유일성 가드 부재"라는 **harness 결함**을 다루며, plan 본문이 스스로 "도구·테스트 하니스 = 해당 없음" 기준을 서술하고 있다(해당 changeset 이 바로 그 케이스).
5. **i18n / warning-code / locale 관점 개별 확인**: dict(`{ko,en}`), `backend-labels.ts`, `SECTION_LABELS_BY_LOCALE`, docs MDX 어느 것도 diff 에 등장하지 않음 — 애초에 매칭된 trigger 가 없으므로 이들에 대한 누락 여부를 논할 대상 자체가 없음.

## 요약

매트릭스 23개 trigger(glob 12 + semantic 11) 전수를 이번 changeset(13개 파일: spec/plan frontmatter 검증용 `.ts` 3개 + plan 문서 2개 + `--impl-prep` consistency-check 산출물 7개)과 대조한 결과 매칭되는 trigger가 0건이었다 — 변경이 `codebase/backend/src/nodes`·`*.tsx`·`content/docs`·`modules/auth`·`packages/expression-engine`·`error-codes.ts`·`spec/**` 등 어떤 trigger glob/semantic 범주에도 해당하지 않는 내부 harness(spec-frontmatter 가드) 강화이므로 유저 가이드 동반 갱신 관점에서는 영역 무관(해당 없음)이다.

## 위험도

NONE
