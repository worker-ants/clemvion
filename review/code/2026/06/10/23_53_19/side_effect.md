### 발견사항

- **[WARNING]** `isRefreshCapable` 은 refresh-capable provider 전체에 대해 `claimThreshold` 를 건너뜀 — 7d/3d 알림 dedup 레코드 미생성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` — `run()` 내 `isRefreshCapable` 분기 (`continue` 전에 `claimThreshold` 미호출)
  - 상세: 변경 전 코드는 0d 에서만 cafe24 enqueue 분기로 진입하고 나머지 임계(7d, 3d) 는 공통 `claimThreshold` → 알림 경로를 탔다. 변경 후에는 `isRefreshCapable` 이 `true` 이면 `threshold` 값에 무관하게 즉시 `continue` 하므로, `integration_expiry_dispatch` 에 7d/3d claim 레코드가 전혀 생성되지 않는다. 이는 의도된 §11.2 동작이나, 향후 refresh-capable provider 가 알림을 재활성화할 경우(예: spec §11.2 재정의) `0d claim` 레코드 없이 0d 진입이 재발 가능한 잠재적 일관성 갭이다. 또한 `integration_expiry_dispatch` 테이블의 데이터가 refresh-capable 통합에 대해 영구적으로 비어 있어 운영 진단 단서가 사라진다.
  - 제안: 의도적 동작이라면 코드 주석에 "refresh-capable 은 dedup claim 을 생성하지 않음" 을 명시해 미래 수정 시 회귀를 방지한다.

- **[INFO]** `integration.statusReason` 에 `null` 대신 `'token_expired'` 를 할당하는 변경으로 기존에 `statusReason = null` 로 저장된 만료 레코드와 값 불일치가 발생함
  - 위치: `integration-expiry-scanner.service.ts` 라인 `integration.statusReason = 'token_expired'`
  - 상세: 이전 스캐너는 `statusReason = null` 을 설정했으므로 DB 에는 `status='expired', status_reason IS NULL` 레코드가 존재한다. 신규 만료 레코드는 `status_reason='token_expired'` 로 기록된다. 이는 의도된 개선이지만 API 응답·프론트엔드 UI 가 `status_reason=null` 과 `status_reason='token_expired'` 를 동일하게 처리하지 않으면 기존 레코드 표시가 달라진다. 코드 변경 자체의 부작용은 아니나 하위 소비자의 `null` 처리 경로가 여전히 유효해야 함.
  - 제안: `null` → `token_expired` 마이그레이션 스크립트 또는 API 응답 레이어에서 `null` → `'token_expired'` 정규화를 검토한다.

- **[INFO]** `MONITORED_QUEUES` 에 `MAKESHOP_REFRESH_QUEUE` 추가로 `BullModule.registerQueue` 에 해당 큐가 등록돼 있어야 Redis 연결 실패 없이 동작함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/src/modules/system-status/system-status.constants.ts` — `MONITORED_QUEUES` 배열
  - 상세: `SYSTEM_STATUS_QUEUE_NAMES` 는 `MONITORED_QUEUES` 에서 파생되어 `BullModule.registerQueue` DI에 주입된다. `MAKESHOP_REFRESH_QUEUE` 가 모듈 등록에 이미 포함돼 있으면 문제없지만, 등록 누락 시 `SystemStatusService` 가 해당 큐 핸들을 가져오려 할 때 런타임 에러가 발생한다. 본 diff 만으로는 `IntegrationsModule` 또는 `AppModule` 의 `BullModule.registerQueue` 에 해당 큐가 포함됐는지 확인할 수 없다.
  - 제안: `makeshop-token-refresh.module.ts` 또는 상위 모듈에서 `BullModule.registerQueue({ name: MAKESHOP_REFRESH_QUEUE })` 가 선행 등록됐는지 확인한다.

- **[INFO]** `isCafe24RefreshCapable` → `isRefreshCapable` 함수명 변경은 모듈 내부 private 함수이므로 외부 공개 API 영향 없음
  - 위치: `integration-expiry-scanner.service.ts` — 파일 하단 module-scope 함수
  - 상세: `isCafe24RefreshCapable` 은 export 되지 않은 module-scope 함수였으므로 함수명 변경이 외부 호출자에게 영향을 주지 않는다. 단, 테스트 파일이 이 함수를 직접 참조하지 않고 서비스의 `run()` 동작으로만 간접 검증하므로 시그니처 변경 영향 없음.

- **[INFO]** `INTEGRATION_STATUS_REASONS` 배열에 `'token_expired'` 추가 — `STATUS_REASON_SET` 은 모듈 로드 시 `new Set(...)` 으로 생성되므로 전역 공유 상태로 읽힘
  - 위치: `integration-status-reason.ts` — `STATUS_REASON_SET` 상수
  - 상세: `STATUS_REASON_SET` 은 `ReadonlySet` 으로 모듈 레벨 싱글톤이다. `'token_expired'` 를 추가함으로써 `normalizeStatusReason('token_expired')` 가 이제 `'token_expired'` 를 그대로 반환한다(이전에는 `'unknown_error'` 로 정규화). 이는 의도된 변경이며 부작용 없음. 단, `normalizeStatusReason` 의 `'unknown_error'` 경보에 의존하던 모니터링·알림이 있다면 `'token_expired'` 케이스가 그 경보를 더 이상 트리거하지 않는다.

### 요약

이번 변경에서 의도치 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 읽기/쓰기, 네트워크 호출 추가, 이벤트/콜백 체계 변경은 없다. 핵심 부작용 위험은 두 가지다: (1) `isRefreshCapable` 분기에서 refresh-capable provider 의 7d/3d claim 레코드를 전혀 생성하지 않는 것이 §11.2 의 의도인지 명확하지 않아 미래 기능 변경 시 dedup 레코드 부재 회귀 위험이 있고, (2) 기존 `status_reason=null` 만료 레코드와 신규 `status_reason='token_expired'` 레코드가 혼재해 소비자 레이어가 양쪽을 처리해야 한다. `MONITORED_QUEUES` 에 `MAKESHOP_REFRESH_QUEUE` 추가는 상위 모듈의 큐 등록 여부에 따라 런타임 에러로 이어질 수 있으나 이는 독립적인 기존 등록 확인 사항이다. 전체적으로 변경이 모듈 경계 내에 잘 격리돼 있고, 공개 API 시그니처 변경 및 외부 서비스 호출 추가는 없다.

### 위험도

LOW
