# 문서화(Documentation) Review — chat-channel-rules-cleanup

## 발견사항

- **[CRITICAL]** 신규 DTO `ChatChannelBotIdentityDto` 가 기존 동명 클래스와 이름이 충돌 — 생성되는 Swagger 스키마가 오염된다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:16`
    (신규, `export class ChatChannelBotIdentityDto { botId: number; username: string; teamId?: string; }`)
    vs `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:149`
    (기존, `export class ChatChannelBotIdentityDto { botId?: number; username?: string; }`) — 이 파일은 프롬프트 크기 제한으로 diff/컨텍스트에 실리지 않아 `Read` 로 직접 열어 확인.
  - 상세: 두 클래스는 **이름이 완전히 같지만 구조가 다르다** (필드 필수 여부, `teamId` 유무). 둘 다 실제로 Swagger 스캔 경로에 물려 있다 — 기존 클래스는 `chat-channel-config.dto.ts:299/304-305` 에서 `@ApiProperty({ type: () => ChatChannelBotIdentityDto })` 로 `ChatChannelConfigDto.botIdentity` 에 쓰이고, 신규 클래스는 이번 diff 에서 `@ApiProperty({ type: ChatChannelBotIdentityDto, nullable: true })` 로 `ChatChannelRotateBotTokenDto.botIdentity` 에 쓰인다(신규 파일 gate 53-54). `@nestjs/swagger` 는 스키마 이름을 **클래스 `.name` 문자열**로 등록하므로(`components.schemas.ChatChannelBotIdentityDto`), 서로 다른 두 클래스가 같은 이름을 쓰면 OpenAPI 문서에서 한 스키마가 다른 스키마를 덮어쓰거나(둘 중 나중에 스캔되는 쪽이 남는다) 부트 시 "Duplicated DTO detected" 류 경고를 낸다 — 어느 쪽이든 두 엔드포인트(`chatChannel` 설정 조회/수정, `rotateBotToken`) 중 하나의 응답 문서가 실제 응답 형태와 어긋나게 된다. 저장소 전체(`**/*.dto.ts`)를 `export class` 기준으로 전수 스캔한 결과 **이 쌍이 유일한 중복**이며, 이번 diff 가 그 유일한 발생원이다(신규 파일이 기존 이름을 재사용). 정확히 이 PR 이 닫으려던 문제(“swagger 응답 문서화 잔여”)를 스스로 만든 자리라 값어치가 크다. 참고로 `review/consistency/.../naming_collision.md` 는 plan 이 예고한 코드 헬퍼 2종(`throwInvalidField`/`hasField`)만 grep 했고, diff 로 실제 추가된 이 DTO 클래스명은 대상에 없어 놓쳤다.
  - 제안: 신규 클래스 이름을 그 파일이 실제로 나타내는 대상에 맞게 좁혀라(예: `ChatChannelRotateBotIdentityDto` 또는 `ChatChannelBotIdentitySummaryDto`) — 이 파일 자신의 헤더 주석이 이미 "정의를 한 칸 좁게" 원칙을 설명하고 있으니 같은 원칙을 클래스명에도 적용. 혹은 두 자리가 실제로 같은 shape 이어야 한다면(설계상 하나로 합쳐도 되는지 검토) 기존 클래스를 `import`/재사용해 정의를 하나로 합친다.

- **[WARNING]** `rotateBotToken` 엔드포인트에 `@ApiUnauthorizedResponse` 데코레이터가 빠져 있다 — 같은 컨트롤러의 다른 모든 엔드포인트와 불일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:257-284` (데코레이터 블록. 삽입 지점은 gate 265 `@ApiForbiddenResponse` 인접)
  - 상세: 이 컨트롤러의 `findAll`(gate 61) · `findOne`(78) · `create`(98) · `update`(134) · `getHistory`(160) · `remove`(179) · `rotateNotificationSecret`(208) · `revokePerTriggerToken`(236) 8개 메서드 전부 `@ApiUnauthorizedResponse` 를 갖는데, 이번 diff 가 swagger 문서화를 "완성"하려고 `@ApiNotFoundResponse`·`@ApiOkWrappedResponse` 두 개를 추가한 바로 그 `rotateBotToken` 만 401 문서가 없다. 이 엔드포인트도 `@ApiBearerAuth('access-token')` 클래스 데코레이터 + `@Roles('editor')` 가드 하위이므로 인증 실패(401)는 실제로 발생 가능한 응답이다 — 즉 이번 PR 의 명시 목적("rotateBotToken 의 swagger 응답 문서화 잔여")을 기준으로도 완결되지 않은 상태다.
  - 제안: `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` (또는 형제 EIA 엔드포인트들이 쓰는 `'인증 실패'`) 를 추가.

- **[INFO]** `ChatChannelBotIdentityDto.botId` 주석이 Slack 의 해시 처리만 언급하고 Discord 의 동일 처리는 언급하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:17` (`/** provider 가 부여한 봇 식별자. Slack 은 문자열 id 를 해시한 정수다. */`)
  - 상세: 실제 어댑터 코드를 보면 `discord.adapter.ts:158` 도 `botId: hashStringToInt(application.id)` 로 문자열 snowflake ID 를 해시해 `number` 슬롯에 채운다(Slack `slack.adapter.ts:114` 와 동일 패턴). Telegram 만 네이티브 정수 ID(`me.result.id`)라 해시가 필요 없다. 지금 주석은 "Slack 만 특별하다"는 인상을 주는데, 실제로는 "Telegram 만 다르다"가 더 정확한 서술이다. 오독해도 동작에 영향은 없지만(둘 다 어차피 `number`), 다음 사람이 "Discord 는 원래 숫자인가" 를 잘못 짐작할 수 있다.
  - 제안: "Slack·Discord 는 문자열 id 를 해시한 정수, Telegram 은 네이티브 정수." 로 넓히거나, 최소한 "예: Slack" 처럼 예시 표기로 바꿔 전수 열거처럼 읽히지 않게 한다.

## 확인했으나 문제 없음

- `chat-channel-input-rules.ts` 의 신규 헬퍼(`throwInvalidField`/`hasField`/`rejectBlockedField`) JSDoc — 실측 근거(11곳/2곳)·설계 이유("왜 세 번째 인자를 안 두나"/"왜 `never` 인가")를 구체적으로 적어 코드 리뷰 관점에서 모범적이다.
- `chat-channel-rejection-messages.const.ts:8-10`, `dto/chat-channel-config.dto.ts:36-37,283` 의 stale `TriggersService` 귀속 주석 정정 — `#1319`/`#1320` 이동 이력과 실제 현재 구조(module-level 함수)에 정확히 부합한다.
- `chat-channel-input-rules.spec.ts` 의 신규/변경 JSDoc — 뮤테이션 근거·판별 조건("provider 를 slack 으로 둔다", "판별자는 message 다" 등)을 구체적으로 적어 테스트 존재 이유를 다음 사람이 재구성할 수 있게 한다.
- `chat-channel-rotate-bot-token.dto.ts` 헤더의 파일 위치 선택 근거(§7 glob 매칭)와 "JSDoc 은 OpenAPI `description` 으로 나간다" 구분 — `swagger.md §3` 관례와 일치.
- `ChatChannelRotateBotTokenDto` 필드 4종(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`) 은 `triggers.service.ts:990-994` 의 실제 반환 타입과 `TriggerChatChannelHealth`(`'unknown'|'healthy'|'degraded'`) enum 값까지 정확히 일치 — 새 컨트롤러 반환 타입 선언(`Promise<ChatChannelRotateBotTokenDto>`)이 실제 구현과 어긋나지 않는다.
- `@ApiNotFoundResponse` 설명의 `RESOURCE_NOT_FOUND` 코드는 `triggers.service.ts:342-354` 의 `findById`(rotateBotToken 이 내부에서 호출)가 실제로 던지는 코드와 일치 — 문서와 구현이 부합한다.
- `plan/in-progress/chat-channel-rules-cleanup.md` — 트래커 재판정 표에 "존재하지 않는 매직 넘버"(항목 (c))를 착수 전에 실측으로 걸러낸 점, 설계 판단마다 근거를 남긴 점 등 plan 문서 자체의 품질은 양호.
- README/CHANGELOG — 이번 변경은 내부 리팩터 + 기존 엔드포인트의 swagger 보강일 뿐 신규 공개 기능·설정·환경변수가 없어 README/CHANGELOG 업데이트 필요성 없음.

## 요약

리팩터 대상 파일들의 JSDoc·인라인 주석 품질은 전반적으로 높다 — 새 헬퍼마다 "왜"를 실측 근거와 함께 적었고, stale `TriggersService` 귀속 주석 3곳도 정확히 정정했다. 다만 이번 PR 이 명시적으로 완결하려 했던 "rotateBotToken swagger 문서화" 작업 자체에서 두 가지 실질 결함이 나왔다: (1) 신규 응답 DTO 파일이 기존 `chat-channel-config.dto.ts` 의 `ChatChannelBotIdentityDto` 와 완전히 동일한 클래스명을 재사용해 저장소 전체에서 유일한 Swagger 스키마 이름 충돌을 만들었고(둘 다 실제 스캔 경로에 있음, 구조도 다름), (2) 같은 엔드포인트에 401 응답 문서(`@ApiUnauthorizedResponse`)가 여전히 빠져 있어 같은 컨트롤러의 다른 8개 메서드와 일관성이 깨진다. 두 문제 모두 이 리뷰가 아니면 놓치기 쉬운 자리다 — consistency-checker 의 naming-collision 점검은 plan 이 예고한 코드 헬퍼명만 grep 했고 diff 로 실제 추가된 DTO 클래스명은 대상 밖이었다.

## 위험도

HIGH
