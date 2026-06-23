# 동시성(Concurrency) 리뷰

## 발견사항

이번 변경은 NestJS 모듈 간 순환 의존(`forwardRef`) 해소를 위한 코드 이전 리팩터링이다. 비즈니스 로직 자체는 변경되지 않고 위치만 이동(behavior-preserving)했으므로, 동시성 관점에서 신규 위험을 도입하는 변경은 없다.

점검 결과를 아래에 서술한다.

### `ChatChannelTokenRotatorService` — BullMQ repeatable scheduler (파일 5)

- **[INFO]** `onModuleInit` 의 `upsertJobScheduler` 는 idempotent하며 Redis 중앙 등록 + BullMQ 워커 락으로 멀티 인스턴스에서 전역 1회 실행이 보장된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` `onModuleInit`
  - 상세: 주석에 "같은 ID 를 여러 번 등록해도 Redis 에 단일 repeatable entry 만 남아 멀티 인스턴스에서도 중복되지 않는다"고 명시되어 있다. 이는 `NotificationSecretRotatorService` 와 동일 패턴으로, 기존 코드베이스에서 이미 검증된 방식이다.
  - 제안: 이상 없음. 현 구조 유지.

- **[INFO]** `handleHourly` 는 예외를 swallow(`catch` 후 warn log)하며 재 throw 하지 않는다.
  - 위치: `chat-channel-token-rotator.service.ts` `handleHourly`
  - 상세: BullMQ `process` 에서 예외가 전파되지 않으므로 잡이 항상 성공 완료 처리된다. 이는 의도된 설계(주석 "process 가 에러를 swallow 해 잡이 항상 성공 종료")이며 `removeOnComplete` 정책과 일관적이다. 동시성 위험은 없다.
  - 제안: 이상 없음.

### `ChatChannelModule.onApplicationBootstrap` (파일 2)

- **[INFO]** `onApplicationBootstrap` 이 DB 쿼리를 실행한 후 `listenerRegistry.bulkRegister` 를 호출한다. 동 메서드는 단일 `async` 실행이며, NestJS 라이프사이클 훅에 의해 순차 실행된다. 공유 상태 접근에 대한 경쟁 조건 위험 없음.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` `onApplicationBootstrap`
  - 상세: 이 코드는 이번 변경에서 신규 추가된 것이 아니라 기존 코드가 그대로 유지된 것이다.
  - 제안: 이상 없음.

### forwardRef 제거 — DI 순환 해소 (파일 2, 8)

- **[INFO]** `forwardRef` 를 제거하고 단방향 일반 import 로 전환했다. `forwardRef` 자체는 동시성 문제와 무관하지만, 이를 제거함으로써 NestJS 부팅 시 DI 초기화 순서가 결정적(deterministic)이 되어 잠재적인 초기화 타이밍 불확실성이 해소된다.
  - 위치: `triggers.module.ts` (forwardRef 제거), `chat-channel.module.ts` (forwardRef 제거)
  - 상세: 이전에는 양방향 `forwardRef` 로 인해 NestJS가 런타임에 프록시를 통한 지연 해결을 수행해야 했으므로, 이론적으로 초기화 타이밍에 의존하는 코드는 위험할 수 있었다. 단방향화로 이 불확실성이 제거된 것은 동시성 관점에서 긍정적인 변경이다.
  - 제안: 이상 없음.

## 요약

이번 변경은 `chat-channel↔triggers` 양방향 `forwardRef` 순환 의존을 해소하는 구조 리팩터링이다. 비즈니스 로직은 변경되지 않았으며, 신규 도입된 `ChatChannelTokenRotatorService`는 기존 `NotificationSecretRotatorService`와 동일한 BullMQ repeatable scheduler 패턴을 따른다. Redis 중앙 등록으로 멀티 인스턴스 중복 실행이 방지되고, 예외 처리(swallow)도 의도된 설계다. `forwardRef` 제거로 DI 초기화 순서가 결정적이 되어 오히려 동시성 안전성이 소폭 개선되었다. 전반적으로 동시성 관련 신규 위험 없음.

## 위험도

NONE
