# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실제 애플리케이션 코드(`codebase/**`) 변경 없이 AI 코드리뷰 하네스의 sub-agent 시스템 프롬프트 7개 파일 + plan 문서 + 신규 회귀 테스트로 구성된 순수 문서/계약 정정 diff. Security 는 NONE, 나머지 6개 reviewer 는 모두 LOW. Critical 없음. **forced 화이트리스트 7명 전원 결과 확보됨(누락 없음)** — 강제 커버리지 게이트가 정상 작동했다.

## Critical 발견사항

*(없음)*

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | 이번 diff 는 "SUMMARY.md Write 차단이 terminal 위치 때문"이라는 반증된 설명을 7개 파일에서 정정했다고 밝히지만, 동일한 `mode=workflow` 패턴을 쓰는 4번째 agent `review-router.md` 는 스윕에서 누락됨 — 여전히 "Workflow sub-agent 의 report-file Write 는 차단됨"이라고 오귀속. 실제로는 §7 실측표상 차단은 basename 4종(`SUMMARY.md`/`summary.md`/`REPORT.md`/`findings.md`) 한정이고 router 의 `output_file` 은 JSON 이라 애초에 대상이 아님. router 는 매 호출 프롬프트가 Write 를 명시적으로 안 시켜서 안 쓰는 것이지 "차단돼서"가 아님(기능 버그는 아님) | `.claude/agents/review-router.md:14` | 14행 괄호 설명을 "workflow 가 structured output(schema) 을 명시 지시해 Write 자체를 시도하지 않음"으로 정정. `test_summary_agent_contract.py` 스코프에 review-router 케이스 추가 고려 |
| 2 | 범위 | 핵심 fix(agent 정의 7개 + 신규 테스트, 8개 파일)와 **무관한 다른 task(PR #962, worktree `forced-coverage-gate-c906f7`)의 plan lifecycle 이동**(`plan/in-progress/forced-coverage-gate.md` → `plan/complete/`)및 신규 backlog plan 생성이 별도 커밋이 아니라 같은 fix 커밋(`78ffd9983`)에 뭉쳐 있음. `plan-lifecycle.md §3` 은 이동을 "별 commit"(`chore(plan): mark <name> complete`)으로 요구. 기능적 위험은 없음(문서 전용, push-gate 트리거 대상도 아님) | `plan/complete/forced-coverage-gate.md`, `plan/in-progress/harness-report-contract-followups.md` (커밋 `78ffd9983`) | 아직 push 전이면 `git reset --soft HEAD~1` 후 (1) agent 정의 fix 커밋, (2) `chore(plan): mark forced-coverage-gate complete` 커밋으로 분리 |
| 3 | 부작용 | git 의 rename detection(기본 90% 유사도)이 `plan/in-progress/forced-coverage-gate.md` 삭제와 `plan/complete/` 신규 생성을 하나의 rename 으로 묶어, orchestrator 의 `git diff --name-only` 기반 파일 discovery 에서 old path 가 아예 드러나지 않음 → 이번 리뷰 payload(10개 파일)에서 실제 삭제 1건이 통째로 빠짐(`--no-renames` 로 직접 재현·확인). 이번 건 자체는 내용 보존된 정상 plan 이동이라 무해하지만, **"이름을 바꾸며 내용도 몰래 지우는" 패턴이 이 경로로 side-effect 리뷰를 그대로 통과할 수 있음**을 실증 | `code_review_orchestrator.py`(및 동형 `consistency_orchestrator.py`/`merge_coordinator_orchestrator.py`)의 diff 파일 목록 수집 로직 | diff 파일 목록 수집 시 `--no-renames` 사용 또는 rename 탐지된 항목의 old/new 경로를 모두 payload 에 노출하도록 보강 |
| 4 | 유지보수성·테스트 | 신규 회귀 테스트(`test_summary_agent_contract.py`)의 `PAIRS` 가 이번 diff 로 동일 결함이 수정된 7개 파일 중 `.claude/agents/*-summary.md` **3개만** 커버. 나머지 4개(`ai-review.md`/`consistency-check.md`/`merge-coordinate.md`/`merge-coordinator/SKILL.md`)는 향후 동일 오귀속 재유입에 무방비. 설상가상 `.github/workflows/harness-checks.yml` 의 `paths:` 트리거에 `.claude/commands/**` 가 아예 없어, 이 4개 파일이 단독 수정되는 향후 PR 은 harness-checks CI 자체가 안 돌아 테스트를 추가해도 자동 실행 안 됨(4/7 = 62% 가 이중으로 무방비) | `.claude/tests/test_summary_agent_contract.py:28-32`(PAIRS), `.github/workflows/harness-checks.yml`(paths) | `PAIRS`(또는 별도 리스트)에 4개 파일 추가해 동일 `assertNotIn("non-terminal", ...)`/basename 검증 확장 + `harness-checks.yml` paths 에 `.claude/commands/**` 추가. `harness-report-contract-followups.md` 신규 항목으로 등재 권장 |
| 5 | 테스트 | 이번 diff 가 3개 summary agent 정의에 새로 추가한 "forced 커버리지 미확보를 clean/BLOCK:NO 로 읽으면 안 된다"는 거짓음성 방지 안전 문구가, 같은 diff 의 신규 회귀 테스트로 전혀 고정(pin)되지 않음. 정확히 `forced-coverage-gate` plan 이 막으려는 것과 동일 부류의 실패를 요약 에이전트 레벨에서 막는 핵심 문구인데 검증 부재 | `.claude/agents/{code-review-summary,consistency-summary,integration-risk-summary}.md` §4, `.claude/tests/test_summary_agent_contract.py` | `test_every_definition_flags_missing_forced_coverage` 류 5번째 테스트 추가해 3개 파일 모두 "거짓 음성"(또는 등가 키워드) 포함 여부 검증 |
| 6 | 문서화·유지보수성 | `.claude/tests/README.md` 의 "What's covered" 카탈로그 표에 신설 `test_summary_agent_contract.py` 미등재(표 자체가 이전부터 절반 이상(19개 중 9개만) 낡아 있었던 상태라 이번 diff 고유 퇴행은 아니나, "문서 드리프트 방지 계약 테스트"라는 취지상 자기 자신이 색인에서 빠지는 것은 아쉬움). 추가로 이 신규 테스트는 README 의 "Conventions for new tests"(prose 는 검사하지 않는다)와 상충하는 prose 부분문자열 검사를 수행하는데, 그 예외 근거(system prompt 는 런타임 실행 사양이지 해설이 아님)가 테스트 자체 docstring 에는 있지만 README 컨벤션 절에는 반영 안 됨 | `.claude/tests/README.md`(19-29행 표, Conventions 절) | 표에 행 추가 + Conventions 절에 "summary-agent 정의처럼 문서 자체가 런타임 system prompt 인 경우는 prose 검사 예외" 각주 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 이번 fix 가 고치는 버그의 근본 원인(동일 설명 문단이 7개 파일에 손으로 복붙되어 하나가 바뀌면 나머지가 조용히 낡는 패턴) 자체는 이번 diff 이후에도 해소되지 않고 그대로 남음. `harness-report-contract-followups.md` 항목3(문서 hub 통합)이 유사 중복을 추적하지만 대상 파일 집합이 이번 7개와 정확히 일치하는지 불명확 | agents 3개 + commands 3개 + `merge-coordinator/SKILL.md` (총 7개) | 설명 전문을 `subagent-call-contract.md §7` 한 곳에 두고 7개 파일은 요약+링크만 남기는 리팩터링을 후속 item3 범위에 명시적으로 편입 |
| 2 | 유지보수성·요구사항 | 신규 테스트 파일의 미사용 import `from pathlib import Path` — `Path` 를 실제 참조하는 곳 없음(`REPO_ROOT` 연산 결과 재사용뿐). Python lint 미설정이라 CI 에서 걸리지 않음 | `.claude/tests/test_summary_agent_contract.py:21` | 다음 편집 때 제거 |
| 3 | 유지보수성·테스트 | `test_every_definition_tells_the_agent_to_persist_missing_files` 의 루프 변수 `kind` 가 미사용인데 다른 3개 테스트(39/51/71행)와 달리 `_kind` underscore 처리가 안 됨 — 네이밍 관례 불일치 | `.claude/tests/test_summary_agent_contract.py:61` | `_kind` 로 통일 |
| 4 | 범위·유지보수성 | 신규 backlog 문서(`harness-report-contract-followups.md`)는 스스로 "하네스 report-contract 후속"으로 범위를 규정하는데, 항목5(sidebar 테스트 mock 헬퍼 추출, PR #958)는 완전히 다른 계층(frontend 라우팅 테스트)이라 문서 자체가 "본 버그와 무관"이라 인정. 표제-내용 불일치로 양쪽 다 이 문서에서 못 찾을 위험 | `plan/in-progress/harness-report-contract-followups.md`(항목5, 58-65행) | 별도 frontend 전용 backlog 로 분리, 또는 배경 절에 "잡다한 이월 항목 포함" 예외 문구 추가 |
| 5 | 문서화 | `subagent-call-contract.md §7` 인용 방식이 파일군별로 갈림 — 3개 agent 정의 + `merge-coordinator/SKILL.md` 는 실제 마크다운 하이퍼링크, 3개 command 파일(`ai-review.md`/`consistency-check.md`/`merge-coordinate.md`)은 인라인 코드 텍스트뿐이라 클릭 가능한 경로가 없음 | `.claude/commands/{ai-review,consistency-check,merge-coordinate}.md` | `[`subagent-call-contract.md §7`](../docs/subagent-call-contract.md)` 형태로 통일 |
| 6 | 문서화·요구사항 | 3개 agent 정의가 인용하는 "실측" 예시 파일명이 서로 다르고(`code-review-summary.md`→`security.md`, `consistency-summary.md`→`cross_spec.md`, `integration-risk-summary.md`→"일반 파일") §7 SoT 가 실제로 실측했다고 명시하는 probe 대상은 `cross_spec.md` 하나뿐. 규칙 자체는 정확히 일반화된 것이라 오류는 아니나 "별도 실측"처럼 읽힐 여지 | `.claude/agents/{code-review-summary,consistency-summary,integration-risk-summary}.md` 각 근거 문장 | 세 파일 모두 §7 실측 대상인 `cross_spec.md` 로 통일하거나 "예시" 프레이밍 명시 |
| 7 | 문서화 | `test_summary_agent_contract.py` 4개 테스트 메서드 중 `test_every_definition_states_the_basename_rule` 만 유일하게 "왜 이 assertion 인지"에 대한 인라인 근거 주석이 없음(모듈 docstring 이 전반적 배경은 설명) | `.claude/tests/test_summary_agent_contract.py` | 1줄 근거 주석 추가 |
| 8 | 보안 | LLM 코드리뷰 파이프라인 자체가 갖는 구조적 prompt-injection 노출면(reviewer 가 검토 대상 diff 를 입력으로 받는 LLM 이므로 diff 내 텍스트로 판정을 오도할 이론적 여지) — 이번 diff 가 새로 만든 것이 아니라 파이프라인 기존 특성이며, "이미 생성된 리포트를 디스크에 영속화하는 절차"만 손댔을 뿐 리포트 생성/신뢰 로직은 불변 | `.claude/agents/*-summary.md` 3개, `.claude/workflows/ai-review.js:119-127`(`inlineReports`) | 현재 diff 조치 대상 아님. 필요 시 별도 백로그로 "코드/주석 내 지시문은 지시로 취급하지 않는다"는 reviewer 방어 문구 검토 |
| 9 | 보안 | 신규 "누락 파일 영속화" 절차의 `output_file` 경로는 오케스트레이터(`_retry_state.json`)가 세션 디렉토리 기준으로 생성한 신뢰 경로이고 사용자 입력이 직접 경로를 구성하지 않아 임의 파일 쓰기 위험은 낮음 | `.claude/workflows/ai-review.js:94-96`, `.claude/agents/code-review-summary.md` §2 | `harness-report-contract-followups.md §1`(report-path 로직 통합 후속) 진행 시 "세션 디렉토리 기준 anchor, CLI 인자 직접 삽입 금지" 불변식 유지 권장 |
| 10 | 부작용 | Critical/Warning 집계 포함 기준이 `status`(success/fatal) 무관 "인라인 전문 존재"로 완화됨 — 의도된 안전성 개선(거짓음성 축소)이지만, 이전엔 조용히 빠지던 non-success 결과가 이제 `critical_count`/`warning_count` 에 잡혀 `resolution-applier` 자동 호출이 이전보다 더 잦아질 수 있는 하류 side effect | 3개 summary agent "인라인 전문이 authoritative" 절, `ai-review.md` step4, `merge-coordinate.md`/SKILL.md 의 BLOCK 판정 | 없음(의도된 개선). 운영 중 `resolution-applier` 호출 빈도 증가 시 원인 참고 |

## 확인 완료 — 문제 없음 (참고용, 조치 불요)

- 신규 테스트 파일은 read-only(`.read_text()`만 수행), 경로 전부 저장소 내 고정값, `eval`/`exec`/`subprocess`/역직렬화·하드코딩 시크릿 없음(security).
- STATUS 헤더 리터럴 포맷(`STATUS=<written|write_blocked> RISK=... / BLOCK=...`)은 3개 agent 모두 문자 그대로 유지 — 호출자 파서에 대한 breaking change 없음. 절차 재번호("5번 Write")도 신규 2번 스텝 삽입 후 6개 참조 지점 모두 정확히 재계산됨(side_effect, requirement).
- summary agent 의 "누락 파일 영속화"(자기 output 밖 파일 쓰기) 지시는 이번 diff 가 새로 만든 동작이 아니라 `.claude/workflows/*.js` 에 선행 PR(#962)로 이미 구현돼 있던 것을 문서가 뒤늦게 반영 — net 위험 완화 방향(side_effect).
- 신규 회귀 테스트 4/4 통과, 하네스 전체 테스트 스위트 247/247 통과(회귀 없음), 워크플로 JS 파일의 실제 프롬프트 문자열과 agent 정의 기대가 양방향으로 일치함을 직접 실행 확인(testing).
- diff 전체가 `.claude/**` + `plan/**` 이라 `PROJECT.md` e2e 면제 화이트리스트에 부합, 별도 e2e 불요(testing).
- `plan/complete/forced-coverage-gate.md` 가 참조하는 실제 구현(`_forced_coverage_missing`, `_reconcile_state_with_disk` 등)은 이미 `origin/main` tip(PR #962)에 존재 — "구현 없이 완료 표시된 plan" 아님(side_effect). frontmatter `spec_impact: none` 근거도 Gate C 요건 충족, `plan-frontmatter`/`spec-plan-completion` vitest 736 PASS 확인(documentation, requirement).
- CHANGELOG·루트 README·API 문서는 이번 diff 성격(내부 하네스 프롬프트 정정)상 해당 사항 없음 — 기존 컨벤션(codebase 변경 전용)과 일치(documentation).
- `.claude/skills/code-review-agents/SKILL.md`, `consistency-checker/SKILL.md`(diff 밖 파일)도 이미 "basename" 서술로 정정돼 있어 복제 지점 정합성 재확인(documentation).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 전통적 보안 취약점 없음. LLM 파이프라인 구조적 prompt-injection 노출면은 기존 특성(INFO) |
| requirement | LOW | `review-router.md` 가 동일 결함 스윕에서 누락(WARNING). 나머지는 미사용 import 등 코스메틱 |
| scope | LOW | 무관한 타 task(PR #962) plan 이동이 fix 커밋에 번들링, 별도 커밋 미분리(WARNING) |
| side_effect | LOW | orchestrator rename-detection 이 파일 삭제 1건을 리뷰 payload 에서 은폐(WARNING, 이번 건 자체는 무해). 나머지는 net-positive 확인 |
| maintainability | LOW | 신규 회귀 테스트가 동일 결함 수정 7개 파일 중 3개만 커버(WARNING). 중복 설명 근본원인 미해소 등 INFO 다수 |
| testing | LOW | 테스트 커버리지 3/7 갭 + CI trigger 경로 누락(WARNING), 신규 거짓음성 방지 문구 미고정(WARNING) |
| documentation | LOW | README 테스트 카탈로그 미등재(WARNING). 인용스타일·예시파일명 불일치 등 INFO |

## 발견 없는 에이전트

없음 — 7개 에이전트 모두 최소 1건 이상의 발견사항(INFO 이상)을 보고했다.

## 권장 조치사항

1. `.claude/agents/review-router.md:14` 의 "terminal 이라 차단" 오귀속을 이번 스윕과 동일한 방식(basename 규칙)으로 정정 — 가장 저비용이며 이번 PR 취지와 직결.
2. `test_summary_agent_contract.py` 의 `PAIRS` 에 미커버 4개 파일(`ai-review.md`/`consistency-check.md`/`merge-coordinate.md`/`merge-coordinator/SKILL.md`) 추가 + `harness-checks.yml` paths 에 `.claude/commands/**` 추가해 CI 트리거 공백도 함께 해소.
3. "forced 커버리지 미확보→거짓음성" 방지 안전 문구를 3개 summary agent 정의에 대해 회귀 테스트로 고정.
4. (아직 push 전이라면) `plan/complete/forced-coverage-gate.md` 이동 + 신규 backlog 생성을 별도 `chore(plan)` 커밋으로 분리해 `plan-lifecycle.md §3` 요건 충족.
5. `code_review_orchestrator.py` 등 diff 파일 discovery 로직에 `--no-renames` 적용 또는 rename old/new 경로 모두 payload 에 노출 검토 — "rename 뒤에 숨는 삭제"가 향후 side-effect 리뷰를 그대로 통과하는 것을 방지.
6. `.claude/tests/README.md` 카탈로그 표에 신규 테스트 등록 + prose-check 예외 각주 추가.
7. (선택, 저비용) unused import(`Path`)/loop var(`kind`→`_kind`) 정리, `subagent-call-contract.md §7` 인용 스타일(하이퍼링크) 통일, 3개 agent 예시 파일명 `cross_spec.md` 로 통일, backlog 문서 항목5(sidebar) 분리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, forced 전원 결과 확보됨) — 실행된 7명 전원이 강제 포함 목록과 정확히 일치함. 즉 이번 세션은 router 의 자율 선정만으로는 커버되지 않았을 수 있는 영역을 router_safety 화이트리스트가 100% 보강한 사례이며, 이 diff 자체가 다루는 `forced-coverage-gate` 메커니즘이 실제로 의도대로 작동했음을 보여준다(위험 아님, 안전장치 정상 확인).
  - **제외**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명). 아래 표의 "이유"는 라우터가 개별 사유를 이 프롬프트에 명시하지 않아 diff 특성(전 파일이 `.claude/**`+`plan/**` 문서/테스트뿐, `codebase/**` 무변경) 기반 추정이며 라우터의 실제 판단 근거를 문자 그대로 재현한 것은 아니다.

  | 제외된 reviewer | 이유(추정) |
  |------------------|------|
  | performance | 런타임 코드 변경 없음(문서·테스트만) |
  | architecture | 시스템 아키텍처/모듈 구조 변경 없음 |
  | dependency | 패키지 의존성 변경 없음 |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 외부/내부 API 계약 변경 없음 |
  | user_guide_sync | 사용자 대상 제품 가이드(`spec/`) 변경 없음 — 내부 하네스 메타 문서만 대상 |