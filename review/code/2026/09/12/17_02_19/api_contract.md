# API 계약(API Contract) 리뷰

## 컨텍스트 — 이 라운드는 두 차례 조치 뒤의 재검증이다

이 diff(`origin/main..HEAD`, 커밋 `18b0c6aa6`→`d8ad68b25`→`e07521a27`)는 이미 같은 세션의
api_contract 리뷰가 두 차례 돌았다:

- 라운드 1(`16_17_57`): **CRITICAL** 1건(신규 응답 DTO 클래스 `ChatChannelBotIdentityDto` 가
  기존 `chat-channel-config.dto.ts` 의 동명 클래스와 swagger 스키마 이름 충돌) · **WARNING** 1건
  (신규 응답 DTO 가 Discord 의 실제 wire 필드 `publicKey` 를 누락).
- 라운드 2(`16_39_18`): 위 두 건이 해소됐음을 재검증(LOW).

이번 라운드에서는 위 조치가 **실제로 현재 트리에 반영돼 있는지**를 코드를 직접 열어 독립적으로
다시 확인했고(저장소에 아무것도 쓰지 않았다 — `git status --short` 로 `review/code/2026/09/12/17_02_19/`
외 변경 없음을 확인), 추가로 파일 재배치(라운드 2 `W1`: `dto/` → `dto/responses/`)가 import 경로·
spec glob 매칭과 정합한지를 새로 검증했다.

## 재검증 결과

- **스키마 이름 충돌 (라운드 1 CRITICAL)** — `grep -rn "class ChatChannelBotIdentityDto\|class
  ChatChannelRotateBotIdentityDto" codebase/backend/src --include="*.dto.ts"` 결과 `chat-channel-config.dto.ts:149`
  (`ChatChannelBotIdentityDto`)와 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts:35`
  (`ChatChannelRotateBotIdentityDto`)로 이름이 완전히 갈려 있다. → **해소 확인**.
- **문서가 실응답보다 좁음 (라운드 1 WARNING)** — `dto/responses/chat-channel-rotate-bot-token-response.dto.ts:60-62`
  에 `publicKey?: string`(`@ApiPropertyOptional`)이 있고, `triggers.service.ts:997` 의 서비스 반환
  타입이 `NonNullable<ChatChannelConfig['botIdentity']> | null` 로 SoT(`chat-channel/types.ts:55-61`,
  `botId`/`username`/`teamId?`/`publicKey?`)를 직접 참조한다. 필드 4종이 DTO·SoT·서비스 실 반환문
  (`triggers.service.ts:1123`, `mergedChannel.botIdentity ?? null`) 세 지점에서 정확히 일치함을
  직접 대조했다. → **해소 확인**.
- **파일 재배치(라운드 2 W1) 의 import·glob 정합성** — `triggers.controller.ts` 의
  `import { ChatChannelRotateBotTokenDto } from './dto/responses/chat-channel-rotate-bot-token-response.dto';`
  가 실제 파일 위치(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)와 일치한다.
  spec-link 관점에서도 `spec/5-system/15-chat-channel.md` 자신의 `code:` glob(`dto/chat-channel-*.dto.ts`,
  `*` 가 `/` 를 안 넘음)은 이 새 위치를 못 잡지만, `spec/2-navigation/2-trigger-list.md` 의
  `dto/**`(glob 확인: 해당 문서 `code:` 13행)가 이 자리를 덮어 spec-link 판정 자체는 유지된다 —
  두 spec 문서에 직접 grep 해 확인. 다만 "chat-channel spec 이 자기 파일을 인지하는가" 축은 여전히
  갭이고, 이는 이미 `rationale_continuity`(`review/consistency/2026/09/12/15_53_35/`) WARNING 과
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재돼
  있어 이번 라운드에서 새로 지적하지 않는다.
- **404 문서화 정확성** — `triggers.controller.ts:277-280` 의 `@ApiNotFoundResponse({ description:
  'RESOURCE_NOT_FOUND — trigger 미존재 또는 워크스페이스 권한 없음' })` 은 `TriggersService.findById`
  (`triggers.service.ts:342-354`, `{ id, workspaceId }` 조건 미매치 시 `NotFoundException({code:
  'RESOURCE_NOT_FOUND', ...})`)와 정확히 일치 — 워크스페이스 스코프 미매치와 단순 미존재를 같은
  404 로 뭉치는 것도 리소스 존재-여부 enumeration 방지 관점에서 적절.
- **`@ApiOkWrappedResponse` 봉투 형태** — `codebase/backend/src/common/swagger/api-wrapped.ts` 의
  `wrapDataSchema`(`{ data: <ref> }`)가 `TransformInterceptor` 의 실제 런타임 래핑과 일치함을
  확인 — 신규 응답 스키마가 저장소의 기존 응답 봉투 관례를 그대로 따른다.

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING은 없다. 아래는 이미 두 차례 라운드가 스코프 밖으로
확정한 항목의 재확인이며(이번 diff 가 만들거나 악화시킨 자리가 아님), 조치 불요로 재판정한다.

- **[INFO]** `rotateBotToken` 요청 바디가 class-validator DTO 가 아닌 인라인 타입이라 요청 검증이
  수동이고 swagger request body 스키마가 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 시그니처
    `@Body() body: { newBotToken?: string }` (게이트 287행)
  - 상세: `if (!body?.newBotToken || typeof body?.newBotToken !== 'string')` 수동 검증(게이트 294행)은
    기능적으로는 충분하나, `@ApiBody()`/DTO 클래스가 없어 OpenAPI 문서에 요청 스키마가 노출되지
    않는다. 이 줄들은 이번 diff 의 변경 대상이 아니다(PR 이전부터 동일) — 이번 PR 의 명시 스코프는
    "응답 문서화 잔여"였고 요청 축은 별개다.
  - 제안: 이번 PR 스코프 밖. 후속으로 `newBotToken` 전용 요청 DTO(`@IsString()`)를 두면 요청측
    문서화도 완결된다.
  - 근거: 라운드 2 api_contract.md 가 이미 이 항목을 INFO/스코프 밖으로 기록했고, 이번 라운드
    독립 재확인에서도 diff 대상 밖임을 재확인.

- **[INFO]** `:id` 파라미터에 `ParseUUIDPipe`/`@ApiParam({format:'uuid'})` 부재 — 형제
  `revokePerTriggerToken` 등과 검증 방식이 다르다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 시그니처
    `@Param('id') triggerId: string` (게이트 286행, 이번 diff 로 바뀐 줄 아님)
  - 상세: 비-UUID 입력은 파이프 400 대신 `findById` 조회 실패로 흘러 결과적으로 404
    (`RESOURCE_NOT_FOUND`)가 되므로 치명적이지 않다. 이번 PR 이 만든 결함이 아니고 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 있다.
  - 제안: 후속 PR 에서 정렬. 이번 PR 을 막을 사유 아님.

## 요약

`chat-channel-input-rules.{ts,spec.ts}` 리팩터(에러 봉투 헬퍼화·이중 캐스팅 제거)는 `details.field`/
`details.code`/`message`·HTTP 상태 코드·검증 순서를 전혀 바꾸지 않는 순수 구조 정리라 하위 호환성
문제가 없다. `rotateBotToken` 엔드포인트의 swagger 문서화(신규 `ChatChannelRotateBotTokenDto`/
`ChatChannelRotateBotIdentityDto`, `@ApiNotFoundResponse`/`@ApiUnauthorizedResponse`/
`@ApiOkWrappedResponse`)는 기존에 이미 그렇게 동작하던 응답을 뒤늦게 문서화하는 것뿐이라 additive
이며 breaking change 가 아니다. 직전 두 라운드가 낸 CRITICAL(스키마 이름 충돌)과 WARNING(응답
DTO 가 Discord `publicKey` 를 누락해 실응답보다 좁음)은 이번 코드를 직접 열어 필드·클래스명·
import 경로 세 축을 모두 재대조한 결과 실제로 해소돼 있음을 확인했다. 파일을 `dto/responses/`
로 재배치한 라운드 2 조치도 import 경로와 두 spec 문서의 glob 매칭을 직접 grep 해 정합함을
확인했다. 남는 항목(요청 바디 미DTO화, `:id` 의 `ParseUUIDPipe` 부재)은 모두 이 PR 이전부터
있던 스코프 밖 사안이며 트래커에 이미 등재돼 있어 이번 병합을 막을 사유가 아니다.

## 위험도

NONE
