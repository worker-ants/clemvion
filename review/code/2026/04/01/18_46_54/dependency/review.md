## 의존성 코드 리뷰 결과

### 발견사항

- **[INFO]** `forwardRef` + `@Inject` 순환 의존성 해결 패턴 사용
  - 위치: `execution-engine.service.ts:101`, `websocket.gateway.ts:43`
  - 상세: `ExecutionEngineService` ↔ `WebsocketService` 간 양방향 참조를 `forwardRef()`로 해결. NestJS 공식 권장 패턴이며 적절한 사용.
  - 제안: 장기적으로는 `EventEmitter2` 같은 이벤트 버스 패턴으로 순환 의존을 제거하는 것이 더 건전한 설계이나, 현재 규모에서는 허용 가능.

- **[WARNING]** `WebsocketGateway`가 `ExecutionEngineService`에 직접 의존
  - 위치: `websocket.gateway.ts:14, 43`
  - 상세: Gateway 레이어가 Service 레이어에 직접 참조를 가지는 것은 레이어 역전. 원래 `WebsocketService`가 `ExecutionEngineService`에 의존하는 구조였는데, 이번 변경으로 Gateway도 Engine에 의존하여 삼각 의존 형태가 됨 (`Gateway → Engine → WsService`, `Gateway → WsService`).
  - 제안: `ExecutionEngineService`에 `continueExecution`을 호출하는 전용 DTO/Command를 `ExecutionsModule`의 REST 엔드포인트 또는 별도 `ExecutionCommandService`를 통해 처리하거나, WebSocket 이벤트를 `ExecutionsService`를 거쳐 Engine을 호출하도록 분리.

- **[INFO]** `getWsClient()` 싱글톤을 컴포넌트에서 직접 호출
  - 위치: `run-results-drawer.tsx:6`, `HistoryEntry` 컴포넌트 내부
  - 상세: 새 외부 패키지 추가 없이 기존 내부 모듈(`ws-client`) 재사용. 의존성 관점에서 문제 없음. 단, 컴포넌트가 WebSocket 클라이언트에 직접 결합되어 테스트 격리가 어려워짐.
  - 제안: `onFormSubmit` 콜백을 상위에서 주입하거나 `useExecutionEvents` 훅에 `submitForm` 함수를 추가하여 컴포넌트와 전송 레이어 분리 고려.

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: 전체 변경 파일
  - 상세: 모든 변경이 기존 의존성(`@nestjs/common`, `socket.io`, `zustand`, `lucide-react`, `@/components/ui/*`) 범위 내에서 이루어짐. 번들 크기 영향 없음.

- **[INFO]** `lucide-react` 아이콘 추가 (`PauseCircle`, `BarChart3`, `Table2`, `LayoutGrid`, `FormInput`, `ChevronRight`)
  - 위치: `run-results-drawer.tsx:11-21`
  - 상세: 동일 패키지 내 추가 아이콘 임포트이므로 tree-shaking 대상. 번들 영향 미미.
  - 제안: 이상 없음.

- **[INFO]** `NodeExecutionData["status"]`에 `"waiting_for_input"` 타입 추가
  - 위치: `use-execution-events.ts:43`
  - 상세: `executionsApi`의 `NodeExecutionData` 타입과 내부 `NodeExecutionStatus` 타입이 일치해야 함. `executionsApi` 타입 정의에서도 동일하게 반영되었는지 확인 필요.
  - 제안: `executions.ts`의 `NodeExecutionData` 타입에 `"waiting_for_input"` 값이 포함되어 있는지 검증.

---

### 요약

이번 변경에서 신규 외부 패키지는 추가되지 않았으며, 기존 의존성 범위 내에서 기능이 구현되었습니다. 의존성 크기·버전 충돌·라이선스 문제는 없습니다. 주요 우려 사항은 `WebsocketGateway`가 `ExecutionEngineService`에 직접 의존함으로써 형성된 삼각 순환 의존 구조로, 현재는 `forwardRef`로 해결되어 동작하지만 모듈 경계가 모호해지고 테스트·유지보수가 어려워질 수 있습니다.

### 위험도
**LOW**