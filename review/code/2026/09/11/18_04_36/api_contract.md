# API 계약(API Contract) 리뷰

## 검토 범위

이번 diff(T2, `impl-chat-channel-binder-t2`)는 `TriggersService` 의 private 메서드
`setupChatChannel` / `teardownChatChannel` / `buildCallbackUrl` 을 각각 신규
`ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 **그대로 옮기는** 내부 리팩터다.
`triggers.controller.ts`(엔드포인트 정의)는 diff 에 포함되지 않았고, 호출자인
`TriggersService.create()`/`update()`/`remove()` 는 호출 대상만
`this.setupChatChannel(...)` → `this.chatChannelBinder.setupChatChannel(...)` 로
바뀐다 — 인자·반환 타입·호출 순서·try/catch 경계는 동일하다.

파일 7~16(plan/review 산출물)은 코드가 아니라 이번 T2 작업의 계획·검증 문서이므로
API 계약 관점에서 직접 검토 대상이 아니다. 다만 8·9번 문서에 담긴 `--impl-prep`
consistency-check 결과(특히 `rotate-bot-token` OpenAPI 데코레이터 부재) 는 API 계약과
직결되므로 아래에 참고로 옮겨 적는다.

## 대조 결과 — 계약 요소별

1. **하위 호환성**: 영향 없음. `setupChatChannel`/`teardownChatChannel` 의 시그니처,
   `endpointPath` 부재 시 던지는 `BadRequestException({code:'CHAT_CHANNEL_ENDPOINT_REQUIRED', ...})`
   의 코드·메시지, `adapter.setupChannel` 성공/실패 시 `trigger.config`·
   `chatChannelHealth`·`chatChannelLastError` 갱신 로직이 이동 전후 바이트 단위로 동일함을
   `triggers.service.ts` 구 버전 삭제분과 `chat-channel-binder.service.ts` 신설분을 대조해
   확인했다. `triggers.service.spec.ts`/`triggers.web-chat.spec.ts` 의 diff 도 `+12/-0`
   (provider 등록 10줄 + import 2줄)뿐이고 `expect` 단언은 한 줄도 바뀌지 않았다 — 클라이언트가
   관측하는 HTTP 응답·에러에 영향을 주는 변경이 없다.
2. **버전 관리**: 해당 없음 (엔드포인트 버전 표기 변경 없음).
3. **응답 형식**: 변경 없음. `setupChatChannel` 은 응답 DTO 를 직접 구성하지 않고
   `trigger.config`/health 컬럼만 갱신하며, 이 값을 응답으로 변환하는 지점(`triggers.service.ts`
   의 `create()`/`update()` 재조회·`sanitizeForResponse`)은 diff 밖이다.
4. **에러 응답**: 변경 없음. `CHAT_CHANNEL_ENDPOINT_REQUIRED` 400 의 코드·메시지·발생 조건이
   그대로다. `setupChannel` 실패 시 `catch` 블록이 예외를 삼키고 `degraded` 로 저장하는 것도
   동일(엔드포인트로는 여전히 200/201 이 나가고 실패는 `chatChannelHealth` 필드로 노출되는
   기존 계약 유지).
5. **요청 검증**: 변경 없음. `chatChannelCfg` 검증(`assertChatChannelInputSafe` 등)은
   `TriggersService` 쪽에 그대로 있고, 이동한 코드는 검증된 값을 받기만 한다.
6. **URL/경로 설계**: `buildTriggerCallbackUrl(baseUrl, endpointPath)` 의 출력 문자열
   (``${resolved.replace(/\/$/, '')}/api/hooks/${endpointPath.replace(/^\//, '')}``)이 구
   `buildCallbackUrl` 과 정확히 동일함을 diff 로 확인 — webhook callback URL 형태에 영향 없음.
7. **페이지네이션**: 해당 없음 (목록 API 아님).
8. **인증/인가**: 변경 없음. 컨트롤러 가드·정책은 diff 밖.

## 발견사항

- **[INFO]** `rotate-bot-token` 엔드포인트의 OpenAPI 문서화 공백은 이번 T2 diff 가 만든 것이
  아니라 사전에 존재하던 갭이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` — 이번
    diff 파일 목록(1~6번)에 포함되지 않아 게이트 숫자 인용 불가. `--impl-prep` 산출물
    `review/consistency/2026/09/11/17_39_32/convention_compliance.md` WARNING #3 참조.
  - 상세: spec `15-chat-channel.md` §5.4 가 `rotate-bot-token` 의 성공 응답 DTO·요청 DTO·에러
    코드 6종을 계약으로 문서화하는데, 컨트롤러에는 `@ApiOkResponse`/`@ApiBody`/
    `@ApiBadRequestResponse` 등 OpenAPI 데코레이터가 전혀 없다(형제 엔드포인트
    `revokePerTriggerToken` 은 갖추고 있어 같은 컨트롤러 안에서 비대칭). T2 diff 는 이
    컨트롤러 파일을 건드리지 않으므로 이번 변경이 만든 회귀는 아니며, 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 항목으로
    등재되어 있다(중복 등재 불필요).
  - 제안: 별도 후속 작업에서 응답 DTO 신설 + `RotateBotTokenDto` 요청 DTO 승격 + 에러
    데코레이터 추가(이미 트래커에 등재됨, 이번 PR 의 조치 대상 아님).

## 요약

이번 diff 는 `TriggersService` 의 chat-channel adapter setup/teardown/URL 조립 로직을 새
`ChatChannelBinderService` 및 순수 함수 `buildTriggerCallbackUrl` 로 옮기는 **순수 내부
리팩터**다. 엔드포인트 정의(`triggers.controller.ts`)는 손대지 않았고, 이동된 코드의
에러 코드·메시지·응답 갱신 로직·webhook callback URL 형태가 이동 전후 동일함을 소스
대조로 확인했다 — 클라이언트가 관측하는 API 계약(요청/응답 스키마·에러 형식·URL·인증)에
어떠한 변경도 없다. 유일하게 API 계약과 관련된 발견은 이번 diff 범위 밖의 사전 존재
갭(`rotate-bot-token` OpenAPI 문서화 부재)이며 이미 별도로 추적되고 있어 정보성으로만
남긴다.

## 위험도

NONE
