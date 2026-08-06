# 아키텍처(Architecture) 리뷰 — round 10

## 방법 노트

`.claude/_shared/git_probe.py`, `.claude/hooks/_lib/{review_guard,plan_guard,branch_guard}.py`,
`.claude/_shared/__init__.py` 를 직접 `Read` 로 열어 프롬프트 게이트 번호와 실제 줄 번호가
일치함을 확인했다. 이번 라운드(커밋 `e834d0f4e`, "CI 백스톱 9R")의 핵심은 다섯 개 git 프로브를
`_shared/git_probe.py` 로 통합한 것이라, 그 통합이 만든 새로운 결합 구조를 중심으로 봤다.

의심되는 지점 하나는 격리된 스크래치 디렉터리에서 직접 실측했다(작업 트리는 건드리지 않음,
`mktemp -d` 사용). 아래 각 항목에 실행한 정확한 명령과 출력을 남긴다.

## 발견사항

- **[WARNING]** `_shared/git_probe.py` 가 자신이 속한 패키지의 명시된 설계 원칙을 그 원칙을 적어둔
  바로 그 커밋 안에서 스스로 어긴다 — 역방향 의존이 새로 생겼고, 그 성공 경로는 하네스 스위트
  849개 테스트 전체에서 한 번도 실행되지 않는다(실측).
  - 위치: `.claude/_shared/git_probe.py:35-59` (`_origin_default_branch` 동적 로더),
    `.claude/_shared/git_probe.py:113-127` (`_default_branch`), 대조:
    `.claude/_shared/__init__.py:1-11`
  - 상세:
    `_shared/__init__.py` 는 이렇게 못박는다 — "Neither `.claude/hooks/**` nor
    `.claude/skills/**` may own this: both are *consumers*." 즉 `_shared` 가 정본이고
    `hooks`/`skills` 는 그것을 소비만 해야 한다. 그런데 이번 라운드가 추가한
    `git_probe._origin_default_branch()` 는 정확히 반대 방향으로 움직인다:
    `importlib.util.spec_from_file_location` 으로 `.claude/hooks/_lib/branch_guard.py` 를
    파일 경로로 직접 열어 `sys.modules["_git_probe_branch_guard"]` 라는 비공개 키 아래
    **두 번째로** 로드하고, 그 모듈의 `_origin_default_branch` 속성을 꺼내 되돌려준다.
    `_shared`(하위 계층)가 `hooks/_lib`(소비자)의 구현을 "정본"으로 취급해 되감아 부르는
    셈이라, `_shared` 패키지 자신이 적어둔 소유권 규칙과 정확히 어긋난다. 다섯 개 함수
    (`_run_git`/`_repo_root`/`_merge_base`/`_porcelain_path`/`_default_branch` 자체)는 전부
    "정본을 `_shared` 로 옮기고 세 훅이 그것을 참조" 패턴을 올바로 따르는데, 여섯 번째
    (`_origin_default_branch`) 만 반대로 짜여 있다 — 같은 커밋 안에서 일관성이 깨졌다.

    다음으로, 이 동적 로딩의 **성공 분기**(로더가 실제로 `branch_guard.py` 를 불러오고 그
    함수가 origin 의 실제 기본 브랜치를 truthy 값으로 돌려주는 경로)가 하네스 스위트
    849개 테스트 어디에서도 실행되지 않는다는 것을 계측으로 확인했다. 스크래치
    드라이버로 `gp._origin_default_branch` 를 감싸 호출 횟수와 반환값을 기록한 채
    `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 와 동등한 discovery 를
    같은 프로세스에서 돌렸다:

    ```
    $ python3 <scratch>/probe_driver.py <repo>
    === git_probe._origin_default_branch instrumentation ===
    {'loader_calls': 4, 'resolver_calls': 4, 'resolver_truthy': 0, 'loader_returned_none': 0}
    tests run: 849 failures: 0 errors: 0
    ```

    로더는 4번 호출되고 매번 실제로 `branch_guard.py` 를 불러오는 데는 성공하지만
    (`loader_returned_none: 0`), 그 뒤 `resolver(cwd)` 가 truthy 값을 돌려준 적은 **0번**이다
    — 기존 테스트는 전부 `origin` 리모트가 없는 임시 저장소(로컬 폴백 경로만 타는 형태)이거나
    `_default_branch`/`_origin_default_branch` 자체를 mock 으로 대체한다. 이는 라운드 7-9가
    반복해서 찾아낸 바로 그 실패 클래스("판정에 쓰이는 헬퍼를 어떤 테스트도 실행하지 않는다")가
    이번에 새로 만든 코드에 그대로 재현된 것이다.

    이 메커니즘이 **현재 잘못 동작한다는 증거는 없다** — 별도 스크래치에서 실제 `origin`
    리모트(로컬 bare repo, 기본 브랜치명 `trunk`)를 `git clone` 으로 구성해 직접 구동하니
    올바르게 동작했다:

    ```
    $ git init --bare -b trunk .../origin.git
    $ git clone -q .../origin.git .../clone   # git clone → refs/remotes/origin/HEAD 자동 설정
    $ python3 -c '... gp._default_branch(clone) ...'
    default_branch: trunk
    ```

    즉 지금 당장의 판정이 틀렸다는 뜻은 아니다. 다만 `_default_branch()` 는
    `evaluate_review()` 의 `_merge_base` → `changed`(커밋된 변경 목록) 계산에 직결되는,
    판정을 좌우하는 코드다. 이 성공 분기를 지키는 테스트가 하나도 없는 채로, 다섯 개
    함수와 다른 패턴(파일-경로 동적 로딩 + 비공개 `sys.modules` 키)으로 짜여 있다는 것
    자체가 향후 리팩터(예: "이 importlib 우회를 정리하자" 류의 정리 커밋)가 조용히
    이 경로를 깨도 어떤 테스트도 RED 로 만들지 못한다는 뜻이다. 이 저장소는 정확히 이
    클래스의 결함(손-복제/미검증 판정 헬퍼)을 이미 세 라운드에 걸쳐 겪었다.
  - 제안: `_origin_default_branch` 의 정본 구현을 `branch_guard.py` 에서
    `_shared/git_probe.py` 자신으로 옮기고, `branch_guard.py` 는 다른 다섯 함수와 동일하게
    `_origin_default_branch = _git_probe._origin_default_branch` 형태로 참조만 하도록
    바꿀 것. 그러면 `_shared` → `hooks/_lib` 역방향 의존, `importlib` 이중 로딩, 비공개
    `sys.modules` 키가 전부 사라지고 `_shared/__init__.py` 의 소유권 규칙과도 다시
    일치한다. 최소한, 실제 `origin` 리모트를 가진 저장소(위 재현 방식)로 성공 분기를
    구동하는 회귀 테스트를 `GitProbesAreNotReDuplicatedTest` 옆에 추가할 것.

- **[WARNING]** `_shared` 로 향하는 `sys.path` 부트스트랩 3-4줄 관용구가 세 모듈에
  서로 다른 스타일로 손-복제됐다 — 이번 라운드가 그중 두 곳을 새로 추가하면서 만든
  드리프트로, 이 저장소가 "손-동기 쌍은 갈린다" 고 이미 세 번(`report_paths`,
  `retry_state`, doc-sync matrix) 기록한 바로 그 클래스가 한 겹 더 생긴 것이다.
  - 위치: `.claude/hooks/_lib/review_guard.py:120-121,140-141` (기존),
    `.claude/hooks/_lib/plan_guard.py:56-61` (이번 라운드 신규),
    `.claude/hooks/_lib/branch_guard.py:27-33` (이번 라운드 신규)
  - 상세: 세 파일 모두 "`__file__` 에서 `.claude` 디렉터리를 구해 `sys.path` 에 얹고
    `_shared.git_probe` 를 import" 하는 동일한 목적의 코드를 갖지만, 서로 다르게 짜여
    있다 — `review_guard.py` 는 `THIS_DIR` 를 거쳐 `dirname` 을 2번, `plan_guard.py` 와
    `branch_guard.py` 는 `os.path.abspath(__file__)` 에서 바로 `dirname` 을 3번 체인한다.
    `branch_guard.py` 만 `import sys as _sys` 별칭을 쓰고 나머지는 `import sys` 그대로다.
    결과는 동일하지만, 이 저장소 자신의 교훈("손-동기 쌍은 하나가 고쳐지면 다른 것은
    남는다")이 정확히 이런 형태의 반복에서 나왔다. plan 문서(`harness-review-gate-ci-backstop.md`
    §13)는 **테스트 파일**의 유사한 보일러플레이트 중복(4개 파일)만 defer 항목으로
    등재했고, 이번에 프로덕션 코드에 새로 생긴 이 사본은 등재돼 있지 않다.
  - 제안: `.claude/hooks/_lib/` 에 작은 내부 부트스트랩(예: `_lib/__init__.py` 에 한 번,
    혹은 `_bootstrap.py`)을 두고 세 모듈이 그것을 import 하도록 통합할 것.

- **[INFO]** `_shared/git_probe.py` 모듈 docstring 이 이번 커밋 자체가 만든 세 번째
  소비자를 반영하지 못했다.
  - 위치: `.claude/_shared/git_probe.py:1-5`
  - 상세: "`review_guard.py` and `plan_guard.py` each carried byte-identical copies of
    these five functions" 로 시작해 소비자를 둘로만 서술한다. 그런데 이 커밋이 바로
    `branch_guard.py` 를 세 번째 소비자로 만들었다(`_run_git`/`_repo_root` 위임 +
    `_origin_default_branch` 의 역방향 로딩 대상). 함수 하나의 docstring
    (`_origin_default_branch`, 36-45행)에는 그 사정이 적혀 있지만, 모듈 최상단 요약은
    갱신되지 않았다 — 정확히 이 저장소가 반복해서 겪은 "SoT 문서가 그 문서를 바꾼
    커밋 안에서 이미 stale" 클래스의 소규모 사례다.
  - 제안: 모듈 docstring 첫 문단에 `branch_guard.py` 를 세 번째 소비자로, 그리고
    `_origin_default_branch` 의 역방향 로딩 이유를 한 줄로 추가할 것.

- **[INFO]** (확장성 참고, 새 결함 아님) `_shared/__init__.py` 는 `_shared` 가
  `hooks/**` 와 `skills/**` 양쪽의 공통 소비 대상이라고 명시한다. 그런데
  `git_probe._origin_default_branch()` 가 `.claude/hooks/_lib/branch_guard.py` 를
  하드코딩된 상대 경로(`_HOOKS_LIB = dirname(_THIS_DIR)/hooks/_lib`)로 로드한다.
  오늘은 `.claude/skills/**` 어디도 `git_probe` 를 import 하지 않으므로
  (`grep -rl git_probe .claude/skills/` 결과 없음) 살아있는 문제는 아니지만, 장래에
  skills 오케스트레이터가 편의상 `git_probe._default_branch()` 를 가져다 쓰면 그
  호출이 `hooks/_lib` 라는 hooks 전용 모듈을 조용히 끌고 들어온다 — `_shared/__init__.py`
  가 세 번째 `_lib` 패키지를 만들지 않은 이유로 든 "두 `_lib` 이 서로를 가린다" 는
  바로 그 모호성을 뒷문으로 재도입하는 경로다.

## 요약

이번 라운드(9R, 커밋 `e834d0f4e`)는 다섯 개 git 프로브의 손-복제를 `_shared/git_probe.py`
하나로 정확히 통합했고, 그 다섯 함수는 세 훅 모두에서 객체 동일성 + 로컬 재정의 부재
가드까지 걸려 있어 견고하다. 다만 여섯 번째 조각(`_origin_default_branch`)만 통합
패턴을 따르지 않고 `hooks/_lib` 를 파일 경로로 동적 로드하는 역방향 의존으로 처리됐는데,
이는 `_shared` 패키지 자신이 명시한 "hooks/skills 는 소비자일 뿐, 정본을 갖지 않는다"
는 원칙과 같은 커밋 안에서 충돌한다. 실측(849 테스트 계측 + 별도 재현)으로 확인한바
이 메커니즘은 지금 정확하게 동작하지만, 그 성공 분기를 지키는 테스트가 전무해 앞으로의
"정리" 리팩터가 조용히 깨도 스위트는 계속 초록일 수 있다 — 이 저장소가 이미 세 라운드에
걸쳐 겪은 "판정에 쓰이는 헬퍼를 어떤 테스트도 실행하지 않는다" 클래스가 통합 과정에서
새로 생긴 코드에 재발한 형태다. 부수적으로, 그 통합이 새로 필요로 한 `sys.path` 부트스트랩
관용구 자체가 세 모듈에 서로 다른 스타일로 손-복제됐다 — 중복을 없애는 리팩터가 한 단계
위에서 작은 중복을 하나 새로 만든 아이러니다. 이 라운드가 스스로 보고한 결함들(위험도
파싱의 무조건 break, 세 번째 손-복제 사본, env 스캔 사각)은 코드를 직접 대조해 실제로
닫혔음을 확인했고 재발시키는 우회는 찾지 못했다 — 이번에 남는 것은 새 결함이 아니라
이번 라운드가 만든 리팩터 자체의 구조적 잔여 위험이다.

## 위험도

MEDIUM
