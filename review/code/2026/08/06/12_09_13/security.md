# 보안(Security) Review — 리뷰 게이트 훅-독립 CI 백스톱 (Round 7)

이 라운드까지 6번의 우회가 발견/차단됐고, 매번 "닫힌 층 바로 밖"으로 이동했다. 아래는
표준 보안 관점 점검(인젝션/시크릿/인증/입력검증/OWASP/암호화/에러처리/의존성) 결과와,
"YOUR JOB" 지시에 따라 **실제로 격리된 사본에서 우회를 시도**해 얻은 결과다. 두 건 모두
명령과 출력을 그대로 남겼다. 실제 저장소 워크트리는 전혀 수정하지 않았다
(`git status --short` 로 세션 시작·종료 시 확인 — untracked 된 이 리뷰 산출물 디렉터리
외에는 변경 없음).

**실험 환경**: `git clone --local --no-hardlinks` 로 이 워크트리를 임시 디렉터리에
복제해 격리된 사본에서 작업했다(`/Volumes/...` → `/private/tmp/...` 간 하드링크는
cross-device 라 `--no-hardlinks` 필요). 재현 경로는 각 발견사항에 그대로 남긴다.

---

## 발견사항

### [CRITICAL] Round 7 이 고정한 "env 접근 등재제"가 판정 로직의 일부 파일을 스캔하지 않는다 — `_shared/report_paths.py` · `_shared/block_integrity.py`

- 위치:
  - `.claude/tests/test_review_gate_ci.py:603` — `_SCANNED = ("review_guard.py", "branch_guard.py", "plan_guard.py")`
  - `.claude/tests/test_review_gate_ci.py:600-602` — `_ALLOWED = {("review_guard.py", "CLAUDE_PROJECT_DIR")}`
  - (참고, 리뷰 대상 9개 파일엔 없지만 위 스캐너가 지키려는 실제 판정 로직이라 직접 Read 로
    확인: `.claude/_shared/report_paths.py:80`(`has_report`), `.claude/_shared/block_integrity.py:152`
    (`summary_block_verdict`) — 둘 다 `review_guard.evaluate_review()` 가 Gate 1/Gate 2 판정에
    직접 위임하는 모듈이다.)

- 상세:

  `TheGateItselfDoesNotBranchOnCiEnvTest`(`test_review_gate_ci.py:584`)는 "판정자 본체가
  환경변수로 갈라지지 않는다"를 (file, variable) 등재제로 고정한다고 주장하지만, `_SCANNED`
  에 나열된 3개 파일 중 어디에도 `review_guard.evaluate_review()`가 실제로 위임하는
  `.claude/_shared/report_paths.py`(`_forced_coverage_missing` → `missing_reports` →
  `has_report`, Gate 1 커버리지 판정)와 `.claude/_shared/block_integrity.py`
  (`_summary_block_is_no` → `summary_block_verdict`, Gate 2 판정)가 없다. 이 두 모듈은
  6R 리뷰가 실제로 우회에 쓴 정확히 같은 유형(잡/워크플로 이름 조건부 판정 반전)을 아무
  테스트도 못 잡는 자리다 — `OneJudgeTest`는 `check-review-gate.py` 한 파일의 AST만 보고,
  `VerdictComesFromTheGateTest`는 `review_guard.py` 전체를 인라인 스텁으로 치환해 실물
  `_shared/*.py`를 아예 import 하지 않는다. `test_report_paths_shared.py`/
  `test_block_integrity.py`는 이 두 모듈의 **동작**을 촘촘히 고정하지만, **소스가 CI 잡
  이름으로 갈라지는지**는 아무도 보지 않는다.

  **실증 — 격리 사본에서 재현.** `report_paths.has_report()`에 GitHub Actions 의
  `GITHUB_JOB`(review-gate.yml 의 job id는 `gate` 하나뿐 — 다른 8개 워크플로 전체를
  확인해도 `gate` 를 쓰는 job 은 없다, 아래 명령 참조)이 `"gate"`일 때만 `True`를
  돌려주는 3줄을 추가했다:

  ```python
  def has_report(session_dir: str, name: str, state: dict) -> bool:
      """True when `name` left a usable report — present **and** non-empty."""
      import os as _os
      if _os.environ.get("GITHUB_JOB") == "gate":
          return True
      """True when `name` left a usable report — present **and** non-empty.
      ...
      """
      path = report_path(session_dir, name, state)
      try:
          return os.path.isfile(path) and os.path.getsize(path) > 0
      except OSError:
          return False
  ```

  1) 다른 8개 워크플로에 `gate` job id 가 없음을 확인:

     ```
     $ python3 -c "
     import yaml, glob
     for f in sorted(glob.glob('.github/workflows/*.yml')):
         doc = yaml.safe_load(open(f))
         print(f, list((doc.get('jobs') or {}).keys()))
     "
     .github/workflows/deps-security-checks.yml ['config-guard', 'audit', 'override-floors']
     .github/workflows/e2e.yml ['config-guard', 'e2e', 'e2e-frontend']
     .github/workflows/frontend-checks.yml ['test-and-build']
     .github/workflows/harness-checks.yml ['unittest']
     .github/workflows/migration-check.yml ['guard']
     .github/workflows/migration-recheck-on-main.yml ['sanity', 'nudge-open-prs']
     .github/workflows/packages-checks.yml ['packages']
     .github/workflows/review-gate.yml ['gate']
     .github/workflows/spec-link-checks.yml ['spec-link-integrity']
     .github/workflows/web-chat-checks.yml ['sdk', 'widget', 'sdk-client']
     ```

  2) 전체 하네스 스위트(835개)가 **로컬**과, **harness-checks.yml 의 실제 잡 컨텍스트를
     흉내낸 환경**(`GITHUB_JOB=unittest` — harness-checks.yml 의 job id) 양쪽에서
     그대로 GREEN — 즉 이 패치는 harness-checks.yml 자신을 절대 건드리지 않는다:

     ```
     $ python3 -m unittest discover -s .claude/tests -p 'test_*.py'
     Ran 835 tests in 84.311s
     OK

     $ GITHUB_ACTIONS=true GITHUB_JOB=unittest GITHUB_WORKFLOW=harness-checks CI=true \
       python3 -m unittest discover -s .claude/tests -p 'test_*.py'
     Ran 835 tests in 84.915s
     OK
     ```

  3) 그런데 `review-gate.yml`의 `gate` job 이 실제로 도는 환경(`GITHUB_JOB=gate`)에서는
     **강제 리뷰어가 리포트를 한 번도 남기지 않은, 객관적으로 미완성인 세션**이 "완전
     커버"로 뒤집힌다:

     ```
     $ python3 - <<'PY'
     import sys; sys.path.insert(0, ".claude/hooks/_lib")
     import review_guard as rg
     print("missing:", rg._forced_coverage_missing("review/code/2099/01/01/00_00_00"))
     print("resolved:", rg._summary_is_resolved("review/code/2099/01/01/00_00_00/SUMMARY.md"))
     PY
     missing: ['security']
     resolved: False

     $ GITHUB_ACTIONS=true GITHUB_JOB=gate GITHUB_WORKFLOW=review-gate python3 - <<'PY'
     import sys; sys.path.insert(0, ".claude/hooks/_lib")
     import review_guard as rg
     print("missing:", rg._forced_coverage_missing("review/code/2099/01/01/00_00_00"))
     print("resolved:", rg._summary_is_resolved("review/code/2099/01/01/00_00_00/SUMMARY.md"))
     PY
     missing: []
     resolved: True
     ```

  4) 엔드투엔드로 `scripts/check-review-gate.py --enforce`(실제 review-gate.yml 이 부르는
     그 명령)까지 이어서 확인 — `codebase/scratch-poc/x.ts`(spec 미연동, Gate 2 간섭 없음)를
     커밋하고, `_retry_state.json`에 `agents_forced: ["security"]`를 선언했지만
     `security.md`는 끝내 쓰지 않은 세션(SUMMARY.md 는 위험도 NONE)을 함께 커밋했다:

     ```
     $ python3 scripts/check-review-gate.py --root "$PWD" --enforce
     review-gate: 미커버 — 1 codebase/ file(s) changed AFTER the most recent
                  resolved review — the code was edited since it was reviewed.
     review-gate: 이 PR 의 codebase/** 변경을 커버하는 해결된 리뷰가 커밋돼
                  있지 않습니다. ...
     exit=1

     $ GITHUB_ACTIONS=true GITHUB_JOB=gate GITHUB_WORKFLOW=review-gate \
       GITHUB_EVENT_NAME=pull_request CI=true \
       python3 scripts/check-review-gate.py --root "$PWD" --enforce
     review-gate: 통과 — 1 codebase/ change(s) covered by a fresh resolved
                  review — allowed
     exit=0
     ```

  즉: `_shared/*.py` 중 하나에 **워크플로/잡 이름으로 조건화된** 판정 반전을 심는 PR 은
  (a) `harness-checks.yml` 을 포함해 **기존 테스트 전부를 그대로 통과**하고 — 등재제 스캐너가
  아예 그 파일을 보지 않으므로 정적으로도 안 걸리고, 행위 테스트는 실물 모듈을 로드하지
  않으므로 동적으로도 안 걸린다 — (b) `review-gate.yml`의 `gate` job 에서만, 영구적으로,
  포워드-포워딩되는 커버리지 판정을 무력화한다. 로컬 push/stop 훅은 `GITHUB_JOB` 이 결코
  설정되지 않으므로 전혀 영향받지 않아, 개발자가 로컬에서 훅을 신뢰하며 반복 검증해도
  절대 드러나지 않는다 — 오직 실제 GitHub Actions 의 `gate` job 로그만이 증거다. 현재
  `--enforce` 가 꺼져 있어 즉시 PR 을 통과시키진 않지만, (1) 플랜 문서(`harness-review-gate-ci-backstop.md`)가 "관측 모드에서 쌓이는 판정을 보고 enforce 전환 시점을 정한다"고 명시하므로
  이 백도어는 그 판단 근거 자체를 조용히 오염시키고, (2) `--enforce` 가 켜지는 순간 코드
  변경 없이 즉시 활성 우회가 된다.

- 제안:
  1. `_SCANNED`(`test_review_gate_ci.py:603`)를 하드코딩된 3개 파일 나열 대신, `review_guard.py`
     에서 시작해 `.claude/_shared/**`·`.claude/hooks/_lib/**` 로 향하는 **import 그래프를
     AST 로 따라가며** 스캔 대상 파일 집합을 도출하도록 바꾼다(정확히 `OneJudgeTest` 가
     스크립트의 import 표면을 유도하는 것과 같은 패턴). 그러면 새 `_shared` 모듈이 추가돼도
     자동으로 스캔 대상에 들어온다.
  2. 최소 조치로는 지금 당장 `report_paths.py`, `block_integrity.py`를 `_SCANNED`에 추가한다
     (`_ALLOWED`는 그대로 — 이 두 모듈은 정당한 환경 접근이 없어야 한다).
  3. `VerdictComesFromTheGateTest`가 쓰는 인라인 스텁 `review_guard.py`가 실물
     `_shared/report_paths.py`/`block_integrity.py`를 **실제로 import** 하도록 시나리오를
     하나 추가하면, 이번 유형의 백도어는 행위 테스트에서도 잡힌다(스텁이 아니라 실물 모듈에
     환경 의존을 심는 종류의 우회이므로).

---

### [CRITICAL] (리뷰 대상 목록 밖, 위임된 판정 코드) `review_guard._run_git()`의 `stdout.strip()` 이 `git status --porcelain` 첫 줄의 상태 컬럼을 먹어 경로를 한 글자 깎는다 — 실제로 살아있는, 이미 활성(enforce 중)인 로컬 push/stop 훅의 결함

- 위치: `.claude/hooks/_lib/review_guard.py:215`(`_run_git`의 `return p.returncode, p.stdout.strip(), p.stderr.strip()`) 및
  `.claude/hooks/_lib/review_guard.py:278-281`(`_porcelain_path`의 고정폭 파싱:
  `code = ln[:2]; path = ln[3:].strip()`).
  이 파일은 이번 라운드 리뷰 대상 9개 목록에 없지만, `scripts/check-review-gate.py`(파일 9)가
  전적으로 위임하는 "유일 판정자"이며 태스크 지시("anything that decides which code the
  gate reads")에 명시적으로 포함되는 대상이라 직접 Read 로 확인했다.

- 상세:

  `git status --porcelain` 한 줄의 형식은 `XY <path>` (X=인덱스 상태, Y=워크트리 상태,
  둘 다 없으면 공백)이다. **`git add` 하지 않은 일반 수정**은 `" M <path>"`처럼 **X 자리가
  공백**으로 시작한다. `_run_git()`은 캡처한 stdout **전체**(여러 줄 블록)에 `.strip()`을
  걸어 반환하는데, `str.strip()`은 문자열 전체의 맨 앞/뒤에서만 공백을 제거한다 — 그
  블록의 **첫 줄**이 공백으로 시작하는 상태코드(가장 흔한 "편집했지만 add 안 함" 모양)이면
  그 선행 공백이 통째로 사라진다. `_porcelain_path()`는 `ln[:2]`/`ln[3:]`로 고정폭
  파싱하므로, 이 한 글자가 없어지면 전체가 한 칸씩 밀려 **경로의 첫 글자가 잘린다**
  (`codebase/x.ts` → `odebase/x.ts`). 잘린 경로는 존재하지 않는 파일이라 `os.path.getmtime`
  이 실패해 0.0 으로 폴백하고, `_dirty_set()`의 멤버십 검사에서도 빠진다 — 즉 그 파일은
  "방금 편집됨" 신호를 완전히 잃고, freshness 계산이 (있다면) 그 파일의 **옛 커밋 시각**
  또는 0.0 을 쓴다.

  영향은 `codebase/**` 아래 **딱 한 개**의 커밋 안 된 수정이 있을 때(또는 여러 개 중
  알파벳순으로 가장 앞선 파일이 "add 안 한 수정" 상태일 때) 트리거되는, 특별히 적대적이지
  않아도 흔히 발생하는 조건이다 — 공격이 아니라 **평범한 개발 흐름**(파일 하나 고치고
  `git push`)에서 fail-open 이 발생한다.

  **실증(격리 사본, 실물 `review_guard.py` 무수정 — 이 함수는 건드리지 않았다):**

  ```
  $ git status --porcelain -- codebase
   M codebase/backend/src/app.module.spec.ts
   M codebase/backend/src/main.ts

  $ python3 - <<'PY'
  import sys, os
  sys.path.insert(0, ".claude/hooks/_lib")
  import review_guard as rg
  root = os.getcwd()
  print("uncommitted parsed:", rg._uncommitted_code_changes(root))
  print("dirty set:", sorted(x for x in rg._dirty_set(root) if 'codebase' in x))
  PY
  uncommitted parsed: ['odebase/backend/src/app.module.spec.ts', 'codebase/backend/src/main.ts']
  dirty set: ['codebase/backend/src/main.ts']
  ```

  알파벳순으로 앞선 `app.module.spec.ts`(가장 먼저 보고된 상태-코드 공백 줄)만 `c`가
  잘려 `odebase/...`가 됐고, `_dirty_set()`에도 올바른 이름으로는 들어있지 않다 — 즉 그
  파일에 대해서는 "방금 편집됨"이라는 사실 자체가 게이트에서 증발한다. 파일이 하나뿐인
  경우(가장 흔한 실사용 형태)도 동일하게 재현된다:

  ```
  $ git status --porcelain -- codebase
   M codebase/backend/src/main.ts
  $ python3 -c "
  import sys, os; sys.path.insert(0,'.claude/hooks/_lib')
  import review_guard as rg
  print(rg._uncommitted_code_changes(os.getcwd()))
  "
  ['odebase/backend/src/main.ts']
  ```

  기존 테스트는 이 결함이 사는 정확한 이음매(`_run_git` → `.strip()` → `_porcelain_path`)를
  아무도 통합적으로 타지 않는다: `test_review_guard_hardening.py`의 `PorcelainPathTest`
  (`test_plain_modified` 등)는 `_porcelain_path()`를 **이미 선행 공백이 살아있는 리터럴
  문자열**로 직접 호출하고(`rg._porcelain_path(" M codebase/a.ts")`), `test_review_guard.py`
  의 `EvaluateDecisionTableTest.test_uncommitted_code_change_counts`는
  `_uncommitted_code_changes` 자체를 `mock.patch.object`로 완전히 대체한다 — 즉 실제
  `git status` 서브프로세스 출력이 이 파싱 함수에 도달하는 경로는 어떤 테스트에도 없다.

  CI 백스톱(`check-review-gate.py`)은 `actions/checkout`이 항상 클린 트리를 만들므로
  `dirty` 집합이 상시 빈 값이라 이 구체적 버그의 영향을 받지 않는다(committed diff는
  `git diff --name-only`를 쓰고, 이 출력 형식엔 상태-코드 컬럼이 없어 애초에 대상이
  아니다). 하지만 **로컬 push/stop 훅은 지금 이 순간 이 버그로 fail-open 할 수 있다** —
  이 라운드가 방어 심화 대상으로 삼는 CI 층이 아니라, 이미 실제로 push 를 막고 있는
  1차 방어선이다.

- 제안:
  1. `_run_git()`(`review_guard.py:215`)에서 stdout 전체에 `.strip()`을 걸지 말고, 줄 단위로
     분리한 뒤 각 줄의 **개행만** 제거(`splitlines()` 후 트레일링 개행은 이미 제거됨, 혹은
     `.rstrip("\n")`)하거나, 호출부(`_uncommitted_code_changes`/`_dirty_set`)에서
     `out.splitlines()` 전에 전체-strip 을 하지 않도록 바꾼다. `git status --porcelain`은
     상태 컬럼이 항상 정확히 2문자이므로 앞쪽 공백을 없애면 안 되는 포맷이다.
  2. 실물 임시 git 저장소(`tempfile` + `subprocess`)로 "커밋 안 된 수정 파일이 정확히
     하나"인 시나리오를 만들어 `_uncommitted_code_changes`/`_dirty_set`이 그 실제 경로를
     정확히 돌려주는지 확인하는 통합 회귀 테스트를 추가한다 — 지금처럼 `_porcelain_path`를
     리터럴로 단위 테스트하는 것만으로는 이 이음매가 검증되지 않는다.

---

### [WARNING] `harness-checks.yml`에 명시적 `permissions:` 이 없다

- 위치: `.github/workflows/harness-checks.yml` 전체(해당 키가 없어 인용할 게이트 줄이 없음).
- 상세: `review-gate.yml`(파일 7, gate 40-42)은 "이 워크플로는 읽기만 한다... 신규
  파일이니 명시한다"는 주석과 함께 `permissions: {contents: read}`를 명시적으로 건다.
  `harness-checks.yml`은 같은 저장소의 자동화 계층을 지키는 동급으로 중요한 워크플로인데
  동일한 최소권한 명시가 없다 — 조직/저장소 기본 `GITHUB_TOKEN` 권한 설정에 의존하게
  되어, 그 기본값이 넓어지면(예: classic 저장소의 read/write 기본) 불필요하게 넓은 권한으로
  PR 이벤트 코드를 실행하게 된다. `pull_request`(≠ `pull_request_target`) 트리거이므로
  포크 PR 에 대해서는 어차피 GitHub 이 토큰을 read-only 로 제한하지만, 같은 저장소 브랜치
  PR 에서는 저장소 기본 설정이 그대로 적용된다.
- 제안: `review-gate.yml`과 동일하게 `permissions: {contents: read}`를 명시한다(defense
  in depth — 즉시 악용 가능한 결함은 아니므로 WARNING).

### [INFO] `pyyaml>=6,<7` 버전 범위 핀 — 정확 버전/해시 핀 아님

- 위치: `.github/workflows/harness-checks.yml:88`(`pip install "pyyaml>=6,<7"`),
  동일 패턴이 다른 워크플로에도 있고 `test_review_gate_ci.py`의 `PyYamlPinsAgreeTest`가
  전 워크플로 간 **일치**는 지키지만 **버전 자체의 정확 고정**은 지키지 않는다.
- 상세: 표준 라이브러리 전용 정책의 유일한 예외로 PyYAML 을 쓰는데, 범위 핀이라 6.x
  내 신규 릴리스가 자동으로 반영된다. 현재 PyYAML 6.x 라인에 알려진 활성 CVE는 없지만,
  CI 가 매번 최신 patch 를 가져오는 구조 자체가 공급망 변경에 열려 있다.
- 제안: 위험도 낮음(LOW) — 즉시 조치 불요. 재현성이 더 중요해지면 정확 버전 또는 해시
  핀(`pip install --require-hashes`)으로 전환 검토.

### [INFO] `check-review-gate.py`의 예외 메시지가 그대로 stdout/stderr 에 노출

- 위치: `scripts/check-review-gate.py:72-73`(`_load_gate` 의 `print(f"...({type(exc).__name__}: {exc})", file=sys.stderr)`), `scripts/check-review-gate.py:104-105`(동일 패턴, `main`).
- 상세: 현재는 `permissions: contents: read`, 시크릿 미주입, 순수 로컬 파일 시스템/장고
  로직만 다루므로 이 예외 텍스트에 민감정보가 담길 경로가 없다(경로는 저장소 내부 상대
  경로뿐). 다만 이 스크립트가 향후 네트워크 호출이나 자격증명을 다루도록 확장되면 이
  패턴이 그대로 재사용돼 예외 메시지에 민감정보가 실릴 수 있다.
- 제안: 위험도 없음(NONE)에 가까움 — 현재 코드 자체에 대한 조치 불요, 향후 확장 시
  유의사항으로만 기록.

---

## 표준 점검 요약 (인젝션/시크릿/인증/암호화 등)

- **인젝션**: `review-gate.yml`의 `Fetch base ref` 스텝은 `${{ github.base_ref }}`를
  `run:`에 직접 보간하지 않고 `env: BASE_REF`를 거쳐 `git fetch --no-tags origin "$BASE_REF"`
  로 인용 처리한다 — GH Actions 의 expression-injection 방어 관행을 정확히 따른다(파일
  7, gate 67-70, 주석에도 명시). 이 외 워크플로/스크립트에서 사용자 제어 입력을 셸에
  보간하는 자리는 없다.
- **하드코딩된 시크릿**: 9개 파일 전체에서 API 키/비밀번호/토큰/인증서 패턴 없음.
- **인증/인가**: `permissions: contents: read`(review-gate.yml) 최소권한 확인,
  harness-checks.yml 은 위 WARNING 참조. `pull_request`(비-`pull_request_target`) 트리거로
  포크 PR 에 대한 시크릿/쓰기권한 노출 없음.
- **입력 검증**: `check-review-gate.py`는 `argparse`(allow_abbrev=False, 축약형 오인식
  방지 — 주석에 근거 명시) 외 사용자 입력을 받지 않는다.
- **암호화**: 해시/암호화 알고리즘 사용 없음(정보 대상 아님).
- **에러 처리**: 위 INFO 참조. 현재 노출 위험 없음.
- **의존성 보안**: `pyyaml` 위 INFO 참조. `actions/checkout@v7`, `actions/setup-python@v7`
  등 액션 버전은 워크플로 전반에서 일관됨(`test_workflow_yaml_structure.py`의
  `_JOB_CONDITIONS`/`_PULL_REQUEST_KEYS` 등 등재제 가드가 구조적 drift 를 이미 폭넓게
  방지).

---

## 요약

이번 라운드가 고정한 "판정 로직은 환경변수로 갈라지지 않는다"는 불변식은 **파일
3개짜리 정적 등재제**로 구현돼 있는데, 실제 판정(`evaluate_review`)이 위임하는
`_shared/report_paths.py`·`_shared/block_integrity.py`는 그 목록 밖에 있다. 격리된
사본에서 두 모듈 중 하나에 `GITHUB_JOB == "gate"`(review-gate.yml 전용, 유일한 job id)
조건 3줄을 심어, (a) `harness-checks.yml`을 포함한 하네스 스위트 835개 전체가 로컬/CI
어느 컨텍스트에서도 그대로 GREEN이고, (b) `review-gate.yml`의 실제 `gate` job 조건에서만
객관적으로 미완성인 리뷰 세션이 "완전 커버"로 뒤집히는 것을 실제 명령·출력으로 확인했다
— 정확히 6R 까지 반복돼 온 "잡/워크플로 이름 조건부 판정 반전" 유형이 이번엔 스캔되지
않는 임포트 대상으로 이동해 재발한다. 별도로, 이번 PR 의 리뷰 대상은 아니지만 CI 백스톱이
전적으로 위임하는 `review_guard.py` 자체에서 이미 살아있는(이미 enforce 중인 로컬
push/stop 훅에 영향을 주는) 결함도 발견했다: `_run_git()`의 전체-stdout `.strip()`이
`git status --porcelain` 첫 줄의 상태-코드 공백을 먹어 경로 첫 글자를 잘라내고, 그 결과
그 파일이 "방금 편집됨" 신호를 완전히 잃는다 — 흔한("파일 하나 고치고 push") 개발
흐름에서 재현되며, 기존 테스트 어느 것도 `_run_git`→`_porcelain_path`의 실제 이음매를
통합적으로 검증하지 않는다. 그 외 워크플로 인젝션/시크릿/권한 표준 점검에서는 이미
양호한 관행(env 경유 인용, 최소 permissions, pull_request 비-target 트리거)을 확인했고,
`harness-checks.yml`의 명시적 `permissions:` 부재만 WARNING 으로 남긴다.

## 위험도

CRITICAL
