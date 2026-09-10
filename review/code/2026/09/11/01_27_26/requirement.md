# 요구사항(Requirement) 리뷰 — chatChannel PATCH 비밀 차단 (D-1/D-2/D-3, R-CC-21)

## 검증 방법

- 소스 diff(`git diff origin/main...HEAD`)를 `codebase/backend/src/modules/triggers/*` 전체에 대해
  직접 열람 (프롬프트가 크기 제한으로 생략한 `chat-channel-config.dto.ts`·`triggers.service.ts`·
  두 `*.spec.ts` 포함).
- `spec/5-system/15-chat-channel.md` (§5.4.1·§5.4.1.1·R-CC-10·R-CC-21) 및
  `spec/2-navigation/2-trigger-list.md` R-12 를 Read/Grep 로 대조.
- `npx jest src/modules/triggers/triggers.service.spec.ts src/modules/triggers/dto/trigger-dto-validation.spec.ts`
  실행 — **181 passed / 1 skipped(무관한 구조적 anchor)**.
- `npx tsc -p tsconfig.build.json --noEmit` 및 `npx tsc -p tsconfig.json --noEmit` (test 포함) 실행 —
  `modules/triggers/**` 관련 오류 0건 (별도 미관련 파일 `chat-channel/providers/telegram/telegram-message.renderer.spec.ts`
  의 타입 오류 1건은 이 diff 가 손대지 않은 파일이라 스코프 밖 — pre-existing으로 판단, 별도 조치 불요).
- 프런트 소비처 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 를 열어
  실제 PATCH payload 구성부(`saveMutation`)를 확인 — 이 PR 의 diff 에는 포함되지 않은 파일이지만
  CHANGELOG 의 "유일한 소비자는 영향 없음" 주장을 검증하기 위해 직접 대조.
- 저장소 뮤테이션 없음(읽기 전용 검증만 수행) — `git status --short` 확인 결과 본 리뷰로 인한 변경 없음.

## 발견사항

- **[INFO] [SPEC-DRIFT]** `spec/5-system/15-chat-channel.md` §5.4.1(bot token 행)·§5.4.1.1(회전 행)에
  남아 있는 `details.field` **"미확정 — 후속 e2e 확인 대기"** placeholder가, 이번 PR 이 추가한
  `trigger-dto-validation.spec.ts` 의 두 `[실측]` 테스트로 **이미 확정됐다** — 비어있지 않은 값은
  전역 `CustomValidationPipe` 가 중첩 경로(`chatChannel.botToken` 등, `details` 배열)로, `null`/`''`
  는 `@IsEmpty()` 를 통과해 서비스 가드가 flat 이름(`botToken` 등, `details` 단일 object)으로 거부한다.
  구현이 `3-error-handling.md §2.1` "중첩/배열 경로 유지" 규약을 지키고 있고, spec 의 flat 표기
  쪽이 낡았다는 것이 실측으로 증명됐다.
  - 위치: `spec/5-system/15-chat-channel.md` §5.4.1 표 "토큰 변경(rotation)" 행 및 §5.4.1.1 표
    "회전(rotation)" 행의 `details.field` 셀; 근거 테스트는
    `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`의
    `'[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다'` 및
    `'[실측] 값이 null/빈 문자열이면 DTO 를 통과한다 — 거부는 서비스 층이다'` 케이스.
  - 코드 결함 아님 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    ("§5.4.1 · §5.4.1.1 의 `details.field` 문면이 실제 페이로드와 다를 수 있다" 항목)에
    "✅ 2026-09-11 실측 완료 ... 남은 것은 planner 의 문면 정정뿐" 으로 정확히 등재돼 있음.
  - 제안: 코드는 그대로 두고, `project-planner` 턴에서 위 두 표의 `details.field` 셀과
    `spec/2-navigation/2-trigger-list.md:119-120` 을 실측 표(비어있지 않은 값=중첩/배열,
    `null`/`''`=flat/단일 object)로 갱신.

- **[INFO] [SPEC-DRIFT]** 이번 PR 이 신설한 검증 분기 2건 — `chatChannel` 이 없는 트리거에 PATCH 로
  처음 붙이려는 시도 차단(`details.field='chatChannel'`, `assertChatChannelAlreadySetUp`)과 provider
  전환 차단(`details.field='provider'`, 같은 함수)이 `spec/5-system/15-chat-channel.md` §5.4.1 표와
  `spec/2-navigation/2-trigger-list.md` PATCH 에러 표 어디에도 아직 등재돼 있지 않다. 두 분기 모두
  R-CC-21 이 이미 결정한 "PATCH 는 비밀을 쓰지 않는다"의 **필연적 귀결**(최초 setup 은 토큰을 실을
  방법이 없어 반드시 실패하고, provider 전환은 다른 provider 토큰을 새 adapter 에 넘기게 된다)이라
  구현 판단 자체는 타당하고 테스트로도 고정돼 있으나, wire-contract 문서화가 비어 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `assertChatChannelAlreadySetUp`
    (함수 전체) — 대응 spec 문서는 `spec/5-system/15-chat-channel.md` §5.4.1 표.
  - 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "신규 검증 분기 2건
    ... 이 §5.4.1 표와 `2-trigger-list.md` PATCH 에러 표에 미등재다" 로 정확히 등재돼 있음 —
    새로 발견한 갭이 아니라 기존 추적 항목과 일치함을 재확인.
  - 제안: `project-planner` 턴에서 §5.4.1 표에 "최초 부착 PATCH 차단"·"provider 전환 차단" 두 행
    추가, `2-trigger-list.md` PATCH 에러 표 동기화.

- **[INFO]** `ChatChannelCard`(`codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:347`)의
  `patchChatChannel.provider = chatChannel?.provider ?? "telegram"` fallback 은, 같은 컴포넌트가
  `hasChatChannel`(=`Boolean(chatChannel?.provider)`) 이 거짓이면 편집 UI 자체를 렌더링하지 않고
  "미설정" 카드로 조기 반환하므로(`chat-channel-card.tsx:404-418`) 실질적으로 도달 불가능한
  방어 코드다. 이 파일은 이번 diff 에 포함되지 않았고 동작 결함도 아니므로 조치 불요 — 참고용 기록.

## 교차 검증 — 이전 리뷰 라운드(`review/code/2026/09/10/23_21_57`) CRITICAL/WARNING 재확인

이전 라운드가 CRITICAL 로 판정한 "slack/discord PATCH 편집 후 `inboundSigningRef` 소실 →
인입 서명 fail-open" 은 현재 코드에서 `preservedInboundSigningRef` 캡처(`triggers.service.ts`
`update()` — merge 전에 `trigger.config.chatChannel.inboundSigningRef` 를 읽어 `setupChatChannel`
에 전달) + `inboundSigningRefSurvives = providerIssuedStored || Boolean(preservedInboundSigningRef)`
로 **해소됨을 코드 레벨로 확인**. 대응 회귀 테스트
(`it.each(['slack','discord'])('%s — 카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다 ...')`,
`'setupChannel 이 실패해도(degraded) inboundSigningRef 를 잃지 않는다'`) 도 존재하며 실행 결과 GREEN.
같은 라운드의 WARNING 5건(provider 일치 검사, null/빈문자열 테스트, JSDoc mode 반영, Swagger
`@ApiBadRequestResponse` 갱신, import 블록 위치)도 모두 현재 diff 에 반영돼 있음을 각 파일에서
직접 확인했다(예: `triggers.controller.ts` diff 의 `@ApiBadRequestResponse` 확장, `assertChatChannelInputSafe`
JSDoc 의 `mode==='update'` 단락, `triggers.service.ts` 상단 `type` 선언이 import 블록 뒤로 이동).

## 비즈니스 로직 / 엣지 케이스 정합성 (직접 검증)

- D-1(필드 차단)과 D-2(경로 차단)가 분리돼 있고, D-2 는 "쓰기 3개 중 telegram server-issued
  1개만 예외"를 정확히 구현 — `storeUserSuppliedSecrets` 플래그는 쓰기 ①②만 게이팅하고 쓰기 ③
  (telegram `issuedInboundSigning` 저장)은 무조건 실행됨을 코드·테스트 양쪽에서 확인
  (`'telegram — server-issued 서명은 PATCH 에서도 재저장된다'`).
- `null`/`''` 두 값 × `botToken`/`inboundSigningPlaintext` 두 필드 = 4 조합 전부 서비스 레이어
  방어선(`assertPatchCarriesNoSecrets`, `typeof x !== 'undefined'`)에 실제로 도달함을 테스트로 고정.
- 오버로드 시그니처(`assertChatChannelInputSafe(chatChannel: ChatChannelConfigDto, mode: 'create')`
  / `(chatChannel: ChatChannelUpdateConfigDto, mode: 'update')`)로 "mode 와 DTO 타입 짝 깨짐"을
  컴파일 타임에 차단 — `tsc --noEmit` 양쪽(`tsconfig.build.json`/`tsconfig.json`) 모두 통과.
- 생성(POST) 경로 무회귀 — `CreateTriggerDto` 는 여전히 `botToken` 필수, `assertInboundSigningPlaintextByProvider`
  는 `mode==='create'` 경로에서만 호출됨을 코드로 확인.
- 프런트 유일 소비자(`ChatChannelCard`)가 실제로 `botToken`/`inboundSigningPlaintext`/내부 ref 3종을
  전혀 보내지 않음을 소스에서 직접 확인 — CHANGELOG 의 "영향 없음" 주장과 일치.

## 반환값 / 에러 시나리오

세 신규 400 사유(비밀 필드 포함, 미설정 트리거 최초 부착, provider 전환) 모두 `BadRequestException`
+ `code: 'VALIDATION_ERROR'` + `details.field` 로 일관되게 반환되며, 각 사유마다 최소 1개 이상의
단위 테스트가 `response.details.field` 값까지 단언한다(코드만 보고 통과하는 vacuous 케이스 방지 —
`'setup 안 된 트리거에 PATCH 로 chatChannel 을 처음 붙이면 400'` 테스트 주석이 이 함정을 명시적으로
경계하며 `details.field` 까지 검증).

## 요약

`chatChannel` PATCH 가 사용자 비밀(`botToken`/`inboundSigningPlaintext`)을 받지도 쓰지도 않게 막는
R-CC-21/D-1/D-2/D-3 결정이 코드에 정확히 구현돼 있다. 핵심 위험이었던 "필드만 막으면 저장된 토큰이
빈 문자열로 파괴된다"(경로 미차단)와 "slack/discord PATCH 후 `inboundSigningRef` 소실 → 인입 서명
fail-open"은 각각 `storeUserSuppliedSecrets` 플래그와 `preservedInboundSigningRef` 보존 메커니즘으로
해소됐고, telegram server-issued 서명만 예외적으로 계속 재저장돼야 한다는 비대칭 요구사항도 정확히
반영·테스트됐다. 이전 리뷰 라운드가 지적한 CRITICAL 1건·WARNING 5건 전부 현재 코드에서 해소를 직접
확인했고, `npx jest`(181 passed)·`tsc --noEmit`(빌드/테스트 양쪽) 모두 클린하다. 남은 갭은 두 건 —
① 실측으로 확정된 `details.field` 형식(중첩/flat)과 ② 신규 2개 검증 분기(`chatChannel`/`provider`)의
wire-contract가 spec 본문에 아직 반영되지 않은 것 — 뿐이며, 둘 다 developer 권한 밖의 spec 산문
정정이라 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 정확한 실측값과 함께 이미
planner 턴으로 위임 등재돼 있다. 코드 자체를 되돌리거나 추가로 고칠 필요는 없다.

## 위험도

LOW
