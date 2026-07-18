# Performance Review — review/code/2026/07/18/12_31_29

대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.github/dependabot.yml`, `.claude/tools/mermaid-lint/package-lock.json`, `PROJECT.md`
(commit `c5fdd1bb8` — 직전 리뷰 round `2026/07/18/12_06_58` W1 "마커가 lockfile 과 무관해 보안
픽스가 기존 checkout 에 전파되지 않음" 에 대한 후속 fix. 실제 코드 diff 는
`bootstrap-session.sh`(+34/-3)·`test_bootstrap_mermaid_install.py`(+32) 두 파일에 집중되고,
`dependabot.yml`/`PROJECT.md`/`package-lock.json` 은 CI 설정·문서·의존성 버전 텍스트 diff 라
런타임 성능 관점에서 별도 이슈 없음)

## 발견사항

- **[WARNING]** 동시 재설치 경합(race)의 노출 빈도가 "최초 1회"에서 "매 lockfile 변경마다 반복"으로
  확대됐는데, 그 경합을 감수하기로 한 "NO LOCK" 설계 노트는 여전히 "최초 cold install" 로만 범위를
  서술 — diff 로 갱신되지 않음
  - 위치: `.claude/tools/bootstrap-session.sh:63-87`(NO LOCK 설계 노트 — 특히 L73
    `"several sessions hitting the *first* cold install"`, L84
    `"acceptable rare first-install-only window"`) ↔ L112-134(이번 diff 가 추가한 `need_install`
    트리거 로직) ↔ `.claude/tests/test_bootstrap_mermaid_install.py:394-420`
    (`test_concurrent_cold_start_converges_and_then_stops_reinstalling`)
  - 상세: diff 이전에는 install 트리거가 `[ ! -f "$marker" ]` 단 하나뿐이었다 — "이 checkout 에
    마커가 아직 한 번도 없을 때"만 참이므로, 동시-설치 경합(여러 worktree 세션이 `main_root` 공유
    디렉토리의 같은 `node_modules` 에 동시에 `npm install`)은 사실상 저장소 최초 클론 직후의
    1회성 창(window)이었다. 이번 diff 는 `need_install` 조건을 "마커 부재 OR 해시 불일치"로
    확장했고(L117-123), 이는 RESOLUTION.md 가 명시하는 의도된 목표(“lockfile 이 바뀌면 = 모든
    보안 PR 의 형태 = 다음 SessionStart 가 재설치한다”)다. 즉 main 체크아웃의
    `package-lock.json` 이 바뀔 때마다 — 즉 향후 모든 Dependabot 보안 PR 머지 시점마다 — 동일한
    "여러 세션이 동시에 need_install=1 을 관측하고 동시에 npm install 로 들어간다"는 경합이
    반복적으로 재발한다. 그런데 바로 위 "NO LOCK, deliberately" 설계 노트(L63-87)는 이 diff 로
    갱신되지 않았고, 여전히 "first cold install"·"rare first-install-only window" 라고만
    서술한다. 이 노트가 이미 스스로 명시하는 최악의 경우(L74-83) — 잠금 없는 동시 `npm install` 이
    tree 를 깨뜨리고(`npm is not concurrency-safe into one dir`), corrupt-but-marked tree 가
    `lint-mermaid.mjs` 의 guardless top-level `await import("mermaid")` 를 크래시시켜, pre-commit
    / PostToolUse 가 이를 "malformed mermaid block" 으로 오판해 **모든 markdown commit 을
    차단**(fail-open 계약의 정반대) — 이 이제는 저장소 생애주기 동안 주기적으로 열리는 창인데도
    문서는 여전히 "희귀한 1회성"으로 과소평가한다. 회귀 테스트 측에서도
    `test_concurrent_cold_start_converges_and_then_stops_reinstalling` 은 이름·픽스처 그대로
    cold-start(마커·lockfile 둘 다 없는 최초 설치) 시나리오만 커버하며(setUp 은
    `package-lock.json` 자체를 만들지 않아 그 테스트에서는 `want_hash` 가 항상 빈 문자열이라
    해시-불일치 분기가 아예 실행되지 않는다), "마커가 이미 존재하는 상태에서 lockfile 이 바뀌어
    여러 세션이 동시에 재설치를 트리거"하는, 이번 diff 가 새로 연 경로는 어떤 테스트로도
    커버되지 않는다.
  - 제안: (a) 최소 조치로 L73/L84 주석을 "cold install 뿐 아니라 이후 매 lockfile 변경 시점에도
    반복되는 창"으로 정정해, 향후 유지보수자가 이 트레이드오프의 실제 노출 빈도를 정확히 인지하도록
    한다. (b) 스크립트가 이미 추적 중인 후속 항목("fcntl.flock for genuine mutual exclusion,
    plan §G")의 우선순위를 이 diff 를 계기로 재평가한다 — 경합이 "일생에 한 번"에서 "정기
    반복"으로 바뀐 이상 그 후속 항목의 긴급도도 같이 올라간다. (c) 선택: 마커가 이미 존재하는
    상태에서 lockfile 변경으로 인해 여러 세션이 동시에 재설치를 트리거하는 경우를 pin 하는 테스트를
    `test_concurrent_cold_start_*` 와 대칭으로 추가해, 적어도 "convergence" 속성만은 보장됨을
    회귀 고정한다.

- **[INFO]** lockfile 해시 계산이 SessionStart 의 "아무 작업도 필요 없는" 정상 경로에도 매번 새
  subprocess 를 추가 — 지연 로딩 여지
  - 위치: `.claude/tools/bootstrap-session.sh:100-103`(`_lock_hash()`), `:115`
    (`want_hash=$(_lock_hash)`)
  - 상세: diff 이전 install 필요 여부 판정은 `[ -f "$marker" ]` shell builtin 테스트 하나로
    subprocess 0개였다. 이번 diff 는 `if [ -f "$tool_dir/package.json" ]`(L117) 진입 여부와
    무관하게 L115 에서 `_lock_hash()` 를 무조건 먼저 실행한다 — `shasum`(macOS 기본, Perl 기반)
    또는 `sha256sum` 프로세스 1개 + `cut` 프로세스 1개가, 설치가 이미 최신이라 아무 일도 안 해도
    되는 정상/반복 경로에서도 매 세션 시작마다 spawn 된다. 현재 `package-lock.json` 은 61KB 라
    해싱 자체 비용은 무시할 수준(<10ms 대)이고 실사용 체감 지연은 아니다. 다만 (i)
    `$tool_dir/package.json` 이 아예 없는 경우(이 harness 를 채택했지만 mermaid-lint 도구는 두지
    않은 다른 저장소 등, `.claude/` 하네스는 프로젝트 재사용을 전제로 설계됨 — `PROJECT.md` 상단
    참고)에도 `if` 가드 진입 전에 무조건 해시를 시도해 파일 부재로 인한 실패 subprocess 만 남기고,
    (ii) SessionStart 는 여러 worktree 에서 세션을 새로 열 때마다 반복 실행되는 hot path 라는
    점에서 "필요할 때만 계산"이라는 지연 로딩 원칙에서 다소 벗어난다.
  - 제안: `want_hash=$(_lock_hash)` 호출을 `if [ -f "$tool_dir/package.json" ]` 블록 내부(가능하면
    마커가 실제로 존재해 비교가 필요한 시점, 혹은 install 직전)로 옮겨 지연 계산으로 전환.
    현재 파일 크기·호출 빈도로는 실효 이득이 미미해 비차단(non-blocking) 권고.

## 요약

핵심 diff(`bootstrap-session.sh` 의 `_lock_hash`/`need_install` 로직)는 알고리즘 복잡도·메모리·N+1·
블로킹 I/O 관점에서 새로운 병목을 만들지 않는다 — 추가된 연산은 61KB 파일에 대한 sha256 해시 1회뿐이고,
이는 오히려 마커를 lockfile 내용에 결속하는 올바른 캐시 무효화 개선(이전 리뷰 W1 "설치 완료 표시가
실제 설치 내용과 무관해 보안 픽스가 전파되지 않음"을 정확히 닫는다)이다. 다만 이 개선이
`need_install` 트리거를 "최초 1회"에서 "매 lockfile 변경마다"로 넓히면서, 바로 위에 있던 "NO LOCK,
deliberately" 설계 노트의 위험도 서술("rare first-install-only window")이 diff 로 갱신되지 않아
실제 노출 빈도와 어긋나게 됐다 — 잠금 없는 동시 `npm install` 이 공유 `node_modules` 를 손상시키고,
손상된-그러나-마킹된 tree 가 향후 모든 markdown commit 을 오탐으로 차단할 수 있다는, 스크립트가 이미
자인한 최악의 경우가 이제 저장소 생애주기 동안 반복적으로 재발할 수 있는데도 회귀 테스트는 이 경로를
커버하지 않는다. 그 외에는 해시 계산이 정상/skip 경로에도 무조건 실행되는 사소한 지연 로딩 여지가
있으나 파일 크기(61KB)를 감안하면 체감 영향은 없다. `dependabot.yml`(CI 스케줄 설정)·`PROJECT.md`
(문서 1문장)·`package-lock.json`(버전 텍스트 diff)은 런타임 성능과 무관하다.

## 위험도
LOW
