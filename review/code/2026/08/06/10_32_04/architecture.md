# 아키텍처(Architecture) 리뷰 — CI 백스톱 4R

## 실증 작업 (조사 기록)

라운드 CONTEXT 지시대로 "테스트를 전부 GREEN 으로 둔 채 SHIPPED BEHAVIOUR 를 바꿀 수 있는가" 를
직접 검증했다. 저장소 워킹트리는 건드리지 않고 `mktemp -d` 격리 디렉토리에서 작업했다.

**가설**: `WorkflowWiringTest` 의 `_NEUTERING_KEYS = ("if", "continue-on-error", "timeout-minutes")`
검사는 **게이트 step 딕셔너리**에만 적용된다(`.claude/tests/test_review_gate_ci.py:420-438`). 그런데
GitHub Actions 는 `continue-on-error` 를 **job 레벨**에서도 지원한다
(`jobs.<job_id>.continue-on-error` — job 이 실패해도 워크플로 실행을 실패로 만들지 않음). job 딕셔너리
자체는 `self.job.get("if", "")` 딱 하나만 검사되고(`:443`), 그 외 키 집합은 어디서도 닫힌 목록으로
검증되지 않는다. 즉 **step 대신 job 에 같은 키를 붙이면 같은 결과(백스톱을 조용히 무력화)를 내면서
검사망을 그대로 피해 간다**.

**실행 명령과 출력**:

```bash
$ WORK=$(mktemp -d)
$ git clone --quiet --no-hardlinks /Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379 "$WORK/clone"
$ python3 - "$WORK/clone/.github/workflows/review-gate.yml" <<'PYEOF'
import sys, io
path = sys.argv[1]
text = io.open(path, encoding="utf-8").read()
marker = "  gate:\n    runs-on: ubuntu-latest\n"
injected = "  gate:\n    runs-on: ubuntu-latest\n    # injected mutation\n    continue-on-error: true\n"
io.open(path, "w", encoding="utf-8").write(text.replace(marker, injected, 1))
PYEOF
$ cd "$WORK/clone"
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
```

출력(발췌, 전부 `ok`):
```
test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed (...) ... ok
test_the_gate_step_runs_exactly_the_expected_command (...) ... ok
test_the_job_condition_is_exactly_the_bot_exemption (...) ... ok
test_the_checkout_before_the_gate_fetches_full_history (...) ... ok
test_trigger_paths_are_exactly_the_expected_set (...) ... ok
test_concurrency_is_pinned (...) ... ok
test_it_is_still_observation_only (...) ... ok
----------------------------------------------------------------------
Ran 18 tests in 2.960s

OK
```

전체 하네스 스위트(`.claude/tests` 830건, `test_workflow_yaml_structure.py` 의 구조적 중복키
검사 포함)도 같은 mutation 위에서 재실행:

```bash
$ python3 -m unittest discover -s .claude/tests -p 'test_*.py'
...
Ran 830 tests in 97.203s

OK
```

**결과: mutation 이 적용된 채로 830/830 GREEN.** `continue-on-error: true` 는 유효한 YAML 이고
중복 키를 만들지 않으므로 `test_workflow_yaml_structure.py` 도 통과하고, run 문자열·`if:`·경로·
concurrency 는 전혀 건드리지 않았으므로 `WorkflowWiringTest` 의 7개 단언도 전부 통과한다.

실 저장소는 원본 그대로임을 확인:
```bash
$ grep -n "continue-on-error" .github/workflows/review-gate.yml
(no output — 실 파일 미변경)
$ git status --porcelain
?? review/code/2026/08/06/   (본 리뷰 산출물만)
```
scratch 디렉토리는 작업 종료 후 `rm -rf` 로 정리했다.

**의미**: `--enforce` 로 뒤집는 순간(이 티켓의 다음 단계로 이미 계획돼 있다) job 에
`continue-on-error: true` 한 줄이 섞여 들어오면 게이트 스크립트는 정상적으로 exit 1 을 내고 로그에
"미커버" 를 찍지만, GitHub 는 그 job/필수 체크를 **성공/중립**으로 보고하므로 PR 은 그대로 머지
가능해진다 — 3R 에서 닫은 `&& false` 구멍과 정확히 같은 등급(백스톱이 모든 PR 에서 영구히,
조용히 꺼짐)의 결함이며, 그것을 막기 위해 설계된 스위트 자신이 이를 검출하지 못한다.

---

## 발견사항

- **[CRITICAL]** `WorkflowWiringTest` 의 "step 이 실패를 못 내게 만드는 키" 방어가 **step 레벨에만**
  적용되고, 같은 키가 **job 레벨**에서도 같은 효과(job 실패를 워크플로 실패로 전파하지 않음)를 낸다는
  사실이 검사 범위 밖에 있다. 위 실증대로 `jobs.gate.continue-on-error: true` 를 추가하면
  `test_review_gate_ci.py` 18건 + 하네스 전체 830건이 GREEN 을 유지한 채 백스톱의 차단 능력이
  무력화된다.
  - 위치: `.claude/tests/test_review_gate_ci.py:400-406`(`setUp` — `self.job` 을 `"if"` 하나만
    검사하고 나머지 키 집합은 열린 채로 둔다), `:420-438`(`_NEUTERING_KEYS` / 검사 대상이
    `self.steps[idx]` 뿐), `:440-443`(`test_the_job_condition_is_exactly_the_bot_exemption` —
    job 딕셔너리에 대한 유일한 단언).
  - 상세: `_NEUTERING_KEYS` 는 "3R 에서 실측으로 뚫린 step 속성" 을 나열한 블랙리스트를 다시
    한번 반전(화이트리스트화)했다고 스스로 주장하지만, 실제로는 **"step 딕셔너리 안의 세 키" 라는
    좁은 스코프에 한정된 화이트리스트**다. job 딕셔너리 전체에 대해서는 여전히 `if` 하나만 보는
    구식 블랙리스트(사실상 "이 키만 검사한다")로 남아 있어, 두 검사 방식이 같은 파일 안에서
    비대칭이다. 이 비대칭이 바로 실증된 우회를 가능하게 한다.
  - 제안: `OneJudgeTest`(같은 파일, `_ALLOWED_IMPORTS`/`_ALLOWED_CALLS`, `:239-246`)에 이미 적용된
    "닫힌 허용 목록" 패턴을 job 딕셔너리에도 대칭적으로 적용한다 — 예:
    `self.assertLessEqual(set(self.job) - {"steps"}, {"runs-on", "timeout-minutes", "if"})` 같은
    **job 키 집합 자체에 대한 닫힌 assertion**을 추가하고, 새 키가 필요해지면 저자가 그 자리에서
    "이게 게이트를 끄는 변경인가" 를 판단하게 만든다. `_NEUTERING_KEYS` 순회도 `step` 뿐 아니라
    `self.job` 에 대해서도 반복해, 두 스코프가 같은 방어를 받도록 통일할 것.

- **[WARNING]** `evaluate_review()` 반환값(`ReviewDecision`)의 계약이 세 소비자
  (`guard_review_before_push.py`, `guard_review_before_stop.py`, `scripts/check-review-gate.py`)에
  걸쳐 **덕타이핑으로만** 공유되고, 이를 명시하는 공통 인터페이스(예: `typing.Protocol`)가 없다.
  - 위치: `.claude/hooks/_lib/review_guard.py:182-203`(`ReviewDecision` — `blocked`/`reason`/
    `notes`/`push_blocks` 정의) vs `scripts/check-review-gate.py:100-102`(`getattr(decision,
    "notes", ()) or ()`, `decision.blocked`, `decision.reason` — 직접 속성 접근, `push_blocks` 는
    아예 읽지 않음).
  - 상세: `test_review_gate_ci.py`(`:181-187` 부근 stub, "`push_blocks` 는 이 소비자가 읽지 않지만
    실제 `ReviewDecision` 에는 있다. 스텁이 진짜 인터페이스를 그대로 비추게 두는 편이 ... 싸다") 와
    `test_stop_guard_failopen.py:46-51` 이 각자 손으로 같은 모양의 스텁 클래스를 복제하고 있다.
    이는 의도적으로 감수한 비용(주석에 명시)이지만, `ReviewDecision` 의 속성이 늘거나 이름이
    바뀔 때 이를 정적으로 강제할 장치가 없어 드리프트는 순전히 사람의 규율(주석 + 스텁 갱신)에
    의존한다. `_shared/report_paths.py`·`_shared/retry_state.py` 로 두 번 겪은 "두 번째 구현이
    갈리는" 실패 클래스와 뿌리가 같다 — 다만 이번엔 구현이 아니라 **계약의 형식화 부재**다.
  - 제안: `_shared/` 에 `class ReviewDecisionLike(Protocol): blocked: bool; reason: str; notes:
    tuple[str, ...]` 를 두고 세 소비자와 스텁이 이를 참조하도록 하면, mypy/pyright 를 붙이는 시점에
    즉시 드리프트를 잡을 수 있다. 지금 당장 급한 것은 아니며(테스트가 행위로 이미 커버), 다음
    `ReviewDecision` 필드 변경 시점에 검토할 항목으로 남긴다.

- **[INFO]** 레이어링 자체는 이번 라운드에서 견고하다: `scripts/check-review-gate.py` 는 판정
  로직을 재구현하지 않고 `review_guard.evaluate_review()` 를 그대로 호출하는 얇은 어댑터로
  남아 있고(`OneJudgeTest`/`VerdictComesFromTheGateTest` 가 이를 행위로 고정), 트리거(GitHub PR
  이벤트) ↔ 정책(`evaluate_review`) ↔ 배선(워크플로 YAML)의 3계층 분리가 문서(`plan/in-progress/
  harness-review-gate-ci-backstop.md` "판정자는 하나다" 절, `scripts/check-review-gate.py:1-47`
  모듈 docstring)와 코드 양쪽에서 일관되게 유지된다. 이 설계 원칙 자체는 위 CRITICAL 발견의
  원인이 아니다 — 원인은 그 원칙을 지키는 **테스트의 검사 스코프**가 비대칭이라는 점뿐이다.

## 요약

핵심 아키텍처 원칙("판정자는 하나, 트리거만 훅과 독립") 은 코드·문서 양쪽에서 일관되게 지켜지고
있고, `check-review-gate.py` 는 정책을 재구현하지 않는 얇은 어댑터로 잘 절제돼 있다. 다만 3R 에서
"블랙리스트는 상상력만큼만 강하다" 는 결론에 도달해 `OneJudgeTest`(import/call 표면)와
`WorkflowWiringTest`(워크플로 배선)를 화이트리스트/정확일치로 전환했는데, 그 전환이 **워크플로
YAML 의 모든 레벨에 대칭으로 적용되지 못했다** — step 딕셔너리는 닫힌 검사를 받지만 job 딕셔너리는
`if` 하나만 열려 있다. 실제로 `jobs.gate.continue-on-error: true` 를 주입해 하네스 스위트 830건
전체가 GREEN 을 유지한 채 백스톱의 차단력이 무력화됨을 격리 환경에서 직접 재현했다(위 실증 참조).
이는 라운드 CONTEXT 가 예고한 "같은 모양의 구멍이 더 있을 것" 에 정확히 해당하는 사례이며, 수정은
국소적이다(job 키 집합에도 닫힌 assertion 하나 추가). 부차적으로 `ReviewDecision` 계약이 세 곳에서
덕타이핑으로만 공유되는 점은 낮은 우선순위의 구조적 부채로 남긴다.

## 위험도

CRITICAL
