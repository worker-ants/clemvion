# 테스트(Testing) 코드 리뷰

## 범위에 대한 메모

이번 changeset(125개 파일)은 이미 이 changeset 안에서 4라운드의 `/ai-review`(22_25_37 →
22_44_29 → 23_09_35 → 23_28_32)를 거쳤고, 매 라운드 testing reviewer 가 발견한 문제(비대칭
카운팅 반대방향 오탐, 합계-하한 vacuous 테스트 2회, `readonly string[]` 타입 안전성,
`skipDir("archive")` 무검증 분기, fixture 검증 폭 협소 등)가 그때그때 RESOLUTION 으로 수정·
테스트 보강됐다. 실제 "코드"에 해당하는 변경은 5개 파일(`.claude/hooks/_lib/plan_guard.py`,
`.claude/tests/test_plan_guard.py`, `codebase/backend/src/nodes/core/error-codes.ts`(주석만),
`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`,
`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`,
`codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`)뿐이고, 나머지는 `plan/**` 트래킹
문서와 `review/**` 세션 산출물(자동 생성)이라 이 관점의 채점 대상이 아니다. 아래는 6개 실
코드 파일의 현재(누적 수정 반영) 상태를 직접 열어 확인한 결과다.

## 발견사항

- **[INFO]** `plan_guard.py` 의 체크박스 스캐너가 코드펜스(``` ``` ```) 를 건너뛰지 않고, 그 상태가 테스트로 고정되지도 않았다 — 이번 PR 이 정규식을 blockquote 로 넓히면서 blast radius 가 소폭 커졌다
  - 위치: `.claude/hooks/_lib/plan_guard.py` `_all_checkboxes_done()` (라인 248-286, 특히 `_CHECKBOX` 매치 루프에 코드펜스 상태 추적이 없음) / `.claude/tests/test_plan_guard.py` `FilesystemHelpersTest` (펜스 안 체크박스에 대한 케이스 없음)
  - 상세: 같은 changeset 의 `spec-links.test.ts` 는 `findBrokenPlanLinks` 가 코드펜스 안 링크를 무시하는 것을 fixture 로 명시적으로 고정한다(`"ignores links inside fenced code blocks"`). 그런데 `plan_guard.py` 쪽 체크박스 스캐너는 YAML frontmatter 는 건너뛰면서도 코드펜스는 건너뛰지 않는다 — 이는 이번 PR 이전부터 있던 특성(다른 리뷰어의 side_effect.md 가 "pre-existing" 으로 기록)이지만, 이번 PR 은 정규식 앵커를 blockquote 접두까지 넓혔다. 그 결과 "이 정규식을 설명하는 예시" 를 `> - [ ] 예시` 형태로 코드펜스 안에 적는 문서(정확히 지금 이 PR 이 만든 종류의 설명적 예시)가 실제로 열린 항목처럼 거부권을 행사할 표면이 넓어졌다. `_CHECKBOX`/`_all_checkboxes_done()` 근처 어디에도 이 상태를 잠그는 테스트가 없다.
  - 제안: 차단 사유는 아니다(리뷰어 다수가 이미 "pre-existing, 이번 diff 의 신규 gap 아님" 으로 처분했고 그 판단에 동의한다). 다만 테스트 커버리지 관점에서는 `spec-links.test.ts` 의 코드펜스 fixture 와 대칭되는 케이스(`body="## tasks\n- [x] a\n\`\`\`md\n> - [ ] 펜스 안 예시\n\`\`\`\n"` → `_all_checkboxes_done` 이 여전히 `True`)를 `FilesystemHelpersTest` 에 하나 추가해 두면, 이 gap 이 "알려진 상태" 에서 "테스트로 봉인된 상태" 로 바뀐다. 급하지 않음.

- **[INFO]** `tree-walk.ts` 의 `readonly string[]` 시그니처 수정을 잠그는 회귀 테스트가 없다 (이미 별도로 등재된 근본 원인의 재확인)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:67-73` (`walkTree` 시그니처), `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts`(해당 타입 케이스 없음)
  - 상세: `bases: string[]` → `bases: readonly string[]` 로 넓힌 이번 수정은 TS2345 를 없애는 타입-레벨 변경인데, `tsconfig.json` 이 `src/**/__tests__/**` 를 typecheck 대상에서 제외하고 `vitest run` 은 타입을 strip 한다 — 즉 이 디렉터리의 어떤 CI 게이트도 이 수정이 다시 `string[]` 으로 좁혀지는 회귀를 잡지 못한다. 직접 확인: `grep -n "typecheck-ratchet\|frontend.*typecheck" plan/in-progress/harness-review-gate-followups.md` → 라인 192-194 에 이 근본 원인(backend 는 `typecheck-ratchet` 잡이 있는데 frontend 대응이 없음)이 4라운드 RESOLUTION 에서 이미 등재돼 있고 "이번 PR 에서 CI 워크플로 신설은 안 한다" 는 처분도 명시돼 있다.
  - 제안: 새 조치 불요 — 이미 트래킹된 항목의 재확인일 뿐이다. 재개 신호(다음 harness 가드 추가 시 함께)를 그대로 따르면 된다.

## 확인했으나 문제 없음 (근거 기록)

- `test_plan_guard.py` 의 비대칭 카운팅 테스트 스위트(`test_open_checkbox_inside_blockquote_counts`, `test_nested_blockquote_open_checkbox_counts`, `test_narrative_bracket_mention_is_not_a_checkbox`, `test_quoted_done_checkbox_alone_is_not_completion`, `test_own_done_plus_quoted_done_is_completion`, `test_quoted_open_still_vetoes_alongside_own_done`)는 열린/닫힌 두 방향의 참/거짓 경로를 모두 독립 케이스로 고정하고 있다. 특히 `test_own_done_plus_quoted_done_is_completion`(참 경로)과 `test_quoted_open_still_vetoes_alongside_open_done`(원 결함 캐너리)이 함께 있어, 비대칭 카운팅이 "너무 좁아져 참 경로까지 먹는" 방향과 "너무 넓어져 원 결함이 되살아나는" 방향을 양쪽 다 잠근다 — 3라운드에 걸쳐 실제로 두 방향 다 뮤테이션으로 반증된 이력(RESOLUTION 기록)과 일치한다.
- `stray-tool-tags.test.ts` 의 `it("archive/ 는 스캔하지 않는다 — 그 밖은 스캔한다 (대조군 포함)")` 는 `plan/complete/archive/from-x`·`spec/archive` 두 자리에 제외 대상을 심고 `plan/complete/kept.md` 를 대조군으로 함께 심는다 — `skipDir` 이 이름(basename) 판정이라는 계약과 스코프(두 루트 다 적용됨)를 fixture 가 동시에 검증한다. 대조군이 없으면 "0건" 이 제외 때문인지 스캔 실패 때문인지 안 갈린다는 원칙(이 파일 자체 헤더 주석)이 이 케이스에서도 실제로 지켜지고 있다.
- `it("[전제] 스캔 루트가 기대 목록 그대로다 …")` 가 `EXPECTED_ROOTS` 를 테스트 본문의 리터럴(`["plan", "spec"]`)로 못박고 `SCAN_ROOTS`/`MIN_EXPECTED_MD_FILES` 양쪽과 대조한다 — "집합에서 케이스를 파생하면 집합을 줄이는 편집이 조용히 통과한다" 는 2라운드 반증(리터럴 없이 `it.each(SCAN_ROOTS)` 로 파생했을 때 `SCAN_ROOTS` 축소 뮤턴트가 RED 없이 통과)을 실제로 막는 형태다.
- `spec-links.test.ts` 의 `findBrokenPlanLinks` fixture 는 `plan/complete/sealed.md` 에 의도적으로 깨진 링크를 심어 두고 "그 위반이 결과에 없을 것" 과 "같은 스캔이 살아있는 쪽(`live.md`) 위반은 실제로 잡고 있을 것" 을 한 테스트에서 함께 단언한다(대조군 부재로 인한 vacuous 판정 불가 상태를 배제). `plan-lifecycle.md` 에 새로 명문화된 "`plan/complete/**` 제외는 의도된 설계" 계약과 정확히 대응한다.
- `_QUOTED`/`_CHECKBOX` 정규식 모두 중첩 정량자가 없는 선형 문자 클래스 확장이라 카타스트로픽 백트래킹 표면이 없고, `stray-tool-tags.test.ts` 의 `STRAY_TAG_LINE` 도 `[^>]*` 하나뿐인 선형 패턴이다 — 성능/ReDoS 관점은 별도 리뷰어가 이미 확인했고 테스트 관점에서도 재확인해 문제없다.
- `EvaluatePlanDecisionTableTest`(mock 기반 조합 테스트)와 `PorcelainPathSurvivesOnARealRepoTest`(실제 git 저장소로 구동)의 역할 분리가 명확하다 — 전자는 `evaluate_plan()` 의 판정 테이블(코드북 변경 × 링크된 plan × 처리 여부 × 완료 여부)만 격리해서 보고, 후자는 그 mock 이 가려버리는 `_run_git`/`_porcelain_path` 실제 파싱 결함(선행 공백 strip 버그, 이전 라운드에서 실제로 발생)을 잡는다. 이 분리 자체가 docstring 에 근거와 함께 설명돼 있고 실제 구조도 그 설명과 일치한다.

## 요약

핵심 실 코드 변경(plan_guard.py 정규식 확장, stray-tool-tags.test.ts 신규 가드, spec-links.test.ts 보강, tree-walk.ts 타입 수정)은 이미 4라운드의 반복 리뷰·뮤테이션 검증을 거치며 비대칭 카운팅 반대방향 오탐, 임계값 vacuous 테스트, fixture 검증 폭 협소, 타입 안전성 등 실질적 결함이 모두 발견 즉시 테스트로 봉인됐다. 이번 라운드에서 직접 소스를 열어 확인한 결과 새로운 CRITICAL/WARNING 급 테스트 갭은 찾지 못했다 — 남은 두 지점(코드펜스 안 체크박스 미검증, frontend 테스트 디렉터리의 typecheck 게이트 부재)은 각각 사소한 확장 제안과 이미 별도 plan 항목(`harness-review-gate-followups.md:192-194`)으로 트래킹 중인 재확인이라 INFO 로 그친다.

## 위험도

LOW
