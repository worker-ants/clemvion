# 신규 식별자 충돌 검토 — rotate-bot-token-body

## 범위 확인

`plan/in-progress/rotate-bot-token-body.md` (`spec_impact: none`) 는 OpenAPI 가 요청 본문 스키마를 모르던 라우트 3곳(`rotateBotToken` · `continueExecution` · `receiveWebhook`)에 문서 전용 `@ApiBody` + DTO 를 붙이는 **문서 전용** 변경이다. 프롬프트 번들의 `## 구현 변경 사항` diff 는 예산 절단으로 누락돼 있었으므로, 지시대로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/rotate-bot-token-body`)에서 `git diff origin/main...HEAD`(코드 10파일 / 457줄)를 직접 확인해 신규 식별자를 실측했다.

이 PR 이 spec 파일을 하나도 바꾸지 않으므로(scope delta 0), 요구사항 ID · endpoint · 이벤트 · env/config key 축에서는 애초에 신규 항목이 없다. 실제 신규 식별자는 코드 축(엔티티/타입명 · 파일 경로)에 한정된다.

## 신규 식별자 목록 (실측)

- 클래스 `ChatChannelRotateBotTokenRequestDto` — `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts` (신규 파일)
- 클래스 `ContinueExecutionRequestDto` — `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts` (신규 파일)
- 함수 `bodyParamDesignType` — `codebase/backend/src/shared/testing/swagger-probe.ts` (기존 파일에 추가)
- 신규 테스트 파일: `codebase/backend/src/modules/triggers/triggers-rotate-bot-token-body.spec.ts`, `codebase/backend/src/modules/executions/executions-continue-body.spec.ts`, `codebase/backend/src/modules/hooks/hooks-webhook-body.spec.ts`

## 발견사항

### 없음 — 충돌로 분류할 항목을 찾지 못했다

각 관점별 점검 결과:

1. **요구사항 ID** — spec 델타 0. 신규 CCH-* 등 ID 부여 없음. 해당 없음.
2. **엔티티/타입명** — `git grep`으로 백엔드 전체를 확인한 결과 `ChatChannelRotateBotTokenRequestDto`·`ContinueExecutionRequestDto` 는 각각 정의 파일 1곳에만 존재하고 다른 의미로 재사용되는 곳이 없다. 기존 응답 DTO `ChatChannelRotateBotTokenDto`(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)와 이름이 매우 유사하지만, 그 파일 자체가 이미 "동명 클래스는 `@nestjs/swagger` 스키마 레지스트리를 서로 덮어쓴다"는 과거 실제 CRITICAL 사례(`review/code/2026/09/12/16_17_57`, `ChatChannelBotIdentityDto` 충돌)를 문서화해 둔 영역인데, 이번 신규 클래스는 `Request` 접미로 명확히 구별되고 실제 이름 문자열도 다르다(`ChatChannelRotateBotTokenDto` vs `ChatChannelRotateBotTokenRequestDto`) — **동명 충돌은 아니다**. `*RequestDto` 접미 자체가 `swagger.md §1-7`에 공식 등재되지 않은 점은 plan 의 검토 경고 표(INFO2/INFO4/INFO5)에서 이미 인지·후속 트래커 등재로 처분된 사안이라 재-flag 하지 않는다.
3. **API endpoint** — 신규 endpoint 없음. 세 라우트(`POST /triggers/:id/chat-channel/rotate-bot-token`, `POST /executions/:id/continue`, `POST /hooks/:endpointPath`) 모두 기존 endpoint 에 `@ApiBody` 데코레이터만 추가됐다. 경로/메서드 충돌 없음.
4. **이벤트/메시지명** — 신규 webhook·queue·sse 이벤트 없음. 해당 없음.
5. **환경변수·설정키** — 신규 ENV var / config key 없음. 해당 없음.
6. **파일 경로** — 신규 파일 두 곳(`triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`, `executions/dto/continue-execution.dto.ts`) 모두 기존에 존재하지 않던 새 경로이며 다른 파일과 겹치지 않는다. `chat-channel-rotate-bot-token-request.dto.ts` 는 형제 응답 DTO(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)와 대칭적인 이름을 취해 `15-chat-channel.md` `code:` glob(`dto/**/chat-channel-*.dto.ts`) 의도와 정합적이다. 신규 `*-body.spec.ts` 세 파일도 선례 `workflows/workflows-execute-body.spec.ts` 명명 패턴을 그대로 따라 기존 컨벤션과 충돌하지 않는다.

부수 확인: 세 신규 `*-body.spec.ts` 파일이 각각 로컬 `class StubController { ... }` 를 정의해 `workflows-execute-body.spec.ts` 의 기존 `StubController` 와 이름이 겹치지만, 각 파일은 별도 Jest 모듈 스코프에서 `buildSwaggerDocument({ controllers: [StubController] })` 로 **격리된** 문서를 만드는 기존 확립 패턴(이미 3번째 반복)이라 실제 스키마 레지스트리 충돌이 아니다 — 프로덕션 OpenAPI 문서에는 이 스텁들이 실리지 않는다.

`newBotToken` 필드명은 DTO·핸들러(`triggers.controller.ts`)·서비스(`triggers.service.ts`) 전체에서 동일 의미로 일관되게 쓰이고 있어 이름-의미 드리프트가 없다.

## 요약

이번 PR 은 spec 을 건드리지 않는 문서 전용(OpenAPI annotation) 변경으로, 신규 식별자는 코드 축의 DTO 클래스 2개(`ChatChannelRotateBotTokenRequestDto`, `ContinueExecutionRequestDto`)와 테스트 헬퍼 함수 1개(`bodyParamDesignType`), 신규 파일 경로 소수에 한정된다. 워킹트리를 직접 확인한 결과 이들 중 어느 것도 기존 사용처와 동일 이름·다른 의미로 충돌하지 않으며, 응답 DTO 와의 근접 명명은 `Request` 접미로 명확히 구별되고 이미 이 저장소가 겪은 실제 동명 충돌 사례(과거 CRITICAL)의 재발 형태가 아니다. `*RequestDto` 접미 관례화 여부는 이미 plan 자체에 INFO 로 등재·후속 처리된 사안이라 본 검토에서 별도로 상향하지 않는다.

## 위험도

NONE
