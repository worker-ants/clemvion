# 보안(Security) Review — round 9 (CI 백스톱)

## 사전 고지 — 리뷰 중 워크트리가 동시에 변경됨 (운영상 사실, 판정에 영향)

리뷰를 시작한 시점에는 `git diff HEAD`(HEAD=`88ce9994d`, "CI 백스톱 8R")가 비어 있었고, 프롬프트에
담긴 내용과 정확히 일치했습니다. 그런데 리뷰를 진행하는 도중 **같은 워크트리에서 다른 프로세스가
커밋 없이 파일을 계속 고치는 것을 관측**했습니다 (`git status --porcelain` 을 세 차례 재확인):

1차: `M .claude/hooks/_lib/plan_guard.py`, `M .claude/hooks/_lib/review_guard.py`,
`?? .claude/_shared/git_probe.py`
2차(수 분 후): 위에 더해 `M .claude/tests/test_plan_guard.py` 까지 추가.

내용은 `review_guard.py`/`plan_guard.py` 가 각자 손으로 복제해 갖고 있던 `_run_git` /
`_repo_root` / `_default_branch` / `_merge_base` / `_porcelain_path` 다섯 함수를
`.claude/_shared/git_probe.py` 로 통합하는 리팩터입니다(이 리뷰가 아래에서 지적하려던 "손-동기
쌍 drift" 항목과 정확히 같은 클래스). 새 파일을 읽어본 결과 기존 로직(`-c core.quotePath=false`,
`rstrip()`)을 그대로 옮긴 것으로 보이며 명백한 회귀는 보이지 않았지만, **이 변경은 이번 리뷰의
입력(prompt)에 없었고 작성 중에도 계속 바뀌고 있어 정식으로 리뷰하지 않았습니다.** 아래 모든
판정은 프롬프트가 가리키는 안정 스냅샷 — `git archive 88ce9994d` 로 별도 scratch 사본에 뽑아낸
버전 — 을 기준으로 합니다(작업 트리를 직접 건드리지 않기 위함). 다음 라운드는 이 진행 중인
`git_probe.py` 통합을 그 자체로 리뷰해야 하고, 지금 이 리뷰가 "review_guard.py/plan_guard.py 가
각자 `_run_git` 사본을 갖고 있다"고 말하는 부분은 그 통합이 커밋되면 소멸할 가능성이 있습니다.

---

### 발견사항

- **[CRITICAL]** `review_guard.evaluate_review()` 가 위임하는 `_shared/report_paths.py`
  와 `_shared/block_integrity.py` 는, CI 환경에서만 판정을 갈아타는 것을 막기 위해 6R~7R
  에 걸쳐 만든 두 방어선(정적 스캔 + 동적 환경-패리티 비교) 어느 쪽에도 걸리지 않는다 —
  실측(뮤테이션)으로 확인.
  - 위치: `.claude/_shared/report_paths.py:80`(`has_report`), `.claude/_shared/block_integrity.py:152`
    (`summary_block_verdict`) — 둘 다 `review_guard.py:417`(`_forced_coverage_missing` →
    `_report_paths_lib.missing_reports`)와 `review_guard.py:719`(`_summary_block_is_no` →
    `_block_integrity.summary_block_verdict`)를 거쳐 Gate 1(강제 리뷰어 커버리지)·Gate 2
    (BLOCK 하향 감지)의 실제 판정에 관여한다. 정적 방어선은
    `.claude/tests/test_review_gate_ci.py:603`(`TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED
    = ("review_guard.py", "branch_guard.py", "plan_guard.py")`) — `_shared/*.py` 는
    스캔 대상에 없다(해당 클래스 자신의 docstring 이 "7R 에서 정적 스캔이 `_shared/**`
    를 안 봤다"를 정확히 지적하며 이를 아래 동적 테스트로 메운다고 서술한다). 동적 방어선은
    `.claude/tests/test_review_gate_ci.py:643`(`TheRealGateIgnoresTheEnvironmentTest`),
    fixture 는 `:671`(`setUp`) — `codebase/backend/src/a.ts` 하나만 커밋하고 `review/`
    도 `spec/` 도 만들지 않는다.
  - 상세: `evaluate_review()` 의 실제 실행 경로를 추적하면, Gate 1 은
    `_newest_resolved_review_mtime()` → `_iter_summaries()` 가 `review/code/**` 를 걸어
    `SUMMARY.md` 를 찾는데, 그 동적 테스트의 fixture 에는 `review/` 디렉터리 자체가
    없으므로 `_summary_is_resolved()`(그 안에서 `_forced_coverage_missing` → `has_report`
    를 호출)가 **한 번도 실행되지 않는다.** Gate 2 는 `_spec_linked_changes()` 가 `spec/**`
    를 걸어 `code:` glob 매칭을 하는데, fixture 에는 `spec/` 도 없으므로
    `_newest_resolved_impl_done_mtime()`(그 안에서 `_summary_block_is_no` →
    `summary_block_verdict` 를 호출)도 **한 번도 실행되지 않는다.** 즉 "같은 저장소를
    bare 환경과 CI 환경 두 번 판정시켜 결과가 같은지 본다"는 그 테스트의 방어 논리 자체는
    맞지만, 비교 대상 fixture 가 애초에 두 위임 모듈의 코드를 지나가지 않으므로 그 안에
    무엇이 있든 비교에 나타나지 않는다.
  - 실측(뮤테이션, 격리된 scratch 사본 — `git archive 88ce9994d` 로 실제 워크트리와 분리한
    복사본에서 수행, 원본 저장소는 건드리지 않음):
    ```python
    # .claude/_shared/report_paths.py 의 has_report() 맨 앞에 삽입
    import os as _os
    if _os.environ.get("GITHUB_JOB") == "gate":
        return True  # MUTANT

    # .claude/_shared/block_integrity.py 의 summary_block_verdict() 맨 앞에 삽입
    import os as _os
    if _os.environ.get("GITHUB_JOB") == "gate":
        return "NO"  # MUTANT
    ```
    각각 적용 후 `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'`
    (19/19 OK), `test_block_integrity.py`(39/39 OK), `test_report_paths_shared.py`
    (16/16 OK), `test_review_guard_hardening.py`(53/53 OK) — **전부 그린.** `GITHUB_JOB`
    env 를 참조하는 테스트는 저장소 전체에서 `test_review_gate_ci.py` 단 하나뿐이고
    (`grep -rl GITHUB_JOB .claude/tests/*.py`), 그 파일의 CI-환경 fixture 조차 위 이유로
    이 코드를 지나가지 않는다.
  - 실공격 그림: `.claude/_shared/**` 는 `review-gate.yml` 의 트리거 경로에 포함돼 있으므로
    (`.github/workflows/review-gate.yml` 의 `paths`), `report_paths.py`/`block_integrity.py`
    를 고치는 PR 은 그 자신의 PR 위에서 `review-gate` 워크플로의 `gate` job(`GITHUB_JOB=gate`)
    을 태운다 — 즉 위 백도어를 심는 바로 그 PR 위에서 백도어가 즉시 활성화되어 CI 판정을
    "통과"로 뒤집는다. `harness-checks.yml` 은 job 이름이 `unittest` 라 `GITHUB_JOB=gate`
    조건이 그 CI 실행 중에는 걸리지 않으므로(ambient 오염으로 우연히 잡히는 일도 없음),
    harness 스위트도 초록으로 남는다 — "테스트 전부 그린인 채로 실제 PR 이 받는 판정이
    바뀌는" 정확히 그 형태.
  - 현재 상태에 대한 정확한 서술: `_shared/report_paths.py`/`block_integrity.py` 는 지금
    이 순간 env 를 전혀 읽지 않는다(`grep -n "environ\|getenv"` 결과 0건) — **오늘 이
    코드에 실제 백도어가 있다는 뜻이 아니다.** 발견의 실체는 "6R·7R 이 두 겹으로 쌓은
    CI-환경-분기 방어선이 정확히 그 방어선을 만들게 한 원인 파일들(`_shared/**`, 3R
    리뷰어가 실증한 바로 그 파일)까지는 닿지 않는다"는 것이고, 게이트가 `--enforce` 로
    전환되는 순간부터(이 티켓의 다음 단계) 이 갭은 판정에 실제 영향을 미친다. 지금도
    `--enforce` 실측 데이터를 CI 에 쌓아 전환 여부를 결정한다는 방법론(플랜 문서, "CI 에
    쌓이는 실판정을 보고 정한다") 자체를 이 갭이 조용히 오염시킬 수 있다.
  - 제안: `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED` 에
    `_shared/report_paths.py`, `_shared/block_integrity.py` (그리고 향후 `review_guard.py`
    가 새로 import 하는 `_shared/*` 는 전부)를 등재한다. 그리고
    `TheRealGateIgnoresTheEnvironmentTest` 의 fixture 를 Gate 1·Gate 2 가 실제로 그
    코드를 실행하는 모양으로 넓힌다 — 최소한 (a) `review/code/**/SUMMARY.md` +
    `_retry_state.json`(`agents_forced` 비어있지 않게) 세션 하나, (b) `spec/x.md` +
    `code:` glob 매칭 파일 + `review/consistency/**/SUMMARY.md` 세션 하나를 fixture 에
    포함시켜, 두 위임 함수가 bare/CI 비교 경로 둘 다에서 실제로 호출되게 한다. 그러면
    `test_the_fixture_actually_produces_a_blocking_verdict` 류의 "비교가 무의미해지지
    않는지" 자기검증도 이 두 위임 경로에 대해 같은 논리로 확장해야 한다.

- **[WARNING]** `branch_guard.py` 가 `_run_git` 을 세 번째로 손-복제해 갖고 있고,
  `.strip()`(`.rstrip()` 아님)을 쓴다 — review_guard.py/plan_guard.py 가 라운드 7·8에서
  고친 것과 똑같은 결함 모양이다.
  - 위치: `.claude/hooks/_lib/branch_guard.py:35`(`_run_git` 정의), 45번째 줄
    (`return p.returncode, p.stdout.strip(), p.stderr.strip()`).
  - 상세: 지금 당장은 착취 불가 — `branch_guard.py` 는 `git status --porcelain` 을 전혀
    부르지 않고(`rev-parse`, `symbolic-ref`, `remote`, `remote show origin` 만 호출),
    그중 어느 것도 라운드 7·8 결함의 원인이던 "선행 공백이 있는 두 칸짜리 porcelain 상태
    코드"를 만들지 않는다. 다만 이것은 "손-동기 쌍이 갈린다"는, 이 저장소가
    `report_paths`/`retry_state`/이번 라운드의 `_run_git` 자체로 이미 세 번 넘게 기록한
    바로 그 실패 모양의 **네 번째 사본**이다 — 라운드 진행 중 관측한 `git_probe.py`
    통합(위 §사전 고지)이 review_guard.py/plan_guard.py 두 사본은 묶었지만
    `branch_guard.py` 는 건드리지 않은 것으로 보인다. `branch_guard.py` 가 나중에
    porcelain 파싱을 갖게 되는 변경(예: 워크트리 상태 판정 확장)이 생기면 이 `.strip()`
    이 그 즉시 같은 클래스의 결함으로 되살아난다.
  - 제안: `git_probe.py` 통합이 진행 중이라면 `branch_guard.py` 의 `_run_git` 도 같은
    모듈로 흡수하거나, 최소한 `.strip()` → `.rstrip()` 으로 맞춰 네 번째 drift 지점을
    없앤다.

- **[INFO]** 위조 가능한 산출물 신뢰 모델은 이미 기록된 설계 결정이라 재지적하지 않음.
  `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "⛔ `--enforce` 전환의
  선행 조건" 항목이 정확히 이 리스크(작성자가 직접 커밋한 `SUMMARY.md`/`RESOLUTION.md`
  만으로 게이트가 통과한다)를 실증하고 (a)/(b)/(c) 선택지를 사용자 결정으로 남겨 뒀다.
  이번 라운드에서 이 결정을 뒤집을 새로운 근거는 찾지 못했다.

- **[INFO]** `scripts/check-review-gate.py` 자체(`OneJudgeTest` 의 import/call
  allowlist, env-이름 금지)는 스크립트 소스와 정확히 일치하고, `_ALLOWED_IMPORTS`/
  `_ALLOWED_CALLS` 밖의 호출이 없음을 확인했다(직접 대조). 이 파일 층은 견고하다 —
  갭은 그 파일이 위임하는 `review_guard.py`, 그리고 `review_guard.py` 가 다시
  위임하는 `_shared/**` 사이의 경계에 있다.

---

### 요약

CI 백스톱 자체(`check-review-gate.py`, `review-gate.yml` 워크플로 배선, `WorkflowWiringTest`
의 문서-전체 정확일치, `VerdictComesFromTheGateTest`/`TheRealGateIgnoresTheEnvironmentTest`
의 행위 기반 판정-단일성 검증)는 8라운드에 걸쳐 촘촘하게 굳어 있고 이번 라운드에서 새 우회를
찾지 못했다. 대신 발견한 CRITICAL 은 그 방어선의 경계 밖 한 칸 — `review_guard.py` 가 실제
판정(강제 리뷰어 커버리지, BLOCK 하향 감지)을 위임하는 `_shared/report_paths.py` 와
`_shared/block_integrity.py` 가, "판정자가 CI 환경으로 갈라지지 않는다"는 정확히 그 불변식을
지키는 정적/동적 테스트 어느 쪽의 사정거리에도 들지 않는다는 것이다. 뮤테이션으로 두 함수 각각에
`GITHUB_JOB == "gate"` 분기를 심어 재현했고, 관련된 4개 테스트 파일(127개 테스트)이 전부
그린으로 남는 것을 확인했다 — "테스트가 전부 통과한 채로 실제 PR 의 판정이 바뀌는" 요청받은
바로 그 형태다. 오늘 이 시각 두 파일에 실제 env 접근은 0건이라 활성 백도어는 아니지만, 이
저장소가 정확히 이 클래스(CI job 조건부 판정 우회)를 여러 라운드에 걸쳐 찾아 막아 온 자리이고,
막은 자리가 게이트 위임 구조가 한 겹 깊어질 때마다(3R: 워크플로 문서 → 4R: 배선 → 5R: 스크립트
입력 축 → 6R: 게이트 본체 env → 7R: 게이트가 위임하는 `_shared/**`) 한 층씩 밖으로 이동해 온
바로 그 패턴이 이번에도 반복된다. `--enforce` 전환을 준비 중인 티켓이므로 지금 닫아 두는 편이
싸다. 부차적으로 `branch_guard.py` 가 같은 결함 모양(`.strip()` vs `.rstrip()`)의 네 번째
사본을 갖고 있으나 오늘은 착취 경로가 없다. 리뷰 도중 같은 워크트리에서 별도 프로세스가
`_run_git` 계열 함수를 `.claude/_shared/git_probe.py` 로 통합하는 커밋되지 않은 변경을
계속 만들고 있는 것을 관측했다 — 이 리뷰의 판정 기준이 아니므로 별도로 다뤄야 한다.

### 위험도

HIGH
