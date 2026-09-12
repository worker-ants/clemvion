# 요구사항(Requirement) 리뷰

## 컨텍스트 — 6라운드째, 이번 라운드의 코드 변경분은 `triggers.service.spec.ts` 단일 테스트 추가

이 세션에서 `chat-channel-rules-cleanup` 은 이미 5차례 리뷰됐다(`16_17_57` → `16_39_18` →
`17_02_19` → `17_23_34` → `17_39_51`). 라운드 1이 낸 CRITICAL(swagger 스키마 이름 충돌
`ChatChannelBotIdentityDto`)과 WARNING(Discord `publicKey` 필드 누락)은 라운드 2에서 해소됐고,
라운드 3~5는 각각 이월 INFO의 승격(재발 방지 가드 추가, 인용 형식, `botIdentity` 부가 필드
회귀 테스트)이었다. 이번 라운드(`17_52_34`) 직전 커밋(`f978f8d77`)을 `git diff
origin/main...HEAD`로 직접 열어 전체 diff(14개 코드 파일, 556 삽입/104 삭제)를 대조했다.

## 검증 절차

- `git diff origin/main...HEAD -- codebase/` 로 전체 변경분을 직접 열람(프롬프트가 예산 초과로
  일부 diff를 생략했으므로 원본을 재확인).
- `npx jest chat-channel-input-rules.spec.ts dto/trigger-dto-validation.spec.ts
  triggers.service.spec.ts repo-guards/__tests__/dto-class-name-collision.spec.ts` 실행 —
  **4 suites passed, 242 passed / 1 skipped**.
- `npx tsc --noEmit -p tsconfig.json` 실행 — 터치된 파일(`triggers/**`, `repo-guards/**`) 관련
  오류 0건(잔존 오류는 `nodes/presentation/{carousel,chart,table}` 의 무관한 baseline).
- `spec/5-system/15-chat-channel.md §5.4` 성공 응답 예시(`rotatedAt`/`triggerId`/
  `chatChannelHealth`/`botIdentity`)와 신규 `ChatChannelRotateBotTokenDto`를 필드 대 필드로
  대조, 실패 응답 표(404 `RESOURCE_NOT_FOUND` 등)와 `triggers.controller.ts`의 신규
  `@ApiNotFoundResponse`/`@ApiOkWrappedResponse` 대조.
- `TriggersService.rotateBotToken`의 반환 타입 `NonNullable<ChatChannelConfig['botIdentity']> |
  null`을 `modules/chat-channel/types.ts`의 `botIdentity?: { botId; username; teamId?;
  publicKey? }` 정의와 대조 — DTO(`ChatChannelRotateBotIdentityDto`)와 필드·optionality 일치 확인.
- `chat-channel-input-rules.ts`의 헬퍼 추출(`throwInvalidField`/`hasField`/
  `rejectBlockedField`) 전후로 로직 동일성 확인 — 11개 호출부가 전부 같은 `code:
  ErrorCode.INVALID_FIELD` 봉투를 만들던 것을 한 곳으로 모았을 뿐, 분기 조건·메시지·필드명
  변경 없음.
- `git status --short` — 리뷰 중 저장소 변경 없음(뮤테이션 불필요, 별도 원복 대상 없음).

## 발견사항

- **[INFO]** `dto/chat-channel-config.dto.ts`의 갱신된 주석이 "`assertInboundSigningPlaintextByProvider`
  가 수행한다 (`TriggersService` 가 호출)"이라고 적는데, 실제로는 `TriggersService`가
  `assertChatChannelInputSafe`를 호출하고 그 함수 내부(`mode==='create'` 분기)에서만
  `assertInboundSigningPlaintextByProvider`가 호출된다 — 직접 호출이 아니라 한 겹 아래다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:36-38`
    (동일 문구가 `:283-284`에도 반복), 실제 호출 체인은
    `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:175`
    (`assertChatChannelInputSafe` 내부에서 호출) 및
    `codebase/backend/src/modules/triggers/triggers.service.ts:407,490`
    (`TriggersService`가 부르는 것은 `assertChatChannelInputSafe`).
  - 상세: 결론(“그 검증은 `chat-channel-input-rules`가 수행하고 `TriggersService`가 그 검증
    체인의 최초 호출자다”)은 참이지만, 문구가 시사하는 "TriggersService → assertInboundSigningPlaintextByProvider"
    직접 호출 관계는 실제 코드와 한 단계 다르다. 동작에는 영향 없는 문서 정밀도 문제.
  - 제안: 급하지 않음 — 원한다면 "`assertChatChannelInputSafe` 경유로 `TriggersService`가
    호출한다"로 한 단어만 보강.

- **[INFO]** `plan/in-progress/chat-channel-rules-cleanup.md`의 체크리스트(`impl-prep`,
  작업 1~6, `run-test-all`, `/ai-review`, 트래커 종결, `plan/complete/` 이동)가 전부 미체크
  상태로 남아 있는데, RESOLUTION.md 이력과 실제 diff는 해당 작업 전부가 완료됐음을 보여준다.
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md` §체크리스트
  - 상세: 실제 코드·테스트는 6개 작업 항목을 전부 반영했고 `run-test.sh` 상당 검증(개별 jest
    +tsc)도 이번 리뷰에서 재확인했다. 체크박스만 뒤처져 있다 — 라운드가 끝나기 전(수렴 판정
    이전) 시점의 산출물이므로 최종 수렴 커밋에서 갱신될 여지가 있어 보이지만, 현재 상태만
    보면 "실제 상태"와 "기록된 상태"가 어긋난다.
  - 제안: 이 라운드가 수렴으로 판정되면 마무리 커밋에서 체크박스 일괄 갱신 + `plan/complete/`
    이동을 함께 수행할 것(이미 plan 자체의 정지 규칙이 그 절차를 명시하고 있음).

## Spec fidelity 점검 결과 (문제 없음, 근거 기록)

- `spec/5-system/15-chat-channel.md §5.4` 성공 응답 필드 순서·이름(`rotatedAt`/`triggerId`/
  `chatChannelHealth`/`botIdentity`)이 `ChatChannelRotateBotTokenDto`와 정확히 일치.
- 실패 응답 표의 404 `RESOURCE_NOT_FOUND`·400 `INVALID_BOT_TOKEN`·400 `BOT_TOKEN_INVALID`·502
  `CHAT_CHANNEL_SETUP_FAILED`가 컨트롤러의 `@ApiNotFoundResponse`/`@ApiBadRequestResponse`/
  `@ApiBadGatewayResponse` 문구와 일치. 이번 PR이 새로 추가한 것은 `@ApiUnauthorizedResponse`·
  `@ApiNotFoundResponse`·`@ApiOkWrappedResponse` 세 데코레이터 + 반환 타입의 DTO화(종전
  `Awaited<ReturnType<...>>`)뿐이며, 기존 400/502 문서화는 이전 커밋(`e4e259530`)에서 이미
  존재.
- `chat-channel-rejection-messages.const.ts`가 선언하는 "빈 값(`null`/`''`)은 DTO 층
  `@IsEmpty()`를 통과하고 서비스(`chat-channel-input-rules`) 가드가 거부한다"는 두-층
  등가성은 `chat-channel-input-rules.spec.ts`의 신규 `it.each(['null','빈 문자열'])` 케이스와
  `trigger-dto-validation.spec.ts`의 기존 케이스 양쪽에서 실측 고정돼 있다.
- `assertChatChannelAlreadySetUp`의 `incoming.provider &&` falsy-guard가 "HTTP 경로에서
  도달 불가"라는 주석 주장은 `trigger-dto-validation.spec.ts`의 신규 `it.each(['미지정','빈
  문자열'])` 테스트로 근거가 뒷받침된다 — `ChatChannelUpdateConfigDto`가
  `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])`이라 `provider`의
  `@IsIn` 검증이 상속되는 것을 직접 확인했다(테스트 GREEN, `npx jest` 로 재실행 확인).

## 요약

이번 PR은 (1) `chat-channel-input-rules.ts`의 11곳 반복 에러 봉투 생성을 `throwInvalidField`/
`hasField`/`rejectBlockedField` 세 헬퍼로 추출하는 순수 리팩터(동작 무변경, 기존 테스트
무편집 통과가 증거), (2) `rotateBotToken` 엔드포인트의 swagger 응답 문서화 보강(신규
`ChatChannelRotateBotTokenDto`, `@ApiNotFoundResponse`/`@ApiUnauthorizedResponse`/
`@ApiOkWrappedResponse`, 반환 타입의 DTO화), (3) 이 과정에서 실제로 발생했던 DTO 클래스명
충돌(라운드 1 CRITICAL, 이미 해소)의 재발 방지 정적 가드(`dto-class-name-collision`) 신설로
구성된다. 5라운드에 걸친 사전 리뷰가 실질 결함(스키마 이름 충돌·문서-응답 간극)을 이미
잡아 해소했고, 이번 라운드의 유일한 코드 변경(`triggers.service.spec.ts`의 provider별 부가
identity 필드 회귀 테스트)은 그 마지막 WARNING의 정당한 조치다. 직접 재실행한 테스트
(242 passed)와 타입체크(터치 파일 0 오류)로 기능 완전성을 확인했고, spec §5.4 본문과
line-level로 대조해 필드·에러코드·상태 서술이 모두 일치함을 확인했다. 발견된 두 건은 모두
INFO(문서 정밀도, plan 체크리스트 지연)로 기능·계약에 영향이 없다.

## 위험도

NONE
