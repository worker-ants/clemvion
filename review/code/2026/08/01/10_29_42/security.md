# Security Review — 리뷰 게이트 CI 백스톱 (`review-gate.yml` + `check-review-gate.py`)

## 발견사항

- **[WARNING]** `review-gate.yml`의 트리거 `paths:`가 `review_guard.py`가 실제로 import 하는 형제 모듈을 커버하지 않는다 — 이 저장소가 이미 6번 겪은 실패 클래스와 동일한 모양.
  - 위치: `.github/workflows/review-gate.yml:24-31` (특히 28행 `'.claude/hooks/_lib/review_guard.py'`)
  - 상세: `grep`으로 실측 확인 — `review_guard.py`는 `from branch_guard import _origin_default_branch`를 top-level에서 import하고("이 게이트가 계산하는 'since the branch started'"의 기준 브랜치를 결정하는 데 사용), `branch_guard.py`는 `.claude/hooks/_lib/`의 형제 파일이다. 그런데 `review-gate.yml`의 `paths:`는 `review_guard.py` **파일 하나만** 정확히 지목하고, `.claude/hooks/_lib/**`나 `branch_guard.py` 자체는 목록에 없다. 따라서 `branch_guard.py`(또는 같은 디렉터리의 `plan_guard.py`/`failopen_state.py` 등)만 단독으로 고치는 PR은 이 워크플로를 전혀 트리거하지 않는다 — 게이트가 의존하는 로직이 바뀌었는데 게이트 자신이 그 변화에 대해 재검증되지 않는다.
    이는 바로 이 PR이 `harness-checks.yml`에 등재하는 이유("`scripts/check-review-gate.py` 단독 수정 시 CI 가 안 돌면 `test_review_gate_ci.py` 가 트리거되지 않는다")로 설명한 것과 **동일한 실패 클래스**이고, `test_harness_checks_paths_coverage.py`가 `harness-checks.yml`에 대해 이미 6회 발생을 잡아 등재를 강제하는 바로 그 패턴이다. 다만 `review-gate.yml`에는 그런 자기-완결성 검사(paths coverage regression test)가 없다.
    현재는 관측 모드(비차단)라 즉시 위험은 0이지만, `--enforce` 전환 시점에는 "게이트 판정 로직이 조용히 바뀌었는데 그 변화를 검증하는 CI 실행 자체가 없었다"는 사각을 만든다 — 이 티켓 전체의 존재 이유(정규식이 유일 판정자인 사각)와 같은 모양의 문제가 한 계층 위(트리거 paths)에서 재발할 수 있는 지점이다.
  - 제안: `paths:`에 `.claude/hooks/_lib/**`(또는 최소한 `branch_guard.py`를 명시)를 추가하거나, `review-gate.yml`용 paths-coverage 회귀 테스트를 `test_harness_checks_paths_coverage.py`와 같은 패턴으로 추가.

- **[INFO]** `github.base_ref`가 `run:` 셸 명령에 직접 보간된다 (GitHub Actions expression-injection 안티패턴).
  - 위치: `.github/workflows/review-gate.yml:58` — `run: git fetch --no-tags origin "${{ github.base_ref }}"`
  - 상세: `${{ }}` 표현식을 셸 문자열에 직접 넣는 패턴은 컨텍스트 값이 공격자 통제 하에 있을 때 셸 인젝션으로 이어질 수 있어 일반적으로 `env:` 간접 참조(`"$VAR"`)가 권장된다. 여기서 실제 노출은 낮다: (1) 이 워크플로는 `pull_request_target`이 아니라 `pull_request`라 fork PR에서도 시크릿·쓰기 권한 토큰이 노출되지 않고, 이 워크플로 자체가 시크릿을 전혀 쓰지 않는다. (2) `github.base_ref`는 PR의 **베이스** 브랜치명으로, 이 저장소(대상 repo)에 이미 존재하는 브랜치여야 하므로 외부 기여자가 임의 문자열로 조작하기 어렵다(그러려면 이미 이 repo에 브랜치를 만들 쓰기 권한이 필요 — 그 시점엔 이미 다른 공격 경로가 있다). (3) 실측: 동일 패턴(`git fetch --no-tags origin "${{ github.base_ref }}"`, 심지어 `--base "origin/${{ github.base_ref }}"`까지)이 기존 `migration-check.yml`에도 이미 있어 이 PR이 신규로 도입한 패턴이 아니라 기존 관행을 그대로 따른 것이다.
  - 제안: 방어 심화 차원에서 `env: BASE_REF: ${{ github.base_ref }}` 뒤 `run: git fetch --no-tags origin "$BASE_REF"`로 바꾸는 것을 고려(낮은 우선순위, `migration-check.yml`과 함께 처리하는 편이 일관적).

- **[INFO]** 새 워크플로 `review-gate.yml`에 명시적 `permissions:` 블록이 없다.
  - 위치: `.github/workflows/review-gate.yml` 전체(특히 20-38행 `name:`/`on:`/`jobs:` 블록)
  - 상세: 최소 권한 원칙상 `permissions: contents: read`를 명시하는 것이 방어 심화다. 다만 이 저장소의 기존 워크플로 10개 중 9개(`migration-recheck-on-main.yml` 제외)가 동일하게 `permissions:`를 생략하고 있어 이 PR만의 새로운 이탈은 아니다. 이 워크플로 자체도 `gh` 호출·PR 코멘트·아티팩트 서명 등 쓰기 작업이 전혀 없어 실질 위험은 낮다.
  - 제안: 신규 파일이니 이번에 `permissions: contents: read`를 붙이는 것을 권장(강제 아님, 저장소 컨벤션 정리와 함께 별도로 처리 가능).

- **[INFO]** CI 백스톱이 신뢰하는 "리뷰됨" 판정은 손으로 작성 가능한 텍스트 마커에 전적으로 의존한다 — `--enforce` 전환 후 이 계층의 실제 신뢰 경계.
  - 위치: `.claude/tests/test_review_gate_ci.py:102-113` (`test_a_resolved_review_lets_the_branch_through`)가 이 신뢰 모델을 그대로 예시한다: 세션 디렉터리(`review/code/2099/01/01/00_00_00/`, 미래 날짜)에 `SUMMARY.md`("## 전체 위험도\n\nNONE\n")와 `RESOLUTION.md`("처분 완료\n")를 손으로 작성해 커밋하는 것만으로 게이트가 통과로 전환된다.
  - 상세: 이것은 이번 PR이 새로 만든 취약점이 아니라 `review_guard.evaluate_review()`(로컬 push/stop 훅과 100% 동일 로직, 이번 PR의 diff 밖)의 기존 설계이며, 이 PR의 명시적 목표("판정자 단일성" — CI가 판정 로직을 재구현하지 않고 그대로 위임)상 의도적으로 손대지 않는 영역이다. 다만 이 백스톱의 트리거 범위가 넓어지는 시점에 "리뷰가 실제로 실행됐다"를 암호학적으로 증명하는 장치는 없다는 사실 자체는 짚어둘 가치가 있다 — 쓰기 권한이 있는 누구든 세션 디렉터리 이름 규칙과 파일 내용 shape만 맞추면(실제 `/ai-review` 실행 없이) 게이트를 통과시킬 수 있다.
  - 제안: 별도 조치 불요(설계 결정이 이미 확정돼 있고 범위 밖). 다만 `--enforce` 전환을 검토하는 시점에 이 신뢰 경계를 명시적으로 재확인할 것.

- **[INFO]** 게이트 로딩/평가 실패 시 예외 메시지가 그대로 stderr에 출력된다.
  - 위치: `scripts/check-review-gate.py:71-73` (`_load_gate`), `91-93` (`main`)
  - 상세: `except Exception as exc: print(f"...({type(exc).__name__}: {exc})", file=sys.stderr)` 형태로 내부 파일 경로·모듈 구조 등을 CI 로그에 노출할 수 있다(예: `ModuleNotFoundError` 트레이스백 계열 문자열). 이 코드 경로에는 시크릿·자격증명이 개입할 여지가 없어(단순 import/호출 실패) 민감정보 유출 실질 위험은 낮음. fail-open 설계상 원인을 알 수 있어야 하므로 의도된 트레이드오프로 보인다.
  - 제안: 현행 유지 가능. 조직 정책상 CI 로그 가시성이 넓다면(퍼블릭 repo 등) 메시지를 더 일반화하는 것도 고려 가능하나 우선순위 낮음.

## 검증 방법 (측정 근거)

- **실제 diff 범위 확인**: `git diff origin/main...HEAD`로 이 리뷰의 실제 변경분이 정확히 6개 파일(README.md +1줄, `test_review_gate_ci.py` 신규 269줄, `harness-checks.yml` +3줄, `review-gate.yml` 신규 62줄, plan 문서 +46줄, `check-review-gate.py` 신규 120줄)임을 확인했고, 프롬프트에 제시된 전체 파일 컨텍스트와 라인 수가 정확히 일치함을 검증했다. `harness-checks.yml`의 PyYAML 설치 스텝은 **이 diff에 포함되지 않은** 선행 커밋(`06c2651c9`)에서 이미 도입된 것으로 확인되어 이번 diff의 평가 대상에서 제외했다.
- **의존성 그래프 실측**: `grep`으로 `review_guard.py`의 실제 import(`branch_guard`, `_shared.report_paths`, `_shared.block_integrity`)를 확인하고 `review-gate.yml`의 `paths:` 5개 항목과 대조해 `branch_guard.py` 커버리지 갭을 직접 검증(위 WARNING).
- **테스트 실행**: `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'`로 신규 테스트 13개 전부 실행 → 13/13 통과 확인.
- **뮤테이션 검증(vacuous test 여부 실측)**: 추적 파일은 전혀 건드리지 않고 스크래치 디렉터리에서 실제 임시 git repo + 실제 `.claude/hooks`/`_shared` 사본을 구성해 (1) `_load_gate`의 `except` 절을 좁혀 `ModuleNotFoundError`를 흘려보내도록 만든 뮤턴트를 돌린 결과 스크립트가 처리되지 않은 트레이스백으로 죽고 "불러오지 못했습니다" 문구가 사라짐을 확인 — 해당 테스트가 진짜로 실패를 잡아낼 수 있음을 실측. (2) advisory `notes` 출력을 `blocked` 분기 안으로만 옮긴 뮤턴트를 ALLOW 케이스(`blocked=False`)로 돌린 결과 마커 문자열이 stdout에서 사라짐을 확인 — "advisory는 판정과 무관하게 출력" 테스트 역시 회귀를 실제로 잡아낼 수 있음을 실측. 두 경우 모두 조작은 스크래치 사본에만 가했고, 작업 후 실제 추적 파일(`scripts/check-review-gate.py`)이 `git diff`상 무변경임을 재확인했다.
- **레포 컨벤션 대조**: `permissions:` 블록 부재가 이 PR만의 편차가 아니라 기존 워크플로 10개 중 9개의 공통 관행임을 grep으로 확인. `github.base_ref` 셸 보간 패턴이 `migration-check.yml`에 이미 동일하게(오히려 두 곳에) 존재함을 확인.
- **YAML 처리 안전성(참고, 범위 외 파일)**: 이번 diff가 근거로 든 `test_workflow_yaml_structure.py`의 커스텀 로더가 `yaml.SafeLoader`를 상속함을 확인(안전하지 않은 `yaml.load`/`unsafe_load` 계열 아님) — 다만 이 파일은 이번 6개 리뷰 대상에 포함되지 않아 정식 발견사항으로는 잡지 않았다.
- **정규식/이차 복잡도**: 이번 diff의 6개 파일 중 정규식을 사용하는 코드는 없다(`check-review-gate.py`의 `OneJudgeTest`가 AST로 `re`/`subprocess`/`glob`/`os.walk`/`open` import·호출 자체를 구조적으로 금지하며, 실행 결과 통과 확인) — 그러므로 "quadratic regex" 클래스의 결함은 이 diff 범위에는 해당하지 않는다.
- **참고(방법론 메모, 코드 결함 아님)**: 뮤테이션 검증 도중 공유 워크트리의 `scripts/check-review-gate.py`가 일시적으로(`import re` + `_LEAK = re.compile('x')` 추가) 변경된 상태를 관측했다가 곧 원상 복구되는 것을 확인했다. 이는 본인이 유발한 것이 아니며(본인 조작은 스크래치 사본에만 가했고 `open(REAL_SCRIPT)`은 읽기 전용으로만 사용) 같은 팬아웃의 다른 리뷰어가 동일 공유 워크트리에서 자체 뮤테이션/벤치마킹을 수행한 흔적으로 보인다. 자연 복구되어 본 리뷰 결과에는 영향이 없다.

## 요약

이번 변경은 로컬 push 훅과 **동일한** `review_guard.evaluate_review()`를 호출해 GitHub PR 이벤트를 트리거로 쓰는 CI 백스톱을 관측(비차단) 모드로 신설하는 것으로, 판정 로직을 재구현하지 않고 그대로 위임하는 설계(AST 기반 `OneJudgeTest`로 subprocess/os.walk/glob/정규식/파일-open 도입 자체를 구조적으로 차단, 실행 확인)가 "두 번째 구현이 로컬/CI drift를 만든다"는 이 저장소의 반복된 실패 패턴을 정확히 피하고 있다. 새 Python 스크립트에는 하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 안전하지 않은 역직렬화가 없으며, 워크플로는 `pull_request_target`이 아닌 `pull_request`를 쓰고 시크릿·쓰기 권한을 전혀 요구하지 않아 fork PR발 토큰 탈취·원격 코드 실행 패턴에 노출되지 않는다. fail-open 설계는 의도적이고 정확히 스코프돼 있다(백스톱의 백스톱이지 그 자체가 활성 게이트가 아님). 신규 테스트 13개를 실제로 실행해 전부 통과함을 확인했고, 그중 fail-open 메시지와 "advisory는 판정과 무관하게 출력" 두 속성은 스크래치 사본에 대한 실제 뮤테이션으로 회귀 포착 능력을 실측 검증했다(추적 파일은 무변경으로 재확인). 실질적으로 남는 것은 하나의 WARNING — `review-gate.yml`의 트리거 `paths:`가 `review_guard.py`가 실제로 import하는 `branch_guard.py`(형제 모듈)를 커버하지 않아, 이 저장소가 이미 6번 겪은 "가드 로직이 바뀌었는데 그 변화를 검증할 CI가 안 돈다"는 클래스가 한 계층 위에서 재발할 수 있는 지점이다 — 이며, 현재는 관측 모드라 즉시 위험은 없지만 `--enforce` 전환 전에 닫아야 한다. 나머지는 모두 낮은 노출도의 INFO(기존 `migration-check.yml`과 동일한 `github.base_ref` 셸 보간 패턴, 신규 파일의 `permissions:` 블록 부재 — 다만 레포 전체 관행과 일치, 손으로 위조 가능한 텍스트 마커 기반 신뢰 모델 — 다만 이번 PR 범위 밖의 기존 설계, stderr 예외 메시지 노출)이다.

## 위험도

LOW
