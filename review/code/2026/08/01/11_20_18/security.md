# Security Review — 리뷰 게이트 CI 백스톱 (round 2)

## 방법

지시대로 "검사만 하지 말고 측정" 했다. 구체적으로 실행한 것:

- `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v` 를 두 차례 실행 (한 번은 `__pycache__` 제거 후).
- `.github/workflows/review-gate.yml` / `scripts/check-review-gate.py` / `.claude/tests/test_review_gate_ci.py` 를 `git status`/`git diff` 로 대조.
- `OneJudgeTest` 의 허용목록·호출탐지 로직을 격리된 스크래치 픽스처(공유 워크트리 파일이 아닌 별도 임시 파일)에 대해 직접 재실행해 "판정 재구현이 `os` 만으로, 새 import 없이 통과하는가"를 실증.
- `.github/workflows/*.yml` 전수에 `permissions:` 유무를 grep 대조.
- `git branch`/`git check-ref-format` 로 `base_ref` 기반 인자 인젝션 가능성을 실측.
- `test_workflow_yaml_structure.py` 의 커스텀 YAML `_Loader` 가 `yaml.SafeLoader` 상속인지 확인.

### 중요 관측 — 리뷰 도중 공유 워크트리가 실시간으로 변이됐다

첫 테스트 실행에서 `.github/workflows/review-gate.yml` 과 `scripts/check-review-gate.py` 가 **커밋되지 않은 상태로** 다음과 같이 변형돼 있었다(`git diff` 로 확인):

- `review-gate.yml`: `run: python3 scripts/check-review-gate.py` 가 `env: {GATE_FLAG: --enforce}` / `run: true $GATE_FLAG` 로 대체 — 게이트 스크립트를 아예 실행하지 않고 `true` 가 무조건 성공한다.
- `check-review-gate.py`: `main()` 에 "second judge" 주석과 함께 `os.path.isdir(codebase_dir) and os.path.getmtime(codebase_dir) > 0` 기반의 재판정 로직이 삽입돼, 실제 `decision.blocked` 를 무조건 통과로 하향시키고 있었다.

두 번째 실행(캐시 제거 후) 시점엔 두 파일 모두 이미 원복돼 있었다(`git status` 재확인: `test_review_gate_ci.py` docstring/DRY 정리 diff만 잔존). 즉 **이 세션과 병행해 같은 공유 워크트리에서 다른 프로세스(다른 리뷰어/뮤테이션 테스트)가 실시간으로 우회를 심고 지우고 있었다** — 라운드 지시문이 설명한 "우회를 실제로 시도해보라"를 다른 에이전트가 같은 파일에 대해 동시에 수행 중이었던 것으로 보인다. 이는 **리뷰 대상 diff의 결함이 아니다** — 커밋된 상태가 아니고 재확인 시 사라졌으므로 코드 자체에 대한 판정에서 제외한다. 다만 **프로세스 위생 문제로 기록**: 같은 워크트리를 여러 에이전트가 동시에 쓰기 편집하면 한 리뷰어가 다른 리뷰어의 임시 뮤턴트를 "실제 코드"로 오판할 수 있다 — 이번엔 운 좋게 `git diff`로 uncommitted 임을 확인했지만, 다음엔 실제 회귀와 구분이 안 될 수 있다. orchestrator 는 뮤테이션 기반 검증을 별도 워크트리/워커에서 하도록 격리를 고려할 것.

이 관측 중 `test_a_step_actually_runs_the_script` 는 `true $GATE_FLAG` 변이를 **즉시 잡아냈다**(FAIL) — 1R 에서 고친 "substring 아니라 구조" 회귀 방지가 이 정확한 공격 형태(플래그를 `env:` 로 옮기고 `run:` 을 무력화)에 대해 실제로 동작함을 확인했다.

## 발견사항

- **[WARNING]** `OneJudgeTest` 의 "두 번째 판정자 금지" 호출 탐지가 2단 속성 체인(`os.path.X(...)`)과 `getattr` 간접 호출을 놓친다 — "판정자가 하나" 라는, 이 PR 전체가 의존하는 핵심 보안 속성이 실제로는 부분적으로만 강제된다.
  - 위치: `.claude/tests/test_review_gate_ci.py:246`~`288` (특히 `called` 집합 구성부 269~278, 금지 호출 대조 279~283)
  - 상세: import 허용목록(`_ALLOWED_IMPORTS`)은 새 모듈 도입을 막지만, 이미 허용된 `os` 를 이용한 재판정은 호출-이름 금지목록(`os.walk`/`os.scandir`/`os.listdir`/`open`) 4개만 막는다. 이 금지목록 매칭 로직은 `isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name)` 조건이라 **`os.path.isdir(...)` 처럼 속성이 두 단(`os` → `path` → `isdir`) 이상 중첩되면 아예 `called` 집합에 들어가지 않는다.** 격리된 픽스처로 직접 실증(공유 워크트리를 건드리지 않고 재현):
    ```python
    codebase_dir = os.path.join(root, "codebase")
    second_judge_blocked = decision.blocked and not (
        os.path.isdir(codebase_dir) and os.path.getmtime(codebase_dir) > 0
    )
    ```
    이 스니펫만 있는 파일에 실제 `OneJudgeTest` 로직을 그대로 돌리면: 추가 import 없음(통과), `called` 집합에 `os.path.isdir`/`os.path.getmtime` 자체가 아예 나타나지 않음(금지목록 대조 무의미) → **가드가 통과시킨다.** `getattr(os, "walk")(...)` 같은 반사 호출도 같은 이유로 탐지 안 됨 — 마침 `getattr` 은 이 스크립트에서 이미 정상적으로 쓰여 의심을 덜 산다(`getattr(decision, "notes", ())`).
    이 갭이 위험한 이유: 이 파일의 존재 이유가 "판정자가 하나다 — 두 번째 구현은 로컬/CI drift 이고 이 저장소가 이미 두 번 겪었다" 는 정확한 그 실패 클래스를 막는 것인데, 그 막음이 (a) import 허용목록 + (b) 호출 금지목록 두 층 중 (b) 가 새지 않는 실제 arms race 층이다. 1R 에서 정확히 이 클래스(denylist 우회 3회)를 겪고 import 쪽은 allowlist 로 전환했지만, 호출 쪽은 여전히 denylist 라는 구조적 비대칭이 남아 있다.
  - 제안: `called` 집합 구성을 단일 레벨 `Attribute(value=Name)` 로 제한하지 말고, `ast.Attribute` 체인을 루트까지 펼쳐 dotted-path 전체(`os.path.isdir` 등)를 기록하도록 바꾸거나, 더 강하게 — "게이트 응답(`decision.blocked`/`decision`)을 제외한 어떤 파일시스템 호출도 전혀 없어야 한다" 는 property 로 뒤집어(`os.path.*`, `os.stat`, `getattr(os, ...)` 전부 금지) 화이트리스트를 "os 는 `os.path.join`/`os.path.abspath`/`os.path.dirname`/`os.environ` 정도만" 수준으로 더 좁힐 것. 최소한 `getattr(<허용모듈 alias>, <literal str>)(...)` 패턴도 별도로 탐지 추가.

- **[INFO]** `harness-checks.yml` 이 PR 이 공급하는 임의의 Python/Node 테스트 코드(`unittest discover` + `node --test`)를 실행하면서 top-level `permissions:` 를 선언하지 않는다 — 같은 라운드에서 신설한 `review-gate.yml` 은 명시적으로 `permissions: contents: read` 를 선언(주석: "기존 파일 다수가 생략하고 있지만 신규 파일이니 명시한다")한 것과 대비된다.
  - 위치: `.github/workflows/harness-checks.yml` (전체 파일에 `permissions:` 키 없음 — `unittest` job 전체)
  - 상세: `grep -L '^permissions:' .github/workflows/*.yml` 실측 결과 `harness-checks.yml` 포함 8개 워크플로가 명시 선언이 없다(저장소 전반의 기존 관행). fork PR 의 `pull_request` 이벤트는 GitHub 플랫폼 차원에서 `GITHUB_TOKEN` 을 read-only 로 강제하므로 fork 경로의 실제 위험은 낮지만, **동일 저장소 내부 브랜치에서 여는 PR** 은 그 보호를 받지 않고 조직/저장소의 기본 토큰 권한 설정을 그대로 물려받는다. 이 워크플로가 실행하는 코드(테스트 파일들)는 PR 이 자유롭게 바꿀 수 있는 내용이므로, 최소권한 원칙상 명시가 바람직하다. 이 PR 이 `harness-checks.yml` 자체를 수정하는 김에(PyYAML 설치 스텝·paths 추가) 같이 정리할 가치가 있다.
  - 제안: `harness-checks.yml` 최상단(또는 job 레벨)에 `permissions: contents: read` 추가 — `review-gate.yml` 이 이번에 세운 패턴과 일치.

- **[INFO]** `check-review-gate.py` 의 fail-open 예외 처리(`_load_gate`/`main`)가 `except Exception as exc` 로 잡아 `{type(exc).__name__}: {exc}` 를 stderr 에 그대로 출력한다.
  - 위치: `scripts/check-review-gate.py:68`~`74`, `89`~`94` (gate 함수)
  - 상세: 예외 메시지가 내부 경로/모듈 이름 등을 노출할 수 있다(예: `FileNotFoundError` 의 전체 경로). 민감정보(자격증명 등)는 아니고 fail-open 설계상 "왜 못 불렀는지" 진단성을 의도적으로 남긴 것으로 보이지만, public 저장소라면 저장소 내부 구조 정보 노출 표면이 늘어난다는 점만 기록한다. 지금 수준(예외 타입+메시지, no traceback)은 합리적 절충으로 판단되어 조치를 요구하지 않는다.

- **[INFO]** `${{ github.base_ref }}` → `env.BASE_REF` 간접 참조로 GH Actions expression-injection 을 막는 방어(주석에 명시)는 올바르지만, 이 방어 자체를 지키는 회귀 테스트가 없다 — `WorkflowWiringTest` 는 `if:`(dependabot 면제), `fetch-depth`, `paths:`, `--enforce` 부재만 구조적으로 고정하고 "Fetch base ref" 스텝의 `run:`/`env:` 형태(직접 보간 금지)는 어떤 테스트도 대조하지 않는다.
  - 위치: `.github/workflows/review-gate.yml:67`~`70` (Fetch base ref step); 대응 부재 위치는 `.claude/tests/test_review_gate_ci.py` 의 `WorkflowWiringTest` 클래스 전체(대략 291~374 범위, 이 성질을 검사하는 메서드가 없음)
  - 상세: `base_ref` 는 PR 타깃 저장소에 이미 존재해야 하는 브랜치명이라 실질 공격자 통제 문자열이 되기는 어렵다(실측: `git branch`/`git check-ref-format` 로 `-`로 시작하는 ref 생성 자체가 git CLI 단에서부터 막힘). 그래서 현재 위험도는 낮지만, 이 방어가 "왜 필요한지" 는 주석에만 있고 향후 리팩터링(예: `run:` 한 줄로 합치며 `${{ github.base_ref }}` 를 도로 스플라이스)이 조용히 되돌려도 어떤 테스트도 RED 가 되지 않는다.
  - 제안: `WorkflowWiringTest` 에 "Fetch base ref" 스텝의 `run:` 문자열이 `${{` 를 포함하지 않는지(즉 표현식이 셸 텍스트에 직접 보간되지 않는지) 단언하는 케이스를 하나 추가.

- **[INFO]** GitHub Actions 를 가변 메이저 태그(`actions/checkout@v7`, `actions/setup-python@v7`, `actions/setup-node@v7`)로 참조 — 공식 GitHub 액션이라 위험은 낮지만, SHA 고정이 아니므로 태그가 재지정될 경우(액션 저장소 침해) 공급망 리스크가 있다. 저장소 전반의 기존 관행과 일치하므로 이 PR 만의 문제는 아니다. 방어심화 차원의 참고 사항.

- 확인(문제 없음): `test_workflow_yaml_structure.py` 가 사용하는 커스텀 `_Loader` 는 `yaml.SafeLoader` 를 상속한다(`class _Loader(yaml.SafeLoader)`) — 임의 Python 객체 역직렬화(`!!python/object/apply:...`) 경로는 열려 있지 않다. PyYAML 신규 도입이 안전하지 않은 로더로 이어지는지 확인했고, 해당 없음.
- 확인(문제 없음): `review-gate.yml` 의 dependabot 면제(`if: github.actor != 'dependabot[bot]'`) 는 `github.actor` 가 GitHub 플랫폼이 이벤트 트리거 주체로부터 직접 산정하는 값이라 PR 페이로드/제목/브랜치명 조작으로 스푸핑되지 않는다.
- 확인(문제 없음): `review-gate.yml`/`harness-checks.yml` 모두 secrets 를 참조하지 않고, `pull_request_target` 이 아닌 `pull_request` 로 트리거되므로 fork PR 이 상승된 토큰/시크릿을 얻지 않는다.

## 요약

이번 변경은 로컬 push 훅과 동일한 `evaluate_review()` 를 CI PR 이벤트로 재트리거하는 관측 전용(fail-open, non-enforcing) 백스톱으로, 시크릿 하드코딩·SQL/커맨드 인젝션·인증 우회 같은 고전적 취약점은 발견되지 않았고, `${{ }}` 셸 보간 회피·최소 권한(`permissions: contents: read`)·안전한 YAML 로더 선택 등 여러 방어가 이미 의도적으로 적용돼 있다. 다만 이 백스톱의 신뢰성이 전적으로 의존하는 "판정자가 하나" 라는 불변식을 지키는 `OneJudgeTest` 의 호출 탐지 로직이 2단 속성 체인·반사 호출에 대해 실측으로 우회 가능함을 확인했다 — 지금은 관측 모드라 즉각적 피해는 없지만, `--enforce` 전환 후에는 이 가드 자체가 게임당해도 아무도 모르는 회귀 경로가 된다. 리뷰 도중 공유 워크트리에서 다른 프로세스가 정확히 이 클래스의 우회를 실시간으로 심고 지우는 것을 관측했는데(비커밋 상태, 재확인 시 원복됨) 이는 diff 결함이 아니라 세션 격리 관련 프로세스 메모로 남긴다.

## 위험도

LOW — 활성 취약점은 없음(관측 전용 설계가 실제 피해 반경을 제한). `--enforce` 전환 전에 WARNING 1건(호출 탐지 갭)을 닫을 것을 권고.

STATUS: SUCCESS