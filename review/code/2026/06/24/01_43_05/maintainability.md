# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 1. 가독성 / 의도 명확성

- **[INFO]** `ChatChannelTokenRotatorService.onModuleInit` 내 주석이 상세하고 의도를 잘 설명함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` (onModuleInit 블록)
  - 상세: `upsertJobScheduler` 의 idempotency, scheduler ID 파생 방식, removeOnComplete/removeOnFail 의미를 모두 설명. 유지보수 시 의도 파악 용이.
  - 제안: 이 수준의 주석을 유지.

- **[INFO]** `TriggersController.rotateBotToken` 은 이전(C-2 리팩터) 이력을 JSDoc 에 명시해 맥락을 제공함
  - 위치: `triggers.controller.ts` 라인 1483~1491
  - 상세: "(C-2: ChatChannelController 에서 이전 — …)" 주석이 왜 이 메서드가 triggers 컨트롤러에 있는지를 즉시 설명.
  - 제안: 유지.

### 2. 네이밍

- **[INFO]** 모든 신규/이동 식별자(`ChatChannelTokenRotatorService`, `CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE`, `CLEANUP_JOB`, `handleHourly`)가 목적을 충분히 반영함
  - 위치: `chat-channel-token-rotator.service.ts` 전체
  - 상세: 기존 코드베이스의 `NotificationSecretRotatorService` / `NOTIFICATION_SECRET_ROTATOR_QUEUE` / `handleHourly` 패턴과 명명 규칙이 일치. 일관성 양호.
  - 제안: 현행 유지.

- **[WARNING]** `rotateBotToken` 메서드 파라미터에서 `triggerId` 로컬 변수명을 사용하나 다른 메서드는 `id` 를 사용
  - 위치: `triggers.controller.ts` 라인 1501 (`@Param('id') triggerId: string`)
  - 상세: 같은 컨트롤러 내 다른 메서드들(`findOne`, `update`, `remove`, `getHistory` 등)은 모두 `@Param('id', ParseUUIDPipe) id: string` 를 사용. `rotateBotToken` 만 `triggerId` 로 다르며 `ParseUUIDPipe` 도 빠져 있어 일관성이 깨짐.
  - 제안: `@Param('id', ParseUUIDPipe) id: string` 로 통일하고 서비스 호출 시 `id` 를 전달.

### 3. 함수 길이

- **[INFO]** 모든 신규 메서드가 단일 책임 원칙을 준수하고 짧음
  - 위치: `chat-channel-token-rotator.service.ts`, `triggers.controller.ts` 신규 메서드
  - 상세: `onModuleInit`(11행), `process`(3행), `handleHourly`(12행), `rotateBotToken` controller(10행). 과도한 길이 없음.

### 4. 중첩 깊이

- **[INFO]** 중첩이 적절히 제한됨
  - 상세: `handleHourly` 의 try-catch 내 if 분기가 최대 2단계. 과도한 중첩 없음.

### 5. 매직 넘버

- **[WARNING]** `onModuleInit` 내 `removeOnComplete` / `removeOnFail` 의 age 값이 인라인 산술식으로 표현됨
  - 위치: `chat-channel-token-rotator.service.ts` 라인 833~834
    ```
    removeOnComplete: { age: 7 * 24 * 60 * 60 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
    ```
  - 상세: `7 * 24 * 60 * 60`(7일)과 `30 * 24 * 60 * 60`(30일)의 의미가 수식으로 추론 가능하나, 동일 패턴이 `NotificationSecretRotatorService` 에도 존재한다면 상수 공유가 없는 중복 리터럴. 현재는 패턴이 명확해 가독성 위험이 낮으나 세 번째 서비스가 생길 경우 발산 위험.
  - 제안: 즉시 필수는 아니나 `SEVEN_DAYS_SEC = 7 * 24 * 60 * 60` 같은 로컬 상수 또는 공유 상수로 이름 부여를 고려. 단기 defer 허용.

- **[INFO]** cron 패턴 `'0 * * * *'` 는 JSDoc 에 "매시간 0분" 으로 설명되어 의미가 명확함

### 6. 중복 코드

- **[WARNING]** `ChatChannelTokenRotatorService` 가 `NotificationSecretRotatorService` 와 구조적으로 거의 동일하나 공통 추상 클래스·헬퍼 없이 복제
  - 위치: `chat-channel-token-rotator.service.ts` 전체, 비교 대상: `notification-secret-rotator.service.ts`
  - 상세: `WorkerHost` 확장, `OnModuleInit` 구현, `upsertJobScheduler` 등록, `process` → `handleHourly` 위임, `try-catch swallow + warn` 패턴이 동일. 현재 2개 서비스에서 반복이며 커밋 메시지에도 "동일 패턴" 으로 명시됨. 두 번째 복사본이 생긴 시점이라 미래 세 번째 추가 시 유지보수 부담이 증가함.
  - 제안: 이번 PR 범위에서는 spec 준수 이동이 목적이므로 즉시 수정 의무는 없으나, 후속 작업으로 `abstract HourlyRotatorWorkerHost` 또는 공통 헬퍼 팩토리를 추출하는 리팩터를 backlog 에 등록 권장. 지금은 INFO/WARNING 경계.

### 7. 코드 복잡도

- **[INFO]** 순환 복잡도 낮음
  - 상세: 변경된 모든 메서드의 분기가 1~2개. 복잡도 문제 없음.

- **[INFO]** `chat-channel.module.ts` 의 `onApplicationBootstrap` 내 루프+조건 구조는 이번 변경 대상이 아니며 기존 수준 유지

### 8. 일관성

- **[WARNING]** `rotateBotToken` 에 `@Roles('editor')` 가드가 없음 — 동일 컨트롤러 내 secret 변경 엔드포인트들과 불일치
  - 위치: `triggers.controller.ts` 라인 1493~1515
  - 상세: 같은 컨트롤러의 `rotateNotificationSecret`(라인 1437)과 `revokePerTriggerToken`(라인 1460)은 모두 `@Roles('editor')` 를 선언. `rotateBotToken` 은 이를 누락. 이 메서드 역시 bot token 을 교체하는 privileged 작업이므로 editor 이상 권한 제한이 필요할 가능성이 높음. 원본 `ChatChannelController` 에도 없었으나, 이전 후 동일 컨트롤러 내 유사 메서드들과 비교하면 불일치가 명시적으로 드러남.
  - 제안: 의도적 설계(viewer 도 토큰 교환 허용)라면 JSDoc 에 이유를 명시. 그렇지 않다면 `@Roles('editor')` 추가.

- **[INFO]** `controllers: []` 빈 배열을 명시한 것은 (파일 2) 의도를 명확히 하는 좋은 패턴

---

## 요약

이번 변경은 `chat-channel↔triggers` forwardRef 순환을 해소하기 위해 두 의존 지점을 triggers 모듈로 이전한 구조적 리팩터다. 코드 이동이 verbatim 에 가깝고 새로 작성된 서비스·테스트는 기존 `NotificationSecretRotatorService` 패턴을 일관되게 따라 가독성과 네이밍 품질이 양호하다. 다만 세 가지 유지보수성 주의사항이 있다: (1) `rotateBotToken` 파라미터명이 같은 컨트롤러의 다른 메서드와 일관되지 않고 `ParseUUIDPipe` 도 빠져 있으며, (2) `@Roles('editor')` 가드가 동일 컨트롤러 내 유사한 권한-민감 엔드포인트들과 달리 누락되어 있어 의도 여부를 확인·문서화해야 하고, (3) 구조적으로 동일한 `HourlyRotator` 패턴이 이제 두 서비스에 복제되어 있어 세 번째 추가 전에 공통 추상화 backlog 등록이 권장된다.

## 위험도

LOW
