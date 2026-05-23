# RESOLUTION — render-form-submit-fix-3f10bf / 17_58_19

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C#1 | 코드 | a67de956 | continueExecution 에서 sentinel wrap, 'continue' listener raw forward (spec §10.9 정합) |
| W#4 | 코드 | a67de956 | stale turnIndex 의도된 패턴 주석 명시 |
| W#5 | 코드 | a67de956 | sentinel 없는 폴백 분기 warn log 추가 |
| W#6 | 코드 | a67de956 | unknown skip counter MAX_UNKNOWN_SKIPS(20) cap 추가 |
| W#7 | 코드 | a67de956 | isFormSubmittedSentinel type guard 헬퍼 추출 |
| W#8 | 코드 | a67de956 | getPendings(svc) 테스트 헬퍼 추출 |
| W#9 | 코드 | a67de956 | submitForm getState() 의도적 패턴 차이 주석 |
| W#10 | 코드 | a67de956 | isUserInitiatedTurn() 헬퍼 추출 (frontend) |
| W#11 | 코드 | a67de956 | waitForAiConversation form_submitted dispatch 단위 테스트 추가 |
| W#12 | 코드 | a67de956 | unknown action.type warn+reenter 단위 테스트 추가 |
| W#13 | 코드 | a67de956 | back-compat fallback warn log 테스트 추가 |
| W#14 | 코드 | a67de956 | C#1 fix 로 자연 통합 (continueExecution→listener→resolvePending 통합 케이스) |
| W#3 | 코드 | — | plan 문서 정합화 → PR close 단계 main 처리 (보류) |
| W#1 | spec | (draft 위임) | `plan/in-progress/spec-fix-form-submission-w1-w2-w15.md` |
| W#2 | spec | (draft 위임) | `plan/in-progress/spec-fix-form-submission-w1-w2-w15.md` |
| W#15 | spec | (draft 위임) | `plan/in-progress/spec-fix-form-submission-w1-w2-w15.md` |
| I#1 | 코드 | a67de956 | unknown type warn log .slice(0,64) Log Injection 방지 |
| I#5 | 코드 | 323876aa | ai-agent.handler pendingFormToolCall fallback warn log + static logger 수정 |
| I#7 | 코드 | a67de956 | submitForm 중복 호출 once listener 등록 검증 테스트 |
| I#8 | 코드 | a67de956 | presentation 혼합 turnIndex 검증 테스트 |
| I#9 | 코드 | a67de956 | Unknown error fallback toast 검증 테스트 |
| I#10 | 코드 | a67de956 | submitForm JSDoc 사이드이펙트 보강 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4560 passed)
- build : 통과
- e2e   : 통과 (98/98)

## 보류·후속 항목

- INFO I#2 (toast.error 서버 메시지 원문 노출): 기존 패턴 계승, INFO 수준 — 별 작업
- INFO I#3 (optimistic store 민감 폼 필드 잔류): 별 작업 plan
- INFO I#4 (plan 체크리스트 미갱신): PR close 단계 갱신 (main 처리)
- INFO I#6 (submitted unwrap 위치 Plan 명시 부족): INFO
- INFO I#11 (spec anchor 렌더러 호환성): INFO
- INFO I#12 (WS ack 이벤트명 비일관성): 기존 비일관성, 본 PR 무관 — INFO
- INFO I#13 (WS spec submit_form payload shape): project-planner 위임
- W#3 (plan ack 롤백 기술 불일치): plan 문서 정합화 → PR close 단계 main 처리
- spec draft 위임 (ESCALATE=spec): `plan/in-progress/spec-fix-form-submission-w1-w2-w15.md`
  - W#1: button_click AI conversation 미도달 invariant 명문화
  - W#2: formData ?? {} fallback spec 명시
  - W#15: §Rationale SSOT 4-layer 목록 → §10.9 cross-ref 로 대체
