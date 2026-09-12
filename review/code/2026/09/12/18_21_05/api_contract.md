# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 부재 (형제 엔드포인트와 비일관)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:286` (`@Param('id') triggerId: string`)
  - 상세: 같은 컨트롤러의 다른 6개 `@Param('id', ...)` 사용처(`:82`·`:142`·`:164`·`:183`·`:212`·`:240`)는 전부 `ParseUUIDPipe` 를 쓰는데 `rotateBotToken` 만 raw string 을 받는다. `git log -S"async rotateBotToken"` 으로 확인한 결과 이 자리는 `e827ed2a7`(#676, C-2 클러스터5 forwardRef 순환 해소)에서 이미 그런 형태였고 이번 diff(`c9bc5dca6..HEAD`)는 데코레이터·반환 타입만 바꿨을 뿐 `@Param` 줄 자체는 건드리지 않았다 — **이번 PR 이 만든 회귀가 아니라 기존 상태**다. 비-UUID 입력은 `findById` 조회 실패 → 404(`RESOURCE_NOT_FOUND`)로 수렴해 치명적이진 않지만(같은 결론이 `review/code/2026/09/12/17_52_34/api_contract.md` 에도 있다), 400 대신 404 로 나가는 상태 코드 불일치는 남는다.
  - 제안: 조치 불요(스코프 밖, 이미 트래커성으로 반복 이월됨). 재-flag 지양 — 이 PR 범위에서 고칠 대상 아님.

- **[INFO]** `rotateBotToken` 요청 바디가 DTO 클래스 없이 인라인 타입(`{ newBotToken?: string }`)이라 `@ApiBody()` 스키마가 OpenAPI 문서에 없고, 전역 `class-validator` 파이프의 자동 검증도 적용되지 않는다(수동 `if` 체크로만 방어)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:287` (`@Body() body: { newBotToken?: string }`), 검증은 `:294-299`
  - 상세: 같은 파일의 다른 POST/PATCH 바디(`:106` `CreateTriggerDto`, `:144` `UpdateTriggerDto`)는 모두 DTO 클래스를 쓴다. `git log -S"newBotToken?: string"` 확인 결과 이 인라인 타입도 `e827ed2a7` 이전부터 있었고 이번 diff 는 그 줄을 바꾸지 않았다 — 기존 상태다. 수동 검증(`!body?.newBotToken || typeof ... !== 'string'`)이 최소한의 방어는 하고 있어 즉각적 위험은 낮다.
  - 제안: 조치 불요(스코프 밖). 다만 스코프 확장 시 `RotateBotTokenRequestDto` 도입 + `@ApiBody()` 추가를 고려할 만하다.

- 신규 응답 DTO(`ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`, `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)의 필드(`botId: number`·`username: string`·`teamId?: string`·`publicKey?: string`)를 `codebase/backend/src/modules/chat-channel/types.ts:57-63` 의 `ChatChannelConfig['botIdentity']` 선언과 대조 — 필드·옵셔널리티 정확히 일치. `triggers.service.ts:997` 가 `NonNullable<ChatChannelConfig['botIdentity']> | null` 로 그 타입을 직접 참조해 손으로 다시 적은 자리가 사라졌으므로, 향후 필드가 늘어도 선언-실체 괴리가 재발하지 않는 구조다. `chatChannelHealth` 의 `enum: ['unknown','healthy','degraded']` 도 `entities/trigger.entity.ts:29` 의 `TriggerChatChannelHealth` 유니언과 정확히 일치.
- `dto-class-name-collision-guard.ts`/`.spec.ts`(신규)는 `src/modules`+`src/common` 하위 `*.dto.ts` 256개를 AST 로 전수 스캔해 클래스명 중복을 잡는다. `collectTsFiles` 가 재귀 스캔이라(`common/__test-utils__/source-scan.ts:333-349`) 신규 파일이 옮겨간 `dto/responses/` 하위도 대상에 포함됨을 확인 — 이번 PR 이 스스로 낸 CRITICAL(스키마 이름 충돌)의 재발을 구조적으로 막는 가드로 API 계약(응답 스키마 유일성) 리스크를 낮춘다.
- 컨트롤러 반환 타입을 `Promise<Awaited<ReturnType<...>>>` 에서 `Promise<ChatChannelRotateBotTokenDto>` 로 바꾼 것, `@ApiUnauthorizedResponse`/`@ApiNotFoundResponse`/`@ApiOkWrappedResponse` 추가는 모두 기존 런타임 동작의 문서화 보강일 뿐 응답 바디·상태 코드를 바꾸지 않는다(`triggers.service.ts` 의 `rotateBotToken` 실제 반환 로직은 `botIdentity` 타입 선언 방식만 바뀌고 값 생성 로직은 무변경).
- 인증/인가(`@ApiBearerAuth('access-token')` 클래스 레벨 + `@Roles('editor')` 메서드 레벨), 버전 관리, URL/경로 설계(RPC sub-action `rotate-bot-token` 명명 방식 유지), 페이지네이션(목록 API 변경 없음) — 이번 diff 로 변경된 사항 없음.
- `dto/trigger-dto-validation.spec.ts` 신규 테스트(PATCH 에서 `provider` 미지정/빈 문자열 → DTO 층 `VALIDATION_ERROR`)는 `ChatChannelUpdateConfigDto = OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])` 이 `provider` 의 `@IsString()@IsIn()` 을 상속한다는 사실을 실측 고정한다 — `chat-channel-input-rules.ts:215-221` 의 "HTTP 경로에서는 도달 불가" 주석 근거가 vacuous 하지 않음을 뒷받침.

뮤테이션·저장소 쓰기: 이 리뷰는 저장소 파일을 수정하지 않았다(`Read`/`Grep`/`git log` 조회만 수행). `git status --short` 결과 본 리뷰가 만든 산출물 디렉터리(`review/code/2026/09/12/18_21_05/`) 외 변경 없음.

## 요약

이 diff(`c9bc5dca6..HEAD`, codebase 14개 파일)는 (1) `chat-channel-input-rules.ts` 의 헬퍼 추출(에러 봉투 형태·필드명·HTTP 상태 코드 값 동일, 순수 이동), (2) `rotateBotToken` 엔드포인트의 swagger 문서화 보강(신규 응답 DTO 를 `dto/responses/` 규약 위치로 배치, 반환 타입의 DTO 강제, `@ApiUnauthorizedResponse`/`@ApiNotFoundResponse` 추가), (3) DTO 클래스명 충돌 재발 방지 가드 신설로 구성된다. 이 브랜치는 동일 세션 내 6라운드(`16_17_57`~`17_52_34`)의 api_contract 리뷰를 이미 거쳤고, 그 라운드들이 지적한 CRITICAL(swagger 스키마 이름 충돌) 1건·WARNING(응답 DTO 필드가 실제 반환보다 좁음) 1건이 소스 레벨에서 정확히 해소됐음을 이번 라운드에서도 직접 재확인했다. 남는 두 항목(`:id` 의 `ParseUUIDPipe` 부재, 요청 바디 DTO/`@ApiBody` 부재)은 `git log -S` 로 이 PR 이전부터 있던 상태임을 확인했으므로 이번 PR 의 신규 결함이 아니라 스코프 밖 기존 갭이다. API 계약 관점에서 이번 라운드에 신규로 등재할 CRITICAL/WARNING 은 없다.

## 위험도

NONE
