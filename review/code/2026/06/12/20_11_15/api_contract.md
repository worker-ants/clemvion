# API 계약(API Contract) 리뷰 결과

## 발견사항

### [WARNING] `rotateBotToken` 응답 계약 확장 — 기존 클라이언트 영향 평가 필요
- **위치**: `codebase/backend/src/modules/triggers/triggers.service.ts` L863~L571 / `chat-channel.controller.ts` L172
- **상세**: `rotateBotToken`의 반환 타입이 `{ rotatedAt: string }` 에서 `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 로 확장되었다. 기존 클라이언트가 이 응답을 소비하고 있다면 새 필드는 additive 추가이므로 하위 호환성 자체는 유지된다. 그러나 `botIdentity` 가 `null` 이 될 수 있는 구조(`botIdentity: { botId, username, teamId? } | null`)는 기존에는 존재하지 않던 null 경로이므로, 클라이언트가 botIdentity를 non-null로 가정하면 런타임 오류가 발생할 수 있다. Spec §5.4 에서 이 계약을 명시하고 있어 의도적 변경이나, 클라이언트 측 타입 갱신 여부 확인이 필요하다.
- **제안**: 프론트엔드/채널 웹챗 SDK 등 `rotateBotToken` 응답을 소비하는 클라이언트 코드에서 `botIdentity` null 케이스를 방어적으로 처리하는지 확인한다. API 문서(Swagger `@ApiOperation`)에 응답 스키마(`@ApiResponse` + 응답 DTO)를 추가해 계약을 명시하는 것을 권장한다.

### [WARNING] `POST /api/triggers/:id/chat-channel/rotate-bot-token` — Swagger 응답 스키마 미선언
- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` L218~L241
- **상세**: `@ApiOperation`은 선언되어 있으나 `@ApiResponse`(성공/실패 응답 DTO)가 없다. 응답 타입이 `Awaited<ReturnType<TriggersService['rotateBotToken']>>`로 TypeScript 구조 타입에 의존하고 있어 Swagger 문서에 응답 스키마가 노출되지 않는다. 4개 필드(`rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity`)가 포함된 응답이 외부 클라이언트에 문서화되지 않으면 API 계약 명확성이 낮다.
- **제안**: 응답 타입을 명시적인 응답 DTO 클래스로 분리하고 `@ApiResponse({ status: 200, type: RotateBotTokenResponseDto })`를 추가한다. `botIdentity` nullable 여부도 `@ApiPropertyOptional` 또는 `nullable: true`로 표시한다.

### [INFO] `handleChatChannelWebhook` 내부 응답 형식 — `{ executionId: 'ignored' }` 일관성 유지 확인
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` L454~L457 (CCH-CV-03 (b) 분기)
- **상세**: `running`/`pending` 상태에서 `{ executionId: 'ignored' }` 를 반환하는 것은 기존 `parseUpdate null` / 비활성 트리거 경로와 동일한 응답 형식이다. Webhook 외부 응답은 controller에서 202 Accepted로 매핑되므로 외부 API 계약은 변화 없다. 내부 분기 추가로 인해 클라이언트가 수신하는 HTTP 응답 body/status 코드는 변경되지 않는다.
- **제안**: 해당 없음 — 외부 계약에 영향 없는 내부 동작 변경.

### [INFO] `getActiveExecutionStatus` — private 내부 메서드, API 계약 외부 노출 없음
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` L798~L851
- **상세**: `isActiveExecution`(boolean) → `getActiveExecutionStatus`(ExecutionStatus | null) 리팩터링은 서비스 내부 private 메서드 변경이다. 외부 API 엔드포인트에 직접 노출되지 않으므로 API 계약 관점 파급이 없다.
- **제안**: 해당 없음.

### [INFO] `rotateBotToken` 에러 응답 형식 — 기존 일관성 유지
- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` L230~L234
- **상세**: `INVALID_BOT_TOKEN` (400 BadRequest), 트리거 미존재 시 `RESOURCE_NOT_FOUND` (404) 에러 코드 패턴은 `UPPER_SNAKE_CASE` 규약을 준수하며 변경 없이 유지된다.
- **제안**: 해당 없음.

---

## 요약

이번 변경의 API 계약 관점 핵심은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 엔드포인트의 성공 응답 확장이다. 기존 `{ rotatedAt }` 단일 필드에서 `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 4필드로 확장된 것은 additive change로 하위 호환성 파괴(breaking change)는 아니나, `botIdentity` 가 `null` 이 될 수 있는 새로운 nullable 경로가 도입되었으므로 클라이언트의 방어적 처리가 필요하다. Swagger 응답 스키마가 선언되지 않아 외부 클라이언트가 변경된 응답 계약을 문서로 확인할 수 없다는 점이 개선이 필요한 부분이다. `hooks.service.ts`의 webhook 처리 내부 분기 추가(`running`/`pending` 상태 안내 발송)는 HTTP 레이어의 응답 형식(202 Accepted + `{ executionId: 'ignored' }`)에 변화가 없으므로 외부 API 계약에는 영향이 없다.

## 위험도
LOW

---

STATUS=success ISSUES=2
