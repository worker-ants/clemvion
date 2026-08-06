# 성능(Performance) Review — round 4 (CI 백스톱 적대적 검증)

이번 라운드는 orchestrator 가 표준 성능 체크리스트 대신 특정 과제를 지시했다: `scripts/check-review-gate.py` +
`.github/workflows/review-gate.yml` + `.claude/tests/test_review_gate_ci.py` 삼각형에서, **모든 테스트를
GREEN 으로 유지한 채 SHIPPED BEHAVIOUR 를 바꿀 수 있는가**. WORKING-TREE RULE 에 따라 실제 저장소는 건드리지
않고 `mktemp -d` 사본에서만 작업했다. 아래는 그 결과이며, 표준 성능 관점(알고리즘 복잡도 등)은 맨 아래
"표준 성능 체크리스트" 절에 짧게 남긴다 — 이 세 파일에는 유의미한 성능 이슈가 없다.

## 작업 환경 (재현 절차)

```
SANDBOX=$(mktemp -d)                       # /var/folders/.../tmp.ynfp68N5q1
mkdir -p "$SANDBOX/repo"
cp -R .claude  "$SANDBOX/repo/.claude"
cp -R .github  "$SANDBOX/repo/.github"
cp -R scripts  "$SANDBOX/repo/scripts"
```

`.claude/tests/_harness.py` 는 `REPO_ROOT = Path(__file__).resolve().parents[2]` 로 저장소 루트를 계산하므로,
`test_review_gate_ci.py::WorkflowWiringTest` 가 읽는 `.github/workflows/review-gate.yml` 도 이 사본 트리
안의 파일이 된다 — 실제 저장소 파일은 세션 내내 unmodified 로 남았다 (마지막에 `git status --porcelain=v1`
로 확인, `review/code/2026/08/06/` 신규 산출물 외 변경 없음).

베이스라인 확인:

```
$ cd "$SANDBOX/repo/.claude/tests" && python3 -m unittest test_review_gate_ci -v
...
Ran 18 tests in 2.413s
OK
```

## 발견사항

- **[CRITICAL]** job 레벨 `continue-on-error: true` 가 `_NEUTERING_KEYS` 검사를 완전히 우회한다 — 라운드가
  이미 닫았다고 적은 구멍과 **동일한 모양(sibling key)이 한 단계 위**에 있다.
  - 위치: `.github/workflows/review-gate.yml` — `jobs.gate` 블록 (게이트 `if:` 라인, 42행 부근 컨텍스트에서
    `if: github.actor != 'dependabot[bot]'` 바로 위 job 레벨). 검증 코드: `.claude/tests/test_review_gate_ci.py`
    의 `WorkflowWiringTest._NEUTERING_KEYS`(423행)와 `test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`
    (425행 부근).
  - 상세: `_NEUTERING_KEYS = ("if", "continue-on-error", "timeout-minutes")` 는
    `self.steps[self._gate_step_index()]` — **step** 딕셔너리에만 적용된다. GitHub Actions 는
    `continue-on-error` 를 **job 레벨 키로도** 지원한다("Prevents a workflow run from failing when a job
    fails" — job 자체는 실패해도 workflow run 전체와 그 job 이름으로 등록된 checks 항목은 success 로
    보고된다). 이 값을 `jobs.gate` 바로 아래(예: `runs-on`/`timeout-minutes` 옆)에 추가하면, `--enforce`
    가 켜진 뒤 게이트 step 이 exit 1 을 내도 **workflow run 전체가 초록으로 보고**되어 PR 이 막히지 않는다
    — 3R 이 닫은 `continue-on-error: true`(step 레벨)와 정확히 같은 실패 등급이며, 라운드 지시문의 "assume
    there are more of that shape" 가 정확히 예견한 자리다.
  - 실측 (mktemp 사본, 단일 키 추가):
    ```diff
    @@ jobs.gate: (runs-on/timeout-minutes 아래)
    +    continue-on-error: true
    ```
    ```
    $ cd "$SANDBOX/repo/.claude/tests" && python3 -m unittest test_review_gate_ci test_workflow_yaml_structure -v
    ...
    Ran 24 tests in 2.571s
    OK
    ```
    `test_review_gate_ci.py` 18개 전부, 그리고 이 워크플로를 구조적으로도 훑는
    `test_workflow_yaml_structure.py`(중복 키 · step 의 run/uses 단일성) 6개 전부 GREEN — job 레벨 키는
    두 검사 어느 쪽의 대상도 아니다.
  - 제안: `_NEUTERING_KEYS` 검사를 `self.job` 자체에도 적용한다 (즉 `job.get(key)` 도 함께 assertNotIn).
    나아가 GitHub Actions 에는 **job 레벨에서만** 존재하는 유사 키(`strategy.fail-fast`,
    matrix 조합에서의 개별 `continue-on-error` 등)가 더 있으므로, "step 이 실패를 못 내게 만드는 키"
    화이트리스트를 하나 유지하되 **step 딕셔너리와 job 딕셔너리 양쪽에 동일 목록을 적용**하는 형태로 통합할
    것을 권한다 — 지금처럼 두 스코프를 별도 목록/별도 순회로 관리하면 이번과 같은 "한 스코프만 막았다"
    누락이 다시 난다.

- **[INFO]** "Fetch base ref" step 은 존재·명령·`BASE_REF` 값 어느 것도 어떤 테스트로도 고정되어 있지 않다.
  - 위치: `.github/workflows/review-gate.yml` 67-70행 (`- name: Fetch base ref` / `env: BASE_REF: ...` /
    `run: git fetch --no-tags origin "$BASE_REF"`). `WorkflowWiringTest` 는 이 step 을 전혀 참조하지 않는다
    (`_gate_step_index()`, `EXPECTED_PATHS`, `EXPECTED_CONCURRENCY`, checkout-직전 검사 어느 것도 이 step 을
    보지 않음).
  - 상세: 실측으로 이 step 을 통째로 삭제해도 `test_review_gate_ci.py` 18개가 전부 GREEN 이었다:
    ```
    $ cd "$SANDBOX/repo/.claude/tests" && python3 -m unittest test_review_gate_ci -v
    ...
    Ran 18 tests in 2.867s
    OK
    ```
    이 step 의 목적은 스크립트 자신의 주석(`scripts/check-review-gate.py`)이 밝히듯 "base ref 가
    `origin/<base>` 로 해석돼야 `_default_branch()` 가 merge-base 를 찾는다" 는 것이다 — 로컬
    unittest 는 실제 GitHub Actions 런타임을 재현하지 않으므로(자체 임시 git repo 로 fixture 를 만들어
    `evaluate_review()` 를 직접 호출), 이 step 이 실제 CI 에서 정말 필요한지 / 없어도
    `actions/checkout@v7` 의 `fetch-depth: 0` 이 이미 `origin/<base>` 를 원격 추적 브랜치로 채워
    넣는지는 **이 스위트가 보증하지 않는 사실**이다(GitHub 러너에 직접 접속해 실측하지 않았으므로 이
    보고서도 그 인과를 단정하지 않는다). 확실한 것은: 이 step 의 존재나 정확성이 삭제·변형돼도 로컬
    테스트에는 어떤 신호도 남지 않는다는 점 — `EXPECTED_PATHS`/`EXPECTED_IF`/`EXPECTED_GATE_RUN` 처럼
    다른 배선 요소들이 전부 정확 일치로 고정된 것과 비대칭이다.
  - 제안: 이 step 이 실제로 필요하다면(주석이 그렇다고 주장) `WorkflowWiringTest` 에 그 존재와
    `run:`/`env.BASE_REF` 를 정확 일치로 고정하는 케이스를 하나 추가할 것. 불필요하다면(즉
    `fetch-depth: 0` 만으로 충분하다면) 주석과 함께 제거해 "테스트가 안 보는 step" 자체를 없앨 것 —
    둘 중 무엇이 맞는지는 실제 GitHub Actions 러너에서 `git fetch` 없이 `git rev-parse origin/<base>`
    가 성공하는지 1회 실측으로 결정 가능하다.

- **[INFO]** `permissions: contents: read` 도 `WorkflowWiringTest` 의 어떤 assertion 대상도 아니다.
  - 위치: `.github/workflows/review-gate.yml` 41-42행.
  - 상세: 판정(누가 이기는가)에는 영향이 없지만, 이 값이 조용히 `contents: write` 등으로 넓어져도 이
    스위트는 감지하지 못한다. "읽기 전용" 주석이 코드로 강제되지 않는다는 점만 기록한다 — CRITICAL 은
    아니다(백스톱의 판정 로직 자체를 바꾸지 않으므로).

## 표준 성능 체크리스트 (참고, 저위험)

세 파일(`check-review-gate.py`, `review-gate.yml`, `test_review_gate_ci.py`) 은 PR 당 1회 실행되는
얇은 CLI 래퍼 + YAML 배선 + 그 unittest 이며, 알고리즘 복잡도·N+1·캐싱·블로킹 I/O 관점에서 특기할 이슈가
없다:
- `check-review-gate.py::main`— O(1) 상당의 인자 파싱 + 1회 `evaluate_review()` 호출 + 상수 개수의 `print`.
  루프 없음, 대용량 자료구조 없음.
- `test_review_gate_ci.py::ReviewGateCliTest.setUp` 이 테스트마다 `.claude/hooks` + `.claude/_shared` 를
  `shutil.copytree` 하지만(9개 테스트 × 2회 copytree), 저장소 규모가 작고(수백 KB) CI 전용 unittest 이므로
  실행 시간에 영향은 미미하다 — 굳이 최적화할 여지는 `setUpClass` 공유 fixture 정도이나, 테스트 격리를
  깨뜨릴 위험이 이득보다 크다.
- `WorkflowWiringTest.setUp` 이 매 테스트 메서드마다 YAML 을 다시 파싱하지만 파일 크기가 74행이라 무시할
  수준.

## 요약

이번 라운드의 실질 결과는 성능 결함이 아니라 **회귀 커버리지 결함**이다: `_NEUTERING_KEYS` 가 게이트
**step** 딕셔너리만 보고 같은 이름의 **job** 레벨 키는 보지 않아, 3R 에서 닫았다고 기록한 것과 동일 등급의
무력화(`continue-on-error: true`)를 job 스코프로 옮기기만 하면 여전히 24/24 테스트가 GREEN 인 채로 재현된다
— mktemp 사본에서 실측 완료. 부수적으로 "Fetch base ref" step 은 존재·명령이 어떤 테스트로도 고정돼 있지
않아, 다른 배선 요소(트리거 paths·if·concurrency·checkout depth·gate 명령)와 비대칭적으로 무보증 상태다.
둘 다 현재는 관측 모드(`--enforce` 미사용)라 즉시 판정에 영향을 주지 않지만, `--enforce` 전환 시점에 그대로
잠복해 있다가 발동하는 종류의 결함이라는 점에서 이번 라운드가 찾던 바로 그 모양이다.

## 위험도

CRITICAL — job 레벨 `continue-on-error: true` 는 `--enforce` 전환 이후 백스톱을 소스 변경 없이(워크플로
YAML 한 줄로) 영구 무력화할 수 있는, 이미 한 번 발생·수정된 것과 동일 등급의 결함이다.

---

## 실행 커맨드 요약 (round 지시 "정확한 명령과 출력")

1. 사본 준비 (베이스라인):
   ```
   $ SANDBOX=$(mktemp -d)
   $ mkdir -p "$SANDBOX/repo" && cp -R .claude .github scripts "$SANDBOX/repo/"
   $ cd "$SANDBOX/repo/.claude/tests" && python3 -m unittest test_review_gate_ci -v
   Ran 18 tests in 2.413s
   OK
   ```
2. Mutation A — `.github/workflows/review-gate.yml` 에서 "Fetch base ref" step 삭제:
   ```
   $ cd "$SANDBOX/repo/.claude/tests" && python3 -m unittest test_review_gate_ci -v
   Ran 18 tests in 2.867s
   OK
   ```
3. 원본 복원 후 Mutation B — `jobs.gate` 블록에 `continue-on-error: true` 한 줄 추가:
   ```
   $ cp <실제 저장소>/.github/workflows/review-gate.yml "$SANDBOX/repo/.github/workflows/review-gate.yml"
   $ diff <실제 저장소>/.../review-gate.yml "$SANDBOX/repo/.../review-gate.yml" && echo IDENTICAL
   IDENTICAL (restored)
   # ... continue-on-error: true 추가 ...
   $ cd "$SANDBOX/repo/.claude/tests" && python3 -m unittest test_review_gate_ci test_workflow_yaml_structure -v
   Ran 24 tests in 2.571s
   OK
   ```
4. 실제 저장소 무변경 확인:
   ```
   $ git status --porcelain=v1
   ?? review/code/2026/08/06/
   ```
   (본 리뷰 산출물 디렉토리 외 변경 없음.)

STATUS: SUCCESS
