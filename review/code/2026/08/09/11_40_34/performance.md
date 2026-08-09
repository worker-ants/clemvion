# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `changes` 판정 잡이 매 PR 마다 `fetch-depth: 0`(전체 히스토리 clone)을 수행 — 이전에는 `paths:` 필터로 무관한 PR 은 워크플로 자체가 아예 트리거되지 않아 compute 비용이 0 이었는데, 이제는 관련 없는 PR 에서도 `changes` 잡이 항상 실행되며 그 첫 스텝이 전체 clone 이다.
  - 위치: `.github/workflows/deps-security-checks.yml:53` (changes 잡 `actions/checkout@v7` → `fetch-depth: 0`), `.github/workflows/frontend-checks.yml:37` (동일 패턴)
  - 상세: 코드 주석(`# merge-base 계산에 필요 — 얕은 클론이면 스크립트가 fail-safe(true)로 떨어진다.`)이 밝히듯 의도된 트레이드오프다 — `scripts/ci-paths-changed.sh` 가 `git merge-base` 실패 시 fail-safe 로 `true` 를 내므로, shallow clone 을 쓰면 merge-base 계산이 자주 실패해 스킵 판정 자체가 무력화(=거의 항상 실제 검사가 돎)된다. 다만 그 대가로 **관련 없는 모든 PR** 이 이제 워크플로당 1회의 풀 히스토리 clone 비용을 치른다. 저장소 히스토리가 커질수록(현재 커밋 #1101+) 이 clone 시간이 누적된다. 또한 이 패턴이 두 워크플로(`deps-security-checks.yml`, `frontend-checks.yml`)에 각각 독립적으로 존재하므로, **같은 PR 에 대해 풀 클론이 2회** 발생하고 있고, `.claude/tests/test_required_check_skip_jobs.py` 의 `CONVERTED` 목록 주석("새로 전환할 때마다 여기 추가한다")이 시사하듯 앞으로 더 많은 워크플로가 이 패턴으로 전환되면 PR 당 풀 클론 횟수가 그만큼 선형으로 늘어난다.
  - 제안: 의도된 트레이드오프이므로 필수 수정은 아니나, 확장 시 비용을 관리하려면 (a) `fetch-depth` 를 단계적으로 늘리는 fallback(예: 얕은 fetch 후 실패 시 `git fetch --deepen`으로 점증) 검토, 또는 (b) 여러 워크플로가 공유할 수 있는 단일 `changes`(reusable workflow / `workflow_call`) 로 통합해 PR 당 clone·diff 계산을 1회로 줄이는 방안을 백로그에 남겨둘 것.

- **[INFO]** 스킵-잡 패턴 도입으로, 무관한 PR 에서도 게이팅된 잡(`config-guard`, `audit`, `override-floors`, `test-and-build`) 각각이 **러너 VM 할당·큐잉**은 그대로 받는다 — 스텝이 `if:` 로 no-op 되어도 GitHub Actions 는 잡 단위로 러너를 프로비저닝하므로, 스텝 실행 자체는 저렴해도 잡마다 고정 오버헤드(큐 대기·VM 부팅)는 PR 마다 반복해서 지불된다.
  - 위치: `.github/workflows/deps-security-checks.yml:69-146` (`config-guard`/`audit`/`override-floors` 3개 잡), `.github/workflows/frontend-checks.yml:51-90` (`test-and-build` 잡)
  - 상세: 이전에는 `paths:` 필터가 무관한 PR 에서 잡을 포함한 워크플로 전체를 트리거하지 않아 이 오버헤드가 0 이었다. `changes` 잡까지 포함하면 `deps-security-checks.yml` 은 무관한 PR 에서도 4개 잡(`changes`+3), `frontend-checks.yml` 은 2개 잡이 매번 스케줄된다. 다만 이는 "잡 전체를 `if:` 로 skip"하는 대안(§코드 주석에서 명시적으로 기각 — `skipped` conclusion 이 required check 를 만족하는지 문서상 모호해 데드락 재발 위험) 대비 감수한 설계 선택이라 결함이 아니라 비용 특성으로 기록.
  - 제안: 별도 조치 불요. 다만 이 패턴이 더 많은 워크플로로 확산될 경우 CI 러너 사용량(빌링) 추이를 주기적으로 관찰할 필요는 있다.

- **[INFO]** `.claude/tests/test_workflow_yaml_structure.py` / `.claude/tests/test_required_check_skip_jobs.py` 의 각 테스트 메서드가 동일한 워크플로 YAML 파일을 매번 `yaml.safe_load(path.read_text(...))` 로 재파싱한다(파싱 결과를 클래스/모듈 레벨로 캐싱하지 않음).
  - 위치: `.claude/tests/test_required_check_skip_jobs.py` — `load()` 헬퍼(줄 46-47)가 테스트 메서드마다 다시 호출됨(예: `test_pull_request_has_no_paths_filter`, `test_changes_job_publishes_relevant`, `test_every_other_job_needs_changes` 등); `.claude/tests/test_workflow_yaml_structure.py` — `test_step_conditions_are_registered`(236-238행 부근) 등 기존에도 존재하던 패턴
  - 상세: 대상 파일 수(워크플로 9개, `CONVERTED` 2개)와 크기가 작아 실질 영향은 무시할 수준이며, 테스트 스위트는 CI 에서 1회만 실행되므로 핫 패스가 아니다. `test_workflow_yaml_structure.py` 쪽은 이번 diff 이전부터 있던 기존 패턴이고, 이번 변경은 그 안에 조건 두 개를 추가했을 뿐 새로운 재파싱을 유발하지 않는다.
  - 제안: 우선순위 낮음. 필요시 `setUpClass`/`functools.lru_cache` 로 파싱 결과를 공유하면 되나, 현재 규모에서는 가독성 대비 이득이 작아 조치 불요로 판단.

- **[INFO]** `scripts/ci-paths-changed.sh` 자체의 알고리즘/호출 구조는 효율적이다 — pathspec 목록을 반복문 없이 한 번의 `git diff --name-only "$MERGE_BASE" "$HEAD_SHA" -- "$@"` 호출로 처리하고(N+1 없음), `git merge-base` 1회, 조건 분기마다 조기 종료(fail-safe)로 불필요한 후속 git 호출을 피한다. 특별한 성능 우려 없음.

## 요약

이번 변경은 애플리케이션 런타임 코드가 아니라 CI 워크플로 구조 변경(required status check 데드락 해소를 위한 skip-job 패턴 도입)이라, 전통적 의미의 알고리즘 복잡도·N+1 쿼리·메모리 문제는 해당하지 않는다. 성능 관점에서 유일하게 의미 있는 포인트는 CI 컴퓨팅 비용 트레이드오프다: `paths:` 필터 제거로 워크플로가 항상 트리거되고, 관련성 판정을 위해 매 PR 마다 `fetch-depth: 0` 풀 클론을 수행하며, 게이팅된 하위 잡들도 스텝이 no-op 이어도 러너 할당 오버헤드를 반복해서 지불한다. 이는 코드 주석에 명시된 대로 "머지 영구 대기" 라는 더 심각한 실패를 피하기 위해 의도적으로 감수한 비용이며, 현재 규모(워크플로 2개)에서는 문제 삼을 수준이 아니다. 다만 이 패턴이 더 많은 워크플로로 확산되면 PR 당 풀 클론 횟수가 선형으로 늘어나므로, 확산 시점에 공유 `changes` 잡(재사용 워크플로) 통합을 검토할 가치가 있다. 테스트 파일들의 반복 YAML 파싱은 기존부터 있던 무해한 패턴이다.

## 위험도

LOW
