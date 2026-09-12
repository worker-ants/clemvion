# 신규 식별자 충돌 검토 — spec-draft-chat-channel-doc-batch

대상: `plan/in-progress/spec-draft-chat-channel-doc-batch.md` (target),
영향 spec: `spec/5-system/15-chat-channel.md` · `spec/conventions/swagger.md` ·
`spec/conventions/chat-channel-adapter.md` · `spec/4-nodes/7-trigger/providers/slack.md` ·
`spec/5-system/2-api-convention.md` · `spec/5-system/3-error-handling.md`

## 발견사항

- **[WARNING]** `slack.md §3.1` 이 새로 문서화하는 `token_expired` 값이 저장소 다른 도메인의
  동일 리터럴과 텍스트가 겹친다
  - target 신규 식별자: `token_expired` — Slack `auth.test` 응답 `{ ok:false, error: 'token_expired' }`
    (`SLACK_CREDENTIAL_REJECTED_ERRORS` 5번째 값, `BOT_TOKEN_INVALID` 판별 근거)
  - 기존 사용처:
    - `codebase/backend/src/modules/integrations/integration-status-reason.ts:20` — `Integration.status_reason`
      DB 컬럼 값 `'token_expired'` (refresh_token 없는 OAuth provider 의 토큰 만료, chat-channel 과 무관한
      일반 통합 도메인)
    - `spec/1-data-model.md:310` — 이미 이 컬럼값을 `TOKEN_EXPIRED`(JWT REST 에러)·`auth.token_expired`(WS 이벤트)와
      "표기가 유사하나 별개 네임스페이스" 라고 명시적으로 각주 처리해 둔 전례가 있음
    - `spec/2-navigation/4-integration.md:966,985` 등 다수 — 같은 값을 계속 사용
  - 상세: 코드(`slack.adapter.ts:59`)에는 이미 `'token_expired'` 가 들어 있어(#1326 구현) 값 자체는
    새로 만드는 게 아니라 spec 텍스트에 처음 등재하는 것이다. 그러나 저장소는 이미 "겉보기엔 같은
    문자열, 실은 다른 네임스페이스" 케이스(`token_expired`/`TOKEN_EXPIRED`/`auth.token_expired`)를
    한 번 각주로 명시한 선례가 있고, 이번 target 은 그 리스트에 **다섯 번째 겹침**(Slack API 응답
    필드 값)을 추가하면서도 상호 참조를 달지 않는다. 실행 경로가 완전히 분리돼(한쪽은 Integration
    엔티티 컬럼, 한쪽은 chat-channel 어댑터의 provider 응답 파싱) 런타임 오분류 위험은 없지만, 다음
    사람이 `grep token_expired` 로 전체를 훑을 때 두 무관한 기능을 같은 개념으로 혼동할 여지가 있다.
  - 제안: 이번 diff 뒤에 붙는 문단(§Rationale 또는 값 옆 각주)에 "이 `token_expired` 는 Slack
    API 응답 문자열이고, `Integration.status_reason` 의 동명 값([1-data-model.md §2.10](../../../1-data-model.md#210-integration))과
    **무관한 별도 네임스페이스**다" 한 줄을 추가해 이미 확립된 각주 관례를 확장한다. (등급을
    WARNING 으로 둔 이유: 두 값이 실제로 비교/혼용되는 코드 경로가 없어 CRITICAL 은 아니다.)

- **[INFO]** 신규 식별자 자체는 대부분 "새로 도입"이 아니라 "이미 구현된 코드/기존 spec 값의
  spec 카탈로그 등재"라 충돌 표면이 작다
  - 확인 대상: `INVALID_BOT_TOKEN` · `BOT_TOKEN_INVALID` · `CHAT_CHANNEL_NOT_CONFIGURED` ·
    `CHAT_CHANNEL_PROVIDER_UNKNOWN` · `CHAT_CHANNEL_ENDPOINT_REQUIRED` · `CHAT_CHANNEL_SETUP_FAILED`
    (`3-error-handling.md` 신설 §1.12), `CCH-NF-03` 참조(`2-api-convention.md §7` 신규 행),
    `ChatChannelRateLimiterService` / `config.chatChannel.rateLimitPerMinute`,
    `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`,
    `ChatChannelRotateBotIdentityDto` vs `ChatChannelBotIdentityDto`,
    `dto-class-name-collision{,-guard}.ts` / `fixtures/dto-class-collision/*.ts`
  - 전수 grep 결과: 위 식별자 전부 `spec/5-system/15-chat-channel.md`·`spec/data-flow/14-chat-channel.md`·
    codebase(`triggers.service.ts`·`triggers.controller.ts`·`chat-channel-*.ts`·해당 `*.spec.ts`)에
    **이미 같은 의미로 일관되게 존재**한다. 타 도메인에서 동일 이름을 다른 의미로 쓰는 사례는
    0건이었다(`CHAT_CHANNEL_ENDPOINT_REQUIRED` 는 §1.10 `TRIGGER_ENDPOINT_PATH_CONFLICT` 와 코드도
    의미도 다르며 혼동 표가 draft 안에 이미 있음). `swagger.md` frontmatter `code:` 에 추가되는
    `dto-class-name-collision*.ts` / `fixtures/dto-class-collision/*.ts` 글롭도 다른 spec 문서의
    frontmatter 가 같은 경로를 다른 의미로 소유하고 있지 않음을 확인했다(`grep -rl dto-class-collision spec/` → 0건).
    `POST /api/triggers/:id/chat-channel/rotate-bot-token` endpoint 도 기존 구현·spec 과 동일해
    신규 endpoint 충돌 없음. 별도 조치 불요, 기록용.

- **[INFO]** `15-chat-channel.md` `code:` 프론트매터 glob 확장(`dto/chat-channel-*.dto.ts` →
  `dto/**/chat-channel-*.dto.ts`)은 `2-navigation/2-trigger-list.md` 의 기존 `dto/**` 글롭과
  이미 겹쳐 있던 `dto/chat-channel-config.dto.ts` 소유권 중복을 새로 만들지 않는다 — 두 파일 다
  이 diff 이전부터 양쪽 frontmatter 에 걸쳐 있었다(전례, 목적이 다른 SoT 참조이므로 정상). target
  이 이 중복을 **악화**시키지도, 처음 만들지도 않으므로 발견사항으로 등재하지 않고 참고만 남긴다.

## 요약

target 이 도입하는 표면적 "신규" 식별자(에러 코드 6종·CCH-NF-03 행·서비스명·DTO 경로 등)는
대부분 실제로는 **이미 구현·spec 에 존재하는 것을 중앙 카탈로그/frontmatter 에 뒤늦게 등재**하는
것이라 저장소 전체 grep 결과 다른 의미로 쓰이는 기존 사용처가 없었다(진짜 CRITICAL 충돌 0건).
유일하게 주의할 대상은 `slack.md` 가 새로 문서화하는 값 `token_expired` 로, chat-channel 과 무관한
`Integration.status_reason` 도메인이 이미 같은 문자열을 다른 의미로 쓰고 있고 저장소가 그 옆
값들(`TOKEN_EXPIRED`/`auth.token_expired`)에 대해서는 이미 "별개 네임스페이스" 각주를 남긴 전례가
있다 — 실행 경로 분리로 런타임 위험은 없으나 문서 일관성 차원에서 같은 각주 관례를 이 값에도
확장할 것을 권고한다(WARNING, 비차단).

## 위험도

LOW
