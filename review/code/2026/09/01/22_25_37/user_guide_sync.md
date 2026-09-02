# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 총 20행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑
(127~221행) 을 SSOT/보조로 Read 했다.

## 변경 파일 컨텍스트 (68개, prompt 번들 기준)

전량이 다음 4개 카테고리에 속한다 — **매트릭스가 지목하는 어떤 경로에도 걸치지 않는다**:

1. **harness 내부** — `.claude/docs/plan-lifecycle.md`, `.claude/hooks/_lib/plan_guard.py`,
   `.claude/tests/test_plan_guard.py` (체크박스 정규식이 blockquote 를 넘도록 확장 + 테스트)
2. **frontend docs *가드* 테스트** (사용자 가이드 *콘텐츠* 아님) —
   `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (멀티라인 앵커 케이스 보강),
   `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규 — `plan/`·`spec/` 오염
   태그 탐지 가드). 둘 다 `codebase/frontend/src/content/docs/**` 의 *검증 로직*을 다루지,
   `02-nodes/`·`06-integrations-and-config/` 등 사용자 노출 MDX 본문을 편집하지 않는다.
3. **plan 트래킹 문서** (`plan/complete/*.md` 4건 — 도구 잔재 태그 `</content>`/`</invoke>` 제거,
   `plan/in-progress/*.md` 3건 — 체크리스트·frontmatter 갱신)
4. **review 세션 산출물** (`review/consistency/2026/09/01/{21_30_10,21_36_28,21_39_47,21_46_05,
   21_49_21,21_56_30}/**` — `spec-draft-error-code-two-surfaces.md` 를 5라운드에 걸쳐 검토한
   `/consistency-check --spec` 산출물, 봉인된 시점 기록)
5. **spec 규약 문서 1건** — `spec/conventions/error-codes.md` §Overview 에 `EngineErrorCode` 를
   `ErrorCode` 와 나란히 대표 surface로 병기하는 2문단 추가

`codebase/backend/src/nodes/**`, `codebase/frontend/src/content/docs/02-nodes/**.mdx`,
`codebase/frontend/src/lib/i18n/dict/**`, `codebase/frontend/src/lib/i18n/backend-labels.ts`,
`codebase/frontend/src/content/docs/06-integrations-and-config/**`,
`codebase/frontend/src/content/docs/<NN>-<name>/`(신규), `codebase/frontend/src/lib/docs/locale.ts`,
`codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`,
`codebase/backend/src/nodes/core/error-codes.ts`(실 코드) — **이 changeset 안 어디에도 없다.**

## trigger 매칭 검토

- **new-node / node-schema-change / new-ui-string / new-widget-chrome-string /
  integration-provider-change / new-userguide-section-dir / backend-api-change /
  new-bullmq-queue / new-warning-code / new-error-code(코드) / new-cross-cutting-enum /
  new-backend-ui-zod-value / new-handler-output-field / auth-session-flow-change /
  auth-config-type-enum-change / expression-language-change / run-debug-flow-change /
  env-runtime-change / userguide-gui-flow-section / spec-defect-found** — 매칭되는 변경 파일
  없음. (`.claude/hooks/_lib/plan_guard.py` 는 `codebase/backend/src/modules/auth/**` 가 아니라
  harness plan 가드이므로 auth-session-flow-change 오매칭 아님. `plan/in-progress/
  expression-engine-error-shape-spec-broken-on-main.md` 는 `codebase/packages/expression-engine/**`
  실 코드가 아니라 그 문서를 *추적하는* plan 파일 1줄 체크박스 갱신이므로 expression-language-change
  오매칭 아님.)

- **spec-major-change** (`spec/conventions/**` glob) — `spec/conventions/error-codes.md` 가
  매칭된다. targets: (a) frontmatter `code:`/`status:`/`pending_plans:` 정합 (b) `status: partial`
  이면 `pending_plans:` 신설 (c) `status: implemented` 면 `code:` 글로브 ≥1 매치.
  **실측**: 이 diff 는 §Overview 본문 2문단만 추가하고 frontmatter(`status: implemented`,
  `code: codebase/backend/src/nodes/core/error-codes.ts`)는 건드리지 않았다. `code:` 가 가리키는
  파일은 실존하며 그 안에 `ErrorCode`(:8)·`EngineErrorCode`(:147) 가 실제로 함께 존재함을
  같은 changeset 안의 `review/consistency/**/naming_collision.md`·`cross_spec.md` 산출물이 독립
  실측으로 재확인했다 — `status: implemented` 조건의 "code: 글로브 ≥1 매치" 는 이미 충족 상태이고
  이번 변경으로 깨지지 않는다. `pending_plans:` 조건은 `status: partial` 이 아니므로 미해당.
  **갭 없음.**

## 발견사항

없음.

## 요약

매트릭스 20행 중 glob 매칭 가능 대상(`spec/conventions/**`)에 걸린 1행(`spec-major-change`)이
있었으나 frontmatter 정합 조건을 실측 확인한 결과 이미 충족 상태라 갱신 누락이 아니다. 나머지
19행(신규 노드·schema·UI 문자열·통합/제공자·신규 섹션 디렉토리·auth 흐름·표현식 언어·실행/디버깅
흐름·warning/error code 등)은 이번 changeset 의 어떤 파일과도 매칭되지 않는다 — 전량이 harness
내부 파일(`.claude/**`), docs *가드* 테스트(`lib/docs/__tests__/**`, 사용자 노출 MDX 아님), plan
트래킹 문서, `/consistency-check --spec` 세션 산출물(`review/consistency/**`), 그리고 이미
구현된 `EngineErrorCode` const 를 규약 문서에 사후 등재하는 1건의 spec 편집으로 구성돼 있다.
User Guide Sync 관점에서 이 changeset 은 **해당 없음**이다.

## 위험도

NONE
