# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — error-code-emission-axis

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows 21개, id: new-node ~ spec-defect-found) 을 SSOT 로
적재하고, `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 nuance 보조로 확인했다. 변경 파일
목록은 `meta.json`(16개 파일) 기준 — `CHANGELOG.md` · `PROJECT.md` · `02-nodes/logic{,.en}.mdx` ·
`guide-identifier-{existence.test,scan}.ts` · `plan/in-progress/{error-code-emission-axis,
spec-draft-nullable-notation-followups}.md` · `review/consistency/2026/09/13/18_40_54/**`(8개).

핵심 관찰: 이 변경 set 안에는 **`codebase/backend/src/**` 파일이 단 하나도 없다.** 21개 매트릭스
행 중 트리거가 `codebase/backend/src/**` glob 이거나("새 노드 추가"·"노드 schema 변경"·
"신규 errorCode 발행"·"신규 BullMQ 큐") 백엔드 소스 semantic 변경을 전제하는 행("신규
warningCode 발행"·"인증·권한·세션 흐름 변경"·"AuthConfig type enum 변경"·"표현식 언어 변경"·
"실행·디버깅 흐름 변경"·"백엔드 API 추가·변경" 등)은 전부 트리거 자체가 성립하지 않는다 —
이 PR 은 `execution-engine.service.ts`/`loop-executor.ts`/`execution-failure-classifier.ts` 를
**인용만** 하고 실측 근거로 삼을 뿐, 코드를 고치지 않았다(문서·가드 테스트만 변경).

이하 개별 판단:

- **new-node / node-schema-change** — 트리거(`codebase/backend/src/nodes/**`) 미성립.
- **new-ui-string** — 변경 set 에 `.tsx` 파일이 0개(meta.json 확인). 미성립.
- **new-widget-chrome-string / integration-provider-change / new-bullmq-queue /
  auth-*-change / expression-language-change / run-debug-flow-change /
  env-runtime-change** — 전부 backend 소스 또는 해당 영역 파일 변경이 전제인데 이 변경
  set 에는 없음. 미성립.
- **new-warning-code / new-error-code** — 오히려 **역방향**이다. 이 PR 의 실질 내용은
  "`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 구조화된 `error.code` 로 발행되지
  **않는다**"는 실측(`execution-engine.service.ts:8016` — `nodeExec.error = { message }`,
  `code` 필드 없음)을 가이드·가드에 반영한 것이다. `error-codes.ts`/`warningRules` 자체가
  변경되지 않았으므로 `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 동반 갱신 의무도
  성립하지 않는다 — 애초에 매핑할 신규 enum 값이 없다.
- **new-userguide-section-dir** — `codebase/frontend/src/content/docs/*/` **신규 디렉토리**
  없음(기존 `02-nodes/` 안의 기존 파일 2개를 수정). 미성립.
- **spec-major-change** — 트리거 glob(`spec/2-*`~`spec/5-*`, `spec/conventions/**`)에 해당하는
  파일이 이 diff 에 없음(spec 파일 변경 자체가 없다). 미성립. *(참고: 이 PR 의 plan 이 spec
  6개 파일의 `CONTAINER_*` "코드" 서술과의 불일치를 스스로 인지하고 있으나, 그건 **이번에
  spec 을 고치지 않았기 때문**이지 이번 diff 가 spec 을 건드리고 방치한 것이 아니다. 이미
  `review/consistency/2026/09/13/18_40_54/{cross_spec,rationale_continuity}.md` WARNING #2·#3
  및 이 라운드의 `documentation.md` WARNING 이 "plan 미등재" 관점에서 지적했고 내 영역
  — docs MDX / i18n dict / backend-labels 동반 갱신 — 과는 축이 다르다.)*
- **userguide-gui-flow-section** (glob `02-nodes/**.mdx`, match semantic) — `logic.mdx`/
  `logic.en.mdx` 가 glob 후보에는 걸린다. 다만 실측하면: (a) `logic.mdx` 전체에
  `<ImplAnchor>` 가 **0개**(`grep` 확인 — `triggers.mdx`/`triggers.en.mdx` 에만 존재),
  (b) `integrations-coverage.test.ts`/`triggers-coverage.test.ts` 의 대상은 각각
  `06-integrations-and-config/`·`02-nodes/triggers.mdx` 로 한정되고 `logic.mdx` 는 대상이
  아니다(`spec/conventions/user-guide-evidence.md §2` 확인), (c) 변경 내용도 기존
  `<Callout type="warn">` 안 문장 정정이지 "GUI 흐름 절"(`findGuiFlowSections()` 이 찾는
  heading/`**GUI**` bold 신호)이 아니다. **트리거 후보였으나 실질 미해당으로 판단** — 신규
  ImplAnchor 요구 없음.
- **spec-defect-found** (match semantic) — 이 PR 이 spec 6파일과의 불일치를 스스로 발견했다는
  점에서 후보다. 요구 타겟은 "`plan/in-progress/spec-update-<name>.md` 에 제안 노트 작성 후
  project-planner 위임"인데, 실제로는 신규 전용 파일 대신 **기존** 트래커
  (`spec-draft-nullable-notation-followups.md:3419-3461`)에 두 항목(spec 6파일 서술 정정 +
  §1.4 카탈로그 택일)을 상세 표·근거와 함께 등재했다 — 이 저장소가 반복 관찰해 온 "기존
  트래커 재사용" 관행과 일치한다. project-planner 위임 여부(다음 턴)는 이 diff 의 범위
  밖이라 판정 불가. **이 축의 "plan 등재 자체"는 이미 이 라운드의 `documentation.md` 가
  체크박스 미갱신·consistency WARNING 2건의 plan 미이관을 지적했으므로 중복 지적하지
  않는다.**

## 발견사항

- 없음(매트릭스 어떤 행도 "누락된 동반 갱신" 을 요구하지 않는다).

## 요약

이 변경 set 은 `codebase/backend/src/**` 를 전혀 건드리지 않고(문서 2개 + 가드 테스트/스캐너
2개 + plan/review 산출물만 수정), doc-sync-matrix 21개 행 중 backend 소스 트리거를 요구하는
행은 전부 미성립이며, "새 UI 문자열"·"신규 섹션 디렉토리"·"신규 warning/error 코드"도 해당
파일·조건이 없어 미성립이다. glob 후보로 걸렸던 "userguide-gui-flow-section"(02-nodes mdx)은
실측(`ImplAnchor` 0개 + coverage 가드가 `logic.mdx` 를 대상으로 안 함 + GUI 흐름 절 아님)으로
미해당 확정했고, "spec-defect-found"는 신규 전용 파일 대신 기존 트래커에 상세 등재돼 있어
형식은 어긋나지만 실질 요건(제안 노트 작성)은 충족한다 — 이미 다른 리뷰어(`documentation.md`)가
plan 등재 완전성 관점에서 다뤘으므로 여기서 중복하지 않는다. KO/EN 가이드 문장(`logic.mdx:114`,
`logic.en.mdx:103`)도 같은 diff 안에서 함께 수정돼 parity 문제가 없다. 매트릭스 트리거
개수=21, 매칭 후보=2(userguide-gui-flow-section, spec-defect-found — 둘 다 실측 후 미해당/이관
불요로 판정), 확정 누락=0.

## 위험도

NONE
