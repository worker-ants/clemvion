# 테스트(Testing) 리뷰 — mermaid-lint 설치 가드 + 소비처 배선 (7개 파일)

검증 방법: 정적 리뷰에 그치지 않고 실제로 실행·재현했다. (1) `test_bootstrap_mermaid_install.py`(16건)·`test_mermaid_lint_ready.py`(12건)를 개별 실행 — 전량 통과. (2) `git diff origin/main`으로 실제 diff 범위를 재확인(merge-base=`cdad5a1ec`, 7개 파일 837줄 추가/9줄 삭제) — reap/anchor 로직(`--keep`, bootstrap-session.sh §4)은 이번 diff **밖**(이전 PR에서 이미 병합·`test_reap_merged_worktrees.py`로 테스트됨)임을 확인하고, 이번 diff가 실제로 건드리는 표면(mermaid-lint 설치 가드 전체: 마커·mkdir 락·liveness·throttle·소비처 배선)에 집중했다. (3) 직전 리뷰 라운드(`review/code/2026/07/18/00_59_56`)의 SUMMARY·RESOLUTION을 읽고 testing 관련 W3·W8·W9·W13(및 관련 W1/W7/W10/W11)이 실제로 코드·테스트에 반영됐는지 라인 단위로 대조 — 전건 확인됨(아래 요약 참조). (4) 이번 라운드 신규 발견을 위해 `lint_mermaid_posttooluse.py`의 import fail-open 분기(`is_ready is None`)를 스크래치 디렉터리에서 3단계 뮤테이션으로 직접 재현(아래 WARNING 참조).

## 발견사항

- **[WARNING]** 신규 import-실패 fail-open 분기(`is_ready is None`)와 그 형제인 셸 쪽 "공유 판독기 부재" 분기가 실행 기반 테스트로 전혀 보호되지 않는다 — 오탐 차단(false-positive block) 뮤턴트로 직접 재현
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:39-51`(`try: from mermaid_lint_ready import is_ready … except Exception: … is_ready = None`) 및 `:116`(`if is_ready is None or not is_ready(tool_dir):`) / `.githooks/pre-commit:58`(`if [ -f "$mermaid_ready" ] && python3 "$mermaid_ready" "$mermaid_tool_dir" \`).
  - 상세: 이번 PR이 W7 조치로 추가한 "import 실패 시 명시적으로 `is_ready=None`" 분기는 어떤 테스트에서도 실제로 import를 실패시켜 본 적이 없다 — `test_mermaid_lint_ready.py`의 실행 기반 테스트(`PostToolUseExecutionTest`/`PreCommitExecutionTest`, W8로 신설)는 모두 "정상 import + 마커 부재"로 `not ready`를 만들 뿐, "import 자체가 깨짐"은 어디에도 구성되지 않는다. `.githooks/pre-commit:58`의 `[ -f "$mermaid_ready" ]`(공유 판독기 스크립트 자체가 부재/구버전 체크아웃)도 동일 계보의 미검증 최전방 분기다 — `PreCommitExecutionTest.setUp`이 항상 이 파일을 복사해두므로 "부재" 케이스는 구성된 적이 없다.
    스크래치 디렉터리에서 직접 실증(3단계): (a) `_lib/mermaid_lint_ready.py`를 구문 오류로 깨고 실행 — 현재 코드는 올바르게 exit 0 + "skipped" 로 fail-open함을 확인(정상). (b) fallback 값의 극성만 바꾼 뮤턴트(`is_ready = None` → `is_ready = lambda *_: True`, "혹시 몰라 스킵하지 말자"는 식의 그럴듯한 미래 리팩터 실수를 흉내)를 만들고, `node_modules`가 없어 실제 lint 스크립트가 `ERR_MODULE_NOT_FOUND`로 죽는 현실적 상황을 재현 — **`mermaid syntax error… Fix the \`\`\`mermaid block so it parses.`라는 완전히 오도된 메시지와 함께 exit 2(작업 차단)**가 나왔다. 즉 이 분기가 깨지면 "조용히 fail-open"이 아니라 **엉뚱한 이유로 실제 작업을 막는 오탐 차단**으로 귀결될 수 있음을 실측으로 확인했다 — 이 PR 전체가 표적으로 삼는 "무신호/오신호 회귀" 클래스 그 자체이며, 정확히 W8이 고친 두 분기(`is_ready(tool_dir)`의 boolean 반전)와 동일한 성격의 **또 다른** 미검증 분기다. 현재 배포 코드 자체는 올바름을 실행으로 확인했다 — "지금은 맞지만 지켜주는 안전망이 없는" 상태.
  - 제안: `lint_mermaid_posttooluse.py`를 스크래치 디렉터리에 복사하고 `_lib/mermaid_lint_ready.py`를 고의로 깨뜨리거나 부재시킨 상태로 서브프로세스 실행해 exit 0 + "skipped" 메시지를 확인하는 테스트 1건, `.githooks/pre-commit`을 `mermaid_ready`(또는 `mermaid_script`) 파일 없이 구동해 mermaid 블록이 깨져 있어도 커밋이 허용됨을 확인하는 테스트 1~2건을, 기존 `PostToolUseExecutionTest`/`PreCommitExecutionTest` 패턴 그대로 추가.

- **[INFO]** `test_bootstrap_mermaid_install.py`의 `_env()`가 `MERMAID_INSTALL_LOCK_GRACE_SEC`만 조건부로(명시적으로 넘겨받았을 때만) 오버라이드하고, 형제 변수 `MERMAID_INSTALL_RETRY_SEC`는 항상 고정한다 — 테스트 격리 비대칭
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:99-118`(`_env`), 특히 `:106`(`env = dict(os.environ)`)·`:111`(`MERMAID_INSTALL_RETRY_SEC`는 항상 세팅)·`:112-113`(`MERMAID_INSTALL_LOCK_GRACE_SEC`는 `lock_grace is not None`일 때만 세팅).
  - 상세: `lock_grace=None`(기본값)으로 호출되는 대다수 테스트(`test_live_but_slow_lock_is_not_stolen_even_when_aged`·`test_dead_pid_lock_is_stolen`·`test_stale_lock_is_stolen_so_it_cannot_wedge_forever` 등, 프로덕션 기본값 600초에 의존)는 `dict(os.environ)`로 복사된 **테스트 실행 프로세스의 실제 환경**에 우연히 `MERMAID_INSTALL_LOCK_GRACE_SEC`가 세팅돼 있으면 그 값을 그대로 물려받는다. 실제로 이런 환경변수를 셸 프로파일에 export해둘 개연성은 낮아 현재 실질 위험은 낮지만(재현하지 않음, 의도적으로 낮은 우선순위 표기), `MERMAID_INSTALL_RETRY_SEC`는 정확히 이 문제를 피하려고 매번 명시적으로 고정해두면서 바로 옆 변수는 그렇게 하지 않은 비대칭이 눈에 띈다.
  - 제안: `_env()`에서도 `env["MERMAID_INSTALL_LOCK_GRACE_SEC"] = str(lock_grace if lock_grace is not None else 600)`처럼 항상 명시적으로 고정(또는 최소한 조건부 분기 없이 `env.pop(...)`으로 상속을 차단).

- **[INFO]** 사소한 미검증 경계값/사용법 분기 — 코드 추적 결과 현재 동작에 이상은 없으나 pin하는 테스트가 없음(일괄 기재, 우선순위 낮음)
  - `mermaid_lint_ready.py:49-53`(`main(argv)`)의 `len(argv) != 1`(인자 개수 오류, exit 2) 분기 — 실사용상 `.githooks/pre-commit`이 항상 정확히 1개 인자로만 호출해 위험은 낮음.
  - `MERMAID_INSTALL_LOCK_GRACE_SEC`/`MERMAID_INSTALL_RETRY_SEC`에 `0`·음수·비숫자 값이 들어왔을 때의 동작(`bootstrap-session.sh`의 `_lock_is_dead`·`_install_throttled` 내부 산술) — 코드 추적 결과 비숫자는 두 함수가 서로 다르게 폴백하지만(하나는 "탈취 안 함", 하나는 "스로틀 안 함") 어느 쪽도 세션을 막지는 않는다. 사람이 셸에서 직접 잘못된 값을 export해야 하는 시나리오라 위험은 낮음.
  - 이전 라운드(00_59_56 I13)가 이미 지적한 "죽은 owner PID 락 1개 + 동시 접근 N 프로세스" 스트레스 테스트 부재 — `test_concurrent_sessions_install_at_most_once`(콜드스타트, 락 없음)와 `test_dead_pid_lock_is_stolen`(단일 프로세스)의 조합 지점만 비어 있다. 이번 세션에서도 여전히 미조치임을 재확인(RESOLUTION.md가 I-항목 전체를 "조치 불요"로 명시).

## 요약

이번 diff(merge-base `cdad5a1ec` 이후 7개 파일, mermaid-lint 설치 가드 전체)는 이미 한 차례 자체 리뷰(00_59_56)를 거쳐 testing 관련 W1·W3·W8·W9·W10·W11·W13을 코드/테스트로 정확히 해소했음을 라인 단위로 직접 대조 확인했고, 두 신규 테스트 파일(28건)을 직접 실행해 전량 통과를 재확인했다. 테스트 설계 품질은 전반적으로 높다 — 실제 git repo·실제 subprocess·실제 프로세스 liveness(`kill -0`) 위에서 검증하고, mock은 물리적으로 구성 불가능한 상태(`test_marker_without_node_modules_dir_is_not_ready`, 두 파일 통틀어 유일한 mock 사용처)에만 국한하며, 각 테스트가 어느 리뷰 라운드의 어느 WARNING을 pin하는지 docstring/주석에 명시해 추적성이 뛰어나고, `addCleanup` 기반 격리로 테스트 간 의존성도 없다. 다만 이번 라운드에서 새로 발견한 것은, W7이 추가한 import-실패 fail-open 분기(및 그 셸 쪽 형제 분기)가 W8이 고친 "소비처 배선"과 사실상 같은 종류의 미검증 최전방 게이트라는 점이다 — 뮤테이션으로 직접 재현한 결과 이 분기가 깨지면 단순 fail-open이 아니라 **엉뚱한 이유로 실제 작업을 막는 오탐 차단**(오도된 "mermaid syntax error" 메시지 + exit 2)으로 귀결될 수 있어, 이 PR이 표적으로 삼은 문제 클래스 그 자체가 안전망 없이 남아 있다. 그 외에는 우선순위 낮은 테스트 격리 비대칭 1건과 이미 추적 중인 사소한 경계값 미검증 몇 건뿐이며, 현재 배포되는 실제 동작 자체에는 결함이 없다(전부 실행으로 정상 동작 확인).

## 위험도

LOW
