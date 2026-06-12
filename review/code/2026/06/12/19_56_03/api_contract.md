# API 계약(API Contract) 리뷰 결과

## 발견사항

### [WARNING] rotateBotToken 응답 계약 확장 — 기존 클라이언트 하위 호환성
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L856–L862 / `chat-channel.controller.ts` L172
- 상세: `rotateBotToken` 의 반환 타입이 `{ rotatedAt: string }` 에서 `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 4필드로 확장되었다. 응답 필드 추가는 일반적으로 하위 호환이지만, 컨트롤러 반환 타입이 `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` 로 서비스 타입에 직접 앵커되어 있어 서비스 시그니처 변경이 즉시 HTTP 응답 계약에 전파된다. 기존 클라이언트가 `{ rotatedAt }` 만을 기대하여 엄격한 스키마 검증을 수행한다면 추가 필드는 무시될 것이나, 이 패턴은 계약 거버넌스(서비스 내부 타입과 HTTP 응답 DTO 분리)를 약화시킨다.
- 제안: `rotateBotToken` HTTP 응답에 전용 DTO 또는 인터페이스(`RotateBotTokenResponseDto`)를 정의하여 서비스 내부 반환 타입과 HTTP 계약을 분리할 것을 권장한다. 현재 변경 자체는 필드 추가(비파괴적)이므로 즉각적인 breaking change 는 아니나, 향후 서비스 타입 변경이 무의식적으로 API 계약을 변경하는 구조적 위험이 있다.

### [INFO] botIdentity 필드 — 부분 선택적 서브필드(teamId?)가 응답에 노출
- 위치: `triggers.service.ts` L861 — `botIdentity: { botId: number; username: string; teamId?: string } | null`
- 상세: `teamId` 가 optional(`?`)로 선언되어 있어 Slack 등 팀 개념이 있는 provider 에서만 존재하고 나머지 provider 에서는 absent 된다. API 클라이언트 입장에서 응답 스키마의 선택적 필드는 조건적 존재를 처리해야 한다. Swagger `@ApiProperty({ required: false })` 또는 nullable/optional 선언이 없으면 API 문서에서 이 필드가 항상 존재하는 것처럼 오해될 수 있다.
- 제안: Swagger `@ApiProperty` 에 `teamId` 를 `required: false` 로 명시하고, botIdentity 전체가 null 가능함을 `nullable: true` 로 문서화한다.

### [INFO] 채팅 채널 webhook 응답 — `{ executionId: 'ignored' }` 하드코딩 문자열
- 위치: `hooks.service.ts` L766 (`return { executionId: 'ignored' }`)
- 상세: CCH-CV-03(b) 경로(`running`/`pending` 상태 중 사용자 메시지 수신)에서 `{ executionId: 'ignored' }` 를 반환한다. 이 `'ignored'` 문자열은 webhook 의 공개 API 응답 계약으로 노출된다. 일반 webhook 과 동일한 `{ executionId: string }` 형태를 유지하므로 하위 호환은 유지되나, API 클라이언트가 `executionId` 값으로 `'ignored'` 를 받았을 때의 의미가 공식 계약 문서에 명시되지 않으면 클라이언트가 이를 실제 execution ID 로 오인하고 후속 조회 API를 호출할 수 있다.
- 제안: `executionId: 'ignored'` 를 API 문서(Swagger) 에 명시적으로 기술하거나, 별도의 `status` 필드(`{ status: 'skipped' }`)로 분리하여 의미론적 명확성을 높인다. 단, 현재 스펙(spec §5.5 / R-CC-12(d))에서 이미 이 계약이 정의되어 있다면 INFO 수준으로 충분하다.

### [INFO] handleChatChannelWebhook 반환 타입의 다형성 — HTTP 응답 계약 복잡성
- 위치: `hooks.service.ts` L1043–1055 — `handleChatChannelWebhook` 반환 타입
- 상세: 내부 메서드이지만 `{ executionId, status?, challenge?, discordPing?, interactionHttpResponse? }` 의 다형적 구조를 반환하며 컨트롤러가 이를 HTTP 응답으로 직접 사용한다. `challenge` (Slack URL verification), `discordPing` (Discord PING), `interactionHttpResponse` (native modal) 가 동일 엔드포인트에서 서로 다른 응답 형태를 낼 수 있다. 이 엔드포인트의 공개 API 계약(Swagger 문서)이 이 다형성을 표현하지 않으면 외부 클라이언트에게 계약 불일치로 보인다.
- 제안: 실제로 이 엔드포인트는 provider 측에서 호출하는 webhook receive endpoint 이므로 외부 클라이언트가 아닌 각 provider(Telegram, Slack, Discord)가 소비자다. Provider 별 응답이 각 provider 의 기대와 일치하면 기능상 문제 없다. 단, Swagger 문서에 provider 별 응답 형태를 union/discriminated union 으로 기술하는 것을 권장한다.

### [INFO] @HttpCode(200) 명시 — 리소스 생성이 아닌 작업에 적절
- 위치: `chat-channel.controller.ts` L219 (`@HttpCode(200)`)
- 상세: `POST /triggers/:id/chat-channel/rotate-bot-token` 은 기존 리소스의 속성 변경(token rotation)이므로 201 Created 가 아닌 200 OK 가 올바르다. `@HttpCode(200)` 을 명시적으로 선언한 것은 NestJS 기본(POST=201)을 재정의한 의도적 결정이며 적절하다.
- 제안: 없음. 현행 유지.

---

## 요약

이번 변경의 핵심 API 계약 영향은 두 가지다. 첫째, `rotateBotToken` 의 응답 계약이 `{ rotatedAt }` 에서 `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 로 확장되었다. 이는 Spec §5.4 를 이행하는 의도적 확장이며 하위 호환(필드 추가)이지만, 컨트롤러가 서비스 내부 타입을 `ReturnType` 으로 직접 참조하는 구조는 서비스 타입 변경이 자동으로 HTTP 계약에 전파되는 구조적 위험을 내포한다. 전용 응답 DTO 분리가 권장된다. 둘째, CCH-CV-03(b) 경로의 `{ executionId: 'ignored' }` 응답은 기존 계약과 형태는 동일하나 클라이언트가 sentinel 값을 오인할 가능성이 있어 API 문서 보완이 권장된다. 에러 응답 코드(`INVALID_BOT_TOKEN`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`)는 `UPPER_SNAKE_CASE` 를 준수하고 있으며, 인증/인가 흐름(inbound signing 검증 우선 → isActive 검사)도 spec 계약에 일치한다. URL 설계(`POST .../rotate-bot-token`)는 RPC-style sub-channel action 예외 조항을 적용한 적절한 선택이다.

---

## 위험도

LOW
