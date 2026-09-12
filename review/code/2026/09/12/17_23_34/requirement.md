# 요구사항(Requirement) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 4, `17_23_34`)

## 점검 방법

이 라운드는 3라운드 연속(`16_17_57`→CRITICAL 1·WARNING 3, `16_39_18`→WARNING 3, `17_02_19`→WARNING 1)
조치 끝에 신설된 `dto-class-name-collision` 가드(파일 9~13)를 검증하는 자리다. 과거 라운드가 이미
`chat-channel-input-rules.{ts,spec.ts}`·DTO·컨트롤러·서비스를 필드 단위로 반복 대조했으므로, 이번
라운드는 (a) 신규 가드 자체의 정확성·비-vacuous 성을 뮤테이션으로 독립 재검증하고, (b) 그 결과에
영향을 준 원 코드(응답 DTO·서비스 반환 타입·헬퍼 리팩터)를 `Read`로 직접 열어 spec 과 재대조했다.

- `spec/5-system/15-chat-channel.md` §5.4(성공/실패 응답 계약)·§5.4.1·§5.4.1.2·R-CC-21 을 Read 로
  열어 신규 `ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`(`dto/responses/
  chat-channel-rotate-bot-token-response.dto.ts`)와 필드 단위 대조 — `rotatedAt`/`triggerId`/
  `chatChannelHealth`/`botIdentity`(`botId`·`username`·`teamId?`·`publicKey?`) 전부 일치.
- `chat-channel/types.ts:55-61` 의 `ChatChannelConfig['botIdentity']` 와 `triggers.service.ts:997`
  의 `NonNullable<ChatChannelConfig['botIdentity']> | null` 선언을 대조 — 손으로 다시 적지 않고
  SoT 타입을 참조하도록 고쳐졌음을 확인(전 라운드 WARNING 의 실제 해소).
- `dto/chat-channel-config.dto.ts:385-388` 의 `ChatChannelUpdateConfigDto extends OmitType(...,
  ['botToken', 'inboundSigningPlaintext'])` 를 직접 읽어, `provider`(:174 `@IsIn(CHAT_CHANNEL_
  PROVIDERS)`)가 PATCH DTO 에도 상속됨을 확인 — `chat-channel-input-rules.ts` 의 `incoming.provider
  &&` falsy-guard 주석("HTTP 경로에서는 도달 불가")의 근거가 실제로 성립.
- `dto/trigger-dto-validation.spec.ts:769-822` 의 신규 `provider 가 %s 면 DTO 층에서 거부된다`
  테스트가 `CustomValidationPipe` **실제 인스턴스**(`pipe.transform`, mock 아님)를 태우는지 확인 —
  vacuous 아님. `npx jest trigger-dto-validation.spec.ts` 80/80 통과 실측.
- 신규 `repo-guards/__tests__/dto-class-name-collision{-guard,.spec}.ts` 를 실제로 **뮤테이션**해
  가드가 정말 무는지 검증했다: scratch 사본을 먼저 뜬 뒤(`mktemp -d`), 응답 DTO 의
  `ChatChannelRotateBotIdentityDto` 를 라운드 1 CRITICAL 이 지적했던 이름
  `ChatChannelBotIdentityDto` 로 되돌려 재현 — **RED**(`collisions` 배열에 두 파일이 그대로 잡힘).
  `cp` 로 원복 후 `diff` 로 원본 동일성 확인, `git status --short` 로 잔여 없음 확인.
- `npx jest src/modules/triggers` 전체 — 9 suites / 273 passed(+1 skipped), 회귀 없음(RESOLUTION.md
  의 "273 passed" 실측과 일치).
- `throwInvalidField`/`hasField`/`rejectBlockedField` 추출 전후로 11개 호출부의 `field`/`message`/
  `details.code`/검사 순서가 `chat-channel-rejection-messages.const.ts` 의 상수와 일치함을 대조.

## 관측된 저장소 상태 이상 — 내가 만들지 않았고, 조사 중 스스로 사라졌다

리뷰 도중(뮤테이션 검증 직후) `git status --short` 로 `codebase/backend/src/modules/triggers/
chat-channel-input-rules.ts` 가 **미커밋 상태로 수정돼 있음**을 관측했다:

```diff
 function hasField(chatChannel: ChatChannelInput, field: string): boolean {
-  return (
-    typeof (chatChannel as unknown as Record<string, unknown>)[field] !==
-    'undefined'
-  );
+  return !!(chatChannel as unknown as Record<string, unknown>)[field];
}
```

이는 내가 만든 변경이 아니다 — 세션 시작 시 `Read` 로 이 파일을 열었을 때는 원본(`typeof … !==
'undefined'`) 이었다. `RESOLUTION.md`(`16_17_57`)가 서술하는 W3 뮤테이션 검증과 정확히 같은 형태라
**동시에 실행 중인 다른 reviewer/검증 세션의 일시적 뮤테이션**으로 보인다 — 이전 두 라운드
(`16_39_18` api_contract.md, `plan/` §공유 워크트리 오염)가 이미 같은 현상을 두 번 기록했다.
`git checkout`/`restore` 는 쓰지 않았고, 재확인 시점(수 분 뒤)에는 **그 세션이 스스로 원복해
사라진 상태**였다(`git status --short` 클린). 본 리뷰의 판정에는 영향이 없으나, 규약에 따라
관측 사실만 기록한다.

## 발견사항

없음 (CRITICAL/WARNING 없음).

## 참고 (INFO, 조치 불요 — 대조 확인/이월 목적)

- **[INFO]** `plan/in-progress/chat-channel-rules-cleanup.md` 의 체크리스트가 4라운드째 미체크
  상태다.
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md` — `## 체크리스트` (`- [ ] 1~4` ~
    `- [ ] plan/complete/ 이동`, `- [x]` 는 뮤테이션 6종 한 줄뿐)
  - 상세: 이전 세 라운드(`16_17_57`·`16_39_18`·`17_02_19`)의 documentation/requirement 리뷰가
    이미 동일 항목을 INFO 로 지적했고, 매번 "수렴 판정 후 일괄 처리"로 유예됐다. 이번 라운드가
    신설 가드(파일 9~13)에 대한 마지막 조치 검증이라, `codebase/**` 수정 없이 수렴한다면 지금이
    plan 자신의 §정지 규칙이 요구하는 "체크 + `plan/complete/` 이동" 시점이다.
  - 제안: 이번 라운드가 CRITICAL/WARNING 0 으로 수렴하면 체크리스트 전체를 갱신하고
    `plan/complete/` 로 이동할 것. 새 규칙 불요 — 기존 절차 그대로.

- **[INFO]** `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 부재 — 세 라운드 연속 지적된
  스코프 밖(PR 이전부터 존재) 사안, 이번 diff 도 해당 줄 미변경.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken`
    시그니처 (`@Param('id') triggerId: string`)
  - 제안: 조치 불요, 트래커에 이미 등재.

- **[INFO]** `throwInvalidField(field: string, message: string)` 의 `field` 가 넓은 `string` 이라
  `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부(`chatChannel`·`provider`·
  `inboundSigningPlaintext` 리터럴)는 `ChatChannelBlockedField` 유니언의 오타 방지 혜택을 못
  받는다 — 두 라운드(`16_17_57`·`16_39_18`) 연속 관찰된 항목, 각 호출부에 `details.field` 단언
  테스트가 있어 회귀 위험은 낮다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `throwInvalidField`
    선언부, 호출부는 `assertChatChannelAlreadySetUp`·`assertInboundSigningPlaintextByProvider` 내부
  - 제안: 조치 불요(재발 시 좁히는 것을 고려, 이미 문서화된 트레이드오프).

## spec fidelity 대조 요약

`spec/5-system/15-chat-channel.md` §5.4(성공 응답 4필드·404/400/502 실패 표)·§5.4.1(single-path
표)·§5.4.1.2(`chatChannel` 존재성·`provider` 불변성)·R-CC-21(PATCH 비밀 차단) 을 line-level 로
대조한 결과, 함수 시그니처(`assertChatChannelInputSafe` 오버로드·`assertPatchCarriesNoSecrets`·
`assertInboundSigningPlaintextByProvider`)·필드명(`details.field`)·에러 코드(`INVALID_FIELD`·
`RESOURCE_NOT_FOUND`·`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED`)·검증 규칙(slack hex32/
discord hex64/telegram 금지)·상태 전이(`create`/`update` 분기) 어디에도 불일치가 없다. 응답 DTO
필드는 서비스 반환 타입과 SoT 타입 참조로 정확히 일치하도록 고쳐졌고, 그 일치는 손으로 다시
베끼는 대신 타입 참조로 강제된다(`tsc` 가 드리프트를 잡는 구조). spec 자체의 결함은 발견하지
못했다.

## 요약

3라운드에 걸쳐 CRITICAL 1·WARNING 6(누계)를 조치한 뒤, 이번 라운드는 그 조치 과정에서 스스로
발견한 재발 위험(사후 리뷰만 잡던 DTO 클래스명 충돌)을 코드화한 가드(`repo-guards/__tests__/
dto-class-name-collision*`)를 검증하는 자리다. 가드를 실제로 라운드 1 CRITICAL 형태로 되돌려
RED 를 확인했고(뮤테이션 후 원복 완료, `git status --short` 클린), 스캔 대상(114개 `*.dto.ts`)·
대조군 fixture(같은 이름 2파일 검출·주석/문자열 속 `export class` 비검출)도 실측대로 동작함을
확인했다. 응답 DTO·서비스 반환 타입·헬퍼 리팩터는 spec §5.4 계열과 line-level 로 일치하며,
`triggers` 모듈 전체 테스트(273 passed)·신규 DTO 검증 테스트(80 passed)가 회귀 없이 통과한다.
리뷰 도중 관측된 미커밋 `hasField` 변형은 내가 만들지 않았고 동시 세션의 일시적 뮤테이션으로
보이며 재확인 시점에 스스로 원복돼 있었다(§관측 참조) — 이번 판정에는 영향 없음. 남은 항목은
전부 이전 라운드가 이미 등재·유예한 스코프 밖/저위험 관찰(plan 체크리스트 미갱신·`ParseUUIDPipe`
부재·`throwInvalidField` 타이핑 범위)뿐이며 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도

NONE
