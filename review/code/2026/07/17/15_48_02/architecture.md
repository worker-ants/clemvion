# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `review_guard.py` 의 "fail loudly" import 전략이 파일 내 기존 로컬 폴백 패턴과 비대칭이며, 실패 시 파급 범위가 의도보다 넓다
  - 위치: `.claude/hooks/_lib/review_guard.py:101-118` (`_origin_default_branch` try/except vs 바로 아래 `_shared.report_paths` 무조건 import)
  - 상세: 같은 파일 상단(101-106행)의 `from branch_guard import _origin_default_branch` 는 `try/except` 로 감싸 실패 시 `None` 으로 **국소적으로만** 폴백한다(`_default_branch()` 가 `None` 을 명시적으로 처리해 `main`/`master` 직접 프로브로 대체). 반면 바로 아래 추가된 `from _shared import report_paths as _report_paths_lib` 는 의도적으로 try/except 없이 두었고, 주석은 "silent import failure 가 coverage gate 를 전부 통과시키는 실패 모드를 막기 위해 fail loudly 한다" 고 설명한다. 그런데 이 import 가 실패하면(`_shared/__init__.py` 부재, `.claude/_shared/report_paths.py` 구문 오류 등) 예외는 `review_guard.py` 모듈 최상위에서 즉시 raise 되고, 이를 잡는 곳은 이 파일이 아니라 **호출자** `guard_review_before_push.py`/`guard_review_before_stop.py` 의 `try: from review_guard import evaluate_review except Exception: ... evaluate_review = None` 이다 — 즉 실제로는 "coverage 서브체크만 조용히 통과" 대신 **REVIEW 게이트 전체**(freshness·resolution 판정 포함)가 비활성화된다. traceback 은 stderr 에 출력되긴 하지만(완전한 silent 는 아님), `_forced_coverage_missing()` 내부에서 국소적으로 폴백해 "coverage 판정만 실패로 간주"하는 것보다 파급 범위가 훨씬 크다. 이는 이 파일 자신의 `_origin_default_branch` 처리 패턴(국소적 스코프의 graceful degradation)과 다른 전략이며, 그 트레이드오프(넓은 파급 범위 vs 진단 가시성)가 주석에 명시적으로 인정되지 않는다.
  - 제안: 의도가 "coverage 판정 실패를 조용히 통과로 오인하지 않는다" 라면, import 자체보다 `_forced_coverage_missing()` 내부에서 `_report_paths_lib` 부재를 감지해 **그 함수만** fail-closed(모든 forced reviewer 를 missing 으로 간주)하거나 최소한 별도의 명확한 stderr 경고를 내는 것이 더 좁은 blast radius 를 준다. 현재 방식을 유지한다면, 주석에 "이 실패가 호출자의 broad try/except 를 거쳐 게이트 전체를 비활성화한다" 는 사실을 명시해 향후 유지보수자가 `_origin_default_branch` 패턴과의 불일치에 놀라지 않도록 한다.

- **[INFO]** `report_paths()`/`missing_reports()` 의 벌크 연산이 단건 조회를 재사용하며 O(n²) 패턴이 됨
  - 위치: `.claude/_shared/report_paths.py:132-141`, `152-156`
  - 상세: `report_paths()` 는 각 invocation 마다 `report_path()` 를 호출하고, `report_path()` 는 다시 `state["subagent_invocations"]` 전체를 선형 탐색(`next(...)`)한다. 벌크 함수 하나가 원래는 단일 순회로 dict 를 구성했던 이전 구현(각 orchestrator 의 옛 `_report_paths`)보다 알고리즘적으로 비효율적이다. `missing_reports()` 도 이름별로 `has_report()` → `report_path()` 재탐색을 반복한다.
  - 제안: 현재 agent 수(≤14 정도)에서는 실질적 영향이 없는 의도적 DRY 우선 트레이드오프로 보이며 액션이 필수는 아니다. 다만 이 모듈이 더 많은 소비자·더 큰 `subagent_invocations` 를 다루게 될 경우를 대비해 `report_paths()` 내부에서 `{inv["name"]: inv.get("output_file")}` 딕셔너리를 한 번만 구성한 뒤 `report_path()` 와 공유하는 선형 버전을 고려할 수 있다.

- **[INFO]** `.claude/_shared` 를 참조하는 3곳 모두 `_CLAUDE_DIR` 계산과 `sys.path` 부트스트랩을 각자 재구현
  - 위치: `.claude/hooks/_lib/review_guard.py:98-99`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:28-34`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:860-867`
  - 상세: 이번 리팩터가 제거한 것은 "리포트 경로 판정 정책" 의 중복이지, 그 정책 모듈에 도달하기 위한 `sys.path` 배선 자체는 3곳 모두 여전히 각자 구현한다(`__file__` 기준 `.claude/` 까지 상대경로를 재계산 후 `sys.path.insert`). 다만 이는 이 diff 가 새로 만든 패턴이 아니라 `lib`/`_lib` import 를 위해 이미 존재하던 동일한 부트스트랩 관례를 한 줄 확장한 것이며, 프로젝트가 "harness Python 은 서드파티 의존성 0" 을 명시적으로 표방하는 제약(`_harness.py` 헤더) 하에서 setuptools/PYTHONPATH 중앙화 없이 스크립트가 자기 위치를 스스로 찾는 기존 스타일과 일관된다.
  - 제안: 액션 불필요. 향후 4번째 소비자가 생긴다면 이 부트스트랩 자체를 헬퍼화할지 재고할 만하다는 정도의 참고 사항.

## 요약

핵심 변경(`.claude/_shared/report_paths.py` 신설)은 "세션 디렉토리 기준 anchor + non-empty 검증" 이라는 하나의 정책을 push/stop 게이트(`review_guard.py`)와 두 orchestrator CLI(`code_review_orchestrator.py`, `consistency_orchestrator.py`) 3곳에서 각자 구현하며 실제로 발생했던 드리프트(같은 빈 리포트를 CLI 는 OK, 게이트는 차단으로 판정)를 근본 해결한다. `_shared` 를 `hooks`/`skills` 어느 쪽에도 속하지 않는 제3의 최상위 패키지로 둔 결정은 두 레이어 사이에 새로운 방향성 의존(hooks→skills 또는 그 역)을 만들지 않으면서 공통 하위 모듈에 의존하게 하는 올바른 계층화이며, 모듈 자신은 `os` 외 의존성이 없는 순수·무상태 함수 4개로 응집도가 높고 범위가 좁다(향후 "무엇이 `_shared` 에 들어갈 자격이 있는가" 에 대한 가드레일도 `__init__.py` docstring 에 명시). grep 로 재검증한 결과 동일 패턴의 잔여 중복은 없었고, 신설된 `test_report_paths_shared.py::AgreementTest` 는 두 실제 소비자(게이트 함수 + 실제 CLI 서브프로세스)가 동일 판정을 내리는지를 직접 검증해 "단일 진실 공급원" 주장을 문서상의 약속이 아니라 자동 검증되는 불변식으로 승격시켰다는 점에서 특히 우수하다. 관련 테스트(harness 265건, frontend sidebar 11건)를 직접 실행해 모두 통과함을 확인했다. 유일한 주목할 지점은 `review_guard.py` 가 새 의존성을 "fail loudly" 로 처리하기로 한 설계가, 같은 파일의 기존 로컬 폴백 패턴과 달리 호출자의 broad try/except 를 거쳐 게이트 전체를 비활성화하는 더 넓은 파급 범위를 낳는다는 점인데, 실제 "wedge"(세션 중단)는 발생하지 않고 합리적 반론도 가능한 트레이드오프라 WARNING 수준으로만 표기했다. 프론트엔드 `sidebar-test-utils.tsx` 추출도 vitest 호이스팅 제약을 정확히 문서화하며 과도한 추상화 없이 공유 가능한 부분만 딱 추출한 절제된 리팩터다.

## 위험도
LOW
