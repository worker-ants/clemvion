# 변경 범위(Scope) 리뷰 — plan-lifecycle-gates

## 진단 요약

이 diff 는 26개 파일, 대부분 `plan/**` markdown 이다. 실제 "코드" 변경은 2개뿐이다:

1. `.claude/docs/plan-lifecycle.md` — 신규 게이트 2종(완료 plan 의 `status` 종료값 검증, 살아있는 plan
   의 상대링크 무결성) 문서화.
2. `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` — 위 두 게이트의 실제 구현
   (`collectCompletedPlans`/`TERMINAL_STATUSES`/`relativeLinkTargets` 헬퍼 + `describe` 2개).

나머지 24개 `plan/**` 파일은 전부 위 신규 게이트가 즉시 걸어 넘어뜨릴 **기존 위반**을 고치는 기계적
후속 수정이다 — `plan/complete/spec-draft-secret-store-verification-footnote.md`(신설, 이 작업의
"후속" 섹션이 정확히 파일 1·2 의 내용을 예고)의 자기 서술과 완전히 일치한다. 각 파일을 개별 확인한
결과는 다음과 같다.

## 발견사항

- **[INFO]** 신규 ad-hoc frontmatter 필드 `merged_pr` 도입이 `plan-lifecycle.md §4` 스키마 표에 등재되지 않음
  - 위치: `plan/complete/c1-pr2-aiturn-blueprint.md:5` (`+merged_pr: 625`)
  - 상세: 기존 `status: complete (PR #625 머지)` 의 자유서술을 `status: complete` + `merged_pr: 625` 로
    분리했다. 저장소 전수 검색 결과 `merged_pr:` 필드는 이 파일 1건에만 존재한다(신규 1회성 필드).
    `plan-lifecycle.md §4` 가 "`priority`/`status`/`title` 등 추가 필드는 허용" 이라 규약 위반은 아니고,
    도입 근거도 신설 plan(`spec-draft-secret-store-verification-footnote.md` §후속)에 명확히 남아 있다
    (YAML 파서가 `^status:\s*(\S+)` 정규식 카운트를 정정해 발견됐다는 경위). 다만 `plan-lifecycle.md`
    본문 스키마 절에는 이 필드가 컨벤션으로 등재되지 않아, 다음 사람이 유사 케이스(자유서술이 섞인
    `status`)를 만나면 같은 판단을 반복해야 한다.
  - 제안: 선택 사항 — `plan-lifecycle.md §4` 에 "`status` 는 자유서술 없이 순수 리터럴만; PR 번호 등
    부가정보는 별도 필드(예: `merged_pr`)로 분리" 한 줄만 추가하면 재발을 막을 수 있다. 리뷰 차단 사유는
    아니다.

- **[없음/확인됨]** 나머지 22개 `plan/**` diff 는 전부 다음 두 클래스 중 하나에 정확히 속하며, 각 unified
  diff 를 hunk 단위로 재확인한 결과 부가 변경(포맷팅·주석·무관 문구 수정)이 섞여 있지 않다.
  - **(a) `status: in-progress` → `status: complete` 단일 라인 교체** (17개 파일: `activity-disconnected-banner.md`,
    `audit-residual-triage.md`, `auth-workspace-membership-guard.md`, `backend-msg-i18n-impl.md`,
    `dep-hygiene-tailwind-postcss.md`, `eia-strip-llmcalls.md`, `fix-resume-turn-usage-log-attribution.md`,
    `ie-endmultiturn-errorpayload-contract.md`, `postcss-lockfile-drift-fix.md`, `refactor-cron-to-bullmq.md`,
    `review-info-followups.md`, `spec-integration-error-code-doc-fix.md`, `spec-workflow-version-snapshot-drift.md`,
    `system-status-page.md`, `workflow-duplicate-nodes-edges.md` 등) — 신규 Gate(a) 가 요구하는
    종료 상태 정합을 맞추는 필수 companion fix.
  - **(b) 깨진 상대링크(`plan/**` 간, 또는 `plan/**` → `spec/**`) 경로 정정** (`execution-engine-residual-gaps.md`,
    `node-cancellation-residual-signal-propagation.md`, `rag-quality-improvement.md`,
    `spec-fix-swagger-forbidden-response.md`, `spec-update-node-cancellation-shutdown-classification.md`,
    `webchat-command-failure-is-not-termination.md`) — 신규 Gate(b) 가 요구하는 링크 무결성을 맞추는
    필수 companion fix. `spec-fix-swagger-forbidden-response.md` 의 `../5-system/1-auth.md` →
    `../../spec/5-system/1-auth.md` 정정도 같은 축(신규 테스트의 `relativeLinkTargets` 는 plan↔plan
    뿐 아니라 모든 상대링크를 검사하므로 스코프 내).
  - **plan 이동**: `plan/in-progress/spec-draft-secret-store-verification-footnote.md` →
    `plan/complete/`(동일 파일의 삭제+신설 쌍으로 표시됨, 사실상 `git mv`). 이 plan 문서 자체가
    "후속" 절에서 파일 1·2 의 게이트 작업을 예고하고 있어, `plan-lifecycle.md §3` 의 "이동은 마지막
    작업 PR 안에서" 규칙과 정확히 일치한다(별도 이동 PR 을 만들지 않은 것이 오히려 규약 준수).

- **[없음]** 파일 1·2(실제 코드/문서 변경)에 drive-by 리팩터링·불필요 임포트·무관 포맷팅은 없음
  - 확인: `plan-frontmatter.test.ts` 의 diff 는 새 함수(`collectCompletedPlans`/`relativeLinkTargets`)와
    새 `describe` 블록 2개(및 그에 필요한 `TERMINAL_STATUSES` 상수)만 추가한다. 기존 `import matter from
    "gray-matter"` 등은 diff 범위(hunk 시작 라인 16) 밖의 미변경 컨텍스트로, 이번 diff 가 새로 추가한
    임포트가 아니다. `plan-lifecycle.md` 의 diff 도 §4 안에 새 bullet 2개를 추가하는 것 외 기존 문장을
    건드리지 않았다.

## 요약

핵심 코드/문서 변경은 2개 파일(`plan-lifecycle.md`, `plan-frontmatter.test.ts`)에 정확히 국한되며,
새로 추가한 두 게이트(완료 plan 의 `status` 종료값 검증 / 살아있는 plan 상대링크 무결성)의 목적과
구현이 1:1 로 대응한다. 나머지 24개 `plan/**` 파일 변경은 표면적으로는 방대해 보이지만 전부 그 두
게이트가 기존 저장소 상태에 대해 즉시 fail 을 내는 항목을 미리 고치는 기계적 companion fix이며, 각
diff 를 hunk 단위로 대조한 결과 상태값 교체 또는 링크 경로 정정 외의 부가 변경(포맷팅·불필요 주석·
무관 리팩터링)은 발견되지 않았다. plan 이동(`spec-draft-secret-store-verification-footnote.md`)도
`plan-lifecycle.md §3` "이동은 마지막 작업 PR 안에서" 규칙에 부합하는 정당한 동반 커밋이다. 유일한
지적사항은 신규 ad-hoc 필드 `merged_pr` 가 스키마 문서에 등재되지 않은 INFO 수준 사소한 갭이며 차단
사유는 아니다.

## 위험도
NONE
