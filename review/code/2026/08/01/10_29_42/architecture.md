# Architecture Review — harness-review-gate-ci-backstop

## 발견사항

- **[WARNING]** `review-gate.yml` 자기-트리거 커버리지를 지키는 두 테스트가, 자신이 막으려는 바로 그 회귀를 놓친다 (실측으로 재현)
  - 위치: `.claude/tests/test_review_gate_ci.py:245-246` (`test_it_runs_the_script`), `:254-260` (`test_it_triggers_on_the_gate_it_depends_on`)
  - 상세: `.github/workflows/review-gate.yml`에서 문자열 `scripts/check-review-gate.py`는 두 곳에 나온다 — 트리거 `paths:` 목록(30번째 줄)과 `run:` 스텝(62번째 줄). 두 테스트 모두 주석을 걷어낸 파일 전체 텍스트에 대해 단순 `assertIn`만 수행하므로, 한쪽이 사라져도 다른 쪽에 같은 문자열이 남아 있으면 여전히 초록이다. 실측으로 두 방향 다 확인했다: (1) `paths:`의 해당 줄만 제거하고 `run:` 스텝은 그대로 둔 사본에서 `test_it_triggers_on_the_gate_it_depends_on`의 4개 `assertIn`이 전부 참으로 유지됨, (2) 반대로 `run:` 스텝만 제거하고 `paths:` 항목을 남긴 사본에서 `test_it_runs_the_script`가 여전히 통과함. `test_it_triggers_on_the_gate_it_depends_on`의 docstring이 스스로 인용하는 실패 클래스("`harness-checks.yml`이 같은 실패 클래스를 여섯 번 겪고 세운 규칙")가 정확히 이 테스트에서, 가장 그럴듯한 회귀(스크립트 rename/이동 시 `paths:` 갱신 누락, 또는 스텝 삭제) 앞에서 재발할 수 있다. 같은 스위트의 `test_harness_checks_paths_coverage.py`/`test_e2e_exemption_paths_sync.py`는 `paths:` 블록 자체를 구조적으로 파싱하는 전용 파서를 이미 갖고 있어 이 문제가 없다 — 이번 신규 테스트만 더 약한(파일 전체 substring) 방식을 썼다.
  - 제안: 파일 텍스트 전체가 아니라 `on.pull_request.paths` 블록만 구조적으로 파싱해 대조하도록 바꾼다(기존 파서 재사용 검토). 최소 조치로는 두 검사를 분리해 각각이 정확히 원하는 위치(`paths:` 안 vs `run:` 안)에서만 문자열을 찾도록 하거나, "정확히 두 번 등장(트리거 1회 + run 1회)"을 단언해 어느 한쪽만 빠지는 경우를 구분한다.

- **[WARNING]** "판정자가 하나다"를 지키는 `OneJudgeTest`의 AST 검사에 `pathlib`/`os.scandir` 우회 경로가 있다 (실측으로 재현)
  - 위치: `.claude/tests/test_review_gate_ci.py:179-225` (`test_the_script_performs_no_judgement_operations_of_its_own`), banned calls 목록 `:209-210`, banned imports 목록 `:222-223`
  - 상세: 이 테스트는 `check-review-gate.py`가 판정 로직을 재구현하지 않음을 `os.walk`/`glob.glob`/`glob.iglob`/`re.compile`/`subprocess.run`/`subprocess.check_output`/`open` 호출과 `re`/`glob`/`subprocess` import를 금지하는 **denylist**로 확인한다. 스크립트 사본에 `pathlib.Path(root).rglob("*.ts")` + `os.scandir(root)`로 트리 순회를 재구현하는 함수를 추가한 뒤 이 테스트의 AST 로직을 그대로 재현해 돌려본 결과, **아무것도 잡히지 않았다** — `called` 집합에는 `pathlib.Path`/`rglob`/`os.scandir`만 남고 어느 것도 banned 문자열과 정확히 일치하지 않으며, `pathlib`은 banned import 목록에 없고 `os`는 스크립트가 이미 정당하게 쓰는 모듈이라 통째로 금지할 수 없다. 대조적으로 `import re`/`glob`/`subprocess`는 별칭을 써도(`import re as _re`) 실제 모듈명 기준으로 잡히므로 견고함을 확인했다 — 즉 이 gap은 import 검사 전체가 아니라 "os 서브셋 + pathlib + 체이닝 호출(`X(...).method()`)" 이라는 구체적 사각지대다. 이 PR의 핵심 아키텍처 주장(두 번째 판정 구현이 로컬/CI drift를 만들고, 이 저장소는 그 실패를 `report_paths`·`retry_state`로 이미 두 번 겪었다)을 향후에도 기계적으로 지켜줄 유일한 장치가 이 테스트인데, 정작 그 장치 자체에 검증된 사각지대가 있다.
  - 제안: denylist를 allowlist로 뒤집는 것을 검토(현재 실제로 쓰는 4개 — `argparse`/`os`/`sys`/`review_guard` — 외의 모든 import를 금지). 최소 조치로는 `os.scandir`/`os.listdir`/`pathlib`을 banned 목록에 추가.

- **[INFO]** "단일 판정자, 다중 트리거" 설계가 실제로 일관 적용되어 있음을 확인 (긍정적 관찰)
  - 위치: `.claude/hooks/guard_review_before_push.py` (892-897번째 줄 부근, `evaluate_review` 호출), `.claude/hooks/guard_review_before_stop.py:350`, `scripts/check-review-gate.py`
  - 상세: grep으로 확인한 결과 push 훅·stop 훅·이번 CI 스크립트 셋 다 정확히 같은 `review_guard.evaluate_review()`를 호출하며, 신규 스크립트는 그 함수의 import(`argparse`/`os`/`sys`/`review_guard`)만 있을 뿐 git diff·freshness·spec-link 판정 로직을 전혀 재구현하지 않는다. `origin/main...HEAD` diff를 확인해 보면 `review_guard.py`와 두 기존 훅은 이번 PR에서 **한 줄도 바뀌지 않았다** — 새 트리거가 순수 확장으로 추가되어 개방-폐쇄 원칙이 실제로 지켜졌다(주장이 아니라 diff로 확인). 프레젠테이션(CLI 출력/exit code) → 도메인(`evaluate_review`) → 데이터 접근(`_run_git` 등) 3계층 분리도 새 어댑터에서 그대로 유지된다. 워크플로 분리(`harness-checks.yml` vs `review-gate.yml`)도 체크아웃 깊이(`fetch-depth: 0` 필요 여부)·트리거 경로·봇 예외가 서로 다른 두 관심사를 억지로 합치지 않은 합리적 모듈 경계다.

- **[INFO]** dependabot 예외 처리가 올바른 레이어(워크플로 YAML)에 위치
  - 위치: `.github/workflows/review-gate.yml:44` (`if: github.actor != 'dependabot[bot]'`)
  - 상세: actor 기반 예외는 코드 리뷰 커버리지 판정(도메인 로직)과 무관한 CI 트리거 계층의 관심사다. 이를 `evaluate_review()` 안으로 넣지 않고 워크플로의 `if:` 조건에 둔 것은, "액터" 개념 자체가 없는 로컬 push/stop 훅과 CI 전용 관심사를 정확히 분리한 선택이다.

- **[INFO]** fail-open `try/except` 경계가 `evaluate()` 호출에만 걸려 있고 그 이후 decision 접근은 경계 밖
  - 위치: `scripts/check-review-gate.py:89-94`(try/except), `:98`/`:101`/`:105`(경계 밖에서 `decision.notes`/`.blocked`/`.reason` 접근)
  - 상세: 현재 `ReviewDecision`은 순수 `@dataclass(frozen=True)`이고 `notes`/`blocked`/`reason`은 계산 프로퍼티가 아니므로(`.claude/hooks/_lib/review_guard.py:182-203`, `push_blocks`만 프로퍼티이며 이 스크립트는 그것도 읽지 않는다) 실질적 위험은 없다. 다만 "게이트를 못 불러오거나 예외를 던져도 fail-open"이라는 이 파일의 설계 문서화된 계약이, `evaluate()` 호출 자체가 아니라 그 반환값과의 상호작용에서 깨질 가능성까지 구조적으로 막아 두지는 않았다는 점은 기록해 둘 가치가 있다.

## 요약

이 변경은 로컬 push 훅과 **동일한** `review_guard.evaluate_review()`를 GitHub PR 이벤트로 재트리거하는 얇은 어댑터(`scripts/check-review-gate.py` + `.github/workflows/review-gate.yml`)를 추가한다. 핵심 아키텍처 결정 — "독립성은 트리거뿐, 판정 로직은 재구현하지 않는다" — 은 실제로 잘 지켜져 있다: `review_guard.py`와 기존 두 훅은 이번 diff에서 전혀 수정되지 않았고(OCP를 주장이 아니라 diff로 확인), 신규 스크립트의 import는 `argparse`/`os`/`sys`/`review_guard` 넷뿐이며(직접 실행해 실제 저장소에서 정상 동작함을 확인), 프레젠테이션/도메인/데이터 3계층 분리와 워크플로 간 모듈 경계(체크아웃 깊이·트리거 범위·봇 예외가 다른 두 워크플로를 분리)도 합리적이다. 순환 의존성은 없다. `--enforce`/관측-모드 전환, fail-open, advisory 무관 출력이라는 4대 불변식은 실제로 서브프로세스 기반 행동 테스트 13건 전부가 통과하고(직접 실행해 확인), 그중 관측-모드 on/off 전환은 실제 회귀(`--enforce`를 no-op으로 만드는 변형)를 주입해 테스트가 정말 RED로 갈 수 있음을 검증했다. 다만 이 아키텍처의 내구성을 지키는 안전장치 자체에 두 개의 검증된 틈이 있다: (1) `review-gate.yml`의 자기-트리거 커버리지를 지키는 두 테스트가 파일 전체에 대한 단순 substring 검사라서, 트리거용 문자열과 실행용 문자열이 같은 경로 문자열을 공유하는 바람에 한쪽이 삭제돼도 다른 쪽 때문에 계속 통과한다(양방향 모두 실측으로 재현) — 이 저장소가 이미 여섯 번 겪은 "가드가 자기 자신을 못 지킨다" 실패 클래스가 이번 새 가드에도 좁게 재발할 수 있는 자리다. (2) "판정자가 하나다"를 지키는 AST denylist 테스트는 `pathlib.rglob`/`os.scandir` 기반 재구현을 놓친다(실측으로 재현) — `re`/`glob`/`subprocess` 자체를 금지하는 부분은 별칭에도 견고하지만, `os`의 서브셋과 `pathlib` 전체, 체이닝 호출 형태는 denylist 밖에 있다. 둘 다 현재 상태의 실제 동작에는 영향이 없고(오늘 시점의 파일들은 올바르다) 향후 회귀에 대한 방어망의 구멍이라는 성격이다.

## 위험도
LOW
