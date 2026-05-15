해당 없음

이번 변경사항은 백엔드 내부 서비스 간의 NestJS 라이프사이클 race condition 수정으로, 외부에 노출되는 HTTP API 엔드포인트, 요청/응답 스키마, URL 경로, 인증/인가 메커니즘에 전혀 변경이 없습니다.

변경 내용은 다음으로만 구성됩니다:
- `ContinuationBusService` 내부 메서드(`publish`, `acquireLock`, `releaseLock`)의 방어적 null 가드 추가
- `ExecutionEngineService.recoverStuckExecutions()` 호출 시점을 `onModuleInit` → `onApplicationBootstrap`으로 이동
- 위 두 변경에 대한 단위 테스트 추가

이는 순수하게 내부 서비스 레이어의 안정성 개선이며 클라이언트와의 계약(API Contract)에 영향을 주는 요소가 없습니다.

### 위험도
NONE