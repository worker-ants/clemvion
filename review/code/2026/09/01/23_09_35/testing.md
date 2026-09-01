# 테스트(Testing) 리뷰

## 범위에 대한 메모

이번 changeset(92개 파일 표기)의 대다수는 `review/consistency/2026/09/01/**`(6라운드 consistency
checker 세션 산출물)·`review/code/2026/09/01/{22_25_37,22_44_29}/**`(선행 두 코드 리뷰 라운드
산출물)·`plan/**` 트래킹 문서 갱신이다. 사람이 유지보수하는 실행 코드/테스트는 여전히 4개뿐이다 —
`.claude/hooks/_lib/plan_guard.py`, `.claude/tests/test_plan_guard.py`,
`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`,
`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규). 이 4개는 이미 선행
두 라운드(`22_25_37`, `22_44_29`)의 testing 리뷰가 WARNING 3건을 냈고, 첨부된
`RESOLUTION.md` 두 건과 실제 소스를 직접 열어 대조한 결과 다음이 **실제로 반영**돼 있음을
확인했다:

- 체크박스 비대칭 카운팅(`plan_guard.py:95-98,270-278`) — 열린 항목은 인용문 안이어도 거부권,
  닫힌 항목은 자기 것만 증거로 인정. 회귀 테스트 5건(`test_plan_guard.py:265-338`)이 양방향을
  모두 고정하고 있다.
- `stray-tool-tags.test.ts` 의 "스캔이 실제로 돌았다" 전제 테스트가 합계 하한(구 `100`)에서
  **루트별** 하한(`plan:250`, `spec:190`)으로 바뀌었고, `EXPECTED_ROOTS` 를 상수가 아니라
  **테스트 본문 리터럴**로 못박아 "집합을 함께 줄이는" 뮤턴트까지 잡도록 3차 수정이 들어가 있다
  (`stray-tool-tags.test.ts:65-68,132-148`).
- `plan-stale-audit.sh` 의 독립 사본 drift는 `plan/in-progress/harness-review-gate-followups.md`
  에 재개 신호와 함께 명시적으로 백로그 등재됐다(코드 수정은 보류, 근거: informational 출력이라
  차단력 없음 + 검증 테스트 표면 부재). 새로 지적할 필요 없음.

아래는 이 확인된 사항을 재지적하지 않고, **새로** 발견한 갭에 집중한다.

## 발견사항

- **[WARNING]** 이번 diff 가 새로 문서화한 "`plan/complete/**` 는 링크 가드 범위 밖" 계약에
  전용 회귀 fixture 가 없다
  - 위치: `.claude/docs/plan-lifecycle.md:46`(신규 문단, "가드가 안 잡는다" 블록쿼트) /
    대응 테스트 파일: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:155-234`
    (`describe("findBrokenPlanLinks (living plans)")`)
  - 상세: 이번 PR 의 `plan-lifecycle.md` 신규 문단은 "`findBrokenPlanLinks` 는 `plan/complete/**`
    를 **의도적으로 제외**한다"는 것을 이제 공식 절차 문서의 근거로 삼는다(`spec-links.ts`
    JSDoc 을 인용). 그런데 이 계약을 지키는 실제 코드(`collectLivePlanMarkdown` →
    `walkPlanMarkdown(root, "in-progress", { recurse: false })`)는 이번 diff 대상이 아니고,
    그 범위 결정을 검증하는 테스트도 이번 diff 대상이 아니다 — 그런데 이번 diff 는 그 결정에
    **문서상 의존**을 새로 만들었다. 같은 `describe` 블록 안의 다른 세 스코프 결정(하위 그룹
    폴더 제외, `0-`/`_` 접두 인덱스 제외, 코드펜스 내부 무시)은 각각 전용 fixture +
    `it(...)` 로 음성 경로가 고정돼 있는데(`:184-190` 의 `cluster/child.md`·`0-index.md`·
    `_scratch.md`, `:177-179` 의 펜스), **`plan/complete/` 안에 깨진 링크를 심는 fixture 만
    없다** — `moved.md`(`:163`)는 유효한 헤딩만 가진 정상 파일이라 "complete 안 깨진 링크가
    무시되는가"를 검증하지 못한다. 만약 향후 누군가 `collectLivePlanMarkdown` 을 `complete`
    까지 훑도록 (실수로든 의도적으로든) 넓히면, 그 순간이 정확히 `plan-lifecycle.md` 가 새로
    경고하는 "대량 실패" 시나리오인데, 이를 잡아 줄 테스트가 지금 하나도 없다.
  - 제안: 같은 `beforeAll` fixture 에 `plan/complete/*.md` 안에 깨진 상대 링크(예:
    `mkLink("stale in complete", "./nope-in-complete.md")`)를 하나 심고,
    `findBrokenPlanLinks(root)` 결과에 그 위반이 **포함되지 않음**을 단언하는 `it()` 를
    추가한다. 다른 세 스코프 결정과 같은 패턴이라 비용이 낮고, 이번 PR 이 문서로 공식화한
    계약을 코드 레벨로 봉인한다.

- **[INFO]** `_all_checkboxes_done` 에 "자기 닫힌 항목 + 인용문 닫힌 항목이 공존" 하는
  조합(참 결과 경로)에 대한 직접 테스트가 없다
  - 위치: `.claude/tests/test_plan_guard.py:244-338`
    (`test_all_checkboxes_done_true` ~ `test_quoted_open_still_vetoes_alongside_own_done`)
  - 상세: 신규 테스트 5건은 "인용문 열린 항목이 거부권을 갖는가"(2건), "서술 인용은 카운트
    안 되는가"(대조군), "인용문 닫힌 항목만 있으면 완료가 아닌가"(2건 — 단독 및 열린 항목과
    공존)를 고정한다. 그런데 "**자기** 닫힌 항목 + **인용문** 닫힌 항목이 함께 있고 열린 항목이
    없을 때 여전히 `True`(완료)를 반환하는가"라는 조합은 직접 테스트되지 않는다 —
    `done_count` 가 자기 항목만으로도 이미 양수이므로 로직상 위험은 낮지만(단순 덧셈 카운터),
    이 조합이 `elif` 분기의 "누적" 동작을 명시적으로 확인하는 유일한 케이스라 하나 추가해 두면
    다음 사람이 이 분기를 다시 만질 때 회귀를 더 빨리 잡는다.
  - 제안: `body="## tasks\n- [x] 내 작업\n> - [x] 다른 plan 에서 인용된 완료 항목\n"` 형태의
    fixture 로 `assertTrue` 하는 테스트를 `test_quoted_done_checkbox_alone_is_not_completion`
    옆에 추가. 차단 사유는 아님 — 기존 뮤테이션 커버리지(비대칭 제거 RED 1, 앵커 원복 RED 3)가
    이미 이 분기 전체를 상당히 덮고 있다.

## 확인했으나 문제 없음 (근거 기록)

- `spec-links.test.ts` 의 신규 멀티라인 ANCHOR 통합 테스트(실제 파일 기준 `describe("findBrokenLinksInFiles
  core...")` 블록, 프롬프트 게이트 라인 52-110)는 `byTarget.get(...)` 매핑으로 세 위반 모두가
  잡혔다는 전제를 먼저 단언한 뒤(`[전제]` 주석) 각 `line` 값을 검증해, 위반이 하나라도 안 잡혀
  vacuous 해지는 경로를 스스로 차단한다.
- `stray-tool-tags.test.ts` 의 `archive/` 스코핑 fixture 는 제외 대상과 포함 대상을 함께 심는
  대조군 구조를 유지하고 있고, `collectScanTargets` 단일화로 사본 drift 경로도 막혀 있다
  (선행 라운드 지적 사항, 소스 재확인으로 유효성 재검증 완료).
- `plan_guard.py` 의 `_QUOTED = re.compile(r">")` 는 `_CHECKBOX` 의 `quote` 캡처 그룹(줄 시작부터
  체크박스 불릿 직전까지)에만 적용돼, 체크박스 본문 텍스트 안에 `>` 문자가 있어도(예: `- [x] a > b`)
  영향받지 않는다 — 캡처 그룹 경계를 직접 대조해 확인.
- `EvaluatePlanDecisionTableTest` 의 `mock.patch.object(pg, "_all_checkboxes_done", ...)` 사용은
  적절하다 — 이 클래스는 의사결정 테이블(`untouched`/`complete_but_in_progress` 조합)만 검증
  대상이고, `_all_checkboxes_done` 자체의 실제 파일 I/O 동작은 `FilesystemHelpersTest` 가 별도로
  직접 커버한다. mock 이 실제 반환 타입(`bool`)과 어긋나지 않는다.

## 요약

핵심 코드(`plan_guard.py` 체크박스 정규식, `stray-tool-tags.test.ts` 신규 가드)에 대한 선행 두
라운드 testing WARNING 3건은 소스 대조로 실제 반영을 확인했고 재지적할 것이 없다. 이번 라운드에서
새로 찾은 갭은 하나 — 이번 diff 가 `plan-lifecycle.md` 에 공식 문서화한 "`plan/complete/**` 링크
가드 예외" 계약이, 같은 테스트 파일의 자매 스코프 결정들과 달리 전용 회귀 fixture 없이 JSDoc/산문
서술에만 의존한다. 실패 확률 자체는 낮지만(스코프가 하드코딩 리터럴), 그 실패 모드가 정확히 이번
PR 이 새로 경고하는 "`complete/` 로 봉인 후 대량 실패" 시나리오와 겹쳐 WARNING 으로 상정했다. 그
외 INFO 하나(자기+인용 닫힌 항목 공존 조합 미테스트)는 차단 사유가 아니다.

## 위험도

LOW
