# 부작용(Side Effect) 코드 리뷰

## 검토 범위

`chat-channel-rules-cleanup` 세션 diff(`origin/main..HEAD`) 중 애플리케이션 코드 10개 파일을 대상으로
검토했다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.{ts,spec.ts}`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}`
- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision{-guard,}.{ts,spec.ts}` (신규) + fixtures 3개

나머지(`plan/**`, `review/**` 98개 파일)는 이전 리뷰 라운드·plan 산출물로 전부 markdown/JSON
문서이며 실행되는 애플리케이션 코드가 아니라 부작용 표면이 없다 — 내용만 훑고(파일시스템
쓰기·환경변수·네트워크 호출 패턴 grep 0건) 상세 분석에서 제외했다.

뮤테이션·저장소 쓰기: 이 리뷰는 저장소 파일을 수정하지 않았다. `git diff origin/main..HEAD -- <path>`
로 직접 diff 를 열람했을 뿐 뮤테이션 테스트는 수행하지 않았다(순수 리팩터라 재현 없이도 판단
가능했다). `git status --short` 확인 결과 이 리뷰가 만든 미커밋 변경은 없다(`review/code/.../18_21_05/`
출력 자체 제외).

## 발견사항

- **[INFO]** `rotateBotToken` 컨트롤러 메서드의 반환 타입 시그니처가 바뀌었다 — 런타임 영향 없음을 확인.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 메서드 시그니처 (게이트 277-293행 부근, `): Promise<ChatChannelRotateBotTokenDto> {` 줄)
  - 상세: `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` → `Promise<ChatChannelRotateBotTokenDto>` 로 반환 타입 애노테이션이 바뀌었다. TypeScript 반환 타입 애노테이션은 기본적으로 컴파일 타임에만 작용하지만, NestJS 앱에 전역 `ClassSerializerInterceptor` 가 걸려 있으면 `design:returntype` 리플렉션 메타데이터를 이용해 `@Expose`/`@Exclude` 기반 필드 스트리핑이 **런타임에** 발동할 수 있어, 이런 시그니처 변경이 실제 응답 바디를 바꿔 버리는 사고 유형이 존재한다. 이 저장소는 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` 헤더 주석에 "전역 `ClassSerializerInterceptor` 0건" 이라 명시돼 있고 실측(`grep -rn ClassSerializerInterceptor codebase/backend/src`)으로도 참조가 그 가드 자기 자신뿐임을 확인했다 — 즉 이번 변경은 **순수 컴파일 타임 타입 강화**이고 런타임 직렬화 경로(커스텀 `TransformInterceptor` 의 `{ data }` 래핑)는 그대로다. 결함은 아니지만, 이 판단이 "지금 이 저장소에 `ClassSerializerInterceptor` 가 없다" 는 사실에 의존하므로 향후 그 인터셉터가 도입되면 이런 반환 타입 애노테이션들이 조용히 런타임 필터링을 시작할 수 있다는 점을 기록해 둔다.
  - 제안: 조치 불요(현재는 안전 확인됨). 향후 `ClassSerializerInterceptor` 도입을 검토할 경우, 응답 DTO 를 반환 타입으로 쓰는 전 컨트롤러 메서드에 대해 필드 누락 여부를 전수 재검증해야 한다는 점만 트래커에 남길 가치가 있다.

- **[INFO]** `TriggersService.rotateBotToken` 의 `botIdentity` 필드 타입이 손으로 적은 리터럴 타입에서 `NonNullable<ChatChannelConfig['botIdentity']>` 참조로 바뀌었다 — 타입 선언만 바뀌고 런타임 반환 값(`mergedChannel.botIdentity` 를 그대로 전달)은 diff 전후 동일함을 확인.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken` 메서드 반환 타입 선언부(게이트 991-997행 부근, `botIdentity: NonNullable<ChatChannelConfig['botIdentity']> | null;` 줄)
  - 상세: 이전 타입 `{ botId: number; username: string; teamId?: string } | null` 은 Discord 가 채우는 `publicKey` 필드를 빠뜨려 "선언이 실제 반환보다 좁은" 상태였다(주석·직전 라운드 RESOLUTION 이 인정). 새 타입은 값을 만들어내는 소스 타입을 그대로 참조해 그 괴리를 구조적으로 막는다. 함수 본문에서 `botIdentity` 값 자체를 계산/가공하는 로직은 diff 에 없다(`git diff` 확인) — 순수 타입 폭 조정이라 side effect 없음.
  - 제안: 조치 불요.

- **[INFO]** 새 컨트롤러 데코레이터 4개(`@ApiUnauthorizedResponse`, `@ApiNotFoundResponse`, `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)`)는 OpenAPI 스키마 생성 시점에만 소비되는 메타데이터이며 요청 처리 파이프라인(가드·인터셉터·핸들러 로직)에는 영향이 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 메서드 상단 데코레이터 블록(게이트 265-284행 부근)
  - 상세: `@Roles('editor')` 등 인가 데코레이터 체인은 diff 에서 변경되지 않았고(그 라인들은 diff 밖), `newBotToken` 유효성 검사·서비스 호출·에러 변환 로직도 그대로다. Swagger 데코레이터 추가는 문서 표면만 넓힌다.
  - 제안: 조치 불요.

- **[INFO]** 신규 repo-guard(`dto-class-name-collision-guard.ts`)는 `fs.readFileSync` 로 저장소 소스 파일을 **읽기만** 하며, 파일 생성·수정·삭제·네트워크 호출·환경 변수 접근이 없다. jest 프로세스 안에서만 실행되고 프로덕션 코드 경로에서 import 되지 않는다(`__tests__/` 하위, 소비처는 형제 `.spec.ts` 뿐).
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` — `exportedClassNames` 함수(게이트 25-41행)
  - 상세: 부작용 관점에서 우려할 지점 없음을 확인 차 기록.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel-input-rules.ts` 에 신설된 모듈 레벨 함수 3종(`throwInvalidField`/`hasField`/`rejectBlockedField`)은 클로저 상태·모듈 스코프 mutable 변수를 전혀 갖지 않는 순수 함수다(입력 → 예외 throw 또는 boolean 반환). 새 전역 변수·new module-level mutable state 도입 없음. 기존 11곳의 `throw new BadRequestException({...})` 인라인 블록을 동일한 `code`/`message`/`details` 형태로 호출부 이동만 한 것으로, `git diff` 로 각 호출부의 `field`/`message` 값이 리팩터 전후 글자 단위로 동일함을 확인했다(로직·예외 조건·던지는 값 변경 없음).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `throwInvalidField`(게이트 40-46행), `hasField`(게이트 52-58행), `rejectBlockedField`(게이트 63-70행)
  - 상세: 상태 변경·전역 변수·이벤트 발생 없음.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel-rejection-messages.const.ts` · `dto/chat-channel-config.dto.ts` 의 diff 는 `TriggersService` 를 가리키던 stale 귀속 주석을 `chat-channel-input-rules` 로 정정하는 **주석 전용** 변경이다 — export 되는 상수 값(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)·타입(`ChatChannelBlockedField`)·DTO 데코레이터 옵션(`minLength`/`maxLength`/`example` 등) 어디에도 실질 변경이 없다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:6-9`, `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:33-38`·`283-284`
  - 상세: 인터페이스·계약 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** 환경 변수·네트워크 호출: 검토한 10개 파일 전체에서 `process.env`, `fetch`/`axios`/`http`/`https` 등 외부 호출 패턴이 diff 에 추가되지 않았다(`grep -n "process.env\|fetch(\|axios\|require('http" <각 파일>` 결과 0건).
  - 위치: 해당 없음(부재 확인).
  - 제안: 조치 불요.

## 요약

이번 diff는 `chat-channel-input-rules.ts` 의 반복된 예외 생성 코드를 3개의 순수 헬퍼 함수로 추출하고, `rotateBotToken` 엔드포인트에 신규 응답 DTO 와 swagger 데코레이터를 배선하는 리팩터 + 문서화 PR 이다. 호출부의 `field`/`message`/`details` 값은 리팩터 전후 동일함을 diff 대조로 확인했고, 컨트롤러/서비스의 반환 타입 시그니처 변경 2건은 모두 컴파일 타임 전용이며(전역 `ClassSerializerInterceptor` 부재를 실측 확인) 런타임 응답 바디를 바꾸지 않는다. 신규 repo-guard 는 테스트 시점에 소스 파일을 읽기만 하는 순수 로직이라 파일시스템 부작용이 없다. 새 전역 변수, 예상 밖 상태 변경, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다. CRITICAL/WARNING 없음 — 모두 정보성 관찰이며 이 저장소의 현재 구성(인터셉터 부재 등)에 대한 확인 기록이다.

## 위험도

NONE
