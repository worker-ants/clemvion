# 테스트(Testing) 리뷰 — CI 백스톱 4R

## 실행한 실험 (재현 절차)

작업 트리는 건드리지 않았다. `mktemp -d` 로 만든 격리 디렉토리에 저장소 전체를 `cp -R` 로
복사하고(`.git` 포함, `git checkout --`으로 라운드 사이 원복), 그 복사본 안에서만 워크플로
YAML 을 변형하고 `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'`
를 돌렸다. 매 실험 후 `git status --porcelain` 로 원 저장소가 깨끗함을 확인했다(마지막 확인:
`?? review/code/2026/08/06/` 만 — 이 리뷰 산출물 자체).

### 실험 1 — "Fetch base ref" step 을 통째로 제거

```
python3 - <<'EOF'
...
block = (step "- name: Fetch base ref" 전체, env/run 포함)
s2 = s.replace(block, "")
open(p, "w").write(s2)
EOF
python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
```

결과: **`Ran 18 tests in 2.745s / OK`** — 전부 GREEN.

### 실험 2 — job 레벨 `continue-on-error: true` 추가 (step 레벨이 아니라)

```
jobs:
  gate:
    runs-on: ubuntu-latest
    continue-on-error: true   # 추가
    timeout-minutes: 5
    ...
```

결과: **`Ran 18 tests in 2.966s / OK`** — 전부 GREEN.

### 실험 3 — `on.pull_request.types: [opened]` 추가 (기본값 `[opened, synchronize, reopened]` 를 덮어씀)

```
on:
  pull_request:
    types: [opened]   # 추가
    paths:
      - 'codebase/**'
      ...
```

결과: **`Ran 18 tests in 3.865s / OK`** — 전부 GREEN.

세 실험 모두 `.claude/tests/test_review_gate_ci.py::WorkflowWiringTest` 를 포함한 18개 테스트
전원이 통과했다. 즉 세 변경 각각이 **출하되는 동작을 바꾸면서도 스위트를 초록으로 유지**한다.

---

## 발견사항

- **[CRITICAL]** `WorkflowWiringTest` 가 게이트 판정에 필수인 "Fetch base ref" step 의 존재·내용을
  전혀 고정하지 않는다 — step 을 통째로 지워도 18개 테스트가 전부 통과한다(실험 1).
  - 위치: `.claude/tests/test_review_gate_ci.py:358` (`class WorkflowWiringTest`, 특히
    `test_the_checkout_before_the_gate_fetches_full_history`) / `.github/workflows/review-gate.yml:67-70`
    (`- name: Fetch base ref`)
  - 상세: `review-gate.yml` 자신의 주석(63-66행)이 "base ref 가 `origin/<base>` 로 해석돼야
    `_default_branch()` 가 merge-base 를 찾는다" 고 명시한다 — 즉 이 step 은 장식이 아니라
    게이트 판정의 입력 전제다. `WorkflowWiringTest` 는 checkout step 의 `fetch-depth: 0` 은
    고정하지만(`test_the_checkout_before_the_gate_fetches_full_history`), 그 뒤에 오는 "Fetch base
    ref" step 은 이름·`run`·`env.BASE_REF` 어느 것도 검사 대상이 아니다. 이 step 이 없으면
    CI 러너에는 `origin/<base>` 리모트-트래킹 참조가 없을 개연성이 크고(액션 `checkout@v7` 은
    트리거 ref 만 가져온다), `review_guard` 의 merge-base 계산이 실패하거나 엉뚱한 diff 를
    보게 된다 — 이는 정확히 이 백스톱이 막으려는 "판정이 조용히 무력화" 클래스이며, 3R/4R 이
    이미 두 번 고친 "step 은 실행되지만 실질이 없다" 결함과 **같은 모양**이다(프롬프트가 명시
    경고한 "assume there are more of that shape"). `run:` 문자열이 아니라 **다른 step 의 존재
    자체**가 사각인 것이 이번 라운드가 놓친 축이다.
  - 제안: `WorkflowWiringTest` 에 "Fetch base ref" step 의 정확한 `run`(`git fetch --no-tags
    origin "$BASE_REF"`)과 `env.BASE_REF`(`${{ github.base_ref }}`) 를 게이트 step 과 동일한
    엄격도(전체 일치)로 고정하는 테스트를 추가한다. 이상적으로는 `VerdictComesFromTheGateTest`
    처럼 행위 기반으로도 보강 — 예컨대 `origin/<base>` 참조가 부재한 저장소에서
    `check-review-gate.py` 를 돌려 그 상황이 실제로 fail-open/오판정으로 이어지는지 별도
    통합 테스트로 실측해 두면, 이 step 을 지우거나 내용을 바꿔도 (워크플로 테스트가 놓치더라도)
    행위 테스트가 잡는다.

- **[CRITICAL]** `_NEUTERING_KEYS` 검사가 **step 레벨에만** 적용되고 동일한 이름의 **job 레벨**
  `continue-on-error` 는 전혀 검사하지 않는다 — job 에 `continue-on-error: true` 를 추가해도
  18개 테스트가 전부 통과한다(실험 2).
  - 위치: `.claude/tests/test_review_gate_ci.py:423-438`
    (`_NEUTERING_KEYS` 및 `test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`) —
    `step = self.steps[self._gate_step_index()]` 에 대해서만 순회하고, `self.job` 자체는 어디서도
    같은 키 집합으로 검사되지 않는다.
  - 상세: 이번 라운드의 커밋 메시지(`864b71a7b`)가 정확히 "step 레벨 continue-on-error 가
    스위트를 통과했다"는 실측을 근거로 세 키를 **step** 에 대해서만 막았다. 그런데 GitHub
    Actions 는 `jobs.<job_id>.continue-on-error` 도 유효한 키이고, 의미는 더 강하다 — job 전체가
    실패해도 워크플로/필수 상태 체크 관점에서 "neutral" 로 취급된다. `test_the_job_condition_is_
    exactly_the_bot_exemption` 은 `job.get("if", "")` 만 정확 일치로 고정할 뿐 `continue-on-error`
    나 `timeout-minutes` 같은 다른 무력화 키의 job-레벨 부재는 검사하지 않는다. 지금 라운드가
    "step 축"과 "job 축(`if`)"은 닫았지만 "job 축의 나머지 무력화 키"는 여전히 열려 있다 — 같은
    결함 클래스가 한 계층 위에서 재발할 수 있는 자리다.
  - 제안: `_NEUTERING_KEYS` 순회를 `self.job` 에도 적용한다(다만 `timeout-minutes` 는 job 레벨에서
    이미 `5` 로 쓰이므로 그 키는 "부재" 가 아니라 "0이 아닌 양수" 조건으로, `continue-on-error`
    는 job 레벨에서도 부재 단언으로 분리). 최소한 `self.assertNotIn("continue-on-error", self.job,
    ...)` 한 줄이면 실험 2 를 막는다.

- **[WARNING]** 트리거 이벤트 타입(`on.pull_request.types`)이 검사 대상이 아니다 —
  `types: [opened]` 을 추가해도(기본값 `[opened, synchronize, reopened]` 를 `opened` 하나로
  좁혀 PR 에 새 커밋을 push 해도 워크플로가 재실행되지 않게 만드는 변경) 18개 테스트가 전부
  통과한다(실험 3).
  - 위치: `.claude/tests/test_review_gate_ci.py:456` (`test_trigger_paths_are_exactly_the_expected_set`)
    — `self.on["pull_request"]["paths"]` 만 비교하고 `self.on["pull_request"]` 의 다른 키(`types`
    포함)는 검사하지 않는다.
  - 상세: `synchronize` 가 트리거 목록에서 빠지면, PR 을 열 때 한 번은 게이트가 돌지만 이후
    codebase 를 바꾸는 모든 커밋에서 다시 돌지 않는다 — "훅과 독립인 트리거" 라는 이 백스톱의
    존재 이유(파일 헤더 §문제)를 사실상 무효화하는 변경인데, 관측 모드에서는(현재) 아무 신호도
    나지 않고 브랜치 보호 규칙이 "up to date" 를 강제하지 않는 한 GitHub UI 에서도 눈에 띄지
    않는다. CRITICAL 로 올리지 않은 이유는 (a) 기본값이 명시 없이도 이미 `[opened, synchronize,
    reopened]` 이라 이 변경은 "추가" 가 필요하고 우연히 나오기 어려우며, (b) 두 CRITICAL 항목과
    달리 로컬 `guard_review_before_push` 훅이 여전히 매 push 를 커버해 완전한 사각은 아니기
    때문이다. 그럼에도 "정확 일치로 배선을 고정한다"는 이 클래스의 설계 원칙(파일 358-373행
    docstring) 자체가 이 키를 빠뜨렸다.
  - 제안: `self.assertEqual(self.on["pull_request"], {"paths": self.EXPECTED_PATHS})` 처럼
    `pull_request` 매핑 전체를 정확 일치로 검사해 `types`/`branches`/`branches-ignore` 등 신규
    키의 등장을 전부 잡는다(현재 `paths` 서브키만 뽑아 비교하는 방식은 형제 키 추가에 구조적으로
    맹목적이다).

- **[INFO]** `OneJudgeTest`(파일 358행 이전)의 허용 목록·행위 검증(`VerdictComesFromTheGateTest`)
  자체는 이번 라운드에서 손대지 않았고 재실행해도 그대로 통과해 회귀는 없다. `_gate_step_index()`
  가 "이름이 아니라 `run` 문자열로 게이트 step 을 찾는" 방식이라, 워크플로에 `EXPECTED_GATE_RUN`
  을 포함하는 **가짜 step 을 하나 더 추가**하면 `enumerate` 순서상 먼저 오는 쪽이 검사 대상이
  되고, 진짜(나중에 오는) step 은 아무 것도 검사받지 않을 수 있다 — 다만 이는 `_gate_step_index`
  의 사각이지 이번 diff 의 신규 결함은 아니므로 정보 제공 수준으로만 남긴다. 위치:
  `.claude/tests/test_review_gate_ci.py:408-412` (`_gate_step_index`).

- **[INFO]** `ReviewGateCliTest` 계열(§2~4)과 `VerdictComesFromTheGateTest` 는 실제 파일 서브프로세스
  구동(`_git`/`subprocess.run`)이라 mock 이 실제 CLI 계약과 어긋날 위험이 낮다. `_D`/`_R` 스텁이
  `push_blocks`(사용 안 함)까지 흉내내는 습관은 "실제 인터페이스를 그대로 비추게 둔다"는 스위트
  자체 관행(주석, 179-180행)과 일관되고, 실제 소비 코드(`scripts/check-review-gate.py:101`)가
  `.blocked` 를 읽는다는 점과도 어긋나지 않는다 — 오탐 아님, 확인만 하고 넘어간다.

## 요약

diff 자체(`_NEUTERING_KEYS` 3종 추가)는 4R 에서 실측된 `continue-on-error: true` 구멍을 정확히
닫았고 회귀도 없다. 그러나 프롬프트가 명시적으로 요구한 "같은 모양의 다른 구멍을 찾아라" 실험을
돌린 결과, 스위트를 초록으로 유지한 채 배선을 무력화하는 경로가 최소 셋 발견됐다: (1) 게이트가
merge-base 계산에 의존한다고 워크플로 스스로 주석에 적어 둔 "Fetch base ref" step 이 내용은커녕
존재 자체도 어떤 테스트의 검사 대상이 아니다(step 삭제해도 GREEN), (2) 이번에 막은
`continue-on-error` 가 **step 레벨에서만** 막혔고 동일한 무력화가 **job 레벨**에서는 여전히
가능하다(GREEN), (3) `pull_request.types` 를 좁혀 `synchronize` 를 제거해도 트리거 배선 테스트가
`paths` 서브키만 보므로 잡지 못한다(GREEN). 세 실험 모두 실제 격리 사본에서 재현했고 재현 명령과
결과를 위에 기록했다. 앞의 둘은 "게이트 자체가 조용히 무력화된다"는 이 백스톱의 핵심 위협 모델과
직결돼 CRITICAL, 세 번째는 로컬 훅이 잔존 커버리지를 제공해 WARNING 으로 분류했다.

## 위험도

CRITICAL
