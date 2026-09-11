# API 계약(API Contract) 리뷰

## 검토 범위

이번 diff(`impl-chat-channel-binder-t2`)는 `TriggersService` 의 private 메서드
`setupChatChannel` / `teardownChatChannel` / `buildCallbackUrl` 을 신규
`ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 옮기는 내부 리팩터다.

`git diff origin/main --stat -- codebase/backend/src/modules/triggers/` 로 실제 변경 파일을
직접 확인했다:

```
chat-channel-binder.service.spec.ts   | 141 ++
chat-channel-binder.service.ts        | 292 ++
trigger-callback-url.spec.ts          |  84 ++
trigger-callback-url.ts               |  57 ++
triggers.module.ts                    |   8 +-
triggers.service.spec.ts              |  52 +-
triggers.service.ts                   | 258 (거의 전부 삭제, 이동)
triggers.web-chat.spec.ts             |   2 +
```

`triggers.controller.ts` 는 diff 에 **전혀 포함되지 않았고**(`git diff` 결과 0줄),
`dto/` 디렉터리도 변경이 없다. 즉 엔드포인트 정의·요청/응답 DTO·라우팅은 이번 PR 의
변경 대상이 아니다.

`chat-channel-binder.service.ts` 와 옛 `triggers.service.ts` 삭제분을 라인 단위로
대조한 결과, `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`(→
`buildTriggerCallbackUrl`)의 로직·조건문·에러 코드·문자열이 **바이트 단위로 동일**하게
옮겨졌음을 확인했다(호출부만 `this.setupChatChannel(...)` →
`this.chatChannelBinder.setupChatChannel(...)` 로 위임 형태 변경).

## 대조 결과 — 계약 요소별

1. **하위 호환성**: 영향 없음. `BadRequestException({code:'CHAT_CHANNEL_ENDPOINT_REQUIRED', ...})`
   의 코드·메시지·발생 조건, `adapter.setupChannel` 성공/실패 시 `trigger.config`·
   `chatChannelHealth`·`chatChannelLastError` 갱신 로직이 이동 전후 동일함을 diff 로
   확인했다. 클라이언트가 관측하는 HTTP 응답·에러에 영향을 주는 변경이 없다.
2. **버전 관리**: 해당 없음 (엔드포인트 버전 표기 변경 없음).
3. **응답 형식**: 변경 없음. 이동된 코드는 응답 DTO 를 직접 구성하지 않고
   `trigger.config`/health 컬럼만 갱신하며, 응답 변환 지점(`triggers.controller.ts`,
   `dto/responses/trigger-response.dto.ts`)은 diff 밖이다.
4. **에러 응답**: 변경 없음. `CHAT_CHANNEL_ENDPOINT_REQUIRED` 400 의 코드·메시지가
   그대로다. `setupChannel` 실패 시 예외를 삼키고 `degraded` 로 저장하는 것도 동일
   (엔드포인트로는 여전히 200/201 이 나가고 실패는 `chatChannelHealth` 필드로 노출되는
   기존 계약 유지). `rotateChatChannelBotToken` 의 401/403→`BOT_TOKEN_INVALID` 400,
   그 외 실패→`CHAT_CHANNEL_SETUP_FAILED` 502 변환 로직도 손대지 않았다.
5. **요청 검증**: 변경 없음. `chatChannelCfg` 검증은 `TriggersService`/DTO 쪽에 그대로
   있고, 이동한 코드는 검증된 값을 인자로 받기만 한다. DTO 파일 diff 는 0줄.
6. **URL/경로 설계**: `buildTriggerCallbackUrl({baseUrl, endpointPath})` 의 출력 문자열
   (``${resolved.replace(/\/$/, '')}/api/hooks/${endpointPath.replace(/^\//, '')}``)이
   구 `buildCallbackUrl` 과 정확히 동일함을 diff 로 확인 — webhook callback URL 형태에
   영향 없음. 인자를 위치 인자에서 이름 인자 객체로 바꾼 것은 함수 내부 시그니처일 뿐
   외부에 노출되는 HTTP 계약이 아니다.
7. **페이지네이션**: 해당 없음 (목록 API 아님, 컨트롤러 변경 없음).
8. **인증/인가**: 변경 없음. 컨트롤러 가드·정책은 diff 밖. `ChatChannelBinderService`
   가 `triggers.module.ts` 의 `providers` 에만 등록되고 **export 되지 않아**(`triggers.module.ts`
   주석 참조) 모듈 외부에서 직접 주입할 수 없다 — 공개 표면이 오히려 좁아진 방향이라
   인가 경계에 부정적 영향은 없다.

## 발견사항

- **[INFO]** `rotate-bot-token` 엔드포인트의 OpenAPI 문서화 공백은 이번 diff 범위 밖의
  사전 존재 갭이며, 이번 변경이 만든 것이 아니다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (이번 diff 에
    포함되지 않은 파일이라 게이트 숫자 인용 불가).
  - 상세: `--impl-prep` 산출물 `review/consistency/2026/09/11/17_39_32/convention_compliance.md`
    가 이미 지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    developer 항목으로 등재되어 있다(중복 등재 불필요). 직전 두 라운드
    (`review/code/2026/09/11/18_04_36/api_contract.md`, `19_06_54` 계열)도 같은 결론을
    냈다.
  - 제안: 별도 후속 작업에서 응답 DTO·요청 DTO·에러 데코레이터 추가(이미 트래커 등재,
    이번 PR 조치 대상 아님).

- **[INFO]** `chat-channel-binder.service.ts` JSDoc(`setupChatChannel` 상단 표)이 문서화하는
  `storeUserSuppliedSecrets`/`preservedInboundSigningRef` 게이팅 규약(R-CC-21, PATCH 는
  사용자 제공 비밀을 쓰지 않되 telegram server-issued 서명은 예외)은 최근 커밋
  (`fad828884`, `df1962e25`, `c0f2a885c`)에서 이미 spec·구현 양쪽에 반영된 기존 계약이다.
  이번 diff 는 그 계약을 **그대로 옮겼을 뿐** 변경하지 않았음을 옛 `triggers.service.ts`
  삭제분과 대조해 확인했다 — 별도 조치 불필요.

## 검증 절차

- `git diff origin/main --stat -- codebase/backend/src/modules/triggers/` 로 변경 파일
  전수 확인 — `triggers.controller.ts`, `dto/**` 변경 0건.
- `git diff origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts` 전문을
  읽어 삭제된 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 블록과
  `chat-channel-binder.service.ts`/`trigger-callback-url.ts` 신설분을 라인 단위 대조.
- 저장소 파일은 읽기만 했고 뮤테이션·임시 파일 생성 없음. `git status --short` 로 확인한
  결과 이 세션이 만든 것은 `review/code/2026/09/11/19_30_49/` (본 리뷰 산출물) 하나뿐이다.

## 요약

이번 diff 는 `TriggersService` 의 chat-channel adapter setup/teardown/URL 조립 로직을 새
`ChatChannelBinderService` 및 순수 함수 `buildTriggerCallbackUrl` 로 옮기는 순수 내부
리팩터다. `triggers.controller.ts`·DTO 는 diff 에 전혀 포함되지 않았고, 이동된 코드의
에러 코드·메시지·응답 갱신 로직·webhook callback URL 형태·비밀 쓰기 게이팅(R-CC-21)이
이동 전후 동일함을 소스 대조로 확인했다 — 클라이언트가 관측하는 API 계약(요청/응답
스키마·에러 형식·URL·인증)에 어떠한 변경도 없다. 유일하게 API 계약과 관련된 발견은
diff 범위 밖의 사전 존재 갭(`rotate-bot-token` OpenAPI 문서화 부재)이며 이미 별도로
추적되고 있어 정보성으로만 남긴다.

## 위험도

NONE
