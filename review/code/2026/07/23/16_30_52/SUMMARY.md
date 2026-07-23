# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `router_safety.py` docstring 표의 "24→44 확장자" 정정 자체는 정확하지만, 이 changeset 이 없애려는 것과 **정확히 같은 종류의 drift 가 미러 문서(`README.md:68`)에 지금도 남아 있고**, 신규 회귀 가드 테스트(`test_router_safety_policy_doc.py`)가 그 지점을 검사하지 않아 green 상태로 통과한다(testing 리뷰어 CRITICAL 판정, requirement/documentation 리뷰어도 동일 실체를 WARNING/MEDIUM 으로 corroborate). **forced whitelist(7명) 전원 결과 확보됨 — 결과 누락 없음.**

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 / 문서 SSOT drift | 신규 회귀 가드 테스트가 자신이 존재하는 이유(README 미러 stale count)를 잡지 못한다. `router_safety.py` docstring 표는 이번 PR 로 "24 extensions"→"44 extensions" 로 정정됐고 새 테스트(`test_table_states_the_real_extension_count`)가 이를 검증하지만, `README.md` 의 "Router safety policy" 표는 여전히 `24 확장자`로 stale 하다(`git diff origin/main -- README.md` 무변경으로 실측 확인). 새 테스트의 `_readme_extension_list()`는 README 79행의 스펠아웃 리스트(이미 44개, 정확)만 검사하고, 68행 표 셀의 `\d+ 확장자` **카운트 숫자**는 검사 대상이 아니다. 모듈 docstring 은 스스로 "both docs" 를 검증한다고 선언하지만 실제 구현은 이를 충족하지 못한다(testing/requirement/documentation 3개 리뷰어 corroborate) | `.claude/skills/code-review-agents/README.md:68`, `.claude/tests/test_router_safety_policy_doc.py`(`test_table_states_the_real_extension_count`, `_readme_extension_list`, 모듈 docstring) | (1) `README.md:68` 의 "24 확장자" → "44 확장자" 로 즉시 정정. (2) 테스트에 README 표 행의 카운트(`\| 소스 파일 \((\d+) 확장자\)`)를 `len(_SOURCE_CODE_EXTENSIONS)` 와 대조하는 assertion 추가. (3) 모듈/README.md 신규 행의 "both docs" 서술을 실제 커버리지에 맞게 정정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 스코프 | 정책 표 9개 행 중 2개(Source-code file, Reviewer roster)만 `_RULES`/`ALL_AGENTS` 실측과 대조되고, 나머지 7행(Package manifest, Doc file, Migration, OpenAPI, `spec/**/*.md`, Dockerfile, `.dockerignore`, `.env`)의 Forced reviewers 컬럼은 검증되지 않는다. 모듈 docstring 은 표 전체가 "정책의 단일 진실 원천"이라 선언하지만 가드는 부분적이다 | `.claude/tests/test_router_safety_policy_doc.py` (`PolicyMatrixMatchesConstantsTest` 클래스 전체) | `_RULES` 를 순회하며 각 규칙의 `reviewers` 튜플과 표 해당 행을 전수 대조하는 파라미터화 테스트로 확장하거나, 테스트 docstring 에 의도적 스코프 제한을 명시 |
| 2 | 문서 정확성 | `.claude/tests/README.md` 신규 행 문구("the source-extension count and spelled-out list, **both docs**")가 실제 테스트 커버리지(README 카운트는 미검증)와 불일치 — Critical #1 과 동일 원인의 부수 효과 | `.claude/tests/README.md:37` | Critical #1 조치와 함께 문구를 실제 구현에 맞게 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 코드 정리 | 미사용 import `from pathlib import Path` — `SKILL_DIR`/`README`/`ORCH` 등은 이미 `Path` 인스턴스인 `REPO_ROOT` 의 `/` 연산으로 구성되어 `Path` 직접 호출 없음 (requirement/scope/side_effect/maintainability/testing/documentation 6개 리뷰어 공통 지적) | `.claude/tests/test_router_safety_policy_doc.py:29` | import 제거 |
| 2 | 프로세스 격리 설계 | `subprocess.run([sys.executable, "-c", script], ...)` 로 정책 값을 서브프로세스에서 조회 — 스크립트에 삽입되는 경로는 모두 로컬 `REPO_ROOT` 파생(외부 입력 아님), shell 미사용이라 인젝션 표면 없음. `_lib` 이름 충돌 회피를 위한 의도된 설계이며 기존 `test_router_decision_trust.py` 와 동일 패턴 | `.claude/tests/test_router_safety_policy_doc.py` `_router_safety_values`, `_all_agents` | 조치 불요 |
| 3 | 에러 메시지 | 서브프로세스 실패 시 stderr 최대 1500자를 assertion 메시지에 그대로 노출 — 로컬 테스트 실패 로그이며 시크릿 관련 경로 아님 | `.claude/tests/test_router_safety_policy_doc.py` (`_router_safety_values`/`_all_agents` 의 `raise AssertionError`) | 조치 불요 |
| 4 | 부작용 경계 | `runpy.run_path(ORCH)` 가 `code_review_orchestrator.py` 모듈 최상위 코드를 실행(`__main__` 가드는 우회되지만 `main()` 은 미호출). 현재는 파일 I/O·네트워크 부작용 없음을 확인했으나, 향후 orchestrator 상단에 부작용 있는 코드가 추가되면 테스트 실행마다 함께 트리거됨 | `.claude/tests/test_router_safety_policy_doc.py:59-68` (`_all_agents`) | 선택 사항: orchestrator 상단 또는 테스트 docstring 에 "runpy 로 임포트되므로 최상위에 부작용 두지 말 것" 주석 추가 |
| 5 | 유지보수성 | `_router_safety_values`/`_all_agents` 두 헬퍼 함수가 subprocess 호출 후 에러 처리(`stderr[-1500:]`) 보일러플레이트를 반복. 기존 스위트(`test_router_decision_trust.py`)의 확립된 스타일과 일치하므로 이번 PR 신규 문제는 아님 | `.claude/tests/test_router_safety_policy_doc.py:39-68` | 선택 사항: 공용 `_run_python_json()` 헬퍼로 추출(즉시 조치 불요) |
| 6 | 유지보수성 | 정규식 기반 문서 파싱 assertion 이 docstring/README 문구의 정확한 텍스트 패턴에 결합되어 있어 향후 문서 리라이팅 시 깨지기 쉬움. "문서가 곧 스펙" 컨벤션 예외로 의도된 트레이드오프 | `.claude/tests/test_router_safety_policy_doc.py` 각 정규식 헬퍼 | 조치 불요(현행 유지) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | harness 내부 문서/테스트 변경, 외부 입력 경계 없음, subprocess/runpy 사용은 인젝션 표면 없음 |
| requirement | MEDIUM | README 미러 표 "24 확장자" stale 잔존 + 신규 테스트가 "both docs" 주장과 달리 이를 미검증(WARNING) |
| scope | NONE | diff 가 커밋 목적과 1:1 일치, 스코프 이탈 없음(미사용 import 만 INFO) |
| side_effect | NONE | 함수 시그니처/전역 상태/네트워크 호출 무변경, subprocess·runpy 부작용 없음 확인 |
| maintainability | NONE | 테스트 가독성·단일 책임 양호, 사소한 스타일 지적만(미사용 import, 보일러플레이트 중복, 정규식 결합도) |
| testing | **CRITICAL** | 신규 가드 테스트가 자신이 막으려는 README stale count 를 놓침 + 정책 표 9행 중 2행만 커버(WARNING) |
| documentation | LOW | 동일 README stale 이슈 지적(WARNING), 그 외 문서화 품질(추적성·근거 기록)은 모범적 |

## 발견 없는 에이전트

없음 — forced whitelist 7명 전원 실행되었고, 모두 최소 INFO 이상의 발견을 보고함(NONE/LOW/MEDIUM 판정 에이전트도 INFO 항목은 보유).

## 권장 조치사항

1. **(최우선)** `.claude/skills/code-review-agents/README.md:68` 의 "24 확장자" → "44 확장자" 로 정정 — 이번 PR 이 애초에 고치려던 drift 를 완성.
2. `test_router_safety_policy_doc.py` 에 README 표 카운트(`\| 소스 파일 \((\d+) 확장자\)`)를 `len(_SOURCE_CODE_EXTENSIONS)` 와 대조하는 assertion 을 추가해 신규 가드가 실제로 "both docs" 를 검증하도록 보강.
3. `.claude/tests/README.md:37` 신규 행 및 테스트 모듈 docstring 의 "both docs" 서술을 실제 구현 커버리지에 맞게 정정.
4. (선택) 정책 표 9행 전수를 `_RULES` 와 대조하는 파라미터화 테스트로 확장해 나머지 7행의 drift 도 커버.
5. 미사용 `from pathlib import Path` import 제거.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 forced (diff 가 `.py`/테스트 소스 파일을 포함해 source-code 강제 매트릭스 트리거, 실행 목록과 forced 목록이 동일). **강제 화이트리스트 7명 전원 결과 확보됨 — 누락 없음.**
  - **제외**: 아래 표 (7명, 세부 사유는 prompt 에 미기재 — router 가 diff 특성상 비관련으로 판단)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 비관련(세부 사유 미기재) |
  | architecture | router 판단상 비관련(세부 사유 미기재) |
  | dependency | router 판단상 비관련(세부 사유 미기재) |
  | database | router 판단상 비관련(세부 사유 미기재) |
  | concurrency | router 판단상 비관련(세부 사유 미기재) |
  | api_contract | router 판단상 비관련(세부 사유 미기재) |
  | user_guide_sync | router 판단상 비관련(세부 사유 미기재) |