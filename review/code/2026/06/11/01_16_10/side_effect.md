# Side Effect Review

## 발견사항

### **[INFO]** `isCafe24RefreshCapable` → `isRefreshCapable` 함수 리네임 — 파일 스코프 변경
- 위치: `integration-expiry-scanner.service.ts` 하단 module-level 함수
- 상세: `isCafe24RefreshCapable` 이 `isRefreshCapable` 로 리네임됐다. 두 함수 모두 모듈 파일 내부 private 함수(`export` 없음)이므로 외부 호출자가 없다. 리네임이 서비스 내부에서만 사용되므로 외부 인터페이스 영향 없음.
- 제안: 해당 없음.

### **[INFO]** `integration.statusReason = null` → `'token_expired'` 상태 변경 — DB 쓰기 부작용 변경
- 위치: `integration-expiry-scanner.service.ts`, `run()` 메서드
- 상세: 기존에는 0d 격하 시 `statusReason = null` 이었으나 이제 `'token_expired'` 로 변경된다. 이는 **의도된** DB 쓰기 부작용 변경이며 `INTEGRATION_STATUS_REASONS` union 에도 새 값이 추가됐다. 기존 `statusReason=null` 인 `expired` 행이 DB 에 남아 있을 수 있으나, 스캐너가 `status NOT IN (expired, error, pending_install)` 필터로 이미 expired 인 행을 재처리하지 않으므로 과거 행에 소급 적용되지 않는다. 새 격하 행만 `token_expired` 로 기록된다.
- 제안: 해당 없음 (의도된 변경, 이미 plan 문서에 명시됨).

### **[INFO]** `INTEGRATION_STATUS_REASONS` 배열 확장 — 공유 상수 변경
- 위치: `integration-status-reason.ts`
- 상세: `INTEGRATION_STATUS_REASONS` 는 `as const` 배열이고 `IntegrationStatusReason` 타입의 단일 진실이다. `'token_expired'` 를 추가하면 이 배열에 의존하는 모든 타입 파생(`IntegrationStatusReason`, `STATUS_REASON_SET`)이 자동 갱신된다. `normalizeStatusReason` 함수는 Set 기반 lookup 이므로 새 값을 자동 수용한다. 파괴적 변경 없음 — union 확장은 하위 호환이다.
- 제안: 해당 없음.

### **[INFO]** `MONITORED_QUEUES` 배열에 `MAKESHOP_REFRESH_QUEUE` 추가 — 모니터링 대상 큐 확장
- 위치: `system-status.constants.ts`
- 상세: `MONITORED_QUEUES` 는 `readonly` 배열 상수다. 항목 추가는 `SYSTEM_STATUS_QUEUE_NAMES` 파생, BullModule 등록, DI factory 모두에 자동 반영된다. 이미 시스템에 등록된 `makeshop-token-refresh` 큐가 단지 모니터링에 누락돼 있었던 것을 추가한 것이다. 기존 큐 이름·순서가 보존되어 다른 큐 항목에 영향 없음. `MONITORED_QUEUE_HANDLES` DI 토큰을 통해 주입받는 소비자(예: `SystemStatusService`)는 BullMQ Queue 인스턴스를 배열로 처리하므로 순서 의존성이 없다. e2e 테스트의 `EXPECTED_QUEUE_NAMES` 도 함께 갱신됐다.
- 제안: 해당 없음.

### **[WARNING]** `isRefreshCapable` 로 인한 알림 발사 동작 제거 — 기존 행동의 묵시적 부작용 제거
- 위치: `integration-expiry-scanner.service.ts`, `run()` 메서드 내 루프, refresh-capable 분기
- 상세: 기존 코드는 cafe24 + refresh_token 보유 행이 7d/3d 임계에 진입할 때 `claimThreshold` 로 `integration_expiry_dispatch` 에 claim 을 생성하고 `notificationsService.createMany` 로 알림을 발사하고 있었다. 새 코드는 `isRefreshCapable` 이 true 이면 `continue` 로 claim·격하·알림 전체를 건너뛴다. 이는 명백히 의도된 §11.2 정책 변경이지만, **이미 발사된 알림**은 그대로 DB 에 잔존한다. 또한 기존에 이미 claim 이 생성된 행(기발사 임계 dedup 행)이 `integration_expiry_dispatch` 에 남아 있어도 스캐너는 더 이상 그 행에 접근하지 않으므로 orphan claim 이 쌓인다. orphan claim 자체는 정리 쿼리가 없으나 기능적 부작용(재발사·격하)은 없다.
- 제안: 현재 기능 안전성은 문제없다. 장기적으로 `integration_expiry_dispatch` 에 refresh-capable 행의 orphan claim 이 쌓이는 것을 방지하려면 별도 prune 패스를 고려할 수 있으나, 본 변경의 범위 밖이다.

### **[INFO]** 테스트 파일 헬퍼 함수 `getNotifResourceIds` / `hasSavedExpired` — 테스트 스코프 부작용 없음
- 위치: `integration-expiry-scanner.service.spec.ts` 모듈 스코프
- 상세: 두 헬퍼 함수는 테스트 파일의 module scope 에 선언됐으나 `describe` 블록 밖이다. Jest 는 테스트 파일별로 격리된 모듈 스코프를 사용하므로 다른 테스트 파일에 영향 없다. 두 함수는 순수 함수(mock 객체 읽기 전용, 어떤 상태도 쓰지 않음)이므로 테스트 간 상태 누수 없음.
- 제안: 해당 없음.

### **[INFO]** spec·plan 문서 변경 — 코드 부작용 없음
- 위치: `spec/` 하위 md 파일, `plan/` 하위 md 파일
- 상세: 순수 문서 변경이므로 런타임 부작용 없음. `spec/2-navigation/4-integration.md`, `spec/data-flow/5-integration.md`, `spec/1-data-model.md`, `spec/data-flow/8-notifications.md`, `spec/4-nodes/4-integration/4-cafe24.md` 는 모두 서술 문서다.
- 제안: 해당 없음.

---

## 요약

이번 변경에서 의도하지 않은 부작용은 식별되지 않았다. 주요 런타임 부작용은 모두 명시적으로 의도된 것들이다: (1) refresh-capable provider(cafe24·makeshop + refresh_token)가 `expired` 격하·passive `integration_expired` 알림 대상에서 제외되고, (2) refresh_token 없는 provider의 0d 격하 시 `statusReason='token_expired'`가 DB에 기록된다. `isCafe24RefreshCapable` → `isRefreshCapable` 리네임은 파일 내부 private 함수로 외부 시그니처 영향이 없고, `INTEGRATION_STATUS_REASONS` union 확장·`MONITORED_QUEUES` 항목 추가 모두 하위 호환 변경이다. 유일하게 언급할 잠재적 상태는 기존에 refresh-capable 행에 대해 이미 생성된 `integration_expiry_dispatch` claim 이 orphan으로 잔존하는 것이나, 이는 기능적 부작용이 아니며 현재 변경 범위 내에서 적절히 처리되고 있다.

## 위험도

LOW
