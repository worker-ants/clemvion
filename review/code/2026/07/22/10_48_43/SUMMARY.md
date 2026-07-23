# Code Review 통합 보고서

## 전체 위험도
**LOW** — 코드 자체는 의도(§A W1, `review/code/2026/07/18/10_55_35/concurrency.md`)와 line-level 로 정확히 합치하는 fail-open 분리 구현이며 Critical 없음. 다만 **router 가 forced(안전 화이트리스트)로 지정한 `maintainability`, `scope` 두 reviewer 의 결과가 전문·파일 모두 확보되지 않았다** — 이 두 관점(유지보수성·스코프 이탈)의 Critical 유무는 이 SUMMARY 에 반영되지 못했으므로 "clean" 으로 해석하면 안 되며, 재실행/재시도가 필요하다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 두 번째 `await import("mermaid")` catch 블록(jsdom 은 정상, mermaid 만 깨진 "부분 설치 손상" 시나리오)이 현재 테스트 setUp 구조상 첫 번째 `import("jsdom")` catch 에서 항상 먼저 걸려 실행되지 않는 dead branch — mutation-surviving 후보 | `.claude/tools/mermaid-lint/lint-mermaid.mjs:1041-1050` ↔ `.claude/tests/test_lint_mermaid_exit_codes.py:302-318` (`setUp`) | `setUp` 에 jsdom 만 성공하도록 최소 stub 패키지(`node_modules/jsdom/package.json`)를 배치하고 mermaid 만 미설치로 남겨, 두 번째 catch 블록(및 에러 메시지 attribution)을 강제로 실행시키는 케이스 추가 |
| 2 | Requirement | 신규 exit code `3`(`EXIT_TOOLING_BROKEN`)이 mjs/python/bash 3개 언어 경계에 독립 하드코딩됐는데, 저장소가 동일 유형 문제(MARKER_NAME 등)에 이미 적용한 "cross-language 값 일치 pinning 테스트" 컨벤션이 이 값엔 미적용. 현재 테스트는 mjs 단독 실제값(a)과 stub 기반 python/bash 분기(b)를 분리 검증만 해, python/bash 상수만 실수로 다른 값으로 바뀌어도 stub 테스트가 그 값을 그대로 주입해 통과함 | `.claude/tools/mermaid-lint/lint-mermaid.mjs:9` (`EXIT_TOOLING_BROKEN = 3`), `.claude/hooks/lint_mermaid_posttooluse.py:39` (`_EXIT_TOOLING_BROKEN = 3`), `.githooks/pre-commit:1113` (`-eq 3`) | `ConsumerBindingTest` 에 세 소스 파일에서 정규식으로 값을 추출해 상호 일치를 단언하는 케이스 추가, 또는 실제 mjs 를 대상으로 한 end-to-end 통합 테스트 추가 |
| 3 | Documentation / Requirement | 신규 테스트 모듈 docstring 이 인용하는 리뷰 경로 날짜가 실제와 하루 어긋남(`2026/07/17` → 실제 `2026/07/18`). `review/code/2026/07/17/` 하위엔 `10_55_35` 폴더 자체가 없음(확인됨). plan 문서(`harness-guard-followups.md`)도 07/18 라운드로 서술 | `.claude/tests/test_lint_mermaid_exit_codes.py:14` | docstring 의 `2026/07/17` 을 `2026/07/18` 로 정정 (추적성 목적 인용이므로 오기재 시 근거 문서 추적 실패) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 신규 fail-open 경로는 콘텐츠 안전성이 아닌 순수 구문 검사(mermaid `parse()`)에 한정 — 남용돼도 "문법 오류 미탐지" 수준이며 인증 우회·데이터 노출 등 직접적 보안 영향 없음 | `lint-mermaid.mjs:1010-1050`, `lint_mermaid_posttooluse.py:215-225`, `.githooks/pre-commit:1106-1114` | 조치 불요. 향후 린터가 콘텐츠 안전성 검증까지 겸하면 정책 재검토 |
| 2 | Security | jsdom/mermaid import 실패 시 Node 예외 메시지(`e.message`)를 stderr 에 그대로 노출 — 로컬 개발 세션 한정, 민감정보 없음 | `lint-mermaid.mjs:1018-1021`, `:1045-1048` | 조치 불요 |
| 3 | Requirement | 이번 diff 가 정확히 구현하는 `harness-guard-followups.md` §A W1 항목의 plan 체크박스가 여전히 `[ ]` 로 미갱신 | `plan/in-progress/harness-guard-followups.md` (§A, W1 항목) | 이 구현 커밋 시점(또는 직후)에 체크박스 `[x]` 갱신 |
| 4 | Requirement | 이번 fix 는 "동적 import 실패"만 좁게 커버 — `new JSDOM(...)` 생성자나 `mermaid.initialize()` 자체의 예외, 또는 시그널 종료(`returncode` 음수) 등은 여전히 "파싱 에러"로 오분류돼 커밋/편집 차단 가능 (원 리뷰 스코프 밖으로 판단됨) | `lint-mermaid.mjs` (`new JSDOM(...)` 생성자, `mermaid.initialize()`), `lint_mermaid_posttooluse.py` 최종 fallthrough 분기 | 즉각 수정 불요. 필요 시 별도 후속 항목으로 트래킹 |
| 5 | Testing | "ready + node exit 0(정상 통과)" happy-path 에 대한 실행 기반 회귀 테스트가 두 소비자(PostToolUse/pre-commit) 모두 부재 — 이번 diff 이전부터 존재하던 갭 | `.claude/tests/test_mermaid_lint_ready.py` (`PostToolUseExecutionTest`/`PreCommitExecutionTest`) | 필수 아님. `node_exit_code=0` 케이스로 `returncode==0` 및 "skipped/aborted" 문구 부재를 검증하는 테스트 추가 권장 |
| 6 | Testing | "실제 훅 → 실제 is_ready → 실제 node → 손상된 실제 mjs" 전체 체인의 end-to-end 테스트는 없음 (두 테스트 파일이 서로 다른 이음매만 검증, 의도적으로 문서화된 트레이드오프) | `test_mermaid_lint_ready.py`(stub node) vs `test_lint_mermaid_exit_codes.py`(직접 mjs 호출) | 우선순위 낮음. `MERMAID_LINT_TOOL_DIR` 을 손상된 `tool_dir` 로 지정해 `lint_mermaid_posttooluse.py` 를 subprocess 로 직접 구동하는 테스트 1개 추가 시 완전한 삼각검증 |
| 7 | Documentation | `.githooks/pre-commit` 의 신규 exit-3 안내 메시지 괄호 구성이 어색함(`... npm install) ).`) — 자매 메시지(`lint_mermaid_posttouse.py`)와 톤 불일치, 기능엔 무영향 | `.githooks/pre-commit` 신규 분기 | 다른 소비처와 동일 톤으로 통일 (여는 괄호 즉시 닫고 "Run:" 분리) |
| 8 | Documentation | `lint_mermaid_posttooluse.py` 모듈 상단 exit-code 계약표의 "exit 0 → no problem" 한 줄에 "deps not installed" 와 신규 "tooling broken" 두 fail-open 서브케이스가 묵시적으로 뭉뚱그려져 있어 상단만 보는 독자는 후자를 놓칠 수 있음(허위 아님, 코드 내 인라인 주석은 충분) | `lint_mermaid_posttooluse.py:70-75` (모듈 docstring) | (선택) "including deps-not-ready and tooling-broken fail-open cases" 구 추가 |
| 9 | Side Effect | fail-open 설계가 "의존성 미설치"와 "의존성 손상/변조(공급망 문제 가능)"를 동일 취급 — 조용히 스킵되면 린트 기능이 장기간 비활성 상태로 남을 수 있음(커밋 차단은 없음, stderr 안내만 존재) | `lint-mermaid.mjs` import catch 블록, `lint_mermaid_posttooluse.py` `_EXIT_TOOLING_BROKEN` 분기, `.githooks/pre-commit` `mermaid_rc -eq 3` 분기 | 현재 설계 의도상 변경 불요. 후속으로 exit 3 발생 빈도를 세션 부트스트랩 로그 등으로 가시화하는 안은 검토 가능(본 PR 스코프 밖) |
| 10 | Side Effect | 신규 테스트가 "OS temp 디렉터리 상위에 `node_modules` 없음" 이라는 환경 가정에 결합돼 있어, 특이 실행 환경(리포 내부 임시경로 등)에서는 이 테스트가 vacuous 해질 가능성(프로덕션 코드 결함 아님) | `.claude/tests/test_lint_mermaid_exit_codes.py` `setUp()` | 현재 문제 없음. 향후 CI 환경 변경 시 참고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 커맨드 인젝션·시크릿·인증 이슈 없음. fail-open 범위가 보안 게이트 아닌 구문 검사에 한정돼 영향 없음 |
| requirement | LOW | 의도(§A W1)와 구현 정확히 합치, 17건 테스트 실행 확인. exit-code 3 cross-language pinning 테스트 부재(WARNING), 날짜 오기재·plan 체크박스 미갱신(INFO) |
| side_effect | LOW | 세 소비자 모두 일관 갱신, 파급 범위 닫혀 있음. fail-open 이 "미설치/손상" 동일 취급하는 트레이드오프(INFO) |
| testing | LOW | stub-vs-real 이원 전략 전반적으로 견고. 두 번째 mermaid-import catch 블록이 dead branch(WARNING) |
| documentation | LOW | 인라인 주석·docstring 충실. 인용 날짜 오기재(WARNING), 메시지 괄호 어색함(INFO) |
| maintainability | **재시도 필요** | forced(router_safety) 지정됐으나 전문·파일 모두 미확보 |
| scope | **재시도 필요** | forced(router_safety) 지정됐으나 전문·파일 모두 미확보 |

## 발견 없는 에이전트

없음 (실행된 5개 reviewer 모두 최소 1건 이상의 INFO/WARNING 보고).

## 권장 조치사항

1. **[최우선]** forced 지정된 `maintainability`, `scope` reviewer 를 재실행해 결과를 확보할 것 — 두 관점의 Critical 유무가 현재 미확인 상태다.
2. 두 번째 `mermaid` import catch 블록을 실행시키는 테스트 케이스 추가 (jsdom 만 stub 으로 성공시키고 mermaid 만 실패) — mutation-surviving 갭 해소.
3. exit code `3` 값의 cross-language 일치를 검증하는 `ConsumerBindingTest` 케이스 추가 (mjs/python/bash 3파일 값 상호 대조).
4. `test_lint_mermaid_exit_codes.py` docstring 의 인용 날짜(`2026/07/17` → `2026/07/18`) 정정.
5. (부수) `harness-guard-followups.md` §A W1 체크박스를 이 구현 커밋에 맞춰 `[x]` 로 갱신, `.githooks/pre-commit` 안내 메시지 괄호 구성 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 — 이 중 `scope`, `maintainability` 는 결과 미확보)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 이 중 **`maintainability`, `scope` 는 결과가 확보되지 않아 강제 화이트리스트 의무가 미이행 상태**. 이는 "해당 관점에 문제 없음" 이 아니라 "확인되지 않음" 으로 취급해야 한다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관 |
  | database | router 판단상 이번 diff 와 무관 |
  | concurrency | router 판단상 이번 diff 와 무관 |
  | api_contract | router 판단상 이번 diff 와 무관 |
  | user_guide_sync | router 판단상 이번 diff 와 무관 |