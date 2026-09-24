# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 22행) 을 Read.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문 (같은 커밋 diff 안에 포함되어 있어 동시 확인).

## 변경 파일 식별
prompt 에 포함된 변경 set (커밋 `1e047b716`, `git log`/`git show --stat HEAD` 로 대조 확인 — 추가 파일 없음):

1. `.github/workflows/spec-link-checks.yml` — CI 워크플로: pathspec 에 `plan/**` 추가 + 잡을 `spec-link-integrity.test.ts` 단일 파일 대신 `src/lib/docs/__tests__/` 디렉터리 전체 실행으로 확장
2. `PROJECT.md` — §문서 링크 검증 절의 서술을 위 워크플로 변경에 맞춰 갱신 (가드 하나 → 디렉터리 전체)
3. `plan/in-progress/docs-guard-trigger.md` — 본 작업의 plan 문서 (신규)
4~11. `review/consistency/2026/09/24/21_04_26/**` — 착수 전 `/consistency-check --impl-prep` 산출물 (SUMMARY.md, `_retry_state.json`, `meta.json`, 5개 checker 리포트) — 전부 BLOCK:NO, Critical/Warning 0

## trigger 매칭
매트릭스 22개 행의 glob/semantic trigger 를 위 변경 파일에 순서대로 대조했다:

- `codebase/backend/src/nodes/**` (new-node, node-schema-change) — 매칭 없음
- `codebase/frontend/src/**/*.tsx` (new-ui-string) — 매칭 없음
- `codebase/channel-web-chat/src/**/*.tsx` (new-widget-chrome-string) — 매칭 없음
- `codebase/frontend/src/content/docs/*/` (new-userguide-section-dir) — 매칭 없음
- `codebase/backend/src/**/*.controller.ts`, `dto/**` (backend-api-change) — 매칭 없음
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (new-bullmq-queue) — 매칭 없음
- `codebase/backend/src/nodes/core/error-codes.ts` (new-error-code) — 매칭 없음
- `codebase/backend/src/modules/auth/**` (auth-session-flow-change) — 매칭 없음
- `codebase/packages/expression-engine/**` (expression-language-change) — 매칭 없음
- `spec/2-*/**` ~ `spec/5-*/**`, `spec/conventions/**` (spec-major-change) — 매칭 없음 (변경된 것은 `PROJECT.md`·`plan/**`·`.github/**`·`review/**` 뿐, `spec/**` 는 이 diff 에 없음)
- `codebase/frontend/src/content/docs/02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` (userguide-gui-flow-section) — 매칭 없음
- 나머지 semantic 행(new-warning-code, new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-config-type-enum-change, run-debug-flow-change, env-runtime-change, spec-defect-found, integration-provider-change) — 의미상으로도 대응하는 코드 변경(node/backend 로직, UI, spec 본문)이 이 diff 에 전혀 없어 매칭 불가

즉 22개 trigger 행 중 **매칭된 행이 0개**다. 이번 변경은 CI 워크플로(`spec-link-checks.yml`)가 어떤 vitest 파일/디렉터리를 실행하는지, 그리고 그 사실을 서술하는 `PROJECT.md` 문단 자체를 조정한 것으로, `codebase/{backend,frontend,channel-web-chat,packages}` 의 제품 코드(노드·API·UI·표현식 엔진·인증)나 `spec/**` 본문을 전혀 건드리지 않는다. `plan/in-progress/docs-guard-trigger.md` 는 본 작업 자체의 plan 문서이고, `review/consistency/**` 산출물은 착수 전 검토 기록이다 — 둘 다 doc-sync 매트릭스가 지키려는 "제품 코드 변경 → 유저 가이드/i18n" 흐름의 입력이 아니라 harness/프로세스 부산물이다.

## 동반 갱신 누락 검출
매칭된 trigger 가 없으므로 검출 대상 없음.

## 참고 (비차단)
- `PROJECT.md` 변경 자체는 이 리뷰어의 매트릭스가 지키는 "코드 → 유저 가이드" 방향이 아니라 반대 방향(하네스 설명 문서를 하네스 변경에 맞춰 갱신)이며, 실제로 착수 전 `/consistency-check --impl-prep` (`review/consistency/2026/09/24/21_04_26/SUMMARY.md`) 에서 `cross_spec`/`naming_collision` checker 가 정확히 이 stale 서술 리스크를 INFO 로 지적했고 커밋에 반영되어 있다 — 별도 조치 불요.
- `.claude/config/doc-sync-matrix.json` 자체는 이번 diff 에 없다 — PROJECT.md §변경 유형 매핑 표(사람용 뷰)도 변경되지 않았으므로 두 SSOT 간 divergence 우려 없음 (`test_doc_sync_matrix.py` 스코프 밖).

## 요약
매트릭스 22개 trigger 행 중 이번 변경(CI 워크플로 `spec-link-checks.yml` 확장 + `PROJECT.md` 해당 절 갱신 + plan/consistency-review 산출물)에 매칭되는 행은 0개다. `codebase/backend/src/nodes/**`·`codebase/frontend/src/**/*.tsx`·`spec/**` 등 실제 제품 코드/spec 경로가 diff 에 전혀 없어 노드·i18n dict·backend-labels·docs MDX·섹션 locale 동반 갱신 의무 자체가 발생하지 않는다. 유저 가이드 동반 갱신 관점에서는 "해당 없음".

## 위험도
NONE
