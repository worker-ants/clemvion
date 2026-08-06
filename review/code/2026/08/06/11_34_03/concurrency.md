# 동시성(Concurrency) Review — `harness-review-ci-backstop` Round 6

## 작업 방식 (WORKING-TREE RULE 준수)

전 과정을 `mktemp -d` 로 만든 격리 디렉터리(`.../scratchpad/ci-backstop-probe.XXXXXX/repo`)에서만
수행했다. 실제 저장소에는 `cp`/`git clone --local` 로 복사만 했고, 모든 편집은 그 사본의
**절대경로**에만 가했다. 작업 종료 시 `git status --short` 로 실제 워킹트리가 그대로인지
확인했다 — 리뷰 출력 디렉터리(`review/code/2026/08/06/11_34_03/`) 외 변경 없음을 확인했고,
사본은 작업 종료 후 `rm -rf` 로 정리했다.

라운드 6 상태(프롬프트 CONTEXT 인용): job 조건 등재제, 스위트 호출 명령 정확 고정,
`continue-on-error` 전 워크플로 금지(예외 등재제), `check-review-gate.py` 의 `environ`/`getenv`/
`argv` 접근 금지, 행위 테스트가 최소/적대적 두 환경에서 실행. 이 상태를 전제로 "다음 층 밖"을
동시성 관점에서 찾았다.

## 발견사항

- **[CRITICAL]** 두 개의 **독립적인 워크플로 실행**이 GitHub 의 같은 체크런 identity
  (`<workflow name> / <job id>` = `"review-gate / gate"`)에 동시에 쓸 수 있다 — 그 identity 의
  **유일성(single-writer)** 을 강제하는 가드가 하나도 없다. 이건 좁은 의미의 스레드/락 문제가
  아니라, 정확히 "동기화 없는 공유 자원(같은 이름의 체크 상태 슬롯)에 대한 둘 이상의 동시
  writer" 라는 이 리뷰 관점의 정의 그 자체다 — 라운드 1-6 이 전부 "**판정자를 어떻게 고정하나**"
  를 다뤘는데, 이 경로는 판정자를 안 건드리고 판정자의 **출력이 도착하는 슬롯 자체를 복제**한다.

  - 위치:
    - 공격 표면(신규 파일을 자유롭게 추가할 수 있는 자리): `.github/workflows/` — 예:
      `.github/workflows/zz-decoy.yml` 하나만 추가하면 된다.
    - 이를 잡아야 하는데 비어 있는 자리 (실제 파일 기준 줄 번호, `Read`/`grep` 으로 확인):
      - `.claude/tests/test_review_gate_ci.py:444` — `WorkflowWiringTest.setUp` 이
        `path = _harness.REPO_ROOT / ".github" / "workflows" / "review-gate.yml"` 로
        **그 한 파일만** 열어 문서 전체를 기대값과 비교한다. 저장소에 같은 `name:`/job id 를 쓰는
        **다른** 파일이 있는지는 절대 보지 않는다.
      - `.claude/tests/test_workflow_yaml_structure.py:85` — `_workflow_files()` 가
        `.github/workflows/*.y*ml` 을 모아 이후 모든 검사(`test_no_duplicate_keys`,
        `test_job_conditions_are_registered`, `test_no_guard_workflow_swallows_its_own_failure` 등)
        가 **파일마다 독립적으로** 도는데, 파일 **간** `name:` 또는 `jobs.<id>` 충돌을 대조하는
        테스트가 없다.
      - `.github/workflows/review-gate.yml:20`(`name: review-gate`) / `harness-checks.yml` 어느
        쪽도 자신의 `name:` 이 저장소 전체에서 유일함을 강제하지 않는다.

  - 상세:

    라운드 1-6 의 모든 우회는 **판정자**(`evaluate_review()`/`check-review-gate.py`)를 갈아타거나
    **트리거**(`if:`/`continue-on-error`/`on.pull_request` 형태)를 죽이는 쪽이었다. 이 두 축은
    이번 라운드에 등재제·정확일치·행위테스트로 충분히 좁아졌다(`OneJudgeTest`,
    `VerdictComesFromTheGateTest`, `WorkflowWiringTest`). 그런데 이 세 방어 전부가 공유하는
    암묵적 전제가 하나 있다 — **"`review-gate / gate` 라는 체크 이름을 만드는 워크플로는
    저장소에 하나뿐이다."** 이 전제 자체를 지키는 코드가 없다.

    GitHub Actions 는 PR 체크 목록에 각 워크플로 실행의 job 을
    `<workflow name:> / <job id 또는 job name:>` 문자열로 노출한다. Branch protection 의
    "필수 상태 검사(required status check)" 는 바로 이 문자열("context")로 매칭한다 — **어느
    워크플로 *파일*에서 왔는지는 안 본다.** 즉 완전히 별개의 신규 `.yml` 파일이

    ```yaml
    name: review-gate
    on:
      pull_request:
        paths: ['**']
    jobs:
      gate:
        runs-on: ubuntu-latest
        steps:
          - run: echo "always green"
    ```

    를 선언하면, PR 마다 **진짜 `review-gate.yml` 이 만드는 실행**과 **이 디코이가 만드는
    실행**이 **동시에** 돌며 똑같은 이름("review-gate / gate")으로 상태를 보고하려 경쟁한다.
    실제 게이트 판정 로직(`review_guard.evaluate_review`)·`check-review-gate.py`·
    `review-gate.yml` 문서 자체는 **단 한 바이트도 건드리지 않는다** — 그래서 그 셋을 지키는
    모든 가드(`WorkflowWiringTest`, `OneJudgeTest`, `VerdictComesFromTheGateTest`, 전 워크플로
    구조검사)가 전부 그대로 GREEN 이다(아래 재현 참조).

    지금 당장의 파급은 제한적이다 — `review-gate.yml` 이 아직 **관측 모드**(`--enforce` 없음,
    항상 exit 0)라서 오늘은 "이길" 판정 자체가 없다. 그러나 plan 문서(`harness-review-gate-ci-
    backstop.md`)가 명시하듯 `--enforce` 전환은 "CI 에 쌓이는 실판정을 보고" 결정할 **예정된
    다음 단계**이고, 그 전환 시점에 이 디코이 파일이 이미 저장소에 병합돼 있다면 **추가 PR 없이
    즉시** 작동한다: `--enforce` 가 켜져 실제 게이트가 어떤 PR 을 "미커버"로 막으려는 순간에도,
    디코이가 낸 동일 이름의 "success" 체크가 branch protection 요구조건을 만족시킬 수 있다
    (GitHub 의 required-context 매칭은 동일 SHA·동일 context 에 대해 나중에 도착한/성공한 실행을
    받아들이는 것으로 알려져 있다). 즉 이번 라운드가 막으려는 정확히 그 결과 — **차단돼야 할
    PR 이 조용히 통과** — 를 판정 로직도 트리거 조건도 안 건드리고 달성한다.

  - 재현 (mktemp 사본, 워킹트리 비변경, 실행 명령과 출력 원문):

    ```bash
    SCRATCH="$(mktemp -d ".../scratchpad/ci-backstop-probe.XXXXXX")"
    mkdir -p "$SCRATCH/repo"
    rsync -a --exclude='.git/' --exclude='node_modules/' --exclude='codebase/' --exclude='dist/' \
      "<repo>/" "$SCRATCH/repo/"
    cd "$SCRATCH/repo"

    # 베이스라인
    python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'
    python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
    python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'
    python3 -m unittest discover -s .claude/tests -p 'test_dependabot_npm_coverage.py'

    # 디코이 추가 — review_guard.py / check-review-gate.py / review-gate.yml 은 무변경
    cat > .github/workflows/zz-decoy.yml <<'EOF'
    name: review-gate
    on:
      pull_request:
        paths: ['**']
    jobs:
      gate:
        runs-on: ubuntu-latest
        steps:
          - run: echo "always green"
    EOF

    python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'
    python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
    python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'
    python3 -m unittest discover -s .claude/tests -p 'test_dependabot_npm_coverage.py'
    python3 -m unittest discover -s .claude/tests -p 'test_*.py'   # 전체 831개
    ```

    실측 결과 (디코이 추가 전/후 **완전히 동일**):

    ```
    test_workflow_yaml_structure.py : Ran 9 tests  → OK   (전/후 동일)
    test_review_gate_ci.py          : Ran 16 tests → OK   (전/후 동일, WorkflowWiringTest 포함)
    test_harness_checks_paths_coverage.py : Ran 26 tests → OK (전/후 동일)
    test_dependabot_npm_coverage.py : Ran 14 tests → FAILED (failures=1)  (전/후 동일 — codebase/
                                       를 rsync 에서 제외한 사본 자체의 결함, 디코이와 무관을
                                       전/후 diff 로 확인)
    전체 831개 스위트 : 전/후 실패 목록(`FAIL:`/`ERROR:`) 이 byte-for-byte 동일 6건 — 전부
                        codebase/ 부재로 인한 사본 아티팩트, review-gate/harness-checks 무관.
    ```

    즉 **이번 라운드의 모든 방어가 그대로 통과한 채로**, 저장소에 `review-gate` 라는 이름의
    체크를 발행하는 워크플로가 두 개가 된다.

  - 제안: `WorkflowWiringTest` 가 `review-gate.yml` 에만 거는 문서-전체 고정과 별개로, **저장소
    전체**에 대해 다음을 등재제로 고정할 것 — `test_workflow_yaml_structure.py` 가 이미 전
    워크플로를 순회하는 자리(`_workflow_files()`)이므로 자연스러운 위치다.
    1. `(name, job_id)` 쌍이 전 `.github/workflows/*.yml` 에서 유일해야 한다(`collections.Counter`
       로 충분 — 두 파일이 같은 조합을 내면 실패).
    2. 참고로 `harness-checks.yml` 자신도 `name: harness-checks` 인데, 이 규칙이 서면 그 유일성도
       덤으로 지켜진다.
    이 검사는 `WorkflowWiringTest` 처럼 "문서 전체 정확 일치"가 필요 없다 — 카운터 하나로 유한하고
    완전하다(4R 의 "부분집합 정확 일치는 여전히 부분 일치" 교훈과 달리, 이건 애초에 전체 집합에
    대한 술어라 회피할 옆문이 없다).

- **[INFO]** `concurrency: cancel-in-progress: true` (그룹 `review-gate-${{ github.ref }}`,
  `harness-checks-${{ github.ref }}`) 의 실제 판정 영향은 **실 Actions 러너 없이는 검증 불가**
  (프롬프트가 배제한 `Fetch base ref` 항목과 같은 종류의 한계라 CRITICAL 로 올리지 않는다).
  다만 짚어 둔다: 관측 모드에서는 무해하지만(항상 exit 0), `--enforce` 전환 후 같은 SHA 에
  대해 짧은 간격으로 여러 커밋이 push 되면 앞선 실행이 "cancelled" 로 끝난다 — 그 결론이
  required-status-check 평가에서 "success" 로도 "미해결" 로도 해석될 여지가 있는지는 실측하지
  않고는 모른다. `--enforce` 를 켜는 시점에 실 PR 로 한 번 확인해 둘 가치가 있다.
  - 위치: `.github/workflows/review-gate.yml:36-38`, `.github/workflows/harness-checks.yml:66-68`.

- **[INFO]** (교차 검증) 리뷰 진행 중 `.claude/tests/test_review_gate_ci.py` 의 실제 워킹트리
  내용이 이 세션에 전달된 프롬프트 번들과 달랐다 — 번들에는 없는 `ReviewArtifactsStayTrackedTest`
  클래스(561-609행)가 실제 파일에는 이미 존재했다. `git status --short` 로 확인한 결과 이 파일은
  깨끗한(커밋된) 상태였다 — 즉 나 아닌 다른 프로세스가 리뷰 도중 새 커밋을 만들어 흡수했다는
  뜻이다(`security.md` 가 같은 현상을 `HEAD` 값과 함께 더 상세히 기록해 뒀다 — 중복 보고는
  피하고 교차 확인만 남긴다). 이 자체는 동시성 버그가 아니라 **리뷰 프로세스의 레이스**
  (번들 생성 시점과 리뷰 시점 사이 워킹트리가 이동)이고, MEMORY 의 "작업 중에도 머지된다"
  패턴과 동일 클래스다. 이번 라운드 결론에는 영향 없음 — 새로 생긴 클래스는 이 리포트의 발견과
  무관한 별개 방어(gitignore 관련)였다.

## 코드 자체의 고전적 동시성 관점 점검 (결과: 해당 거의 없음)

이번 라운드의 실제 diff 는 테스트 파일·워크플로 YAML·정책 문서·`check-review-gate.py` 로,
멀티스레드/멀티프로세스 공유 상태를 다루는 코드가 아니다. 점검 관점 1-8 을 하나씩 대조:

- **경쟁조건/원자성**: `review_guard.evaluate_review()` 는 이 라운드 diff 기준으로 순수 읽기 전용
  (`grep '"w"'` 로 쓰기 호출 0건 확인) — `check-review-gate.py` → `evaluate_review()` 경로에
  read-modify-write 는 없다. (plan 문서 항목 10 이 언급하는 `_retry_state.json` lost-update 는
  **이번 라운드 diff 밖**이고 이미 별도 defer 항목으로 기록돼 있다 — 재보고하지 않는다.)
- **데드락/동기화/스레드안전성**: 락을 쓰는 코드가 diff 에 없다. `unittest discover` 는 단일
  프로세스·순차 실행이라 테스트 간 진짜 스레드 경합은 없고, `_harness.load_module_by_path()` 는
  캐시-확인 없이 매번 `sys.modules[name]` 을 무조건 덮어쓰고 재실행하므로(`_harness.py:44-46`)
  "먼저 로드된 모듈이 나중 로드를 가린다" 류의 캐시-오염 경로도 없음을 확인했다.
  `VerdictComesFromTheGateTest._exit_code()` 는 매 서브프로세스에 최소 명시 환경만 구성해
  넘긴다(`os.environ` 상속 없음) — 부모 프로세스 상태가 자식으로 새는 경로도 없다.
- **async/await, 이벤트 루프**: 대상 코드에 비동기 코드 없음(전부 동기 Python/셸/YAML).
- **리소스 풀링**: 스레드풀·커넥션풀 대상 아님 — CI job 은 격리된 1회성 러너.

이 축들에서는 새 결함을 찾지 못했다 — 유일한 실질적 발견은 위 "체크런 identity 경쟁"
하나이며, 이것이 이 라운드가 요구한 "다음 층 밖"에 정확히 해당한다고 판단한다.

## 요약

라운드 6 까지의 경화는 **판정자**(어떤 코드가 게이트 판정을 내리는가)와 **트리거**(그 판정이
언제 도는가)라는 두 축을 성공적으로 좁혔다. 그러나 이 두 축을 전혀 건드리지 않고 세 번째 축 —
**그 판정이 도착하는 슬롯의 identity** — 를 복제하는 경로가 열려 있다: `name: review-gate` +
job id `gate` 를 재사용하는 새 워크플로 파일 하나면, 진짜 게이트를 한 글자도 안 건드리고 같은
이름의 "항상 성공" 체크를 만들 수 있고, 이번 라운드가 새로 세운 모든 가드(`WorkflowWiringTest`,
`OneJudgeTest`, `VerdictComesFromTheGateTest`, 전 워크플로 구조검사, paths coverage)가
mktemp 사본 실측에서 **변경 전후 완전히 동일하게 GREEN** 이었다. 오늘은 관측 모드라 실질 피해가
없지만, plan 문서가 예고한 `--enforce` 전환 시점에는 사전에 병합된 이 파일 하나로 즉시
작동하는 잠복 우회가 된다 — "동기화되지 않은 두 writer 가 같은 공유 identity 에 쓴다"는 점에서
이 리뷰 관점의 정의역 안에 있는 발견으로 보고한다. 그 밖에 diff 대상 코드 자체(테스트 파일들,
`check-review-gate.py`)에서는 고전적 스레드/락/원자성 결함을 찾지 못했다 — 순수 읽기 전용,
단일 프로세스 순차 실행, 서브프로세스 환경 격리가 모두 확인됐다.

## 위험도

CRITICAL — 오늘의 즉각 피해는 0(관측 모드)이지만, 이번 라운드가 명시적으로 준비 중인
`--enforce` 전환의 순간 추가 조치 없이 발현되는, 전 가드를 우회하는 재현 가능한 경로이고
(831/831 GREEN 실측), 판정자·트리거 어느 쪽도 건드리지 않아 기존 방어 설계 전부의 사각지대다.

STATUS: SUCCESS
