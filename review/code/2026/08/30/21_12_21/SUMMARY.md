# Code Review 통합 보고서

## 전체 위험도

**LOW** — CRITICAL 없음. 이번 diff(3커밋 누적: report-return sink 분리 + `updateExecutionStatus` self-deadlock JSDoc + 앞선 두 리뷰 라운드(`20_21_06`,`20_46_48`) WARNING 5건 반영)의 실질 코드 결함은 발견되지 않았다. 다만 `side_effect` 리뷰어가 **이 세션 안에서 진행된 3개 리뷰 라운드 전부가, 이 PR 이 고치려는 계약 버그를 여전히 재현하는 stale sub-agent 프롬프트 스냅샷으로 호출되어 왔다**는 사실을 실측으로 확정했다(WARNING). 이는 diff 코드 결함이 아니라 harness 세션 캐싱 이슈이지만, "다음 세션에서 검증하면 된다"는 plan 의 열린 TODO 가 **이 세션 안의 새 라운드로는 절대 닫히지 않는다**는 뜻이라 위험도 판단 시 놓치면 안 된다 — **아래에 별도로 강조 표기**.

## ⚠️ 강조 — plan 미완료 검증 항목의 성립 조건

`plan/in-progress/backend-lint-gate-broken-on-main.md:317-329` 의 "새 계약이 실제 실행 경로에 붙었는지"
확인 항목은 이번 라운드(`21_12_21`)에서도 여전히 열려 있다. `side_effect` 리뷰어가 이 세션의 persisted
`ai-review-wf_*.js` 18개 전부(Aug 29 17:32 ~ Aug 30 21:12)가 **17300 바이트로 불변** — 즉 세션 시작
시점에 캐시된 뒤 이 브랜치의 세 커밋 편집을 한 번도 반영하지 않았음을 직접 측정으로 확인했다.
plan 항목의 "새 세션에서 확인" 문구가 **top-level Claude Code 세션** 단위를 뜻하는 것으로 명확히
갱신되지 않으면, 같은 세션 안에서 몇 번을 더 리뷰해도 이 항목은 착시적으로 "아직 확인 안 됨" 상태를
반복할 뿐이다. resolution-applier 는 이 항목을 "코드 수정 완료" 로 닫지 말 것.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | 이 세션의 persisted `ai-review-wf_*.js` 스크립트가 세션 시작 시점에 캐시된 채 이 PR 이 고치는 계약 문구(구버전 3줄 sink 미분리 + 개명 전 가드 파일명 `test_workflow_shared_block.py`)를 그대로 담고 있다. 세션 내 3개 리뷰 라운드 전부가 이 stale 스냅샷으로 sub-agent 를 호출해 옴 | 세션 상태(diff 파일 아님), 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329` | plan 의 "새 세션에서 확인" 문구를 "현재 세션이 아닌 새로운 top-level Claude Code 세션"으로 명시 갱신. 이번 라운드로 이 TODO 를 닫지 말 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/documentation/testing/maintainability/scope | 가드 파일명 드리프트(`test_workflow_shared_block.py`→`test_workflow_scripts.py`)가 SHARED-BLOCK 마커 안팎(로컬 헤더 주석 포함) 전부 정정됐고, 재발 방지 신규 테스트 `test_guard_filename_references_point_at_this_file` 가 뮤테이션 재현(RED 확인 후 원복)으로 non-vacuous 함이 검증됨 | `.claude/tests/test_workflow_scripts.py:114-140`, `ai-review.js:109,113` 등 4파일 | 조치 불요 |
| 2 | requirement/maintainability | `updateExecutionStatus` self-deadlock JSDoc 의 `.transaction(` 전수 수치(36 = 모듈 안 9 + 밖 27)가 독립 재측정(`grep -rnE '\.transaction(<[^>]*>)?\('`, 제네릭 인자 포함·주석 줄 제외)과 정확히 일치 | `execution-engine.service.ts` JSDoc(약 8553-8582) | 조치 불요 |
| 3 | requirement/side_effect/maintainability | `REPORT_RETURN_CONTRACT` file/반환-메시지 sink 분리가 정본+3개 워크플로 미러 4곳에서 byte-identical, 13/13 유닛테스트 통과(뮤테이션 재현으로 신규 2건만 RED 확인) | `_lib/agent-return.mjs:48-104` 등 4파일 | 조치 불요 |
| 4 | requirement/documentation | 오지 않은 미래 날짜("2026-08-31") 잔여 0건 확인(저장소 전체 grep) | 다수 파일(이전 라운드 11곳) | 조치 불요 |
| 5 | documentation/testing | plan 에 "새 계약이 실제 실행 경로에 붙는지" 항목이 체크박스 `[ ]`(미완료)로 정직하게 열려 있음 — 위 WARNING #1 참고 | `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329` | 조치 불요(문서 품질 양호). 확인 시 재사용 가능한 스모크 체크로 남기는 것 고려 |
| 6 | testing | `.transaction(` 전수 카운트에 대한 자동 정적 가드는 여전히 없음 — AST 없이는 콜백이 `updateExecutionStatus` 를 참조하는지 판정 불가하므로 의식적으로 유예(유한 문제를 무한 문제로 바꾸지 않기 위함), 근거가 커밋/plan 에 명시됨 | `execution-engine.service.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md` | 조치 불요. 저비용 AST 유틸이 생기면 재검토 |
| 7 | testing/maintainability | 신규 유닛테스트 2건이 `indexOf('1)')`/`indexOf('2)')` 문자열 슬라이스 방식으로 계약 문구를 자르는 결합 — 현재는 안전하나 계약 문구가 늘어나면 슬라이스 경계가 어긋날 잠재 리스크 | `.claude/tests/test_agent_return.mjs:113-114` | 조치 불요(참고). 향후 재작업 시 명명 상수/배열 인덱스로 리팩터 고려 |
| 8 | scope | 최초 커밋(`7d6854cb9`)이 서로 무관한 두 결함 수정(sink 분리 · self-deadlock 감사)을 한 커밋에 담은 상태가 이번 diff 에도 남아 있음 — 이미 두 라운드 전에 WARNING 처분·plan 기록 완료된 기결 사안 | `execution-engine.service.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md` | 조치 불요(4번째 재-revert 요구 안 함) |
| 9 | scope/testing | 검증 중 워킹트리에서 일시적 변칙 관측(옛 가드 파일명이 순간적으로 보임) — 동시에 도는 다른 병렬 리뷰어의 뮤테이션 재현 흔적으로 판단, 자체 해소되어 diff 결함 아님 | `.claude/workflows/ai-review.js`(워킹트리 일시 상태, 커밋 안 됨) | 조치 불요(harness 운영 참고 기록) |
| 10 | maintainability | JSDoc 한 문장 안에서 "9"가 서로 무관한 두 모집단(EngineDriver 경유 호출부 9곳 vs 모듈 안 `.transaction(` 블록 9개)을 가리켜 혼동 여지 — 직전 라운드도 지적했으나 세 판째 미반영, 오히려 같은 문장 안으로 더 붙어 앉음 | `execution-engine.service.ts:8571-8572` | "(위 20곳의 9와는 별개 집합)" 괄호 한 줄 추가 권장 |
| 11 | side_effect | `review/code/2026/08/30/20_21_06/_retry_state.json` 등에 로컬 절대경로(`/Users/gehrig/...`)가 이력으로 고정됨 — 기능적 파싱 실패는 없으나 다른 환경에서 참조 불가 | `review/code/2026/08/30/20_21_06/_retry_state.json` 게이트 2-7 | 조치 불요(참고) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 이전 라운드 WARNING 전부 실측 재검증상 해소. 신규 CRITICAL/WARNING 없음 |
| testing | LOW | 신규 가드 테스트 non-vacuous 확인. `.transaction(` 자동 가드 부재는 의식적 유예로 확인만 |
| documentation | NONE | 4건(가드 파일명·날짜·JSDoc 서사·수치 상충)이 전부 실측 재검증상 해소 확인 |
| scope | LOW | 신규분은 직전 라운드 WARNING 5건을 반영하는 단일 활동. 최초 커밋 주제 혼합은 기결 사안 |
| security | NONE | 발견사항 없음 — 실질 보안 표면(인증/인가/DB/시크릿/입력검증) 변경 전혀 없음 |
| side_effect | LOW(WARNING 1건) | 세션 persisted 스크립트가 stale 계약 문구로 3라운드 내내 호출됨을 실측 확정 |
| maintainability | LOW | JSDoc "9" 모호성 3라운드째 미반영. 그 외 전부 해소 확인 |

## 발견 없는 에이전트

- security — 인젝션/시크릿/인증인가/입력검증/OWASP/암호화/에러노출/의존성 8개 관점 전수 확인, 발견사항 0건

## 권장 조치사항

1. `plan/in-progress/backend-lint-gate-broken-on-main.md:317-329` 의 "새 계약이 실행 경로에 붙었는지" 확인 항목에, "여기서 '새 세션' 은 현재 세션이 아닌 **새로운 top-level Claude Code 세션**을 뜻한다"는 문구를 추가해 이 세션의 새 리뷰 라운드로는 이 TODO 가 닫히지 않음을 명확히 할 것 (WARNING #1 대응).
2. `execution-engine.service.ts:8571-8572` JSDoc 에 "(위 20곳의 9와는 별개 집합)" 괄호 한 줄 추가해 두 무관한 "9" 값의 혼동 여지를 제거할 것 (사소, 선택).
3. 그 외 항목은 전부 조치 불요 — 참고 기록.

## 라우터 결정

- `routing_status=done` (router_safety 가 전원 강제):
  - **실행**: `requirement, testing, documentation, scope, security, side_effect, maintainability` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보 확인됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |