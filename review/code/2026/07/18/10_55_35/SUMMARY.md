# Code Review 통합 보고서

대상 커밋: `a16d80290` "fix(harness): mermaid 설치 락 제거 — 마커-only 로 전환 (02_06_42 C1)"
대상 파일: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`, `.githooks/pre-commit`, `.claude/tests/README.md`
배경: 직전 라운드(`review/code/2026/07/18/02_06_42`)에서 리뷰어 2명 + 사용자 자신이 3-way 실측 재현한 CRITICAL C1(손수 짠 `mkdir` 락의 stale-lock steal TOCTOU)을 해결하기 위해, 락 apparatus 전체(owner PID·grace·steal·해제)를 삭제하고 완료 마커 + 실패 throttle 만 남기는 축소 diff.

## 전체 위험도

**MEDIUM** — CRITICAL 0건. 3라운드 연속 실측 재현되던 mkdir 락의 stale-lock TOCTOU(직전 라운드 CRITICAL C1)를 락 apparatus 전체 삭제로 근본 해소한 것은 14개 reviewer 전원이 공통 확인한 올바른 방향이다. 다만 concurrency reviewer 가 **실제 격리 재현(mermaid 패키지 dist/ 제거 시뮬레이션)으로 검증**한 바에 따르면, 이번 diff 가 수용한 잔여 리스크("첫 cold-install 동시 경쟁")의 실제 최악 결과가 설계 노트의 서술("조용히 방치, 수동 복구")보다 나쁘다 — 마커가 트리 무결성이 아니라 자기 자신의 npm exit code 만 보므로, 동시 쓰기로 오염됐지만 "ready"로 오판된 트리에서 `lint-mermaid.mjs` 의 가드 없는 최상위 `await import("mermaid")` 가 크래시하면 그 종료 코드가 pre-commit·PostToolUse 양쪽에서 "진짜 mermaid 문법 에러"와 구분되지 않아, 두 파일이 명시한 fail-open 불변식과 반대로 매 markdown 커밋이 잘못된 메시지로 차단될 수 있다(WARNING, 이번 라운드의 가장 중요한 신규 발견). 나머지 WARNING 2건(콜드스타트 동시 install 중복 — performance, bash mtime 헬퍼 중복구현 — maintainability)은 이미 사용자가 명시적으로 검토·수용했거나(2026-07-18 결정, plan §G 추적) 저위험 유지보수성 항목이다. router 는 이번 라운드에 사용되지 않아(route_mode=all) 14개 reviewer 전원이 직접 실행됐고, router_safety 강제 목록(7명) 결과도 전원 확보되어 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 동시성(Concurrency) | 락 제거로 수용한 "첫 cold-install 동시 경쟁" 잔여 리스크의 실제 최악 결과가 설계 노트 서술("조용히 방치, 수동 복구")보다 나쁨. 마커는 자기 자신의 `npm install` exit code 만 보고 무조건 기록되며 node_modules 트리 무결성은 전혀 검증하지 않는다 — 동시 설치 중 자신은 성공했지만 형제 프로세스의 동시 쓰기로 실제 트리는 손상된 상태가 "ready"로 오판될 수 있다. 이 상태에서 `lint-mermaid.mjs` 의 try/catch 없는 최상위 `await import("mermaid")` 가 크래시하면, 그 비-zero exit code 가 pre-commit·PostToolUse 양쪽에서 "진짜 mermaid 파싱 에러 발견"과 구분되지 않아 두 파일이 명시한 "fail open — 깨진 가드가 정상 작업을 막으면 안 된다" 불변식과 정반대로 매 markdown 커밋이 사실과 다른 메시지("malformed mermaid block(s)")로 차단됨. 실제 저장소의 mermaid 패키지(75MB, tool_dir 최대 비중)를 격리 복제해 dist/ 제거로 "부분 설치"를 시뮬레이션하여 `ERR_MODULE_NOT_FOUND` 크래시·exit 1 을 직접 재현·검증함 | `.claude/tools/bootstrap-session.sh:87-97`(마커 무조건 기록), `.githooks/pre-commit:50-55,70-74`(신규 주석이 이 gap 을 다루지 않음, `exit 1` 무조건 처리); 소비측(리뷰 범위 밖이나 근거로 확인): `.claude/tools/mermaid-lint/lint-mermaid.mjs:93`, `.claude/hooks/lint_mermaid_posttooluse.py:135-141` | (1) `lint-mermaid.mjs` 의 `await import("mermaid")`/`await import("jsdom")` 를 try/catch 로 감싸 로드 실패를 파싱 에러와 다른 종료 코드(예: 3)로 분리하고, pre-commit·PostToolUse 양쪽이 그 코드를 "툴링 깨짐→fail open"으로 명시 처리하도록 배선. (2) 또는 `is_ready()` 에 최소 스모크 체크(핵심 엔트리포인트 파일 존재 확인) 추가. (3) 최소한 설계 노트의 "Residual, accepted" 서술을 실제 최악의 경우로 정정 |
| W2 | 성능(Performance) | 락 제거로 "사전 락 없는 콜드스타트 = mkdir 원자성 덕에 정확히 1회 설치"라는, 직전 라운드가 15-way 동시실행 10/10 회로 실측 검증했던 정상 동작까지 함께 사라짐. 여러 세션이 동시에 시작하면(이 저장소가 스스로 정상 워크플로로 문서화한 "여러 worktree 동시 실행") 세션 수만큼 `npm install`(jsdom+mermaid, 가볍지 않음)이 중복 실행될 수 있고, 자원 경합으로 개별 설치 소요 시간(=세션 블로킹 시간)이 오히려 늘어날 위험도 있음. 새 테스트도 `assertGreaterEqual(...,1)` 이라는 약화된 단언으로 이를 명시적으로 인정 | `.claude/tools/bootstrap-session.sh:56-72`(design note), `:87-97`(설치 블록); `.claude/tests/test_bootstrap_mermaid_install.py:156-182`(`test_concurrent_cold_start_converges_and_then_stops_reinstalling`) | **코드 변경 불요** — 사용자가 2026-07-18 명시적으로 correctness 우선으로 수락한 트레이드오프이며 근본 해법(`fcntl.flock`)은 plan §G 로 이미 추적 중. Design note 의 "narrow window" 문구를 실제 근거(다중 worktree 동시 시작이 문서화된 정상 워크플로)와 함께 보강 권고. 체감 지연/자원낭비가 실제 보고되면 "탈취 없이 획득만 원자적인 mkdir 게이트"가 저비용 중간 대안 |
| W3 | 유지보수성(Maintainability) | mtime 기반 쿨다운 판정 헬퍼가 `reap-merged-worktrees.sh` 와 거의 동일하게 재구현되고 이름도 갈림(`_file_mtime` vs `file_mtime`) — 같은 diff 가 Python 쪽에서는 정확히 이 패턴(3곳이 readiness 판정을 각자 구현)을 `_lib/mermaid_lint_ready.py` 단일 SoT 로 해소했는데 bash 쪽 동일 패턴엔 같은 처방이 적용되지 않음 | `.claude/tools/bootstrap-session.sh:78`(`_file_mtime`), `:81-85`(`_install_throttled`) vs `.claude/tools/reap-merged-worktrees.sh:113`(`file_mtime`), `:111-122`(throttle 블록) | 낮은 우선순위. `.claude/tools/_lib/` 같은 공유 source 가능한 `.sh` 로 mtime/쿨다운 판정을 추출하거나, 최소한 헬퍼 네이밍 컨벤션(언더스코어 유무) 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 동시성/보안 | 락 제거로 "npm install 무제한 대기(timeout 래핑 없음)" 라는 기존에 알려졌던 한계의 blast radius 가 세션 1개 → 동시 콜드스타트 세션 전체로 확대됨(security·concurrency 두 reviewer 가 독립적으로 수렴). 이전 버전의 "락을 쥔 세션 하나만 영향받는다"는 완화 근거 자체가 없어졌으나, 새 "Residual, accepted" 설계 서술·plan §A/§G 어디에도 이 변화가 등재돼 있지 않음 | `.claude/tools/bootstrap-session.sh:56-72,87-97` | 설계 노트 또는 plan 후속 항목에 한 줄 기록(코드 변경 불요, track 목적) |
| I2 | 테스트 | 동시(concurrent)×실패(failure) 축 조합이 테스트되지 않음 — 여러 세션이 동시에 cold-start install 을 시도했는데 일부/전부 실패하는 케이스 미검증(코드가 멱등 연산만 사용해 실제 손상 가능성은 낮음) | `.claude/tests/test_bootstrap_mermaid_install.py:156`(성공 경로만 5-way), `:185,193`(실패는 항상 단일 프로세스) | 우선순위 낮음. `NPM_STUB_FAIL=1` 5-way 동시 실행이 크래시 없이 exit 0·`fail_marker` 정확히 생성·이후 throttle 정상 작동함을 단언하는 테스트 1건 추가 고려 |
| I3 | 요구사항/테스트 | 연속 실패 시 cooldown 이 가장 최근 실패 시각 기준으로 갱신되는 동작(코드상으로는 정확 — bash `>` 리다이렉트가 기존 파일도 mtime 갱신)을 직접 단언하는 회귀 테스트가 없음 | `.claude/tools/bootstrap-session.sh:94-96`; `test_bootstrap_mermaid_install.py::test_failed_install_is_throttled_within_cooldown` | 우선순위 낮음. "실패→일부 대기→재실패(throttle 밖에서)" 조합 테스트 추가 고려 |
| I4 | 문서화 | `_file_mtime` 크로스플랫폼(BSD/GNU stat) 헬퍼에 그 의도를 설명하는 인라인 주석이 없음 — 같은 파일의 다른 로직엔 "왜"를 설명하는 주석이 충실한 것과 대비됨 | `.claude/tools/bootstrap-session.sh:104` | `# cross-platform (BSD stat vs GNU stat) mtime in epoch seconds; 0 if missing` 1줄 추가 |
| I5 | 유지보수성 | 신규 테스트의 `import _harness  # noqa: F401` 주석이 스위트 전반의 "왜 이 import 가 의도적인지" 트레일링 설명 컨벤션을 생략. 이 파일은 실제로 `_harness.REPO_ROOT` 를 참조하므로 "미사용 import" 프레이밍 자체가 부정확(같은 케이스를 다루는 `test_run_test_watchdog.py:30` 은 정확히 반영) | `.claude/tests/test_bootstrap_mermaid_install.py:34`(및 같은 diff 의 `test_mermaid_lint_ready.py:26`) | 기존 컨벤션에 맞춰 트레일링 설명 추가 — 예: `# noqa: F401  — side effect: puts .claude/hooks on sys.path; REPO_ROOT used below` |
| I6 | 유지보수성 | 쿨다운 리터럴 `1800`(프로덕션 기본값 `MERMAID_INSTALL_RETRY_SEC:-1800` 과 우연히 일치)이 두 테스트 메서드에 걸쳐 4회 하드코딩, "이 값이 프로덕션 기본값을 미러링한다"는 의도가 코드상 명시적이지 않음 | `.claude/tests/test_bootstrap_mermaid_install.py:186,188,194,197` | 선택적. `_DEFAULT_RETRY_AFTER = 1800` 모듈 상수화하면 의도가 명시되고 향후 갱신 시 grep 한 곳으로 충분 |
| I7 | 보안 | `npm install --no-fund --no-audit --silent` 로 설치 시점 npm 취약점 감사 생략 — 기존 추적 항목(00_59_56·02_06_42 라운드 INFO), 이번 diff 로 상태 불변. 로컬 개발 전용 린터라 blast radius 제한적 | `.claude/tools/bootstrap-session.sh:90` | 이미 추적 중, 재조치 불요 |
| I8 | 보안 | 버전관리된 git hook(`core.hooksPath`) 자동 활성화 = 공급망 신뢰 경계 — 기존 WARNING(00_59_56 라운드), 이번 diff 는 그 안의 동시성 제어만 재작업했을 뿐 이 표면 자체를 넓히거나 좁히지 않음 | `.claude/tools/bootstrap-session.sh:25-32`, `.githooks/pre-commit` 전체 | 이번 라운드의 신규 문제 아님, 재조치 불요 |
| I9 | 아키텍처 | 섹션 4(reap anchor)의 세션-파괴 방지가 `BASH_SOURCE` 경로 해석이라는 단일 신호에 의존하나, 리퍼 자체의 독립적 cwd-skip 이 2차 방어선으로 확인됨(이번 diff 범위 밖 — 마지막 커밋은 섹션 2만 변경) | `.claude/tools/bootstrap-session.sh:152-156` | 급하지 않음. 여유 있을 때 "anchor 해석 실패 시에도 리퍼가 cwd-skip 으로 보호됨"을 pin 하는 회귀 테스트 1건 고려 |
| I10 | 성능 | 상태 마커 GC(3번 섹션)가 여전히 스로틀 없이 매 세션 무조건 `find` 실행 — 3라운드 연속(20_06_45/00_59_56/02_06_42) 동일하게 INFO·조치 불필요로 수렴한 기존 사항, 이번 diff 는 이 섹션을 변경하지 않음, 자연스러운 크기 제한(세션당 1파일·30일 초과분만)으로 실측 비용 낮음 | `.claude/tools/bootstrap-session.sh:99-108` | 조치 불필요 |
| I11 | 의존성 | `.claude/tools/mermaid-lint/package.json` 의 `jsdom`/`mermaid` 버전이 `"*"` 로 미고정(이번 diff 범위 밖, 커밋된 `package-lock.json` 이 실질적 고정 제공하나 `npm install`은 `npm ci` 대비 락파일 out-of-sync 시 재해석 여지가 더 넓음) | `.claude/tools/mermaid-lint/package.json` | 이번 diff 의 필수 수정 사항 아님. 추후 이 파일을 손댈 때 명시적 range 로 교체 권장 |
| I12 | 스코프/문서화(경미 묶음) | (a) 섹션 4 헤더의 "(see section 4)" 자기참조가 1~3번 항목과 스타일 불일치. (b) `worktree-policy.md`(범위 밖 파일)의 앵커 서술이 `bootstrap-session.sh` 자체 주석("`$CLAUDE_PROJECT_DIR` 가 아니라 `BASH_SOURCE` 유도")과 결이 다름 — 이번 diff 회귀 아님. (c) 락 제거와 무관한 중복 assertion 라인 삭제 + `_env()` 독스트링의 과거 WARNING 번호 인용 삭제가 같은 커밋에 부수적으로 섞임(동작 영향 없음). (d) git-fixture 보일러플레이트가 `test_reap_merged_worktrees.py` 와 일부 반복(DAMP>DRY for tests 로 허용 가능). (e) 4-way `&&` 체인 install 가드에 이름 붙은 술어 없음(선택적) | `bootstrap-session.sh:43`; `.claude/docs/worktree-policy.md:117`(범위 밖); `test_bootstrap_mermaid_install.py`(`test_failed_install_retries_after_cooldown`, `_env()` 독스트링, `:51-91` fixture); `bootstrap-session.sh:87-88` | 전부 조치 불요 또는 선택적 — 별도 커밋 분리 실익 없는 수준 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | hang blast radius 확대(I1, 신규 관찰) + 기존 추적 항목(`--no-audit`=I7, git hook 자동활성화=I8) 상태 불변 확인; 이전 라운드 INFO(PID 재사용 lock-steal 오탐)는 코드 삭제로 moot |
| performance | MEDIUM | 콜드스타트 mkdir 원자성(정확히 1회 설치) 보장 상실 → 세션 수만큼 npm install 중복 가능(W2, 수용된 트레이드오프); GC 무스로틀(I10)은 기존 추적 |
| architecture | LOW | 반복 반증된 mkdir 락 안티패턴을 삭제로 근본 해소한 올바른 설계 판단(긍정 기록); reap anchor 단일신호 의존(I9)은 2차 방어선 확인됨 |
| requirement | NONE | C1 근본 해결 확인(락 코드 완전 삭제로 재발 구조적 불가능), plan/README/코드/테스트 4면이 line-level 정합, 301건 테스트 all green 직접 실행 |
| scope | NONE | diff 가 커밋 의도(락 제거 + 같은 라운드 W5/W6 문서 정정)와 라인 단위로 정확히 대응, 무관한 파일/기능 확장 없음. 부수 정리 2건만(I12) |
| side_effect | LOW | 공유 node_modules 동시쓰기 보호 제거는 코드/plan/커밋메시지 3곳에 문서화된 수용 리스크; `MERMAID_INSTALL_LOCK_GRACE_SEC` 등 제거된 인터페이스는 `git merge-base` 로 `origin/main` 노출 이력 없음 직접 확인(blast radius 0) |
| maintainability | LOW | mtime 쿨다운 헬퍼가 `reap-merged-worktrees.sh` 와 중복구현+네이밍 불일치(W3); 나머지는 `_harness` noqa 컨벤션(I5)·리터럴 하드코딩(I6) 등 스타일 수준 INFO |
| testing | LOW | 테스트 변경이 코드 삭제와 1:1 대응, 비-vacuity 독립 뮤테이션으로 재검증 성공, 301건 전체 하네스 PASS 직접 실행; 동시×실패 조합 미검증(I2)만 잔여 |
| documentation | LOW | 코드 설계노트·테스트 docstring·README·pre-commit 헤더·plan §A/§G 5곳이 같은 커밋에서 일괄 동기화(모범 사례로 평가); 헬퍼 주석 부재(I4) 등 스타일 수준 INFO 소수 |
| dependency | LOW | 신규 외부 의존성 없음, 오히려 자체 구현 동시성 코드 제거로 내부 의존 표면 감소; 제거된 락 심볼 dangling 참조 저장소 전체 0건 확인 |
| database | NONE | 해당 사항 없음(DB 관련 코드/설정 전무) |
| concurrency | MEDIUM | C1(stale-lock TOCTOU) 원천 소거 확인 + **실측 재현**으로 확인된 신규 WARNING(W1) — 수용된 잔여 리스크의 2차 결과가 fail-open 불변식을 깨뜨려 매 markdown 커밋이 오판 차단될 수 있음(이번 라운드 최중요 발견) |
| api_contract | NONE | 해당 사항 없음(REST/HTTP API 표면과 무접점) |
| user_guide_sync | NONE | 해당 사항 없음(`doc-sync-matrix.json` 21행 어느 trigger 에도 미매칭, 유저 가이드 참조 0건 확인) |

## 발견 없는 에이전트

database, api_contract, user_guide_sync — 모두 "해당 사항 없음"을 근거와 함께 명시적으로 확인(리뷰 대상 파일이 각 관점의 스코프와 무접점).

## 권장 조치사항

1. **(W1, 최우선)** `lint-mermaid.mjs` 의 `await import("mermaid")`/`await import("jsdom")` 를 try/catch 로 감싸 로드 실패(툴링 깨짐)를 파싱 에러와 다른 종료 코드로 분리하고, `.githooks/pre-commit`·`.claude/hooks/lint_mermaid_posttooluse.py` 양쪽이 그 코드를 "fail open"으로 처리하도록 배선 — 실제 격리 재현으로 확인된, 두 파일이 스스로 명시한 fail-open 불변식 위반을 막는 조치. 대안으로 `is_ready()` 에 최소 스모크 체크 추가도 가능.
2. **(W2, 코드 변경 불요)** 콜드스타트 동시 install 중복은 이미 사용자가 수락한 트레이드오프이므로 그대로 두되, design note 의 "narrow window" 문구를 실제 근거(다중 worktree 동시 시작은 이 저장소의 문서화된 정상 워크플로)와 함께 보강해 향후 재논의 시 안전 논증 오류를 줄일 것.
3. **(W3, 낮은 우선순위)** bash mtime/쿨다운 헬퍼(`_file_mtime`/`_install_throttled`)를 `reap-merged-worktrees.sh` 의 동일 로직과 공유 소싱 가능한 `.claude/tools/_lib/*.sh` 로 통합하거나 최소한 네이밍 컨벤션(언더스코어 유무) 통일.
4. **(I1, track 목적)** "npm install 무제한 대기"의 blast radius 가 세션 1개→전체로 확대됐다는 사실을 design note 또는 plan 후속 항목에 한 줄 기록.
5. **(선택)** 나머지 INFO 항목(테스트 커버리지 갭 I2/I3, 문서 스타일 I4/I5/I6/I9/I12, 기존 추적 항목 I7/I8/I10, 버전 미고정 I11)은 우선순위가 낮으며 이번 라운드에서 즉시 조치를 요구하지 않음.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(`meta.json` 기준 `route_mode=all`, `agents_explicit=false`). 14개 reviewer 전원이 직접 실행됨(제외 0명).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 라우터가 사용되지 않았으므로 실질적으로는 전체 실행에 포함된 상태이나, 화이트리스트 자체는 명시. **forced 전원 결과 확보됨**(누락 없음, 화이트리스트 미이행 사례 없음).

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | 라우터 미사용으로 전원 실행 |