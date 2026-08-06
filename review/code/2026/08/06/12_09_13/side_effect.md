# 부작용(Side Effect) Review — round 7 CI 백스톱

CONTEXT 의 요청대로 "다음 한 층 밖"을 실제로 찾아 내 소유 디렉터리(`mktemp -d`)에서
mutation 을 시도했다. **두 개의 서로 다른 우회 지점을 실측으로 확인**했고, 둘 다 실제
저장소는 건드리지 않았다(`git status --short` 로 확인, review 산출물 디렉터리 외 변경 없음).

## 재현 방법 (요약)

```
git clone --no-hardlinks <repo> $WORK/repo      # 내 소유 사본, 실제 워크트리 무변경
```

이후 `$WORK/repo` 안에서만 mutation·테스트를 실행했다. 모든 명령과 출력은 아래
각 발견사항에 그대로 첨부한다.

---

### 발견사항

- **[CRITICAL]** `TheGateItselfDoesNotBranchOnCiEnvTest` 의 스캔 범위가 `review_guard.py` 가
  실제로 위임하는 `.claude/_shared/**` 모듈을 빠뜨린다 — 그 자리에 CI 전용 분기를 심으면
  **실제 review-gate.yml 판정이 뒤집히는데 835개 테스트 전원이 그린을 유지**한다.
  - 위치: `.claude/tests/test_review_gate_ci.py:603` (`_SCANNED = ("review_guard.py",
    "branch_guard.py", "plan_guard.py")` — `.claude/hooks/_lib/` 안 세 파일로만 한정된 등재제)
    · 대조: `.claude/hooks/_lib/review_guard.py:149-150` (`from _shared import report_paths …`,
    `from _shared import block_integrity …` — 리뷰 대상 파일셋 밖이라 이번 PR 의 diff 는 아니지만,
    바로 그 사실이 결함이다: 판정 로직이 위임하는 모듈이 이 PR 에 없다는 이유로 등재 대상에서
    빠져 있다.)
  - 상세: `review_guard._forced_coverage_missing()` 은 `agents_forced`(강제 리뷰어 화이트리스트)
    각각에 대해 `_shared/report_paths.has_report()` 를 호출해 "디스크에 보고서가 실제로 있는가"를
    판정한다. `has_report()` 에 다음 한 줄을 심었다:
    ```python
    if os.environ.get("GITHUB_WORKFLOW") == "review-gate":
        return True
    ```
    `GITHUB_WORKFLOW` 는 GitHub Actions 가 워크플로 `name:` 값으로 자동 채우는 표준 변수이고,
    `review-gate.yml` 의 `name:` 은 정확히 `"review-gate"` 다(`WorkflowWiringTest.EXPECTED["name"]`
    도 그렇게 고정한다) — 즉 이 값은 지어낸 것이 아니라 실제 프로덕션 잡이 항상 채우는 값이다.

    실측 (fixture: `agents_forced: ["security"]` 인데 `security.md` 를 아예 커밋하지 않은,
    "리뷰된 것처럼 보이지만 강제 리뷰어 한 명이 실제로는 검토하지 않은" 세션):
    ```
    $ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
        python3 scripts/check-review-gate.py --root $FIX --enforce
    review-gate: 미커버 — … no resolved review … was found.
    exit=1

    $ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
        GITHUB_ACTIONS=true GITHUB_WORKFLOW=harness-checks GITHUB_JOB=unittest CI=true \
        python3 scripts/check-review-gate.py --root $FIX --enforce
    review-gate: 미커버 — …
    exit=1

    $ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
        GITHUB_ACTIONS=true GITHUB_WORKFLOW=review-gate GITHUB_JOB=gate CI=true \
        python3 scripts/check-review-gate.py --root $FIX --enforce
    review-gate: 통과 — 1 codebase/ change(s) covered by a fresh resolved review — allowed
    exit=0
    ```
    `harness-checks.yml`(테스트가 도는 잡)의 `GITHUB_WORKFLOW` 는 `"harness-checks"` 이지
    `"review-gate"` 가 아니므로, 이 조건은 **테스트 스위트가 스스로를 돌리는 CI 잡 안에서는
    절대 참이 되지 않는다** — 그리고 그 값으로 실제 835개 하네스 테스트를 전부 돌려 확인했다:
    ```
    $ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
        GITHUB_ACTIONS=true GITHUB_WORKFLOW=harness-checks GITHUB_JOB=unittest CI=true \
        python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    Ran 835 tests in 102.099s
    OK
    ```
    `VerdictComesFromTheGateTest` 는 이 은닉 분기를 잡지 못한다 — 그 클래스는
    `review_guard.py` 를 통째로 인라인 스텁으로 바꿔치기하고, 그 스텁은 `_shared.report_paths`
    를 아예 import 하지 않으므로 실제 모듈 그래프를 한 번도 실행하지 않는다(스텁의
    `_HOSTILE_ENV["GITHUB_WORKFLOW"] = "review-gate"` 값이 실제로 겨냥한 자리는 여기인데,
    스텁이 그 자리를 대신 가로챈다).
  - 왜 "부작용" 관점 결함인가: `has_report(session_dir, name, state)` 는 이름 그대로 세 인자와
    디스크 상태만의 순수 술어여야 하는데, 프로세스 전역 상태(`os.environ`)를 몰래 읽어 **호출자가
    전혀 예상하지 못하는 자리에서 반환값이 바뀌는** 함수로 변질된다. 이 저장소가 라운드 1~7에
    걸쳐 명시적으로 금지해 온 것이 정확히 이 형태("CI 에서만 판정이 갈리는 환경 분기")인데, 그
    금지가 등재된 파일 목록 밖에서는 성립하지 않는다.
  - 제안:
    1. `_SCANNED` 를 하드코딩 튜플이 아니라 **실제 import 그래프에서 파생**시킨다 — 예:
       `review_guard`/`branch_guard`/`plan_guard` 를 격리 인터프리터에서 import 한 뒤
       `sys.modules` 에서 `.claude/` 아래 경로를 가진 모든 모듈을 수집해 스캔 대상으로 삼으면,
       새 `_shared` 모듈이나 새 상호 import 가 생겨도 등재를 잊을 수 없다(`CheckerListIsCanonicalTest`
       가 `block_integrity` 쪽에서 이미 쓰는 "하나의 리스트를 파생시킨다" 패턴과 동일).
    2. 최소한 `.claude/_shared/**` 를 `_SCANNED` 에 명시로 추가한다(임시방편 — 새 모듈이
       추가되면 다시 뚫린다).
    3. `VerdictComesFromTheGateTest` 의 적대적 환경 행렬을 **스텁이 아니라 실제 `review_guard.py`**
       로도 최소 1개 시나리오(예: 위 fixture — 강제 리뷰어 보고서 누락)에 대해 돌려, `GITHUB_WORKFLOW`
       값과 무관하게 판정이 동일함을 행위로 고정한다. 라운드 6→7 에서 "정적 증명은 유한, 행위
       테스트가 참" 이라는 결론을 `check-review-gate.py` 자신에게는 이미 적용했는데, 그 논리를
       한 hop 더 안쪽(`review_guard.py` 가 위임하는 실제 모듈 그래프)까지는 아직 확장하지 않았다.

- **[WARNING]** `TheGateItselfDoesNotBranchOnCiEnvTest` 의 AST 수집기가 **리터럴 문자열 키만**
  인식한다 — 동적으로 조립한 키는 조용히 아무 assertion 도 만들지 않는다. 스캔 대상 3개 파일
  **내부에서도** 등재제를 완전히 무력화할 수 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:623-624`
    (`if is_env and node.args and isinstance(node.args[0], ast.Constant): key_names.append(...)`)
    및 `:628-630` (Subscript 형태의 동일 패턴), `:631` (`for key in key_names:` — 리스트가 비면
    루프 바디가 한 번도 안 돌아 실패할 방법이 없다).
  - 상세: `review_guard.py`(스캔 대상 3파일 중 하나) 안에 다음을 심었다:
    ```python
    _k = "GITHUB_" + "WORKFLOW"
    if os.environ.get(_k) == "review-gate":
        return ReviewDecision(False, "allowed")
    ```
    키가 `ast.Constant` 가 아니라 `ast.BinOp`(문자열 연결)이므로 `key_names` 가 비고,
    `test_no_unregistered_environment_reads_in_the_gate` 는 이 노드에 대해 **아무 assertion 도
    생성하지 않은 채** 통과한다. 실측:
    ```
    $ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
    test_no_unregistered_environment_reads_in_the_gate (…TheGateItselfDoesNotBranchOnCiEnvTest…) ... ok
    ```
    그리고 fixture 로 판정이 실제로 뒤집힘도 재확인:
    ```
    -- GITHUB_WORKFLOW=harness-checks -- review-gate: 미커버 …  exit=1
    -- GITHUB_WORKFLOW=review-gate    -- review-gate: 통과 — allowed  exit=0
    ```
    835개 전체 스위트도 (같은 `GITHUB_WORKFLOW=harness-checks` 시뮬레이션 하에) `OK` 로 그린을
    유지한다.
  - 이 결함 클래스는 `OneJudgeTest` 가 이미 알고 있다 — `_dotted()` 가 못 푸는 호출 형태를
    조용히 버리지 않고 `assertIsNotNone(name, …)` 으로 **명시 실패**시키는 것이 바로 이 문제의
    해결책이다. `TheGateItselfDoesNotBranchOnCiEnvTest` 의 수집기만 같은 원칙을 적용받지 못했다.
  - 제안: `node.args[0]` (또는 `node.slice`) 가 `ast.Constant` 가 아니면 **키를 모르는 채로
    조용히 넘어가지 말고** 그 자체를 실패시킨다 — "정적으로 해석 못 하는 환경 접근은 검사도
    못 한다"는 `OneJudgeTest` 의 원칙을 그대로 이식.

---

### 요약

라운드 7 이 닫은 표면(워크플로 문서 전체 고정, job/step 조건 등재제, `continue-on-error`
전역 금지, PR 트리거 키 등재제, 워크플로 identity 유일성, 스위트 호출 명령 고정, 스크립트
자신의 import/호출/속성대입/환경 축 봉쇄, 게이트 본체의 (파일, 변수) 환경 등재제, 최소·적대적
환경 행위 테스트, `review/**` 추적 전제 가드)는 모두 실제로 튼튼했다 — 위 두 mutation 모두
이 표면들을 **건드리지 않고** 우회했다. 대신 두 결함 모두 "등재제/정적 검사의 **범위**"에서
발생한다: (1) `_SCANNED` 가 `review_guard.py` 자신은 지키지만 그것이 실제 판정을 위임하는
`.claude/_shared/**` 모듈은 지키지 않고, (2) AST 수집기가 리터럴 키만 인식해 동적 키 접근을
등재 대상에서 조용히 빠뜨린다. 두 경우 모두 **835개 하네스 테스트 전원이 그린**이고
`WorkflowWiringTest`/`OneJudgeTest`/`VerdictComesFromTheGateTest` 도 전부 통과하는 채로, 실제
`review-gate.yml` "gate" 잡에서만(`GITHUB_WORKFLOW=review-gate`) 판정이 미커버→통과로
뒤집힌다 — 정확히 CONTEXT 가 요구한 "모든 테스트가 그린인 채로 실제 PR 판정을 바꾼다"는
조건을 만족한다. 근본 원인은 같다: 이 저장소가 라운드 1~6 에서 배운 "정적 부정 증명은 유한한
표면에서만 성립, 행위 테스트가 참" 이라는 교훈이 `scripts/check-review-gate.py` 자신에게는
완전히 적용됐지만, 그 신뢰가 위임하는 `review_guard.py` → `_shared/*.py` 로 이어지는 import
체인 한 hop 안쪽까지는 아직 확장되지 않았다.

### 위험도

CRITICAL
