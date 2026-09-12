# 보안(Security) 코드 리뷰

## 검토 범위와 방법

`chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
`dto/chat-channel-config.dto.ts` · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규) ·
`dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `triggers.service.ts` 를 현재
워크트리 상태로 직접 `Read` 해 대조했다 (diff 는 이전 두 라운드의 CRITICAL/WARNING fix 를 이미
반영한 최종 상태). `plan/in-progress/**` · `review/code/2026/09/12/{16_17_57,16_39_18}/**` ·
`review/consistency/2026/09/12/15_53_35/**` 는 프로세스 산출물이라 애플리케이션 보안 표면이
없고, 시크릿 패턴(`AKIA`/`ghp_`/`xox[baprs]-`/`BEGIN … PRIVATE`) 전수 grep 결과도 0건이라
상세 분석에서 제외했다. 저장소 파일은 조회만 했다 — `git status --short` 로 확인한 결과 이번
세션이 만든 변경은 없다(이 리뷰 자신의 출력 디렉터리만 untracked로 존재).

이 diff 는 **순수 리팩터(에러 봉투 헬퍼화·이중 캐스팅 제거) + `rotateBotToken` swagger 응답
문서화**이며, 이전 두 라운드(`16_17_57`→CRITICAL 1·WARNING 3, `16_39_18`→WARNING 3)가 이미 낸
지적을 조치한 뒤의 상태다. 조치 결과를 코드 레벨에서 직접 재확인했다.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 급 보안 결함은 발견하지 못했다. 확인 내역과 참고용 관찰만
남긴다.

- **[INFO]** 스키마 이름 충돌(직전 라운드 CRITICAL) 해소를 직접 재확인함
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` — `export class ChatChannelRotateBotIdentityDto` (함수/클래스 단위 인용. 파일이 라운드 2에서 `dto/chat-channel-rotate-bot-token.dto.ts` → 현재 자리로 이동됐다) vs `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:149` `export class ChatChannelBotIdentityDto`
  - 상세: `grep -rhoE "export class [A-Za-z0-9_]+" codebase/backend/src --include="*.dto.ts" | sort | uniq -c | sort -rn | awk '$1>1'` 로 전 `*.dto.ts` 를 재스캔해 동명 클래스 **0건**을 직접 확인했다(RESOLUTION.md 의 실측 주장을 독립 재현). `@nestjs/swagger` 가 스키마를 클래스 `.name` 으로 등록하는 특성상 이름 충돌은 OpenAPI 스키마 오염·차기 메이저 하드 에러로 이어지는 실질 결함 클래스인데, 개명(`ChatChannelRotateBotIdentityDto`)으로 정확히 닫혔다.
  - 제안: 없음 — 해소 확인.

- **[INFO]** `null`/`''` 로 위장한 비밀 필드가 두 층(DTO + 서비스) 모두를 통과하던 결함 클래스가 이번 diff 로 원천 차단됨
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:70-75` (`hasField`), `:85-92` (`rejectBlockedField`)
  - 상세: `hasField` 가 `typeof (...)[field] !== 'undefined'` 로 **존재 여부**(존재하면 값이 `null`/`''` 여도 true)를 판별해, `botToken`/`inboundSigningPlaintext` 를 `null`/`''` 로 보낸 PATCH 요청도 `rejectBlockedField` → `throwInvalidField` 로 거부된다. `@IsEmpty()` 는 class-validator 정의상 `null`/`''`/`undefined` 를 모두 "empty"로 보아 통과시키므로, 이 서비스 레이어 존재 검사가 없으면 그 값들이 DTO 검증을 우회해 사용자 비밀(chat 채널 봇 토큰·서명 시크릿)이 무시된 채 통과할 수 있는 자리였다(`chat-channel-rejection-messages.const.ts` 헤더가 그 두-층 등가성을 설계로 선언). `chat-channel-input-rules.spec.ts` 의 신규 `it.each(['null', null], ['빈 문자열', ''])` 케이스 4건이 이 판별을 회귀 방지로 고정한다 — truthy 판별(`!!value`)로 되돌리는 뮤턴트를 넣으면 14건 RED 가 남을 것 확인.
  - 제안: 없음 — 개선 확인, 회귀 테스트도 존재.

- **[INFO]** `translateSetupChannelError` 는 provider 원문/URL 을 응답 본문에 싣지 않는 계약을 그대로 유지
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:329-348`
  - 상세: 이번 diff 는 이 함수의 로직을 바꾸지 않았다. 400(`BOT_TOKEN_INVALID`)·502(`CHAT_CHANNEL_SETUP_FAILED`) 두 분기 모두 고정 client-safe 메시지만 반환하고, provider 원문 에러(`err.message`)는 `triggers.service.ts:1076-1080` 의 `this.logger.warn(...)` 로만 나간다 — 서버 로그와 HTTP 응답이 분리돼 있어 provider 내부 정보(HMAC 실패 원인, 타임아웃 상세 등)가 클라이언트에 노출되지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 `ChatChannelRotateBotIdentityDto` 응답 필드에 시크릿 없음 — 직접 확인
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
  - 상세: `botId`(number)·`username`(string)·`teamId?`(Slack workspace id)·`publicKey?`(Discord ed25519 **public** key, 주석에 "비민감" 명시)만 있고 회전된 bot token 평문·secret store ref 는 없다. `SS-SE-01`(secret-store.md §4) 의 "응답에는 secret 을 포함하지 않는다" 원칙과 정합. `ChatChannelRotateBotTokenDto` 도 `rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity` 뿐이라 동일.
  - 제안: 없음.

- **[INFO]** 인가 데코레이터 체인 무변경 — `rotateBotToken` 은 `@Roles('editor')`(controller `triggers.controller.ts:258`) + 클래스 레벨 `@ApiBearerAuth('access-token')` + `@WorkspaceId()`/`@CurrentUser('sub')` 파라미터 데코레이터를 그대로 유지한다. 이번 diff 는 이 체인을 건드리지 않았고, 서비스 쪽도 `findById(id, workspaceId)`(`triggers.service.ts:999`)로 워크스페이스 스코핑을 유지한다 — 인가 우회 표면 변화 없음.

- **[INFO]** `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 가 없음 (이번 diff 의 신규 결함 아님, 스코프 밖)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:285-286` (`@Param('id') triggerId: string`)
  - 상세: 같은 컨트롤러의 `findOne`·`update`·`remove`·`rotateNotificationSecret`·`revokePerTriggerToken` 은 `@Param('id', ParseUUIDPipe)` 를 쓰는데 `rotateBotToken` 만 raw string 이다. 이번 diff 이전부터 존재하던 상태이며(라운드 1·2 리뷰 모두 동일하게 지적·이월), 비-UUID 입력은 `findById` 조회 실패로 `RESOURCE_NOT_FOUND` 404 에 수렴해 인가 우회·정보 노출로 이어지지 않는다. `plan/in-progress/chat-channel-rules-cleanup.md` 의 스코프(swagger 응답 문서화)에도 포함되지 않은 항목이라 이번 PR 이 만들거나 악화시킨 결함이 아니다.
  - 제안: 조치 불요(이번 PR 스코프 밖) — 별도 후속으로 다른 rotate 계열과 일관성을 맞출 것을 권장.

- 인젝션(SQL/XSS/커맨드/경로탐색): 이번 diff 는 DB 쿼리·쉘 실행·파일 경로 조작을 포함하지 않는다. `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX` 는 값 변경 없이 import 위치만 유지되며, `hasField` 의 인덱스 접근은 사용자 입력을 코드/쿼리로 해석하지 않는 존재 검사일 뿐이다.
- 하드코딩된 시크릿: 신규/변경 테스트의 `botToken: '1:a'` 류는 명백한 더미 값이며, 저장소 전체 시크릿 패턴 grep 0건.
- 암호화: 이번 diff 는 해시/암호화 알고리즘을 도입·변경하지 않는다.
- 의존성: 신규 외부 의존성 없음(`@nestjs/swagger` 기존 데코레이터 재사용).

## 요약

`chat-channel-input-rules.{ts,spec.ts}` 의 헬퍼 추출과 `rotateBotToken` 응답 swagger 문서화는
현재 워크트리 상태 기준으로 응답 형태·인가 체인·에러 노출 계약을 바꾸지 않는 순수 정리다.
직전 두 라운드가 지적한 CRITICAL(스키마 이름 충돌)·WARNING(응답 필드 누락 등)은 독립 재확인
(전수 클래스명 스캔 0건 중복, 필드 대조)으로 실제 해소됐음을 확인했다. 오히려 `hasField` 의
엄격한 존재 판별이 `null`/`''` 로 비밀 필드를 우회하는 결함 클래스를 원천 차단하고 회귀
테스트로 고정하는 방향의 개선이다. 새로 발견된 CRITICAL/WARNING 은 없으며, 유일한 INFO
(`ParseUUIDPipe` 부재)는 이 PR 이전부터 있던 스코프 밖 사안이다.

## 위험도

NONE
