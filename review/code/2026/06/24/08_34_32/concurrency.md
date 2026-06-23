# 동시성(Concurrency) 리뷰 결과

## 발견사항

이번 변경(M-3 2단계: `AssistantFinishGuard` 분리 리팩터링)의 핵심 동시성 관련 코드는 `assistant-finish-guard.service.ts`의 `evaluateReviewGuard` 메서드 내 `Promise.all` 패턴이다.

### [INFO] Promise.all 병렬 candidate lookup — 정상 패턴
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` L626–643
- 상세: 스냅샷 전체 노드에 대해 `collectPendingUserConfig`(sync)로 1차 필터 후, pending 있는 노드에만 `fillCandidates`(async DB 조회)를 `Promise.all`로 병렬 실행한다. 결과를 `new Map` 불변 객체로 생성한다. 이 패턴은 review W-2·W-13 최적화 주석과 일치하며 경쟁 조건·데드락 위험 없다.
- 제안: 해당 없음. 올바른 패턴.

### [INFO] FinishGuardState는 호출부 소유 — 의도된 설계
- 위치: `FinishGuardState` 인터페이스 및 `WorkflowAssistantStreamService.streamMessage` 호출부
- 상세: `AssistantFinishGuard` 자체는 무상태(stateless) collaborator이며, 턴 횡단 카운터(`finishBlockCount`, `reviewRoundCount` 등)는 호출부(stream service)가 단일 async generator 스코프 내에서 소유·변이한다. Node.js 단일 스레드 이벤트 루프 모델 하에서 `streamMessage` generator 1개가 1요청·1턴을 전담하므로, `FinishGuardState` 객체에 대한 공유 변이 경쟁 조건이 발생하지 않는다.
- 제안: 해당 없음. 구조 설계가 안전하다.

### [INFO] collect-pending-user-config.ts 내 shadow.snapshot() 중복 호출
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` L910, `evaluateReviewGuard` L602·L627
- 상세: `evaluateReviewGuard`에서 `shadow.snapshot()`을 한 번 찍어 `snapshot` 변수로 재사용하고 있으나, 내부에서 호출하는 `collectPendingUserConfig` 함수는 `shadow.snapshot()`을 다시 한 번 호출한다(노드 수만큼 N회). `snapshot()`이 shallow clone이라면 추가 할당 비용이 발생하지만 원자성·경쟁 조건 위험은 없다. 성능 관심사에 그친다.
- 제안: 성능이 실제 문제가 될 경우 `collectPendingUserConfig`에 이미 획득한 snapshot을 전달하는 시그니처를 추가 검토할 수 있으나, 현재 규모에서는 필수 아님.

## 요약

이번 변경은 `WorkflowAssistantStreamService` 내에 혼재하던 finish/review 가드 로직을 무상태 NestJS 서비스(`AssistantFinishGuard`)로 추출하는 순수 리팩터링이다. 동시성 관점에서 신규 위험 요소는 없다. `Promise.all` 병렬 DB 조회는 1차 sync 필터 후 실행되어 N×M burst를 차단하며, 결과 Map을 불변 생성하는 올바른 패턴을 따른다. `FinishGuardState`는 호출부(stream service의 단일 generator 스코프)가 소유·변이하는 구조로 공유 상태 경쟁 조건이 발생하지 않는다. Node.js 싱글 스레드 이벤트 루프 환경에 적합하게 설계되어 있다.

## 위험도

NONE
