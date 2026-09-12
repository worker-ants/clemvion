# API 계약(API Contract) 리뷰

## 컨텍스트 — 4라운드째, 코드 변경분(delta)은 0

이 diff(`origin/main..HEAD`)는 같은 세션에서 api_contract 리뷰가 이미 3차례 돌았다.

- 라운드 1(`16_17_57`): **CRITICAL** 1건(신규 응답 DTO `ChatChannelBotIdentityDto` 가 기존
  `chat-channel-config.dto.ts` 의 동명 클래스와 swagger 스키마 이름 충돌) · **WARNING** 1건
  (Discord 전용 `publicKey` 필드 누락으로 문서가 실응답보다 좁음).
- 라운드 2(`16_39_18`): 위 두 건 해소 확인(개명 `ChatChannelRotateBotIdentityDto` + `publicKey`
  추가) — **LOW**. 추가로 파일을 `dto/` → `dto/responses/`(swagger.md §5-1 규약 자리)로 재배치.
- 라운드 3(`17_02_19`): 재배치 후 import 경로·spec glob 매칭까지 재검증, CRITICAL/WARNING
  **없음** — **NONE**. 그 라운드가 낸 유일한 조치 항목(W1)은 `testing` 관점(DTO 클래스명 중복
  재발 방지 가드 신설)이었고 api_contract 관점 지적은 아니었다.

이번 라운드(`17_23_34`)에서 `git diff --stat origin/main..HEAD -- codebase/backend/src/modules/triggers`
와 라운드 3 시점 이후의 신규 커밋(`3c9f4dd12`)을 직접 대조했다. 라운드 3 이후 추가된 코드는
`codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` ·
`dto-class-name-collision.spec.ts` · `fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts`
뿐이다 — 전부 저장소 내부 정적 가드/테스트 픽스처이며, 컨트롤러·DTO·서비스 반환 타입 등 실제
HTTP API 표면(엔드포인트·요청/응답 스키마·상태 코드·인증 데코레이터)은 라운드 3 검증 시점과
**한 글자도 달라지지 않았다.** `triggers.controller.ts`(`rotateBotToken` 데코레이터 블록·반환
타입 `Promise<ChatChannelRotateBotTokenDto>`)와
`dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 를 다시 열어 라운드 2·3 이 기록한
필드·클래스명과 대조했고 동일함을 확인했다.

## 발견사항

없음. (신규 repo-guard 파일은 `*.dto.ts` 의 `export class` 이름 중복을 정적으로 세는 개발 도구용
테스트로, API 요청/응답 계약·라우팅·인증에 영향을 주는 표면이 아니다.)

과거 라운드가 이미 스코프 밖/INFO 로 확정해 둔 항목(요청 바디 미-DTO화, `:id` 의
`ParseUUIDPipe` 부재)은 이번 라운드에도 코드가 그대로임을 확인했다 — `triggers.controller.ts`
의 `rotateBotToken(@Param('id') triggerId: string, @Body() body: { newBotToken?: string }, ...)`
는 이번 diff 대상이 아니고 3라운드 연속 같은 판정이라 재기재하지 않는다.

## 요약

라운드 1~2 가 낸 CRITICAL(swagger 스키마 이름 충돌)·WARNING(`publicKey` 누락)은 라운드 2 조치로
해소됐고 라운드 3 이 독립 재검증으로 확정(NONE)했다. 이번 라운드에서 `codebase/**` 에 추가된
유일한 변경은 그 CRITICAL 의 재발을 막는 순수 정적 가드/테스트(`dto-class-name-collision`)이며
API 요청/응답 스키마·라우팅·인증·페이지네이션·에러 봉투 어느 축에도 변화가 없다. API 계약
관점에서 이번 라운드는 수렴 상태다.

## 위험도

NONE
