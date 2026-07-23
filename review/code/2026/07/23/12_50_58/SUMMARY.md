# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. scope 리뷰는 NONE, maintainability 리뷰는 LOW(모두 INFO 수준, 강제 조치 사안 없음)로 판정했으며 forced whitelist(maintainability, scope) 전원 결과 확보됨.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 두 dynamic import(jsdom/mermaid)의 try/catch 블록이 구조 동일(의존성명·구조분해 형태만 다름). 각 catch 문자열이 서로 다른 실패 원인을 구분하는 테스트 근거이므로 지금은 2회 반복으로 허용 범위 | `.claude/tools/mermaid-lint/lint-mermaid.mjs:91-100`, `:118-127` | 지금 강제 사안 아님. 3번째 유사 import 가 추가되면 `importOrFailOpen(specifier, pick)` 형태 공용 헬퍼로 추출 |
| 2 | 유지보수성 | exit code `3`(tooling-broken)이 mjs/python/bash 세 언어에 각각 독립 리터럴로 하드코딩 | `lint-mermaid.mjs:30`, `lint_mermaid_posttooluse.py:38`, `.githooks/pre-commit` | 조치 불요 — 언어 경계상 단일 소스 불가, 이미 `test_tooling_broken_exit_code_agrees_across_consumers` pinning 테스트로 drift 를 loud fail 로 전환(MARKER_NAME 계열과 동일한 기존 패턴 재사용) |
| 3 | 유지보수성 | 안내 메시지 문구가 3개 소비처(mjs/python/bash)마다 "Run:" vs "Reinstall with:" 등 표현이 다름 | `lint-mermaid.mjs:96-97`, `lint_mermaid_posttooluse.py:220-223`, `.githooks/pre-commit` | 필수는 아니나 grep 가능성을 위해 "Run/Reinstall with: (cd .claude/tools/mermaid-lint && npm install)" 부분만이라도 동일 문자열로 통일 권장 |
| 4 | 유지보수성 | 신규 테스트 메서드 내부 `import re` 가 파일 내 다른 임포트와 달리 모듈 상단이 아닌 함수 로컬 | `.claude/tests/test_mermaid_lint_ready.py:137` | 파일 자체 일관성을 위해 상단으로 이동 권장(저장소 내 유사 선례 있어 강제 아님) |
| 5 | 유지보수성 | `_EXIT_TOOLING_BROKEN` 신규 분기가 기존 "deps not installed" 분기와 구조·메시지 패턴이 거의 동일 | `lint_mermaid_posttooluse.py:185-195`, `:215-225` | 조치 불요 — 원인 구분을 위해 문자열 분리가 필요하며 공용화 실익이 작음 |
| 6 | 범위(scope) | `.githooks/pre-commit` exit-3 안내 메시지 문구 정리는 선행 리뷰(10_48_43) INFO #7 을 반영한 것으로 확인, 드라이브바이 아님 | `.githooks/pre-commit` | 조치 불요 |
| 7 | 범위(scope) | `review/code/2026/07/22/10_48_43/*` 다수 신규 파일 포함은 프로젝트 컨벤션(리뷰 산출물 커밋 의무)에 부합 | `review/code/2026/07/22/10_48_43/` | 조치 불요 |
| 8 | 범위(scope) | `plan/in-progress/harness-guard-followups.md` 체크박스 갱신은 구현 대상 항목(§A W1)과 정확히 대응 | `plan/in-progress/harness-guard-followups.md` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| scope | NONE | 두 커밋 모두 plan §A W1(10_55_35) + 선행 리뷰(10_48_43) Warning 3건 반영에 정확히 국한. 의도 이상 확장·무관 수정·불필요 리팩토링 없음 |
| maintainability | LOW | Critical/Warning 없음. dynamic-import try/catch 2회 반복, exit code 3중 하드코딩(불가피, pinning 테스트로 보호), 메시지 문구 소비처간 불일치 등 INFO 수준 개선 여지만 존재 |

## 발견 없는 에이전트

없음 (실행된 2개 에이전트 모두 INFO 수준 발견사항 보유).

## 권장 조치사항

1. (선택) 3개 소비처(mjs/python/bash)의 "npm install 안내" 문구를 동일 문자열로 통일해 grep 가능성 개선.
2. (선택) `test_mermaid_lint_ready.py` 의 `import re` 를 파일 상단으로 이동.
3. 향후 세 번째 유사 dynamic-import 블록이 추가되면 그때 공용 헬퍼로 추출 (지금은 불요).
4. 나머지 INFO 항목은 모두 "조치 불요"로 판정됨 — 즉시 조치 불필요.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용. `forced`(router_safety) 화이트리스트 `maintainability, scope` 전원 실행, 결과 확보됨.
  - **실행**: `scope`, `maintainability` (2명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `maintainability`, `scope` — 전원 결과 확보됨 (forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | - |