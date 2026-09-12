# API 계약(API Contract) 리뷰

## 발견사항

- **[CRITICAL]** 신규 `ChatChannelRotateBotTokenDto` 가 기존 `ChatChannelConfigDto` 와 **같은 이름의 다른 DTO 클래스**(`ChatChannelBotIdentityDto`)를 새로 선언해 swagger 스키마가 충돌한다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:16` (신규 `export class ChatChannelBotIdentityDto { botId: number; username: string; teamId?: string }`) vs `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:149` (기존 `export class ChatChannelBotIdentityDto { botId?: number; username?: string }` — 이 파일은 프롬프트 예산 초과로 전체 컨텍스트가 실리지 않아 `Read` 로 직접 열어 줄 번호를 확인함)
  - 상세: 두 파일 모두 서로 다른 필드 형태(전자는 `botId`/`username` 필수 + `teamId` optional, 후자는 둘 다 optional·`teamId` 없음)로 **동일한 클래스 이름**을 export 한다. 두 클래스 모두 실제로 swagger 문서 생성 경로에 물려 있다 — 기존 클래스는 `CreateTriggerDto.chatChannel`(`ChatChannelConfigDto.botIdentity`) 경유로, 신규 클래스는 이번 diff 가 `triggers.controller.ts` 에 새로 추가한 `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto, …)` 경유로 같은 Nest 애플리케이션의 OpenAPI 문서 생성 패스에 함께 등록된다. 저장소에 pin 된 `@nestjs/swagger@11.4.5` 의 `schema-object-factory.js` 는 이 정확한 상황을 인식해 `schemas[schemaName]` 이 이미 존재하고 새 정의와 다르면 `Logger.warn('Duplicate DTO detected: "<name>" is defined multiple times with different schemas. … Note: This will throw an error in the next major version.')` 를 찍고 **나중에 등록된 정의로 조용히 덮어쓴다** (`schemas[schemaName] = typeDefinition`). 즉 지금 당장은 두 엔드포인트 중 하나의 `components.schemas.ChatChannelBotIdentityDto` 가 실제와 다른(잘못된 필수/옵셔널) 스키마로 노출되고, 라이브러리 자체 주석대로 차기 메이저 버전 업그레이드 시 부팅 자체가 죽는 잠재 결함이 된다. 이는 이번 diff 가 **새로 도입**한 결함이다 — `rotateBotToken` 은 종전에 명시적 200 응답 스키마가 없었다(`Promise<Awaited<ReturnType<...>>>` 만 있었고 swagger 데코레이터가 없었음).
  - 제안: 신규 응답 DTO 가 표현하려는 개념이 기존 `chat-channel-config.dto.ts` 의 `ChatChannelBotIdentityDto` 와 동일한 "bot identity" 라면, 새로 선언하지 말고 기존 클래스를 import 해 재사용하거나(그리고 기존 클래스의 optional 선언을 도메인 SoT인 `ChatChannelConfig['botIdentity']`(`chat-channel/types.ts:55-61`, `botId`/`username` 필수)에 맞춰 정정) 재사용이 부적절하면 클래스명을 `ChatChannelRotateBotIdentityDto` 등으로 구분해 이름 충돌을 없앨 것.

- **[WARNING]** 신규 응답 DTO 가 Discord 봇의 실제 응답 필드(`botIdentity.publicKey`)를 누락해 문서화된 스키마가 실제 wire 응답보다 좁다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:16-28` (`ChatChannelBotIdentityDto` 에 `botId`/`username`/`teamId` 만 선언, `publicKey` 없음)
  - 상세: `rotateBotToken` 은 `adapter.setupChannel()` 결과를 그대로 반환한다(`triggers.service.ts:1068,1080-1085,1119-1124`). Discord adapter 의 `setupChannel` 은 `application.verify_key` 가 있으면 `configUpdates.botIdentity.publicKey` 를 채워 넣는다(`chat-channel/providers/discord/discord.adapter.ts:157-165`). `TransformInterceptor` 는 `{ data }` 로 감싸기만 하고 DTO 기준으로 필드를 걷어내지 않는다(`common/interceptors/transform.interceptor.ts:19-31`, 클래스 인스턴스 변환이 아니라 서비스가 반환한 plain object 를 그대로 통과시킨다). 따라서 Discord 로 구성된 트리거에 대해 실제 HTTP 응답 본문에는 `botIdentity.publicKey` 가 실리는데, 이번 PR 이 처음 작성한 swagger 스키마에는 그 필드가 없다 — 문서(계약)가 실제 응답보다 좁다. 참고로 이 값 자체는 주석상 "비민감(non-sensitive)" 이라 노출 자체는 보안 문제가 아니다.
  - 제안: `ChatChannelBotIdentityDto` 에 `publicKey?: string` (`@ApiPropertyOptional`) 를 추가하거나, 의도적으로 숨기려는 것이면 서비스/컨트롤러에서 명시적으로 그 필드를 제거한 뒤 문서와 실제 응답을 일치시킬 것.

- **[INFO]** `rotateBotToken` 의 `:id` 파라미터만 형제 rotate 계열 엔드포인트와 달리 `ParseUUIDPipe` 가 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken(@Param('id') triggerId: string, …)` (해당 함수 시그니처. 이번 diff 의 컨텍스트로 표시된 줄이며 이 파라미터 선언 자체는 diff 로 바뀌지 않은 기존 코드)
  - 상세: 같은 파일의 `findOne`·`update`·`remove`·`rotateNotificationSecret`·`revokePerTriggerToken` 은 모두 `@Param('id', ParseUUIDPipe) id: string` 을 쓰는데 `rotateBotToken` 만 raw string 을 받는다. 비-UUID 문자열이 오면 파이프 단계에서 400 대신 서비스 조회 실패로 내려가 결과적으로 `RESOURCE_NOT_FOUND` 404 가 되어 실사용상 치명적이진 않지만, 같은 컨트롤러 내 요청 검증 방식이 엔드포인트마다 다르다.
  - 제안: 이번 PR 스코프는 아니지만(사전 존재 코드), 후속으로 `ParseUUIDPipe` 를 맞출 것.

## 요약

이번 변경은 `chat-channel-input-rules.{ts,spec.ts}` 의 순수 리팩터링(에러 봉투 헬퍼화, 이중 캐스팅 제거)과 `rotateBotToken` 엔드포인트의 swagger 문서 보강(신규 `ChatChannelRotateBotTokenDto` + `@ApiNotFoundResponse`/`@ApiOkWrappedResponse`)으로 구성된다. 검증 규칙 리팩터링 자체는 응답 봉투 형태·필드명·HTTP 상태 코드를 바꾸지 않아 하위 호환성 문제가 없음을 실제로 확인했다. 다만 이번에 **신규로 추가된** 응답 DTO 파일이 기존 `ChatChannelConfigDto` 소유의 `ChatChannelBotIdentityDto` 와 동일한 클래스명으로 서로 다른 필드 형태를 선언해 `@nestjs/swagger` 스키마 레지스트리 충돌(라이브러리 자체 경고 대상, 차기 메이저에서 하드 에러 예고)을 일으키고, 그 신규 DTO 자체도 Discord 응답 실측 필드(`publicKey`)를 누락해 문서-실응답 간극을 만든다. 두 건 모두 "응답 형식의 일관성·스키마 준수" 축의 실질 결함이라 반영을 권장한다.

## 위험도

HIGH
