# RESOLUTION — review/code/2026/07/26/22_11_22

3차 라운드 ai-review (Critical 0 / Warning 9 / SPEC-DRIFT 1). main 우선순위 지시에 따라
코드로 닫을 것(#1·#3·#5·#8·#9)과 문서/plan 로만 닫을 것(#2·#4·#6·#7)을 분리 처리했다.
SPEC-DRIFT #1 은 이미 위임된 draft(`spec-update-node-cancellation-shutdown-classification.md`
#7)에 흡수돼 추가 조치 없음.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `d1d8d2db1` | 잔여 TOCTOU — `assertActiveExecutionAndSaveNodeExec`(FOR UPDATE 트랜잭션)로 관측+save 완전 원자화. 주석/알려진 리스크로 남기지 않고 구조적으로 닫음 |
| #2 | 문서/plan | `f306a62c8` | WS emit 순서 갭 — 코드 변경 없이 plan "후속(본 PR 밖)" 절에 증상·영향·닫는 방법·FE 우선순위 확인 항목 등재 |
| #3 | 문서 | `703606c1e` | CHANGELOG "AI 경로 3곳"→"4곳" 정정 + 4번째(`assertActiveExecutionAndSaveNodeExec`) 메커니즘 명시 |
| #4 | 문서/plan | `f306a62c8` | `markNodeCancelled` 사전 초기화 계약(타입 미강제) — plan 후속 등재만, 코드 변경 없음 |
| #5 | 코드 | `d1d8d2db1` | `assertLinkedTransitionApplied` 의 `applied`→`shouldProceed` 파라미터명 개정 + JSDoc 이중 계약 명시(SUMMARY#1 fix 로 네 호출부 계약이 실질적으로 통일됨) |
| #6 | 문서/plan | `f306a62c8` | `updateExecutionStatus` 두 분기 4줄 마무리 블록 중복 — plan 후속 등재만, 코드 변경 없음 |
| #7 | 문서/plan | `f306a62c8` | `markNodeCancelled`/`assertExecutionNotCancelled` public 전환 표면 확대 — 설계 의도 확인, plan 후속 등재(리뷰 시 확인 포인트) |
| #8 | 테스트 | `d1d8d2db1` | `assertLinkedTransitionApplied` phase 문자열 단언을 re-park + RUNNING 유지 분기 2곳에 추가(4곳 중 최소 2곳 충족) |
| #9 | 테스트(e2e) | `b81833f64` | turn-finalize 대기 고정 `setTimeout(2_500)` → `node_execution` terminal DB poll(`pollNodeExecutionTerminal`) 전환 |
| SPEC-DRIFT #1 | spec (draft 위임, 이미 완료) | — | `spec-update-node-cancellation-shutdown-classification.md` #7(보강 6~8번)에 전부 위임돼 있음. 추가 조치 불요, `spec/` 미수정. 단 SUMMARY#1 fix 의 부수효과로 EngineDriver 멤버 수 목표(#8 보강 항목)를 14/9→15/10 으로 `f306a62c8` 에서 재정정(코드 실측과의 drift 예방) |

## TEST 결과

- lint  : 통과 (신규 prettier 위반 4건은 `eslint --fix` 로 정정 후 재통과)
- unit  : 통과 (backend: 412 suite / 8302 passed + 1 skipped = 8303 total. frontend·web-chat·channel-web-chat·내부 패키지 전부 통과)
- build : 통과 (backend/frontend/web-chat/channel-web-chat + 내부 패키지 + Dockerfile 빌드 검증)
- e2e   : 통과 (46 suite / 260 passed, `execution-park-resume.e2e-spec.ts` 신규 poll 기반 회귀 포함)

## 보류·후속 항목

- **SUMMARY#2 (WS emit 순서 갭)** — `plan/in-progress/ie-resume-turn-boundary-cancel.md`
  "후속(본 PR 밖)" 절 "3차 라운드 추가 후속" 참조. 증상: turn 진행 중 Stop 을 눌러도 LLM
  호출 종료 후 `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT` 이 취소 재확인 없이 먼저 emit
  된다(DB 는 안전, 표시 계층 갭). 닫는 방법: emit 직전 `assertExecutionNotCancelled`
  재확인 추가(범위가 이번 PR 보다 커 별도 후속 PR). FE 의 `NODE_CANCELLED`/
  `EXECUTION_CANCELLED` 우선순위 확인도 함께 필요.
- **SUMMARY#4 (`markNodeCancelled` 초기화 계약)** — 같은 plan 절에 등재. 타입 시그니처
  수준 흡수(`clearPayload?` 옵션 등) 필요.
- **SUMMARY#6 (4줄 마무리 블록 중복)** — 같은 plan 절에 등재. 공통 후처리 헬퍼 추출 후속.
- **SUMMARY#7 (public 표면 확대)** — 같은 plan 절에 등재. 설계 의도 확인, 후속 form/button
  PR 이 `ENGINE_DRIVER` 토큰 우회하지 않는지 리뷰 시 확인 포인트로 기록.
- **SPEC-DRIFT #1** — `spec-update-node-cancellation-shutdown-classification.md` #7
  (보강 6~8번)에 전부 위임 완료 상태 유지. 이번 라운드는 코드 실측치(15/10) 반영만 추가.
