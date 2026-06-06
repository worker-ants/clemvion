# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done  
검토 범위: `spec/5-system/4-execution-engine.md` (diff base: origin/main)  
검토 일시: 2026-06-06

---

## 발견사항

충돌 발견 없음.

이번 diff 에서 도입된 신규 식별자는 다음 두 가지다.

1. `isNodeWaitingForInput` — `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` 에 `export function` 으로 신규 추가.
2. `reconcilePreParkWaitingStatus` — `codebase/backend/src/modules/executions/executions.service.ts` 에 module-private function 으로 신규 추가.

각 관점별 점검 결과는 아래와 같다.

### 1. 요구사항 ID 충돌

이번 변경은 spec 문서를 수정하지 않으며 새 요구사항 ID 를 부여하지 않는다. 충돌 없음.

### 2. 엔티티/타입명 충돌

- `isNodeWaitingForInput`: origin/main 의 `apply-execution-snapshot.ts` 에는 이 이름이 존재하지 않았다 (`export function` 목록: `applyExecutionSnapshot`, `buildConvConfigFromStructured`, `mapNodeStatus`, `getCategoryForType`, `inferInteractionTypeFromNodeType`, `shouldUpdateStatus`). 전체 코드베이스에서도 동일하거나 유사한 이름(`isNodeWaiting`, `isWaitingNode`, `checkWaiting`, `nodeIsWaiting`)이 없다.
- `reconcilePreParkWaitingStatus`: origin/main 의 `executions.service.ts` 에 존재하지 않았다. 전체 코드베이스에서 `reconcilePrePark` 패턴이 없다. `reconcile` 접두어는 코멘트 및 변수명(`reconcileToWaiting`)에서 일반 동사로 사용되지만, `reconcilePreParkWaitingStatus` 라는 함수명은 유일하다.
- `NodeExecutionStatus`: origin/main 의 `executions.service.ts` 는 `NodeExecution` 만 임포트하고 있었고 `NodeExecutionStatus` 는 임포트하지 않았다. 이번 diff 가 `NodeExecutionStatus` 를 추가 임포트하는데, 이 enum 은 `node-execution.entity.ts` 에서 이미 정의된 기존 식별자이므로 신규 도입이 아니다. 충돌 없음.

### 3. API endpoint 충돌

이번 변경은 새 API endpoint 를 추가하지 않는다. 충돌 없음.

### 4. 이벤트/메시지명 충돌

이번 변경은 새 WebSocket/SSE/Queue 이벤트 이름을 도입하지 않는다. 충돌 없음.

### 5. 환경변수·설정키 충돌

이번 변경은 환경변수 또는 설정키를 추가하지 않는다. 충돌 없음.

### 6. 파일 경로 충돌

이번 변경은 새 파일을 추가하지 않고 기존 파일 4개만 수정한다. 충돌 없음.

---

## 요약

이번 diff 가 도입하는 두 신규 식별자(`isNodeWaitingForInput`, `reconcilePreParkWaitingStatus`)는 기존 코드베이스 어디에도 동일하거나 유사한 이름으로 등록된 사례가 없다. 요구사항 ID·API endpoint·이벤트명·환경변수·파일 경로 관점에서도 신규 식별자 도입이 없거나 기존 정의와 충돌하지 않는다. 식별자 충돌 위험 없음.

---

## 위험도

NONE
