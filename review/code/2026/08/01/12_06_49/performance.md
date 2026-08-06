# 성능(Performance) Review

## 사전 경고 — 작업 트리가 리뷰 도중 일시적으로 변경돼 있었다 (수정하지 않고 보고, 이후 자체 해소됨)

리뷰 도중 `git status`/`git diff` 를 뜬 한 시점에 `scripts/check-review-gate.py` 가
**작업 트리에서 수정된 상태**로 관찰됐다(커밋되지 않음):

```
 M scripts/check-review-gate.py
```

diff (그 시점 관찰):
```python
+# control case: local Name-to-Name alias of a disallowed call
+join = os.walk
+join('review')
```

이것은 라운드 3 프롬프트가 명시적으로 경고한 "라운드 2에서 여섯 명이 관찰한 소스 파일
mid-review 변경"과 정확히 같은 패턴이다(다른 리뷰어가 `OneJudgeTest` 의 로컬-별칭 우회를
mutation 실험으로 작업 트리에 직접 넣은 것으로 추정). 지시에 따라 **그 자리에서 원복하지
않고** 그대로 보고했다. 이후 실험은 이 오염 가능성이 있는 작업 트리가 아니라 `git archive
HEAD` 로 만든 **클린 사본**에서 수행했다(`diff <(git show HEAD:scripts/check-review-gate.py)
<clean-copy>` → `clean copy matches HEAD (no contamination)` 로 클린함을 먼저 확인).

**후속 확인 (리포트 마무리 시점)**: 같은 파일에 대해 다시 `git status`/`git diff` 를 떠 보니
**이제 깨끗하다**(`nothing added to commit but untracked files present` — `scripts/` 아래
변경 없음). 즉 위 변경은 이 리포트 작성 도중 다른 프로세스가 넣었다가 스스로 되돌린
**일시적** 상태였다. 고쳐야 할 대상이 남아 있지는 않지만, "다른 세션/에이전트가 같은
작업 트리를 동시에 mutation 실험 중" 이라는 사실 자체가 라운드 2 에서 이미 문제였던 패턴이
라운드 3 에서도 완전히 사라지지 않았다는 신호라 기록해 둔다.

## 발견사항

- **[WARNING]** CI 백스톱의 유일 판정 호출에 "정확히 1회 호출" 을 지키는 테스트가 전혀 없다 — 판정자를 두 번 부르는 값싼 회귀가 조용히 통과한다
  - 위치: `scripts/check-review-gate.py:97` (`decision = evaluate(root)`), 회귀를 잡아야 할 테스트 스위트는 `.claude/tests/test_review_gate_ci.py` (`OneJudgeTest`, `ReviewGateCliTest` 전체 15건)
  - 상세: `evaluate_review()` 는 가벼운 함수가 아니다 — `.claude/hooks/_lib/review_guard.py:942` 부터: `_repo_root`/`_default_branch`/`_merge_base`/`_committed_code_changes`/`_uncommitted_code_changes`/`_dirty_set` 등 **여러 개의 `git` 서브프로세스 호출**과, `_newest_resolved_review_mtime` 이 수행하는 `review/` 트리 전체 mtime 스캔(이 저장소는 `review/code` 아래만 8,851개, `review/` 전체 14,517개 — plan 파일 자기 실측치)을 포함한다. `check-review-gate.py` 는 `codebase/**` 를 건드리는 **모든 PR** 에서 이 판정을 정확히 한 번 호출하도록 설계돼 있다(스크립트 자신의 주석: "판정자는 하나다"). 그런데 그 "하나" 를 지키는 것은 `OneJudgeTest` 의 **import/호출 이름 허용목록**뿐이고, `evaluate`(허용된 호출명)를 **몇 번** 부르는지는 어디에서도 세지 않는다. 실제로 검증했다: `evaluate(root)` 를 한 줄 더 추가해 두 번 호출하도록 만든 클린 사본에 대해 `test_review_gate_ci.py` 의 15개 테스트를 전부 실행한 결과 **15/15 GREEN**(아래 "실행 로그" 참조). `OneJudgeTest` 는 허용된 호출 이름의 **집합**만 비교하므로 같은 이름이 두 번 나와도 걸리지 않고, 기능 테스트들은 `decision`/`notes`/`blocked`/`reason` 의 **최종 값**만 보므로 순수 함수를 두 번 불러도 값이 같아 통과한다. 즉 "판정자가 하나다" 라는 이 층의 핵심 불변식은 **로직이 두 번 도는 것**까지는 막지 못한다 — 이는 매 PR 마다 git 서브프로세스 스폰 횟수와 `review/` 트리 스캔 횟수를 두 배로 만드는 조용한 CI 비용 회귀다(리팩터·"안전을 위해 재확인" 같은 동기로 실수 삽입되기 쉬운 형태).
  - 제안: `OneJudgeTest` 나 별도 테스트에 "`evaluate` 호출은 정확히 1회" 를 pin 하는 assertion 을 추가한다(예: 스텁 게이트에서 호출 카운터를 증가시켜 `assertEqual(count, 1)`, 또는 AST 레벨에서 `evaluate(...)` 호출 노드가 정확히 1개인지 확인). 비용이 낮고, 지금처럼 "함수 이름 집합" 만 보는 가드가 자연스럽게 놓치는 축이다.

  **재현 실험 (실제로 실행한 것과 출력)**
  1. 오염 확인: `diff <(git show HEAD:scripts/check-review-gate.py) <clean-copy>` → `clean copy matches HEAD (no contamination)`.
  2. `git archive HEAD | tar -x -C <scratch>/repo_clean` 로 클린 사본 생성.
  3. `<scratch>/repo_clean/scripts/check-review-gate.py` 의 `try:` 블록에 `decision = evaluate(root)` 한 줄만 중복 추가(2회 호출).
  4. `test_review_gate_ci` 모듈을 import 하고 `mod.SCRIPT` 를 이 뮤턴트 경로로 monkeypatch 한 뒤 `unittest` 로 15개 테스트 전부 실행:
     ```
     Ran 15 tests in 3.678s
     OK
     FAILURES: 0 ERRORS: 0
     ```
     (`OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own` 포함 — GREEN.)

- **[INFO]** `review-gate.yml` 은 `codebase/**` 를 건드리는 모든 PR push 마다 전체 히스토리(`fetch-depth: 0`)를 새로 체크아웃한다 — 형제 워크플로와 비대칭
  - 위치: `.github/workflows/review-gate.yml:56-57` (`with: fetch-depth: 0`)
  - 상세: 이 저장소의 `.git` 은 (worktree 공통 디렉터리 기준) **143MB, 2,364 커밋**(`git count-objects -v`/`git rev-list --count HEAD` 실측). `harness-checks.yml` 은 같은 트리거 조건(codebase 변경 등)에서 `actions/checkout@v7` 를 기본값(얕은 클론)으로 쓰는데, `review-gate.yml` 만 `fetch-depth: 0` 을 요구한다. 파일 자체 주석이 근거를 밝히고 있다 — merge-base 산정과 author-date 신선도 판정에 전체 히스토리가 필요하다는 것 — 이므로 **버그는 아니다**. 다만 `concurrency: cancel-in-progress` 로 같은 브랜치의 이전 실행은 취소되지만, 서로 다른 브랜치의 PR 이 동시에 `codebase/**` 를 건드리면 매번 전체 클론 비용이 반복되고, 이 비용은 히스토리가 자랄수록(현재도 2,364 커밋) 계속 커진다. `harness-checks.yml` 이 이미 여섯 번 겪은 "이 로직을 건드린 PR 에서 이 워크플로가 안 돈다" 실패 클래스를 막으려고 트리거 폭을 넓혀 둔 것과 맞물려, 두 워크플로가 같은 PR 에서 동시에 도는 경우가 흔할 것이므로 누적 CI 분(시간) 비용으로 체감된다.
  - 제안: 지금 당장 고칠 문제는 아니다(정확성이 우선). 다만 실측(`--enforce` 전환 판단을 위해 결과를 CI 에 쌓는 이 티켓 자체의 계획과 맞물려) 히스토리가 더 자라면 `fetch-depth` 를 "base 커밋 + 여유분" 수준으로 유한하게 주는 대안(예: `fetch-depth: <N>` + 실패 시 `git fetch --deepen` 폴백)을 검토할 여지를 남겨 둔다.

- **[INFO]** 이번 라운드가 추가한 3개 테스트 파일이 harness 자기-테스트 스위트에 "디렉터리 전체 복사 + 서브프로세스 스폰" 을 테스트당 반복하는 패턴을 상당수 더한다
  - 위치: `.claude/tests/test_stop_guard_failopen.py:66-70`(`StopGuardFailOpenTest.setUp` — 테스트 메서드 16개, 각각 `shutil.copytree(HOOKS_DIR, self.hooks)` 로 `.claude/hooks` 전체를 복사한 뒤 1~3회 파이썬 서브프로세스 실행), `.claude/tests/test_review_gate_ci.py:41-56`(`ReviewGateCliTest.setUp` — 테스트 메서드 약 10개, 각각 `hooks/`+`_shared/` 두 디렉터리 복사 + `git init`/`git commit --allow-empty` 서브프로세스 2회 + 실제 스크립트 서브프로세스 1~2회), `.claude/tests/test_block_integrity.py`(`NotesReachBothHooksTest._hook_env` — 테스트 2건에서 각각 hooks 디렉터리 전체 복사).
  - 상세: 개별 테스트는 전부 수 ms~수십 ms 수준이라 문제가 되는 규모는 아니고, `.claude/tests/README.md` 의 "Conventions for new tests"(git-backed helper 를 mock 하는 것이 기본, 진짜 git 시맨틱을 검증할 때만 real temp repo 예외)와도 부합하는 의도된 격리 전략이다 — 이 자체를 결함으로 보진 않는다. 다만 이 스위트는 이미 27개 이상의 `test_*.py` 로 커졌고(`test_tests_readme_catalog.py` 가 그 사실 자체를 pin), 이번 3개 파일만으로 신규 서브프로세스 스폰이 30회 이상 추가된다. `harness-checks.yml` 의 job 타임아웃은 5분으로 고정돼 있는데, 테스트가 늘어날 때마다 "격리를 위해 매번 새 디렉터리를 통째로 복사" 하는 패턴이 반복되면 그 5분 예산을 갉아먹는 방향으로만 누적된다.
  - 제안: 지금 조치가 필요하진 않지만, 스위트가 더 커지면 클래스 단위로 base fixture 를 1회만 만들고(`setUpClass`) 테스트별로 바뀌는 1~2개 파일만 덮어쓰는 방식으로 디렉터리 복사 횟수를 테스트 수에 비례하지 않게 줄일 수 있다는 점을 남겨 둔다.

- **[INFO]** (참고, 재발견 아님) plan 문서가 이미 자기-보고한 I/O 회귀 — `code_review_orchestrator.py` 의 `_rank_plan_text` 이중 read
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` §후속 항목 7 (gate 66-71행)
  - 상세: 이번 diff 8개 파일에는 포함돼 있지 않은 다른 파일(`code_review_orchestrator.py`)에 대한 이야기지만, 리뷰 대상인 plan 문서 안에 "이번 PR 이 도입한 I/O 회귀" 로 명시돼 있어 짚어 둔다. `collect_context` 가 랭킹 신호용으로 `plan/in-progress/` 를 한 번 읽고 `format_file_bundle` 이 같은 디렉터리를 처음부터 다시 읽어 세션당 I/O 가 2배가 된다 — 저자 자신의 실측으로는 30개 파일 430,929 bytes 기준 약 3.5ms 로 현재는 무해하며, `{path: text}` 맵을 한 번만 만들어 재사용하는 처방과 함께 다음 라운드로 defer 하기로 이미 결정돼 있다. 새로운 지적이 아니라 이미 측정·기록·연기된 항목이라는 점만 확인한다.

- **검증했지만 문제 없음으로 판명 — ReDoS/복잡도 가드 자체는 시도한 값싼 뮤턴트에 견뎠다**
  - 대상: `.claude/_shared/block_integrity.py` 의 `_BLOCK_AT_LINE_END`/`_BLOCK_AT_LINE_START` 를 `VerdictParserStaysLinearTest`(`test_block_integrity.py`)가 지키는 "이 정규식은 적대적 입력에서도 선형" 이라는 성질에 대해, 트레일링 그룹만 과거의 버그 형태(`[ \t*]*$` → `\s*$`)로 되돌리는 값싼 뮤턴트를 실제로 만들어 봤다.
  - 실행: 클린 사본(`block_integrity_mut1.py`)에서 `_BLOCK_AT_LINE_END` 를 `r"BLOCK:\s*(YES|NO)\s*$"` 로 바꾼 뒤, (a) 기존 두 회귀 테스트가 쓰는 정확히 같은 두 입력, (b) 그 변경 지점을 직접 겨냥한 추가 입력들(많은 수의 실제 매치 뒤에 공백/개행이 이어지는 여러 변형, n=2000~16000, k=5000~40000)로 `summary_block_verdict` 를 직접 호출해 타이밍을 쟀다.
  - 출력(발췌):
    ```
    existing-test1 (no BLOCK:, 20000 lines): 0.0020s got=None len=140000
    existing-test2 (BLOCK: + 45000 spaces): 0.0018s got=None len=45006
    many-matches n=16000: 0.0031s got='YES' len=496000
    trailing-blank-lines k=40000: 0.0001s got='YES' len=40010
    interleaved n=16000: 0.0026s got='YES' len=320000
    ```
  - 결론: 이 특정 뮤턴트는 기존 두 테스트를 GREEN 으로 통과시키긴 하지만(그 자체는 맞음), 실제로 다시 측정해 보면 **어느 입력에서도 이차식/지수 폭증이 재현되지 않았다** — 즉 이건 "테스트가 놓친 회귀" 가 아니라 애초에 회귀가 아니다(트레일링 하나짜리 `\s*$` 뒤에 후속 토큰이 없어 역추적이 O(1)~O(k) 로 끝나는 구조이기 때문). `_MAX_GLOB_WILDCARDS`/`SpecGlobCompilationIsBoundedTest` 도 같은 이유로 재검토했으나(캡=6, 테스트 입력=24개 `*`) 캡을 지금보다 높이거나 없애는 방향의 뮤턴트는 실측 테이블(k=16 에서 10초)상 5초 타임아웃에 확실히 걸려 테스트가 여전히 잡아낸다 — 이 두 성능 가드는 시도한 범위 안에서는 견고했다.

## 요약

이번 diff(CI 리뷰 게이트 백스톱)는 판정 로직 자체를 재구현하지 않고 기존 `evaluate_review()` 에 위임하는 얇은 스크립트라 알고리즘적으로 새로운 위험은 크지 않다. 다만 "판정자는 하나다" 라는 핵심 성질을 지키는 `OneJudgeTest` 가 **호출 이름의 집합**만 보고 **호출 횟수**는 보지 않아, 값이 아니라 비용만 두 배로 만드는 회귀(중복 `evaluate()` 호출)를 실측으로 통과시켰다 — git 서브프로세스와 `review/` 트리 전체 스캔을 매 PR 마다 두 배로 만들 수 있는 조용한 CI 비용 구멍이다. 그 외에는 `review-gate.yml` 의 전체 히스토리 체크아웃(설계상 필요, 다만 반복 비용)과 신규 테스트들의 디렉터리 복사/서브프로세스 누적이 경미한 INFO 수준으로 남고, `block_integrity.py` 의 두 ReDoS/복잡도 가드는 직접 시도한 값싼 뮤턴트들에 견뎌 냈다(빈 손이 아니라 실측으로 확인). 별도로, 리뷰 도중 작업 트리에 일시적으로 커밋되지 않은 변경(`scripts/check-review-gate.py` 에 `os.walk` 별칭 호출 삽입)이 관찰됐다가 리포트 마무리 시점에는 스스로 사라져 있어(다른 세션의 mutation 실험으로 추정), 수정 없이 관찰 사실만 기록한다.

## 위험도
LOW
