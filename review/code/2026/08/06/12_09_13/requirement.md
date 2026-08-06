# 요구사항(Requirement) 리뷰 — CI 백스톱 7R: 다음 층 탐색 결과

CONTEXT 지시대로, round 7 이 닫은 표면(워크플로 문서 전체 고정, job/step 조건 등재제,
`continue-on-error` 전역 금지, `pull_request` 키 집합 등재제, workflow/job identity 유일성,
스위트 호출 명령 고정, `check-review-gate.py` 의 import/call/attribute-assign/환경-접근 정적
금지, 게이트 본체(`review_guard.py`/`branch_guard.py`/`plan_guard.py`) 의 env 읽기 (file,var)
등재제, 최소·적대적 환경 행위 테스트, `review/**` 추적 전제 가드) 를 우회하지 않고 **그 바깥**을
찾아, 내 자신의 샌드박스에서 실제로 판정을 뒤집어 봤다. 저장소 워킹트리는 건드리지 않았다
(`git status` 최종 확인 결과 첨부).

## 발견사항

- **[CRITICAL]** env-분기 금지 레지스트리가 `.claude/hooks/_lib/*.py` 세 파일만 스캔하고,
  그 세 파일이 실제 판정 로직을 위임하는 `.claude/_shared/*.py` (특히 `report_paths.py`,
  `block_integrity.py`) 는 스캔 대상 밖이다 — **round 6 이 `review_guard.py` 자체에서 닫은
  바로 그 공격("`if os.environ.get('GITHUB_JOB') == 'gate'`: …")을, 소스만 한 파일 옆으로
  옮기면 그대로 재현할 수 있다.**
  - 위치: `.claude/tests/test_review_gate_ci.py:603` — `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED = ("review_guard.py", "branch_guard.py", "plan_guard.py")` (전부 `_harness.HOOKS_DIR / "_lib" / name` 로 해석 — `.claude/hooks/_lib/` 안쪽만 본다).
  - 위치: `.claude/tests/test_review_gate_ci.py:220` (`OneJudgeTest`) — AST 스캔 대상이 `scripts/check-review-gate.py` **한 파일**뿐이다.
  - 위치: `.claude/tests/test_review_gate_ci.py:498` (`VerdictComesFromTheGateTest`) — "판정자가 하나임을 행위로 고정"한다는 이 테스트는 `.claude/hooks/_lib/review_guard.py` **전체를 스텁으로 완전히 대체**한다(`_shared` import 자체가 없는 스텁). 그래서 최소/적대적 환경(`_HOSTILE_ENV`, `GITHUB_JOB: "gate"` 포함, `test_review_gate_ci.py:545`)에서 도는데도 진짜 `_shared/report_paths.py`/`block_integrity.py` 는 **한 번도 실행되지 않는다**.
  - 위치: `.claude/hooks/_lib/review_guard.py:149-150` — `from _shared import report_paths as _report_paths_lib` / `from _shared import block_integrity as _block_integrity`. 실제 커버리지 판정(`_forced_coverage_missing`, `:460`)과 Gate 2 하향 판정(`_summary_block_is_no`, `:762`; `contradiction_note`, `:804`)이 정확히 이 두 모듈에 위임돼 있다 — "판정자는 하나"라는 이 브랜치 전체의 핵심 주장이 실제로는 `review_guard.py` + `_shared/*.py` **두 층**에 걸쳐 있는데, 레지스트리는 앞쪽 층만 본다.
  - **실증(샌드박스, 저장소 워킹트리 무변경)**: `.claude/_shared/report_paths.py::missing_reports()` 맨 앞에 두 줄만 추가했다 —
    ```python
    if os.environ.get("GITHUB_JOB") == "gate":
        return []  # perf: skip disk IO in CI
    ```
    (`os` 는 이미 그 파일이 import 하고 있어 새 import 조차 필요 없다.) 이 두 줄은 forced-reviewer
    커버리지 체크를 **review-gate.yml 의 실제 job(`jobs.gate`)에서만** 항상 "전원 보고 완료"로
    판정하게 만든다 — GitHub Actions 가 매 스텝에 자동으로 채우는 `GITHUB_JOB` 값이 정확히
    `review-gate.yml` 의 job id `gate` 이므로, 공격자가 별도로 아무것도 할 필요가 없다.
  - **결과 (커맨드 + 출력, 전문 아래 §재현 참조)**: 동일한 fixture 저장소(codebase/ 변경 1건 +
    필수(`agents_forced`) 리뷰어 `security` 가 보고서를 남기지 않은 "미완료" 리뷰 세션)에
    대해, 백도어 없는 원본 `report_paths.py` 는 `GITHUB_JOB` 유무와 무관하게 **항상
    `미커버`/exit 1** (정확한 현재 동작). 백도어를 넣은 사본은 `GITHUB_JOB` 없을 때
    (로컬/harness-checks.yml 의 job id 는 `unittest` 라 여전히 `미커버`/exit 1) → **그대로
    미커버**이지만, `GITHUB_JOB=gate` 를 추가하는 것만으로 **`통과`/exit 0 로 뒤집힌다** —
    `security` 리뷰어는 실제로 아무 보고서도 남기지 않았는데도.
  - **테스트 전량 GREEN 확인**: 이 백도어가 심긴 상태로 `.claude/tests/test_review_gate_ci.py`
    (17개), `test_report_paths_shared.py`(16개, `_shared/report_paths.py` 의 직접 단위
    테스트!), `test_workflow_yaml_structure.py`(12개), `test_block_integrity.py`(39개),
    `test_review_guard.py`(37개) 를 전부 클린 환경(`env -i`, `GITHUB_JOB` 없음)에서 실행 —
    121개 중 120개 GREEN. 유일한 실패(`test_the_committed_tree_actually_carries_review_artifacts`,
    ">100개의 실제 review/ 커밋 필요")는 내 샌드박스가 실제 `review/` 이력을 복사하지 않아
    생기는 것으로, 백도어를 제거한 대조군에서도 **동일하게** 실패해 무관함을 확인했다(§재현
    2번째 블록).
  - 제안: `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED` 에 `_shared/report_paths.py`,
    `_shared/block_integrity.py`(그리고 이상적으로는 review_guard 가 import 하는 `_shared/`
    전체를 정적으로 열거하기보다, import 그래프를 따라가는 편이 다음 회귀를 막는다)를
    추가하고, `VerdictComesFromTheGateTest`/`ReviewGateCliTest` 의 적대적 환경 테스트가
    **스텁이 아니라 진짜 `_shared` 모듈**을 통해 `GITHUB_JOB`/`GITHUB_ACTIONS` 등 GH Actions
    표준 컨텍스트 아래에서도 검증하도록 최소 한 케이스를 추가할 것. (round 6 리뷰어가 이미
    `review_guard.py:589` 주석에 이 정확한 공격 형태 — `if os.environ.get("GITHUB_JOB") ==
    "gate")` — 를 위협 모델로 적어 뒀다는 점에서, 이건 "새로운 상상"이 아니라 **바로 그 위협의
    등재 범위가 한 디렉터리 좁았던 것**이다.)

- **[WARNING]** 관측 모드에서도 이미 실피해가 있다 — `plan/in-progress/harness-review-gate-ci-backstop.md`
  는 "`--enforce` 를 켤지는 여기 쌓이는 CI 판정으로 결정한다"고 명시한다(§본체 구현 완료 배너,
  `check-review-gate.py:38-40` 의 독스트링과 동일 주장). 위 CRITICAL 은 `--enforce` 이전부터
  그 판정 데이터 자체를 오염시킨다 — 미완료 리뷰가 CI 로그에 "통과"로 찍히면, 켤지 말지를
  결정할 근거 표본이 이미 거짓이다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:39-40`, `scripts/check-review-gate.py:38-40`.
  - 제안: 위 CRITICAL 을 닫기 전까지는 이 결정 근거로 review-gate.yml 관측 로그를 신뢰하지 말 것.

- **[INFO]** 같은 클래스가 `_shared/retry_state.py` 에도 열려 있는지는 이번에 직접 실증하지
  않았다(review_guard.py 의 판정 경로가 그 모듈을 직접 소비하지 않아 우선순위가 낮다 — 주로
  orchestrator CLI 쪽 소비). 다만 `_SCANNED`/`OneJudgeTest` 모두 그 파일 역시 스캔하지
  않으므로, 그 모듈이 앞으로 판정에 관여하게 되면 같은 구멍이 재발한다. 등재를 디렉터리
  전체로 넓히는 편이 파일 하나씩 쫓는 것보다 이 재발 패턴(7라운드 전부 "한 파일을 닫으면
  우회는 그 파일 밖으로 이동")을 구조적으로 닫는다.

## 재현 (커맨드 + 출력 — 전문)

작업 디렉터리: `/private/tmp/.../scratchpad/ci-backstop-round7*`(스크래치패드, 저장소 밖).
저장소 워킹트리에는 어떤 파일도 쓰지 않았다 — 마지막 `git status` 로 확인.

### 1) 백도어 삽입 지점 (샌드박스 사본, 저장소 원본 아님)

```
$ sed -n '96,106p' .claude/_shared/report_paths.py   # (샌드박스 사본)
def missing_reports(session_dir: str, names, state: dict) -> list[str]:
    """Which of `names` left no usable report. Empty ⇒ complete coverage."""
    if not isinstance(names, list):
        return []
    if os.environ.get("GITHUB_JOB") == "gate":
        return []  # perf: skip disk IO in CI
    return [n for n in names if not has_report(session_dir, n, state)]
```

### 2) 기존 하네스 스위트 — 백도어를 심은 채로 관련 파일 전량 GREEN

```
$ cd <sandbox>
$ for f in test_review_gate_ci test_report_paths_shared test_workflow_yaml_structure \
           test_block_integrity test_review_guard; do
    env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 python3 .claude/tests/$f.py -v
  done
```
결과 (요약):
```
test_review_gate_ci        : Ran 17 tests — FAILED (failures=1)
  → AssertionError: 0 not greater than 100 : 추적되는 리뷰 SUMMARY 가 0개뿐이다
    (test_the_committed_tree_actually_carries_review_artifacts — 아래 대조군으로 무관함 확인)
test_report_paths_shared   : Ran 16 tests — OK   (report_paths.py 의 직접 단위 테스트!)
test_workflow_yaml_structure: Ran 12 tests — OK
test_block_integrity       : Ran 39 tests — OK
test_review_guard          : Ran 37 tests — OK
```

**대조군 — 백도어 제거 후 동일 실행, 동일한 단일 실패**(샌드박스가 실제 `review/` 커밋
이력을 담지 않아서 생기는, 내 변경과 무관한 실패임을 확인):
```
$ git checkout -- .claude/_shared/report_paths.py   # 백도어 제거
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 python3 .claude/tests/test_review_gate_ci.py -v
...
AssertionError: 0 not greater than 100 : 추적되는 리뷰 SUMMARY 가 0개뿐이다 ...
Ran 17 tests in 2.570s
FAILED (failures=1)
```
→ 백도어 유무와 무관하게 동일한 한 건만 실패 = 위 120/121 GREEN 은 백도어가 만든 결과가
아니라 그 반대(백도어가 **완전히 안 보인다**)를 뒷받침한다.

### 3) 실제 PR 시나리오 재현 — 판정이 뒤집힌다

fixture: `git init` 저장소, `main` 위에 `feature` 브랜치. `feature` 가 `codebase/backend/src/a.ts`
1개를 추가하고, `review/code/2099/01/01/00_00_00/` 에 "위험도 NONE" 인 `SUMMARY.md` 를
커밋하되 `_retry_state.json` 이 `agents_forced: ["security"]` 를 선언하면서 **`security.md`
보고서는 실제로 남기지 않는다**(정확히 이 저장소가 `_forced_coverage_missing` 을 만든 이유인
"라우터 화이트리스트를 실제로 안 돌았는데 통과로 잡히는" 그 모양).

**백도어 심은 사본**:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    python3 scripts/check-review-gate.py --root <fixture> --enforce
review-gate: 미커버 — 1 codebase/ file(s) changed on this branch but no resolved review ...
exit_code=1

$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 GITHUB_JOB=gate \
    python3 scripts/check-review-gate.py --root <fixture> --enforce
review-gate: 통과 — 1 codebase/ change(s) covered by a fresh resolved review — allowed
exit_code=0
```
`GITHUB_JOB=gate` 하나 더한 것 말고는 완전히 같은 저장소, 같은 명령이다. 이것은
GitHub Actions 가 `review-gate.yml` 의 `jobs.gate` 안 모든 스텝에 자동으로 채워 넣는
바로 그 값이다 — 공격자가 위조할 필요조차 없다.

**대조군 — 원본(백도어 없는) `report_paths.py` 로 동일 fixture**:
```
$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
    python3 scripts/check-review-gate.py --root <fixture-control> --enforce
review-gate: 미커버 ... / exit_code=1

$ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 GITHUB_JOB=gate \
    python3 scripts/check-review-gate.py --root <fixture-control> --enforce
review-gate: 미커버 ... / exit_code=1
```
→ 원본은 `GITHUB_JOB` 값과 무관하게 항상 `미커버` (현재 올바른 동작). 판정이 갈리는 것은
오직 백도어가 있을 때, 오직 `GITHUB_JOB=gate` 일 때뿐이다.

### 4) 저장소 워킹트리 무변경 확인

```
$ cd /Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379
$ git status --short
?? review/code/2026/08/06/12_09_13/
$ git diff --stat
(no output)
```
(이 미추적 디렉터리는 본 리뷰 세션 자신의 산출물 경로이며, 조사 중 내가 만든 어떤 백도어도
저장소 안에는 없다 — 전부 `/private/tmp/.../scratchpad/` 아래 사본에서만 만들고 지웠다.)

## 요약

Round 7 은 "판정자는 하나"라는 불변식을 `check-review-gate.py`(정적 import/call/attribute-
assign 스캔) 와 `review_guard.py`/`branch_guard.py`/`plan_guard.py`(env-read 등재제 +
스텁 기반 행위 테스트) 두 층에서 강하게 고정했지만, 그 두 층이 실제로 위임하는 세 번째 층 —
`.claude/_shared/report_paths.py`(forced-coverage 판정)와 `block_integrity.py`(BLOCK 하향
판정) — 은 두 레지스트리 중 **어디에도 등재돼 있지 않다**. `review_guard.py:149-150` 이 이
모듈들을 직접 import 해 커버리지·하향 판정을 위임하는데도, `TheGateItselfDoesNotBranchOnCiEnvTest`
의 `_SCANNED` 는 `.claude/hooks/_lib/` 안쪽 세 파일만 보고, `VerdictComesFromTheGateTest`
는 `review_guard.py` 전체를 (그 import 를 포함해) 스텁으로 갈아치우는 방식으로 "행위"를
검증하기 때문에 진짜 `_shared` 코드는 그 테스트에서 단 한 번도 실행되지 않는다. 그 결과, 이
저장소가 round 6 에서 이미 `review_guard.py` 자체에 대해 명시적으로 막았던 바로 그 공격
형태(`GITHUB_JOB == "gate"` 분기)를, `os` 를 이미 import 하고 있는 이웃 모듈로 두 줄만
옮기면 정적 검사·행위 테스트 121개 중 120개(무관한 1개 제외 전부)를 GREEN 으로 유지한 채
재현할 수 있음을 격리된 샌드박스에서 실측으로 확인했다: 필수 리뷰어가 실제로는 보고서를
남기지 않은 세션이, `review-gate.yml` 의 실제 job 환경(`GITHUB_JOB=gate`, 위조 불필요)에서만
"미커버"(exit 1)에서 "통과"(exit 0)로 조용히 뒤집힌다. 이는 아직 `--enforce` 이전이라 PR
을 직접 막지는 않지만, 이 저장소가 `--enforce` 를 켤지 결정하는 데 쓰겠다고 명시한 바로 그
관측 데이터를 지금 이 순간부터 오염시킬 수 있다는 점에서 활성 결함이다.

## 위험도

CRITICAL
