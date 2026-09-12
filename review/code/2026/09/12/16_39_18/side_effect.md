# 부작용(Side Effect) 리뷰 — chat-channel-rules-cleanup

## 점검 방법

`git diff origin/main`(대상 파일 전수)를 직접 열어 실제 diff 를 대조했다(프롬프트의 unified diff
는 예산 초과로 파일 2 중간이 잘려 있어 `Read`/`git diff` 로 원본을 재확인). 추가로
`npx tsc -p tsconfig.build.json --noEmit` 를 실행해 컨트롤러 반환 타입 변경의 구조적 호환성을
확인했다(무오류). 저장소 파일은 조회만 했고 `git status --short` 로 뮤테이션 없음을 확인했다
(세션 산출물 디렉터리 `review/code/2026/09/12/16_39_18/` 만 untracked — 이 리뷰 자신의 출력
자리이지 내가 만든 부수 변경이 아니다).

## 발견사항

- **[INFO]** `rotateBotToken` 컨트롤러의 반환 타입이 `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` 에서 `Promise<ChatChannelRotateBotTokenDto>` 로 바뀐다 — 타입 레벨 변경만이고 런타임 반환값(함수 바디의 `return this.triggersService.rotateBotToken(...)`)은 그대로다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 시그니처 (`): Promise<ChatChannelRotateBotTokenDto> {` 줄, 함수 상단 파라미터 블록 직후)
  - 상세: `TriggersService.rotateBotToken` 의 실제 반환 객체 형태(`chat-channel-input-rules.ts` 는 아니고 `triggers.service.ts` 991~997행, `botIdentity: NonNullable<ChatChannelConfig['botIdentity']> | null`)와 신규 DTO(`botId: number; username: string; teamId?: string; publicKey?: string`)가 구조적으로 정확히 일치함을 `chat-channel/types.ts` 의 `ChatChannelConfig['botIdentity']` 선언과 대조해 확인했고, `tsc -p tsconfig.build.json --noEmit` 도 무오류다. 즉 이 타입 좁힘은 실제 호출자(HTTP 클라이언트)에 영향을 주는 시그니처 변경이 아니라 컴파일 타임 안전망 강화다 — 결함 아님, 참고로만 기록.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel-input-rules.ts` 의 신규 module-level 헬퍼 3종(`throwInvalidField`/`hasField`/`rejectBlockedField`)은 전부 `export` 되지 않은 파일-로컬 함수이며, `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`assertInboundSigningPlaintextByProvider`/`stripChatChannelPlaintext`/`translateSetupChannelError` 등 기존 공개 함수의 시그니처(인자 개수·타입·반환 타입)는 전부 동일하게 유지된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`throwInvalidField` 56행, `hasField` 70행, `rejectBlockedField` 85행 — 신규 비공개 함수. 기존 공개 함수는 전부 export 유지)
  - 상세: `git diff origin/main` 전체 대조로 각 공개 함수 호출부의 `throw` 봉투(`code`/`message`/`details.field`/`details.code`)가 글자 단위로 동일함을 확인했다 — 순수 내부 리팩터이고 호출자(TriggersService)에 보이는 인터페이스 변화 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 `dto/chat-channel-rotate-bot-token.dto.ts` 가 `export class ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto` 를 도입해 `@nestjs/swagger` OpenAPI 스키마 레지스트리에 신규 항목이 등록된다(부팅 시 클래스 스캔 부작용).
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:30`(`ChatChannelRotateBotIdentityDto`), `:65`(`ChatChannelRotateBotTokenDto`)
  - 상세: 기존 `dto/chat-channel-config.dto.ts:149` 의 `ChatChannelBotIdentityDto` 와 클래스명이 겹치는지 `grep -rn "class ChatChannel.*IdentityDto"` 로 전수 대조했다 — **겹치지 않는다**(`ChatChannelRotateBotIdentityDto` vs `ChatChannelBotIdentityDto`). 동일 이름 재사용에 따른 스키마 덮어쓰기(이전 라운드 `16_17_57` CRITICAL)는 이 diff 시점 기준 재발하지 않았다.
  - 제안: 조치 불요 — 재발 방지용 grep 절차는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 신규 항목으로 등재되어 있다.

- **[INFO]** `dto/chat-channel-config.dto.ts` 의 `@ApiProperty({ description: ... })` 문자열이 "TriggersService 의 provider 별 분기 검증" → "chat-channel-input-rules 의 provider 별 분기 검증" 으로 바뀐다 — OpenAPI 문서에 노출되는 텍스트가 바뀌는 것이라 넓은 의미의 "공개 인터페이스" 변경이지만, 필드명·타입·필수여부·enum 값 등 계약 형태는 불변이다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `inboundSigningPlaintext` 필드의 `@ApiProperty` description (약 281~284행 부근)
  - 상세: 클라이언트 코드 생성기(OpenAPI codegen)가 description 텍스트에 의존하는 경우는 통상 없으므로 이 변경이 기존 사용자에게 파괴적 영향을 줄 가능성은 낮다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음

- 파일시스템 부작용: 프로덕션 코드(`chat-channel-input-rules.ts` 등)에는 파일 I/O 가 없다. 저장소에 새로 생기는 파일(`dto/chat-channel-rotate-bot-token.dto.ts`, `plan/in-progress/*.md`, `review/**/*.md`)은 전부 이 PR 이 의도적으로 커밋하는 소스/문서 산출물이며, 런타임에 예기치 않게 생성·수정·삭제되는 파일은 없다.
- 전역 변수: 신규 전역 상태(module-level mutable 변수, 싱글턴 캐시 등) 없음. 신규 함수는 전부 순수 함수(인자만 보고 부작용은 `throw` 뿐)다.
- 환경 변수: 읽기/쓰기 없음.
- 네트워크 호출: 신규·변경 함수 모두 외부 협력자(HTTP·DB·secret store)를 참조하지 않는다 — 헤더 주석이 스스로 "외부 협력자 0" 을 실측으로 선언하고 있고, `this.*` 참조가 없다는 것도 앞선 이동(#1319/#1320) 시점에 이미 검증됐다.
- 이벤트/콜백: 변경 없음 — 예외를 던지는 시점·조건·순서(내부 필드 3종 → mode 분기 → provider 분기)가 리팩터 전후 동일하다(`assertChatChannelInputSafe` diff 대조로 확인).
- 시그니처 변경 중 실질적 파급이 있는 것: `assertChatChannelAlreadySetUp`·`assertPatchCarriesNoSecrets`·`assertInboundSigningPlaintextByProvider` 등 export 된 함수의 파라미터/반환 타입은 전혀 바뀌지 않았다. 유일한 반환 타입 변경은 컨트롤러의 `rotateBotToken`(위 INFO 참조)이며 구조적으로 안전하다.

## 요약

이번 diff 는 `chat-channel-input-rules.ts` 의 반복되는 에러 봉투 생성·이중 캐스팅을 3개의 파일-로컬(비공개) 헬퍼로 추출하는 순수 리팩터와, `rotateBotToken` 엔드포인트에 신규 응답 DTO 를 붙이는 swagger 보강으로 구성된다. `git diff origin/main` 전수 대조 결과 기존 공개 함수 시그니처·예외 봉투 형태·검사 순서는 모두 보존되며, 전역 상태·환경 변수·네트워크 호출·이벤트 발생 순서에 영향을 주는 변경은 없다. 신규 DTO 클래스명이 기존 클래스와 충돌하던 이전 라운드(`16_17_57`)의 CRITICAL 은 이 diff 시점에는 이미 `ChatChannelRotateBotIdentityDto` 로 개명되어 해소된 상태를 확인했다(전수 grep 0건). 컨트롤러 반환 타입을 구체 DTO 로 좁힌 것은 컴파일 타임 안전망 강화일 뿐 런타임 동작·기존 호출자에는 영향이 없다(`tsc` 무오류로 구조적 일치 확인). 부작용 관점에서 반영이 필요한 Critical/Warning 은 없다.

## 위험도

NONE
