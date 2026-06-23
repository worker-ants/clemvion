# Performance Review — C-2 클러스터5 (chat-channel↔triggers forwardRef 순환 해소)

## 발견사항

- **[INFO]** `ChatChannelModule.onApplicationBootstrap` — DB 쿼리 범위 적절, 단 대규모 트리거 시 메모리 주의
  - 위치: `/codebase/backend/src/modules/chat-channel/chat-channel.module.ts` `onApplicationBootstrap` (라인 311-330)
  - 상세: `createQueryBuilder` 로 `is_active = true AND config.chatChannel IS NOT NULL` 인 트리거를 `id + config` 만 SELECT 하므로 불필요한 컬럼 적재는 없다. 이후 `for` 루프에서 provider 문자열을 추출해 `entries` 배열을 구성하고 `bulkRegister` 로 일괄 등록하는 흐름 — O(n) 이고 DB 왕복은 1회다. 다만 `trigger.config` 는 JSONB 전체를 메모리에 올리므로, 트리거 수가 수만 건이 되면 부팅 시 메모리 스파이크가 발생할 수 있다. 현재 규모에서는 무시 가능하나, 이는 이번 변경 전부터 존재하던 패턴이다(신규 도입 아님).
  - 제안: 장기적으로 `SELECT t.id, t.config->>'chatChannel'->>'provider' AS provider` 형태의 스칼라 프로젝션을 고려하면 JSONB 전체를 메모리에 적재하지 않아도 된다. 단, 이번 변경 범위 밖이고 기존 동작과 동일하므로 즉시 수정 불요.

- **[INFO]** `ChatChannelTokenRotatorService.onModuleInit` — `upsertJobScheduler` 는 부팅 시 Redis 호출 1회
  - 위치: `/codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 라인 822-838
  - 상세: `upsertJobScheduler` 는 멱등 Redis UPSERT 1회다. BullMQ 가 내부적으로 lua script 를 사용해 원자적으로 처리하므로 N+1 문제 없음. `NotificationSecretRotatorService` 와 동일 패턴이며 기존 코드와 동일한 비용 구조다.
  - 제안: 없음.

- **[INFO]** `ChatChannelTokenRotatorService.handleHourly` — 에러 swallow 설계는 의도적
  - 위치: `/codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 라인 844-858
  - 상세: catch 블록에서 예외를 삼키고 경고 로그만 남긴다. 이는 cleanup 실패가 다음 시간 재시도로 이어지도록 설계한 것이므로 성능 관점에서 문제없다. BullMQ 가 job 을 성공으로 처리해 `removeOnComplete` 정책이 적용되는 의도된 설계다.
  - 제안: 없음.

- **[INFO]** `triggers.module.ts` — BullMQ 큐 2개 등록 단일 `registerQueue` 호출
  - 위치: `/codebase/backend/src/modules/triggers/triggers.module.ts` 라인 1590-1593
  - 상세: `BullModule.registerQueue({ name: A }, { name: B })` 로 두 큐를 단일 호출로 등록한다. 이전에는 `chat-channel.module.ts` 에 큐가 분산됐으나 이제 `triggers.module.ts` 에 집중됐다. 모듈 수준 등록이므로 부팅 시 1회 비용이며 런타임 성능에 영향 없다.
  - 제안: 없음.

- **[INFO]** `TriggersController.rotateBotToken` — 동기 입력 검증 후 비동기 서비스 위임
  - 위치: `/codebase/backend/src/modules/triggers/triggers.controller.ts` 라인 1250-1261
  - 상세: `body.newBotToken` 에 대해 `!body?.newBotToken || typeof body?.newBotToken !== 'string'` 을 두 번 평가한다. `body?.newBotToken` optional chaining 이 중복이지만 컴파일 타임 상수이므로 런타임 비용 없음. 위임 이후 비용은 `TriggersService.rotateBotToken` 에 있어 이번 변경 범위 밖이다.
  - 제안: 없음.

- **[INFO]** `impl-anchor-existence.test.ts` — 테스트 시 파일 I/O 패턴
  - 위치: `/codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts` 라인 1804-1836
  - 상세: MDX 파일마다 `fs.readFileSync` 를 호출한다. 이는 테스트 전용 코드이고, 새로 추가된 코드가 아니라 기존 루프 내에서 anchor 파일 경로만 변경된 것이므로 성능 영향 없다.
  - 제안: 없음.

## 요약

이번 변경은 `chat-channel↔triggers` 양방향 `forwardRef` 순환을 단방향화하는 구조 리팩터링으로, 성능에 영향을 주는 새 알고리즘·쿼리·I/O 경로 도입이 없다. `ChatChannelTokenRotatorService` 와 큐 등록을 `chat-channel.module.ts` 에서 `triggers.module.ts` 로 이전했을 뿐 런타임 동작은 동일하며, `forwardRef` 제거로 NestJS DI 그래프가 단순해져 부팅 시 순환 해결 오버헤드가 오히려 소폭 줄어든다. `onApplicationBootstrap` 의 JSONB 전체 적재 패턴은 이전부터 존재하던 것으로 이번 변경이 신규 도입한 것이 아니다. 성능 관점에서 즉시 수정이 필요한 항목은 없다.

## 위험도

NONE
