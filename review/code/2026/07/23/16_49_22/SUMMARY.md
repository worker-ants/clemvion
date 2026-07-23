# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나(직전 라운드 CRITICAL 은 실측 확인된 정정 완료), 이번 PR 이 막으려던 결함 클래스("정책 문서 표가 실제 코드/규칙과 조용히 어긋남")가 신규 회귀 가드 자체 안에 여전히 부분적으로 남아있음(WARNING 2건, 그 중 1건은 실측 mutation 으로 재현 확인). forced reviewer 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / requirement | 신규 drift 가드가 정책표의 **"Forced reviewers" 컬럼 내용 자체**를 실제 규칙과 대조하지 못하는 경로가 남아있다. (a) README 쪽: `test_readme_table_has_the_same_rows_as_the_docstring` 는 행 **개수**만 비교하고 셀 텍스트(reviewer 이름)는 전혀 검사하지 않음 — testing 리뷰어가 README 68행에서 `testing` 하나를 지운 뮤턴트로 12개 테스트 전원 green 을 직접 재현·확인. (b) docstring 쪽: `test_docstring_table_names_exactly_the_reviewers_the_rules_force` 가 전체 행의 reviewer 이름을 **합집합(union)**으로만 비교해, 재조준된 reviewer 이름이 표의 다른 행에 이미 존재하면 탐지 실패 — requirement 리뷰어가 "Package manifest" 행에서 `documentation` 삭제 뮤턴트로 재현·확인(README 동일 위치도 동일하게 미검출 확인). 이는 이번 PR 계열이 전체적으로 막으려던 결함 클래스와 정확히 같다. | `.claude/tests/test_router_safety_policy_doc.py:170-179`(`test_table_row_names_the_real_forced_reviewers`), `:240-258`(`test_docstring_table_names_exactly_the_reviewers_the_rules_force`), `:260-267`(`test_readme_table_has_the_same_rows_as_the_docstring`) | README 쪽에 `_reviewers_named_in()` 을 적용해 실제 `_SOURCE_FORCED_REVIEWERS`/`_RULES` 와 대조하는 대칭 테스트를 신설하고, docstring 쪽도 union 비교 대신 행별(row-level) reviewer 집합 대조로 강화. 두 문서를 행 인덱스로 짝지어(이미 행 개수가 강제로 같음) 비교하면 `_policy_rows`/`_reviewers_named_in` 기존 인프라로 구현 가능. 부수적으로 관련 테스트 메서드 docstring 의 "재조준을 잡는다"는 문구도 실제 커버리지 범위(집합/합집합 수준 한계)에 맞게 완화할 것. |
| 2 | maintainability | `_router_safety_values()`(subprocess 조회 결과)는 `setUpClass` 에서 클래스당 1회만 캐시되는데, 동일하게 subprocess 로 조회하는 `_all_agents()` 는 어디에서도 캐시되지 않아 정책표 행 수만큼(현재 9~10행) 매 테스트 실행 시 동일 값을 얻기 위해 subprocess 를 반복 기동한다. 두 헬퍼 간 캐싱 정책 비일관은 향후 확장 시 혼동을 유발할 수 있다. | `.claude/tests/test_router_safety_policy_doc.py:68`(`_all_agents`), `:221-228`(`_reviewers_named_in`), `:281`, `:305` | `setUpClass` 에서 `cls.agents = _all_agents()` 로 1회만 조회해 캐시하고, `_reviewers_named_in`/관련 테스트 메서드가 `self.agents`(또는 그 집합)를 재사용하도록 통일. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `test_docstring_table_names_exactly_the_reviewers_the_rules_force` 의 docstring 문구("재조준된 규칙을 잡는다")가 실제 구현(합집합 수준 비교)의 한계를 완전히 반영하지 못해 두 docstring 간 커버리지 서술 불일치가 있음 — WARNING #1 과 동일 근본 원인의 문서 정확성 측면. | `.claude/tests/test_router_safety_policy_doc.py:240-244` | WARNING #1 조치 시 함께 문구 완화(기능 수정 불요, 주석만 정확화). |
| 2 | security | 신규 테스트가 `subprocess.run([sys.executable, "-c", script], ...)` + `runpy.run_path` 로 정책 상수를 별도 프로세스에서 조회. 삽입 문자열은 전량 harness 자신이 계산하는 로컬 경로(`repr()` 이스케이프)이고 `shell=True` 미사용이라 인젝션 표면 없음. 실패 시 stderr 최대 1500자를 assertion 메시지에 노출하나 로컬 개발자 대상이라 실질 위험 없음. | `.claude/tests/test_router_safety_policy_doc.py:46-77` | 조치 불요. |
| 3 | side_effect | `runpy.run_path(ORCH)` 가 `code_review_orchestrator.py` 최상위 코드를 매 테스트 실행마다 실행(현재 무해, 직전 리뷰 라운드에서 이미 검토·판정됨) — 향후 orchestrator 상단에 부작용이 추가되면 암묵적으로 매 테스트 실행에 결합될 잠재 지점. | `.claude/tests/test_router_safety_policy_doc.py:68-77`(`_all_agents`) | 조치 불요(기존 권고 유지 — orchestrator 최상위에 부작용 두지 말 것 주석화는 선택 사항). |
| 4 | maintainability | 두 subprocess 헬퍼(`_router_safety_values`, `_all_agents`) 간 호출/에러처리 보일러플레이트 중복(`-1500` 하드코딩 포함), 정규식 기반 문서 파싱이 정확한 prose 문구에 강결합(의도된 트레이드오프), 단일 테스트 클래스가 3개 정책 축(확장자 개수/표 drift/로스터 카운트)을 모두 담당(322줄, 15 메서드) — 각각 경미하며 즉시 조치 불요. | `.claude/tests/test_router_safety_policy_doc.py:46-65`, `:92-104`, `:184`, `:279`, `:85-318` | 선택적 후속 리팩터(공용 `_run_python_json` 헬퍼 추출, 축별 클래스 분리) — 우선순위 낮음. |
| 5 | scope | 3번째 커밋(`7e7bc8e1e`)이 원 결함("24 확장자" stale) 과 다른 대상(리뷰어 로스터 개수, 4개 파일 6곳)까지 선제적으로 커버 범위를 확장 — 커밋 메시지·RESOLUTION.md 에 "리뷰 발견 아님, 선제 점검"으로 투명하게 명시되어 은폐된 스코프 이탈 아님. | `.claude/tests/test_router_safety_policy_doc.py`(`test_every_documented_reviewer_count_matches_all_agents`) | 조치 불요(향후엔 "버그 수정" vs "예방적 하드닝" 커밋 분리를 권장하되 이번엔 이미 분리됨). |
| 6 | scope / documentation | 직전 리뷰 세션(`review/code/2026/07/23/16_30_52`) 산출물 9개 파일(SUMMARY/RESOLUTION/meta.json/`_retry_state.json`/reviewer 7종 `.md`)이 이번 커밋 범위에 포함 — CLAUDE.md 의 코드 리뷰 산출물 저장 규약에 정확히 부합하는 정상 커밋(gitignore 대상 아님). | `review/code/2026/07/23/16_30_52/` | 조치 불요. |
| 7 | requirement | 이번 변경 영역(`.claude/skills/code-review-agents/**`, `.claude/tests/**`)은 harness 자체 도구로 `spec/` 문서 대상이 아님(grep 0건) — spec fidelity 관점 해당 없음. `review/code/.../16_30_52/_retry_state.json` 이 `routing_status: pending` 으로 커밋됐으나 같은 세션 SUMMARY/RESOLUTION 은 `done` 서술 — 이번 PR 결함 아니고 세션이 한 turn 안에 완료돼 상태파일이 재작성 안 된 것으로 추정, 기록 정합성 참고용. | `review/code/2026/07/23/16_30_52/_retry_state.json` | 조치 불요(참고 기록). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 dev-tooling 변경, 인젝션/시크릿/인증 관련 이슈 없음 |
| requirement | MEDIUM | 직전 CRITICAL 은 실측 해소 확인, 그러나 신규 가드의 union-비교 한계로 재조준 drift 일부 미검출 |
| scope | NONE | 3커밋 모두 명시적 사유의 좁은 스코프, 리뷰 산출물 커밋은 규약 부합 |
| side_effect | NONE | 문서/테스트 전용 변경, subprocess/runpy 격리 확인, 관측 가능한 부작용 없음 |
| maintainability | LOW | `_all_agents()` 캐싱 누락으로 subprocess 반복 호출(WARNING), 그 외 경미한 중복/결합도 |
| testing | WARNING(원문 표기, 실질 위 WARNING #1 과 동일) | mutation 실측으로 README "Forced reviewers" 컬럼 내용 미검증 확인, 스위트 446 green 회귀 없음 |
| documentation | LOW | 직전 CRITICAL/WARNING 전부 실측 해소 확인, docstring 문구 정확성 사소한 갭 1건 |

## 발견 없는 에이전트

- security, scope, side_effect — 위험도 NONE, INFO 성격의 참고 사항 외 실질 결함 없음.

## 권장 조치사항
1. `test_router_safety_policy_doc.py` 에 README 표의 "Forced reviewers" 셀 내용을 실제 `_SOURCE_FORCED_REVIEWERS`/`_RULES` 와 행 단위로 대조하는 테스트를 신설하고, docstring 쪽 union 비교도 행별 대조로 강화한다(WARNING #1 — 이번 PR 이 막으려던 결함 클래스의 잔존 갭이므로 우선순위 최상).
2. `_all_agents()` 를 `setUpClass` 에서 1회 캐시하도록 통일해 subprocess 반복 기동을 제거한다(WARNING #2).
3. 위 1번 조치와 함께 관련 테스트 메서드 docstring 의 "재조준 탐지" 주장 문구를 실제 커버리지 범위로 완화한다(INFO #1, 문서 정확성).
4. (낮은 우선순위) helper 함수 보일러플레이트 통합, 축별 테스트 클래스 분리 등은 후속 리팩터 후보로 남긴다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — forced 전원 결과 확보됨(강제 화이트리스트 미이행 없음).
  - **제외**: 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(문서/테스트 정정)에 성능 영향 경로 없음(세부 사유 텍스트 미제공) |
  | architecture | router 판단 — 아키텍처 변경 없음(세부 사유 텍스트 미제공) |
  | dependency | router 판단 — 의존성/매니페스트 변경 없음(세부 사유 텍스트 미제공) |
  | database | router 판단 — DB 관련 코드 없음(세부 사유 텍스트 미제공) |
  | concurrency | router 판단 — 동시성 관련 코드 없음(세부 사유 텍스트 미제공) |
  | api_contract | router 판단 — API 계약 변경 없음(세부 사유 텍스트 미제공) |
  | user_guide_sync | router 판단 — 사용자 가이드 동기화 대상 아님(세부 사유 텍스트 미제공) |