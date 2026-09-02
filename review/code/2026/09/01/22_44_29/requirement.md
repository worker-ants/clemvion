# 요구사항(Requirement) 리뷰

## 검토 범위에 대한 메모

diff 81개 파일 중 실질 코드/문서 변경은 소수(≈14개 harness/spec 파일)이고 나머지 60여개는
`review/code/2026/09/01/22_25_37/**` (선행 리뷰 라운드 산출물)와
`review/consistency/2026/09/01/**` (`--spec` 6라운드 consistency 세션 산출물)로, 이번 changeset 이
스스로 기록을 커밋한 것이다. 이 산출물들은 "요구사항 구현" 대상이 아니라 그 구현 과정의 증거
기록이므로 완전성/엣지케이스/반환값 등의 관점을 적용하지 않았고, 대신 그 기록이 실제 코드
상태와 부합하는지를 대조하는 데 썼다. 아래는 실행 가능한 코드 변경(`plan_guard.py`,
`test_plan_guard.py`, `spec-links.test.ts`, `stray-tool-tags.test.ts`)과 `spec/conventions/error-codes.md`
본문 변경에 집중한 결과다.

## 실측 검증 (뮤테이션 없이, 실행만)

- `.claude/tests/test_plan_guard.py` 전체 36 케이스 GREEN (`python3 -m unittest test_plan_guard`,
  신규 3케이스 `test_open_checkbox_inside_blockquote_counts` /
  `test_nested_blockquote_open_checkbox_counts` /
  `test_narrative_bracket_mention_is_not_a_checkbox` 포함).
- `codebase/frontend` `vitest run spec-links.test.ts stray-tool-tags.test.ts` → 2 files, 34 tests
  전부 GREEN.
- `_CHECKBOX = re.compile(r"^[\s>]*[-*]\s+\[(?P<mark>[ xX])\]")` 가 `_all_checkboxes_done()`
  (`.claude/hooks/_lib/plan_guard.py:259`)의 유일한 사용처임을 확인. mark 그룹 판정(`" "`→open,
  `"x"/"X"`→done) 로직은 변경 전과 동일해 반환값 계약(`done_count > 0 and open_count == 0`)이
  깨지지 않았다.
- `plan/`+`spec/` 저장소 실측: `grep -rnE '^\s*</?(antml|content|function_calls|invoke|parameter)\b[^>]*>\s*$' plan/ spec/`
  (archive 제외) → 0건. diff 가 주장하는 "정리 후 잔재 0건" 과 일치.
- `spec-links.test.ts` 신규 통합 테스트가 주장하는 줄 번호(`#nope`→4, `./missing.md`→5,
  멀티라인 앵커→**시작 줄** 7)를 fixture 파일 라인 수동 계산으로 재검증 — 일치. `spec-links.ts:74`
  주석("링크가 시작한 줄")과도 부합해 함수명·주석·구현·테스트 네 지점이 서로 어긋나지 않는다.
- `codebase/backend/src/nodes/core/error-codes.ts` 를 직접 열어 `spec/conventions/error-codes.md`
  §Overview 신규 문단의 핵심 주장을 대조: `ErrorCode`(파일 상단)와 `EngineErrorCode`(`:147` 부근)가
  **같은 파일의 자매 const**라는 것, `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `ErrorCode` 소속이면서
  엔진이 싣는다는 것("Execution Engine — engine-level limits" 주석), `SERVER_INTERRUPTED` 는
  "Execution·NodeExecution 양쪽 봉투에 실린다"는 것, `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 admission
  단계 전용(따라서 `Execution.error` 한정)이라는 것 — 전부 소스 주석과 일치. spec 문단이 "그래서
  §1 카탈로그 분류와 1:1 대응하지 않는다"고 적은 것도 실제 코드가 보여주는 비대칭과 부합한다.
  spec fidelity CRITICAL 없음.
- `findBrokenPlanLinks` JSDoc (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:434-438`)이
  `plan-lifecycle.md` 신규 문단이 인용하는 "`plan/complete/**` 는 의도적 제외" 근거와 정확히
  일치함을 원문 대조로 확인.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` 신규 build-blocking 가드 `stray-tool-tags.test.ts` 가 그 가드
  family 의 SoT 로 자처하는 문서에 등재되지 않은 채로 커밋됐다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규 파일 전체) /
    `spec/conventions/spec-impl-evidence.md:4-18` (frontmatter `code:` 리스트, 4개 build 가드 파일만
    등재) / 같은 문서 §4.2 (헤더 "build 차단 4건" 문구, 표에 5번째 행 없음 — 직접 열어
    `본 절이 규약 SoT` 선언과 "4건" 문구·4행 표를 재확인함)
  - 상세: 이 가드는 `plan/`·`spec/` 마크다운을 `walkTree` 로 스캔해 위반 0건을 단언하는 구조로
    같은 §4.2 표의 `spec-link-integrity.test.ts` 등 4건과 정확히 동형이며, `npm test`(`vitest run`)
    기본 실행에 포함되어 실질적으로 build 를 막는다(직접 확인: `package.json` `"test": "vitest run"`).
    그런데 §4.2 표·frontmatter 어느 쪽도 갱신하는 diff 가 이 changeset 에 없다 — "규약 SoT" 를
    자처하는 문서가 새 가드의 존재를 모르는 상태로 남는다. 이 자체는 새로 발견한 사실이 아니라
    선행 리뷰 라운드(`review/code/2026/09/01/22_25_37/documentation.md`)가 이미 WARNING 으로
    지적했고, `RESOLUTION.md` 의 W5 가 "이번 PR 에서 안 함(같은 리뷰의 W1 — spec 축이 이미
    과하게 묶였다는 지적과 상충하므로 유예)"로 명시적으로 처리해 `harness-review-gate-followups.md`
    에 재개 신호(다음 harness 가드 추가 시 함께)까지 등재해 두었다. **다만 그 유예 결정에도
    불구하고, 이 diff 가 실제로 병합되는 시점의 저장소 상태 자체는 여전히 "SoT 문서가 최신 가드
    목록을 반영하지 못한" 상태**라 spec fidelity 관점에서는 계속 유효한 관찰이다 — 코드(신규
    가드)는 의도적이고 정당하지만 spec 쪽 카탈로그(개수·표 행)가 갱신되지 않은 전형적인 SPEC-DRIFT
    형태다.
  - 제안: 코드 변경 불필요(가드 자체는 올바르게 동작). `spec/conventions/spec-impl-evidence.md`
    §4.2 표에 `stray-tool-tags.test.ts` 행 추가 + "build 차단 4건" → "5건", frontmatter `code:`
    리스트에 파일 경로 추가는 이미 `harness-review-gate-followups.md`(리뷰 1R W5 항목)에
    다음 harness 가드 추가 시 함께 처리하기로 등재돼 있으므로 그 계획대로 별도 planner 턴에서
    반영하면 된다.

## 확인했으나 문제 없음 (근거 기록)

- `_CHECKBOX` 정규식 확장이 기존 저장소의 다른 in-progress plan 에 소급 적용됐을 때 새로
  false-positive 를 만드는지 직접 재현: `grep -rnP '^[\s]*>[\s>]*[-*]\s+\[ \]' plan/` (archive 제외)
  → 정확히 3건, 전부 `plan/in-progress/marketplace-and-plugin-sdk.md:86-88` 의 실제 열린 작업
  (entitlement 소스/노출 게이트/실행 게이트 3항목). 다른 문서에는 불릿형 인용 `[ ]` 가 전혀 없어
  이번 확장이 즉시 새 오탐을 만들지 않는다는 리뷰 세션의 실측 주장과 일치.
- 함수 반환 계약(`_all_checkboxes_done` → `bool`, `evaluate_plan` → `PlanDecision`)은 이번
  diff 로 변경되지 않았고, 모든 코드 경로가 여전히 명시적 값을 반환한다(예외적 `OSError` 는
  `False` 로 fail-open — 기존 정책과 동일, "any parse failure → not blocked" 모듈 docstring 과 부합).
- TODO/FIXME/HACK/XXX 마커: `plan_guard.py`/`test_plan_guard.py`/`spec-links.test.ts`/
  `stray-tool-tags.test.ts` 4개 코드 파일 전수 grep → 0건.

## 요약

이번 changeset 의 실질 코드 표면(4개 파일)은 기능 완전성·엣지 케이스·반환값 계약 모두
실행 검증(unittest 36/36, vitest 34/34)으로 뒷받침되고, `spec/conventions/error-codes.md`
본문 변경도 소스 코드(`error-codes.ts`)와 line-level 로 대조해 CRITICAL 급 불일치가 없다.
유일한 실질 발견은 신규 build-blocking 가드가 스스로 "규약 SoT" 라 부르는
`spec/conventions/spec-impl-evidence.md §4.2` 에 아직 등재되지 않은 SPEC-DRIFT 성격의 WARNING
하나이며, 이는 이미 이 changeset 내부의 `RESOLUTION.md`/`harness-review-gate-followups.md`
가 근거와 함께 의도적으로 유예·추적하고 있어 새로운 리스크라기보다는 이미 관리되는 부채다.

## 위험도
LOW
