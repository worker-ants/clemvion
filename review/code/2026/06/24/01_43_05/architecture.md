# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] 순환 의존성 완전 해소 — forwardRef 양방향을 단방향 import 로 전환
- 위치: `codebase/backend/src/modules/triggers/triggers.module.ts`, `codebase/backend/src/modules/chat-channel/chat-channel.module.ts`
- 상세: chat-channel↔triggers 양방향 forwardRef 를 triggers→chat-channel 단방향 일반 import 로 전환했다. NestJS DI 에서 forwardRef 는 부팅 순서 불확실성과 타입 안전성 약화를 수반하는 anti-pattern 이며, 이번 변경으로 양 모듈 모두 forwardRef 가 0 이 되었다.
- 제안: 해소 완료. 잔여 클러스터(llm↔model-config)도 동일 기준으로 대응할 것.

### [INFO] 단일 책임 원칙 준수 강화 — ChatChannelTokenRotatorService 의 역할 분리
- 위치: `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` (신설)
- 상세: 서비스가 "scheduler/worker 어댑터" 역할만 담당하고 실 비즈니스 로직은 `TriggersService.cleanupRotatedChatChannelTokens` 에 위임한다. `NotificationSecretRotatorService` 와 동일 패턴을 적용해 일관성도 확보했다. `process` → `handleHourly` → `triggersService` 의 3단 위임 구조는 단위 테스트 격리를 가능하게 한다.
- 제안: 현행 구조 유지. 향후 rotator 패턴이 늘어날 경우 `BaseRotatorService` 추상 클래스 도입을 고려할 수 있다(현재 2종 — 조기 추상화 금지).

### [INFO] 레이어 책임 재배치 — rotateBotToken 엔드포인트의 이동
- 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (추가), `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` (삭제)
- 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 는 route prefix 가 `/triggers` 이고 `Trigger` 엔티티를 조작하므로 `TriggersController` 에 배치하는 것이 레이어 경계상 더 자연스럽다. 이동 후 controller 책임(입력 검증 only, 오케스트레이션 위임)은 동일하게 유지되었다.
- 제안: 이동 방향 적절. `@Roles('editor')` 가드가 다른 mutation 메서드(`rotateNotificationSecret`, `revokePerTriggerToken`)와 달리 `rotateBotToken` 에 누락되어 있다. 일관성 검토 필요.

### [WARNING] @Roles 데코레이터 누락 — rotateBotToken 에 권한 가드 미적용
- 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` L1493–1516 (`rotateBotToken` 메서드)
- 상세: 동일 파일의 `rotateNotificationSecret`(L1437), `revokePerTriggerToken`(L1460) 은 모두 `@Roles('editor')` 를 선언하고 있으나, 이번에 이전된 `rotateBotToken` 에는 해당 가드가 없다. 이는 이전 전 `ChatChannelController` 에도 없었으므로 behavior-preserving 이전 자체는 올바르나, viewer 역할 사용자가 bot token 회전을 실행할 수 있는 권한 정책 결함이 노출된 상태다.
- 제안: `@Roles('editor')` 를 `rotateBotToken` 에 추가하거나, 권한 미적용이 의도된 설계라면 spec 에 명시적 근거를 추가할 것.

### [INFO] 모듈 응집도 향상 — co-location 패턴 적용
- 위치: `codebase/backend/src/modules/triggers/` (디렉토리)
- 상세: `ChatChannelTokenRotatorService` 를 `triggers/` 로 이전함으로써 bot token 회전 관련 cleanup 로직(`TriggersService.cleanupRotatedChatChannelTokens`)과 그 스케줄러가 같은 모듈에 위치한다. 이는 기능 응집도를 높이고 `chat-channel` 모듈이 순수 채널 어댑터 책임만 갖도록 한다.
- 제안: 현행 구조 적절.

### [INFO] system-status.constants 의 import 경로 갱신 — 중앙 레지스트리 패턴 유지
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` L410
- 상세: `CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE` 상수를 서비스 파일 자체에서 re-export 하는 패턴은 큐 이름의 단일 진실(SoT)을 보장하며 리터럴 중복을 방지한다. import 경로 변경만으로 `system-status` 의 큐 레지스트리 구조를 손상시키지 않았다.
- 제안: 현행 패턴 유지.

### [INFO] 추상화 수준 — body 타입 인라인 리터럴 사용
- 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` L1503 (`body: { newBotToken?: string }`)
- 상세: body 파라미터가 인라인 타입 리터럴로 선언되어 있고 별도 DTO 클래스가 없다. Swagger 자동 문서화 및 class-validator 적용 불가 문제가 있으나, 이 패턴은 이전 전 코드(ChatChannelController)부터 존재했다. 이번 이전의 scope 밖이므로 별건 개선 대상이다.
- 제안: 별건으로 `RotateBotTokenDto` 클래스 도입 및 `@IsString()` / `class-validator` 적용 검토.

## 요약

이번 변경은 chat-channel↔triggers 모듈 간 양방향 forwardRef 순환 의존을 triggers→chat-channel 단방향 import 로 완전히 해소한 behavior-preserving 리팩터링이다. `ChatChannelTokenRotatorService` 의 triggers 모듈 이전으로 응집도가 높아지고 `NotificationSecretRotatorService` 와 일관된 패턴이 유지된다. 레이어 책임(controller → service 위임, scheduler ↔ 비즈니스 로직 분리)과 모듈 경계가 명확해졌으며 단위 테스트도 함께 이전·신설되어 구조적 완성도가 높다. 단, `rotateBotToken` 에 `@Roles('editor')` 가드가 없는 점은 인접 mutation 엔드포인트와 불일치하므로 의도 여부 확인 및 처리가 필요하다.

## 위험도

LOW
