# 유지보수성(Maintainability) 코드 리뷰

대상: `.claude/hooks/_lib/mermaid_lint_ready.py`(신규) · `.claude/hooks/lint_mermaid_posttooluse.py` ·
`.claude/tools/bootstrap-session.sh` · `.githooks/pre-commit` ·
`.claude/tests/test_bootstrap_mermaid_install.py` · `.claude/tests/test_mermaid_lint_ready.py`(신규)

리뷰 범위 확인: origin/main(`cdad5a1ec`) 대비 이 세션의 실질 diff 는 `bbf72268e`(마커+mkdir 락)
+ `d31f99a11`(락 liveness·throttle·공유 판정 SoT, 직전 `/ai-review` 20_06_45 의 Warning 반영).
`d31f99a11` 는 이전 리뷰가 지적한 env-구성 중복(WARNING)을 `_env()` 헬퍼로 해소했고,
`mermaid_lint_ready.py`/`test_mermaid_lint_ready.py`/`pre-commit`·`lint_mermaid_posttooluse.py`
의 `is_ready` 연동은 이전 리뷰가 본 적 없는 신규 대상이라 아래는 그 부분에 대한 최초 검토다.

## 발견사항

- **[WARNING]** "mtime 이후 경과 시간" 판정이 같은 파일 안에서 두 가지 다른 기법으로 중복 구현되어 있고, 하나는 설정값 절삭(truncation) 위험이 있음
  - 위치: `.claude/tools/bootstrap-session.sh:80-84`(`_install_throttled`, 초 단위) 대 `:96-104`(`_lock_is_dead`, 특히 98행)
  - 상세: `_install_throttled`은 같은 파일에 정의된 포터블 헬퍼 `_file_mtime()`(74행 위, 77행)과 초 단위 산술 `$(( $(date +%s) - $(_file_mtime "$fail_marker") )) -lt "$retry_after"`로 "마지막 수정 이후 임계값보다 적게 지났는가"를 계산한다. `_lock_is_dead`는 개념적으로 동일한 질문("grace 만큼 지났는가")을 `find "$lock" -maxdepth 0 -mmin "-$(( lock_grace / 60 ))"`로 계산하는데, 이는 초 단위 env 변수 `MERMAID_INSTALL_LOCK_GRACE_SEC`(74행, 기본 600)를 분 단위로 정수 나눗셈해 넘긴다. 기본값 600(정확히 10분)에서는 우연히 정확하지만, 60의 배수가 아닌 값 — 예를 들어 `MERMAID_INSTALL_LOCK_GRACE_SEC=90` — 을 주면 `90/60=1`(bash 정수 나눗셈 절삭)이 되어 `find -mmin -1`은 "60초 이내"를 뜻하게 되고, 실제 보호 구간이 설정한 90초가 아니라 60초로 조용히 줄어든다. 같은 파일에 이미 이 문제를 피할 수 있는 `_file_mtime()`이 있는데도 `_lock_is_dead`는 이를 재사용하지 않고 별도 기법(`find -mmin`)을 택한 것이 원인 — 전형적인 "같은 개념의 두 서로 다른 구현은 결국 갈라진다"는 패턴이다. 테스트 쪽도 이 경로를 보호하지 못한다: `test_bootstrap_mermaid_install.py:86,99-100`의 `_env()/_run()`이 `lock_grace` 파라미터를 받아 `MERMAID_INSTALL_LOCK_GRACE_SEC`로 전달하도록 이미 배선돼 있지만, 실제로 기본값이 아닌 값을 넘기는 호출부는 파일 전체에 하나도 없다(정의부 2곳 외 사용처 0건). 기본값(600, 60 의 배수)만 항상 쓰이는 한 증상은 드러나지 않는다.
  - 제안: `_lock_is_dead`도 `_install_throttled`와 같은 `_file_mtime()` 기반 초 단위 산술로 통일(`(( $(date +%s) - $(_file_mtime "$lock") >= lock_grace ))`). `find -mmin`을 없애면 중복 기법과 절삭 버그가 함께 사라진다. 최소한으로는, `lock_grace`가 60 의 배수가 아닌 값일 때의 동작을 고정하는 테스트 1건을 추가해 회귀를 막을 수 있다.

- **[INFO]** section 2 의 install-attempt 시퀀스가 이번에 새로 생긴 predicate 함수들과 달리 여전히 top-level 인라인 블록
  - 위치: `.claude/tools/bootstrap-session.sh:106-128`
  - 상세: 이번 변경으로 `_file_mtime`/`_install_throttled`/`_lock_is_dead` 세 헬퍼 함수가 새로 생겼지만, 정작 "락 획득 → npm install → 성공/실패 처리 → 소유권 확인 후 해제"로 이어지는 핵심 흐름(약 20줄, 최대 3단 중첩: 바깥 `if` → `if mkdir` → `if npm install`)은 함수로 감싸이지 않고 스크립트 top level 에 그대로 남아 있다. 파일 헤더가 스스로 "Four responsibilities"라 부르는 만큼, 이 블록도 예컨대 `_ensure_mermaid_deps()`로 뽑아내면 파일 상단이 실제로 "번호 매긴 네 단계 호출"로 읽혀 이번 변경이 스스로 세운 함수-단위 스타일과 완전히 일치하게 된다.
  - 제안: (선택) 106-128행을 단일 함수로 추출. 각 분기가 이미 별도 유닛 테스트로 개별 커버되어 있어 급하지 않음.

- **[INFO]** 신규 import 줄이 같은 디렉토리의 다른 훅이 쓰는 `THIS_DIR` 관례를 따르지 않음
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:38` 대 `.claude/hooks/guard_review_before_push.py:34-35`(및 `guard_review_before_stop.py` 동일 패턴)
  - 상세: 두 파일은 `THIS_DIR = os.path.dirname(os.path.abspath(__file__))`를 모듈 상수로 선언한 뒤 `sys.path.insert(0, os.path.join(THIS_DIR, "_lib"))`로 재사용한다. 이번에 추가된 `lint_mermaid_posttooluse.py:38`은 같은 계산을 `THIS_DIR` 없이 한 줄에 인라인한다(`sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))`). 동작은 동일하지만 같은 디렉토리 내 기존 관례에서 벗어난 표기.
  - 제안: `THIS_DIR` 상수를 선언하고 재사용하도록 한 줄 정리(선택, 순수 스타일).

- **[INFO]** 같은 파일 안 두 타임아웃 리터럴 중 하나만 이름 붙은 상수
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:43`(`_NODE_TIMEOUT = 20.0`, named) 대 `:76`(`timeout=5.0`, `_resolve_tool_dir`의 git subprocess 호출에 inline)
  - 상세: 두 값 모두 "하위 프로세스가 멈춰도 훅을 영원히 막으면 안 된다"는 동일한 방어적 의도이지만, 하나는 모듈 상수로 이름·주석이 붙어 있고 다른 하나는 호출부에 숫자로 그대로 박혀 있다. `_resolve_tool_dir` 자체는 이번 diff 대상이 아니라 부수적 관찰.
  - 제안: (선택) `_GIT_TIMEOUT = 5.0` 정도로 이름 붙이면 두 타임아웃이 같은 패턴을 따르게 된다.

- **[INFO]** section 3 의 GC 임계값(30일)이 이번 변경이 section 2 에 도입한 "이름+주석+env override" 패턴과 나란히 보면 스타일이 어긋남
  - 위치: `.claude/tools/bootstrap-session.sh:130-138`(`-mtime +30`, 인라인) 대 `:74-75`(`lock_grace`, `retry_after`, 둘 다 `${ENV_VAR:-default}` + 주석)
  - 상세: section 3 은 이번 diff 대상이 아니라 결함은 아니지만, 바로 위 section 2 가 이번에 "임계값은 이름 붙이고 env 로 override 가능하게" 라는 패턴을 막 세웠기 때문에, 옆에서 인라인 리터럴로 남아있는 `+30`이 상대적으로 눈에 띈다.
  - 제안: 시급하지 않음. section 3 을 건드릴 일이 생기면 같은 패턴(예: `stale_state_days="${MERMAID_STATE_GC_DAYS:-30}"`)으로 맞추는 것을 고려.

- **[INFO]** 테스트 주석이 프로덕션 기본값(600초)을 별도 언어로 재서술
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:219`
  - 상세: `test_live_but_slow_lock_is_not_stolen_even_when_aged`의 주석 `# default grace 600s → aged, but owner is alive`은 `bootstrap-session.sh:74`의 기본값(600)을 파이썬 주석으로 재서술한다. 두 값이 서로 다른 언어(bash 리터럴 vs 파이썬 주석)로 독립 서술되므로, 향후 기본값이 바뀌면 이 주석만 stale 해질 수 있다 — 다만 `age_seconds=3600`이 어떤 합리적 기본값보다도 훨씬 크므로 assertion 자체가 깨지지는 않는다(문서 drift 위험일 뿐 테스트 정확성 위험은 아님).
  - 제안: 조치 불요(문서적 관찰).

## 요약

이번 변경(`bbf72268e`+`d31f99a11`)은 이전 `/ai-review`(20_06_45, MEDIUM)가 지적한 세 Warning — stale-lock 탈취를 경과시간이 아닌 PID 생존으로 판정, `pre-commit`/`PostToolUse`/`bootstrap` 세 소비처의 "설치됨" 판정을 `_lib/mermaid_lint_ready.py` 공유 SoT 로 통일, 실패 재시도 throttle 추가 — 를 모두 반영했고, 그 자체로 이전에 지적된 테스트 env 구성 중복(`_env()` 추출)도 해소했다. 신규 `mermaid_lint_ready.py`는 작고 목적이 분명하며, `test_mermaid_lint_ready.py`는 두 개의 `_lib` 패키지가 공존하는 이 저장소의 기존 `_harness.load_module_by_path` 관례를 프로덕션 import 방식과 정확히 일치시켜 사용한다. `bootstrap-session.sh`는 상세하고 정확한 "왜" 주석과 다수의 유닛 테스트(락 보유 중 skip·stale 락 탈취·liveness 비탈취·throttle 등)로 늘어난 복잡도를 뒷받침한다. 유일하게 실질적인 지적은 `_lock_is_dead`가 같은 파일의 `_file_mtime` 초 단위 헬퍼를 재사용하지 않고 `find -mmin` 분 단위 변환을 별도로 써서, 60 의 배수가 아닌 `MERMAID_INSTALL_LOCK_GRACE_SEC` 값에서 grace 구간이 조용히 절삭될 수 있다는 점이다(기본값 600 에서는 무증상이고 회귀 테스트도 이 경로를 exercise 하지 않는다). 나머지는 모두 선택적 스타일/일관성 관찰(INFO)이며 동작에 영향이 없다. 전반적으로 가독성·네이밍·테스트 커버리지가 높아 병합을 막을 사유는 없다.

## 위험도

LOW
