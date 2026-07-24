# 문서화(Documentation) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`,
`.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md`
(+ 이전 두 리뷰 라운드 산출물 `review/code/2026/07/23/16_55_04/**`, `review/code/2026/07/23/17_22_18/**` 커밋 반영분)

## 사전 확인 — 앞선 두 라운드의 CRITICAL/WARNING 은 실제로 모두 해소됨

이번 diff 는 `16_55_04` 리뷰(CRITICAL: `__main__` 중복, WARNING: Contract 미언급·plan 체크리스트 미동기화)와
`17_22_18` 리뷰(CRITICAL: 리셋 술어 세 번째 오류, WARNING: plan §E "테스트 7건" stale·README 카탈로그 갭)가
모두 이미 적용된 **이후** 상태다. 실제 파일을 직접 열어 재확인:

- `__main__` 블록 — `guard_review_before_push.py:583-584`에 한 번만 존재. 재발 없음.
- 모듈 docstring "Contract" 절 — fail-open 관측 정책 문단(10-33행) 존재.
- `plan/in-progress/harness-guard-followups.md:388` — `- [x] E — … 구현 완료`로 정합.
- plan §E 본문(248-253행) 테스트 건수 — "테스트 35건(그중 관측성 15건)"이라고 서술하며, 실측
  (`grep -c "    def test_" test_guard_review_before_push_main.py` = 35, observability 섹션 이후 15)과
  정확히 일치. `17_22_18`이 지적한 stale count(7→실제12)는 그 이후 커밋에서 12→35로 다시 늘었지만
  숫자가 매번 함께 갱신되어 있다.
- `.claude/tests/README.md:44` — "the streak clears only when EVERY gate answered (a BYPASS_*, a
  non-push, or a push where one gate blocked before the other ran are all 'no evidence', not
  'healthy')" — 세 번째 CRITICAL 수정(명시적 `_ALL_GATES` 집합 비교) 이후의 **정확한** 의미론을 서술.

이 항목들은 재-flag 하지 않는다.

## 발견사항

- **[WARNING]** 모듈 최상단 "Contract" docstring 이 세 번째 CRITICAL 수정으로 바뀐 리셋 의미론을
  따라가지 못해, **이번 대상 diff 가 고친 바로 그 버그(v2)를 다시 정확한 설명인 것처럼 서술**한다
  - 위치: `.claude/hooks/guard_review_before_push.py:31` ("A gate that answers cleanly clears the
    counter; a BYPASS_* skip deliberately does not, …" — 문단 전체는 25-33행)
  - 상세: `_report_fail_open()`은 세 번째 라운드(`af849ba25`)에서 "카운터를 리셋하려면 **모든**
    게이트(`_ALL_GATES` — REVIEW·PLAN 전부)가 같은 push 에서 응답해야 한다"는 명시적 집합 비교로
    고정됐다(해당 함수 자신의 docstring, 423-434행: "clearing it takes positive evidence that EVERY
    gate is working: a push where all of `_ALL_GATES` actually answered"). 이 정확한 문구는
    `.claude/tests/README.md:44`에도 "the streak clears only when EVERY gate answered"으로 그대로
    반영돼 있다. 그런데 파일 최상단 모듈 docstring(31행)은 여전히 "**A** gate that answers cleanly
    clears the counter"라고 단수 부정관사로 서술한다 — 이는 "게이트 중 아무 하나만 정상 응답해도
    리셋된다"는 뜻으로 읽히며, 이는 정확히 이 세션이 세 번째로 고친 버그(v2: "reset whenever *any*
    gate answered" — REVIEW 가 차단하는 흔한 경로에서 PLAN 이 실행조차 안 됐는데도 리셋되던 결함)의
    서술 그 자체다. 이 문구는 바로 앞 커밋(`e617a19a0`, 2라운드 W8 반영)에서 그 시점의(당시엔 아직
    v2였던) 코드에 맞춰 작성됐고, `af849ba25`(3라운드, 리셋 술어를 v3→최종으로 교정)가 `_report_fail_open`
    자신의 docstring 은 정확히 고쳤지만 이 최상단 문단은 건드리지 않아 그대로 낡았다(`git show af849ba25`
    로 확인 — 이 파일에 대한 diff hunk 는 371행 이후만 존재, 25-33행은 무변경). 이 저장소는 바로 이
    "상단만 읽는 유지보수자가 정책 변화를 놓칠 수 있다"는 리스크를 2라운드 문서화 리뷰의 WARNING #8 근거로
    직접 서술한 바 있는데, 지금은 그 상단 문단 자체가 부정확해 같은 리스크가 반대 방향(놓치는 게 아니라
    **틀리게 배움**)으로 재현된다. 함수를 만지지 않고 이 최상단 요약만 참고해 리셋 로직을 재구현하는
    미래 편집이 있다면 v2 버그를 네 번째로 재도입할 소지가 있다.
  - 제안: 31행을 `_report_fail_open`/README 와 같은 의미론으로 교정. 예:
    `"Only a push where EVERY gate answers cleanly clears the counter; a bypass, a non-push, or a
    push where one gate blocked before the other ran are all 'no evidence', not 'healthy'."`

## 참고 (INFO)

- 그 외 신규 헬퍼(`_state_path`/`_read_streak`/`_write_streak`/`_report_fail_open`/`_run_gates`/`_Outcome`)의
  docstring 밀도·정확성, `_FAILOPEN_ESCALATE_AT=3` 근거 주석, `.claude/tests/README.md` 카탈로그 행,
  plan §E 본문의 서술 밀도는 모두 실측 확인상 양호하다 — 3라운드에 걸쳐 지적된 항목들이 코드에
  1:1로 반영돼 있고, 각 함수의 로컬 docstring 이 "왜 이렇게 됐는가"(세 번의 리셋 술어 실수, 배너
  선-출력 순서, 채널 선택 근거)를 이례적으로 상세히 기록하고 있다.
- INFO 미반영 목록(양쪽 RESOLUTION 문서에 사유 기재된 항목 — `_Outcome` 클래스 위치, 배너 문구
  paraphrase의 인용부호, `_lib/` 미분리 등)은 이미 의식적 defer 로 판단·기록돼 있어 재-flag 하지 않는다.

## 요약

핵심 변경(REVIEW/PLAN 게이트 fail-open 관측성 §E)은 세 라운드에 걸친 리뷰-수정 사이클을 거치며 코드·테스트·
plan 문서·테스트 카탈로그 네 표면 모두를 대체로 정확하게 동기화했고, 각 함수 로컬 docstring 은 "왜"까지
기록하는 이 저장소의 높은 기준에 부합한다. 다만 그 수정 과정에서 지역적으로(함수 docstring, README)는
고쳐졌지만 전역적으로(파일 최상단 Contract 절)는 갱신되지 않은 지점이 하나 남았다 — 세 번 반복된 정확히
같은 버그 클래스(리셋에 "아무 게이트나"가 아니라 "모든 게이트"가 필요하다는 것)를 최상단 요약이 여전히
틀리게 서술한다. 기능 영향은 없으나, 이 파일이 스스로 "hard gate"를 자처하며 상단 docstring 을 1차
근거로 삼는 만큼 방치하면 네 번째 재발의 씨앗이 될 수 있어 WARNING 으로 판단한다.

## 위험도

LOW
