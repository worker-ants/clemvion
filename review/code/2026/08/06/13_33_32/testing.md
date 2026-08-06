# 테스트(Testing) Review — round 9

## 방법

`.claude/hooks/_lib/{review_guard,plan_guard,branch_guard}.py`, `scripts/check-review-gate.py`,
`.github/workflows/{review-gate,harness-checks}.yml`, `.claude/tests/{test_review_gate_ci,
test_plan_guard,test_review_guard,test_review_guard_hardening,test_workflow_yaml_structure,
test_stop_guard_failopen,test_block_integrity}.py` 를 리포에서 직접 `Read` 하고(프롬프트가
`review_guard.py`/`README.md`/`test_block_integrity.py`/`test_review_gate_ci.py` 를 크기 제한으로
자르거나 아예 싣지 못했음), 관련 스위트를 그대로 실행했다:

```
$ python3 -m pytest .claude/tests/test_review_gate_ci.py .claude/tests/test_plan_guard.py \
    .claude/tests/test_review_guard_hardening.py .claude/tests/test_workflow_yaml_structure.py \
    .claude/tests/test_stop_guard_failopen.py .claude/tests/test_block_integrity.py -q
171 passed, 230 subtests passed in 6.72s
```

7R/8R 이 고친 두 결함(leading-space `.strip()`, `git status --porcelain` 비-ASCII quoting)은
`plan_guard.py`/`review_guard.py` 양쪽 모두 `rstrip()` + `-c core.quotePath=false` 로 이미
동기화돼 있음을 소스로 확인했다(`plan_guard.py:119,125`, `review_guard.py:227,245`) — 자매 훅
drift 는 이번 라운드엔 재발하지 않았다. `branch_guard._run_git` 은 여전히 `.strip()` 이지만
소비 대상이 `symbolic-ref`/`remote show origin` 뿐이라 porcelain 고정폭 파싱과 무관 — 같은 결함
클래스 아님(확인만 하고 발견사항에는 안 올림).

이번 라운드는 "우회"가 아니라 **verdict 를 실제로 뒤집는, 아직 아무 테스트도 건드리지 않은
파싱 결함**을 하나 찾았다. mutant 가 아니라 현재 코드 그대로(수정 없이) 재현된다.

---

## 발견사항

- **[CRITICAL]** `_summary_is_resolved` 의 위험도 파싱이 "## 전체 위험도" 보다 앞에 오는
  프로즈(decoy) 한 줄만으로 진짜 HIGH/CRITICAL 판정을 통째로 못 본다 — Gate 1 오픈, 테스트 0건
  - 위치: `.claude/hooks/_lib/review_guard.py` 함수 `_summary_is_resolved`, 바깥 루프의
    무조건 `break` — 526~544행 (`for i, ln in enumerate(lines): ... break` 의 마지막 `break`,
    544행).
  - 상세: 위험도를 뽑는 바깥 `for` 루프는 `_RISK_LINE`("전체\s*위험도")에 **처음** 매치하는
    줄에서 안쪽 루프로 레벨을 찾고, 안쪽 루프가 레벨을 찾았든 못 찾았든 **무조건** `break` 로
    바깥 루프 자체를 끝낸다(544행). 안쪽 루프는 다음 heading(`#`)을 만나면 레벨을 못 찾아도
    멈춘다(538~539행). 그 결과, 파일 안에서 "전체 위험도"라는 문자열이 실제 heading보다
    **먼저** 등장하고 그 지점부터 다음 heading 까지 레벨 토큰이 없으면, `risk_level` 은
    영구히 `None` 으로 굳고 — 진짜 `## 전체 위험도` 섹션(과 그 아래 `**HIGH**` 같은 실제
    레벨)은 두 번 다시 스캔되지 않는다. `has_actionable`(Critical/Warning 표 행 존재 여부)이
    별도 루프(`_section_has_rows`, 조기 종료 없음)라서 이 결함의 영향을 안 받지만, 표 행 없이
    서술로만 HIGH/CRITICAL 을 적은(=`RESOLUTION.md` 도 없는) 리포트라면
    `risk_level in ("HIGH","CRITICAL")` 이 거짓, `has_actionable` 도 거짓이 되어 함수 끝의
    `return True`(= "resolved") 로 떨어진다. 이는 **바로 이 함수 자체의 docstring/직전
    수정 이력이 명시적으로 경계했던 실패 방향**이다 — `git log -L`로 확인하면 원래
    3줄 윈도우("레벨이 heading 몇 줄 아래 있으면 못 찾고 조용히 None 으로 떨어진다")를 고친
    커밋(`c50d8a996`)의 주석이 정확히 이 위험을 설명하는데, 그 수정은 윈도우 폭만 넓혔을 뿐
    "앞선 헛매치가 뒤의 진짜 heading 을 가린다"는 별도 경로는 안 건드렸다.
    이 결함은 조작된(forged) 입력이 필요 없다 — `SUMMARY.md` 는 LLM 이 쓰는 자유형 markdown
    이고(`block_integrity.py` 자신의 주석도 "a SUMMARY is LLM-written markdown with no
    enforced size"라고 명시), 실제로 저장소에 커밋된 808개 `review/code/**/SUMMARY.md` 중
    6개는 이미 "전체 위험도"라는 문구가 heading 이 아닌 줄(서두 문장·bullet)에서 먼저
    등장한다 — 우연히 그 6개는 같은 줄/바로 다음 줄에 레벨 토큰이 있어서 damage 가 없었을
    뿐, 코드 경로 자체는 지뢰밭 그대로다.
  - **재현 (수정 없이, 실물 `review_guard.py` 그대로)**:
    ```
    $ python3 - <<'EOF'
    import sys, os, tempfile
    sys.path.insert(0, ".claude/hooks/_lib")
    import review_guard as rg
    summary = (
        "# 보고서\n\n"
        "이 PR 은 여러 reviewer 관점을 종합했다. 전체 위험도 판단은 아래에 있다.\n\n"
        "## 전체 위험도\n\n**HIGH**\n\n"
        "## Critical 발견사항\n\n해당 없음.\n\n"
        "## 경고 (WARNING)\n\n해당 없음.\n"
    )
    d = tempfile.mkdtemp(); p = os.path.join(d, "SUMMARY.md")
    open(p, "w", encoding="utf-8").write(summary)
    print(rg._summary_is_resolved(p))   # HIGH·RESOLUTION.md 없음 → False 여야 함
    EOF
    True
    ```
    그리고 **실제 verdict 함수까지** 관통시켜, mutant 가 아니라 실물 코드가 실제 게이트
    판정을 뒤집는 것도 확인했다(임시 git repo, `codebase/` 변경 1건 + 위 SUMMARY 를 커밋):
    ```
    d = rg.evaluate_review(root)
    # blocked: False
    # reason: 1 codebase/ change(s) covered by a fresh resolved review — allowed
    ```
    `RESOLUTION.md` 없이, 표 행도 없이, 오직 heading 앞의 서술 한 줄 때문에 HIGH 리스크
    리뷰가 "resolved"로 게이트를 통과한다. 이 함수는 로컬 push 훅과 CI 백스톱
    (`scripts/check-review-gate.py`) 이 **공유**하는 단일 판정자이므로 양쪽 다 같이 뚫린다.
  - **테스트 갭**: `RiskLevelWindowTest`(test_review_guard_hardening.py)와
    `SummaryResolvedTest`(test_review_guard.py) 둘 다 "레벨이 heading 몇 줄 아래" 케이스만
    고정했고, "heading **전에** 오는 헛매치" 케이스는 어느 파일에도 없다. `_section_has_rows`
    가 독립 루프라 이 결함이 표-행 있는 리포트에서는 안 드러나므로, 기존 `CRITICAL_SUMMARY`류
    고정 픽스처(표 행 포함)로는 절대 못 잡는다 — 딱 이 형태(서술만 있는 고위험 판정)를 위한
    별도 fixture 가 필요하다.
  - 제안: 바깥 루프의 `break` 를 안쪽 루프가 실제로 레벨을 찾았을 때만 실행하도록 바꾸고(즉
    헛매치를 만나면 계속 다음 "전체 위험도" 매치를 찾아 진행), 위 재현 스니펫을
    `RiskLevelWindowTest` 에 회귀 테스트로 추가한다. 아울러 6개 실측 파일
    (`review/code/2026/06/06/22_20_59/SUMMARY.md` 등, "전체 위험도"가 heading 이 아닌 줄에서
    먼저 나오는 실제 커밋 사례)을 실제 저장소로 구동하는 회귀에 최소 1건 포함시키면 이
    파싱 함수가 "손으로 고른 코퍼스"가 아니라 실제 산출물 분포를 대표하게 된다(이 저장소가
    이미 다른 자리에서 쓰는 패턴 — `PorcelainPathSurvivesOnARealRepoTest` 류).

- **[INFO]** (참고, 새 항목 아님) `branch_guard._run_git` 은 여전히 `.strip()` 을 쓰지만
  이 모듈이 파싱하는 출력(`symbolic-ref`, `remote`, `remote show origin`)은 어느 것도
  `git status --porcelain` 의 두 칸 상태 코드 형태가 아니므로 7R/8R 이 고친 결함 클래스와
  무관함을 확인했다. `plan_guard.py`/`review_guard.py` 는 둘 다 `rstrip()` +
  `-c core.quotePath=false` 로 이미 동기화돼 있다 — 자매 훅 drift 재발 없음.

- **[INFO]** `test_review_gate_ci.py::WorkflowWiringTest.EXPECTED` 를 현재
  `.github/workflows/review-gate.yml` 실물과 필드 단위로 대조했다 — 정확히 일치. 관측 모드
  계약(`--enforce` 부재), fail-open 세 경로, advisory 무조건 출력, `OneJudgeTest`/
  `VerdictComesFromTheGateTest`/`TheGateItselfDoesNotBranchOnCiEnvTest`/
  `TheRealGateIgnoresTheEnvironmentTest`/`ReviewArtifactsStayTrackedTest`/
  `PyYamlPinsAgreeTest` 전부 그린이고 각자의 존재 이유(과거 우회 라운드)가 docstring 에
  근거와 함께 남아 있어 vacuous 하지 않음을 확인했다. `test_workflow_yaml_structure.py` 의
  등재제(job/step `if:`, `continue-on-error`, `pull_request` 트리거 키 집합, 워크플로/job
  identity 유일성)도 실물 워크플로 7개 전체를 스캔해 통과하며, 등록된 예외가 죽지 않았는지
  (`_MAY_SWALLOW`/`_JOB_CONDITIONS`/`_STEP_CONDITIONS`/`_PULL_REQUEST_KEYS` 의 "역방향" 단언)
  까지 갖춰져 있다 — 새 항목 없음.

---

## 요약

7R/8R 이 잡은 두 자매-훅 drift(leading-space strip, non-ASCII quoting)는 이번 라운드엔
재발하지 않았고 소스로 직접 확인했다. 대신 같은 파일(`review_guard.py`) 안에서 지금까지
아무도 건드리지 않은 별도 파싱 결함을 찾았다 — 위험도 heading보다 앞서는 헛매치 한 줄이
있으면 바깥 루프가 무조건 멈춰, 표 행이 없는 서술형 HIGH/CRITICAL 리뷰가 `RESOLUTION.md`
없이도 "resolved"로 통과한다. mutant 가 아니라 **수정하지 않은 실물 코드**로 재현했고,
`_summary_is_resolved()` 단위뿐 아니라 `evaluate_review()`(로컬 push 훅과 CI 백스톱이 공유하는
바로 그 판정 함수)까지 관통시켜 실제 verdict 가 뒤집히는 것을 확인했다. 이 조합(heading 전
서술 + 표 없는 고위험 판정)은 조작이 필요 없는 LLM 자유형 markdown 의 자연스러운 변주이고,
실제로 커밋된 SUMMARY.md 808개 중 6개가 이미 "heading 아닌 곳에서 먼저 매치"되는 형태를
갖고 있어 코드 경로 자체가 살아있는 지뢰다. 기존 회귀 스위트(`RiskLevelWindowTest`,
`SummaryResolvedTest`)는 "heading 아래 몇 줄" 케이스만 고정했을 뿐 "heading 앞" 케이스를
전혀 다루지 않아 이 결함을 잡을 수 없다. 그 외 CI 워크플로 배선·환경변수 비분기·판정자
단일성 계열 가드(6~9R 누적분)는 전부 실측 그린이고 각자 존재 이유가 살아 있어 새 우회를
찾지 못했다.

## 위험도

CRITICAL
