# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. 7개 reviewer 전원이 CRITICAL 0·WARNING 0 을 보고했고(NONE 3, LOW 4), 남은 지적은 전부 INFO(참고) 수준이다. forced 화이트리스트 7명 전원 결과 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 pytest 가드(`test_guard_filename_references_point_at_this_file`)의 정규식이 `\.claude/tests/(test_\w+\.py)` 형태로 경로 접두어가 있는 참조만 매치한다 — 접두어 없이 파일명만 적힌 stale 참조는 못 잡는 이론적 사각지대(현재 실사례 없음) | `.claude/tests/test_workflow_scripts.py` | 조치 불요(hypothetical). 다음에 가드를 만질 기회에 `(?:\.claude/tests/)?(test_\w+\.py)` 로 넓히는 것을 고려 |
| 2 | testing | 같은 신규 가드가 "대상 4개 파일은 자기 자신(가드 파일)만 언급해야 한다"는 다소 넓은 가정을 깔고 있어, 향후 정당한 교차 참조 주석이 추가되면 거짓 실패를 낼 수 있음 | `.claude/tests/test_workflow_scripts.py` | 조치 불요. 실제로 교차 참조가 생기면 매칭 범위를 `SHARED-BLOCK` 헤더 주석 블록으로 좁히는 것을 고려 |
| 3 | testing | 이 PR 이 고치는 실제 결함(agent 가 프롬프트 계약을 실제로 준수하는지)은 구조적으로 단위 테스트로 증명 불가능 — plan 이 이를 정확히 인지해 검증 절차를 `[ ]`(미완)로 정직하게 열어둠(거짓 "완료" 아님) | `plan/in-progress/backend-lint-gate-broken-on-main.md:311` | 조치 불요. 다음 top-level 세션에서 persisted 워크플로 스크립트 재확인 절차를 그대로 따를 것 |
| 4 | scope | 최초 커밋(`7d6854cb9`)에 report-return 계약 fix 와 self-deadlock JSDoc audit 이라는 두 무관한 주제가 여전히 함께 묶여 있음 — 단, 이미 이전 라운드(`20_21_06`)가 WARNING 으로 지적하고 plan 에 disposition 근거(순수 주석이라 기능 위험 없음)를 남긴 사안으로, 3라운드 동안 재론되지 않음 | `execution-engine.service.ts` (JSDoc) vs `.claude/workflows/_lib/agent-return.mjs`; 판단 기록: `plan/in-progress/backend-lint-gate-broken-on-main.md` | 조치 불요 — 이미 disposed. 향후 유사 상황에서 커밋을 주제별로 분리할 것 |
| 5 | scope | 날짜-오타 스윕 커밋(`ca260d87e`)이 이 PR 자신이 만들지 않은 선행 오타 2곳(`origin/main` 에 이미 병합된 `#1244` 기원)까지 함께 정정 — 저위험(문서 내 날짜 문자열)이고 커밋 메시지에 "11곳"으로 투명하게 수치 공개됨 | `plan/complete/spec-draft-raw-query-results.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md:282` | 조치 불요. 향후 "diff 범위 밖"이라 명시한 리뷰 판단을 다음 라운드가 번복할 때는 그 사실을 plan/커밋 메시지에 한 줄 밝히는 것을 고려 |
| 6 | side_effect | 이번 리뷰 호출 자체가 이 diff 가 교체하는 구버전 계약 문구로 기동됨(같은 세션 5번째 독립 재현) — 코드 결함이 아니라 harness 세션 캐싱(persisted 워크플로 스크립트가 세션 시작 스냅샷으로 고정) 특성이며, plan 이 이미 추적 중이고 "리뷰 라운드를 근거로 체크박스를 닫지 말 것"이라 명시 | 세션 상태(저장소 파일 아님); 추적: `plan/in-progress/backend-lint-gate-broken-on-main.md` | 조치 불요. 새로운 top-level 세션에서만 검증 가능 |
| 7 | maintainability / security | 신규 회귀 테스트(`test_agent_return.mjs`)가 계약 문구의 번호 리터럴(`'1)'`/`'2)'`/`'3)'`)에 `indexOf` 문자열 위치로 결합돼 있어, 향후 번호 체계 변경이나 우연한 부분 문자열 등장 시 조용히 다른 위치를 비교할 수 있음(보안 취약점은 아님, 유지보수성 관점) — 현재는 구버전 문구로 되돌리는 뮤테이션에 정확히 신규 2건만 RED 로 반응함을 확인해 vacuous 아님 | `.claude/tests/test_agent_return.mjs:109-138` | 조치 불요. 다음에 `REPORT_RETURN_CONTRACT` 를 손댈 때 명명된 배열 인덱스/구조화 객체로 리팩터 고려 |
| 8 | maintainability | `.transaction(` 감사 수치(20곳/36개/9/27, 세는 방법 함정 35·39)가 `execution-engine.service.ts` JSDoc 과 `plan/in-progress/backend-lint-gate-broken-on-main.md` 두 곳에 거의 동일하게 기재 — JSDoc 이 plan 을 이력 SoT 로 명시적으로 가리키는 구조라 완전한 무단 중복은 아님 | `execution-engine.service.ts:8571-8583` vs `plan/in-progress/backend-lint-gate-broken-on-main.md:289-306` | 조치 불요. 다음 수치 갱신 시 두 곳 동시 갱신 잊지 말 것(자동 가드 없음) |
| 9 | requirement | `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이 changeset 이 직접 닫을 수 없는 체크박스 2개가 열려 있음(재개 조건이 본문에 명시된 의도적 추적) | `plan/in-progress/backend-lint-gate-broken-on-main.md` | 조치 불요 — 다음 top-level 세션에서 재개 조건대로 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | Critical/Warning 없음. 이전 4라운드 지적사항 전부 해소 확인. plan 미완 체크박스 2건은 의도적 추적(INFO) |
| testing | LOW | 신규 회귀 테스트 13/13 + pytest 6 passed 직접 재실행 확인. 신규 가드 정규식의 경로 접두어 요구·범위 가정(INFO 2건), LLM 준수 여부는 테스트 불가함을 plan 이 정직하게 반영(INFO) |
| documentation | NONE | 발견사항 없음. 날짜·수치(36/35/39, 536/271)·SHARED-BLOCK 미러 바이트 동일성 전부 독립 재현으로 일치 확인 |
| scope | LOW | 두 무관 주제 동일 커밋 혼재(이미 disposed, INFO)·날짜 스윕이 PR 범위 밖 선행 오타 2곳도 정정(저위험, INFO)·리뷰 산출물 커밋 비중 44/54 파일은 관례 부합 |
| security | NONE | 발견사항 없음. 인젝션·시크릿·인증/인가·입력검증·암호화·에러처리·의존성 전 관점 이상 없음 |
| side_effect | LOW | `REPORT_RETURN_CONTRACT` 재정의가 저장소 전역 향후 행동을 바꾸나 4곳 byte-identical 미러 확인. 이번 호출이 구버전 계약으로 기동된 것은 harness 캐싱(5번째 재현, plan 추적 중, INFO) |
| maintainability | LOW | 신규 테스트의 번호 리터럴 문자열 결합(INFO, non-vacuous 확인)·`.transaction(` 수치 JSDoc/plan 중복 기재(INFO, SoT 구조로 완화)·신규 파일명 리네임 가드는 자기참조 설계로 양호 패턴 |

## 발견 없는 에이전트

documentation, security — CRITICAL/WARNING/INFO 모두 0건("발견사항 없음"으로 명시).

## 권장 조치사항

1. (선택) 다음에 `REPORT_RETURN_CONTRACT` 를 다시 손댈 기회가 있으면, `.claude/tests/test_agent_return.mjs` 의 번호 리터럴 `indexOf` 슬라이스를 명명된 배열 인덱스/구조화 객체로 리팩터해 문자열 결합 취약성을 제거.
2. (선택) `.claude/tests/test_workflow_scripts.py` 의 신규 가드 정규식을 경로 접두어 유무와 무관하게 매치하도록(`(?:\.claude/tests/)?(test_\w+\.py)`) 넓혀 이론적 사각지대를 닫기.
3. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 미완 체크박스 2건(persisted 워크플로 스크립트가 새 계약을 실제로 따르는지 확인, planner 턴 draft 커밋 절차화)은 새로운 top-level 세션에서 재개.
4. `.transaction(` 감사 수치를 다음에 갱신할 때 `execution-engine.service.ts` JSDoc 과 `plan/in-progress/backend-lint-gate-broken-on-main.md` 표 양쪽을 함께 갱신.
5. 그 외 즉시 조치가 필요한 항목 없음 — Critical/Warning 0건, 4라운드에 걸쳐 수렴 완료.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement, testing, documentation, scope, security, side_effect, maintainability` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 화이트리스트 7명 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |