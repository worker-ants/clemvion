# 동시성(Concurrency) Review — review-gate CI backstop (round 3)

## 스코프 요약

리뷰 대상 8개 파일(`.claude/tests/README.md`, `test_block_integrity.py`,
`test_review_gate_ci.py`, `test_stop_guard_failopen.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`,
`scripts/check-review-gate.py`)는 전부 **단발 실행 CI 스크립트 + 그 테스트 + 문서**다.
스레드·`asyncio`·명시적 락·커넥션 풀은 이 파일들 어디에도 없다. `scripts/check-review-gate.py`
는 인자를 읽고 게이트 함수 하나를 호출하고 종료하는 순수 순차 스크립트이고, 공유 가변
상태를 만들거나 갱신하지 않는다 — 이 축(축 1: 새 백스톱 스크립트 자체)에는 동시성 결함이
없다.

동시성 관점에서 실질적으로 검토할 표면은 두 가지뿐이다: (A) GitHub Actions 의
`concurrency:` 지시자(런 취소/직렬화 정책) — 이번 PR 이 새로 추가하는 `review-gate.yml` 과
기존 `harness-checks.yml` 양쪽에 있음, (B) 이 백스톱이 위임하는 `evaluate_review()` 가
소비하는 훅 쪽 상태 파일(`*_failopen.json`)의 read-modify-write 패턴 — 이번 PR 의 테스트
파일(`test_stop_guard_failopen.py`)이 그 동작을 exercise 하지만, 파일 자체는 이번 diff 밖.

지시대로 실제 뮤테이션을 만들어 돌려봤다(작업 트리는 건드리지 않고 스크래치 디렉터리에
`.claude`/`.github`/`scripts` 만 복사).

## 발견사항

- **[WARNING]** `concurrency:` 지시자(런 취소 정책)를 검증하는 테스트가 전무 — 스탠자 전체
  삭제 + "그룹 키에서 `${{ github.ref }}` 제거·`cancel-in-progress` 반전" 둘 다 관련 스위트
  전원 GREEN 으로 실측 확인.
  - 위치: `.github/workflows/review-gate.yml:36-38`
    (`concurrency: / group: review-gate-${{ github.ref }} / cancel-in-progress: true`),
    동형 `.github/workflows/harness-checks.yml:63-65`. 이 지시자를 검증해야 할 자리는
    `.claude/tests/test_review_gate_ci.py:330` `WorkflowWiringTest` (같은 파일에서 `if:` 봇
    면제·`paths:` 커버리지·`fetch-depth: 0`·`--enforce` 리터럴/셸치환 금지는 전부 구조적으로
    핀되어 있음, 330-453행) 인데, 이 클래스도 이 파일의 다른 어떤 테스트도 `concurrency` 키를
    보지 않는다.
  - 상세: 이 PR 의 핵심 서사 자체가 "가드는 상상한 만큼만 강하고, 상상은 늘 부족하다" —
    `OneJudgeTest` 가 whole-file grep → prose-excluded grep → denylist → allowlist 로 네 번
    다시 쓰인 것도, `WorkflowWiringTest` 가 `if:`→`env:` 이동과 `run: true` 우회를 막으려고
    구조적 파싱으로 다시 쓰인 것도 전부 "검증되지 않은 성질은 조용히 깨진다" 는 같은 교훈이다.
    `concurrency:` 스탠자는 정확히 그 교훈이 아직 안 닿은 다섯 번째 성질이다: 실측(아래
    "실행 로그" 참조)으로, (1) 스탠자 전체를 지워도, (2) `group:` 을 `review-gate-${{
    github.ref }}` 에서 `github.ref` 없는 고정 리터럴 `review-gate` 로 바꾸고
    `cancel-in-progress` 를 `false` 로 뒤집어도 — `test_review_gate_ci.py` 의 15개 테스트
    전원이 그대로 통과한다. 그룹 키에서 `github.ref` 를 빼면 **서로 다른 브랜치/PR 의 실행이
    같은 그룹으로 묶여 한쪽이 다른 쪽의 실행을 취소**할 수 있다는 뜻인데, 이 회귀는 어떤
    테스트로도 잡히지 않는다.
    현재 영향은 낮다 — 이 게이트는 관측 모드(`--enforce` 없이 항상 exit 0)라, 실행이 취소돼도
    "이번 커밋에 대한 관측 하나가 누락" 되는 정도다. 하지만 이 티켓 자신의 계획 문서
    (`plan/in-progress/harness-review-gate-ci-backstop.md:150-153`)가 "enforce 전환은 별도
    결정이며 그때 바꿀 곳은 `run:` 한 줄과 `test_it_is_still_observation_only` 하나" 라고
    명시한 것과 같은 논리로, `--enforce` 가 켜지는 순간 이 지시자의 정확성이 "관측 하나 누락"
    에서 "차단해야 할 PR 이 조용히 취소되어 상태를 안 남긴다" 로 격상된다. 지금 고쳐두지
    않으면 그 전환 시점에 재확인할 체크리스트에도 빠질 공산이 크다(이 항목이 열거된 4개
    성질에 없으므로).
  - 제안: `WorkflowWiringTest` 에 다섯 번째 프로퍼티로 `concurrency.group` 이
    `${{ github.ref }}` 를 포함하고 `cancel-in-progress` 가 `true` 인지 구조적으로 단언하는
    테스트를 추가한다. `harness-checks.yml` 도 같은 패턴이면 함께.
  - 실행 로그(스크래치 사본, 작업 트리 무변경):
    ```
    $ python3 -m unittest test_review_gate_ci.WorkflowWiringTest -v   # concurrency: 스탠자 전체 삭제 후
    ... (5 tests) ... OK

    $ python3 -m unittest test_review_gate_ci -v                       # group: review-gate (github.ref 없음) + cancel-in-progress: false 로 변경 후
    ... (15 tests) ... OK
    ```
    두 뮤테이션 모두 `git status`/`grep -rn "concurrency" .claude/tests` 로 사전 확인한 대로
    — 저장소 전체 `.claude/tests/*.py` 어디에도 `concurrency`/`cancel-in-progress` 문자열이
    없다(무관한 `test_bootstrap_mermaid_install.py` 의 "동시 시작" 주석 2건 제외) — 이 갭은
    `review-gate.yml` 하나만이 아니라 리포지토리의 10개 워크플로 전부에 해당하는 기존 상태다.
    이번 PR 은 그 상태를 하나 더(정확히 이 백스톱이 방어하려는 성질과 같은 종류의 신뢰가
    필요한 파일에) 추가한다.

- **[INFO]** `_retry_state.json` 의 lost-update(락 없음)는 이번 diff 의 실제 코드 변경이
  아니라 **계획 문서에 이미 등재된, 의도적으로 defer 된 항목** — 재오픈하지 않음.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:84-93` (신규 후속 항목 10번).
  - 상세: `apply_status_update` 가 read-modify-write 인데 파일 잠금이 없고, `agents_fatal`/
    `agent_history`/`rate_limit_episodes`/`last_reset_hint_sec` 는 한 번 유실되면 어떤
    reconcile 로도 복구 불가하다는 것을 저자가 이미 측정·기록했다. `fcntl.flock` 은 "모든 훅
    경로에 블로킹 프리미티브를 놓는다" 는 이유로 명시적으로 기각했고, 대안(`<name>.fatal`
    sentinel 파일)은 별도 설계로 분리해 뒀다. 이는 이 리뷰가 새로 발견한 결함이 아니라, 저자가
    이미 근거와 함께 defer 를 선언한 항목이므로 CRITICAL/WARNING 으로 재기표하지 않는다 —
    다만 동시성 리뷰 관점에서 존재를 확인하고 기록만 남긴다(다음 라운드에서 재작업 시
    참고용).
  - 제안: 없음(이미 트래킹됨). 참고로만 남김.

- **[INFO]** 나머지 표면은 동시성 결함 없음(확인됨).
  - `scripts/check-review-gate.py`: 단일 프로세스·순차 실행, 공유 가변 상태 없음. `_load_gate`
    (63-74행)와 `main()`(77-126행) 모두 예외를 잡아 fail-open exit 0 으로 귀결시키는 순차
    제어 흐름이며 원자성 이슈가 없다(반환값까지 `try` 안에서 읽어 "예외 없이 형태만 다른 값"
    도 fail-open 되게 한 설계, 96-106행 — 견고함).
  - `.github/workflows/review-gate.yml` / `harness-checks.yml`: 두 워크플로는 서로 다른
    `concurrency.group` 리터럴(`review-gate-…` vs `harness-checks-…`)을 쓰므로 상호 취소는
    없다 — 같은 파일이 두 워크플로의 `paths:` 에 동시에 걸려도(예:
    `.claude/hooks/_lib/review_guard.py`) 서로 독립적으로 돈다. 정상.
  - `test_review_gate_ci.py`/`test_stop_guard_failopen.py`: 각 테스트가 `tempfile.mkdtemp()`
    로 격리된 디렉터리 + 전용 `CLAUDE_PROJECT_DIR` 를 쓰고 `unittest` 는 기본 순차 실행이라
    테스트 간 경쟁은 없다. `SuiteLeavesNoRealStateTest`(`test_stop_guard_failopen.py:250-272`)
    가 "격리를 잊은 테스트가 실제 저장소의 fail-open 카운터를 오염시키는" 실패 모드를
    스스로 감시하고 있어, 이 축의 위험은 이미 자체 커버됨.

## 요약

이번 변경분은 CI 배선·테스트·계획 문서로 구성돼 있고 스레드/비동기/락 코드는 없어 전통적
의미의 경쟁 조건·데드락·스레드 안전성 문제는 발생하지 않는다. 다만 "검증되지 않은 성질은
조용히 깨진다"는 이 PR 자신의 반복된 교훈이 아직 닿지 않은 자리가 하나 있다: 새로 추가되는
`review-gate.yml`(및 기존 `harness-checks.yml`)의 `concurrency:` 지시자는 리포지토리 전체에서
어떤 테스트로도 그 그룹 키(`${{ github.ref }}` 포함 여부)나 `cancel-in-progress` 값을
검증하지 않으며, 실측 뮤테이션(스탠자 전체 삭제, 그리고 그룹 키에서 `github.ref` 를 제거하며
`cancel-in-progress` 를 반전)에서 관련 스위트 15개 테스트 전원이 GREEN 을 유지했다. 관측
모드인 지금은 영향이 낮지만(취소돼도 관측 하나 누락일 뿐), `--enforce` 전환 이후에는 그룹
키 오류가 무관한 PR 간 취소를 일으킬 수 있어 그때는 조용한 사각지대가 된다. 그 외에는
새 백스톱 스크립트와 두 워크플로 모두 순차·단일-판정자 설계를 지키고 있어 구조적으로
건전하다. 이미 계획 문서에 등재된 `_retry_state.json` lost-update 는 이번 diff 의 신규 결함이
아니므로 재플래그하지 않는다.

## 위험도

LOW
