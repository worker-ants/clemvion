# 부작용(Side Effect) 리뷰 — 최근 ~50 커밋 (main bbd838ef)

## 발견사항

- **[WARNING]** `Cafe24InstallNonceCache`: 독립 Redis 연결 생성 — 공유 연결 미사용
  - 위치: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts:43-65` (커밋 `82dd420a`)
  - 상세: 서비스가 `configService.get('redis.password')` 와 `configService.get('redis.tls')` 를 읽어 별도 `new Redis(...)` 를 생성한다. 그러나 `codebase/backend/src/common/config/redis.config.ts` 는 `host` / `port` 만 등록하며, `redis.password` 와 `redis.tls` 키는 정의되지 않아 항상 `undefined` 반환이다. 같은 Redis 인스턴스를 공유해야 하는 BullMQ(`BullModule.forRootAsync`) 와 `cafe24RefreshQueueEventsProvider` 도 `host/port` 만 사용한다. 현재 인프라에서는 무인증 Redis 이므로 동작상 문제가 없지만, 운영 환경에서 인증/TLS Redis 를 도입할 경우 NonceCache 연결만 제대로 구성되지 않아 `graceful degradation`(noop) 으로 폴백되고 replay 방어가 무음으로 비활성화된다.
  - 제안: `redisConfig` 에 `password` / `tls` 키를 추가하거나, BullMQ 와 동일한 공유 ioredis 인스턴스를 DI 토큰(`CAFE24_INSTALL_NONCE_REDIS`)으로 제공하는 팩토리를 모듈에 추가한다. 단기적으로는 `redis.config.ts` 에 `REDIS_PASSWORD` / `REDIS_TLS` 환경변수 매핑만 추가해도 충분하다.

- **[WARNING]** `Cafe24InstallNonceCache.close()`: NestJS 라이프사이클 훅 미등록으로 연결 누수 가능
  - 위치: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts:115-121` (커밋 `82dd420a`)
  - 상세: 서비스가 생성자에서 독립 `ioredis` 인스턴스를 직접 생성하지만 `OnModuleDestroy` 인터페이스를 구현하지 않는다. `close()` 메서드는 존재하지만 NestJS 의 모듈 종료 시 자동 호출되지 않는다. 애플리케이션 정상 종료 시 해당 Redis 연결이 `QUIT` 없이 끊겨 Redis 서버 측에 orphan 커넥션이 남을 수 있다. 같은 패턴으로 커넥션을 직접 관리하는 `ContinuationBusService` 와 `cafe24RefreshQueueEventsProvider` 는 각각 `OnModuleDestroy` 와 `onApplicationShutdown` 을 구현해 명시 close 를 보장한다.
  - 제안: `implements OnModuleDestroy` 를 추가하고 `async onModuleDestroy() { await this.close(); }` 를 구현한다.

- **[WARNING]** `NotificationsService.hasRecentByResource`: 신규 공개 메서드가 기존 테스트 모의(mock) 에서 누락될 위험
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:117-138` (커밋 `91c30dcd`)
  - 상세: `hasRecentByResource` 는 `NotificationsService` 의 신규 공개 메서드다. `background-execution.processor.spec.ts`, `alerts-evaluator.service.spec.ts` 등 기존 테스트가 `NotificationsService` 를 `{ createMany: jest.fn() }` 처럼 부분 모의한다. 이들 테스트가 `hasRecentByResource` 를 호출하는 코드 경로를 통과할 경우 `TypeError: notificationsService.hasRecentByResource is not a function` 이 발생할 수 있다. 현재 해당 메서드를 호출하는 코드(`IntegrationActionRequiredNotifier`)는 별도 모듈이고 각 spec 의 테스트 범위 밖이어서 즉각적인 런타임 충돌은 없지만, 향후 이 메서드가 공유 서비스의 다른 경로에서 호출되면 숨어 있는 mock 누락이 테스트 실패로 이어진다.
  - 제안: `createMany` 만 선언된 기존 mock 객체들에 `hasRecentByResource: jest.fn().mockResolvedValue(false)` 를 추가하거나, `jest.createMockFromModule` / NestJS `Test.createTestingModule` 방식으로 전환해 메서드 추가 시 자동 반영되도록 한다.

- **[WARNING]** `isIntegrationOAuthStubEnabled` vs `main.ts` 가드: staging 환경 보호 불일치
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:66-70` + `codebase/backend/src/main.ts:27-35` (커밋 `b8dc94e7`)
  - 상세: `main.ts` 의 부트 가드는 `NODE_ENV === 'production'` 일 때만 `OAUTH_STUB_MODE=true` 를 차단한다. 반면 `isIntegrationOAuthStubEnabled()` 는 `test | development` 만 허용(`staging` 미포함)하므로 두 가드의 의미가 다르다. `NODE_ENV=staging` 으로 배포된 환경에서 `OAUTH_STUB_MODE=true` 가 설정되면: main.ts 부트 가드는 통과하지만 `isIntegrationOAuthStubEnabled` 는 false 를 반환해 stub 이 비활성화된다. 이 동작 자체는 안전하나, 동일 환경 변수에 대해 두 곳이 서로 다른 허용 목록을 정의하고 있어 코드 독해 시 혼란을 유발하고 미래에 한 쪽만 수정될 경우 불일치가 보안 회귀로 이어질 수 있다. `auth-oauth.service.ts` 의 `isOAuthStubEnabled` 도 동일한 로직이며 세 번째 중복 포인트가 된다.
  - 제안: `isStubModeAllowed()` 를 공통 유틸(`common/utils/oauth-stub.ts`)로 추출해 단일 진실로 만들고, `main.ts` 가드도 같은 함수를 사용한다.

- **[INFO]** `logUsage` swallow: 진단 데이터 손실이 무음 처리됨
  - 위치: `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:85-100` (커밋 `d6baf89a`)
  - 상세: `logUsage` 실패(DB 다운 등)를 `logger.warn` 으로만 처리하고 삼키는 변경이 도입됐다. 의도 자체는 명확하나(노드 실행 보호 우선), 모든 핸들러(`send-email`, `database-query`, `http-request`, `cafe24`)가 기반 클래스를 공유하므로 DB 장애 시 해당 기간의 사용 로그 전체가 조용히 누락된다. 현재는 warn 로그 외에 메트릭/알림 경로가 없어 운영 관측성이 저하된다.
  - 제안: warn 로그 외에 구조화된 메트릭 카운터(예: Prometheus `integration_log_usage_failures_total`)를 추가하거나, 적어도 장애 기간 후 수동 확인을 위한 운영 가이드를 스펙에 명시한다.

- **[INFO]** 알림 타입 `integration_action_required`: 프론트엔드 UI 처리 미반영
  - 위치: `codebase/backend/src/modules/integrations/integration-action-required-notifier.service.ts` (커밋 `91c30dcd`)
  - 상세: 백엔드에 새 알림 타입이 신설됐으나, 프론트엔드 코드에서 이 타입 값을 처리하는 switch/분기가 없다. 알림 목록 UI 가 타입 불문 렌더링(제목+메시지 표시)이라면 무해하지만, 알림 아이콘·뱃지 색상·CTA 링크 등을 타입별로 분기한다면 `integration_action_required` 는 기본값으로 폴백된다. 커밋 메시지에도 "defer frontend UI follow-up" 이 명시되어 있어 의도적 보류임은 확인됐다.
  - 제안: 프론트엔드 알림 렌더러에서 `integration_action_required` 타입에 대한 아이콘/링크 분기를 추가하는 후속 태스크를 백로그에 명시적으로 등록한다.

- **[INFO]** `CAFE24_MALL_ID_PATTERN` 정규식: 프론트엔드·백엔드·DTO 세 곳에 분산 존재
  - 위치: `codebase/frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts:30`, `codebase/backend/src/modules/integrations/integration-oauth.service.ts:59`, `codebase/backend/src/modules/integrations/dto/integration.dto.ts:271` (커밋 `bb038f90`)
  - 상세: 정규식 `/^[a-z0-9-]{3,50}$/` 이 프론트엔드 훅, 백엔드 서비스 모듈 수준 상수, DTO `@Matches` 데코레이터 세 곳에 각각 하드코딩되어 있다. 모두 동일한 값이지만 단일 진실이 없다. 패턴 변경 시 세 곳을 동시에 갱신해야 한다.
  - 제안: 백엔드 공통 상수(`common/constants/cafe24.ts`)로 추출해 DTO 와 서비스 모두 import 하고, 프론트엔드는 현재처럼 훅에서 export 해 page.tsx 가 import 하는 구조를 유지한다(cross-repo 공유는 별도 패키지화 필요).

## 요약

최근 50 커밋은 cafe24 통합 영역에 집중된 보안 강화·동시성 수정·알림 타입 신설 작업으로 구성되어 있다. 주요 부작용 위험은 두 곳으로 압축된다. 첫째, `Cafe24InstallNonceCache` 가 자체 ioredis 연결을 생성하되 NestJS `OnModuleDestroy` 를 구현하지 않아 종료 시 연결 누수가 발생하며, `redis.config.ts` 에 `password/tls` 키가 없어 인증 Redis 도입 시 replay 방어가 무음으로 비활성화될 수 있다. 둘째, `OAUTH_STUB_MODE` 가드 로직이 `main.ts`, `auth-oauth.service.ts`, `integration-oauth.service.ts` 세 곳에 미묘하게 다른 허용 목록으로 중복되어 있어 단일 수정 실수가 보안 회귀를 유발할 수 있다. `NotificationsService.hasRecentByResource` 신규 공개 메서드는 기존 부분 mock 테스트에서 누락될 경우 런타임 오류로 이어질 수 있다. 나머지 변경(signature 변경·시그니처 일관성·이벤트 emit) 은 모두 `@Optional` 주입으로 backward-compat 이 잘 보장되어 있고, 호출처 영향이 확인된 범위 내에서 올바르게 갱신되었다.

## 위험도

MEDIUM
