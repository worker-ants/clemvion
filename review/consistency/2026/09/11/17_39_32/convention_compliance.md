# 정식 규약 준수 검토 — `spec/5-system/` (impl-prep)

## 검토 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/` 대상 파일 대부분(15개)과 `spec/conventions/`
거의 전부(`audit-actions.md` 제외)가 **절단**되어 있었다. 실제 판정을 위해 대상 문서
(`spec/5-system/15-chat-channel.md`, 844줄 전문)와 관련 정식 규약
(`spec/conventions/chat-channel-adapter.md`·`conversation-thread.md`·`secret-store.md`·
`error-codes.md`·`redis-keys.md`·`swagger.md`·`audit-actions.md`·`migrations.md`·
`review-citations.md`)을 `Read` 로 직접 열어 대조했다. 이번 리뷰는 최근 커밋 이력
(`f947b49f4`·`fad828884`·`c0f2a885c`·`df1962e25` 등, 2026-09-10~11 PATCH-비밀-쓰기 관련
`--spec` 라운드)이 이미 짚은 항목과 겹치지 않도록, 그 라운드가 다루지 않은 각도
(Swagger/OpenAPI 데코레이터 축)를 중심으로 봤다.

## 발견사항

- **[WARNING]** `rotate-bot-token` 엔드포인트에 spec 이 문서화한 API 계약에 대응하는 OpenAPI 데코레이터가 없다
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4 "Bot Token Rotation API 응답 계약" (`POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 성공 응답 스키마 `{ data: { rotatedAt, triggerId, chatChannelHealth, botIdentity } }` + 6종 에러 코드 표: `RESOURCE_NOT_FOUND`(404)·`INVALID_BOT_TOKEN`(400)·`WORKSPACE_ID_REQUIRED`(400)·`VALIDATION_ERROR`(400)·`CHAT_CHANNEL_NOT_CONFIGURED`(400)·`CHAT_CHANNEL_PROVIDER_UNKNOWN`(400)·`CHAT_CHANNEL_ENDPOINT_REQUIRED`(400)·`BOT_TOKEN_INVALID`(400)·`CHAT_CHANNEL_SETUP_FAILED`(502))
  - 위반 규약: `spec/conventions/swagger.md` §1 (DTO 패턴 — 모든 필드 JSDoc + `@ApiProperty`), §2-4 (상태 코드별 데코레이터 표 — 400→`@ApiBadRequestResponse`, 404→`@ApiNotFoundResponse` 등), §5 "응답 DTO 규약" ("모든 성공 응답은 `@ApiOkResponse({ schema: ... })` 의 인라인 객체가 아닌 **응답 DTO 클래스 + 공용 래퍼 헬퍼**를 사용합니다" — 의무형 서술)
  - 상세: spec 이 이 endpoint 를 실제로 구현하는 `codebase/backend/src/modules/triggers/triggers.controller.ts` 를 frontmatter `code:` 에 명시하고 있어 대조했다. 해당 컨트롤러의 `rotateBotToken` 메서드(파일 245~283행)는 `@Post(':id/chat-channel/rotate-bot-token')` · `@ApiOperation` · `@ApiForbiddenResponse` 만 갖고 있고, **성공 응답 데코레이터(`@ApiOkResponse`/`ApiOkWrappedResponse` 등)가 전혀 없으며**, **요청 바디는 DTO 클래스가 아니라 인라인 타입 `@Body() body: { newBotToken?: string }`** 라 `@ApiBody`/`@ApiProperty` 로 문서화되지 않는다. 400/404/502 각각에 대응하는 `@ApiBadRequestResponse`/`@ApiNotFoundResponse` 데코레이터도 없다. 같은 파일의 형제 엔드포인트 `revokePerTriggerToken`(바로 위, 213~243행)은 `@ApiBadRequestResponse`·`@ApiUnauthorizedResponse`·`@ApiForbiddenResponse`·`@ApiNotFoundResponse` 를 모두 갖춰 이 파일 안에서도 패턴이 일관되지 않는다. 이 endpoint 를 겨냥한 응답 DTO(`dto/responses/*.ts`)도 저장소에 존재하지 않는다(`grep rotatedAt/chatChannelHealth` — `trigger-response.dto.ts` 안의 `chatChannelHealth` 는 트리거 엔티티 필드일 뿐 이 endpoint 전용 응답 DTO 가 아니다). 결과적으로 spec §5.4 가 상세히 카탈로그한 계약이 실제 OpenAPI 산출물에는 드러나지 않는다 — Swagger UI 로 이 endpoint 를 보는 외부 소비자(운영 문서가 curl 예시로만 안내하는 상태)는 요청/응답 형태를 전혀 알 수 없다. `swagger-dto-contract-guard.ts` 는 DTO 선언 vs TS 타입만 대조하는 정적 가드라 애초에 DTO 가 없는 이 endpoint 는 감지 대상이 아니다 — 이 격차를 잡는 자동 게이트가 현재 없다.
  - 이 finding 은 현재 in-progress 인 `plan/in-progress/impl-chat-channel-binder-t2.md` (T2, `spec_impact: none`, `setupChatChannel`/`teardownChatChannel` 순수 이동)의 diff 범위 밖이다 — `rotateBotToken` 컨트롤러의 데코레이터는 이 리팩토링 전부터 이 형태였다(사전 존재 gap). T2 자체를 막을 이유는 아니지만, spec §5.4 가 SoT 로 자처하는 계약이 코드 표면에 반영되지 않은 상태이므로 별도 항목으로 남긴다.
  - 제안: (a) `dto/responses/rotate-bot-token-response.dto.ts` 에 `rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity` 4필드 응답 DTO 신설 + `ApiOkWrappedResponse` 적용, (b) `newBotToken` 요청 바디를 `RotateBotTokenDto` 클래스로 승격 + `@ApiProperty`, (c) §5.4 표의 6개 에러 코드에 대응하는 `@ApiBadRequestResponse`/`@ApiNotFoundResponse` 추가. spec 텍스트 자체는 수정할 필요 없음(계약 서술은 정확) — codebase 쪽 후속 작업으로 `plan/in-progress/` 에 등재 권장.

- **[INFO]** `ChatChannelConfigDto` 의 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 세 필드에 붙은 `readOnly: true` 가 swagger.md §1-5 의 정의와 정확히 들어맞지 않는다
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (196~251행) — spec 쪽 대응 서술은 `spec/5-system/15-chat-channel.md` §4.1 (`botTokenRef`/`inboundSigningRef`/`inboundSigning` 주석: "응답에는 strip", "응답에서 strip")
  - 위반 규약: `spec/conventions/swagger.md` §1-5 ("`readOnly: true` — 응답 전용... 사용처: 서버가 자동 발급하는 ID/타임스탬프/derived field")
  - 상세: 세 필드는 `@IsEmpty()` 로 입력이 차단되면서 동시에 `readOnly: true` 로 표시돼 있다. 그런데 spec §4.1·§5.4.2 및 DTO 자체 주석이 명시하듯 이 필드들은 **응답에서도 strip 되어 노출되지 않는다**(`hasBotToken` derived 필드로만 존재 여부를 알림). 즉 §1-5 가 정의하는 "응답에 나가는 서버 발급 필드" 의미의 `readOnly` 가 아니라 "입력도 출력도 아닌 순수 내부 식별자"에 `readOnly` 를 전용(轉用)한 상태다. 실제로는 `TriggerDto`(응답)의 `config` 필드가 `Record<string, unknown>` 이라 `ChatChannelConfigDto` 의 `readOnly` 선언이 현재 어떤 응답 스키마에도 반영되지 않아 실질적 부작용은 없지만, OpenAPI 스펙만 읽는 외부 도구(SDK 코드젠 등)가 이 클래스를 응답 스키마로 재사용하게 되면 "언젠가 응답에 나온다"는 오해를 유발할 수 있다.
  - 제안: 급하지 않음 — 다음에 이 DTO 를 건드릴 때 주석에 "readOnly 는 Swagger UI 상 입력 스키마 제외 목적일 뿐, 실제 응답에도 나가지 않는다"는 한 줄을 보강하거나, `readOnly` 대신 `writeOnly: true` + 별도 설명으로 "받지만 항상 거부"를 표현하는 대안을 검토. 규약 문서(swagger.md §1-5)를 갱신할 정도의 사안은 아니라고 판단.

## 준수 확인 (참고 — 위반 아님)

아래는 이번 검토에서 명시적으로 대조해 **합치를 확인**한 항목이다 (모두 규약과 일치하므로 발견사항에는 넣지 않음, 향후 재검토 시 중복 작업 방지 목적):

- 문서 구조: `Overview (제품 정의)` / 본문(§1~§8) / `Rationale` 3섹션 구성 — CLAUDE.md·SKILL.md 권장과 일치.
- 에러 코드 명명: 본문에 등장하는 모든 신규 코드(`INVALID_BOT_TOKEN`·`WORKSPACE_ID_REQUIRED`·`CHAT_CHANNEL_*`·`BOT_TOKEN_INVALID` 등)가 `UPPER_SNAKE_CASE` — `error-codes.md` §1 준수. `details[].code='INVALID_FIELD'` 표기는 `2-api-convention.md §5.3`(2026-09-11 규약화)의 "field 를 실으면 code 도 싣는다" 최신 규칙과 일치.
- 감사 액션 명명: `trigger.chat_channel_bot_token_rotated` 가 `audit-actions.md` §3 레지스트리(58행, "구현 (2026-08-11)")에 이미 등재된 값과 정확히 일치. `<resource>.<verb>` 구조·언더스코어 구분자 준수 — R-CC-10 Rationale 이 과거 `chat-channel.rotate-bot-token` 오기(resource dot-prefix 위반)를 스스로 지적·정정한 이력도 확인됨.
- Redis 키 명명: `chat-channel:{triggerId}:{conversationKey}` · `cc:dedup:{triggerId}:{idempotencyKey}` 모두 `redis-keys.md` §3 전역 인벤토리에 이미 등재된 예외 패턴과 일치(§1 기본형 예외로 명시적으로 갈라놓은 두 계열).
- Secret ref/rotation 의미론: `store()`(non-idempotent, throw on duplicate) vs `rotate()`(idempotent UPSERT) 구분, `secret://triggers/{id}/{bot-token,inbound-signing}` URI scheme, telegram(server-issued)/slack·discord(provider-issued) 두 경로 — `secret-store.md` §2.1/§2.2/§5.5 와 완전히 일치.
- Swagger DTO 명명: `ChatChannelUpdateConfigDto` (nested 필드의 갱신 변형, `Update` top-level 접두 미적용)가 `swagger.md` §1-7 예제에 **그대로 실려 있음** — 이 규약 자체가 이 DTO 를 예시로 성문화된 상태. JSDoc/`//` 분리(공개 OpenAPI 노출 vs 내부 서사)도 §3 규약대로 분리돼 있음(`chat-channel-config.dto.ts` 368~383행).
- 리뷰 인용 형식: 본문 유일한 세션 인용(`review/consistency/2026/09/10/22_04_23` 등, R-CC-21)이 `review-citations.md` §2 의 "전체 경로(권장)" 형식을 따름 — bare `hh_mm_ss` 없음.
- 마이그레이션: 신규 컬럼 5종(`chat_channel_*`)은 DDL 서술만 있고 특정 V번호를 spec 텍스트가 못박지 않아 `migrations.md` 명명 규약과 충돌할 표면이 없음.

## 요약

`spec/5-system/15-chat-channel.md` 는 매우 높은 수준으로 정식 규약을 준수한다. 에러 코드·감사 액션·Redis 키·secret ref·Swagger DTO 명명 등 이 리뷰가 점검한 다섯 관점 대부분에서 대응하는 `spec/conventions/**` 규약과 정확히 일치했고, 여러 항목은 최근 라운드(2026-09-10~11)에서 이미 규약 자체가 이 spec 의 실제 상태에 맞춰 갱신된 것으로 확인됐다(예: `swagger.md` §1-7 의 `ChatChannelUpdateConfigDto` 예시, `2-api-convention.md §5.3` 의 "field→code" 규칙). 유일하게 실질적인 격차는 spec 텍스트 자체가 아니라 spec 이 가리키는 구현 표면(`triggers.controller.ts` 의 `rotateBotToken`)에서 발견됐다 — §5.4 가 상세히 문서화한 API 계약에 대응하는 OpenAPI 데코레이터(성공 응답 DTO, 요청 DTO, 에러 응답 데코레이터)가 전혀 없어 `swagger.md` §1/§2-4/§5 의 의무 조항과 어긋난다. 이는 현재 진행 중인 T2 리팩토링(`spec_impact: none`)의 diff 범위 밖의 사전 존재 격차이므로 이번 작업을 막을 사유는 아니지만, 별도로 추적할 가치가 있다.

## 위험도

LOW
