# 요구사항(Requirement) 리뷰 보고서

## 조사 방법 메모

`_prompts/requirement.md`에서 파일 1(`.claude/hooks/_lib/review_guard.py`)과 파일 3
(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`)은 "변경 유형: Review"
메타데이터만 있고 unified diff 도 전체 파일 컨텍스트도 없었다(게이트 숫자 자체가 없음). `git diff
origin/main...HEAD`로 11개 변경 파일 전체를 직접 대조했고, 아래 발견사항의 위치는 (파일 1·3에
한해) 조립 프롬프트가 아니라 **원본 소스 파일의 실제 줄 번호**(Read 기준)다. 이 갭 자체를 근본
원인까지 추적한 결과가 발견사항 3이다.

## 발견사항

- **[WARNING]** `_default_branch_ref()`가 git 예외를 그대로 전파해 "무실패 조용히 무시" 계약을 어김
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1092`
    (`_default_branch_ref` 정의), 특히 `:1094`·`:1098`의 `_git(...)` 호출 2곳
  - 상세: 같은 파일의 다른 모든 git 헬퍼(`get_git_diff_files`·`get_git_range_files`·
    `get_git_branch_diff_files`·`get_git_commit_files` 등, `:821`·`:853`·`:876`·`:899`)는
    `_git(...)` 호출을 `try/except Exception`으로 감싸 실패 시 빈 리스트/빈 문자열을 반환한다.
    신설된 `_default_branch_ref()`만 이 관례를 따르지 않고 두 번의 `_git([...])` 호출을 아무 보호
    없이 실행한다. `_git`(`:817`, "unchanged from previous version")은 `subprocess.run(...,
    timeout=timeout)`을 그대로 반환할 뿐 자체적으로 예외를 삼키지 않으므로, `git` 바이너리 부재
    (`FileNotFoundError`) 또는 `subprocess.TimeoutExpired`가 발생하면 예외가
    `warn_if_committed_work_is_missing()` → `collect_change_infos()` → `main()`까지 그대로
    전파된다. `main()`에는 이를 감싸는 최상위 try/except가 없으므로(`:1216` 이하 확인)
    **`--prepare`(기본 changeset 준비) 전체가 크래시**한다. 이는 바로 그 함수의 docstring이
    명시한 계약과 정면으로 모순된다: `warn_if_committed_work_is_missing()`(`:1104`) 의
    docstring 마지막 줄(`:1117-1118`)은 "Advisory only ... Silent on any git failure: a review
    must not fail because the warning could not be computed."라고 적어 두었는데, 실제로는
    advisory 계산 실패가 review 전체를 실패시킬 수 있다. `test_review_changeset_warning.py`의
    모든 테스트는 `orch._default_branch_ref = lambda: ARG["base"]`로 이 함수 자체를 스텁 처리하므로
    (`:76`), 이 예외 경로는 테스트로도 커버되지 않는다.
  - 제안: `_default_branch_ref()`의 두 `_git(...)` 호출을 형제 헬퍼들과 동일한 패턴
    (`try: ... except Exception: debug_log(...); return None` 또는 그에 준하는 처리)으로 감싼다.

- **[WARNING]** `prioritize_bundle_files`의 계층 판정에서 "카탈로그 강등"이 "브랜치 변경" 신호보다
  항상 우선 적용됨 — docstring이 선언한 우선순위와 실제 구현이 어긋남
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:289-297`
    (`prioritize_bundle_files`(`:267`) 내부 `tier()` 클로저), 특히 `:291`(`_is_catalog_bulk`
    체크)이 `:293`(`rel in changed` 체크)보다 먼저 실행됨
  - 상세: 함수 docstring(`:276-282`)은 계층을 "0. changed by this branch — the strongest
    available signal" → "1. plan 언급" → "2. 나머지" → "3. catalog bulk; last"로 명시한다.
    그런데 실제 `tier()`는 `_is_catalog_bulk(rel)`을 **가장 먼저** 검사해 참이면 즉시 3을 반환하고,
    "브랜치가 변경했는가"(`rel in changed`)는 그 다음에야 확인한다. 즉 카탈로그 강등이 "가장 강한
    신호"라던 브랜치-변경 신호보다 실질적으로 더 강하게 작동한다. 직접 실행해 확인:
    `changed_rels={"spec/conventions/cafe24-api-catalog/product/fields.md"}`로
    `prioritize_bundle_files`를 호출하면 그 파일이 (변경되지 않은) `error-codes.md`/
    `node-output.md`보다도 **뒤**로 밀린다 — 브랜치가 실제로 수정한 파일인데도 최하위 계층으로
    강등된다. 테스트(`test_consistency_bundle_priority.py`)는
    `test_catalog_demotion_beats_a_plan_mention`(plan 언급 vs 카탈로그)만 있고 "브랜치가 실제로
    변경한 카탈로그 파일"에 대응하는 케이스는 없어 이 상호작용은 미검증이다. 이 PR이 고치려는
    바로 그 결함 클래스(사전순 대량 문서가 실제 작업 대상을 예산 밖으로 밀어냄, "8회 재발")가
    "브랜치가 `*-api-catalog/**` 하위 파일을 직접 수정하는 PR"에 한해 그대로 재현될 수 있다 —
    그 파일이 알파벳순으로 카탈로그 ~230개 중 뒤쪽에 있으면 `truncate_file_bundle`에 잘려나갈
    수 있다.
  - 제안: 의도된 정책(카탈로그는 어떤 신호보다도 항상 최하위)이라면 docstring에 그 우선순위를
    명시하고 "브랜치 변경 + 카탈로그" 조합의 회귀 테스트를 추가할 것. 반대로 "브랜치가 실제로
    건드린 파일은 카탈로그라도 노출돼야 한다"가 맞다면 `tier()`에서 `rel in changed` 체크를
    `_is_catalog_bulk` 체크보다 먼저 수행하도록 순서를 바꿀 것.

- **[WARNING]** (메타/harness) `code_review_orchestrator.py`의 `build_files_section`이 예산
  초과 시 가장 큰 파일을 통지 없이 통째로 누락 — 이번 리뷰 세션에서 실제로 발생해 파일 1·3
  (이 PR의 diff 대상 그 자체)이 14명 리뷰어 전원의 프롬프트에서 사라졌다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561`
    (`build_files_section` 정의), 특히 총예산 분기 `:643-665` 중 `:664-665`
    (`remaining_budget = 0` 후 `break` — 이후 남은 파일은 `include_content`에 전혀 들어가지
    않고, 어떤 생략 표기도 남지 않는다)
  - 상세: 이번 diff는 이 함수를 건드리지 않았지만(신설 함수는 `:1092`~ 부근, `build_files_section`과
    무관), 이번 회차 `/ai-review` 세션(`review/code/2026/07/31/11_07_48/meta.json`)에서 11개
    변경 파일 **전원**이 `"change_type": "Review"`로 기록돼 있다 — 이는 `build_cli_change_info`
    (`:942`)가 `args.files`(명시적 위치 인자 파일 목록) 모드에서만 붙이는 리터럴이다. 이 모드는
    커밋 이후 실행되므로 `get_git_diff_content`(uncommitted-only)가 모든 파일에 대해 빈 문자열을
    반환해 `code`(diff 섹션)가 11개 파일 전부 비고, 리뷰어는 오직 `full_file_content`(현재 디스크
    스냅샷)에만 의존한다. 총예산(`max_total_size`) 배분 루프(`:646-665`)는 `content_indices`를
    **파일 크기 오름차순**으로 정렬해 작은 파일부터 채우고, 예산이 바닥나면 그 시점 파일 하나를
    잘라 넣고(`available > 200`일 때) 그 파일부터 `break`한다 — **그 이후의(더 큰) 파일은 헤더만
    남고 diff도 본문도 생략 사실 표기도 전혀 없이 사라진다.** 실측: 이번 배치 11개 파일 중 정확히
    가장 큰 두 파일 — `review_guard.py`(960줄, 42,843바이트)와 `code_review_orchestrator.py`
    (1,357줄, 60,767바이트) — 만 모든 리뷰어 프롬프트(`_prompts/*.md` 14개 전부, grep으로 확인)에서
    본문이 완전히 비어 있었다. 그 결과 이번 diff의 핵심 보안 관련 변경(`review_guard.py`의
    `evaluate_review(..., in_flight_ok=...)` 게이팅) 자체가 프롬프트만으로는 어떤 리뷰어도 볼 수
    없었다 — 세션 내 다른 리뷰어(dependency/performance/scope/security) 4명도 독립적으로 같은
    공백을 발견해 `git diff`로 직접 우회했음을 확인했다(`performance.md`·`scope.md`의 "메타 노트"
    참고). 이번엔 우회 덕에 실질적 리뷰 공백으로 이어지진 않았으나, 매 리뷰마다 사람/에이전트가
    파일 개수 대 헤더 개수를 세어 대조하지 않는 한 재현 가능한 완전 누락이다 — 바로 이 PR이
    `consistency_orchestrator.py`에 대해 고친 "예산 초과로 실제 대상이 통지 없이 사라짐" 결함과
    같은 클래스이며, 자매 오케스트레이터인 `code_review_orchestrator.py` 쪽엔 아직 적용돼 있지
    않다는 뜻이다. diff 범위 밖의 기존 코드이므로 이 PR의 결함으로 카운트하지는 않되, 이 PR 자신의
    "요구사항 충족 여부"를 다른 리뷰어들이 안전하게 판정할 수 있었는지에 직접 영향을 준 사실이라
    반드시 기록해 둔다.
  - 제안: `consistency_orchestrator.py`가 이번에 얻은 "생략된 파일을 이름으로 남긴다"
    (`OMITTED_FILES_HEADING`류) 원칙과 `prioritize_bundle_files`식 "브랜치가 실제로 변경한 파일
    우선" 정렬을 `build_files_section`/`build_agent_prompt_body`에도 이식할 것. 최소한
    `include_content`에서 빠진 파일에 대해 `_truncated_note`류의 한 줄이라도 남기면 이번처럼
    "헤더만 있고 diff도 본문도 없음"을 리뷰어가 즉시 식별할 수 있다.

- **[INFO]** spec fidelity — 관련 `spec/` 문서 없음
  - 위치: 해당 없음 (범위: 11개 변경 파일 전체)
  - 상세: 11개 변경 파일 모두 `.claude/`(harness 코드/테스트) 또는 `plan/in-progress/`이고
    `codebase/`·`spec/` 변경은 0건이다. `evaluate_review`·`in_flight_ok`·
    `prioritize_bundle_files`·`warn_if_committed_work_is_missing`·`_default_branch_ref`를
    `spec/` 전체에서 grep했으나 0건 — 이 영역을 규정하는 정식 spec 문서가 없다. 가장 가까운
    "spec 역할" 문서는 `.claude/skills/code-review-agents/SKILL.md`·
    `.claude/skills/consistency-checker/SKILL.md`·`.claude/docs/subagent-call-contract.md`인데,
    세 문서 어디에도 `in_flight_ok`/`prioritize_bundle_files`/
    `warn_if_committed_work_is_missing`의 내부 동작을 서술한 부분이 없어(grep 0건) 이번 diff와
    직접 모순되는 문서 서술도 없다. CLAUDE.md 관례상 harness 내부 구현 세부는 spec/ SoT 대상이
    아니므로 이는 결함이 아니라 "적용 대상 spec 없음"의 정상 케이스로 판단한다.

- **[INFO]** plan 문서의 사소한 자기 서술 오차 2건 (기능에는 영향 없음)
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:92`, 동 파일 `:118-119`
  - 상세: (1) `:92` "테스트 `test_review_changeset_warning.py` 9건 + mutation 4종 RED"라고
    적었으나 실제 파일의 `def test_` 개수는 10개(`grep -c` 확인, `unittest` 실행 결과도
    "Ran 10 tests"). (2) `:118-119` "push 가드(`guard_review_before_push.py:846`)와 stop
    가드(`guard_review_before_stop.py:340`)가 같은 `evaluate_review()`를 부르는데"에서
    push 쪽 `:846`은 실제로 `evaluate_review,` 참조 줄과 일치하지만, stop 쪽 `:340`은
    `evaluate_review(in_flight_ok=True)` 호출문이 아니라 그 위 설명 주석 줄이다(실제 호출문은
    `:344`). 둘 다 서술 자체의 결론(테스트 존재, 호출부 위치)은 맞고 코드 동작에는 영향 없는
    기록상의 오차다.

## 요약

핵심 기능(① Stop 전용으로 스코프를 좁힌 `evaluate_review(cwd=None, *, in_flight_ok=False)`
opt-in 게이팅, ② consistency 번들의 4계층 `prioritize_bundle_files` 재배열, ③ 커밋된 브랜치
작업이 기본 changeset에서 빠질 때의 `warn_if_committed_work_is_missing` 경고)은 모두 의도한
대로 정확히 배선돼 있고, 관련 신규/변경 테스트(`test_review_guard_hardening.py`,
`test_stop_guard_failopen.py`, `test_consistency_bundle_priority.py`,
`test_review_changeset_warning.py`)와 하네스 전체 스위트(684건)를 직접 실행해 전부 통과함을
확인했다. push 가드는 `in_flight_ok`를 넘기지 않아 여전히 hard-gate 상태를 유지하고(호출부·
`_accepts_cwd` 시그니처 검사 모두 확인), 경고 로직은 기본(무인자) `--prepare` 경로에서만 발화하며
`--branch`/`--range`는 건드리지 않는다. 다만 세 가지 주목할 공백을 발견했다: (1) 신설
`_default_branch_ref()`가 형제 git 헬퍼들과 달리 예외를 방어하지 않아 자신의 "silent on any git
failure" 계약을 어길 수 있는 경로가 남아 있고, (2) `prioritize_bundle_files`의 계층 판정이
"카탈로그면 브랜치 변경 여부와 무관하게 항상 최하위"로 동작해 docstring이 선언한 "브랜치 변경 =
가장 강한 신호"라는 우선순위와 실제 구현이 어긋나며 이 조합은 테스트되지 않았다. (3) 이번 리뷰
세션 자체가 겪은 실경험으로, `code_review_orchestrator.py`의 `build_files_section`이 예산 초과
시 가장 큰 파일(공교롭게도 이 PR의 diff 대상인 `review_guard.py`·`code_review_orchestrator.py`
그 자체)을 통지 없이 완전히 누락시켜, 이 PR의 보안 관련 핵심 변경이 14명 리뷰어 전원의 프롬프트에서
보이지 않는 상태로 리뷰가 진행됐다(다행히 여러 리뷰어가 `git diff`로 직접 우회해 실질적 공백으로
이어지지는 않았다). (3)은 이번 diff의 변경 범위 밖(기존 코드)이라 이 PR 자체의 결함으로 채점하지는
않지만, 이 PR이 자매 오케스트레이터에 대해 고친 것과 동일한 결함 클래스가 코드-리뷰 오케스트레이터
쪽에는 아직 남아 있다는 실증 사례로 기록해 둔다. spec/ 문서는 이 harness 영역을 규정하지 않아
spec fidelity 관점의 불일치는 없음(INFO).

## 위험도

MEDIUM
