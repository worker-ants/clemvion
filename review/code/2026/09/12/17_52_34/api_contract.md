# API 계약(API Contract) 리뷰

## 발견사항

없음.

## 근거 (검증 절차)

이 diff(`c9bc5dca6..HEAD`, 14개 codebase 파일)를 API 계약 관점 8축(하위 호환성·버전 관리·응답
형식·에러 응답·요청 검증·URL/경로 설계·페이지네이션·인증/인가)으로 대조했다. 이 브랜치는
동일 세션 내 5라운드 리뷰(`16_17_57` → `17_39_51`)를 거쳤고, 그 라운드들이 이미 잡은
CRITICAL 1건·WARNING 2건이 이번 라운드의 diff 에 **정확히 반영**되어 있는지를 직접 소스를
열어 재확인하는 방식으로 검증했다(라운드 산출물 문면을 그대로 믿지 않음).

- **`chat-channel-input-rules.ts` 리팩터**(`throwInvalidField`/`hasField`/`rejectBlockedField`
  헬퍼 추출): 11곳의 에러 봉투(`code: 'VALIDATION_ERROR'`, `message`, `details.field`,
  `details.code: ErrorCode.INVALID_FIELD`)를 라인 단위로 대조 — 값·구조 100% 동일, 순수
  추출이라 응답 형식·HTTP 상태 코드(400)에 영향 없음. 하위 호환성 문제 없음.
- **신규 응답 DTO** `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`: 이전 라운드
  CRITICAL(신규 `ChatChannelBotIdentityDto` 가 `chat-channel-config.dto.ts` 의 동명 입력-검증
  DTO 와 `@nestjs/swagger` 스키마 레지스트리에서 충돌)이 `ChatChannelRotateBotIdentityDto` 로
  개명해 해소됐음을 두 파일을 직접 열어 클래스명이 더 이상 겹치지 않음을 확인. 이전 라운드
  WARNING(문서가 Discord `publicKey` 를 누락해 실제 wire 응답보다 좁음)도 필드 추가 +
  `TriggersService.rotateBotToken` 의 반환 타입을 손으로 다시 적은 타입 대신
  `NonNullable<ChatChannelConfig['botIdentity']> | null` 로 SoT 참조하도록 고쳐, `botId`·
  `username`·`teamId?`·`publicKey?` 네 필드가 `chat-channel/types.ts` 의 `ChatChannelConfig`
  선언과 정확히 일치함을 확인(다른 곳에 손으로 재타이핑하는 자리가 이제 없다).
- **컨트롤러**: `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` 를
  `Promise<ChatChannelRotateBotTokenDto>` 로 명시 — swagger 선언과 실제 반환이 구조적으로
  분리돼 있던 이전 상태(반환 타입이 따라가기만 하고 강제하지 않음)를 없앤다. 신규
  `@ApiUnauthorizedResponse`(형제 8개 메서드와 일관), `@ApiNotFoundResponse`(`findById` 가
  실제로 `RESOURCE_NOT_FOUND` `NotFoundException` 을 던지는 기존 동작의 문서화 — 새 동작 아님,
  소스로 확인)를 추가해 실패 응답 표의 문서 커버리지가 실동작과 맞아졌다.
- **인증/인가**: `@ApiBearerAuth('access-token')`(클래스 레벨) + `@Roles('editor')`(메서드
  레벨) 는 이번 diff 로 바뀌지 않았다 — 신규 데코레이터는 전부 문서화(`@Api*Response`)뿐이고
  가드 구성 변경은 없다.
- **요청 검증**: `trigger-dto-validation.spec.ts` 신규 테스트(PATCH 에서 `provider` 미지정/빈
  문자열이 DTO 층 `VALIDATION_ERROR` 로 거부됨)는 `ChatChannelUpdateConfigDto` 가
  `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])` 이라 `provider` 의
  `@IsString()@IsIn()` 이 상속된다는 소스 사실과 일치 — `chat-channel-input-rules.ts` 에 새로
  붙은 "DTO 층이 이미 막는다" 주석의 근거가 테스트로 고정됐다.
- **버전 관리·URL/경로 설계·페이지네이션**: 신규/변경 엔드포인트 없음(기존
  `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 문서 보강뿐), 목록 API 변경 없음 —
  이 두 축과 페이지네이션 축은 diff 범위 밖.
- 신규 `repo-guards/__tests__/dto-class-name-collision*`: 이번 라운드가 만든 게 아니라 이전
  라운드 CRITICAL 의 **재발 방지 가드**(전체 `*.dto.ts` 256개 전수 스캔, AST 기반이라 주석/
  문자열 오탐 없음, `SCAN_ROOTS`(`modules`/`common`)가 자기 fixture 디렉터리를 포함하지 않아
  대조군이 자기 자신을 잡는 vacuous 위험 없음도 확인). API 계약 표면을 직접 바꾸진 않지만
  향후 스키마 충돌 재발을 구조적으로 막는 안전장치로, 이 축의 리스크를 낮춘다.

미해결로 이월된 항목(이번 라운드 신규 결함 아님, 이전 라운드에서 이미 스코프 밖으로 명시):
`rotateBotToken` 의 `:id` 파라미터가 형제 엔드포인트(`findOne`/`update`/`remove` 등)와 달리
`ParseUUIDPipe` 를 안 쓴다 — 이 PR 이전부터 있던 상태이고, 비-UUID 입력은 `findById` 조회
실패로 귀결돼 404(`RESOURCE_NOT_FOUND`)로 수렴하므로 치명적이지 않다. 재-flag 하지 않는다.

뮤테이션·저장소 쓰기: 이 리뷰는 저장소 파일을 수정하지 않았다(`git status --short` 로 조회만
수행, 결과 clean 외 미커밋 산출물 디렉터리 1개뿐).

## 요약

이번 diff 는 (1) `chat-channel-input-rules.ts` 의 순수 헬퍼 추출 리팩터 — 에러 봉투 형태·
필드명·HTTP 상태 코드를 조금도 바꾸지 않아 기존 클라이언트에 영향 없음 — 와 (2)
`rotateBotToken` 응답의 swagger 문서화 보강(신규 응답 DTO + `@ApiUnauthorizedResponse`/
`@ApiNotFoundResponse`/`@ApiOkWrappedResponse`, 반환 타입의 DTO 강제)으로 구성된다. 이전
다섯 라운드가 지적한 CRITICAL(swagger 스키마 이름 충돌) 1건과 WARNING(응답 DTO 가 Discord
`publicKey` 를 누락해 문서가 실제 응답보다 좁음) 1건 모두 소스 레벨에서 정확히 해소됐음을
직접 확인했고, 재발 방지 가드까지 신규로 추가돼 API 계약 관점에서 이번 라운드에 남는 신규
결함은 없다.

## 위험도

NONE
