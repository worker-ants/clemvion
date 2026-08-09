# 아키텍처(Architecture) 리뷰

## 대상 요약

`.github/actions/pnpm-workspace/action.yml` (신설 composite action) 로 8개 워크플로/9개 잡이 복제하던
`pnpm/action-setup` + `actions/setup-node` + `pnpm install --frozen-lockfile --filter` 3단계를 단일
지점으로 추출한 PR. 동반 변경: `test_workflow_yaml_structure.py` 의 구조 검사(중복 키·`run`/`uses`
정확히 하나·실패 삼킴 금지) 범위를 `.github/actions/**/action.yml` 까지 확장, 신규
`test_pnpm_workspace_action.py`(실행 기반 argv 검증 + 소비처 결속), `harness-checks.yml`/
`test_harness_checks_paths_coverage.py` 의 pathspec 커버리지 등재, 5개 워크플로(`backend-checks`·
`frontend-checks`·`packages-checks`·`spec-link-checks`·`web-chat-checks`)의 호출부 치환.

## 발견사항

- **[WARNING]** `_MAY_SWALLOW` 예외 레지스트리가 `path.name`(베이스네임)만으로 키를 잡는데, 이번
  확장으로 그 검사 대상(`self.structural_files`)에 composite action 파일이 포함됐다. GitHub Actions
  규약상 composite action 파일명은 항상 `action.yml` 이므로, 향후 두 번째 composite action 이
  생기면 `("action.yml", "<step 이름>")` 키가 **어느 액션의 스텝인지 구분하지 못하고** 서로 다른
  액션의 동명 스텝에 잘못 적용될 수 있다. 같은 파일이 바로 옆에서(`_PULL_REQUEST_KEYS`/
  `_JOB_CONDITIONS`) "액션을 그 레지스트리에 넣으면 파일명 하나로 collide by construction" 이라고
  명시적으로 경계했으면서, `_MAY_SWALLOW` 에는 그 원칙을 적용하지 않았다 — 이 저장소가 반복
  경계하는 "가드가 조용히 잘못된 대상에 적용" 클래스를 액션 축에서 재도입할 수 있는 latent gap.
  현재는 액션이 1개뿐이고 `_MAY_SWALLOW` 에 액션 스텝 항목이 없어 즉시 트리거되지는 않는다.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:183` (`_MAY_SWALLOW` 정의),
    사용처 `.claude/tests/test_workflow_yaml_structure.py:215-217` (`key = (path.name, step.get("name"))`)
  - 상세: 워크플로 파일은 저장소 내에서 이름이 유일하지만 composite action 파일은 전부
    `action.yml` 로 동일해, 베이스네임 키가 워크플로 축에서는 안전하고 액션 축에서는 안전하지
    않다는 비대칭이 생겼다.
  - 제안: `_MAY_SWALLOW`/서브테스트 키를 `path.name` 대신 `path.relative_to(REPO_ROOT)`(또는
    `.github/actions/**` 아래일 때만 부모 디렉터리명까지 포함)로 바꿔 액션이 여러 개가 되어도
    유일성이 깨지지 않게 한다. 지금 당장의 동작에는 영향 없지만, 두 번째 액션이 생기는 시점에
    바로 잡아야 값이 크다.

- **[INFO]** `test_pnpm_workspace_action.py::ConsumerBindingTest.test_every_consumer_lists_the_action_in_its_pathspecs`
  가 `test_required_check_skip_jobs` 모듈을 import 해 그 안의 `pathspecs_of()` 를 재사용한다 —
  테스트 파일이 다른 테스트 파일의 내부 헬퍼에 직접 의존하는 형태다. 이 저장소가 이미 "블록
  스칼라 3단 정규화(strip·빈 줄 버림·`#` 시작 버림)는 세 곳이 동시에 같은 로직을 써야 한다" 는
  원칙을 문서화해 뒀고(`plan/in-progress/ci-required-check-skip-jobs.md`), 그 원칙을 따라 로직을
  복제하지 않고 재사용한 것이므로 방향 자체는 옳다. 다만 공유 로직이 독립 헬퍼 모듈(예:
  `_pathspec.py`)로 분리되지 않고 한 테스트 파일이 다른 테스트 파일을 직접 import 하는 형태라,
  `test_required_check_skip_jobs.py` 쪽에서 `pathspecs_of` 의 이름/시그니처/위치가 바뀌면
  `test_pnpm_workspace_action.py` 가 조용히 깨지는 암묵적 결합이 생겼다(현재는 순환은 아님 —
  역방향 import 없음, `test_required_check_skip_jobs.py` 는 stdlib/yaml 만 import).
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:243` (`import test_required_check_skip_jobs as skip_jobs`)
  - 제안: 지금은 낮은 비용이지만, 세 번째 소비처가 생기면 `pathspecs_of` 를 공용 헬퍼 모듈로
    승격해 "테스트가 테스트를 import" 하는 방향을 없애는 편이 결합 방향이 명확해진다.

- **[INFO]** `test_pnpm_workspace_action.py` 는 `REPO_ROOT = _harness.REPO_ROOT` 를 로컬 별칭 없이
  그대로 쓰도록 주석으로 강제한다 — `test_harness_checks_paths_coverage.py` 의 AST 추출기가
  `REPO_ROOT`/`_harness.REPO_ROOT` 로 시작하는 모듈 레벨 체인만 인식하기 때문이다. 즉 "이 파일이
  어떤 파일을 지키는가" 라는 커버리지 등재가 명시적 레지스트리가 아니라 **소스 코드의 이름 형태
  (naming convention)** 에 의해 암묵적으로 결정된다. 코드 자체가 이 취약성을 정확히 인지하고
  주석으로 못 박아 뒀고(`REPO_ROOT` 를 로컬 별칭으로 바꾸면 이 파일이 "guarded file" 목록에서
  빠진다는 것을 별도 가드가 감시), 이 저장소가 과거에 "정규식 vs 정밀 파서 경계" 를 이미 실측
  근거로 결정한 바 있어 신뢰할 만한 트레이드오프다. 다만 아키텍처 관점에서는 여전히 "관례를 따르지
  않으면 조용히 커버리지를 잃는" 이름 기반 암묵적 계약이라는 점은 남는다.
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:46-50`
  - 제안: 현행 유지로 충분 — 이미 자기 문서화돼 있고 별도 가드가 이탈을 감지한다. 다만 유사한
    신규 harness 테스트 파일을 작성할 때 이 관례(로컬 별칭 금지)를 놓치기 쉬우니,
    `.claude/tests/README.md` 나 harness 테스트 작성 가이드에 "새 guarded-file 상수는 반드시
    `REPO_ROOT`/`_harness.REPO_ROOT` 에서 직접 뻗어야 한다" 는 규칙을 한 줄로 명문화해 두면
    반복 실수를 줄일 수 있다.

## 아키텍처 강점 (참고)

- **단일 책임 + DRY**: 8워크플로/9잡에 바이트 동일하게 반복되던 셋업 3단계를 단일 composite
  action 으로 추출 — 전형적인 "Extract Component" 로 정당하다(plan 문서가 8/9 잡이 `--filter`
  인자 하나만 다른 바이트 동일 형태임을 실측으로 확인한 뒤 추출했다). 나머지 5개(python 전용·
  pip·캐시 없는 node·`fetch-depth: 0`)는 진짜로 발산하므로 억지로 통합하지 않았다 — 과도한
  추상화를 피한 판단이 적절하다.
- **파급 역전에 대한 인지된 트레이드오프**: 추출로 "한 곳이 깨지면 8~9개 잡이 동시에 깨진다" 는
  블라스트 레이디어스 역전이 생기지만, 이를 숨기지 않고 (1) 실제 argv 를 실행 검증하는 테스트
  (`test_pnpm_workspace_action.py`, 뮤테이션 13/13 RED), (2) 소비처가 8개 미만이 되면 실패하는
  vacuity 바닥, (3) 액션 변경이 각 소비 워크플로의 pathspec 에 등재되도록 강제하는
  `ConsumerBindingTest` 로 상쇄한다. 리스크를 인지하고 테스트로 고정한 형태로, 임기응변이 아니다.
- **레이어 경계 유지**: composite action(설정 레이어) 을 워크플로별 트리거/게이팅 레지스트리
  (`_PULL_REQUEST_KEYS`, `_JOB_CONDITIONS`)에는 편입하지 않고 구조 검사(중복 키·`run`/`uses`
  정확히 하나·실패 삼킴 금지)에만 편입한 판단이 정확하다 — 전자는 파일명(`action.yml`)으로 키를
  잡아 collide by construction 이 되므로 의식적으로 배제했다(모듈 docstring §SCOPE 에 근거 명시).
- **가드 시야 갱신**: 셋업 스텝 3개가 `.github/workflows/*.yml` 밖으로 이동하면서 2026-08-01
  중복 `run:` 사고를 잡던 구조 검사의 시야 밖으로 나가는 위험을 놓치지 않고 검사 범위를
  `.github/actions/**/action.yml` 까지 확장했다 — 이 저장소가 반복 겪은 "가드가 리팩터를 못
  따라가 조용히 사각지대가 생기는" 클래스를 이번엔 선제적으로 막았다.
- **인터페이스 설계**: `filter` 입력을 `required: true` 로 강제해, 호출부가 실수로 빠뜨리면 YAML
  레벨에서 즉시 실패하게 했다 — optional 이었다면 빈 `--filter` 로 워크스페이스 전체가 설치되는
  형태로 조용히 퇴화했을 것. `${{ }}` 를 `run:` 문자열에 직접 보간하지 않고 `env:` 를 경유하는
  것도(스크립트 인젝션 회피) `_changed-paths.yml` 이 세운 것과 같은 규율을 일관되게 적용한 것이다.
  checkout 을 액션 안에 넣지 않은 것도 로컬 composite action 의 플랫폼 제약(`uses: ./...` 해석은
  체크아웃 이후에만 가능)에 대한 올바른 이해에 근거한다.

## 요약

CI 설정 계층에서 잘 실행된 Extract-Component 리팩터다. 8~9개 잡에 바이트 동일하게 흩어져 있던
셋업 보일러플레이트를 단일 composite action 으로 모으면서, 추출이 필연적으로 만드는 "단일
장애점화(blast radius inversion)" 위험을 실행 기반 테스트(정적 grep 이 아니라 실제 bash 로 `run:`
블록을 돌려 스텁이 받은 argv 를 검증)와 소비처 결속 테스트로 정면 상쇄했고, 기존 구조 검사(중복
키·swallow-failure 등)의 시야가 워크플로 밖으로 새는 것도 스코프 확장으로 선제 차단했다. SOLID·
레이어 분리·순환 의존성 관점에서 심각한 결함은 없다. 유일하게 짚을 만한 것은 `_MAY_SWALLOW`
예외 레지스트리가 액션 파일의 필연적 동명(`action.yml`) 특성을 반영하지 못해 두 번째 composite
action 이 생기는 순간 재도입될 수 있는 latent 충돌 가능성이며, 나머지 두 건은 테스트 스위트
내부의 결합도에 관한 저위험 관찰이다.

## 위험도

LOW
