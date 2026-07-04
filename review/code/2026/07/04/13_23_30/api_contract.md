# API 계약(API Contract) 리뷰

## RE-REVIEW 확인 사항

기존 CRITICAL/WARNING 지적: `POST /executions/:id/_test/simulate-execution-run-redelivery` (PR4 e2e 전용 test-hook) 가 같은 컨트롤러의 다른 `:id` 라우트(`findOne`, `stop`, `continueExecution`)와 달리 workspace 소유권 검증 없이 `runExecutionFromQueue` 를 직접 호출해 cross-workspace IDOR 노출 가능성이 있었음.

**검증 결과: 수정 확인됨.**

- `codebase/backend/src/modules/executions/executions.controller.ts:246` — `simulateExecutionRunRedeliveryForTest` 가 `runExecutionFromQueue` 호출 전에 `await this.executionsService.verifyOwnership(id, workspaceId)` 를 호출하도록 수정됨. 게이팅(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'`) 통과 이후, 그리고 실제 실행 전에 소유권 검증이 위치해 sibling `:id` 라우트(`findOne` L86, `stop` L140, `continueExecution` L171)와 동일한 방어 패턴으로 정렬됨.
- 게이팅 실패(NODE_ENV/플래그 미충족) 시에는 `verifyOwnership` 호출 전에 404 로 조기 반환 — 라우트 존재 자체를 은닉하는 기존 방어(다층 방어 주석 §205-210)와 충돌 없이 유지됨.
- 단위 테스트 보강 확인 (`executions.controller.spec.ts:208-273`, `describe('simulateExecutionRunRedeliveryForTest (test-only gating + ownership)')`):
  - 정상 케이스: 소유권 검증 후 재배달 시뮬레이션 (L220-235)
  - cross-workspace 소유권 실패 시 재배달 미트리거·에러 전파 (L237-249)
  - NODE_ENV/플래그 게이팅 실패 시 소유권 검증 자체를 호출하지 않고 404 (L251-272)
- 다른 test-hook `triggerStuckRecoveryForTest` (`:id` 파라미터 없음, 전역 스캔 트리거)는 리소스 식별자가 없어 소유권 검증 대상이 아님 — 일관성 문제 없음.

이로써 이전 라운드에서 지적된 인가(§8 인증/인가) 비일관성 갭은 해소되었다.

## 나머지 변경 (spec 문서만)

이번 changeset 의 나머지 diff(`spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`)는 `WORKER_HEARTBEAT_TIMEOUT` 에러 코드의 상태를 "PR4 예약"에서 "PR4 구현(2026-07-04)"으로 갱신하는 문서 정합화이며, 신규/변경 REST 엔드포인트, 응답 스키마, 에러 응답 봉투 변경은 없다. 에러 코드 자체(`WORKER_HEARTBEAT_TIMEOUT`)는 기존 카탈로그 내 항목으로 이미 문서화돼 있던 값의 발동 조건 설명 갱신에 해당하며, API 응답 형식(`{ error: { code, message, requestId, details? } }`)에 대한 breaking change 는 없다.

## 발견사항

없음.

## 요약

이전 라운드에서 CRITICAL/WARNING 으로 지적된 test-hook IDOR 갭이 sibling `:id` 라우트와 동일한 `verifyOwnership(id, workspaceId)` 패턴으로 정상 수정되었고, 이를 검증하는 단위 테스트(정상/소유권 실패/게이팅 실패 3케이스)도 추가되어 있다. 나머지 diff 는 에러 코드 발동 조건에 대한 spec 문서 정합화로 API 계약에 영향 없음.

## 위험도
NONE

STATUS: SUCCESS
