# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** (검증됨, 해소 확인) 1R WARNING — CI 백스톱의 세 번째 `evaluate_review()` 호출부가 `in_flight_ok` opt-in 불변식 회귀에 무방비였던 결함은 이번 라운드에서 실제로 닫혔다.
  - 위치: `.claude/tests/test_review_gate_ci.py:124` (`test_an_unfinished_review_session_does_not_open_the_gate`), 대상은 `scripts/check-review-gate.py:90` (`decision = evaluate(root)`).
  - 상세: 1R 은 "`meta.json` 만 있고 `SUMMARY.md` 는 없는" in-flight 세션 상태를 어떤 테스트도 구성하지 않아, `evaluate(root)` 가 미래에 `evaluate(root, in_flight_ok=True)` 로 바뀌어도 13개 테스트 전부가 green 을 유지함을 스크래치 repo 실측으로 보였다. 이번 라운드는 정확히 그 상태(fresh timestamp 의 `meta.json`-only 세션)를 커밋해 `--enforce` 에서도 exit 1 을 요구하는 테스트를 추가했다. **직접 재현**: `scripts/check-review-gate.py:90` 을 `decision = evaluate(root, in_flight_ok=True)` 로 워크트리에서 실제로 mutate 하고 `python3 -m unittest discover -p 'test_review_gate_ci.py' -k test_an_unfinished_review_session_does_not_open_the_gate` 실행 → `AssertionError: 0 != 1 : 진행 중인 리뷰 세션이 게이트를 열었다 — in_flight_ok 회귀` 로 즉시 FAIL. mutate 후 원본으로 복원, `git status --short scripts/check-review-gate.py` 로 무변경 확인, 전체 15개 테스트 재실행해 green 확인. 이 클래스의 회귀는 이제 실제로 잡힌다.
  - 제안: 없음 — 이미 처리됨. 새 결함 아님, 참고용 기록.

- **[INFO]** 1R 에서 지적한 대로, `review-gate.yml` 의 `concurrency:`(중복 실행 취소) 블록을 고정하는 회귀 테스트는 이번 라운드에도 추가되지 않았다.
  - 위치: `.github/workflows/review-gate.yml:36-38` (`group: review-gate-${{ github.ref }}` / `cancel-in-progress: true`). 대응하는 `WorkflowWiringTest`(`.claude/tests/test_review_gate_ci.py:290`)의 개별 테스트들은 스크립트 실행·dependabot 면제(`test_the_job_condition_exempts_dependabot:334`)·`fetch-depth: 0`·트리거 paths·관측 모드 유지는 각각 구조 기반으로 대조하지만 `concurrency:` 블록만 어떤 테스트도 참조하지 않는다.
  - 상세: 실제로 이 라운드의 diff(`.claude/tests/test_review_gate_ci.py` 의 uncommitted 변경)를 `git diff`로 대조해 이 블록이 손대지 않은 채임을 확인했다. 이 키가 사라져도 개별 실행의 정확성에는 영향이 없다(각 실행은 checkout 시점 커밋 기준으로 여전히 옳게 판정한다) — 실패 모드는 오탐/오차단이 아니라 같은 PR 에 짧은 간격으로 여러 커밋이 밀릴 때 오래된 실행이 취소되지 않고 쌓여 러너 큐를 낭비하는 것뿐이라 심각도가 낮다. `harness-checks.yml` 과 그룹 키 프리픽스가 달라(`harness-checks-` vs `review-gate-`) 두 워크플로가 서로를 취소하지 않는 것도 재확인했다.
  - 제안: 낮은 우선순위 유지. 고정하려면 `WorkflowWiringTest` 에 `self.assertIn("cancel-in-progress: true", self.text)` 한 줄이면 충분(현재 `self.text` 필드가 이미 `setUp` 에서 원문을 들고 있다).

## 검증한 것과 방법

- 6개 파일(README, 신규 CI 테스트, `harness-checks.yml`, `review-gate.yml`, plan 문서, `check-review-gate.py`) 전체를 완독하고, `git log`/`git show`/`git diff`로 이번 라운드(11_20_18)가 실제로 건드린 delta 를 확인 — 유일한 미커밋 변경은 `.claude/tests/test_review_gate_ci.py` 의 주석 문구 정정(`13개` → `형제`)과 하드코딩된 경로 리터럴을 `self.gate_module` 로 교체한 것뿐(둘 다 동시성과 무관, 순수 가독성/DRY). 나머지 5개 파일은 직전 커밋(`fb463845d`, 1R 반영 fix)에서 이미 확정된 내용.
- 이전 라운드(`review/code/2026/08/01/10_29_42/concurrency.md`)를 읽어 1R 이 낸 WARNING(`in_flight_ok` 회귀 무방비)과 INFO(`concurrency:` 블록 미고정)가 이번 라운드에서 각각 처리됐는지 대조.
- **1R WARNING 을 직접 재현·검증**: `scripts/check-review-gate.py:90` 을 워크트리에서 실제로 `evaluate(root, in_flight_ok=True)` 로 mutate → 새로 추가된 `test_an_unfinished_review_session_does_not_open_the_gate` 하나만 타겟 실행(`python3 -m unittest discover -p 'test_review_gate_ci.py' -k ...`) → FAIL(`0 != 1`) 확인. 곧바로 백업본으로 원복하고 `git status --short`/`diff` 로 워크트리 무변경 재확인, 전체 스위트(15 tests) 재실행해 green 확인 — 실험이 저장소에 흔적을 남기지 않았다.
- `.claude/tests/test_review_gate_ci.py` 전체 15개 테스트를 `python3 -m unittest discover -p 'test_review_gate_ci.py' -v` 로 정상 실행해 통과·소요시간(2.4초) 확인 — hang/deadlock 징후 없음.
- `grep -n "concurrency:\|cancel-in-progress"` 로 `review-gate.yml`(36, 38행)과 `harness-checks.yml`(63행대)의 그룹 키가 워크플로 이름으로 분리돼 있음을 재확인.
- 6개 파일 전체에 thread/lock/mutex/semaphore/async/await/queue/Pool 계열 키워드를 grep — GH Actions `concurrency:` 키워드(워크플로 스케줄링 정책, 코드 레벨 프리미티브 아님) 외에는 없음. `scripts/check-review-gate.py` 는 동기·단일 프로세스로 인자를 읽고 게이트를 부르고 print 후 exit 할 뿐 부수효과(파일 쓰기)가 없어, `cancel-in-progress: true` 로 실행 도중 취소돼도 안전(원자성 위반 여지 없음).

## 요약

이번 라운드는 동시성 관점에서 실질적으로 새로운 코드 변경이 아니다(유일한 미커밋 diff는 테스트 파일의 주석/리터럴 정리). 직전 커밋에서 이미 반영된 1R 리뷰 대응 중 동시성 담당 WARNING — CI 의 세 번째 `evaluate_review()` 호출부가 `in_flight_ok` opt-in 회귀에 무방비였던 것 — 은 `test_an_unfinished_review_session_does_not_open_the_gate` 로 실제 닫혔음을 워크트리에서 mutate-and-revert 로 직접 재현해 확인했다. GitHub Actions `concurrency:`(그룹 키 분리 + `cancel-in-progress: true`) 는 두 워크플로 모두 올바르게 구성돼 있고, 백스톱 스크립트가 부수효과 없는 읽기 전용 단발 프로세스라 취소 시 원자성 문제도 없다. 남은 것은 1R 부터 이어진 INFO 하나 — `concurrency:` 블록 자체를 고정하는 회귀 테스트 부재 — 뿐이며, 이는 실패 시에도 정확성이 아니라 러너 큐 낭비에 그치는 낮은 심각도라 즉시 조치 사유는 아니다. 활성 결함 없음.

## 위험도

LOW
