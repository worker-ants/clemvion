# 동시성(Concurrency) 리뷰 결과

## 스코프 판단

이 변경(review-gate.yml 신설 CI 백스톱 + check-review-gate.py + 관련 하네스 테스트)에는 스레드/락/async/커넥션 풀 같은 애플리케이션 레벨 동시성 코드가 없다. 단, GitHub Actions 의 `concurrency:`(group + cancel-in-progress) 블록은 동시 실행 제어 그 자체이므로 이 관점의 정당한 대상이다. 판정 스크립트(`scripts/check-review-gate.py`)는 단일 스레드·순차 실행이며 공유 가변 상태를 갖지 않는다. 지시받은 대로 격리된 `mktemp -d`(실제로는 `git clone --local`) 사본에서 이 축을 실제로 뮤테이션해 확인했다 — 절대경로만 사용했고, 실제 워크트리는 `git status`/`git diff` 로 무변경을 확인했다.

## 발견사항

- **[WARNING]** `harness-checks.yml` 자신의 `concurrency:` 블록(값)에 테스트 커버리지가 전혀 없다 — 실측: 뮤테이션 후에도 하네스 스위트 827개 전부 green
  - 위치: `.github/workflows/harness-checks.yml:63-65` (`concurrency: / group: harness-checks-${{ github.ref }} / cancel-in-progress: true`)
  - 상세: 격리 clone 에서 이 3줄을 `group: harness-checks-${{ github.run_id }}` / `cancel-in-progress: false` 로 바꿨다(중복 키 아님, 정상적인 단일 편집). `github.run_id` 는 실행마다 유일하므로 이 값 조합은 사실상 "동시-런 취소"를 완전히 무력화한다 — 같은 PR 에 빠른 연속 푸시가 오면 오래된(스테일) 실행이 취소되지 않고 새 실행과 나란히 쌓인다. 그런데도 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체(827 tests)가 그대로 통과했다. 이유: `review-gate.yml` 은 `test_review_gate_ci.py::WorkflowWiringTest.test_the_whole_workflow_matches_the_expected_wiring`(파일 gate 436-438, `EXPECTED["concurrency"]` gate 399-402)가 파싱된 문서 전체를 리터럴과 정확 일치시켜 `concurrency` 값까지 고정하지만, 이 전체-문서 고정은 **`review-gate.yml` 하나에만** 걸려 있다. `harness-checks.yml`(스위트 자신을 구동하는 바로 그 워크플로)의 `concurrency:` 는 `test_workflow_yaml_structure.py`의 구조적 검사(중복 키 없음 / step 이 `run`·`uses` 정확히 하나 / `continue-on-error` 부재)만 받는데, 이 셋 중 어느 것도 `concurrency` 키의 **값**을 보지 않는다. 재현 명령/결과:
    ```
    $ cd $SCRATCH/repo   # git clone --local 사본, 실제 워크트리 아님
    $ python3 - .github/workflows/harness-checks.yml <<'PY'
    # concurrency 블록을 group: ...run_id / cancel-in-progress: false 로 단일 치환
    PY
    $ python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ...
    Ran 827 tests in 90.673s
    OK
    ```
    이 워크플로는 이번 PR 이 `paths:`(43-45행 부근에 `scripts/check-review-gate.py` 등재)와 헤더 주석만 건드렸을 뿐 `concurrency:` 블록 자체는 이번 diff 대상이 아니다 — 즉 새로 만든 결함이 아니라 기존에 열려 있던 구멍이다. 다만 이번 라운드가 정확히 겨냥해 온 결함 클래스("테스트가 실제로 보지 않는 필드가 조용히 열려 있다")와 같은 모양이고, 지금은 관측 모드라 review-gate.yml 의 차단 판정 자체를 우회하지는 못하지만(harness-checks.yml 은 판정을 내리지 않는 스위트-러너일 뿐), `harness-checks.yml` 이 죽거나 스테일해지면 이 PR 이 새로 심은 `test_review_gate_ci.py`/`test_workflow_yaml_structure.py` 자체가 조용히 덜 신뢰할 수 있는 시점에 도는 위험(빠른 연속 푸시에서 오래된 커밋의 실행이 취소되지 않고 나중에 완료돼, 최신 커밋 검사와 뒤섞여 보일 수 있음)이 남는다.
  - 제안: `test_review_gate_ci.py::WorkflowWiringTest` 가 `review-gate.yml`에 하는 것과 대칭으로, `harness-checks.yml`의 `concurrency` 필드(`group`/`cancel-in-progress`) 값을 최소한 하나의 단언으로 고정한다 — 전체 문서까지 갈 필요는 없고 `doc["concurrency"] == {"group": "harness-checks-${{ github.ref }}", "cancel-in-progress": True}` 한 줄이면 이번에 실측한 우회는 닫힌다. 나머지 워크플로(e2e.yml 등)도 같은 패턴이라 저장소 전역 이슈지만, 이 PR 이 `harness-checks.yml` 을 직접 건드렸고 그 워크플로가 이번 라운드가 심은 가드들을 구동하는 워크플로라는 점에서 지금 닫는 것이 싸다.

- **[INFO]** `review-gate.yml`의 전체-문서 정확일치(`WorkflowWiringTest`)는 `concurrency` 필드에 대해서도 "판정자가 하나" 만큼 완결적으로 보이지만, **최상위 키 중복**(같은 매핑 안에 `concurrency:`를 두 번 쓰는 형태)에는 그 자체로는 무력하고 이웃 파일의 방어에 암묵 의존 — 실측했고 실제로는 스위트 전체 기준으로는 안전
  - 위치: `.claude/tests/test_review_gate_ci.py:436-438`(`test_the_whole_workflow_matches_the_expected_wiring`), 관련 EXPECTED 리터럴: 같은 파일 gate 399-402. 실제 방어선은 별도 파일 `.claude/tests/test_workflow_yaml_structure.py`(`WorkflowStructureTest.test_no_duplicate_keys`).
  - 상세: 격리 clone 에서 `review-gate.yml`의 `name: review-gate` 바로 뒤에 `concurrency: group: review-gate-${{ github.run_id }} / cancel-in-progress: false` 를 **먼저**(중복) 삽입하고 기존 진짜 블록은 그대로 뒤에 남겼다. PyYAML 은 중복 매핑 키에서 "나중 값이 이긴다" 이므로 `WorkflowWiringTest.setUp`이 읽는 `self.doc["concurrency"]`는 여전히 뒤(진짜) 블록이 되어 `test_the_whole_workflow_matches_the_expected_wiring`은 **통과**했다(즉 이 테스트만으로는 이 뮤테이션을 못 잡는다). 반면 같은 파일 세트를 도는 `test_workflow_yaml_structure.py::WorkflowStructureTest.test_no_duplicate_keys` 는 `line 39: 'concurrency'` 로 정확히 실패했다:
    ```
    FAIL: test_no_duplicate_keys ... (workflow='review-gate.yml')
    AssertionError: Lists differ: ["line 39: 'concurrency'"] != []
    ```
    둘 다 `harness-checks.yml`의 같은 `unittest discover` 스텝에서 돌기 때문에 스위트 전체 기준으로는 이 뮤테이션이 걸린다 — 실사용 상 열린 구멍은 아니다. 다만 `WorkflowWiringTest`의 docstring("이 한 줄이 위 네 라운드의 우회를 전부 덮는다")은 이 다섯 번째 클래스(키 중복 스머글링)를 언급하지 않고, 그 안전성이 실은 이웃 파일 하나에 걸려 있다는 사실도 이 파일 안에는 적혀 있지 않다 — 이 저장소 자신의 README 가 반복 지적하는 "손-동기 쌍은 드리프트한다" 패턴과 같은 모양(한쪽이 조용히 바뀌면 다른 쪽의 암묵 전제가 깨진다)이다. GitHub Actions 자신의 워크플로 파서가 중복 최상위 키에 대해 PyYAML 과 같은 "나중 값이 이긴다" 의미론을 쓰는지는 실제 Actions 러너 없이는 확인할 수 없다(과제에서 명시한 측정 불가 항목 (b)와 같은 성격의 한계).
  - 제안: 기능 변경은 불필요(이미 저장소 전역 가드로 막혀 있음). `WorkflowWiringTest`의 docstring 에 "중복 키 방어는 `test_workflow_yaml_structure.py`가 담당한다"는 한 줄 상호 참조만 추가해, 이 파일이 스스로 하지 않는 보장을 암묵적으로 주장하지 않게 하면 충분하다.

- **[INFO]** (긍정 확인, 조치 불필요) 스레드/asyncio/subprocess 기반의 "숨은 제2 판정자" 경쟁 공격은 `OneJudgeTest`의 import 허용목록으로 이미 구조적으로 닫혀 있다
  - 위치: `.claude/tests/test_review_gate_ci.py:239`(`_ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}`)
  - 상세: `check-review-gate.py`에 `threading`/`asyncio`/`multiprocessing`/`subprocess`를 import 해 판정을 병렬로 재계산·경합시키려는 시도는 이 허용목록에 없는 import 하나로 즉시 `test_the_import_and_call_surface_stays_small`을 위반한다. 4R 문서가 정리한 "호출 축은 여전히 금지 목록"이라는 잔여 취약점은 이번 라운드에서 호출 축까지 허용목록으로 뒤집혀 있어(gate 240-246 `_ALLOWED_CALLS`), 새 동시성 프리미티브 도입 경로는 열려 있지 않다. 별도 뮤테이션 없이 정적으로 확인 가능한 만큼만 기록.

## 요약

애플리케이션 레벨 동시성(락/스레드/async/커넥션 풀)은 이 변경에 없고, `check-review-gate.py`는 완전히 순차적이며 하네스 테스트들도 테스트마다 격리된 `tempfile.mkdtemp()` 사본을 써서 병렬 실행 시에도 경합 여지가 없다. 유일한 실질적 동시성 표면은 GitHub Actions 의 `concurrency:`(group/cancel-in-progress) 제어다. `review-gate.yml` 쪽은 전체-문서 정확일치(`WorkflowWiringTest`) 덕에 값 뮤테이션에는 강하지만, 최상위 키 **중복**에는 그 자체로 무력하고 이웃 파일(`test_workflow_yaml_structure.py`)의 저장소 전역 중복-키 탐지에 암묵 의존한다는 것을 뮤테이션으로 확인했다(스위트 전체 기준으로는 안전, 문서화 갭만 남음). 더 실질적인 것은 이번 PR 이 함께 건드린 `harness-checks.yml` 자신의 `concurrency:` 블록으로, 그 값에는 어떤 테스트도 없어 `cancel-in-progress`를 끄고 `group`을 실행마다 유일하게 바꿔도 하네스 스위트 827개 전부가 green 으로 남는 것을 격리된 clone 에서 직접 재현했다 — 관측 모드인 지금은 review-gate.yml 의 차단 판정 자체를 우회하지 못하지만, 이번 라운드가 정확히 겨냥해 온 "테스트가 보지 않는 필드" 결함 클래스와 같은 모양이라 조치를 권한다. 스레드/subprocess 기반 제2 판정자 경쟁 공격 경로는 import/호출 허용목록으로 이미 구조적으로 닫혀 있음을 확인했다.

## 위험도

MEDIUM
