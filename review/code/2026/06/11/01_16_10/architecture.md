# Architecture Review

## 발견사항

### 발견사항 1
- **[INFO]** `isRefreshCapable` 일반화 — OCP·확장성 개선
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` (파일 하단 함수)
  - 상세: `isCafe24RefreshCapable` (cafe24 하드코딩) 를 `isRefreshCapable` (cafe24·makeshop 공통 판별)로 리팩토링했다. 신규 provider 추가 시 이 함수 내부에 `service_type` 조건 한 줄만 추가하면 되는 개방-폐쇄 원칙에 부합하는 확장 지점이다. 현재는 문자열 비교 `!== 'cafe24' && !== 'makeshop'` 방식이라 새 provider 추가 시 함수 본체를 수정해야 하지만, 변경 범위가 명확히 한 곳으로 집중돼 있어 실질적인 문제는 아니다.
  - 제안: provider 목록이 3개 이상으로 늘어날 시점에 `REFRESH_CAPABLE_PROVIDERS: ReadonlySet<string>` 상수로 추출하면 함수 본체 수정 없이 집합에만 추가하는 완전한 OCP 형태로 발전 가능. 현재 규모에서는 현행 방식으로 충분.

### 발견사항 2
- **[INFO]** `IntegrationExpiryScannerService` — 단일 책임 부담 수용 가능 범위
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`, `IntegrationExpiryScannerService` 클래스 전체
  - 상세: 이 서비스는 (a) BullMQ job 라우팅(`process` switch), (b) 만료 알림 스캔(`run`), (c) pending_install TTL 만료(`expirePendingInstalls`), (d) 사용 로그 정리(`pruneUsageLogs`), (e) Cafe24 백그라운드 갱신 enqueue(`enqueueCafe24BackgroundRefresh`), (f) 스케줄러 등록(`onModuleInit`) 을 모두 담당한다. 다수 책임이 집중돼 SRP 관점에서 분리 후보이나, 이들이 모두 동일 BullMQ 큐(`INTEGRATION_EXPIRY_QUEUE`)의 job 처리자로 묶여 있고 각 메서드가 독립적으로 테스트 가능하게 구성되어 있어 현재 코드베이스 규모에서 실질적 응집도 문제는 없다. 본 PR 변경 자체가 이 구조를 악화시키지는 않는다.
  - 제안: job 처리 분산이 필요한 규모로 성장하면 pass 별로 별도 서비스(`ConnectedExpiryPassService` 등)로 분리하는 것을 고려할 수 있으나 현 단계에서는 강제할 이유 없음.

### 발견사항 3
- **[INFO]** 레이어 책임 분리 — `isRefreshCapable` 의 위치 적절
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` (모듈-프라이빗 함수)
  - 상세: `isRefreshCapable` 이 서비스 파일 하단의 모듈-프라이빗 함수로 배치되어 있다. 이 판별 로직은 도메인 규칙(어떤 통합이 자동 갱신 가능한가)에 해당하므로 별도 도메인 파일로 추출하는 방법도 있으나, 현재 소비처가 `IntegrationExpiryScannerService` 단일이므로 현위치가 합리적이다.
  - 제안: 향후 다른 서비스(예: `Cafe24TokenRefreshProcessor`, MCP bridge)에서도 동일 판별이 필요해지면 `integration.utils.ts` 또는 `integration.domain.ts`로 추출해 중복 정의를 방지할 것. 현재는 단일 소비처이므로 현행 유지.

### 발견사항 4
- **[INFO]** `integration-status-reason.ts` — 허용값 집합 단일 진실 원칙 준수
  - 위치: `codebase/backend/src/modules/integrations/integration-status-reason.ts`
  - 상세: `token_expired` 를 `INTEGRATION_STATUS_REASONS` const 배열에 추가해 TypeScript union 타입으로 소비하는 구조다. 허용값 집합을 한 곳에서 관리하고, 미분류 값을 `normalizeStatusReason` 함수로 `unknown_error` 로 정규화하는 패턴은 데이터 레이어와 UI 레이어 간 계약이 단일 진실(SoT)로 관리됨을 보여준다. 모듈 경계가 명확하다.
  - 제안: 없음.

### 발견사항 5
- **[INFO]** `MONITORED_QUEUES` 레지스트리 — 큐 추가 시 3곳 동기화 필요 (수동 규약)
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/test/system-status.e2e-spec.ts`, `codebase/backend/src/modules/system-status/system-status.constants.spec.ts`
  - 상세: 큐 추가 시 (1) `system-status.constants.ts` `MONITORED_QUEUES`, (2) `test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES`, (3) spec `data-flow/0-overview.md §4` 세 곳을 수동으로 동기화해야 한다. `EXPECTED_QUEUE_NAMES` 가 앱 소스를 import 하지 않는 이유(전이적 모듈 로드 실패)가 주석으로 명시되어 있어 의도적 중복임은 파악된다. 이번 PR은 `system-status.constants.spec.ts` 신설로 단위 테스트 수준의 동기화 검증을 추가해 이 취약 지점을 보강했다.
  - 제안: 현행 3-way 수동 동기화 규약이 유지될 것이라면 `system-status.constants.ts` 주석의 동기화 의무 설명이 이미 존재하므로 현행 유지 가능. 장기적으로는 e2e spec 이 `MONITORED_QUEUES`를 직접 import 가능하도록 모듈 의존 그래프를 정리하는 것이 이상적.

### 발견사항 6
- **[INFO]** cafe24 전용 큐 enqueue 코드가 `run()` 메서드 안에 중복 존재
  - 위치: `integration-expiry-scanner.service.ts` — `run()` 메서드 내 0d 분기 (라인 855~880) 와 `enqueueCafe24BackgroundRefresh()` (별도 메서드)
  - 상세: cafe24 enqueue 로직(jobId dedup 옵션 포함)이 `run()` 내부와 `enqueueCafe24BackgroundRefresh()` 에 각각 구현되어 있다. 두 경로 모두 `source: 'background'`, `jobId: integration.id`, `attempts: 1`, `removeOnComplete/Fail: { age: 60/300 }` 동일 옵션을 사용한다. 이번 PR 변경 자체가 이 중복을 유발하지는 않았으나(기존부터 분리 존재) 향후 enqueue 옵션 변경 시 두 곳을 동시에 수정해야 하는 결합이 남는다.
  - 제안: 허용 범위의 중복이나, 향후 옵션 변경 빈도가 높아지면 `enqueueCafe24RefreshSingle(integrationId: string, source: string): Promise<void>` 추출을 고려.

### 발견사항 7
- **[INFO]** 테스트 헬퍼 추출 (`getNotifResourceIds`, `hasSavedExpired`) — 테스트 레이어 응집도 개선
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts`
  - 상세: 반복되는 mock 검증 패턴을 헬퍼 함수로 추출해 테스트 코드의 응집도와 가독성을 높였다. 특히 기존 이중 `.flat()` 패턴이 미호출 시 false negative 를 숨기던 약점을 드러내는 형태로 헬퍼를 설계한 점이 테스트 설계 관점에서 올바르다.
  - 제안: 없음.

---

## 요약

이번 PR의 핵심 변경(`isCafe24RefreshCapable` → `isRefreshCapable` 일반화, `token_expired` status_reason 추가, passive 알림 제외 범위 확장, `MAKESHOP_REFRESH_QUEUE` 레지스트리 등록)은 아키텍처 관점에서 모두 긍정적이다. 기존 cafe24 전용으로 하드코딩된 판별 함수가 일반화됨으로써 개방-폐쇄 원칙이 개선됐고, status_reason union을 단일 상수 파일에서 관리하는 구조가 유지됐으며, 모듈 경계와 레이어 책임도 기존 구조를 그대로 따른다. `system-status.constants.spec.ts` 신설로 큐 레지스트리 동기화의 수동 의무를 단위 테스트로 보강한 점도 architecture smell(3-way 수동 동기화)의 실질적 완화책이다. cafe24 enqueue 로직의 미세한 코드 중복과 `IntegrationExpiryScannerService`의 다중 책임은 현 규모에서 허용 범위이며 본 PR이 기존 상태를 악화시키지는 않는다. 전체적으로 구조적 문제 없이 안전하고 적절한 변경이다.

## 위험도

NONE
