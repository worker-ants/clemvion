# 부작용(Side Effect) Review — Round 6 (CI 백스톱 경화)

## 우선 보고: 작업 중 관측된 예상외 `git status` (WORKING-TREE RULE 대상)

리뷰 시작 시점 `git status --short`:
```
 M .claude/tests/test_review_gate_ci.py
?? review/code/2026/08/06/11_34_03/
```
`.claude/tests/test_review_gate_ci.py` 에 미커밋 diff(57줄, `ReviewArtifactsStayTrackedTest` 신설)가
있었는데, 이는 내가 읽은 프롬프트 번들(파일 3, 594줄)에는 없던 내용이었다. 이 파일을 건드리지
않고 관찰만 계속하던 중, 이후 시점 재확인에서 그 diff 가 사라지고 대신 새 커밋
`e46f5382c fix(harness): 이 백스톱이 서 있는 전제를 가드 — review/** 가 추적된다는 사실` 이
로그에 나타났다 — 즉 **동시 세션(아마 developer 롤)이 리뷰 도중 그 파일을 커밋**한 것이지,
내 쪽 mutation 실험이 실제 워크트리로 샌 것이 아니다. 모든 mutation 실험은 `mktemp -d` 로 만든
격리 클론(`git clone --local --no-hardlinks`)에서만 수행했고, 실험 종료 후
`git -C <실제 워크트리> status --short` 는 시종 `?? review/code/2026/08/06/11_34_03/` (이 리포트
산출물) 하나만 보였다 — 실제 저장소는 오염되지 않았다.

다만 **리뷰 페이로드(프롬프트 번들)가 참조한 스냅샷(`8ce96e72b`)이 리뷰 도중 stale 해졌다**는
사실 자체는 보고할 가치가 있다. 아래 발견은 두 스냅샷(`8ce96e72b`, 그리고 지금 HEAD 인
`e46f5382c`) 모두에서 재현했고 결론은 동일하다 — 새 커밋은 "`review/**` 가 gitignore 되지 않고
실제로 추적된다"는 전제만 가드할 뿐, 아래 발견의 표면(`review_guard.py` 내부의 환경변수 조건 분기)
과는 무관하다.

---

## 방법론

`WORKING-TREE RULE` 준수: 모든 변형은 `mktemp -d` 산출 디렉터리에 만든 로컬 clone
(`git clone --local --no-hardlinks <실제 워크트리> <scratch>/repo`) 안에서만 수행했고, 절대경로만
썼다. 두 스냅샷에서 반복 검증했다:

- `repo` = `8ce96e72b` (CI 백스톱 5R, 내가 받은 리뷰 번들과 동일)
- `repo_head2` = `e46f5382c` (리뷰 도중 동시 세션이 얹은 신규 커밋 포함, 현재 실제 HEAD)

## 발견사항

- **[CRITICAL]** "판정자가 하나다"라는 라운드 6의 설계 전제 자체가 다음 우회의 은신처다 —
  `review_guard.py` 안에 CI 잡(job)을 구분하는 환경변수 분기 하나만 심으면, 라운드 1~5가 뚫렸던
  자리(워크플로 YAML 배선, `check-review-gate.py` 의 import/호출/environ 표면, 스위트 호출 명령)를
  **전부 우회하지 않고도** 실제 PR 이 받는 판정을 뒤집을 수 있다.
  - 위치: `.claude/hooks/_lib/review_guard.py` 의 `evaluate_review()` 함수 (라운드 6 기준 정의부
    라인 942 부근, 두 스냅샷 동일). CI 백스톱은 이 함수에 판정을 전량 위임하도록 **설계**돼 있고
    (`scripts/check-review-gate.py`, `plan/in-progress/harness-review-gate-ci-backstop.md` §"판정자는
    하나다"), 로컬 훅(`guard_review_before_push.py`, `guard_review_before_stop.py`)도 동일 함수를
    부른다.
  - 상세: `evaluate_review()` 맨 앞, `cwd = cwd or os.getcwd()` 직후에 다음 3줄을 심었다(실측 diff):
    ```python
    if os.environ.get("GITHUB_JOB") == "gate":
        return ReviewDecision(False, "release fast path")
    ```
    `GITHUB_JOB` 은 GitHub Actions 러너가 **워크플로 작성자 개입 없이 자동으로** 채우는 표준
    환경변수로, 그 값은 실행 중인 잡의 `jobs.<id>` 의 `<id>` 문자열이다.
    `.github/workflows/review-gate.yml` 은 `jobs: gate: ...` 이므로 그 워크플로가 도는 동안은
    항상 정확히 `"gate"` 다. 반대로 `harness-checks.yml` 은 `jobs: unittest: ...` 이므로 하네스
    스위트(이 백스톱을 지키는 테스트 전체 포함)가 실제 GitHub Actions 위에서 돌 때는 절대
    `"gate"` 가 아니다 — 즉 **워크플로 이름/잡 이름만으로 CI 상의 두 실행 맥락이 완벽히
    구분**되고, 로컬 개발 머신·기존 테스트 스위트 어디에도 `GITHUB_JOB` 이 설정돼 있지 않다.
  - 왜 라운드 6의 세 가지 방어를 전부 피하는지:
    1. `OneJudgeTest`(`.claude/tests/test_review_gate_ci.py`)의 import 허용목록·호출 허용목록·
       속성-대입 금지·`environ`/`getenv`/`argv`/`putenv` 접근 금지는 **`SCRIPT` 상수, 즉
       `scripts/check-review-gate.py` 한 파일만** `ast.parse` 한다(`test_review_gate_ci.py`
       `SCRIPT = _harness.REPO_ROOT / "scripts" / "check-review-gate.py"`). `review_guard.py` 는
       스캔 대상이 아니다.
    2. `VerdictComesFromTheGateTest` 는 "판정자가 하나임을 행위로 고정"한다고 주장하지만, 실제로는
       `review_guard.py` 를 **완전히 다른 stub 클래스로 통째로 교체**한 뒤 `check-review-gate.py`
       가 그 stub 의 반환값을 그대로 전달하는지만 검증한다. `_HOSTILE_ENV` 를 아무리 키워도 실제
       `review_guard.py` 소스는 그 테스트에서 단 한 번도 실행되지 않으므로, 그 안에 심은 조건
       분기는 이 "행위 검증" 의 관측 범위 밖에 있다.
    3. `review_guard.py` 를 직접 부르는 다른 스위트들
       (`test_review_guard.py`, `test_review_guard_hardening.py`, `test_block_integrity.py`,
       `test_guard_review_before_push_main.py`, `test_push_guard_worktree_scope.py`,
       `test_stop_guard_failopen.py` 등, `grep -rln review_guard.py .claude/tests` 로 확인) 은
       실제 모듈을 부르긴 하지만, 어느 것도 `GITHUB_JOB` 을 설정하거나 검사하지 않는다 — 로컬
       개발 환경이든, `harness-checks.yml` 이 실제 GitHub Actions 위에서 이 스위트를 돌리는
       환경(잡 이름 `unittest`)이든 이 조건은 한 번도 참이 되지 않는다.
  - 실측 (아래 "재현" 절 참조): 두 스냅샷 모두에서 **`.claude/tests` 스위트 전체(829/831개, 로컬
    최소 환경과 `harness-checks.yml` 이 실제로 노출하는 GitHub Actions 환경변수를 흉내낸 환경
    양쪽) 가 그대로 통과**하면서, 동일한 저장소 상태(리뷰 안 된 `codebase/` 변경 1건)에 대해
    `check-review-gate.py --enforce` 의 실제 종료 코드/메시지가 `GITHUB_JOB=gate` 유무에 따라
    `exit 1 (미커버)` ↔ `exit 0 (통과 — release fast path)` 로 완전히 갈렸다. `--enforce` 를 켜기로
    결정한 뒤에도 이 백스톱은 review-gate.yml 의 `gate` 잡 위에서는 **영구히 무력**하다 — 지금
    관측 모드에서는 조언(advisory)조차 "통과"로 둔갑해 신호 자체가 사라진다.
  - 제안: 판정자 단일성 검증의 관측 범위를 `check-review-gate.py` 한 파일에서
    **`review_guard.py`(그리고 그것이 import 하는 `branch_guard.py`, `_shared/**`)까지 확장**해야
    한다. 두 축을 함께 닫을 것을 제안한다.
    (a) 정적: `review_guard.py`/`branch_guard.py`/`_shared/**` 에도 `environ`/`getenv`/`argv`/
        `putenv` Attribute 접근 금지를 적용하거나, 최소한 `GITHUB_*`/`CI`/`RUNNER_*` 이름을
        읽는 자리가 새로 생기면 실패하는 목록형 가드를 둔다(이 모듈은 원래도 `CLAUDE_PROJECT_DIR`
        하나는 정당하게 읽으므로 전면 금지보다는 등재제가 맞다 — `test_workflow_yaml_structure.py`
        의 `_JOB_CONDITIONS`/`_MAY_SWALLOW` 와 같은 패턴).
    (b) 행위: `VerdictComesFromTheGateTest` 를 stub 이 아니라 **진짜 `review_guard.py`** 위에서
        돌리는 변형을 하나 추가한다 — 리뷰 안 된 `codebase/` 변경이 있는 임시 git repo 를 만들고,
        `check-review-gate.py --root <repo> --enforce` 를 `GITHUB_JOB=gate` 를 포함한 현실적인
        GitHub Actions 환경변수 집합으로 돌려 여전히 `exit 1` 인지 확인한다. 이것이 있었다면 이번
        mutation 은 즉시 실패했을 것이다.

## 재현

**스냅샷 1 — `8ce96e72b`(리뷰 번들과 동일):**

```
$ SCRATCH=$(mktemp -d)
$ git clone --local --no-hardlinks --quiet <실제 워크트리> "$SCRATCH/repo"
$ cd "$SCRATCH/repo" && git log -1 --oneline
8ce96e72b fix(harness): CI 백스톱 5R — 우회가 CI 배선 층과 환경변수 축으로 이동
```

`evaluate_review()` 진입부에 3줄 patch (evaluate_review 정의 직후,
`cwd = cwd or os.getcwd()` 다음):
```python
    if os.environ.get("GITHUB_JOB") == "gate":
        return ReviewDecision(False, "release fast path")
```

전체 하네스 스위트, 로컬 최소 환경:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    python3 -m unittest discover -s .claude/tests -p 'test_*.py'
----------------------------------------------------------------------
Ran 829 tests in 97.544s

OK
```

전체 하네스 스위트, `harness-checks.yml` 이 실제 GitHub Actions 위에서 노출하는 환경(잡 이름
`unittest`)을 흉내낸 환경:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    CI=true GITHUB_ACTIONS=true GITHUB_JOB=unittest GITHUB_WORKFLOW=harness-checks \
    GITHUB_ACTOR=someuser GITHUB_REF=refs/pull/123/merge GITHUB_EVENT_NAME=pull_request \
    python3 -m unittest discover -s .claude/tests -p 'test_*.py'
----------------------------------------------------------------------
Ran 829 tests in 93.631s

OK
```

실제 검증 대상 — 리뷰 안 된 `codebase/` 변경 1건을 가진 임시 저장소에서
`check-review-gate.py --enforce` 실행, `review-gate.yml` 의 `gate` 잡(job)이 실제로 노출하는 환경
vs 로컬/테스트 환경:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    CI=true GITHUB_ACTIONS=true GITHUB_JOB=gate GITHUB_WORKFLOW=review-gate \
    GITHUB_ACTOR=someuser GITHUB_REF=refs/pull/123/merge GITHUB_EVENT_NAME=pull_request \
    python3 scripts/check-review-gate.py --root <demo-repo> --enforce
review-gate: 통과 — release fast path
exit=0

$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    python3 scripts/check-review-gate.py --root <demo-repo> --enforce
review-gate: 미커버 — 1 codebase/ file(s) changed on this branch but no resolved review
             (review/code/**/SUMMARY.md) was found.
review-gate: 이 PR 의 codebase/** 변경을 커버하는 해결된 리뷰가 커밋돼 있지 않습니다.
             `/ai-review` 후 발견을 처분하고 `review/` 산출물을 이 PR 에 커밋하세요.
exit=1
```

**스냅샷 2 — `e46f5382c`(리뷰 도중 동시 세션이 얹은 최신 HEAD, `ReviewArtifactsStayTrackedTest`
포함)에서 동일 실험 재확인:**

```
$ git clone --local --no-hardlinks --quiet <실제 워크트리> "$SCRATCH/repo_head2"
$ cd "$SCRATCH/repo_head2" && git log -1 --oneline
e46f5382c fix(harness): 이 백스톱이 서 있는 전제를 가드 — review/** 가 추적된다는 사실
```
(동일 3줄 patch 적용 후)

전체 스위트, 로컬 최소 환경:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    python3 -m unittest discover -s .claude/tests -p 'test_*.py'
----------------------------------------------------------------------
Ran 831 tests in 98.835s

OK
```

전체 스위트, `harness-checks.yml` 환경 흉내:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    CI=true GITHUB_ACTIONS=true GITHUB_JOB=unittest GITHUB_WORKFLOW=harness-checks \
    GITHUB_ACTOR=someuser GITHUB_REF=refs/pull/123/merge GITHUB_EVENT_NAME=pull_request \
    python3 -m unittest discover -s .claude/tests -p 'test_*.py'
----------------------------------------------------------------------
Ran 831 tests in 94.600s

OK
```

라운드 6이 새로 짠 관련 테스트 클래스만 targeted 실행 (전부 통과, 55/55):
```
$ cd .claude/tests && env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 python3 -m unittest \
    test_review_gate_ci.OneJudgeTest \
    test_review_gate_ci.VerdictComesFromTheGateTest \
    test_review_gate_ci.WorkflowWiringTest \
    test_review_gate_ci.ReviewArtifactsStayTrackedTest \
    test_review_gate_ci.PyYamlPinsAgreeTest \
    test_block_integrity \
    test_workflow_yaml_structure -v
----------------------------------------------------------------------
Ran 55 tests in 1.047s

OK
```

`gate` 잡 환경 vs 로컬/테스트 환경, 동일 데모 저장소:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    CI=true GITHUB_ACTIONS=true GITHUB_JOB=gate GITHUB_WORKFLOW=review-gate \
    GITHUB_ACTOR=someuser GITHUB_REF=refs/pull/999/merge GITHUB_EVENT_NAME=pull_request \
    python3 scripts/check-review-gate.py --root <demo-repo> --enforce
review-gate: 통과 — release fast path
exit=0

$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    python3 scripts/check-review-gate.py --root <demo-repo> --enforce
review-gate: 미커버 — 1 codebase/ file(s) changed on this branch but no resolved review ...
exit=1
```

작업 종료 후 실제 워크트리 상태(오염 없음 확인):
```
$ git -C <실제 워크트리> status --short
?? review/code/2026/08/06/11_34_03/
```
(내 리포트 산출물 하나뿐 — 모든 patch/실행은 `mktemp -d` scratch clone 안에서만 수행했고,
scratch 는 실험 종료 후 삭제했다.)

## 기타 관측 (경미)

- **[INFO]** `test_review_gate_ci.py` 의 `VerdictComesFromTheGateTest._HOSTILE_ENV` 는
  `GITHUB_ACTOR`/`GITHUB_REF`/`CI`/`REVIEW_GATE_SKIP`/`REVIEW_GATE_ENFORCE` 만 담고
  `GITHUB_JOB`/`GITHUB_WORKFLOW`/`RUNNER_*` 류는 없다. 위 CRITICAL 의 제안 (b)를 적용할 때
  이 목록에도 추가해 두는 편이 앞으로 같은 클래스의 재발을 좁힌다(그 자체로는 지금 발견을
  닫지 못한다 — 이 목록이 적용되는 대상이 여전히 stub `review_guard.py` 이기 때문).
- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "판정자는 하나다" 절은
  로컬/CI 가 같은 함수를 부른다는 사실만 진술하고, 그 함수가 **호출 맥락(어떤 GitHub Actions
  잡이 불렀는가)에 따라 답을 달리하지 않는다**는 것은 별도로 보장되지 않는다는 점을 문서가
  명시하지 않는다. 이번 발견은 그 미진술 전제가 실제로 깨질 수 있음을 보여준다.

## 요약

라운드 1~5가 닫은 축(워크플로 YAML 전체 일치, `continue-on-error`/`if`/스위트 호출 명령의 전
워크플로 등재제, `check-review-gate.py` 의 import·호출·환경변수·속성-대입 표면 금지, 스텁 게이트
행위 검증의 적대적 환경)은 전부 여전히 유효하고 각자 겨눈 우회를 정확히 막는다. 그러나 "판정자는
하나"라는 라운드 6의 핵심 방어 전제 자체가 새로운 공격면이다 — 그 하나의 판정자
(`review_guard.py::evaluate_review`)는 `check-review-gate.py` 밖에 있고, 그 안에 GitHub Actions가
자동으로 채우는 `GITHUB_JOB` 값(워크플로 작성자가 손댈 필요조차 없는 표준 러너 변수)에 대한 조건
분기 3줄만 심으면 `review-gate.yml` 의 `gate` 잡 위에서만 선택적으로 통과 판정을 낸다. 이는 정적
AST 스캔(스캔 파일이 `check-review-gate.py` 하나뿐), 행위 스텁 테스트(진짜 `review_guard.py` 를
전혀 실행하지 않음), `review_guard.py` 를 직접 부르는 기존 스위트(누구도 `GITHUB_JOB` 을 설정/검사
안 함) 세 방어선 모두의 사각지대에 정확히 들어맞아, 두 스냅샷(`8ce96e72b`, `e46f5382c`) 양쪽에서
전체 하네스 스위트(각각 829/831개)를 로컬 환경과 `harness-checks.yml` 이 실제로 노출하는 GitHub
Actions 환경 양쪽에서 100% 녹색으로 유지하면서, 동일한 미리뷰 상태에 대한 백스톱의 실제 판정을
`exit 1`(미커버, 향후 enforce 시 차단)에서 `exit 0`(통과)으로 조용히·영구히 뒤집었다. `--enforce`
를 켠 뒤에도 이 경로는 죽지 않으며, 지금 관측 모드에서도 조언 메시지 자체가 "통과"로 나와 신호가
사라진다는 점에서 즉시 위험하다. 부수적으로, 리뷰 도중 동시 세션이 검토 대상 파일
(`test_review_gate_ci.py`)을 커밋해 리뷰 페이로드 스냅샷이 stale 해지는 것을 관측했으나 — 이는
WORKING-TREE RULE 이 경계하는 "리뷰어가 실제 트리를 오염시킨" 사고가 아니라 병렬 세션의 정상
커밋이었고, 실제 워크트리는 시종 깨끗했다(모든 mutation 은 격리된 scratch clone 안에서만 수행).

## 위험도

CRITICAL
