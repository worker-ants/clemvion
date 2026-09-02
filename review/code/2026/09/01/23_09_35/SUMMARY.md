# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(신규 문서화된 "`plan/complete/**` 링크 가드 예외" 계약에 전용 회귀 fixture 부재, testing). 나머지는 전부 INFO. forced whitelist(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 이번 diff 가 `plan-lifecycle.md` 에 공식 문서화한 "`findBrokenPlanLinks` 는 `plan/complete/**` 를 의도적으로 제외" 계약에 전용 회귀 fixture 가 없다. 같은 테스트 파일의 자매 스코프 결정(하위 그룹 폴더 제외, `0-`/`_` 접두 제외, 코드펜스 무시)은 전부 fixture+assertion 으로 고정돼 있는데 이 조합만 산문/JSDoc 서술에만 의존한다. | `.claude/docs/plan-lifecycle.md:46` / `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:155-234` (`describe("findBrokenPlanLinks (living plans)")`) | 같은 `beforeAll` fixture 에 `plan/complete/*.md` 안 깨진 상대 링크를 하나 심고, `findBrokenPlanLinks(root)` 결과에 그 위반이 포함되지 않음을 단언하는 `it()` 추가. 향후 `collectLivePlanMarkdown` 이 실수로 `complete/` 까지 넓혀지는 회귀(문서가 경고하는 "대량 실패" 시나리오)를 잡는다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `spec/conventions/error-codes.md` 최종 커밋 문구("경계는 **비대칭**이다…")가 마지막(6차) `--spec` consistency-check 라운드가 검증한 정확한 스냅샷 문구("경계는 **누가 발행하는가**…")와 축어적으로 다름. 사실 주장은 소스(`error-codes.ts`)로 독립 재검증해 정확함을 확인했다. | `spec/conventions/error-codes.md` §Overview 신규 문단 vs `review/consistency/2026/09/01/21_56_30/_target/spec-draft-error-code-two-surfaces.md` | 코드 fix 불요. 향후 이 문서를 또 건드릴 때 "6차 검증 문구 = 실제 커밋 문구" 전제가 이번엔 깨졌음을 참고 — 커밋 직전 표현을 다듬을 경우 재검증 라운드를 돌리거나 "표현만 다듬고 주장은 동일"을 커밋 메시지에 명시. |
| 2 | scope | 단일 PR 이 developer 축(harness 위생, 14파일)과 project-planner 축(`error-codes.md` 두 surface 병기 + 6라운드 consistency 산출물, ~78파일) 두 역할 스코프를 함께 담는다. 사용자가 명시 지시한 범위이며 이미 선행 두 라운드(`22_25_37`, `22_44_29` RESOLUTION.md W1)에서 "분리 대신 PR 본문에 axis 명시"로 처분됨. | changeset 전체 구성 (harness: 파일 1~5,6~14 / spec: 파일 40~91) | 새 조치 불요. PR 게시 시 RESOLUTION 이 약속한 "harness 축 / spec 축" 구분 서술이 실제 PR 본문에 들어갔는지만 최종 확인. |
| 3 | side_effect | `_CHECKBOX`/`_QUOTED` 정규식 확장은 모듈 전역 상수라 모든 `plan/in-progress/*.md` 판정에 소급 적용된다. 코드 추적 결과 영향은 `PlanDecision.complete_but_in_progress`(Stop-gate 소프트 넛지)에 국한되고 push 하드블록(`untouched`)에는 영향 없음을 확인. | `.claude/hooks/_lib/plan_guard.py:75-98,248-281` | 조치 불요. 향후 `_all_checkboxes_done` 의 세 번째 소비자가 추가되면 "push 는 영향 없음" 전제를 재확인할 것. |
| 4 | side_effect | `.claude/tools/plan-stale-audit.sh` 의 독립 사본 정규식이 이번 확장을 받지 않아 진행도 출력이 실제보다 낙관적일 수 있다. informational 출력이라 차단력 없음. | `.claude/tools/plan-stale-audit.sh:123-125` | 조치 불요 — 이미 `plan/in-progress/harness-review-gate-followups.md` 에 재개 신호와 함께 별도 등재된 기존 drift(3번째 재발). |
| 5 | maintainability | `ScanRoot` 타입이 선언(`:93-94`)보다 먼저 사용(`:65`)돼 top-to-bottom 가독성 순서를 위반한다. 컴파일에는 문제없음. | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:65` vs `:93-94` | `SCAN_ROOTS`/`type ScanRoot` 선언을 `MIN_EXPECTED_MD_FILES` 이전(파일 상단)으로 옮기거나 그 반대로 순서 정렬. 차단 사유 아님. |
| 6 | maintainability | 회귀 테스트 두 건(`test_open_checkbox_inside_blockquote_counts`, `test_quoted_open_still_vetoes_alongside_own_done`)의 본문 구조가 거의 동일 — 의도된 캐너리이나 유사 중복. | `.claude/tests/test_plan_guard.py:265-278` vs `:328-338` | 차단 사유 아님. 병합하면 캐너리 독립 의도가 흐려지므로 유지 권장. 세 번째 유사 테스트가 추가되면 파라미터화 고려. |
| 7 | testing | `_all_checkboxes_done` 의 "자기 닫힌 항목 + 인용문 닫힌 항목 공존" 조합(참 결과 경로)에 대한 직접 테스트가 없다. 로직상 위험은 낮음(단순 덧셈 카운터). | `.claude/tests/test_plan_guard.py:244-338` | `test_quoted_done_checkbox_alone_is_not_completion` 옆에 자기+인용 닫힘 공존 시 `assertTrue` 하는 테스트 추가. 차단 사유 아님. |
| 8 | documentation | `_all_checkboxes_done()` 함수 자신의 docstring 이 이번에 도입된 비대칭 카운팅 규칙(열린 항목은 인용문 안이어도 거부권, 닫힌 항목은 자기 것만 카운트)을 설명하지 않는다. 모듈 레벨 주석에는 근거가 있음. | `.claude/hooks/_lib/plan_guard.py` (`_all_checkboxes_done` docstring) | docstring 한 줄 보강(예: "quoted checkboxes: open still vetoes, done does not count"). |
| 9 | documentation | 이미 커밋된 1라운드 리뷰 로그(`review/code/2026/09/01/22_25_37/documentation.md`)가 `error-codes.md` 목적지 필드 처리를 "카탈로그 SoT 로 위임"이라 서술하지만, 실제 6라운드 consistency 이력의 최종 결론은 "문장 자체를 삭제"였다. | `review/code/2026/09/01/22_25_37/documentation.md` ("확인했으나 문제 없음" 3번째 항목) | 조치 불요(point-in-time 세션 기록). 향후 이 로그를 근거로 위임처를 추적하는 사람을 위한 참고 기록. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 이번 changeset 은 프로덕션 애플리케이션 코드를 포함하지 않음(harness/테스트/문서만). 정규식 전부 선형(ReDoS 없음), 시크릿·인증/인가 표면 없음 |
| requirement | LOW | INFO 1건 — spec 최종 문구가 6차 consistency 검증 스냅샷과 축어적으로 다름(내용은 소스 재검증으로 일치 확인). 실제 코드 5개 파일 기능은 pytest/vitest 직접 실행으로 전부 검증 |
| scope | LOW | INFO 1건 — developer/project-planner 두 역할 축 번들(이미 선행 라운드에서 처분됨). 무관한 리팩토링·포맷팅 확장 없음 |
| side_effect | LOW | INFO 2건 — 정규식 전역 확산(영향 국한 확인), `plan-stale-audit.sh` drift(기등재). 시그니처·환경변수·네트워크 변경 없음, 테스트 fixture 전부 tempdir 격리 |
| maintainability | NONE | INFO 2건(타입 전방 참조 순서, 유사 중복 테스트) — 둘 다 사소, 함수 길이/중첩/매직넘버 문제 없음 |
| testing | LOW | WARNING 1건(plan/complete 예외 계약 fixture 부재) + INFO 1건. 선행 2라운드 WARNING 3건은 소스 대조로 반영 확인 |
| documentation | LOW | INFO 2건(docstring 갭, 구 리뷰로그 오기). 실제 코드 4개 파일은 근거 주석·docstring·실측 수치가 이례적으로 충실 |

## 발견 없는 에이전트

- security — 발견사항 섹션 자체가 "없음"(NONE, 확인 근거만 기록)

## 권장 조치사항

1. (WARNING 조치) `spec-links.test.ts` 의 `findBrokenPlanLinks (living plans)` fixture 에 `plan/complete/*.md` 안 깨진 상대 링크를 하나 추가하고, 그 위반이 결과에 포함되지 않음을 단언하는 테스트를 추가해 "`plan/complete/**` 링크 가드 예외" 계약을 코드 레벨로 봉인한다.
2. PR 게시 시 본문에 harness 축(14파일)/spec 축(~78파일) 구분 서술이 RESOLUTION 약속대로 실제 포함됐는지 최종 확인한다.
3. (선택) `_all_checkboxes_done()` docstring 에 비대칭 카운팅 규칙 한 줄 보강.
4. (선택) `_all_checkboxes_done` 의 세 번째 소비자가 추가되면 "push 하드블록 무관" 전제를 재확인.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 실행됨과 일치 — forced whitelist 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 changeset(harness 정규식·테스트·plan 문서 위생) 범위 밖 — 세부 사유는 라우팅 산출물에 미포함 |
  | architecture | 상동 |
  | dependency | 상동 (diff 에 `package.json`/lockfile 변경 없음과 정합) |
  | database | 상동 (DB 접근 코드 변경 없음과 정합) |
  | concurrency | 상동 |
  | api_contract | 상동 (API 핸들러/계약 변경 없음과 정합) |
  | user_guide_sync | 상동 (사용자 가이드 대상 변경 없음과 정합) |