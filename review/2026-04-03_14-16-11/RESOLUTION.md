# Code Review Resolution

## WARNING 조치

### W5. handleExecutionStarted의 backward compat guard
- Dead code가 아닌 **하위 호환** 가드로 유지
- 구 버전 백엔드가 `execution.started`를 보내는 경우에 대비
- 주석으로 의도를 명확히 문서화

### W6. 폴링 경로의 resumeFromForm 누락 해결
- `pollExecutionStatus`에서 이전 상태가 `waiting_for_input`이고 현재 상태가 `running`인 경우 `resumeFromForm()` 호출 추가
- WebSocket 이벤트 유실 시에도 폴링으로 정상 복구 보장

### W8. resumeFromForm 멱등성
- 현재 구현이 이미 멱등적 (고정 값 설정: `status: "running"`, `waitingNodeId: null`, `waitingFormConfig: null`)
- 이중 호출(WS + polling)이 발생해도 부작용 없음

## INFO 조치

### EXECUTION_RESUMED JSDoc 추가
- `ExecutionEventType.EXECUTION_RESUMED` enum에 JSDoc 주석 추가

### cleanup 테스트 보강
- `execution.resumed` 핸들러가 cleanup 시 `client.off`로 정상 해제되는지 명시적 assert 추가

### useEffect 의존성 배열 수정
- `resumeFromForm`을 deps 배열에 추가 (폴링 함수에서 사용)

## 미조치 사유 (기존 이슈)

### W1. continueExecution 인가 검증
- WebSocket 게이트웨이에서 이미 `userId` 인증 검증이 수행됨 (websocket.gateway.ts:166-167)
- 소유자 인가(authorization)는 별도 보안 강화 이슈로 분리 필요

### W2. formData 입력값 검증
- 기존 코드의 설계 이슈로, 이번 버그 수정 범위와 별개
- 별도 보안 이슈로 추적 필요

### W3. timeout 범위 제한
- 기존 코드의 설계 이슈, 별도 이슈로 추적

### W4. WS 페이로드 런타임 검증
- 프론트엔드 전반의 WS 이벤트 핸들링 구조 변경이 필요한 대규모 작업
- 별도 이슈로 추적

### W7. 트랜잭션 처리
- DB 쓰기의 트랜잭션 묶기는 기존 설계 이슈, 별도 이슈로 추적
