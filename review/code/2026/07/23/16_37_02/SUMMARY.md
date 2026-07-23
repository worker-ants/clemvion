# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical·Warning 0건. 유일한 실질 지적은 maintainability 가 매긴 LOW(테스트 헬퍼 보일러플레이트 3중 복제가 4번째 클래스로 확대)이며, 이는 이미 `plan/in-progress/harness-guard-followups.md` W3 항목으로 추적·저우선 defer 처리된 기존 부채다. forced(router_safety) 7개 reviewer(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability/testing/documentation | 테스트 헬퍼 보일러플레이트(`node` 스텁 생성 + `_node_calls` 카운터 + setUp)가 신규 `PostToolUseImportFailOpenTest`로 3번째→4번째 클래스에 복제됨 | `.claude/tests/test_mermaid_lint_ready.py:341-441` | 지금 처리 불요(이미 plan W3 항목으로 추적·저우선 defer). 향후 W3 해소 시 공통 mixin/헬퍼로 통합 권장 |
| 2 | testing | `test_broken_helper_fails_open_without_invoking_the_linter`의 `assertIn("skipped", r.stderr)`가 형제 테스트(`assertIn("skipped (tooling deps not installed)", ...)`)보다 문구가 덜 구체적 | `.claude/tests/test_mermaid_lint_ready.py:418` | 일관성을 위해 형제 테스트와 동일한 구체 문구로 통일 권장(현재는 `"Traceback"` 병행 단언으로 분기 특정성 이미 확보돼 있어 차단 사유 아님) |
| 3 | requirement | plan frontmatter `worktree: harness-guard-followups-f7140c`가 현재 작업 worktree(`harness-test-coverage-006e09`)와 불일치 | `plan/in-progress/harness-guard-followups.md:2` | 조치 불요(멀티-PR 백로그의 설계상 허용 패턴). 반복되면 하위그룹 폴더(`plan/in-progress/harness-guard-followups/`) 승격 검토 |
| 4 | requirement | 카탈로그 파서 정규식이 파일명을 소문자/숫자/언더스코어로만 매칭 | `.claude/tests/test_tests_readme_catalog.py:29` | 현재 위양성 없음(전 파일 snake_case). 필요 시 문자 클래스를 `[A-Za-z0-9_]`로 확장하는 사소한 개선 여지 |
| 5 | side_effect | stderr 문자열(`"Traceback"`, `"skipped"`)에 대한 하드 커플링 — 훅 문구가 바뀌면 의도대로 테스트가 깨짐 | `.claude/tests/test_mermaid_lint_ready.py:410-427` | 조치 불요 — 저장소 관례(behavioral pinning)와 일치 |
| 6 | side_effect | 신규 가드가 향후 모든 `.claude/tests/test_*.py` 추가/삭제/개명 PR 에 README 카탈로그 갱신을 사실상 강제하는 새 통과조건 도입 | `.claude/tests/test_tests_readme_catalog.py` | 조치 불요 — 의도된 기능 확장, 팀 인지 필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 서브프로세스 전부 리스트 인자(`shell=True` 없음), tmp 격리 안전, 시크릿/인젝션/ReDoS 표면 없음 |
| requirement | NONE | 실행 기반 재검증(mermaid_lint_ready 17건, catalog 5건, 전체 453건 OK), plan 수치 주장 git 이력 대조로 확인 |
| scope | NONE | 4파일 변경이 plan 항목(W4·README 카탈로그)과 1:1 대응, drive-by/무관 변경 없음 |
| side_effect | NONE | 프로덕션 코드 미변경, `tempfile.mkdtemp`+`addCleanup` 격리, 환경변수 사본만 사용, 네트워크 호출 없음 |
| maintainability | LOW | 테스트 헬퍼 보일러플레이트 3중 복제가 4번째 클래스로 확대(W3 기추적·저우선) |
| testing | NONE | 뮤테이션 재현으로 비-vacuity 실측 검증, README 카탈로그 28/28 일치 확인, 453/453 통과 |
| documentation | NONE | 독스트링·근거 서술이 실제 코드/이력과 정확히 부합, 신규 계약 위험 없음 |
| api_contract | NONE | API 계약 대상 코드 변경 없음(harness 테스트/문서 전용) |

## 발견 없는 에이전트

- **scope**: "발견사항: 없음" — 참고 섹션에 검증 근거만 기술(4파일 변경이 plan 목표와 정확히 대응, README 9행 백필도 스코프 내).
- **api_contract**: "발견사항: 없음" — REST/DTO/라우트 등 API 계약 대상 코드 변경이 diff에 전혀 없음.

## 권장 조치사항

1. (선택) `test_broken_helper_fails_open_without_invoking_the_linter`의 `"skipped"` assertion 을 형제 테스트와 동일한 구체 문구(`"skipped (tooling deps not installed)"`)로 통일 — 차단 사유 아님, 다음 터치 시 반영 권장.
2. (선택, 이미 W3로 추적됨) `test_mermaid_lint_ready.py` 내 `_node_calls`/노드 스텁 setUp 보일러플레이트가 4개 클래스로 늘었으므로, W3 항목 처리 시 공통 mixin/헬퍼 추출을 함께 고려.
3. 그 외 항목은 전부 조치 불요(의도된 설계·관례 부합) — 즉시 반영할 Critical/Warning 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (6명, 개별 사유 텍스트는 라우터가 별도 제공하지 않음 — harness 테스트/문서 전용 diff로 비관련 판정된 것으로 추정)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 코드 변경 없음(harness 테스트/문서 전용)으로 비관련 |
  | architecture | 라우터 판단 — 코드 변경 없음으로 비관련 |
  | dependency | 라우터 판단 — 의존성 변경 없음으로 비관련 |
  | database | 라우터 판단 — DB 관련 변경 없음으로 비관련 |
  | concurrency | 라우터 판단 — 동시성 관련 변경 없음으로 비관련 |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 대상 변경 없음으로 비관련 |