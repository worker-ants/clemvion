# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — error-code-emission-axis

## 검토 방법

`.claude/config/doc-sync-matrix.json`(rows 21개, SSOT)을 Read 하고 `PROJECT.md` §변경 유형 →
갱신 위치 매핑 표 + §297~311 가드 목록을 보조로 Read 했다. `git diff --stat origin/main...HEAD --
'codebase/**'` 로 실제 codebase 변경 범위를 재확인한 결과 4개 파일뿐이다:

```
codebase/frontend/src/content/docs/02-nodes/logic.en.mdx          |   2 +-
codebase/frontend/src/content/docs/02-nodes/logic.mdx              |   2 +-
codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts | 479 ++++-
codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts           | 245 ++++-
```

나머지(`CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/**`, `review/**`)는 문서/plan/리뷰
산출물이라 매트릭스 trigger 후보가 아니다. 이 배치의 본질은 유저 가이드(`logic.mdx`/
`.en.mdx`)가 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 구조화된 `error.code` 인 것처럼
서술하던 결함을 "메시지 접두일 뿐 전용 코드는 없다"로 정정하고, 같은 형태의 drift 를 막는
가드(`guide-identifier-scan.ts` 의 "발행 축")를 보강한 것 — 즉 **이 reviewer 의 관할 영역 자체를
강화하는 변경**이다.

이 리뷰는 이번 PR 의 6번째 `/ai-review` 라운드다. 동일 코드 변경 범위(4파일)에 대해 이 reviewer 는
이미 3라운드 연속(`19_51_33`, `20_34_32`, `21_19_46`, 전부 저장소에 커밋됨) NONE 을 냈다. 이번
라운드에서 `codebase/**` 변경분이 이전 라운드와 동일함을 `git diff --stat` 으로 재확인했으므로
그 판정을 유지하되, 21개 행 전수를 다시 대조했다.

## 매트릭스 매칭 결과 (21행 전수 대조)

- **`userguide-gui-flow-section`** (trigger glob `codebase/frontend/src/content/docs/02-nodes/**.mdx`,
  match semantic) — `logic.mdx`/`logic.en.mdx` 가 glob 상 매칭된다. 하지만:
  - `grep -n "ImplAnchor" codebase/frontend/src/content/docs/02-nodes/logic.mdx` → 0건 (파일
    전체에 `<ImplAnchor>` 없음, 애초에 이 mdx 는 그 의무의 적용 대상 파일이 아니다)
  - `integrations-coverage.test.ts`/`triggers-coverage.test.ts` 의 검사 대상은 각각
    `06-integrations-and-config/`·`02-nodes/triggers.mdx` 로 한정되고 `logic.mdx` 는 대상 밖
  - 변경 내용도 `<Callout type="warn">` 안 한 문장의 정정(실행 실패 시 무엇이 붙는지 서술)이지,
    PROJECT.md §274 가 명시하는 "GUI 흐름 절"(예: "1. 좌측 메뉴 → Triggers 클릭")이 아니다.
  - **회색지대이나 실질 갭 없음 → 신규 ImplAnchor 요구 불성립.**
- **`new-warning-code` / `new-error-code`** — `codebase/backend/src/nodes/core/error-codes.ts`,
  `warningRules` 자체는 이 diff 에 없다. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는
  가이드 정정 대상 토큰일 뿐 `ErrorCode` enum 멤버가 아니며(그것이 바로 이 PR 이 고친 오해),
  `grep -rn "CONTAINER_MISSING_EMIT\|CONTAINER_MULTIPLE_EMIT" codebase/frontend/src/lib/i18n/`
  → 0건. `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 동반 갱신 의무는 매핑할 신규 enum 값이
  없어 성립하지 않는다.
- **`new-node` / `node-schema-change`** — trigger glob `codebase/backend/src/nodes/**` 미매칭
  (해당 경로 무변경).
- **`new-ui-string`** — trigger glob `*.tsx` 미매칭 (tsx 파일 무변경).
- **`new-userguide-section-dir`** — `02-nodes/` 는 기존 디렉토리이며 신규 디렉토리가 아니다. 미매칭.
- **`integration-provider-change` / `new-widget-chrome-string` / `auth-session-flow-change` /
  `auth-config-type-enum-change` / `expression-language-change` / `run-debug-flow-change` /
  `new-bullmq-queue` / `env-runtime-change` / `new-cross-cutting-enum` / `new-backend-ui-zod-value` /
  `new-handler-output-field` / `backend-api-change`** — 트리거 전제(backend provider/auth/expression-
  engine/실행엔진/env/enum/zod/output-field/controller·DTO 변경) 자체가 이 diff 에 없음. 전부 미성립.
- **`spec-major-change`** — `spec/2-*/**` ~ `spec/conventions/**` 무변경. 미매칭.
- **`spec-defect-found`** — 이 PR 이 spec 6~7파일과 `CONTAINER_*` 서술 불일치를 스스로 발견했다는
  점에서 후보이나, 형식은 신규 전용 파일이 아닌 **기존** 트래커(`plan/in-progress/spec-draft-
  nullable-notation-followups.md`)에 등재했다(선행 라운드들이 이미 이 판단을 냈고 이번 라운드도
  등재 위치가 바뀌지 않았다 — `git diff --stat` 상 `plan/in-progress/error-code-emission-axis.md`
  가 신규 파일로 잡혀 실질 추적 문서 역할을 한다). project-planner 위임 여부는 developer 권한
  밖의 다음 턴 사안이라 이 reviewer 의 범위(동반 갱신 누락 검출) 밖이다.

## KO/EN parity 확인

`git diff origin/main...HEAD -- codebase/frontend/src/content/docs/02-nodes/logic.mdx
codebase/frontend/src/content/docs/02-nodes/logic.en.mdx` 로 재확인 — 두 파일이 **같은 diff 안에서
동일한 의미로 함께** 정정됐다("전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요" ↔
"there is no dedicated error code, so read the message rather than the code."). 한쪽만 고치는
전형적 parity 실패 패턴 없음.

## 발견사항

없음 — 매트릭스 21개 행 중 어느 것도 "누락된 동반 갱신"을 가리키지 않는다.

## 요약

이번 배치는 `codebase/backend/src/**` 를 전혀 건드리지 않고(node/schema/error-code/warning-code/
auth/expression-engine/실행엔진 변경 0), frontend 변경도 doc mdx 2개(KO+EN 동시 정정) + 가드
테스트/스캐너 2개로 국한된다. 매트릭스 21개 trigger 를 전수 대조한 결과 glob 상 매칭된
유일한 행(`userguide-gui-flow-section`)도 실측(`ImplAnchor` 0개·coverage 가드 대상 밖·GUI 흐름
절 아님)으로 미해당이며, 나머지 20개 행은 애초에 trigger 전제(backend 소스·tsx·신규 디렉토리·
spec 대규모 변경 등)가 이 diff 에 없다. 오히려 이 PR 은 가이드가 실제로 방출되지 않는 토큰을
`error.code` 처럼 서술하던 결함을 KO/EN 동시 정정하고 재발 방지 가드(발행 축)까지 같은 PR 에
포함시킨, 매트릭스가 지향하는 이상적인 동반 갱신 사례다. 이 판정은 동일 코드 변경 범위에 대해
이미 3라운드 연속 낸 NONE 판정과 일치한다(`19_51_33`·`20_34_32`·`21_19_46`). 확정 누락 = 0.

## 위험도

NONE
