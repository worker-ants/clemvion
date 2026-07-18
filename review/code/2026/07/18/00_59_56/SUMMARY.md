# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 4개 독립 reviewer(side_effect·documentation·dependency·concurrency)가 각자 MEDIUM 을 매겼고 그 근거가 모두 실측/실행으로 검증된 실질 발견(실제 npm 취약점 2건, mutation-blind 테스트 실증, PID 재사용 ABA 레이스, 자기모순 문서)이라 낮춰 잡지 않았다. 차단 사유(병합 불가)는 없음 — 모든 결함이 fail-open 방향이거나 저확률·자가치유 경로.

forced 화이트리스트(maintainability, requirement, scope, security, side_effect, testing) 는 routing 자체가 skipped 라 무관하게 전원 실행되었고, 14개 reviewer 전원의 결과 파일이 디스크에 확보되어 있음을 직접 확인했다 — 강제 항목 누락으로 인한 거짓 "clean" 판정은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 동시성/유지보수성 | `MERMAID_INSTALL_LOCK_GRACE_SEC` 를 `_lock_is_dead()`가 `find -mmin "-$(( lock_grace / 60 ))"` 로 분 단위 변환하며 bash 정수 나눗셈이 1~59초 값을 0으로 truncate. `find -mmin -0` 은 실측 재현 결과 어떤 나이의 파일도 매칭하지 않아 "just-reacquired lock is always young and thus safe" 불변식이 무력화됨. 기본값(600=10분 배수)은 무해하나 이 경로를 non-default 값으로 exercise 하는 테스트가 전무. 같은 파일의 `_install_throttled` 는 `_file_mtime()` 기반 초 단위 산술로 이 문제를 이미 피하고 있어 동일 개념의 중복 구현이 갈라진 사례 (requirement·maintainability·documentation·concurrency 4개 reviewer 독립 수렴) | `bootstrap-session.sh:74,98` | `_lock_is_dead` 도 `_file_mtime()` 기반 초 단위 산술로 통일. non-multiple-of-60 값 테스트 1건 추가 |
| W2 | 동시성 | `npm install` 서브프로세스에 타임아웃이 없어, 크래시도 실패도 아닌 "멈춘" 설치가 락을 쥔 세션을 무기한 블로킹 가능 — 파일이 반복 선언하는 "bootstrap must never block a session" 불변식과 정면 충돌. 같은 파일의 node 린터 호출(20초 timeout)과 비대칭 (concurrency WARNING + requirement·dependency INFO) | `bootstrap-session.sh:115` | timeout 래핑 추가(`command -v timeout`/`gtimeout` 확인 후 사용 또는 백그라운드+워치독 패턴, macOS 기본에 `timeout` 없음 고려) |
| W3 | 테스트/CI | `harness-checks.yml` CI 트리거 `paths:` 에 `.githooks/**` 가 없다 — 워크플로 자신의 인라인 주석이 정확히 경계하는 "단독 수정 시 CI 미실행" 실패 클래스 그 자체. `.githooks/pre-commit` 은 `ConsumerBindingTest` 로만 결속되는데 그 테스트가 이 워크플로로만 실행됨 (testing WARNING + dependency INFO 교차확인) | `.github/workflows/harness-checks.yml:9-30` | `paths:` 에 `.githooks/**` 한 줄 추가 |
| W4 | 의존성/보안 | `npm audit` 를 실제로 실행해 확인 — `.claude/tools/mermaid-lint` 의 npm 트리에 실제 취약점 2건 존재(`dompurify@3.4.7` moderate, `undici@7.27.0` **HIGH**, TLS 인증서 검증 우회 등). `bootstrap-session.sh` 의 `npm install --no-audit` 가 이 신호를 설치 시점에 은폐. 둘 다 `fixAvailable`, breaking 없이 lockfile 갱신만으로 해소 가능. 실사용 경로(parse-only, jsdom 정적 사용)상 직접 트리거 가능성은 낮음 | `.claude/tools/mermaid-lint/package-lock.json`, `bootstrap-session.sh:367` | `cd .claude/tools/mermaid-lint && npm audit fix` 로 lockfile 갱신 |
| W5 | 의존성/CI | `.claude/tools/mermaid-lint` 의 독립 npm 트리(150개 전이 패키지)가 이 저장소의 모든 자동 보안 스캔에서 빠져 있음 — `deps-security-checks.yml` 은 pnpm 워크스페이스만 감사, Dependabot 도 `github-actions` ecosystem 만 등록. 결과적으로 W4 의 두 CVE 뿐 아니라 향후 신규 CVE 도 영구 무신호 — 이 PR 이 공들여 없애는 "신호 없는 영속적 결함" 패턴이 의존성-보안 축에서는 이미 실현된 상태 (dependency) | `.github/workflows/deps-security-checks.yml:19-32`, `.github/dependabot.yml` | `deps-security-checks.yml` 에 mermaid-lint 전용 audit 스텝 추가 또는 `paths` 확장 |
| W6 | 아키텍처 | `bootstrap-session.sh` 책임#2(mermaid-lint 설치)가 이번 변경으로 ~70줄의 비자명한 동시성 상태 머신(마커+mkdir 락+PID liveness+throttle)으로 비대해졌으나, 같은 파일의 책임#4(reap)가 이미 확립한 "별도 스크립트로 추출" 선례를 따르지 않음. 결과가 테스트에도 드러남 — `test_bootstrap_mermaid_install.py` 가 무관한 reap 섹션을 무력화하려고 `REAP_MIN_INTERVAL` 등 env 를 명시적으로 채워야 함 (architecture) | `bootstrap-session.sh:22-68` 대 `:393-413`(reap) | `ensure-mermaid-lint-deps.sh` 로 추출, `bootstrap-session.sh` 는 호출만 |
| W7 | 아키텍처 | `lint_mermaid_posttooluse.py` 의 신규 SoT import(`sys.path.insert` + `from mermaid_lint_ready import is_ready`)가 형제 훅(`guard_default_branch_edit.py` 등)의 "import 실패 시 명시적 fail-open"(`try/except Exception: sys.exit(0)`) 관례를 따르지 않음 — 훅의 문서화된 계약상 결국 fail-open 으로 수렴할 개연성은 높으나, 이는 CPython 예외 처리 동작에 암묵적으로 기대는 것이지 형제 훅처럼 import 경계에서 명시적으로 보장하는 것이 아님 (architecture) | `lint_mermaid_posttooluse.py:38-39` 대 `guard_default_branch_edit.py:27-37` | `_lib` 패키지 네임스페이스 + `try/except Exception: traceback.print_exc(); sys.exit(0)` 로 정렬 |
| W8 | 테스트 | 소비처(PostToolUse·pre-commit) 배선 변경이 실행 기반 회귀 테스트 없이 "소스 텍스트 포함" 검사로만 보호됨 — 두 위치 모두 불리언 반전 뮤턴트(`if not is_ready` → `if is_ready`, `!` 추가)에서 기존 `assertIn` 단언이 그대로 통과함을 직접 재현. 역으로 **현재 코드 자체는 올바름**도 임시 git repo 로 fail-open 동작을 재현해 확인 — "지금은 맞지만 지켜주는 회귀 안전망이 없는" 상태 (testing) | `lint_mermaid_posttooluse.py:103-104`, `.githooks/pre-commit:58` | `MERMAID_LINT_TOOL_DIR` 오버라이드로 실제 stdout/exit code 를 확인하는 서브프로세스 테스트 추가 |
| W9 | 테스트 | `test_concurrent_sessions_install_at_most_once` 가 `assertLessEqual(npm_calls, 1)` 만 검사해 "5개 세션 전원이 설치를 스킵"(설치가 조용히 영구 비활성화되는, 이 PR 이 없애려는 바로 그 무신호 실패 클래스)도 이 단언을 그대로 통과시킴 — "정확히 1회 설치 완료"는 미검증 (testing) | `test_bootstrap_mermaid_install.py:177-193` | `assertEqual(npm_calls, 1)` + 완료 마커 파일 존재 확인 추가 |
| W10 | 문서화 | 락 해제 요약 주석이 "a session only rmdir's a lock it still owns" 라고 쓰지만 실제 명령은 `rm -rf`(owner 파일이 든 비어있지 않은 디렉터리라 `rmdir` 자체가 실패) — 정확히 40여 줄 아래 인접 주석이 이 두 명령의 차이를 스스로 명시적으로 가르치는 바로 그 파일 안에서의 자기모순 (documentation WARNING + requirement INFO) | `bootstrap-session.sh:61-63` 대 `:108` | "rmdir's" → "removes"/"rm -rf's" 로 교정 |
| W11 | 문서화 | `test_bootstrap_mermaid_install.py` 모듈 docstring 이 "두 실패만 pin 한다"고 서술하지만, 이번 diff 로 추가된 5개 신규 테스트(락 liveness 3건 + throttle 2건, 전체 14개 중 1/3 이상)가 커버하는 새 축(liveness 판정, 실패 throttle)을 반영하지 않음 — 새 기여자의 1차 진입점이 불완전 (documentation) | `test_bootstrap_mermaid_install.py:1-15` | docstring 에 liveness·throttle 두 축을 요약하는 한 단락 추가 |
| W12 | 동시성 | 신규 liveness 판정(`kill -0` 단독)이 PID 재사용(ABA)에 노출 — 직전 라운드가 고친 결함(살아있는데 죽었다고 오판)의 **정반대 방향**: 진짜로 죽은 홀더의 PID 가 다음 확인 시점에 무관한 프로세스로 재할당되면 `_lock_is_dead` 가 거짓(살아있음)을 반환해, 그 무관 프로세스가 종료할 때까지 락이 정체됨. 완화 요인: 실패 방향이 안전(설치 스킵, 손상·중복설치 아님), macOS 단일 PID 공간이라 확률 낮음, grace age 경과 후에만 발현 (concurrency) | `bootstrap-session.sh:96-104` | 소유자 식별을 (PID, 시작 시각) 쌍으로 강화하거나 최소한 known limitation 으로 주석에 명시 |
| W13 | 요구사항/테스트 | `test_marker_without_node_modules_dir_is_not_ready` 가 이름·주석("marker path implies node_modules/, but guard the isdir check anyway")이 약속하는 "마커는 있으나 node_modules 는 없는" 시나리오를 실제로 구성하지 않음 — 아무것도 만들지 않고 `is_ready()`만 호출해 `test_no_tool_dir_is_not_ready` 와 물리적으로 동일한 입력을 재확인하는 사실상의 중복. 마커 경로가 항상 `node_modules/` 하위로 정의돼 이 조합 자체가 mock 없이는 구성 불가능해 보임 (requirement WARNING + testing·documentation INFO 교차확인) | `test_mermaid_lint_ready.py:61-63` 대 `:47-49` | `os.path.isdir` mock 으로 방어 로직을 실제로 검증하거나, 구조적으로 도달 불가함을 주석에 명시하고 제거/개명 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 성능 | SessionStart GC(state marker 정리) 섹션에 스로틀이 없어 매 세션마다 전체 디렉터리 스캔 반복 — 같은 파일의 install/reap 섹션은 모두 스로틀 보유. 현재 파일 수 규모에서는 무해 (performance) | `bootstrap-session.sh:382-391` | 파일 수 급증 시에만 재검토 |
| I2 | 성능 | `git rev-parse --git-common-dir` 서브프로세스가 PostToolUse 훅 호출마다 캐싱 없이 재실행 — 프로세스 자체가 매번 독립이라 구조적 한계, mermaid fence 게이팅으로 실빈도는 낮음 (performance) | `lint_mermaid_posttooluse.py:155-178` | 세션 범위 캐싱은 게이팅 설계상 우선순위 낮음 |
| I3 | 성능 | pre-commit 의 python3 재기동, node 파서 콜드스타트 반복, 마크다운 전체 파일 메모리 적재 — 모두 현재 규모(개인/소규모팀, KB 단위 문서)에서 무시 가능한 의도된 트레이드오프 (performance·requirement·side_effect 교차확인) | `.githooks/pre-commit:481-485`, `lint_mermaid_posttooluse.py:189-226` | 조치 불요 |
| I4 | 아키텍처 | "git-common-dir 로 main 루트 계산" 로직이 3개 bash 파일 + 1개 python(subprocess) 에 중복 — 신규 SoT 모듈(`mermaid_lint_ready.py`)이 세운 교훈이 이 기존 패턴에는 적용 안 됨(diff 밖) (architecture) | `bootstrap-session.sh:22`, `reap-merged-worktrees.sh:95`, `.githooks/pre-commit:26`, `lint_mermaid_posttooluse.py:_resolve_tool_dir` | 향후 재작업 시 단일 SoT 또는 binding 테스트로 통합 검토 |
| I5 | 아키텍처 | 테스트 파일 간 모듈 로딩 관례 불일치(`_harness.load_module_by_path` vs `from _lib import`) — 기능상 문제 없음 (architecture) | `test_mermaid_lint_ready.py:17-20` 대 `test_branch_guard.py:16-17` | 다음 편집 시 형제 테스트 스타일로 통일 |
| I6 | 요구사항 | 이 변경 영역을 정의하는 `spec/` 문서는 없음 — `.claude/` 하네스 인프라는 저장소 규약상 `spec/` 대상이 아니라 정상. plan 문서·직전 리뷰 대조로 3개 WARNING 해소·304/304 테스트 통과·체크리스트 정확성 확인 (requirement, 확인성 기록) | `plan/in-progress/harness-guard-followups.md` §A | 조치 불요 |
| I7 | 보안 | `npm install --no-audit` 로 설치 시점 취약점 감사 생략(단독 관찰 — W4/W5 로 실제 확인·확대됨) (security) | `bootstrap-session.sh:367` | W4/W5 조치로 흡수 |
| I8 | 보안 | 환경변수 오버라이드(`MERMAID_LINT_TOOL_DIR` 등)가 실행 대상 경로를 검증 없이 바꿀 수 있음 — 공격자가 이미 세션 env 를 통제해야 하는 낮은 실질위험 (security) | `lint_mermaid_posttooluse.py:_resolve_tool_dir`, `.githooks/pre-commit`, `bootstrap-session.sh` | CI env 유입 경로 문서화 권장 |
| I9 | 보안 | stdin/대상 파일 읽기에 크기 상한 없음(이론적 DoS) — 로컬 신뢰 경계 내 hook 이라 원격 공격 표면 아님 (security) | `lint_mermaid_posttooluse.py:_read_payload`, `main()` | 조치 불요 |
| I10 | 동시성 | 락 탈취 경로의 이론적 TOCTOU(check-then-act 비원자성) — 직전 라운드(20_06_45 WARNING #7)에서 이미 발견·"600회 스트레스로도 재현 못 함" 근거로 미조치 결정됨, 이번 커밋도 형태 불변 (concurrency) | `bootstrap-session.sh:111-112` | 기존 결정 유지 |
| I11 | 동시성 | owner 파일 쓰기 실패 시 락이 "라벨없음" 상태로 폴백해 나이만으로 탈취 가능해지는 좁은 경로 — 저확률(디스크 풀 등), gitignore 범위 내, 자가치유 (concurrency·side_effect 교차확인) | `bootstrap-session.sh:113` | 필요 시 쓰기 실패 stderr 경고만 추가 |
| I12 | 유지보수성 | install-attempt 시퀀스가 신규 predicate 함수들과 달리 여전히 top-level 인라인, `THIS_DIR` 관례 미준수, 타임아웃 리터럴 중 하나만 명명됨, GC 임계값(30일) 스타일 불일치, 테스트 주석의 프로덕션 기본값 재서술 — 5개의 소소한 스타일/일관성 관찰 (maintainability) | `bootstrap-session.sh:106-138`, `lint_mermaid_posttooluse.py:38,43,76` | 다음 편집 시 정리 권장, 시급하지 않음 |
| I13 | 테스트 | liveness steal 로직에 "죽은 락 1개 + 동시 접근 N프로세스" 스트레스 테스트 부재 — 기존 5-프로세스 콜드스타트 테스트와 대칭 확장 여지 (testing) | `bootstrap-session.sh:96-111` | `test_concurrent_sessions_install_at_most_once` 패턴 재사용해 1건 추가 |
| I14 | 테스트 | 사소한 미검증 경계값(빈 문자열 tool_dir, owner 필드 쓰레기 텍스트, `lock_grace=0`/비-60배수) — 모두 현재 코드 경로상 행동 차이 없음 확인 (testing) | 다수 | 우선순위 낮음 |
| I15 | 문서화 | `lint_mermaid_posttooluse.py` 의 모듈 docstring·사용자 노출 stderr 메시지가 "부분 설치(partial-install)" 케이스를 반영하지 않음(인라인 주석과 정밀도 격차) + `test_stale_lock_is_stolen_so_it_cannot_wedge_forever` 주석이 신규 형제 테스트 3건과의 관계를 설명하지 않음 (documentation) | `lint_mermaid_posttooluse.py:26-27,109-113`, `test_bootstrap_mermaid_install.py:159-166` | 여유 있을 때 문구 보강 |
| I16 | 의존성 | `package.json` 의 `jsdom`/`mermaid` 버전이 `"*"`(무제한) — lockfile 이 현재는 고정하나 재생성 경로 발생 시 상한 없음(diff 밖, 이전 라운드도 지적) (dependency) | `.claude/tools/mermaid-lint/package.json:10-13` | 실제 semver 범위 명시(`^29.1.1`/`^11.15.0`) |
| I17 | 스코프 | 이번 세 WARNING 수정과 무관한 pre-existing 문서 drift 정정("Three"→"Four responsibilities")이 같은 커밋에 번들됨 — 커밋 메시지에 스스로 디스클로즈, 순수 텍스트라 위험 없음 (scope) | `bootstrap-session.sh:9,17` | 조치 불요, 현재 관행(커밋 메시지 명시) 유지 |

## 긍정 확인 사항 (문제 없음 / 해당 없음)

- **database**: SQL/ORM/트랜잭션/마이그레이션 코드 없음 — 해당 없음.
- **api_contract**: HTTP/REST 엔드포인트·DTO·인증 등 API 계약 대상 코드 없음 — 해당 없음.
- **user_guide_sync**: `doc-sync-matrix.json` 21개 trigger 전수 대조 결과 매칭 0건 — 유저가이드 동반 갱신 의무 없음.
- **scope**: 라인 단위·공백무시 diff 대조 결과 커밋 메시지가 선언한 범위(WARNING #1/#2/#3 + 디스클로즈된 부수 정리)를 벗어나는 숨은 변경 없음.
- **security**: 6개 파일의 모든 `subprocess` 호출이 list-argv, `shell=True` 미사용, NUL-구분 파일명 처리로 커맨드 인젝션에 안전함을 확인. 하드코딩 시크릿·안전하지 않은 역직렬화 없음.
- **side_effect**: 직전 라운드(20_06_45)가 지적한 "완료 마커 판정이 pre-commit/PostToolUse 두 소비처에 전파 안 됨" 문제가 신규 SoT 로 실제 해소됨을 diff 대조 + 테스트 실행(22/22, ResourceWarning 없음)으로 확인. 신규 FS 아티팩트/env/전역상태가 모두 gitignore 범위 내로 안전하게 스코프됨.
- **dependency**: 150개 전이 패키지 라이선스 전수 확인 결과 전부 permissive/약한 copyleft, 저장소 라이선스와 충돌 없음. 하네스 Python 의 "zero third-party dependency" 규약 전수 준수, 신규 불필요 의존성 없음.
- **requirement**: 직전 라운드(20_06_45) 의 WARNING #1(stale-lock 탈취)·#2(소비처 불일치)·#3(무한 재시도)이 코드 라인 단위로 정확히 해소됨을 확인. `python3 -m unittest discover -s .claude/tests` 직접 실행 결과 **304/304 통과**.
- **testing**: 실제 git repo 로 pre-commit 을 구동해 "node_modules 없음"·"partial-install" 두 상태 모두에서 fail-open 정상 동작을 실측 재현. 하네스 스위트 304건 회귀 없음 재확인.
- **concurrency**: 콜드스타트 상호배제(5개 동시 세션 스트레스 테스트)가 `mkdir` 원자성에 정확히 의존해 올바름을 확인.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 훅 자동활성화가 만드는 공급망 신뢰경계(구조적, WARNING) + subprocess 인젝션 안전 확인 |
| performance | LOW | GC 스로틀 부재 등 INFO 5건, 실질 병목 근거 없음 |
| architecture | LOW | bootstrap-session.sh 책임#2 SRP 위반 비대화(W6), SoT import 방어관례 미준수(W7) |
| requirement | LOW | LOCK_GRACE_SEC truncation(W1), vacuous 테스트(W13); 직전 라운드 3개 WARNING 정확 해소 + 304/304 통과 확인 |
| scope | NONE | 범위 이탈 없음, 무관 문서정정 1건 disclosed |
| side_effect | MEDIUM | PostToolUse 안내 메시지가 신규 마커 기준과 어긋남(실측 재현) — 유일 신규 WARNING |
| maintainability | LOW | mtime 판정 중복구현+truncation(W1 과 동일 근거) + 스타일 INFO 5건 |
| testing | LOW | 소비처 배선 mutation-blind 실증(W8), CI paths 갭(W3), 동시성 단언 약함(W9) |
| documentation | MEDIUM | LOCK_GRACE_SEC 미문서화(W1), rmdir/rm-rf 자기모순(W10), docstring 갱신누락(W11) |
| dependency | MEDIUM | 실제 npm 취약점 2건 확인(W4) + 보안스캔 사각지대(W5) |
| database | NONE | 해당없음 |
| concurrency | MEDIUM | npm install 타임아웃 부재(W2), PID 재사용 ABA 락정체(W12) |
| api_contract | NONE | 해당없음 |
| user_guide_sync | NONE | 해당없음, 매칭 trigger 0건 |

## 발견 없는 에이전트

- **database** — DB 관련 코드/개념 없음.
- **api_contract** — API 계약 대상 코드 없음.
- **user_guide_sync** — 유저가이드 동반 갱신 매트릭스 매칭 0건.

## 권장 조치사항

1. `.claude/tools/mermaid-lint` 에서 `npm audit fix` 실행 — 실제 확인된 취약점(undici HIGH 포함) 해소, breaking 없음. (W4)
2. `deps-security-checks.yml` 에 mermaid-lint 전용 audit 스텝 추가 + `harness-checks.yml`/`deps-security-checks.yml` 의 `paths` 에 `.githooks/**` 추가 — 두 CI 사각지대(cross-language binding 테스트 미트리거, npm 의존성 보안 스캔 누락) 동시 해소. (W3, W5)
3. `_lock_is_dead()` 를 `_file_mtime()` 기반 초 단위 산술로 통일해 `MERMAID_INSTALL_LOCK_GRACE_SEC` 분단위 truncation 제거 + non-multiple-of-60 회귀 테스트 추가. (W1)
4. `npm install` 호출에 타임아웃 래핑 추가(플랫폼 호환 고려). (W2)
5. `lint_mermaid_posttooluse.py`/`.githooks/pre-commit` 의 `is_ready()` 게이팅에 `MERMAID_LINT_TOOL_DIR` 오버라이드 기반 실행 회귀 테스트 추가 — 불리언 반전 뮤턴트 방지. (W8)
6. `bootstrap-session.sh` 책임#2(mermaid-lint 설치)를 `ensure-mermaid-lint-deps.sh` 로 추출해 reap 책임과 대칭화. (W6)
7. `lint_mermaid_posttooluse.py` 의 신규 import 를 형제 훅과 동일한 명시적 fail-open 패턴으로 정렬. (W7)
8. `test_concurrent_sessions_install_at_most_once` 를 `assertEqual(npm_calls, 1)` + 마커 존재 확인으로 강화. (W9)
9. `bootstrap-session.sh:62` "rmdir's"→"removes" 정정 + `test_bootstrap_mermaid_install.py` docstring 에 liveness·throttle 두 축 반영. (W10, W11)
10. `_lock_is_dead` 의 소유자 식별에 PID 재사용 대비(시작 시각 등) 추가 또는 known limitation 으로 명시. (W12)
11. `test_marker_without_node_modules_dir_is_not_ready` 를 mock 기반 실제 검증으로 교체하거나 도달 불가 사유를 주석에 남기고 정리. (W13)

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용(사유 텍스트는 prompt 에 명시되지 않음) — 전체 14개 reviewer 전원 실행됨.
  - **router_safety 강제 화이트리스트**: `maintainability, requirement, scope, security, side_effect, testing` — routing 자체가 스킵되어 이 목록과 무관하게 전원 실행되었으나, prompt 및 본 세션의 직접 디렉터리 확인 결과 6개 전원의 결과 파일이 디스크에 존재함을 재확인. 강제 항목 누락으로 인한 거짓 "clean" 판정 없음.
  - **제외된 reviewer**: 없음(0명).