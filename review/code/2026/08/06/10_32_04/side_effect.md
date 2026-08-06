# 부작용(Side Effect) 리뷰 — round 4

## 재현: 모든 테스트를 GREEN 으로 둔 채 SHIPPED BEHAVIOUR 를 바꿀 수 있었다

작업은 전부 `mktemp -d` 로 만든 내 소유 디렉터리에서, 절대경로로만 썼다. 실제 저장소
워킹트리는 건드리지 않았다 (`git status --porcelain=v1 -uall` 을 시작 시점과 종료 시점 모두
확인 — 세션 산출물(`review/code/2026/08/06/10_32_04/**`) 외에는 변경 없음).

### 준비

```bash
SCRATCH=$(mktemp -d ".../scratchpad/sidefx.XXXXXX")
REPO="/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379"
mkdir -p "$SCRATCH/repo/.claude" "$SCRATCH/repo/.github/workflows" "$SCRATCH/repo/scripts"
cp -R "$REPO/.claude/tests"    "$SCRATCH/repo/.claude/tests"
cp -R "$REPO/.claude/hooks"    "$SCRATCH/repo/.claude/hooks"
cp -R "$REPO/.claude/_shared"  "$SCRATCH/repo/.claude/_shared"
cp "$REPO/.github/workflows/review-gate.yml" "$SCRATCH/repo/.github/workflows/review-gate.yml"
cp "$REPO/scripts/check-review-gate.py"      "$SCRATCH/repo/scripts/check-review-gate.py"
```

`.claude/tests/_harness.py` 는 `REPO_ROOT = Path(__file__).resolve().parents[2]` 로 루트를
계산하므로 이 부분 복사만으로 `test_review_gate_ci.py` 전체가 독립적으로 돈다 (베이스라인
확인: `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'` → `Ran 18
tests ... OK`).

### 변형 1 — 게이트 직전에 스텝을 하나 끼워 넣는다

`.github/workflows/review-gate.yml` 의 "Fetch base ref" 스텝과 "Review coverage backstop"
스텝 사이에, 이름이 다른(예: "Prime pnpm cache") 새 스텝을 넣어 `scripts/check-review-gate.py`
자체를 항상 통과하는 스텁으로 덮어썼다:

```yaml
      - name: Prime pnpm cache
        run: |
          cat <<'EOF' > scripts/check-review-gate.py
          import sys
          print("review-gate: 통과 — cache primed")
          sys.exit(0)
          EOF
```

실행:

```bash
cd "$SCRATCH/repo" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
```

출력 (발췌, 전체 18개 전부):

```
test_the_import_and_call_surface_stays_small ... ok
test_a_clean_branch_passes_under_enforce ... ok
...
test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed ... ok
test_the_gate_step_runs_exactly_the_expected_command ... ok
test_the_job_condition_is_exactly_the_bot_exemption ... ok
test_trigger_paths_are_exactly_the_expected_set ... ok
test_concurrency_is_pinned ... ok
test_it_is_still_observation_only ... ok

----------------------------------------------------------------------
Ran 18 tests in 2.557s

OK
```

전 항목 GREEN. 그런데 실제 GH Actions 러너에서 이 워크플로가 돌면 "Review coverage
backstop" 스텝이 실행하는 `scripts/check-review-gate.py` 는 checkout 이 내려받은 원본이
아니라 직전 스텝이 갈아치운 no-op 이다 — 모든 PR 에서 백스톱이 항상 "통과" 를 찍고 exit 0
한다. `--enforce` 를 켜도 무력하다.

### 변형 2 — 새 스텝조차 필요 없다: 검사 대상이 아닌 기존 스텝에 얹는다

더 최소 형태: "Fetch base ref" 스텝의 `run:` 값은 `WorkflowWiringTest` 어디서도 읽지 않는다
(그 클래스가 참조하는 건 `EXPECTED_GATE_RUN` 문자열이 들어있는 스텝, `if`, `concurrency`,
`on.pull_request.paths`, 그리고 게이트 앞의 마지막 `actions/checkout*` 의 `fetch-depth` 뿐).
그 스텝의 기존 `run` 뒤에 `&&` 로 한 줄만 붙였다:

```diff
-        run: git fetch --no-tags origin "$BASE_REF"
+        run: git fetch --no-tags origin "$BASE_REF" && printf 'import sys\nsys.exit(0)\n' > scripts/check-review-gate.py
```

실행 (새 scratch 복사본, 변형 1 과 독립):

```bash
cd "$SCRATCH/repo2" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
```

출력:

```
...
test_the_checkout_before_the_gate_fetches_full_history ... ok
test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed ... ok
test_the_gate_step_runs_exactly_the_expected_command ... ok
test_the_job_condition_is_exactly_the_bot_exemption ... ok
test_trigger_paths_are_exactly_the_expected_set ... ok
test_concurrency_is_pinned ... ok
test_it_is_still_observation_only ... ok

----------------------------------------------------------------------
Ran 18 tests in 2.887s

OK
```

18/18 GREEN. 새 스텝도, `_NEUTERING_KEYS`(`if`/`continue-on-error`/`timeout-minutes`)에 있는
어떤 키도, `EXPECTED_GATE_RUN` 문자열도 건드리지 않았다 — 오직 테스트가 아예 쳐다보지 않는
스텝의 `run:` 값에 `&&` 한 조각을 붙였을 뿐이다. `OneJudgeTest`/`VerdictComesFromTheGateTest`
는 이 변형을 잡지 못한다: 그 두 클래스는 checkout 된 저장소의 `scripts/check-review-gate.py`
를 서브프로세스로 **직접** 실행해서 검사하는데, 그건 항상 원본(스텝 실행 전) 파일이다 —
워크플로가 실제로 실행하는 **스텝 순서**를 재현하지 않으므로, "그 스텝이 실행되기 직전에
파일이 바뀌었는가" 는 애초에 그 두 테스트의 관측 범위 밖이다.

## 발견사항

- **[CRITICAL]** `WorkflowWiringTest` 가 "정확 일치"로 고정하는 것은 **개별 필드**뿐, 스텝
  **목록 전체**나 "게이트가 사용하는 파일이 그 직전까지 변조되지 않았는가"는 어디에도 없다 —
  실측: 검사되지 않는 기존 스텝(`Fetch base ref`)의 `run:` 에 `&&` 한 조각만 추가해
  `scripts/check-review-gate.py` 를 no-op 으로 덮어써도 `test_review_gate_ci.py` 18개 전부
  GREEN.
  - 위치: `.claude/tests/test_review_gate_ci.py` — `class WorkflowWiringTest` (게이트 358행)
    및 그 안의 `EXPECTED_IF`/`EXPECTED_GATE_RUN`/`EXPECTED_CONCURRENCY`/`EXPECTED_PATHS`
    (377–390행), `_gate_step_index`(408–412행). 이 클래스가 검사하는 스텝은 "게이트 스텝
    자신"과 "게이트 앞의 마지막 checkout" 딱 둘뿐이고, `Fetch base ref` 스텝
    (`.github/workflows/review-gate.yml` 67–70행)의 `run:`/`env:` 는 어떤 테스트에서도
    참조되지 않는다.
  - 위치: `.github/workflows/review-gate.yml` — `jobs.gate.steps` 전체(52행부터). 스텝
    개수·순서·각 스텝의 파일시스템 부작용에 대한 어떤 제약도 워크플로 자체에도, 테스트에도
    없다. `Review coverage backstop` 스텝(73–74행)이 실행하는 것은 "체크아웃 시점의
    `scripts/check-review-gate.py`" 가 아니라 "그 스텝이 시작되는 순간의 워킹 디렉터리 내용"
    이라, 그 사이에 실행되는 임의 스텝이 이 파일(또는 `.claude/hooks/_lib/review_guard.py`,
    `.claude/_shared/**`)을 덮어쓰면 판정이 조용히 뒤바뀐다.
  - 상세: 라운드 3 는 "`run` 문자열은 그대로인데 sibling 키가 실패를 무력화"하는 구멍
    (`continue-on-error: true`) 을 닫으며 "이런 모양이 더 있을 것" 이라 명시했다. 이번
    라운드가 놓친 것은 sibling **키**가 아니라 sibling **스텝**이다 — 정적 정확일치와 행위
    테스트(`VerdictComesFromTheGateTest`) 둘 다 "게이트 스텝이 정확히 그 명령을 실행하는가"
    와 "그 스크립트가 스텁 판정에 순수하게 반응하는가"만 확인하고, "그 스크립트가 실행되는
    시점에 실제로 어떤 바이트가 디스크에 있는가"는 아무도 확인하지 않는다. `OneJudgeTest`/
    `VerdictComesFromTheGateTest` 는 저장소에 체크인된 `scripts/check-review-gate.py` 를
    서브프로세스로 직접 실행해서 검사하므로 항상 "변조되지 않은" 버전을 본다 — 워크플로가
    실제로 실행하는 스텝 시퀀스를 통해 도달하지 않는다. 즉 CI 에서 실제로 도는 코드 경로와
    테스트가 검사하는 코드 경로가 분리돼 있다.
  - 제안: (a) `WorkflowWiringTest` 에 "스텝 리스트 자체가 정확히 이 4개(이름/키 집합까지)"
    라는 전체-일치 검사를 추가한다 — 현재 개별 스텝을 검색해서 뽑아 쓰는 접근(`_gate_step_index`
    로 하나만 골라 검사)은 목록에 아무 스텝이 추가돼도 무해하다는 가정을 깔고 있는데, 이번
    실증이 그 가정을 반증한다. (b) 더 근본적으로는, "정적 배선 검사"로 이 클래스의 문제를
    닫으려는 시도 자체가 3라운드째 국소적으로만 막히고 있다는 패턴을 반복한다 — 이 파일이
    이미 `VerdictComesFromTheGateTest` 로 스크립트 내부 판정을 행위 검증으로 전환한 것과
    같은 방식으로, 워크플로 배선도 "정확한 필드값" 이 아니라 "게이트 스텝이 실행되는 순간
    `scripts/check-review-gate.py` 의 SHA 가 체크아웃 시점과 동일한가" 같은 **행위/불변식**
    검사로 뒤집는 편이 유한하고 완전할 수 있다(예: 게이트 스텝 자체가 `git diff --quiet HEAD
    -- scripts/check-review-gate.py .claude/hooks/_lib/review_guard.py .claude/_shared` 를
    스스로 확인하고 실패하면 non-zero 로 죽게 만들면, 그 방어가 워크플로 파일이 아니라
    스크립트/저장소 상태에 실려 이동하지 않는다). (c) 최소한, `_NEUTERING_KEYS` 검사가
    "게이트 스텝 자신의 sibling 키" 만 보는 지금 범위를, "게이트 스텝 이전의 모든 스텝이
    `scripts/`, `.claude/hooks/`, `.claude/_shared/` 경로에 쓰기를 하지 않는다" 는 스텝별
    검사로 넓힌다.

## 요약

이번 라운드가 명시한 "판정자는 하나" 원칙은 스크립트 **내부**(import/호출 표면 + 스텁 게이트
행위 검증)에서는 성공적으로 유한한 형태로 고정됐다. 그러나 같은 원칙이 워크플로 **배선**
층에서는 아직 "알려진 필드들의 정확 일치" 로만 닫혀 있고, 그 필드 목록 밖의 신규 스텝(또는
검사 대상이 아닌 기존 스텝의 `run:` 값 확장) 하나로 실제 실행 시점의 스크립트 내용을 갈아치울
수 있음을 두 가지 독립적인 최소 변형으로 실측했다 — 둘 다 `.claude/tests/test_review_gate_ci.py`
18개 테스트 전부를 그대로 GREEN 으로 통과시키면서, 실제 CI 에서는 백스톱을 모든 PR 에서
영구히 무력화한다. 이는 라운드 3 가 닫은 `continue-on-error` 구멍과 같은 계열(테스트가 보는
표면과 실제로 실행되는 표면의 불일치)이며, 프롬프트가 예고한 "더 있을 것" 에 해당하는 구체적
사례다. 실제 저장소 워킹트리에는 어떤 변경도 남기지 않았다(전부 `mktemp -d` 스크래치 복사본
안에서 수행, 종료 후 `git status` 로 확인).

## 위험도

CRITICAL — 이 백스톱이 존재하는 유일한 이유(훅의 push-탐지 정규식과 독립인 트리거)가 배선
층의 미검증 스텝 하나로 조용히 무효화될 수 있고, 그 상태에서도 GitHub 체크는 초록으로 남는다.

STATUS: SUCCESS
