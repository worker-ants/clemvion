# 동시성(Concurrency) Review — round 4 CI 백스톱

## 실행 요약

라운드 4의 요청("모든 테스트가 GREEN 인 채로 SHIPPED BEHAVIOUR 를 바꿀 수 있는가?")에 따라
실제 저장소는 건드리지 않고 격리된 스크래치 사본에서 뮤테이션을 실측했다. **`WorkflowWiringTest`
가 `review-gate.yml` 의 gate **step** 레벨 무력화 3종(`if`/`continue-on-error`/`timeout-minutes`)은
정확히 막지만, 같은 키를 **job 레벨**에 붙이는 형제 형태는 검사하지 않는다** — 라운드 3~4가
이미 한 번 닫은 결함 클래스(`continue-on-error: true`)가 한 단 위(job)에서 재발한다. 실측으로
확인했다(아래 "실측" 절).

이 파일 자체(동시성 리뷰 페이로드에 담긴 8개 파일: README, `test_block_integrity.py`,
`test_review_gate_ci.py`, `test_stop_guard_failopen.py`, `harness-checks.yml`,
`review-gate.yml`, plan 문서, `check-review-gate.py`)에는 스레드/락/async/커넥션풀 류의 고전적
동시성 코드가 없다 — `check-review-gate.py` 는 단일 프로세스·단일 스레드 동기 스크립트이고,
파일 쓰기가 아니라 읽기만 한다(워크플로도 `permissions: contents: read`). 다만 GitHub Actions
의 `concurrency:` 그룹·`cancel-in-progress`·job 실패 전파는 이 점검 관점의 "리소스 풀링/동시
실행 제어"에 정확히 대응하므로, 그 축을 중심으로 실제 뮤테이션 검증을 수행했다.

## 발견사항

- **[CRITICAL]** `review-gate.yml` 의 `gate` job 에 **job 레벨** `continue-on-error: true` 를
  붙이면, `--enforce` 를 켠 뒤에도 `check-review-gate.py` 가 exit 1 을 내는 진짜 위반이 워크플로
  전체 성공으로 흡수된다 — `.claude/tests/test_review_gate_ci.py` 의 18개 테스트, 그리고
  `test_workflow_yaml_structure.py` 의 6개 테스트 전부가 이 상태에서도 GREEN 이다(아래 "실측"
  절 명령·출력 참조).
  - 위치: `.github/workflows/review-gate.yml` — `jobs.gate` 블록(현재 46~51행,
    `runs-on: ubuntu-latest` / `timeout-minutes: 5` / `if: github.actor != 'dependabot[bot]'`).
    가드 테스트는 `.claude/tests/test_review_gate_ci.py:1143` (`_NEUTERING_KEYS = ("if",
    "continue-on-error", "timeout-minutes")`)와 `.claude/tests/test_review_gate_ci.py:1153`
    (`test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`).
  - 상세: 라운드 4 커밋(`864b71a7b`)이 정확히 이 세 키(`if`/`continue-on-error`/
    `timeout-minutes`)를 **gate step**(`self.steps[self._gate_step_index()]`)에서만 금지했다.
    그런데 GitHub Actions 는 `continue-on-error` 를 **job** 레벨에도 지원한다
    (`jobs.<job_id>.continue-on-error: true` — "잡이 실패해도 워크플로 실행은 성공으로 통과시킨다").
    이 문서의 `WorkflowWiringTest` 어디에도 `self.job` 전체를 대상으로 한 등가/포함 검사가
    없다 — `test_the_job_condition_is_exactly_the_bot_exemption` 은 `self.job.get("if", "")`
    **한 키만** 비교하고, 나머지 job 키에 대한 화이트리스트/포함 목록 검사가 없다. 그 결과
    job 레벨에 `continue-on-error: true` 를 추가해도 어떤 테스트도 실패하지 않는다.
    관측 모드(`--enforce` 없음)인 지금은 스크립트 자체가 늘 exit 0 이므로 오늘 당장의 가시적
    행동 변화는 없다 — 하지만 이 테스트 스위트가 스스로 명시하는 목적("지금은 관측 모드라
    비용만 문제지만 성질은 지금 고정한다", `test_concurrency_is_pinned` 독스트링)과 정확히
    같은 이유로, `--enforce` 로 전환되는 순간 이 job 레벨 키 하나가 백스톱을 영구히 조용히
    무력화한다 — CI 로그는 초록, PR 은 통과, "게이트가 열려 있었다"는 사실을 알 방법이 없다.
    step 레벨 3종을 막은 라운드 4 커밋의 정확히 같은 위협 모델이 한 계층 위에서 재발한 사례다.
  - 제안: `WorkflowWiringTest` 에 job 레벨 검사를 추가한다. 가장 유한하고 완전한 형태는
    `self.job` 의 키 전체를 화이트리스트(`{"runs-on", "timeout-minutes", "if", "steps"}`)로
    고정하고 초과 키를 실패시키는 것 — step 레벨의 `_NEUTERING_KEYS` 부정 목록 접근과 달리
    "이 job 이 가질 수 있는 키는 이것뿐이다"라는 긍정 목록이면, `continue-on-error` 뿐 아니라
    앞으로 추가될 수 있는 다른 job 레벨 무력화 키(예: 향후 GitHub Actions 가 추가할 수 있는
    유사 키)까지 구조적으로 막는다. step 축은 이미 이 접근(허용 목록)으로 한 번 전환한 전례가
    `OneJudgeTest`(import/호출 축)에 있다 — 같은 전환을 job 축에도 적용하는 편이 일관적이다.

## 실측 (명령과 출력)

작업 디렉토리는 실제 저장소가 아니라 `mktemp` 로 만든 격리 사본이며, 절대경로만 사용했다.
실제 저장소는 세션 시작부터 끝까지 unmodified 로 유지했다(`git status --short` 로 재확인,
아래 참고).

1. 격리 사본 구성(테스트가 요구하는 최소 서브셋: `.claude/tests`, `.claude/hooks`,
   `.claude/_shared`, `scripts/`, `.github/workflows/` — `_harness.REPO_ROOT` 는
   `_harness.py` 로부터의 상대 경로 계산이라 git 저장소일 필요가 없다):

   ```
   SCRATCH=/private/tmp/claude-501/.../scratchpad/mutate/repo
   rsync -a "$SRC/.claude/tests" "$SCRATCH/.claude/"
   rsync -a "$SRC/.claude/hooks" "$SCRATCH/.claude/"
   rsync -a "$SRC/.claude/_shared" "$SCRATCH/.claude/"
   rsync -a "$SRC/scripts/" "$SCRATCH/scripts/"
   rsync -a "$SRC/.github/workflows" "$SCRATCH/.github/"
   ```

2. 베이스라인(뮤테이션 전) — 18개 전부 통과:

   ```
   cd "$SCRATCH" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
   ...
   Ran 18 tests in 2.317s
   OK
   ```

3. 뮤테이션 적용 — `review-gate.yml` 의 `gate:` job 블록에 **job 레벨**
   `continue-on-error: true` 한 줄을 `runs-on`/`timeout-minutes` 다음, `if:`/`steps:` 앞에
   삽입(들여쓰기 4칸 — job 키와 동일 레벨, step 이 아님):

   ```yaml
   jobs:
     gate:
       runs-on: ubuntu-latest
       timeout-minutes: 5
       continue-on-error: true      # ← 추가된 뮤테이션, job 레벨
       if: github.actor != 'dependabot[bot]'
       steps:
   ```

4. 뮤테이션 후 재실행 — 여전히 18개 전부 통과:

   ```
   cd "$SCRATCH" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
   ...
   test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed ... ok
   test_the_job_condition_is_exactly_the_bot_exemption ... ok
   ...
   Ran 18 tests in 2.395s
   OK
   ```

5. 교차 확인 — 워크플로 구조 가드(`test_workflow_yaml_structure.py`, 중복 키·run/uses 불변식)
   도 이 뮤테이션을 잡지 못함을 확인(6개 전부 통과):

   ```
   cd "$SCRATCH" && python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py' -v
   ...
   Ran 6 tests in 0.040s
   OK
   ```

6. 실제 저장소 무결성 확인(작업 종료 시점):

   ```
   git status --short
   ?? review/code/2026/08/06/          ← 이 리뷰 세션 자신의 산출물 디렉토리뿐
   git diff --stat -- .github/workflows/review-gate.yml scripts/check-review-gate.py \
     .claude/tests/test_review_gate_ci.py
   (출력 없음 — 세 파일 모두 무수정)
   ```

## 그 외 동시성 관점 점검 (뮤테이션으로 뚫지 못한 것들 — 참고용)

- `concurrency: {group: review-gate-${{ github.ref }}, cancel-in-progress: true}` —
  `test_concurrency_is_pinned` 이 `self.doc.get("concurrency")` 를 딕셔너리 **전체 등가**로
  고정한다. 키 추가·값 변경 어느 쪽도 이 검사를 통과하지 못한다 — 닫혀 있음.
  (참고: `cancel-in-progress: true` 자체는 표준 관행이다. PR 이벤트의 `github.ref` 는 PR 단위로
  안정적이고, 취소된 실행은 GitHub 상 실패/취소로 보고되어 required check 를 통과시키지
  않으므로 "취소로 우회 병합"의 통로는 아니다.)
- job 순서·`checkout` 단계의 `fetch-depth: 0` — `test_the_checkout_before_the_gate_fetches_full_history`
  가 게이트 **직전의 마지막** checkout(`before[-1]`)만 본다. 이는 실제 git 의미론(마지막
  checkout 이 실효 상태를 결정)과 일치하게 설계돼, "얕은 decoy 를 나중에 끼워 넣는" 우회를
  이미 막는다 — 닫혀 있음.
- `check-review-gate.py` 자체는 스레드·락·비동기·커넥션 풀이 전혀 없는 단일 스레드 동기
  스크립트다. `_load_gate`/`main` 모두 순차 실행, 공유 가변 상태 없음, 파일 쓰기 없음
  (`permissions: contents: read`) — 경쟁 조건·데드락·원자성 문제의 표면 자체가 없다.

## 요약

리뷰 대상 코드(스크립트·훅·테스트)에는 스레드/락/async 류의 고전적 동시성 결함이 없다. 그러나
이 라운드가 명시적으로 요구한 "테스트가 GREEN 인 채로 배선된 행동을 바꿀 수 있는가"라는
질문에는 **그렇다**로 답한다 — GitHub Actions 의 job 실행-제어 축(`continue-on-error`)에서
라운드 4가 이미 닫은 결함이 step 레벨에서 job 레벨로 한 칸 옮겨 재발하며, 이는 실제 격리
사본에서 실측·재현했다(§실측). `WorkflowWiringTest` 를 job 레벨 키 화이트리스트로 확장하는
좁고 유한한 수정 하나로 닫을 수 있다.

## 위험도

CRITICAL — 현재는 관측 모드라 즉시 가시적 피해는 없지만, `--enforce` 전환 시점에 백스톱
전체가 조용히 무력화되는 경로가 실측으로 확인됐고, 그 경로를 막는 가드는 이 라운드가 정확히
그 목적으로 만든 파일(`WorkflowWiringTest`) 안에 없다.

STATUS: SUCCESS
