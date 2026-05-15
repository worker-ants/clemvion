### 발견사항

- **[INFO]** 신규 내부 모듈 의존성 추가: `WebsocketModule` → `ExecutionsModule`
  - 위치: `websocket.module.ts:22`, `websocket.gateway.ts:46`
  - 상세: `forwardRef(() => ExecutionsModule)` 로 순환 참조를 처리하고 있음. `ExecutionsModule`이 이미 `WebsocketModule`을 import하거나 간접 의존한다면 양방향 순환이 발생할 수 있음. `forwardRef` 패턴 자체는 NestJS 표준 처리이므로 런타임 문제는 없으나, 의존 방향이 복잡해짐.
  - 제안: `ExecutionsModule`이 `WebsocketModule`을 역으로 import하는지 확인하여 순환 depth를 파악할 것. 스냅샷 조회가 게이트웨이의 책임인지 재고가 필요하다면 별도 서비스 레이어(예: `ExecutionSnapshotService`)로 분리하는 방법도 있음.

- **[INFO]** `WebsocketGateway`에 `ExecutionsService` 직접 주입
  - 위치: `websocket.gateway.ts:44-46`
  - 상세: Gateway 레이어가 Service 레이어를 직접 참조함. `findById`가 `nodeExecutions` JOIN을 포함하는 무거운 쿼리라면 구독 이벤트마다 DB 조회가 발생하여 연결이 많아질수록 부하가 증가함.
  - 제안: `findById`의 쿼리 cost(JOIN 포함 여부)를 확인하고, 필요 시 쿼리를 경량화하거나 실행 상태 캐시 레이어를 고려할 것.

- **[INFO]** 프론트엔드 `executionsApi` REST 의존성 제거
  - 위치: `use-execution-events.ts:9`
  - 상세: `executionsApi.getById` 폴링 로직이 완전히 제거되고 `ExecutionData` 타입만 남음. REST API 의존성이 줄어든 것은 긍정적이나, WS 스냅샷이 누락될 경우(서버 지연, 구독 타이밍 레이스) 초기 상태 복원 fallback이 없어짐.
  - 제안: 스냅샷 미수신 시나리오(연결 지연, 서버 측 `findById` 실패로 인한 debug 로그만 기록되는 경우)에 대한 fallback 전략을 검토할 것.

- **[INFO]** 테스트 모킹 변경: `executionsApi` mock 제거, `ExecutionsService` mock 추가
  - 위치: `websocket.gateway.spec.ts:52-57`
  - 상세: 새 의존성에 대한 mock이 적절히 추가됨. `findById`를 기본값 `mockRejectedValue`로 설정하여 snapshot 실패 시 graceful 처리를 검증하는 구조는 올바름.
  - 제안: 정상 경로(snapshot 성공 시 `execution.snapshot` emit)에 대한 테스트 케이스가 현재 spec에 없음. 추가 권장.

---

### 요약

이번 변경은 신규 외부 패키지를 전혀 도입하지 않으며, 순수하게 내부 모듈 의존성 재편성에 해당합니다. `WebsocketModule`이 `ExecutionsModule`을 `forwardRef`로 참조하는 패턴은 NestJS에서 표준이나, 두 모듈 간 양방향 순환이 생길 경우 초기화 순서 이슈가 잠재적으로 존재합니다. 프론트엔드에서 REST 폴링 의존성을 제거하고 WS 스냅샷으로 대체한 방향은 의존성 단순화 측면에서 올바르지만, 스냅샷 미수신 시 fallback 부재가 단기적 리스크입니다.

### 위험도
**LOW**