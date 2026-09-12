# API 계약(API Contract) 리뷰

## 컨텍스트 — 5라운드째, 이번 라운드의 코드 변경분(delta)은 주석뿐

이 세션에서 `api_contract` 리뷰는 이미 4차례 돌았다.

- 라운드 1(`16_17_57`): **CRITICAL** 1건(신규 응답 DTO `ChatChannelBotIdentityDto` 가 기존
  `chat-channel-config.dto.ts` 의 동명 클래스와 swagger 스키마 이름 충돌) · **WARNING** 1건
  (Discord 전용 `publicKey` 필드 누락으로 문서가 실응답보다 좁음).
- 라운드 2(`16_39_18`): 위 두 건 해소 확인(개명 `ChatChannelRotateBotIdentityDto` + `publicKey`
  추가, 파일을 `dto/responses/` 규약 자리로 재배치) — **LOW**.
- 라운드 3(`17_02_19`): 재배치 후 재검증, API 표면 변화 없음(추가된 것은 `repo-guards` 정적
  가드/테스트뿐) — **NONE**.
- 라운드 4(`17_23_34`): 코드 변경 없음(라운드 3 이후 신규 파일은 여전히 `repo-guards` 가드뿐) —
  **NONE**.

이번 라운드(`17_39_51`) 직전 커밋(`01f03524c`)을 `git show`로 직접 열어 대조했다. 변경은 라운드
4 가 낸 WARNING(`review-citations.md §2` bare `hh_mm_ss` 인용 금지) 조치이며, 손댄 3개 애플리케이션
파일(`chat-channel-input-rules.spec.ts` · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
· `triggers.service.ts`) 모두 **JSDoc/`//` 주석 문자열 안의 인용 경로 표기만** 바뀌었다
(`` `/ai-review` `16_17_57` `` → `` `review/code/2026/09/12/16_17_57` `` 형태 5곳). 코드 로직·
타입 선언·데코레이터·필드 순서는 한 글자도 바뀌지 않았다.

`triggers.controller.ts`(`rotateBotToken` 데코레이터 블록 — `@ApiUnauthorizedResponse` ·
`@ApiForbiddenResponse` · `@ApiBadRequestResponse` · `@ApiBadGatewayResponse` ·
`@ApiNotFoundResponse` · `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)`, 반환 타입
`Promise<ChatChannelRotateBotTokenDto>`)를 직접 다시 열어 라운드 2~4 가 기록한 상태와 대조했고
동일함을 확인했다.

## 발견사항

없음.

과거 라운드가 이미 스코프 밖/INFO 로 확정해 둔 항목(요청 바디가 DTO 클래스가 아닌 인라인
타입 `{ newBotToken?: string }`이라 `@ApiBody` 자동 문서화가 안 됨, `:id` 파라미터에
`ParseUUIDPipe` 부재)은 이번 라운드에도 코드가 그대로임을 확인했다 — 4라운드 연속 같은 판정이라
재기재하지 않는다.

## 요약

라운드 1~2 가 낸 CRITICAL(swagger 스키마 이름 충돌)·WARNING(`publicKey` 누락)은 라운드 2 조치로
해소되어 라운드 3·4 가 독립 재검증(NONE)했다. 이번 라운드에서 `codebase/**` 에 생긴 유일한 변경은
직전 라운드가 지적한 리뷰 인용 표기(bare `hh_mm_ss` → 전체 경로)를 주석 문자열 안에서 고친 것뿐이며,
요청/응답 스키마·라우팅·HTTP 상태 코드·인증/인가 데코레이터·페이지네이션 어느 축에도 영향이 없다.
API 계약 관점에서 이번 라운드는 수렴 상태이며 신규 지적 사항이 없다.

## 위험도

NONE
