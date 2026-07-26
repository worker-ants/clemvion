# RESOLUTION — 00_00_47

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 | `538a7f417` | `handleAiMessageTurn` 최상단 turn 경계 가드가 통일 계약(`assertLinkedTransitionApplied`)을 우회 — 다섯 번째 소비처로 통일, 짝 nodeExec CANCELLED 마킹 후 rethrow |
| Critical #2 | 코드 | `538a7f417` | `finalizeAiNode` 의 `isFailed` 분기가 형제(COMPLETED) 분기의 원자 가드(`tryLockActiveExecutionAndSaveNodeExec`)를 전혀 안 거쳐 CANCELLED→FAILED lost-update 재발 — 동일 가드 재사용으로 해소 |
| Warning #1 | 코드 | `2e30beab2` | `cancelParkedExecution` 의 Execution/NodeExecution 이중 UPDATE 를 `markWebChatIdleTimeout` 과 동일한 `dataSource.transaction` 으로 원자화 |
| Warning #2 | 보류 | (조치 없음) | form/button 4개 호출부 미소비 — 지시에 따라 코드 변경 금지, plan 후속 절 재확인만 등재 |
| Warning #3 | 보류 | (조치 없음) | `handleAiMessageTurn` 과다 길이 + payload 중복 — 지시에 따라 코드 변경 금지, plan 후속 절 신규 등재 |
| Warning #4 | 코드 | `2e30beab2` | `ExecutionEngineService` 클래스 docblock 정적 줄 수("~4200줄") stale — 하드코딩 수치 제거, `plan/complete/c1-engine-split.md` 포인터로 대체 |
| Warning #5 | 코드 | `2e30beab2` | 테스트 주석 2곳의 하드코딩 줄 번호(도입 시점부터 stale) — describe 이름 인용으로 교체 |
| Warning #6 | 보류 | (조치 없음) | AI turn 정상 종료 경로 트랜잭션/FOR UPDATE 비용 — 지시에 따라 코드 변경 금지, plan 후속 절 신규 등재(의도된 트레이드오프) |
| SPEC-DRIFT #1, #2 | spec | (조치 없음) | 이미 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #7 로 위임 완료 — 신규 draft 불요, `spec/` 수정 금지 |

## TEST 결과

- lint  : 통과 (1건 prettier 포맷 오류 `eslint --fix` 로 자동 정정 후 재확인)
- unit  : 통과 (targeted: `ai-turn-orchestrator.service.spec.ts` 86 passed, `execution-engine.service.spec.ts` 430 passed; 전체 unit 스테이지 PASS)
- build : 통과
- e2e   : 통과 (260 passed, duration 297s, 로그 `_test_logs/e2e-20260727-010021.log`)

## 보류·후속 항목

- Warning #2 (form/button 미소비, 5차 재확인) — `plan/in-progress/ie-resume-turn-boundary-cancel.md` "5차 라운드 추가 후속" 절에 등재. 2026-07-26 최초 발견 이후 두 번째 재확인 — 후속 PR 착수 우선순위 상향 권고.
- Warning #3 (`handleAiMessageTurn` 과다 길이 + payload 중복, 신규) — 동일 plan 문서 같은 절에 신규 등재. waiting/terminal 분기 헬퍼 분리 + 공통 페이로드 빌더 추출 권고.
- Warning #6 (FOR UPDATE 비용, 신규) — 동일 plan 문서 같은 절에 신규 등재. 저위험·의도된 트레이드오프로 우선순위 낮음.
- SPEC-DRIFT #1 (`spec/conventions/node-cancellation.md` §2.1/§2.3/§6), #2 (`spec/5-system/4-execution-engine.md` §1.1) — 신규 draft 없음. 이미 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #7 로 위임 완료된 상태이며 이번 라운드는 코드가 spec 을 정당하게 앞서있음을 재확인만 함(코드 유지, spec 갱신은 project-planner 턴 대기 중).

## 참고

- 세션 진행 로그: `_resolution_log.md`
- Idempotency 상태: `_resolution_state.json`
