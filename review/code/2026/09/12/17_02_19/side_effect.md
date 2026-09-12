# 부작용(Side Effect) 리뷰 — chat-channel-input-rules 구조 정리 + rotateBotToken swagger 문서화 (round 17_02_19)

## 점검 방법

`codebase/backend/src/modules/triggers/{chat-channel-input-rules.ts,chat-channel-input-rules.spec.ts,
chat-channel-rejection-messages.const.ts,triggers.controller.ts,triggers.service.ts,
dto/chat-channel-config.dto.ts,dto/responses/chat-channel-rotate-bot-token-response.dto.ts,
dto/trigger-dto-validation.spec.ts}` 를 `Read` 로 전체 열어 실제 소스 라인 기준으로 대조했다 (프롬프트
unified diff 는 예산 초과로 파일 2 가 절단돼 있어 원본을 직접 열었다). 추가로:

- `grep -rhoE "export class [A-Za-z0-9_]+" codebase/backend/src --include="*.dto.ts" | sort | uniq -c | sort -rn | awk '$1>1'` → **0건** (동명 DTO 클래스 충돌 없음 — 직전 라운드(`16_17_57`) CRITICAL 이 해소된 상태를 독립 재검증).
- `grep -rn "chat-channel-rotate-bot-token" codebase/backend/src` → import 지점 1곳(`triggers.controller.ts:40`)만 존재, dangling 옛 파일(`dto/chat-channel-rotate-bot-token.dto.ts`) 없음 — `dto/` → `dto/responses/` 이동(W1, `16_39_18`)이 깨끗하게 완결됐다.
- `git status --short` → 본 리뷰 세션이 만든 `review/code/2026/09/12/17_02_19/` 외 워킹트리 변경 없음(clean). 이전 두 라운드가 기록한 "동시 세션의 미커밋 뮤테이션" 관측(`16_39_18/RESOLUTION.md`, `api_contract.md`)은 이번 라운드 시점에는 재현되지 않았다 — 저장소 파일은 조회만 했다.

## 발견사항

없음 — CRITICAL/WARNING 없음. 참고용 INFO만 기록한다(전부 조치 불요, 대조 확인 목적).

- **[INFO]** `TriggersController.rotateBotToken` 반환 타입 애노테이션 변경 — 런타임 부작용 없음을 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 시그니처의 `): Promise<ChatChannelRotateBotTokenDto> {` 줄(종전 `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>`)
  - 상세: 함수 바디는 `return this.triggersService.rotateBotToken(...)` 그대로이고, 서비스 쪽 실제 선언 반환 타입(`triggers.service.ts` — `rotateBotToken` 시그니처, `botIdentity: NonNullable<ChatChannelConfig['botIdentity']> | null`)을 `chat-channel/types.ts` 의 `ChatChannelConfig['botIdentity']`(`botId`·`username`·`teamId?`·`publicKey?`) 및 신규 `ChatChannelRotateBotIdentityDto` 필드와 직접 대조한 결과 필드 단위로 정확히 일치한다. 타입 레벨 좁힘일 뿐 wire 응답 바이트는 바뀌지 않는다. 이 메서드를 직접 호출하는 내부 caller 는 없다(HTTP 라우팅 전용) — 시그니처 변경의 호출자 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 `ChatChannelRotateBotIdentityDto` / `ChatChannelRotateBotTokenDto` 클래스 도입 — `@nestjs/swagger` 스키마 레지스트리에 신규 항목이 추가되는 부팅 시점 부작용이지만, 동명 충돌 없음을 전수 재확인
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts:35`(`ChatChannelRotateBotIdentityDto`), `:71`(`ChatChannelRotateBotTokenDto`)
  - 상세: 직전 라운드(`16_17_57`)가 CRITICAL 로 지목했던 `ChatChannelBotIdentityDto` 이름 재사용(`dto/chat-channel-config.dto.ts` 의 기존 클래스와 충돌)은 개명(`ChatChannelRotateBotIdentityDto`)으로 해소돼 있음을 저장소 전체 `*.dto.ts` (256개 `export class`) 전수 grep 으로 **동명 0건**을 직접 재확인했다 — RESOLUTION.md 의 실측치와 일치.
  - 제안: 조치 불요.

- **[INFO]** 헬퍼 함수 추출(`throwInvalidField`·`hasField`·`rejectBlockedField`, `chat-channel-input-rules.ts:56/70/85`) — 셋 다 `export` 되지 않은 module-private 함수라 외부 공개 인터페이스에 영향 없음. `hasField` 는 `typeof (...)[field] !== 'undefined'` 판별을 유지하고 있음을 직접 확인(리뷰 도중 다른 세션이 이를 truthy(`!!value`) 로 바꾸는 뮤테이션을 남겼던 이력이 이전 두 라운드에 기록돼 있으나, 이번 라운드 시점 `Read` 결과는 원본 판별식 그대로다).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56`(`throwInvalidField`), `:70`(`hasField`), `:85`(`rejectBlockedField`)
  - 제안: 조치 불요.

- **[INFO]** `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard — 도달 불가 분기를 의도적으로 보존
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:222`
  - 상세: `ChatChannelUpdateConfigDto` 가 `provider` 의 `@IsString() @IsIn(...)` 을 상속해 HTTP 경로에서는 이 분기가 falsy 가 될 수 없다는 것을 코드 주석(`:215-221`)과 `dto/trigger-dto-validation.spec.ts` 신규 테스트(`provider 가 %s 면 DTO 층에서 거부된다`)로 함께 뒷받침한다. 이 guard 를 지우지 않는 이유(DTO 를 우회한 내부 호출자가 잘못된 에러 메시지를 받는 것을 막기 위함)가 코드·plan 양쪽에 근거로 남아 있어, 동작 변경이 아니라 의도적 방어 이중화다.
  - 제안: 조치 불요.

- **[INFO]** 파일시스템 변경 — 신규 소스 1개(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`) + 표준 워크플로 산출물(`plan/in-progress/*.md`, `review/code/**`, `review/consistency/**`)
  - 상세: 프로덕션 코드 자체는 파일 I/O 를 하지 않는다. 저장소에 새로 생기는 파일은 전부 이 PR 이 의도적으로 커밋하는 소스/문서 산출물이며 CLAUDE.md 가 규정한 정상 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `plan/in-progress/`)와 일치한다. 런타임에 예기치 않게 생성·수정·삭제되는 파일은 없다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음

- 전역 변수: 신규 module-level mutable 상태·싱글턴 캐시 없음. 신규 헬퍼 3종은 전부 순수 함수(부작용은 `throw` 뿐).
- 환경 변수: 읽기/쓰기 없음(이 diff 범위).
- 네트워크 호출: `chat-channel-input-rules.ts` 는 외부 협력자 참조가 0(헤더 주석이 실측으로 선언)이고 이번 diff 도 그 불변식을 깨지 않는다. `triggers.service.ts`/`triggers.controller.ts` 의 변경은 타입 선언·데코레이터 추가뿐이라 신규 네트워크 호출 경로가 생기지 않는다.
- 이벤트/콜백: 예외를 던지는 시점·조건·순서(내부 필드 3종 → `mode` 분기 → provider 분기)가 리팩터 전후 동일함을 `chat-channel-input-rules.ts` 전체 재대조로 확인했다.
- 시그니처 변경 중 호출자 파급이 있는 것: `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`assertInboundSigningPlaintextByProvider`/`stripChatChannelPlaintext`/`translateSetupChannelError` 등 export 된 함수의 파라미터·반환 타입은 전혀 바뀌지 않았다. 유일한 반환 타입 변경(컨트롤러 `rotateBotToken`)은 위 INFO 에서 검증했듯 구조적으로 안전하다.
- 공유 워크트리 오염: 이번 라운드 리뷰 시작~종료 시점 `git status --short` 에 본 리뷰 산출물 외 변경 없음 — 저장소 파일을 수정하지 않았고(Read/grep/git status 조회만), 뮤테이션도 하지 않았다.

## 요약

`chat-channel-input-rules.{ts,spec.ts}` 의 에러 봉투 헬퍼화(`throwInvalidField`/`hasField`/`rejectBlockedField`)와 `rotateBotToken` 엔드포인트의 swagger 응답 문서화(신규 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` + 컨트롤러 데코레이터·반환 타입)는 전역 상태·환경 변수·네트워크 호출·이벤트 순서에 영향이 없는 순수 리팩터 + additive 문서화다. 직전 두 라운드(`16_17_57`→CRITICAL 1·WARNING 3, `16_39_18`→WARNING 3)에서 지적된 항목(OpenAPI 스키마 클래스명 충돌, `publicKey` 누락, `@ApiUnauthorizedResponse` 누락, DTO 파일 위치 규약 위반, plan 내부 모순, orphan JSDoc)은 이번 라운드 코드를 직접 열어 전부 해소돼 있음을 독립적으로 재확인했다(동명 클래스 0건 grep, import 그래프 1곳 확인, `hasField` 판별식 원본 유지 확인). 컨트롤러 반환 타입 변경은 유일한 "시그니처 변경"이지만 구조적으로 동일한 DTO 로의 타입 레벨 좁힘이라 호출자 영향이 없다. 부작용 관점에서 반영이 필요한 Critical/Warning 은 없다.

## 위험도

NONE
