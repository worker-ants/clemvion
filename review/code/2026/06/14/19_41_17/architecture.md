# Architecture Review

## 발견사항

### [INFO] 큐 이름 상수 분리 — 의존성 역전 개선
- 위치: `terminal-revoke-reconciler.types.ts` (신규), `terminal-revoke-reconciler.service.ts` 변경, `external-interaction.module.ts` 변경, `system-status.constants.ts` 변경
- 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 서비스 구현 파일에서 전용 types 파일로 이동했다. 이전에는 `system-status.constants.ts`(모니터링 레지스트리)가 `terminal-revoke-reconciler.service.ts`를 직접 임포트해야 했는데, 이는 cross-module 의존성에서 구현 파일까지 끌고 오는 불필요한 결합이었다. 분리 후 모니터링 모듈은 타입/상수 파일만 참조하고, 서비스 구현은 독립적으로 변경 가능해진다. `notification-dispatcher.types` 패턴과도 일관된다.
- 제안: 현재 방향이 올바르다. 향후 `INTEGRATION_EXPIRY_QUEUE`, `SCHEDULE_QUEUE`, `LOGIN_HISTORY_PRUNER_QUEUE` 등 아직 서비스 파일에서 직접 임포트되는 나머지 큐 상수들도 같은 패턴으로 분리하면 `system-status.constants.ts`의 의존성 방향이 일관성을 갖게 된다.

### [INFO] Swagger 데코레이터 래퍼 도입 — 표현 레이어 추상화
- 위치: `interaction.controller.ts` 변경 (`ApiAcceptedWrappedResponse`, `ApiOkWrappedResponse`)
- 상세: `@ApiAcceptedResponse`, `@ApiOkResponse` 직접 사용에서 프로젝트 공통 래퍼 데코레이터로 교체했다. 컨트롤러 레이어가 응답 envelope 세부사항을 직접 다루는 대신 추상화된 데코레이터를 사용해 Swagger 문서와 실제 응답 구조 간의 일관성 보장 책임을 중앙화했다.
- 제안: 래퍼 데코레이터가 실제 응답 envelope 구조와 동기화 상태를 유지하는지 지속적으로 확인할 것. 래퍼가 실제 타입 변환까지 수행한다면 컨트롤러와 래퍼 구현 사이 계약이 명확히 문서화되어야 한다.

### [INFO] InteractionTokenService의 다중 책임 — 현 규모에서 허용 가능
- 위치: `interaction-token.service.ts` 전체
- 상세: 서비스가 (1) iext JWT 발급/검증/갱신, (2) itk opaque 토큰 발급/검증, (3) Redis blacklist 관리, (4) ExecutionToken DB 영속 추적, (5) terminal revoke reconcile sweep 5가지 책임을 가진다. SRP 관점에서 다소 넓어 보이나, 모든 기능이 "인터랙션 토큰 라이프사이클"이라는 단일 도메인 개념으로 응집되어 있고 `TerminalRevokeReconcilerService`가 BullMQ 어댑터 책임을 분리해 위임 구조를 유지하므로 현재 규모에서는 허용 범위 내에 있다.
- 제안: `reconcileTerminalRevocations` 로직이 향후 더 복잡해질 경우 별도 `InteractionTokenReconcileService`로 분리를 고려할 것.

### [INFO] `refreshPerExecution`의 이중 JWT 파싱 — 추상화 경계 미세 누수
- 위치: `interaction-token.service.ts` `refreshPerExecution` 메서드
- 상세: `verifyPerExecution`을 호출한 후 `exp` 추출을 위해 `verify`를 한 번 더 호출한다. `verifyPerExecution`이 `exp` 값을 결과로 반환하지 않는 추상화 경계 때문에 같은 JWT를 두 번 파싱하는 구조가 생겼다. 성능 영향은 무시할 수준이나, 내부 추상화 경계가 소비자의 필요와 정확히 맞지 않음을 보여준다.
- 제안: `VerifyResult`에 `exp?: number` 필드를 추가하거나 내부 JWT 파싱 결과를 공유하는 private 헬퍼를 도입할 수 있다. 긴급하지 않으나 경계를 정리할 기회가 생기면 개선할 것.

### [INFO] `system-status.constants.ts`의 큐 임포트 불일치 잔존
- 위치: `system-status.constants.ts` 임포트 섹션
- 상세: 이번 변경에서 `TERMINAL_REVOKE_RECONCILE_QUEUE`는 types 파일로 분리했으나, `INTEGRATION_EXPIRY_QUEUE`(`integration-expiry-scanner.service`), `SCHEDULE_QUEUE`(`schedule-runner.service`), `LOGIN_HISTORY_PRUNER_QUEUE`(`login-history-pruner.service`)는 여전히 서비스 구현 파일에서 직접 임포트된다. 패턴이 일관되지 않아 모듈 경계가 불분명하다.
- 제안: 이번 변경 범위를 벗어나므로 즉시 수정 대상은 아니다. 향후 tech debt 항목으로 추적해 단계적으로 통일할 것을 권장한다.

---

## 요약

이번 변경의 핵심은 큐 이름 상수를 서비스 구현 파일에서 전용 types 파일로 분리해 cross-module 결합도를 낮추고(`terminal-revoke-reconciler.types.ts` 신규), Swagger 응답 데코레이터를 래퍼로 추상화해 컨트롤러 레이어의 표현 일관성을 높이며(`interaction.controller.ts`), JWT 기본 시크릿을 하드코딩 리터럴에서 ephemeral random으로 대체해 보안 위생을 개선한 것(`DEV_EPHEMERAL_SECRET`)이다. 모든 변경이 SRP와 DIP를 개선하는 방향이며, `TerminalRevokeReconcilerService`가 BullMQ 어댑터만 담당하고 `InteractionTokenService`가 도메인 로직을 담당하는 레이어 책임 분리도 명확히 유지된다. `system-status.constants.ts`에 나머지 큐 임포트 불일치가 잔존하지만 이번 변경 범위를 벗어난 점진적 개선 대상이며, 아키텍처적 위험 요소는 없다.

## 위험도

LOW
