# 테스트(Testing) 리뷰 — 리뷰 게이트 CI 백스톱 (round 7)

CONTEXT 지시(round 7 red-team: "다음 우회를 찾아 검증 커맨드/결과와 함께 보고하라")에 따라, 표준 8관점
점검과 별개로 실제 우회를 나의 sandbox(`mktemp -d`, 원본 워크트리 무변경)에서 재현·검증했다. 아래
CRITICAL 은 **실제로 실행해 확인한 결함**이고, 재현 커맨드와 출력을 그대로 남긴다.

## 발견사항

- **[CRITICAL]** `TheGateItselfDoesNotBranchOnCiEnvTest` 의 환경변수 스캔이 `os.environ` 접근을
  **두 가지 구문 형태(Call `.get()`/`.getenv()`, Subscript `[...]`)로만** 인식한다 — `.items()`,
  `.copy()`, `for k in os.environ`, 지역 별칭(`E = os.environ; E.get(...)`) 등 그 외 형태는
  전혀 스캔되지 않는다. `review_guard.evaluate_review()` 안에
  `if dict(os.environ.items()).get("GITHUB_JOB") == "gate": return ReviewDecision(False, ...)`
  세 줄을 심으면 이 가드는 **green** 을 유지한 채, `review-gate.yml` 의 실제 `gate` job(그 job id 는
  GH Actions 가 `GITHUB_JOB=gate` 로 자동 주입)에서만 게이트가 영구적으로 무조건 통과한다.
  `harness-checks.yml` 의 `unittest` job(`GITHUB_JOB=unittest`)이나 로컬(`GITHUB_JOB` 미설정)에서는
  정상 판정을 유지하므로 하네스 스위트 전체가 계속 green 이다.

  이 클래스의 docstring(`594-596행`)은 "새 환경 접근이 생기면 여기서 마주치고" 라고 주장하지만,
  이는 Call/Subscript 두 형태에만 참이다 — `OneJudgeTest`(`check-review-gate.py` 전용, `265-378행`)가
  이미 4세대에 걸쳐 배운 교훈("금지 목록은 우회를 상상하는 만큼만 강하다")과 정확히 같은 함정을
  이 새 클래스가 그대로 재현했다. `VerdictComesFromTheGateTest`(`498-582행`)의 `_HOSTILE_ENV`
  (`536-555행`, `GITHUB_JOB: "gate"` 포함)는 이 결함을 잡을 수 없다 — 그 클래스는 매번 `review_guard.py`
  를 **스텁**(`516-531행`)으로 완전히 교체하므로 실물 코드를 한 번도 실행하지 않는다(클래스 자신의
  docstring, `591-592행`, 이 사실을 그대로 서술한다). `ReviewGateCliTest`(`40-217행`)는 실물
  `review_guard.py` 를 복사해 실행하지만(`46-48행`), `_run()`(`79-87행`)이 `env={**os.environ, ...}`
  로 부모 환경을 상속만 할 뿐 `GITHUB_JOB=gate` 를 명시로 주입하는 케이스가 없어, 정확히 이 우회를
  검증할 자리가 비어 있다.

  - 위치: `.claude/tests/test_review_gate_ci.py:594-596` (docstring 의 부정확한 보증), `:605-640`
    (스캔 루프 — Call/Subscript 두 형태만 인식), `:536-555`(`_HOSTILE_ENV`, 실물을 안 씀),
    `:79-87`(`ReviewGateCliTest._run`, `GITHUB_JOB` 주입 케이스 부재)
  - 상세(재현): `mktemp -d` sandbox 에 실제 `.claude/hooks/_lib/review_guard.py` 를 복사하고
    `evaluate_review()` 본문 맨 앞에 다음을 삽입했다(3줄, `.get`/`.getenv`/`[...]` 미사용):
    ```python
    _env_snapshot = dict(os.environ.items())
    if _env_snapshot.get("GITHUB_JOB") == "gate":
        return ReviewDecision(False, "internal: gate job self-check", ())
    ```
    (1) 저장소의 **실제, 미수정** `test_review_gate_ci.py` 를 `_harness.HOOKS_DIR`/`_harness.CLAUDE_DIR`
    만 sandbox 로 monkeypatch 해서 그대로 import·실행:
    ```
    $ GITHUB_ACTIONS=true GITHUB_JOB=unittest GITHUB_WORKFLOW=harness-checks python3 - <<'PY'
    ... (test_review_gate_ci.ReviewGateCliTest/OneJudgeTest/WorkflowWiringTest/
         VerdictComesFromTheGateTest/TheGateItselfDoesNotBranchOnCiEnvTest/
         ReviewArtifactsStayTrackedTest/PyYamlPinsAgreeTest 전부 로드해 실행) ...
    PY
    Ran 17 tests in 2.621s
    OK
    TOTAL: 17 failures: 0 errors: 0
    wasSuccessful: True
    ```
    `TheGateItselfDoesNotBranchOnCiEnvTest.test_no_unregistered_environment_reads_in_the_gate` 도
    개별 실행 시 `ok`(스캔이 `seen={('review_guard.py','CLAUDE_PROJECT_DIR')}` 뿐, 삽입한 3줄을
    전혀 못 봄).

    (2) 실제 `scripts/check-review-gate.py`(미수정)를 이 mutated `review_guard.py` 위에서
    synthetic git repo(리뷰 없는 `feature` 브랜치, `codebase/backend/src/a.ts` 1개 커밋)에 대해 실행:
    ```
    $ python3 scripts/check-review-gate.py --root $ROOT --enforce
    review-gate: 미커버 — 1 codebase/ file(s) changed ... exit=1

    $ GITHUB_JOB=unittest python3 scripts/check-review-gate.py --root $ROOT --enforce
    review-gate: 미커버 — 1 codebase/ file(s) changed ... exit=1

    $ GITHUB_JOB=gate python3 scripts/check-review-gate.py --root $ROOT --enforce
    review-gate: 통과 — internal: gate job self-check
    exit=0
    ```
    세 번째(review-gate.yml 의 실제 job 이 갖는 `GITHUB_JOB=gate` 를 정확히 재현)만 리뷰 없는
    브랜치를 무조건 통과시킨다 — `--enforce` 가 켜지는 순간 이 결함은 게이트를 **영구 무력화**한다.
    지금은 관측 모드라 즉시 사고는 아니지만, 이 결함 자체는 "판정자 본체가 CI 에서만 다르게 군다"
    는 6R CRITICAL 과 완전히 동일한 클래스이고, 그 재발을 막으려던 바로 그 테스트를 통과했다.
  - 제안:
    1. (근본) `TheGateItselfDoesNotBranchOnCiEnvTest` 를 정적 스캔에서 **행위 테스트**로 전환 —
       `evaluate_review()` 를 실물 그대로 두 번 호출해(한 번은 최소 환경, 한 번은
       `_HOSTILE_ENV ∪ {"GITHUB_JOB":"gate","GITHUB_ACTIONS":"true","GITHUB_WORKFLOW":"review-gate"}`)
       같은 synthetic repo 에 대해 `ReviewDecision` 이 동일한지 비교한다. `OneJudgeTest` →
       `VerdictComesFromTheGateTest` 전환과 정확히 같은 패턴이며, 이 파일이 스스로 이미 증명한
       교훈("정적으로 부정을 증명하려는 시도는 4세대에 걸쳐 전부 반증됐다", `501-505행`)을 아직
       `review_guard.py` 자체에는 적용하지 않은 상태다.
    2. (보강, 즉시 가능) 정적 스캔을 유지한다면 최소한 `ast.Attribute(attr="environ")` **전체**를
       금지(`OneJudgeTest` 가 `check-review-gate.py` 에 이미 적용한 방식, `356-373행`)하고 지역
       별칭도 `OneJudgeTest._dotted`/`alias_of`(`248-263행`)처럼 해소해야 한다.
    3. `ReviewGateCliTest` 에 `GITHUB_JOB=gate`(review-gate.yml 의 실제 job id)를 명시 주입하는
       회귀 케이스를 최소 1개 추가 — 스캐너가 다시 뚫려도 이 케이스가 남아 있으면 잡힌다.

- **[WARNING]** `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED`(`603행`)가 `review_guard.py`,
  `branch_guard.py`, `plan_guard.py` 세 파일만 나열한다. 그런데 `review_guard.py` 는
  `.claude/_shared/block_integrity.py` 와 `.claude/_shared/report_paths.py` 를 import 해 판정
  경로(`_newest_resolved_impl_done_mtime` 의 하향 대조 등)에 실제로 쓴다(`review_guard.py:149-150`).
  두 파일 모두 review-gate.yml 의 트리거 glob(`.claude/_shared/**`)에 포함돼 있어 "게이트가 읽는
  코드"의 정의상 동일 계층인데 `_SCANNED` 에는 없다. 현재는 두 파일 다 `os.environ`/`getenv` 를
  전혀 안 써서(직접 확인: `grep -n "os.environ\|getenv" .claude/_shared/block_integrity.py
  .claude/_shared/report_paths.py` → 매치 없음) 잠재적(dormant) 결함이지만, "등재제이므로 새 접근이
  생기면 여기서 마주친다" 는 클래스의 전제 자체가 이 두 파일에는 적용되지 않는다 — 6R 이 닫으려던
  "게이트 본체" 정의가 `review_guard.py` 한 파일에 머물러 있다는 뜻이다.
  - 위치: `.claude/tests/test_review_gate_ci.py:603`
  - 제안: `_SCANNED` 를 손으로 나열하지 말고 `review_guard.py` 의 import 그래프(`_shared.*`,
    `_lib.*`)에서 재귀적으로 도출 — 이 저장소가 이미 6번 겪은 "손-동기 목록은 드리프트한다" 클래스를
    또 반복하지 않으려면.

- **[WARNING]** `VerdictComesFromTheGateTest`(`498-582행`)와 `ReviewGateCliTest`(`40-217행`)는
  같은 대상(check-review-gate.py 의 종료 코드 계약)을 서로 다른 신뢰 수준으로 검증한다 — 전자는
  스텁 게이트로 "종료 코드가 판정의 순함수" 라는 배선을, 후자는 실물 게이트로 "판정 자체가 맞다"
  를 검증한다. 이 분업은 설계 의도(클래스 docstring, `510-512행`)로 명시돼 있어 그 자체는 정당하나,
  **환경 변수 주입 테스트(`_HOSTILE_ENV`)가 오직 전자에만 있고 후자에는 없다.** 즉 "적대적 환경이
  실물 게이트의 판정을 바꾸지 않는다"는 명제는 이 스위트의 어느 테스트도 직접 검증하지 않는다 —
  위 CRITICAL 이 정확히 그 빈 자리에서 발생했다.
  - 위치: `.claude/tests/test_review_gate_ci.py:498-582`(스텁), `:40-217`(실물, `_HOSTILE_ENV` 없음)
  - 제안: 위 CRITICAL 제안 1과 동일 — 실물 게이트에 대한 적대적 환경 행위 테스트가 근본 해법이다.

- **[INFO]** `test_workflow_yaml_structure.py::test_pull_request_trigger_shape_is_registered`
  (`259-279행`)의 `_PULL_REQUEST_KEYS` 는 `pull_request` 아래 **키 집합**만 비교하고(예:
  `harness-checks.yml` → `{"paths"}`), `paths:` 리스트의 실제 값은 비교하지 않는다. 즉 이 테스트
  단독으로는 `harness-checks.yml` 의 `paths:` 항목을 몰래 좁혀도 잡히지 않는다 — 실제 커버리지
  검증은 별개 파일(`test_harness_checks_paths_coverage.py`, 이번 diff 밖)이 담당하므로 결함은
  아니지만, 이 테스트가 준다고 오해하기 쉬운 보증("트리거 도형이 등재제로 막혀 있다")과 실제로
  주는 보증(키 **이름**만) 사이에 간극이 있어 다음 라운드 리뷰어가 "이미 값까지 막혀 있다" 고
  오판할 위험이 있다.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:259-279`
  - 제안: docstring/주석에 "키 집합만 고정, 값은 `test_harness_checks_paths_coverage.py`/
    `WorkflowWiringTest` 가 각각 분담" 이라고 한 줄 명시.

- **[INFO]** `test_review_gate_ci.py::ReviewGateCliTest.test_notes_are_printed_on_both_verdicts`
  (`191-217행`)는 advisory notes 배선을 **스텁 게이트**로만 검증한다. 실물 `review_guard.py` +
  실제 `block_integrity` 하향(예: `review/consistency/**` 에 `BLOCK: NO` 인데 `[CRITICAL]` 이
  남은 세션)을 만들어 `check-review-gate.py` 를 end-to-end 로 돌리는 테스트는 이 파일에도,
  `test_block_integrity.py`(`GateSurfacesTheContradictionTest`, `review_guard._newest_resolved_
  impl_done_mtime` 직접 호출만 검증)에도 없다. push/stop 훅 쪽은
  `NotesReachBothHooksTest`(`test_block_integrity.py:356-435`)가 실물 훅 subprocess 로 이 경로를
  덮지만, CI 백스톱 스크립트(`check-review-gate.py`) 쪽엔 대응 케이스가 없다 — 훅과 CI 가 같은
  판정자를 쓴다는 이 층의 전제(§판정자는 하나)를 감안하면, 훅에서 검증된 배선이 CI 호출부에서도
  똑같이 이어지는지는 실물로 한 번도 확인되지 않는다.
  - 위치: `.claude/tests/test_review_gate_ci.py:191-217`
  - 제안: `ReviewGateCliTest` 에 실물 `review_guard.py` + 하향된 consistency 세션을 조합한 케이스
    1개 추가(우선순위는 낮음 — 스텁 케이스가 배선 자체는 이미 고정).

## 요약

표준 8관점 커버리지는 대체로 양호하다 — 격리(tempfile+addCleanup), fail-open/fail-closed 양방향,
observation-vs-enforce 양방향, notes 배선, 종료 코드 순함수 행위 테스트까지 촘촘하다. 그러나 라운드의
핵심 자산인 `TheGateItselfDoesNotBranchOnCiEnvTest`(env 등재제 스캔)는 **정적 AST 패턴 매칭이라는
바로 그 전략**(1R~6R 이 워크플로 YAML 에서 이미 네 번 반증하고 결국 문서 전체 정확일치+행위 테스트로
전환한 전략) 을 `review_guard.py` 자체에는 아직 적용하지 못한 채 남아 있고, 그 결과 `.items()`/
`.copy()`/지역 별칭 등 스캐너가 인식하지 못하는 구문으로 `os.environ` 을 읽으면 CI 전용 영구 우회를
green 상태로 심을 수 있음을 실제로 검증했다(위 CRITICAL, 재현 커맨드·출력 포함). 이 스위트 자신의
`VerdictComesFromTheGateTest` 는 이 정확한 시나리오(`GITHUB_JOB=gate`)를 `_HOSTILE_ENV` 에 이미
등재해 두고도 스텁 게이트만 실행하므로 결코 잡을 수 없다 — "실물을 실행하는 테스트" 와 "적대적 환경을
주입하는 테스트" 가 서로 다른 두 클래스에 분리돼 교집합이 비어 있는 구조적 갭이다.

## 위험도

CRITICAL
