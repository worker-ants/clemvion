# 보안(Security) 리뷰

## 검토 범위 확인

이번 라운드(`17_52_34`)는 이전 라운드(`16_17_57` 등)에서 지적된 CRITICAL/WARNING 을 조치한
후속 diff다. 실제 코드 변경 범위(`git diff 18b0c6aa6..f978f8d77 -- codebase/`)는:

- `chat-channel-input-rules.spec.ts` — `assertPatchCarriesNoSecrets` 에 `botToken`/
  `inboundSigningPlaintext` 의 `null`/`''` 케이스 테스트 추가
- `dto/chat-channel-rotate-bot-token.dto.ts` → `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
  로 이동 + 클래스명 `ChatChannelBotIdentityDto` → `ChatChannelRotateBotIdentityDto` 로 개명,
  `publicKey?: string` 필드 추가
- `triggers.controller.ts` — import 경로 갱신 + `@ApiUnauthorizedResponse` 추가 (문서 데코레이터만)
- `triggers.service.ts` — `rotateBotToken` 반환 타입 주석을 손으로 적은 리터럴에서
  `NonNullable<ChatChannelConfig['botIdentity']>` 참조로 교체 (타입 레벨만, 런타임 무변화)
- `triggers.service.spec.ts` — provider 별 부가 identity 필드(Slack `teamId`, Discord `publicKey`)가
  응답까지 살아오는지 고정하는 테스트 추가
- `repo-guards/__tests__/dto-class-name-collision*.ts` — DTO 클래스명 중복을 잡는 신규 정적 가드
  (AST 기반) + fixture

`chat-channel-input-rules.ts`(전체 파일 Read 로 직접 확인), `chat-channel-rejection-messages.const.ts`,
`dto/chat-channel-config.dto.ts` 는 이번 라운드에서는 순수 주석(귀속 문구) 갱신 또는 이전 라운드에서
이미 반영된 상태이며, 실제 검증 로직(내부 필드 차단 5종 · PATCH 비밀 차단 2종 · provider 별
`inboundSigningPlaintext` 형식 검증)은 이전 라운드에서 이미 두-층(DTO + 서비스) 방어로 고정되어
있고 이번 diff 는 그 로직을 건드리지 않는다.

## 발견사항

없음. 이번 라운드에서 새로 도입된 보안 결함을 찾지 못했다.

아래는 결함은 아니지만 확인한 사항을 참고로 남긴다.

- **[INFO]** `rotateBotToken` 신규 응답 DTO(`ChatChannelRotateBotIdentityDto`)는 `botId`·`username`·
  `teamId`(Slack)·`publicKey`(Discord) 만 노출한다. `botToken`·`inboundSigningRef`·
  `inboundSigningPlaintext` 등 실제 비밀·비밀 참조는 이 응답 형태에 포함되지 않는다 — secret-store
  ref 만 config 에 남기고 평문은 응답에 싣지 않는다는 기존 설계(SS-SE-01)와 일치한다. `publicKey`
  는 Discord ed25519 **공개** 키(서명 검증용, 비민감)라 노출이 적절하다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (`ChatChannelRotateBotIdentityDto`, `ChatChannelRotateBotTokenDto`)

- **[INFO]** `translateSetupChannelError`(이번 diff 로 바뀌지 않음, 이전 라운드에서 이미 확정)는
  provider 원문 에러(`err.message`)를 클라이언트 응답에 싣지 않고 고정 client-safe 문자열만
  반환한다 — 원문은 호출자가 서버 로그에만 남긴다는 설계가 유지되고 있음을 재확인했다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 함수 `translateSetupChannelError`

- **[INFO]** `hasField`/`rejectBlockedField` 가 리터럴 필드명을 리플렉션(`obj[field]`)으로 조회하는
  자리를 확인했다. `field` 인자는 `ChatChannelBlockedField` 유니언(`'botTokenRef'`,
  `'inboundSigningRef'`, `'inboundSigning'`, `'botToken'`, `'inboundSigningPlaintext'`)으로 컴파일
  타임에 고정되어 호출부에서 사용자 입력이 그대로 property key 로 흘러들어갈 경로가 없다 —
  prototype pollution/property injection 우려 없음.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 함수 `hasField`, `rejectBlockedField`

- **[INFO]** `rotateBotToken` 컨트롤러 메서드의 `:id` 파라미터에 `ParseUUIDPipe` 가 없는 것을
  확인했다 — 같은 컨트롤러의 형제 rotate 계열(`revokePerTriggerToken` 등)과 다르다. 다만
  `TriggersService.findById` 는 TypeORM `repository.findOne({ where: { id, workspaceId } })` 로
  파라미터화 조회를 하므로 SQL 인젝션 경로는 아니며, 비-UUID 입력은 단순 조회 실패 → 404 로
  귀결되어 인가 우회로 이어지지 않는다. 이 항목은 이번 diff 의 변경 대상이 아니고(사전 존재
  코드), `plan/in-progress/chat-channel-rules-cleanup.md` 에 이미 후속 항목으로 등재되어 있다 —
  재차 지적하지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` 함수 `rotateBotToken` 시그니처

- **[INFO]** 신규 정적 가드(`dto-class-name-collision-guard.ts`)는 정규식이 아니라 TypeScript
  AST(`ts.createSourceFile`)로 `export class` 이름을 추출해, 이전 라운드에서 CRITICAL 로 지적된
  "동명 DTO 클래스가 `@nestjs/swagger` 스키마 레지스트리를 서로 덮어쓰는" 결함 클래스의 재발을
  전수(현재 256개 DTO 클래스, 중복 0건)로 고정한다. 로컬 저장소 파일만 읽고 외부/사용자 입력을
  다루지 않아 인젝션 표면이 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`

- **[INFO]** diff 전체(`codebase/`, `plan/`)에서 하드코딩된 실제 시크릿(API 키·비밀번호·인증서 등)
  패턴을 grep 했으나 발견되지 않았다 — 발견된 문자열(`NEW_TOKEN = '222222222:NewToken'`,
  `ISSUED_SECRET = 'newWebhookSecret'`, DTO `@ApiProperty example` 값들)은 모두 테스트 픽스처/
  swagger 예시용 합성 값이다.

## 요약

이번 라운드는 이전 라운드에서 CRITICAL(swagger 스키마 클래스명 충돌)·WARNING(응답 스키마가
Discord `publicKey` 를 누락해 문서가 실제 응답보다 좁음, `@ApiUnauthorizedResponse` 누락, PATCH
`null`/`''` 비밀 우회 경로 테스트 미고정) 로 지적된 항목들의 후속 조치이며, PATCH 경로의 비밀
차단(botToken·inboundSigningPlaintext, R-CC-21/D-1)과 provider 별 형식 검증(hex regex, ReDoS
위험 없는 고정 길이 패턴) 등 실제 보안 로직 자체는 이번 diff 로 변경되지 않았다. 신규 응답 DTO 는
실제 비밀을 노출하지 않으며, 에러 메시지도 provider 원문을 클라이언트에 흘리지 않는 기존 설계를
유지한다. 신규 정적 가드는 DTO 이름 충돌 재발을 AST 기반으로 전수 차단해 이전 라운드가 만들었던
결함 클래스의 회귀를 막는다. 이번 diff 범위에서 신규로 도입된 보안 취약점은 발견되지 않았다.

## 위험도

NONE
