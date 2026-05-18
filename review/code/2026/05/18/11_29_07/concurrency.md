### 발견사항

- **[WARNING]** `tryRecoverExpired` 의 refresh 후 재조회(re-read) 가 worker 완료를 동기적으로 보장하지 않음
  - 위치: `cafe24-mcp-tool-provider.ts` — `tryRecoverExpired()` 내 `refreshTokenViaQueue` 호출 이후 `getForExecution` 재조회 구간
  - 상세: `refreshTokenViaQueue`는 BullMQ 큐에 job을 enqueue하고 worker가 완료될 때까지 `QueueEvents`를 통해 대기한다. 그러나 `refreshViaQueue` 내부에서 `waitUntilFinished`를 실제로 await하는지, 아니면 단순히 add만 하는지가 이 diff에서 확인되지 않는다. 만약 worker 완료를 await하지 않고 재조회하면, DB 갱신이 완료되기 전에 여전히 `expired` 상태인 row를 읽어 `expired_refresh_failed`로 잘못 처리할 수 있는 TOCTOU(Time-of-Check-Time-of-Use) 윈도우가 존재한다.
  - 제안: `Cafe24ApiClient.refreshViaQueue`가 내부적으로 `QueueEvents.waitUntilFinished`를 await하여 worker 완료 후 반환하는지 코드 주석 또는 테스트로 명시한다. 만약 fire-and-forget 방식이라면 재조회 전 적절한 완료 신호를 기다려야 한다.

- **[INFO]** `mcpDiagnosticsAcc` 배열의 멀티 턴 간 격리는 설계상 안전하나 코드 리뷰 관점에서 주의 필요
  - 위치: `ai-agent.handler.ts` — 싱글턴 모드 및 멀티턴 각 turn 블록 내 `const mcpDiagnosticsAcc: McpServerSummary[] = []`
  - 상세: 각 turn 진입 시 새 배열을 로컬 변수로 선언하여 격리하는 설계는 올바르다. Node.js 싱글 스레드 이벤트 루프 모델에서 동일 execution 내 동시 접근이 없으므로 race condition은 발생하지 않는다. 다만 멀티턴 resume 시 이전 turn의 `mcpDiagnosticsAcc`가 `resumeState`에 보존되지 않는 점(코드 주석으로 설명됨)은 의도적 설계임을 확인.
  - 제안: 현재 설계 유지. 코드 주석이 의도("buildTools가 결정론적이므로 안전")를 명시하고 있어 이해하기 충분하다.

- **[INFO]** `IntegrationExpiryScannerService.run` 에서 `isCafe24RefreshCapable` 판별 후 큐 enqueue 실패 시 `integrationsToUpdate`에 추가하지 않는 설계의 원자성 고려
  - 위치: `integration-expiry-scanner.service.ts` — 0d 분기 `isCafe24RefreshCapable` 참 분기
  - 상세: enqueue 실패(Redis 장애 등) 시 `catch` 블록에서 warn 로그만 남기고 `integration.status`를 `expired`로 변경하지 않는다. 이는 의도된 동작(다음 일일 패스에서 재시도)이나, enqueue도 실패하고 status 변경도 없는 상태가 다음 스캔 패스까지 지속되므로 서비스 레벨에서 통합이 사실상 "보이지 않는" 상태로 남는 기간이 최대 24시간까지 연장될 수 있다. 알림은 발사되어 사용자 가시성은 유지된다.
  - 제안: 현재 설계가 스펙(§8.6 근거)에 부합하나, 모니터링 알림(예: 스캔 패스당 enqueue 실패 카운트 메트릭)을 추가하면 Redis 장애 시 빠른 감지가 가능하다.

### 요약

이번 변경은 Node.js 이벤트 루프 기반의 싱글 스레드 환경에서 동작하며, BullMQ `jobId` dedup을 통해 멀티 인스턴스 클러스터 간 refresh 직렬화를 구현한 설계다. 동시성 관점에서 핵심 위험은 `tryRecoverExpired` 내에서 큐 enqueue 후 worker 완료를 await하지 않은 채 DB를 재조회할 경우 발생할 수 있는 TOCTOU 윈도우다. `QueueEvents.waitUntilFinished`로 worker 완료를 동기적으로 기다리는 기존 `refreshViaQueue` 패턴이 `refreshTokenViaQueue`를 경유해도 동일하게 적용되는지 확인이 필요하다. `mcpDiagnosticsAcc` 배열의 로컬 변수 격리와 BullMQ `jobId` dedup 설계는 경쟁 조건을 잘 방어하고 있으며, scanner의 enqueue 실패 처리(warn-only)도 스펙에 명시된 의도적 정책이다. 전반적으로 동시성 설계는 견고하나, `tryRecoverExpired`의 re-read 타이밍 보장 여부를 명확히 검증할 것을 권장한다.

### 위험도

LOW
