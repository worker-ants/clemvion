# 문서화(Documentation) Review — CI 백스톱 (round 4)

## 뮤테이션 실험 (CONTEXT 지시 이행)

**질문**: 테스트를 전부 GREEN 으로 둔 채 SHIPPED BEHAVIOUR 를 바꿀 수 있는가?

**답: 예.** `WorkflowWiringTest`(`.claude/tests/test_review_gate_ci.py`)는 게이트 **스텝 자신**의
필드(`run`/`if`/`continue-on-error`/`timeout-minutes`)와 몇 개의 **명명된** 스텝(체크아웃)만
정확 일치로 고정한다. `self.job["steps"]` 전체 목록·순서·개수는 어디서도 고정되지 않는다. 즉
게이트 스텝 **앞에 스텝을 추가**해 같은 job 안에서 `python3` 를 PATH 상 먼저 걸리는 가짜
바이너리로 바꿔치기하면, 실제 게이트 스텝의 `run:` 문자열은 정확히 `python3
scripts/check-review-gate.py` 그대로인데도 GitHub Actions 러너에서는 진짜 스크립트가 **한
번도 실행되지 않는다**(항상 exit 0). 이 변경은 검사 대상 필드를 하나도 건드리지 않으므로 정적
검사·행위 검사 어느 쪽도 걸리지 않는다.

### 재현 절차 (실제 저장소 워킹트리는 건드리지 않음)

```bash
# 1) 격리된 자신만의 디렉토리에 로컬 clone (절대경로만 사용, cd 성공 여부에 의존하지 않음)
SANDBOX="$(mktemp -d /path/to/own/scratch/mutate-XXXXXX)"
git clone --local --no-hardlinks -q \
  /Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379 \
  "$SANDBOX/repo"

# 2) review-gate.yml 의 게이트 스텝 "바로 앞"에 python3 를 PATH 상 가로채는 스텝을 삽입
#    (스크립트를 대상으로 python3 - <<'PYEOF' ... PYEOF 로 문자열 치환, 절대경로 파일 하나만 write)
#    삽입된 블록:
#      - name: Prepare environment
#        run: |
#          mkdir -p "$HOME/.fakebin"
#          printf '#!/bin/sh\nexit 0\n' > "$HOME/.fakebin/python3"
#          chmod +x "$HOME/.fakebin/python3"
#          echo "$HOME/.fakebin" >> "$GITHUB_PATH"

# 3) 스위트 실행
python3 -m unittest discover -s "$SANDBOX/repo/.claude/tests" -p 'test_review_gate_ci.py' -v
python3 -m unittest discover -s "$SANDBOX/repo/.claude/tests" -p 'test_workflow_yaml_structure.py' -v
```

**출력 (실측, 그대로 인용)**:

```
test_the_import_and_call_surface_stays_small ... ok
...
test_concurrency_is_pinned ... ok
test_it_is_still_observation_only ... ok
test_the_checkout_before_the_gate_fetches_full_history ... ok
test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed ... ok
test_the_gate_step_runs_exactly_the_expected_command ... ok
test_the_job_condition_is_exactly_the_bot_exemption ... ok
test_trigger_paths_are_exactly_the_expected_set ... ok

----------------------------------------------------------------------
Ran 18 tests in 2.357s

OK
```

```
......
----------------------------------------------------------------------
Ran 6 tests in 0.038s

OK
```

즉 `test_review_gate_ci.py` 18개 전체와 `test_workflow_yaml_structure.py` 6개 전체가 GREEN 인
채로, 실제 GitHub Actions 러너에서는 `check-review-gate.py`가 **영구히·조용히 한 번도 실행되지
않는** 상태를 만들 수 있다 — `&& false`(3R)와 동일한 최종 효과(백스톱이 모든 PR 에서 꺼짐)를,
그때와는 전혀 다른 축(스텝 리스트의 완전성 부재)으로 재현한 것이다.

이후 `.claude/tests` 전체 스위트(820개)를 같은 sandbox 에서 discover 로 돌려, 실패/에러 목록에
`review_gate_ci`·`workflow_yaml_structure`·`harness_checks_paths_coverage` 관련 항목이 **전혀
없음**을 확인했다(다른 14 FAIL / 18 ERROR 는 `pnpm`/`node_modules`/`spec/` 미설치 등, 격리
clone 이 의존성 설치를 하지 않아 생기는 환경 잡음이며 이 뮤테이션과 무관 — `pnpm-workspace.yaml`
부재 등으로 확인).

**실제 저장소 워킹트리는 전 과정에서 미변경**임을 `git status --short` / `git diff --
.github/workflows/review-gate.yml` 로 재확인했다(둘 다 세션 시작 시점과 동일 — 이 세션 자신의
`review/code/2026/08/06/` 산출물 외 변경 없음). 실험용 clone 은 작업 종료 후 삭제했다.

부가 사고: 실험 중 재사용한 scratch 파일명(`sandbox_path.txt`)이 같은 세션의 **다른 병렬
reviewer 프로세스**가 쓴 동일 파일명과 충돌해 값이 덮어써졌다 — 이번 라운드가 다수의 리뷰어를
동시에 이 CI 백스톱에 투입 중이라는 방증이자, 공유 scratch 네임스페이스 충돌이 실제로 재현
가능함을 보여준다. 고유 디렉터리(`mutate-LPcqWq`)에는 원본 값이 그대로 남아 있어 실험 결과 자체는
훼손되지 않았다.

---

## 발견사항

- **[CRITICAL]** `WorkflowWiringTest` 클래스 docstring 이 "우회할 패턴이 아예 없다" 고
  단언하지만, 위 실험이 반증한다 — 스텝 **목록/개수/순서**를 고정하지 않아 게이트 스텝 앞에
  `python3` PATH 하이재킹 스텝을 추가하는 것으로 실제 CI 동작(백스톱 영구 무력화)을 바꿀 수
  있다. 이 라운드가 이미 닫은 `continue-on-error` 구멍(§CONTEXT)과 정확히 같은 "정적 검사가
  일부 필드만 본다" 형태이지만 축이 다르다(필드가 아니라 **스텝 리스트의 완전성**).
  - 위치: `.claude/tests/test_review_gate_ci.py:372` (docstring 문장), 근거가 되는
    `_NEUTERING_KEYS` 범위 선언은 `.claude/tests/test_review_gate_ci.py:420-423`, 검사 범위가
    "게이트 스텝 자신"으로 국한됨은 `.claude/tests/test_review_gate_ci.py:406-412`
    (`_gate_step_index`)와 `:433`(`step = self.steps[self._gate_step_index()]`)에서 확인.
  - 상세: `WorkflowWiringTest`는 (1) 게이트 스텝의 `run` 정확 일치, (2) 게이트 스텝에
    `if`/`continue-on-error`/`timeout-minutes` 부재, (3) job-level `if` 정확 일치, (4)
    `concurrency` 정확 일치, (5) 게이트 **직전** checkout 의 `fetch-depth: 0`, (6)
    `pull_request.paths` 정확 일치만 고정한다. `self.job["steps"]` 리스트 자체의 개수·순서·
    비검사 스텝의 존재 여부는 어디서도 단언되지 않는다. 그 결과 게이트 스텝보다 **앞선** 임의의
    새 스텝(예: `$GITHUB_PATH` 에 가짜 `python3` 를 선주입)이 통과 대상 필드를 하나도 건드리지
    않고 삽입될 수 있고, 이는 게이트 스텝의 `run:` 문자열이 정확히 유지된 채로 실제 인터프리터를
    바꿔치기해 스크립트를 결코 실행시키지 않는다. "우회할 패턴이 아예 없다"는 문장은 이 축을
    검토하지 않은 상태에서 쓰인 과확신이며, 3R 까지의 "패턴 매칭을 버리고 정확 일치로 전환했다"는
    서사가 실제로는 "검사한 필드에 대해서만 우회가 없다"로 좁혀 읽혀야 함을 감추고 있다.
  - 제안: (a) docstring 의 "우회할 패턴이 아예 없다"를 "검사 대상 필드에 대해서는 우회할 패턴이
    없다"로 낮추거나, (b) `self.steps` 전체를 순서 있는 리스트로 exact-equality 고정(스텝 개수·
    각 스텝의 `name`/`run`/`uses`/`with` 전체를 기대값 리스트와 비교)해 "새 스텝 삽입"이라는
    이번 축 자체를 실제로 닫는다. (b)를 택할 경우 이 발견을 해당 테스트의 새 케이스로 남기고
    (이번 라운드의 `continue-on-error` 사례처럼) `.claude/tests/README.md`
    `test_review_gate_ci.py` 행과 `plan/in-progress/harness-review-gate-ci-backstop.md`에도
    라운드 이력으로 기록할 것.

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md`(이 기능의 SoT plan 문서,
  CLAUDE.md 정보 저장 위치 표 기준)가 "2026-08-01 구현 완료(관측 모드)" 배너 이후의 라운드별
  경화 이력(1R substring 패턴 매칭 우회 → 2R 구조+부분 정규식 우회 → 3R 앵커 없는 정규식 +
  `&& false` 영구 무력화 우회 → `continue-on-error` 구멍 발견/차단)을 전혀 반영하지 않는다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:9-17`(진행 배너 표, 마지막 항목이
    "CI 백스톱 본체: 2026-08-01 구현 완료"에서 멈춤), 파일 끝(316줄, "8번째 재발 관측"으로 종료 —
    이후 라운드 언급 없음). 대응하는 실제 이력은 git log(`2979581ba` 1R, `44844642c` 2R,
    `ad20f1057` 3R)와 `.claude/tests/test_review_gate_ci.py`의 `WorkflowWiringTest`/`OneJudgeTest`
    docstring 에만 존재한다.
  - 상세: 이 저장소의 확립된 관행(`.claude/tests/README.md`의 다른 행들, 예:
    `test_router_safety_policy_doc.py`·`test_router_decision_trust.py` 행)은 라운드별 발견/수정을
    풍부하게 기록하는 것이다. 그런데 이 티켓의 plan 문서는 "구현 완료" 배너 이후 실제로는 최소
    3라운드(그리고 이번 4라운드)의 실질적 하드닝이 있었음에도 그 흔적이 없다 — plan 문서만 읽는
    독자는 이 백스톱이 2026-08-01 이후 안정 상태라고 오인하기 쉽다. 메모리 규약("review/** 는
    SoT 아님 — 미룬 항목은 그 턴에 plan/ 에 적어라")과 같은 이유로, 진행 중 작업의 실제 상태는
    plan 문서에 남아야 한다.
  - 제안: 기존 "2026-08-01 — 본체 구현 완료(관측 모드)" 배너 형식을 따라 "2026-08-0X — 워크플로
    배선 검사 라운드 1~4" 항목을 추가하고, 위 CRITICAL 발견(스텝 리스트 완전성 미검사)이 처리되면
    같은 자리에 이어 기록할 것.

- **[INFO]** `push_blocks = False`/`@property push_blocks` 같은 "실제 인터페이스를 그대로
  비추되 이 소비자는 읽지 않는" 스텁 필드에 대한 설명 주석은 `test_review_gate_ci.py`(예:
  `:178-180`), `test_block_integrity.py`(`:377-380` 부근), `test_stop_guard_failopen.py`(`:47-49`,
  `:55-59`)에 일관되게 잘 남아 있다 — 세 파일 모두 "왜 안 쓰는 필드를 스텁에 남겼는지"를 같은
  근거(#1057 가드)로 설명해 독자가 반복해서 같은 의문을 갖지 않게 한다. 수정 불필요, 좋은 사례로
  기록.

- **[INFO]** `check-review-gate.py`(`:21-27`, "성립하는 이유")와
  `.github/workflows/review-gate.yml`(`:14-18`)과
  `plan/in-progress/harness-review-gate-ci-backstop.md`(§결정이 필요한 지점, 435건 중 80건 표)
  간의 "관측 모드가 기본인 이유" 수치(435 PR 중 80건 미커버, 18%)는 세 문서에서 정확히 일치한다.
  `.claude/tests/README.md:88`의 "measured: 80 of 435"도 동일. 크로스 문서 drift 없음 — 확인만
  하고 넘어감.

- **[INFO]** `.github/workflows/harness-checks.yml`의 `paths:` 목록(`:60`)에
  `scripts/check-review-gate.py`가 명시 등재되어 있고 그 이유(`:58-59`)가 "이 파일만 고친 PR 에서
  harness-checks 가 안 돌면 `test_review_gate_ci.py`가 트리거되지 않는다"로 정확히 설명돼 있다.
  `.github/workflows/review-gate.yml`의 `paths:`(`:24-34`)에도 `review_guard.py`·
  `branch_guard.py`·`check-review-gate.py`·자기 자신이 모두 등재돼 있어 "가드 자신이 바뀌면 가드
  워크플로가 안 돈다" 실패 클래스가 두 워크플로 모두에서 막혀 있다. 이상 없음.

## 요약

문서 자체(README 행, docstring, plan 문서)는 대체로 이 저장소의 높은 수준(실측 수치, 라운드별
실패 이력, 왜-이렇게-설계했는지)을 유지하고 있으나, 이번 라운드가 요구한 실제 뮤테이션 실험에서
`WorkflowWiringTest`의 "우회할 패턴이 아예 없다"는 단언이 반증됐다 — 게이트 스텝 앞에 스텝을
추가해 `python3`를 PATH 상 바꿔치기하면 백스톱을 영구히·조용히 죽이면서 관련 테스트 24개
(`test_review_gate_ci.py` 18 + `test_workflow_yaml_structure.py` 6)가 전부 GREEN 이다. 이는
"필드는 정확 일치로 고정했지만 스텝 리스트의 완전성은 고정하지 않았다"는, 앞서 닫힌
`continue-on-error` 구멍과 형태적으로 동일한 클래스의 새 사례다. 문서화 관점에서 이는 (1) 실제와
어긋난 확신에 찬 주석(주석 정확성 위반, CRITICAL), (2) plan 문서가 이 기능의 라운드별 경화
이력을 반영하지 못해 SoT 로서 낡아 있음(WARNING)으로 요약된다. 나머지 문서(README 카탈로그,
워크플로 배너, 스텁 필드 설명)는 정확하고 일관적이다.

## 위험도

CRITICAL
