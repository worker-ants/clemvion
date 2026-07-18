# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — `concurrency`·`side_effect` 두 reviewer 가 **독립적으로 실측 재현**한 stale-lock 탈취 TOCTOU 로 인해, 이 PR 이 없애려던 "동일 `node_modules` 트리에 `npm install` 동시 실행"이 다른 경로로 재도입된다.

> **주의 — 판정 상충 명시**: `requirement.md` 는 같은 코드 지점(`_lock_is_dead` → `rm -rf` → `mkdir`)의 이론적 TOCTOU 를 "신규 아님, 이미 20_06_45·00_59_56 두 라운드에서 평가·수용됨, 코드·테스트 불변이라 새 근거 없음"이라며 **INFO** 로 재확인했다. 그러나 그 과거 두 라운드가 근거로 든 "600회 스트레스에도 재현 못 함"은 **바깥 마커 게이트**(`[ ! -f "$marker" ]`, 사전 락 없이 살아있는 정상 설치와 경합) 시나리오를 테스트한 것이며, 이번 라운드에서 `concurrency`·`side_effect` 가 실제로 실측한 것은 **사전에 죽은 owner PID 락이 존재하는 상태에서의 탈취(steal) 레이스**로 **다른 코드 경로**다. 이 경로는 과거 스트레스 테스트가 애초에 구성한 적이 없는 조건이며, 이번에 두 reviewer 가 각각 독립적으로(15-way/20회 시행, N=10~30 다회 시행) **거의 매 시행마다** 동시 `npm install` 을 재현했다. 즉 `requirement.md` 의 "이미 평가·수용된 낮은 리스크"라는 프레이밍은 **이번 라운드의 신선한 실측 증거로 대체(supersede)** 되며, 이를 근거로 전체 위험도를 낮게 읽어서는 안 된다.
>
> **forced(router_safety) 화이트리스트**: `maintainability, requirement, scope, security, side_effect, testing` 6명 전원 결과 확보됨 — 강제 목록 미이행 없음. (다만 `routing_status=skipped` 라 forced 여부와 무관하게 14명 전원이 이번 라운드에 실행됨.)

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C1 | concurrency / side_effect | mkdir 락의 stale-lock "탈취(steal)" 로직이 **판정(`_lock_is_dead`)과 행동(`rm -rf`+`mkdir`) 사이 check-then-act 비원자성**을 가져, 두 세션이 동일한 죽은 락을 동시에 관찰하면 한쪽(A)이 정당하게 재획득한 신선한 락을 다른 쪽(B)이 자신의 낡은 판정을 근거로 다시 `rm -rf` 하고 자신도 `mkdir` 에 성공 — 결과적으로 A·B 가 동일 `node_modules` 트리에 `npm install` 을 **동시 실행**한다. **두 reviewer 가 독립적으로 실측 재현**: `concurrency` — 15-way 동시, 죽은 owner PID 스테일 락, **20/20 시행 전부**에서 3~7개 프로세스 동시 설치(grace=0 및 기본 600s+700s 경과 양쪽 확인), 콜드스타트(사전 락 없음) 대조군은 10/10 정확히 1회. `side_effect` — N=10~30 다회 시행, N=10→2회, N=15→6회, N=20→6회, N=30→13/9/4회(반복 실행 매번 재현), 콜드스타트 대조군(N=30)은 매번 정확히 1회. 코드 주석(L125-127)의 "genuinely dead+aged lock cannot also be a fresh re-acquisition ... cannot clobber a live holder" 주장은 이 실측으로 **반증**된다. 현재 테스트 스위트(16건)는 "죽은 PID 락 1개 + 동시 접근 N 프로세스" 조합을 커버하지 않아 전부 green 으로 통과함을 직접 실행으로 확인(테스트 갭은 `testing.md` I14 도 독립적으로 지적). | `.claude/tools/bootstrap-session.sh` L108-121(`_lock_is_dead`), L123-153(설치 블록, 특히 L125-129 `_lock_is_dead && rm -rf "$lock"` → `if mkdir "$lock"`) | **근본 수정**: check 와 act 사이에 재검증(compare-and-swap 성격)을 넣을 것 — 예: owner 파일에 PID 외 1회성 nonce 도 기록, 삭제 직전 그 nonce 를 재확인해 변경됐으면 스킵. **얕은 완화(원자적 rename 을 삭제 앞에 배치)는 `concurrency` 가 실제로 구현·재검증했으나 18/20 시행에서 여전히 2~3건 동시 설치가 재발 — 창을 좁힐 뿐 근본적으로 닫지 못함을 확인했으므로 이 형태만으로는 불충분**. `rm -rf` 대신 `mv "$lock" "$lock.reclaim.$$"` 로 탈취 자체를 원자화해 rename 성공자만 정리하게 하는 방식이 rename 자체가 CAS 성격을 가지므로 더 유망. **최소 조치(즉시 가능)**: `test_concurrent_sessions_install_at_most_once` 를 "사전에 죽은 owner 락을 심어둔 상태"로 변형한 회귀 테스트를 추가해 최소한 회귀를 감시할 것. 즉시 수정이 어렵다면 L125-127 의 반증된 주장을 정정하고 W2/W12 급의 "Known limitation" 으로 코드 주석 + `plan/in-progress/harness-guard-followups.md §A` 에 명시할 것 — 현재는 어디에도 이 경로가 실제로 깨진다는 사실이 반영돼 있지 않다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | architecture | "main 체크아웃 루트" 해석 로직이 3곳(bootstrap, pre-commit, PostToolUse 훅)에 독립 재구현되어 있고, 실패 시 시맨틱이 서로 다름(무신호 exit / 현재 워크트리로 조용히 fallback / `None` 반환). `--path-format=absolute` 는 git 2.31+ 전용이라 구버전에서 실제 실패 가능. 특히 bootstrap 의 실패 경로(L48)는 이 스크립트의 다른 모든 실패 경로가 지키는 "스킵 시 stderr 신호" 관례에서 유일하게 벗어나 완전 침묵 — 오래된 git 에서는 4개 책임(hooksPath·mermaid 설치·GC·reap)이 매 세션 무신호로 비활성화될 수 있음. | `bootstrap-session.sh:48-49`, `.githooks/pre-commit:489-491`, `lint_mermaid_posttooluse.py:299-322`(`_resolve_tool_dir`) | 공유 스니펫(예: `.claude/tools/lib/resolve-main-root.sh`)으로 추출하거나 3구현 합의를 pin 하는 테스트 추가. bootstrap L48 에 다른 실패 경로와 일관된 stderr 진단 추가. |
| W2 | requirement | `_lock_is_dead()` 가 `$MERMAID_INSTALL_LOCK_GRACE_SEC` 를 비수치 입력에 대해 무방비로 산술 비교해 `bash: [: integer expression expected`(exit 2) 를 stderr 로 그대로 흘림 — 자매 함수 `_install_throttled()` 는 동일 클래스 문제를 `2>/dev/null` 로 명시 방어하는데 이 함수만 비대칭. 우연히 안전한 방향(steal 안 함)으로 수렴하지만 의도적 가드가 아님. (※ C1 의 TOCTOU 레이스와는 별개의, "비수치 env 값" 이라는 좁은 입력 검증 이슈.) | `bootstrap-session.sh` `_lock_is_dead()` vs `_install_throttled()` | `_lock_is_dead()` 진입부에 `[ "$lock_grace" -ge 0 ] 2>/dev/null \|\| return 1` 등 사전 검증 추가해 `_install_throttled` 와 동일 패턴으로 정렬. |
| W3 | maintainability | 신규 실행-기반 테스트 두 클래스(`PostToolUseExecutionTest`/`PreCommitExecutionTest`)가 **같은 파일·같은 커밋** 안에서 `_node_calls` 헬퍼를 바이트 단위로 완전 중복 정의. `_run` 도입부(ready_state 처리 + env 세팅)도 동일 중복. "call-log 공백 아닌 줄 수 세기" 개념까지 넓히면 `test_bootstrap_mermaid_install.py`의 `_npm_calls` 와 합쳐 스위트 전체에 사실상 동일 로직 3벌. | `.claude/tests/test_mermaid_lint_ready.py:164-168` vs `:261-265`(`_node_calls`), `:170-179` vs `:267-276`(`_run` 공통부) | 같은 파일 안의 `_node_calls`(+ `_run` 공통 도입부)를 모듈 레벨 함수/믹스인으로 추출. `_harness.py` 에 `count_log_lines(path)` 류 유틸 추가해 `_node_calls`/`_npm_calls` 통합 고려(테스트 전용 코드라 동작 영향 없음, 급하지 않음). |
| W4 | testing | 신규 import-실패 fail-open 분기(`is_ready is None`)와 shell 쪽 형제 분기(`[ -f "$mermaid_ready" ]` 부재)가 **실행 기반 테스트로 전혀 보호되지 않음**. 뮤테이션 테스트로 직접 재현: fallback 극성을 반전(`is_ready = None` → `lambda *_: True`)시키고 `node_modules` 부재로 실제 lint 스크립트가 `ERR_MODULE_NOT_FOUND` 로 죽는 상황을 재현한 결과, **오도된 "mermaid syntax error" 메시지와 함께 exit 2(작업 차단)** 발생 — 단순 "조용한 fail-open" 이 아니라 **엉뚱한 이유로 실제 작업을 막는 오탐 차단**으로 귀결될 수 있음을 실측 확인. 이 PR 이 표적으로 삼는 "무신호/오신호 회귀" 클래스 그 자체이며, W8(00_59_56, "소비처 배선" boolean 반전)이 고친 것과 동일 성격의 **또 다른** 미검증 최전방 분기. 현재 배포 코드 자체는 정상 동작함을 실행으로 확인(안전망만 부재). | `lint_mermaid_posttooluse.py:39-51`(import try/except), `:116`(`if is_ready is None or not is_ready(...)`); `.githooks/pre-commit:58` | `_lib/mermaid_lint_ready.py` 를 고의로 깨뜨리거나/부재시킨 상태로 `lint_mermaid_posttooluse.py` 를 서브프로세스 실행해 exit 0+"skipped" 를 확인하는 테스트 1건, `mermaid_ready` 파일 없이 `.githooks/pre-commit` 을 구동해 mermaid 블록이 깨져도 커밋이 허용됨을 확인하는 테스트 1~2건을 기존 `PostToolUseExecutionTest`/`PreCommitExecutionTest` 패턴으로 추가. |
| W5 | documentation | `test_concurrent_sessions_install_at_most_once` 는 00_59_56 W9 로 `assertLessEqual` → `assertEqual(1)`(정확히 1회 설치 완료)로 강화됐고 docstring 도 이를 명시하는데, **메서드명 자체는 여전히 `..._at_most_once`**(≤1 — "전원 스킵"도 통과시키는 예전의 약한 의미)이고 `tests/README.md:34` 서술("at most one install")도 옛 표현 그대로라 자기모순. `git log` 확인 결과 README 행은 W9 강화 이후 갱신된 적 없음. | `test_bootstrap_mermaid_install.py:190`(메서드명), `:196`(docstring), `:211`(assertion) / `tests/README.md:34` | 메서드명을 `test_concurrent_sessions_install_exactly_once` 류로 변경, README:34 를 "exactly one install (and it must complete)" 로 정정. |
| W6 | documentation (requirement.md 동일 지점 INFO 로 중복 지적, 상위 심각도 채택) | `.githooks/pre-commit` 상단 요약 주석("Both guards delegate to shared logic...")이 공유 모듈을 2개(branch_guard, lint-mermaid.mjs)만 나열하고, 이번 diff 가 신설한 **세 번째 공유 SoT**(`mermaid_lint_ready.py`, readiness 판정)를 나열하지 않음. 바로 아래 guard 2 인라인 주석은 정확히 설명하나, 헤더만 훑는 신규 기여자는 놓칠 수 있음. `bootstrap-session.sh` 의 "Three"→"Four responsibilities" 누락이 이미 20_06_45 라운드에서 지적·수정된 것과 정확히 같은 클래스의 문제가 형제 파일에서 재발. | `.githooks/pre-commit:10-13`(헤더) vs `:49`(인라인, guard 2) | 헤더에 "readiness in `.claude/hooks/_lib/mermaid_lint_ready.py`" 한 구절 추가. |
| W7 | documentation | `bootstrap-session.sh` 내 "Known limitation" 인용 표기가 비일관 — 두 곳(W12, W2)은 "W번호, 00_59_56 review" 형식으로 출처 라운드를 명시하는데 세 번째(grace-truncation 버그 설명)만 라운드명 없이 "(W1)" 만 표기. 실측 결과 20_06_45·00_59_56 두 라운드가 각자 독립적으로 1부터 번호를 매겨 **같은 숫자("6" 등)가 서로 다른 발견을 가리킴**이 확인돼, 번호만으로는 라운드를 특정할 수 없음. | `bootstrap-session.sh:114`("(W1)") vs `:98`,`:132`("W12"/"W2, ... 00_59_56 review") | `:114` 에도 ", 00_59_56 review" 를 붙여 같은 파일 내 나머지 두 인용과 표기 통일. |
| W8 | dependency (이번 diff 미도입, 사전 존재 — 이번 PR 이 만지는 파일에 포함되어 기록) | `harness-checks.yml` 만 리포의 다른 모든 워크플로(`actions/setup-node@v6`+`node-version: '24'`)와 달리 `actions/setup-python@v6`(무관)/`actions/setup-node@v4`+`'22'` 를 사용. `PROJECT.md` 의 Node 지원 floor(`>=24`) 적용 범위 밖이라 해도 CI 전체에서 유일하게 낮은 버전 조합을 쓰는 것은 실제 리스크(하네스 테스트가 다른 런타임에서만 검증됨). | `harness-checks.yml:602,612-614` | 별도 후속(이번 PR 스코프 아님)으로 `actions/setup-node@v6`+`node-version: '24'` 정렬 권장. |
| W9 | dependency + security(관련 INFO 통합) (이번 diff 미도입, 사전 존재 — 이번 PR 이 바로 이 설치 파이프라인을 견고화하는 변경이라 관련성 높아 기록) | mermaid-lint 의 의존성(`mermaid`, `jsdom`)이 **어디에서도 감사되지 않음** — `package.json` 이 완전 와일드카드(`"*"`) 선언, 설치 커맨드가 `npm install --no-fund --no-audit --silent` 로 npm 자체 감사도 끔, `deps-security-checks.yml` 의 `pnpm audit` 게이트는 루트 `pnpm-lock.yaml`(pnpm workspace)만 스캔해 이 독립 `package-lock.json`(npm) 프로젝트는 `paths:` 필터에도 없고 애초에 스캔 대상도 아님. | `.claude/tools/mermaid-lint/package.json`(`"*"`), `bootstrap-session.sh:167`(`--no-audit`), `.github/workflows/deps-security-checks.yml`(paths 미포함) | 후속 과제로 (a) `deps-security-checks.yml` paths 에 `.claude/tools/mermaid-lint/package.json`(또는 lock) 추가 + 별도 `npm audit` 스텝 신설, 또는 (b) 최소한 `package.json` 버전을 lockfile 실측값 기준 메이저 버전으로 명시. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | security | CI 워크플로에 명시적 최소권한 `permissions` 블록 부재. 포크 PR 은 GitHub 이 자동 read-only 강제하므로 실질 위험 낮음. script-injection 패턴(`${{ github.event.* }}` run: 보간)은 없음을 확인. | `harness-checks.yml`(전체) | `permissions: contents: read` 최상단 명시(필수 아님). |
| I2 | security | GitHub Actions 를 major-version 태그로 고정(SHA pin 아님) — 전부 1st-party action 이라 실질 위험 낮음. | `harness-checks.yml:598,602,612` | 필요 시 SHA pin 고려, 현재 불요. |
| I3 | security | `_target_path` 가 `tool_input`/`input` 이 dict 아닌 truthy 값일 때 `AttributeError` 미포착 가능 — payload 는 하네스 자신이 구성하므로 외부 신뢰경계 미노출, 영향은 hook 조용히 스킵뿐. | `lint_mermaid_posttooluse.py:294-296` | `isinstance(ti, dict)` 가드(우선순위 낮음). |
| I4 | security, concurrency | PID 재사용(ABA) 기반 lock steal 오탐(false negative, W12) — 이미 문서화·추적됨, fail-safe 방향(설치 skip 만 됨)이라 C1 과 반대 방향 리스크. | `bootstrap-session.sh:98-107`(주석) | 없음(이미 추적 중). |
| I5 | performance | 반복 서브프로세스 스폰(PostToolUse 매 호출 `git rev-parse` 비캐싱, pre-commit 매 커밋 python 인터프리터 2회 기동, mermaid node 파서 콜드스타트가 fence 있는 파일 편집마다 반복) — 확장자→fence 존재→실제 파서 호출의 단계적 게이팅으로 이미 신중히 설계됨, 현재 규모에서 병목 근거 없음. | `lint_mermaid_posttooluse.py:73-133`, `.githooks/pre-commit:34,58` | 조치 불요. 지연이 실제 체감될 때만 세션 내 캐싱/상주 데몬 검토. |
| I6 | performance | SessionStart GC(상태 마커 정리) 섹션이 자매 부수효과(mermaid 설치·워크트리 reaper)와 달리 스로틀 마커 없이 매 세션 무조건 `find` 스캔. 대상이 "30일치 세션당 1파일"로 자연 상한돼 실측 비용 낮음. | `bootstrap-session.sh:159-165` | 즉시 조치 불요. 파일 수가 크게 늘면 마지막 실행시각 마커 기반 스로틀 재검토. |
| I7 | performance | `harness-checks.yml` 이 python/node 셋업+테스트를 한 job 안에서 순차 실행(병렬 matrix 미사용) — `timeout-minutes: 5` 내 무리 없고 `concurrency.cancel-in-progress` 로 중복 실행도 회피됨. | `harness-checks.yml:41-64` | 조치 불요. |
| I8 | architecture, maintainability | `bootstrap-session.sh` 가 4개 책임(hooksPath·mermaid 설치·GC·reap)을 한 파일에 담음(SRP) — 섹션별 독립 `if` 게이트로 실패 격리돼 있어 실질 리스크 낮음. 이미 별건(W6/plan §G, "결함 아닌 개선 여지")으로 추적 중이며, 이번 라운드 신규 주석(Known limitation 블록)이 인라인 블록 주변에 더해져 비중이 커짐. | `bootstrap-session.sh` 전체, 특히 L123-154(section 2) | 조치 불요(이미 트래킹됨). 다음에 이 섹션을 만질 기회에 함수 추출 고려. |
| I9 | architecture | `mermaid_lint_ready.py` 가 mermaid-lint 전용 하드코딩(`MARKER_NAME` 단일 상수) — 도구가 하나뿐인 현재는 YAGNI 상 적절. | `mermaid_lint_ready.py` 전체 | 두 번째 게이트 대상 도구가 필요해질 때 `tool_dir`/`marker_name` 매개변수화 검토. |
| I10 | architecture, maintainability | CI `paths:` 리스트가 디렉터리 단위 glob 과 개별 파일 등재를 혼용하고, 각 항목이 리뷰 라운드별 배경 주석을 계속 누적 — 현재 12개 항목 수준에서는 아직 무리 없음. | `harness-checks.yml:15-18,584-587` | 새 harness-covered 스크립트 추가 시 "paths 갱신"을 체크리스트화. |
| I11 | maintainability | `_lock_is_dead`/`_install_throttled` 가 "mtime 이후 경과초" 계산을 별도 인라인 식으로 반복 — 이번 라운드 수정으로 두 식이 구조적으로 동일해져 향후 drift 위험은 낮음. | `bootstrap-session.sh:84`(`_install_throttled`) vs `:115`(`_lock_is_dead`) | (선택) `_age_seconds()` 헬퍼 추출, 급하지 않음. |
| I12 | maintainability | `lint_mermaid_posttooluse.py` 의 `sys.path.insert` 인라인 계산이 형제 훅(`guard_review_before_push.py` 등)의 `THIS_DIR` 명명 관례 미준수 — 이미 지적됨(직전 라운드), 동작 차이 없는 순수 스타일. | `lint_mermaid_posttooluse.py:39` | 조치 불요. 이 근방을 다시 만질 기회에 `THIS_DIR` 상수로 정리. |
| I13 | testing | `test_bootstrap_mermaid_install.py::_env()` 가 `MERMAID_INSTALL_LOCK_GRACE_SEC` 만 조건부(명시 전달 시에만) 오버라이드하고 형제 변수 `MERMAID_INSTALL_RETRY_SEC` 는 항상 고정 — 테스트 실행 환경에 우연히 해당 env 가 세팅돼 있을 때만 문제되는 낮은 실질 위험. | `test_bootstrap_mermaid_install.py:99-118` | `_env()` 에서도 `MERMAID_INSTALL_LOCK_GRACE_SEC` 를 항상 명시적으로 고정. |
| I14 | testing | 사소한 미검증 경계값(인자 개수 오류, env 0/음수/비숫자 값) — 코드 추적상 어느 쪽도 세션을 막지 않아 위험 낮음. **"죽은 owner PID 락 1개 + 동시 접근 N 프로세스" 스트레스 테스트 부재는 이번 라운드 C1(CRITICAL) 로 격상됨 — 별도 저위험 항목이 아님**, C1 제안 참조. | `mermaid_lint_ready.py:49-53`, `bootstrap-session.sh`(env 산술) | C1 조치에 포함해서 처리(중복 기재 아님). |
| I15 | requirement, documentation | `tests/README.md` 의 `test_mermaid_lint_ready.py` 카탈로그 행이 이후 추가된 실행-기반 회귀 테스트 클래스(`PostToolUseExecutionTest`/`PreCommitExecutionTest`)를 반영 안 함 — 리뷰 대상 7파일 밖, 차단 사유 아님. | `.claude/tests/README.md:35` | 후속 편집 시 한 문장 추가(우선순위 낮음). |
| I16 | documentation | 리뷰 라운드 번호 인용 관례("WARNING #N"=20_06_45, "WN"=00_59_56)가 어디에도 명시 문서화되지 않아, 두 라운드가 같은 숫자를 다른 발견에 독자적으로 붙이는 혼동이 실측으로 확인됨(W6·W7 참조). | `test_bootstrap_mermaid_install.py`, `test_mermaid_lint_ready.py` 각 docstring | 재작업 시 라운드명 병기 또는 review 세션 경로를 모듈 docstring 에 SoT 로 남기는 것 고려(우선순위 낮음). |
| I17 | documentation | `is_ready()` 는 "미설치" 뿐 아니라 "부분 설치"도 fail-open 시키고 인접 인라인 주석은 이를 정확히 서술하나, 모듈 docstring 과 실제 사용자 노출 stderr 메시지는 여전히 "not installed"로만 남음 — 00_59_56 라운드가 이미 INFO/저우선순위로 지적, 이번 라운드 해당 코드 변경 없어 재확인만. | `lint_mermaid_posttooluse.py:27,122` vs `:117` | 우선순위 낮음. 여유 있을 때 "(or only partially installed)" 추가. |
| I18 | requirement | 관련 `spec/` 문서 부재는 하네스/자동화 인프라 영역 특성상 정상. 가장 가까운 인접 문서(`worktree-policy.md §7`)는 이번 diff 밖 기존 코드와 정확히 일치함을 대조 확인(drift 없음). | 해당 없음 | 조치 불요. |
| I19 | side_effect | 신규 FS 아티팩트(`.install.lock/`+`owner`, `mermaid_install_last_fail`, `node_modules/.bootstrap-install-complete`) 가 `.gitignore` 에 정확히 커버됨 — 저장소 오염 위험 없음(직접 대조 확인). | `.gitignore:5,9,23` | 없음(긍정 기록). |
| I20 | side_effect | 마커 도입이 이 PR 머지 직후, 마커 개념 없이 이미 정상 설치된 기존 워크트리에 일시적 "무신호 fail-open" 구간(재설치 전까지 lint 전면 스킵)을 만듦 — 의도된 트레이드오프이며 주석("One-off: ... reinstalls once")에 이미 인지됨. | `bootstrap-session.sh:123`, `mermaid_lint_ready.py:is_ready` | 없음(트레이드오프 수용 권장). 필요 시 PR 설명에 "머지 후 첫 SessionStart 는 재설치 1회" 공지. |
| I21 | side_effect | `sys.path.insert` 전역 변경은 훅이 매번 새로 뜨는 일회성 서브프로세스라 프로세스-로컬 스코프에 그침 — 다른 훅/세션으로 누수 없음, `_lib` 이름 셰도잉도 없음 확인. | `lint_mermaid_posttooluse.py:265` | 없음. |
| I22 | side_effect | 신규 env var(`MERMAID_INSTALL_LOCK_GRACE_SEC`/`RETRY_SEC`) 표면은 `${VAR:-default}` 로만 읽히고 `export` 없어 하위 프로세스 미전파, 미설정 시 기존 동작과 동치인 기본값 — additive·안전. | `bootstrap-session.sh:16-17` | 없음. |
| I23 | side_effect | 구버전(락/마커 개념 없는) 체크아웃과 신버전이 배포 직후 동시 SessionStart 하면 신버전의 락 메커니즘을 모르는 구버전이 별도로 설치를 시도할 이론적 여지 — 버전관리된 락 도입 자체에 내재하는 일회성 롤아웃 리스크로 이번 PR 의 설계 결함은 아님. | `bootstrap-session.sh`(버전관리 파일 자체) | 없음(구조적으로 이번 PR 범위에서 닫을 수 없음, 참고 기록). |
| I24 | dependency | 이번 diff 는 새 외부 의존성을 추가하지 않음 — `ast` 로 전량 import 추출한 결과 표준 라이브러리·내부 모듈 외 없음, 셸 스크립트도 기존 POSIX 유틸/도구만 사용. | 전체 7개 파일 | 없음. |
| I25 | dependency | `lint_mermaid_posttooluse.py` 의 신규 import 는 `try/except Exception → is_ready=None` fail-open 폴백을 가지나, `_lib/mermaid_lint_ready.py` 자체가 깨지면 linter 전체가 조용히 비활성화될 수 있음 — "세션을 절대 막지 않는다"는 훅 계약과 정합하는 의도된 설계(단, 이 폴백 경로 자체의 테스트 커버리지 부재는 W4 로 별도 격상됨). | `lint_mermaid_posttooluse.py:265-277` | 없음(현행 트레이드오프 수용). 회귀 테스트는 W4 조치로 포함. |
| I26 | dependency | `npm install`(vs `npm ci`) 선택은 lockfile 이 커밋돼 있음에도 "세션을 절대 막지 않는" fail-open 설계 목표와 정합 — `npm ci` 는 불일치 시 하드 실패하므로 부적합. | `bootstrap-session.sh:167` | 없음. |
| I27 | dependency | 이번 diff 의 CI 변경은 `paths:` 트리거 한 줄(`.githooks/**`) 추가뿐 — 새 설치 스텝·빌드 의존성 없어 CI 시간/번들 크기 영향 사실상 0. | `harness-checks.yml` | 없음. |
| I28 | concurrency | W2(npm install 타임아웃 없음, 00_59_56 에서 이미 트래킹)의 "blast radius는 락 보유 세션 1개로 한정된다"는 주석 가정이 C1 과 상호작용해 약화됨 — C1 이 트리거되면 여러 세션이 독립적으로 무기한 걸릴 수 있는 `npm install` 을 동시 시작하므로 "1개 세션만 영향"이라는 전제가 깨짐. | `bootstrap-session.sh:132-140`(주석), `:141` | C1 수정 시 함께 재평가 권장(이미 plan §A 트래킹). |
| I29 | concurrency | `test_dead_pid_lock_is_stolen` 자신이 `Popen(["true"]); .wait()` 로 얻은 죽은 PID 가 바쁜 CI 머신에서 짧은 창 내 재사용될 이론적 flake 가능성 — 확률 희박, 우선순위 낮음. | `test_bootstrap_mermaid_install.py` | 없음. |
| I30 | concurrency | `reap-merged-worktrees.sh` 는 이번 리뷰 페이로드에 포함되지 않아 내부 동시성(주석상 "self-throttled to once per few hours")을 이번 파일 세트만으로 검증 불가. | `bootstrap-session.sh:183-186`(호출부) | 범위 밖 메모 — 별도로 해당 스크립트 대상 점검 권장. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CI 최소권한/SHA pin 미비, `--no-audit`(→W9 통합), 잠재 미포착 예외 — 전부 INFO |
| performance | LOW | 반복 서브프로세스 스폰·GC 무스로틀 등 — 전부 INFO, 이미 신중히 게이팅됨 |
| architecture | LOW | main_root 해석 3중 재구현(W1), 4책임 단일파일·CI paths 관리 등 INFO |
| requirement | LOW | `_lock_is_dead` 비수치 grace 미가드(W2). 인접 TOCTOU 를 INFO 로 재확인했으나 **이는 이번 라운드 C1 실측으로 대체됨**(상단 주의 참조) |
| scope | NONE | 범위 이탈 없음, RESOLUTION 3개 fix 커밋이 선언된 범위와 정확히 대응 |
| side_effect | HIGH(자체판정)/발견태그는 CRITICAL | **stale-lock 탈취 TOCTOU 실측 재현(C1 로 통합)**, gitignore·env 표면 등은 INFO |
| maintainability | LOW | 실행기반 테스트 헬퍼 바이트단위 중복(W3), 기타 스타일 INFO |
| testing | LOW | import-fail-open 미검증 분기 뮤테이션으로 오탐차단 재현(W4), env 격리 비대칭 등 INFO |
| documentation | LOW | 테스트명/README 자기모순(W5), pre-commit 헤더 3번째 SoT 누락(W6), 인용표기 비일관(W7) |
| dependency | LOW | CI Node 버전 불일치(W8, 기존), mermaid-lint 의존성 무감사(W9, 기존) |
| database | NONE | 데이터베이스 관련 코드 없음 |
| concurrency | CRITICAL | **stale-lock 탈취 TOCTOU 실측 재현(C1)** — 얕은 완화(원자적 rename)도 18/20 시행에서 재발 확인 |
| api_contract | NONE | 네트워크 API 표면 없음(순수 harness 내부 CLI/훅 계약) |
| user_guide_sync | NONE | doc-sync-matrix 20개 trigger 매칭 0건 |

## 발견 없는 에이전트

- **database** — DB 스키마/쿼리/ORM/트랜잭션 관련 코드 없음.
- **api_contract** — REST/GraphQL/RPC 엔드포인트·응답 스키마 없음(순수 로컬 harness 프로세스 계약).
- **user_guide_sync** — `doc-sync-matrix.json` 20개 trigger 전수 대조, 매칭 0건(`codebase/`, `spec/` 미변경).
- **scope** — 범위 이탈 변경 없음(8개 관점 점검, RESOLUTION 대응 정확).

## 권장 조치사항

1. **(최우선, C1)** stale-lock 탈취 경로의 check-then-act 비원자성을 compare-and-swap 성격으로 근본 수정하거나, 최소한 "죽은 PID 락 + N(≥15) 동시 프로세스" 조합 회귀 테스트를 즉시 추가해 회귀를 감시할 것. 얕은 원자적-rename 완화만으로는 불충분함이 이미 검증됐으므로 시도하지 말 것. 즉시 수정이 어렵다면 코드 주석(L125-127)의 반증된 안전성 주장을 정정하고 `plan/in-progress/harness-guard-followups.md §A` 에 Known limitation 으로 명시.
2. **(W4)** import-실패 fail-open 분기(`is_ready is None` 및 shell 쪽 형제)에 실행 기반 회귀 테스트 추가 — 뮤테이션으로 "오도된 메시지 + 오탐 차단" 가능성이 실측 확인됨.
3. **(W2)** `_lock_is_dead()` 에 `MERMAID_INSTALL_LOCK_GRACE_SEC` 비수치 입력 가드 추가(`_install_throttled` 와 동일 패턴).
4. **(W5, W6, W7)** 낮은 비용의 문서/네이밍 자기모순 정정 — 테스트 메서드명·README exactly-once 정합, pre-commit 헤더에 3번째 공유 SoT 추가, known-limitation 인용에 라운드명 통일.
5. **(W1)** main_root 해석 로직 3중 재구현을 공유 스니펫으로 통합하거나 합의 pin 테스트 추가.
6. **(W3)** `test_mermaid_lint_ready.py` 내 `_node_calls`/`_run` 공통부 중복을 모듈 함수/믹스인으로 추출.
7. **(W8, W9 — 별건 후속)** `deps-security-checks.yml` 이 mermaid-lint 의 별도 npm 프로젝트를 감사하도록 확장, `harness-checks.yml` 의 Node/액션 버전을 리포 전체와 정렬. 둘 다 이번 PR 범위 밖이므로 별도 plan 항목으로 등록 권장.
8. 나머지 INFO 항목은 우선순위 낮음 — 해당 코드/문서를 다음에 만질 기회에 함께 정리.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용(사유 미기재) — 전체 14개 reviewer 실행.
- 참고: router_safety 강제(forced) 화이트리스트 — `maintainability, requirement, scope, security, side_effect, testing`(6명). routing 자체가 skipped 되어 forced 여부와 무관하게 14명 전원이 이번 라운드에 실행됐고, forced 6명 전원 결과 확보됨(미이행 없음).