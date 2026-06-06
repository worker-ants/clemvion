# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] 내부 실행 엔진 리팩터링 — 외부 API 계약 변경 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 전반
- 상세: 이번 변경(exec-park D6 full B3)은 `pendingContinuations` / `firstSegmentBarriers` / `armFirstSegmentBarrier` / `settleFirstSegment` / `signalParkBarrier` / `resolvePending` / `rejectPending` / `runAiConversationLoop` / `ParkMode` 타입 등 **내부 in-memory 머신 전체를 제거**하고, park 를 단순 세그먼트 종료(코루틴 해제 + durable persist)로 일원화한 것이다. 외부에 노출된 public 메서드(`execute`, `continueExecution`, `applyContinuation`, `applyCancellation`, `runExecutionFromQueue` 등)의 시그니처·반환 타입·에러 시멘틱은 변경되지 않았다.
- 제안: 해당 없음(변경 사항 없음).

### [INFO] `POST /api/executions/{executionId}/continue` — 응답 코드 범위 유지
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` line 2166
- 상세: E2E 테스트가 `expect([200, 202]).toContain(continueRes.status)` 로 두 상태 코드를 모두 허용한다. 이는 기존 API 계약("200 또는 202")을 그대로 반영하며, 이번 변경으로 응답 코드 범위가 좁아지거나 넓어지지 않았다.
- 제안: 해당 없음.

### [INFO] `POST /api/workflows/{workflowId}/execute` — 응답 구조 유지
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` lines 2116~2123
- 상세: E2E 테스트가 `execRes.status === 202`, `execRes.body.data.executionId` 를 검증한다. 이번 변경은 이 응답 구조를 수정하지 않았으며, 기존 클라이언트 계약(`{ data: { executionId: string } }`)이 그대로 유지된다.
- 제안: 해당 없음.

### [INFO] `applyContinuation` 내부 경로 변경 — 외부 페이로드 형식 동일
- 위치: `execution-engine.service.ts` ~line 944~1254
- 상세: `applyContinuation(executionId, nodeExecutionId, payload)` 가 이제 fast-path(in-memory resolver hit) 없이 항상 `rehydrateAndResume` slow-path 로 진입한다. 외부에서 전달하는 payload 형식(`{ type, formData }` / `{ type, buttonId }` / `{ type, message }`)과 길이 가드(10,000자 초과 silent drop)는 변경 없이 유지됐다. BullMQ continuation worker 가 호출하는 계약은 동일하다.
- 제안: 해당 없음.

### [INFO] `applyCancellation` 단일 경로 전환 — 외부 계약 동일
- 위치: `execution-engine.service.ts` ~line 954~1277
- 상세: `applyCancellation(executionId)` 가 이제 두 갈래(in-memory reject vs. DB cancel) 없이 항상 `cancelParkedExecution` 으로 위임한다. WAITING_FOR_INPUT 가드의 멱등성(RUNNING 중 cancel → no-op)은 스펙 §7.4/§7.5 에 명시된 의도적 설계로, external caller(BullMQ cancel worker)의 계약은 변경되지 않았다.
- 제안: 해당 없음.

## 요약

이번 변경(exec-park D6 full B3)은 실행 엔진 내부의 in-memory park/continuation 머신을 제거하고 모든 재개 경로를 §7.5 durable rehydration 으로 일원화한 대규모 내부 리팩터링이다. 외부에 노출된 REST API 엔드포인트(`/api/workflows/:id/execute`, `/api/executions/:id/continue` 등)의 경로·HTTP 메서드·응답 구조·에러 형식·인증 요구사항은 전혀 변경되지 않았다. 내부 서비스 메서드 시그니처 중 `waitForFormSubmission(parkMode)` / `waitForButtonInteraction(parkMode)` / `waitForAiConversation(parkMode)` 의 `parkMode` 파라미터가 제거됐으나, 이는 private 메서드이며 외부 API 계약과 무관하다. API 계약 관점에서 breaking change 없음.

## 위험도

NONE
