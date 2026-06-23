# 부작용(Side Effect) Review

## 발견사항

### [INFO] ChatChannelController 삭제 — 공개 엔드포인트 경로 무변
- 위치: 파일 1 (`chat-channel.controller.ts` 삭제)
- 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 경로는 삭제되지 않고 `TriggersController` 로 verbatim 이전됨. 외부 클라이언트 관점의 HTTP 인터페이스 변경 없음. `@HttpCode(200)` → `@HttpCode(HttpStatus.OK)` 로만 표기 방식 변경(값 동일). `@Roles` 가드는 기존 `ChatChannelController` 에도 없었으므로 권한 동작 무변.
- 제안: 없음 — 의도된 이전.

### [INFO] BullMQ 큐 등록 위치 이동 — Redis 큐 키 무변
- 위치: 파일 2 (`chat-channel.module.ts`) / 파일 8 (`triggers.module.ts`)
- 상세: `chat-channel-token-rotator` 큐의 `BullModule.registerQueue` 가 `ChatChannelModule` → `TriggersModule` 로 이동. BullMQ 큐 이름 리터럴 `'chat-channel-token-rotator'` 는 동일하므로 Redis 에 이미 존재하는 repeatable scheduler entry 및 job 키에 영향 없음. 멀티 인스턴스 환경에서 구 Worker(`chat-channel` 측) 가 신 Worker(`triggers` 측) 로 교체되는 롤링 배포 순간 짧은 윈도우 동안 구 인스턴스 Worker 가 큐를 더 이상 처리하지 못하는 상태가 발생할 수 있으나, BullMQ repeatable 은 워커가 붙을 때까지 job 을 Redis 에 보류하므로 유실 없음. `onModuleInit` 의 `upsertJobScheduler` 도 idempotent 하므로 중복 scheduler entry 발생 없음.
- 제안: 없음 — 이미 설계 문서(service JSDoc)에서 멱등성 명시.

### [INFO] `ChatChannelTokenRotatorService` 신규 등록 — `TriggersService` 순환 의존 가능성 제거 확인
- 위치: 파일 5 (`chat-channel-token-rotator.service.ts`), 파일 8 (`triggers.module.ts`)
- 상세: 이전 구조에서는 `ChatChannelTokenRotatorService`(chat-channel 모듈)가 `TriggersService`를 주입받으면서 `forwardRef` 가 필요했음. 새 구조에서는 같은 `TriggersModule` 내 provider 이므로 단순 DI — 공유 상태·전역 변수·이벤트 발행 측면에서 부작용 없음. `handleHourly` 는 에러를 swallow(`logger.warn`)하므로 BullMQ job 이 항상 성공 완료 → `removeOnComplete` 정책 적용됨(의도적 설계).
- 제안: 없음.

### [INFO] `system-status.constants.ts` import 경로 갱신
- 위치: 파일 3, 라인 `import { CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE } from '../triggers/chat-channel-token-rotator.service'`
- 상세: 상수 이름(`CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE`)과 값(`'chat-channel-token-rotator'`)이 동일하므로 `MONITORED_QUEUES` 배열의 런타임 데이터 무변. 시스템 상태 모니터링 동작에 영향 없음.
- 제안: 없음.

### [INFO] `TriggersController.rotateBotToken` — `@Roles('editor')` 가드 미적용
- 위치: 파일 7 (`triggers.controller.ts`), 새로 추가된 `rotateBotToken` 메서드
- 상세: 같은 컨트롤러의 `rotateNotificationSecret`, `revokePerTriggerToken` 은 `@Roles('editor')` 가 선언되어 있으나 신규 이전된 `rotateBotToken` 에는 없음. 기존 `ChatChannelController` 에도 `@Roles` 가 없었으므로 **행동 보존(behavior-preserving)** 관점에서는 무변. 그러나 동일 컨트롤러 내 유사 메서드들과 일관성이 없어, 인가 의도가 명시적이지 않음.
- 제안: 다음 두 가지 중 하나를 선택하여 의도를 명시화: (a) `@Roles('editor')` 추가(다른 rotation endpoint 와 통일), (b) JSDoc 에 "viewer 이상 허용 — 의도적" 주석 추가. 현재는 기존 코드 그대로이므로 보안 regression 아님.

### [INFO] `ChatChannelModule.controllers` 빈 배열로 명시
- 위치: 파일 2, `controllers: []`
- 상세: 이전에는 `controllers: [ChatChannelController]` 였으나 삭제 후 `controllers: []` 로 명시. NestJS 에서 빈 배열과 미선언은 동일하나 명시적으로 "컨트롤러 없음"을 선언해 의도를 드러냄 — 부작용 없음.
- 제안: 없음.

### [INFO] `onApplicationBootstrap` 부작용 — 기존 코드 무변
- 위치: 파일 2 (`chat-channel.module.ts`), `onApplicationBootstrap`
- 상세: DB 쿼리로 `active trigger + chatChannel 설정` 건을 읽어 `ChannelListenerRegistry.bulkRegister` 를 호출하는 bootstrapper 는 이번 변경으로 수정되지 않음. `TriggersModule` 을 forwardRef 없이 단순 import 전환한 것이 부팅 순서에 영향을 줄 수 있으나, `onApplicationBootstrap` 은 모든 모듈 init 완료 후 실행되므로 안전.
- 제안: 없음.

## 요약

이번 변경은 `ChatChannelController`, `ChatChannelTokenRotatorService`, BullMQ 큐 등록을 `chat-channel` 모듈에서 `triggers` 모듈로 이전해 `forwardRef` 양방향 순환 의존을 단방향화하는 behavior-preserving 리팩토링이다. HTTP 엔드포인트 경로, BullMQ 큐 이름, 상수 값, 비즈니스 로직은 모두 무변이다. 부작용 관점에서 주목할 사항은 `rotateBotToken` 에 `@Roles('editor')` 가드가 없다는 점이나, 이는 기존 `ChatChannelController` 에서도 동일하게 미선언되어 있던 사항이라 regression 이 아닌 기존 동작 보존임을 확인했다. 나머지 변경(import 경로 재배선, spec/plan 문서 동기화)은 코드 이동의 기계적 결과물이며 런타임·공개 인터페이스·상태에 의도치 않은 부작용을 일으키지 않는다.

## 위험도

LOW
