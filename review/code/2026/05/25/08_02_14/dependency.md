# 의존성(Dependency) 리뷰

리뷰 대상: workflow-resumable-execution Phase 2 cont (BullMQ 기반 Durable Continuation Bus 전환)
리뷰 일시: 2026-05-25

---

## 발견사항

### [INFO] `@nestjs/bullmq` 가져오기 신규 추가 — 기존 의존성의 새 API 사용
- 위치: `continuation-bus.service.spec.ts` 상단 — `import { getQueueToken } from '@nestjs/bullmq'`
- 상세: `getQueueToken`은 `@nestjs/bullmq` 패키지에서 가져오는 테스트 헬퍼 함수다. 해당 패키지는 `codebase/backend/package.json`에 `"@nestjs/bullmq": "^11.0.4"` 로 이미 등록되어 있으며, `bullmq: "^5.76.6"` 피어 의존성도 함께 존재한다. 신규 패키지 추가 없이 기존 의존성의 테스트 유틸리티 진입점을 새로 참조한 것이다.
- 제안: 특별한 조치 불필요. `@nestjs/bullmq` 버전이 `^11.0.4` (caret 범위)로 고정되어 있어 minor/patch 자동 업데이트가 허용되며, `getQueueToken` API는 v10 이상에서 안정적으로 제공된다.

### [INFO] `ioredis` 직접 인스턴스화 — 기존 의존성 유지, lazy init 패턴 유지
- 위치: `continuation-bus.service.ts` (변경 diff에 직접 노출되지 않으나 spec 파일이 mock 대상으로 참조), `continuation-bus.service.spec.ts`의 `jest.mock('ioredis', ...)`
- 상세: `ContinuationBusService`는 lock client 용으로 `new Redis(...)` 를 직접 호출하는 lazy init 패턴을 유지하고 있다. `ioredis` 는 `"^5.10.1"` 버전으로 이미 등록된 의존성이다. Phase 2 에서 Redis pub/sub publisher/subscriber 쌍이 단일 lock client 로 축소되었으나 `ioredis` 직접 의존은 그대로다.
- 제안: NestJS DI 컨테이너 밖에서 `new Redis()`를 직접 호출하는 패턴은 테스트 시 모듈 레벨 mock(`jest.mock('ioredis', ...)`)이 필수가 된다. 현재 구현이 이를 인식하고 있어 테스트는 정상 작동하나, 향후 연결 풀 공유나 ConfigService 연동이 필요해지면 `BullMQ`의 내장 connection 재사용 또는 `InjectRedis` 패턴으로 전환을 검토할 수 있다. 현 단계에서는 기능적으로 문제없다.

### [INFO] 내부 모듈 의존 — `CONTINUATION_EXECUTION_QUEUE` 상수 테스트 직접 참조
- 위치: `continuation-bus.service.spec.ts` 4번째 import — `import { CONTINUATION_EXECUTION_QUEUE } from '../queues/continuation-execution.queue'`
- 상세: spec 파일이 `queues/continuation-execution.queue.ts`의 `CONTINUATION_EXECUTION_QUEUE` 상수를 직접 가져온다. 이는 테스트가 구현 세부 상수에 의존하는 것으로, 상수값(`'execution-continuation'`)이 변경되면 spec도 함께 업데이트가 필요하다. 그러나 이 상수는 BullMQ 큐 이름의 SoT이므로 하드코딩 방지를 위한 올바른 접근이다.
- 제안: 현재 패턴이 적절하다. `'execution-continuation'` 리터럴을 테스트에 하드코딩하는 것보다 상수 재사용이 유지보수 면에서 우수하다.

### [INFO] `ContinuationMessage` import 제거 — 내부 타입 정리
- 위치: `continuation-bus.service.spec.ts` diff — `ContinuationMessage`, `CONTINUATION_CHANNEL` import 제거
- 상세: Phase 2에서 Redis pub/sub 채널 상수(`CONTINUATION_CHANNEL`)와 메시지 타입(`ContinuationMessage`)이 테스트 scope에서 더 이상 필요하지 않아 import가 제거되었다. `RECOVERY_LOCK_KEY`만 남아 있다. 불필요한 내부 의존을 제거한 것으로 긍정적 변화다.
- 제안: 특별한 조치 불필요.

### [INFO] `execution-engine.service.ts` — `ContinuationMessage` import 제거
- 위치: `execution-engine.service.ts` diff — `-  ContinuationMessage,` 제거
- 상세: `ContinuationMessage` 타입이 `execution-engine.service.ts`에서 더 이상 사용되지 않아 제거되었다. Phase 2 에서 handler 등록 방식이 `bus.on()` → `applyContinuation`/`applyCancellation` 직접 dispatch로 전환됨에 따른 자연스러운 정리다.
- 제안: 특별한 조치 불필요.

---

## 요약

이번 변경은 신규 외부 의존성을 전혀 추가하지 않았다. `@nestjs/bullmq`의 `getQueueToken` 테스트 유틸리티와 내부 모듈 상수(`CONTINUATION_EXECUTION_QUEUE`) 참조가 추가된 것이 의존성 관점의 주요 변화이며, 모두 기존에 `package.json`에 등록된 패키지 또는 프로젝트 내부 모듈을 활용한 것이다. Redis pub/sub를 BullMQ 큐로 교체하는 과정에서 `ioredis` 직접 의존은 lock client 역할로 유지되고 있으나, 이는 기존 아키텍처를 이어받은 것으로 새로운 위험을 도입하지 않는다. 버전 고정, 라이선스, 취약점, 번들 크기 측면에서 기존 대비 변화 없음 — 의존성 리스크가 없는 변경이다.

---

## 위험도

NONE
