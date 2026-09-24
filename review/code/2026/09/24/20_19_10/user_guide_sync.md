# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

없음 — 해당 없음.

## 근거

1. **매트릭스 적재**: `.claude/config/doc-sync-matrix.json` (`rows[]` 21행, glob 매칭 10 + semantic 11) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT 로 Read.
2. **변경 파일 식별**: `git status --short` (review 산출물 디렉터리 외 clean) + `git diff --name-only origin/main...HEAD` 로 changeset 전수 확인 — 32개 파일. 프롬프트에 포함된 목록과 정확히 일치.
   - `CHANGELOG.md`
   - `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.{ts,test.ts}`
   - `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts`
   - `plan/in-progress/pending-plan-is-plan.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
   - `review/code/2026/09/24/19_57_00/*` (18개 — 직전 라운드의 code-review 산출물, 이제 커밋된 상태)
   - `review/consistency/2026/09/24/19_35_41/*` (7개 — `--impl-prep` consistency-check 산출물)
3. **trigger 전수 대조** (21행):
   - `new-node`/`node-schema-change` (`codebase/backend/src/nodes/**`) — 매칭 없음.
   - `new-ui-string` (`codebase/frontend/src/**/*.tsx`) — 변경 파일은 `.ts`(테스트/헬퍼)이며 `codebase/frontend/src/lib/docs/__tests__/` 아래 build-time 가드다. `.tsx` 도 아니고 사용자 노출 UI 문자열도 아니다. 매칭 없음.
   - `new-widget-chrome-string` (`codebase/channel-web-chat/src/**/*.tsx`) — 매칭 없음.
   - `integration-provider-change` (semantic) — provider 변경 없음.
   - `new-userguide-section-dir` (`codebase/frontend/src/content/docs/*/`) — 신규 섹션 디렉토리 없음. 매칭 없음.
   - `backend-api-change` (`*.controller.ts`, `dto/**`) — 매칭 없음.
   - `new-bullmq-queue` (`system-status.constants.ts`) — 매칭 없음.
   - `new-warning-code`/`new-error-code` (`error-codes.ts` 등) — backend warningRules·ErrorCode enum 변경 없음. 매칭 없음.
   - `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field` (semantic) — 해당 종류의 백엔드 변경 자체가 없음. 매칭 없음.
   - `auth-session-flow-change` (`codebase/backend/src/modules/auth/**`) — 매칭 없음.
   - `auth-config-type-enum-change`, `expression-language-change` (`codebase/packages/expression-engine/**`), `run-debug-flow-change`, `env-runtime-change` — 매칭 없음.
   - `spec-major-change` (`spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**`) — 이번 changeset 은 `spec/` 파일을 **하나도** 건드리지 않는다. plan 문서·가드 주석이 `spec/conventions/spec-impl-evidence.md` 를 SoT 로 **인용**할 뿐 그 파일 자체를 수정하지 않는다(`spec_impact: none`, `plan/in-progress/pending-plan-is-plan.md` frontmatter 로 확인). 이 행의 `guard_tests` 목록에 `spec-pending-plan-existence.test.ts` 가 들어 있는 것은 "spec 변경 시 이 가드로 검증하라" 는 의미이지, "이 가드 자체를 고치면 spec 도 함께 고쳐야 한다" 는 역방향 의미가 아니다. 매칭 없음.
   - `userguide-gui-flow-section` (`docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx`) — 매칭 없음.
   - `spec-defect-found` — 오히려 반대 방향 사례다. plan 본문 §A 가 "규약은 바꾸지 않는다 — SoT 가 이미 옳다. 구현을 SoT 에 맞춘다" 고 명시한다 — spec 결함 제안이 아니라 구현을 SoT 정의(§2.1)에 맞추는 보강이므로 이 행도 매칭 대상이 아니다.
4. **본질 판정**: 핵심 변경 3개 `.ts` 파일(`spec-frontmatter-parse.{ts,test.ts}`, `spec-pending-plan-existence.test.ts`)은 `codebase/frontend/src/lib/docs/__tests__/` 아래의 **spec/plan frontmatter 검증 하니스**다. 신설된 순수 함수 `isPendingPlanPath` 는 spec frontmatter 의 `pending_plans:` 항목이 실제 work-plan 경로(`plan/in-progress/**.md` 또는 `plan/complete/**.md`)를 가리키는지 판별하는 build-time 가드이며, 사용자에게 노출되는 노드·UI·통합·인증·표현식·실행/디버깅 흐름 중 어느 것도 바꾸지 않는다. 나머지 파일(plan 문서 2개, review/code 및 review/consistency 산출물 25개)은 작업 추적·리뷰 산출물이며 코드 변경이 아니다.
5. **i18n / warning-code / locale 관점 개별 확인**: `dict/{ko,en}/`, `backend-labels.ts`(`WARNING_KO`/`ERROR_KO`), `SECTION_LABELS_BY_LOCALE`, docs MDX 어느 것도 diff 에 등장하지 않는다 — 애초에 매칭된 trigger 가 없으므로 이들에 대한 누락 여부를 논할 대상 자체가 없다.
6. 참고: `review/code/2026/09/24/19_57_00/user_guide_sync.md`(직전 라운드, 이번 changeset 안에 커밋된 파일)도 동일 changeset 을 놓고 독립적으로 같은 결론(매칭 0건, NONE)에 도달해 있다. 이번 라운드에서 추가된 `CHANGELOG.md` 백필과 `RESOLUTION.md` 등은 리뷰 절차 산출물이며 매트릭스 어느 trigger 에도 해당하지 않는다.

## 요약

매트릭스 21개 trigger(glob 10 + semantic 11) 전수를 이번 changeset(32개 파일: spec/plan frontmatter 검증용 `.ts` 3개 + `CHANGELOG.md` + plan 문서 2개 + 직전 code-review/consistency-check 산출물 25개)과 대조한 결과 매칭되는 trigger 가 0건이다. 변경이 `codebase/backend/src/nodes`·`*.tsx`·`content/docs`·`modules/auth`·`packages/expression-engine`·`error-codes.ts`·`spec/**` 등 어떤 trigger glob/semantic 범주에도 해당하지 않는 내부 harness(spec-frontmatter 가드) 강화이므로 유저 가이드 동반 갱신 관점에서는 영역 무관(해당 없음)이다.

## 위험도

NONE
