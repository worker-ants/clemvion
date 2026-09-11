# 요구사항(Requirement) 리뷰 — `impl-chat-channel-binder-t2` (2라운드, 92f4b0607)

## 검토 범위

1라운드(`review/code/2026/09/11/18_04_36`)가 CRITICAL 0 · WARNING 4 로 판정한 뒤, 이번 커밋
(`92f4b0607`)이 W1(콜백 URL 인자 순서)·W2(`teardownChatChannel` adapter 경로 미검증)를 닫는
후속 diff다. 실질 코드 변경은 4곳: `chat-channel-binder.service.ts`(+8/-)·
`trigger-callback-url.ts`(시그니처를 위치 인자 → 이름 인자로 변경)·`triggers.service.ts`(호출부
갱신, +8/-)와 신규 테스트 2파일(`chat-channel-binder.service.spec.ts`,
`trigger-callback-url.spec.ts`).

## 실측 방법

- `chat-channel-binder.service.ts`/`triggers.service.ts` 를 직전 커밋(`a2e5b7e16`, T2 최초
  이동)과 대조해 이번 라운드가 순수 이동 범위를 벗어나지 않았는지 확인.
- `spec/5-system/15-chat-channel.md` 의 CCH-AD-02·CCH-AD-03·R-CC-21·§5.4.1.1 을 코드와 line
  단위로 대조.
- 신규 테스트 2파일을 실제 실행 (`npx jest .../chat-channel-binder.service.spec.ts
  .../trigger-callback-url.spec.ts`), `triggers` 모듈 전체(9 스위트) 실행.
- `plan/in-progress/impl-chat-channel-binder-t2.md` 체크리스트와 `RESOLUTION.md` 의 주장(뮤턴트
  5/5 RED, 246→257)을 대조.
- 저장소에 쓰기는 하지 않았다(읽기·jest 실행만). 종료 시 `git status --short` 확인 —
  `review/code/2026/09/11/18_42_05/`(본 세션 산출물) 외 dirty 파일 없음.

## 발견사항

- **[INFO]** 신규 테스트 2파일을 특정 순서로 함께 실행했을 때 1회, `teardownChatChannel` 관련
  테스트 2건(`adapter.teardownChannel` 호출 검증·warn 메시지 검증)이 일시적으로 실패하는 것을
  관측했다. 직후 동일 명령·동일 순서로 3회 재실행 및 `triggers` 모듈 전체 실행(9 스위트,
  257 passed) 모두 통과했고, 실패 관측 시점 전후 `git status --short` 는 깨끗했다(본 세션이
  파일을 건드리지 않음).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts` (해당
    describe 블록 — "provider 가 등록돼 있으면 그 config 로 adapter.teardownChannel 을 부른다",
    "adapter 가 던져도 삼키고 trigger id 와 사유를 warn 으로 남긴다")
  - 상세: 테스트 코드 자체는 구현과 논리적으로 정확히 대응한다(아래 "코드-테스트 대조" 참조).
    재현되지 않는 1회성 실패이고, 1라운드 SUMMARY INFO#11 이 이미 *"리뷰 중 병렬 reviewer 의
    뮤테이션이 공유 워크트리에 일시적으로 관측됐다가 원복됐다"*는 동일 클래스의 process
    artifact 를 기록해 두었다 — 이번에도 같은 클래스(병렬 fan-out reviewer 가 같은 파일을 동시에
    뮤테이션 검증 중이었을 가능성)로 보인다. 코드 결함으로 보지 않지만, **재발**(2회째 관측)이므로
    투명하게 보고한다.
  - 제안: 조치 불요(코드 결함 아님). 이미 등재된 프로세스 항목(#1319 계열)에 재발 사실만 추가.

- **[INFO]** SPEC-DRIFT 2건(`setupChatChannel` 소유 클래스를 현재형으로 서술하는
  `secret-store.md:146`/`chat-channel-adapter.md:369`/`data-flow/14-chat-channel.md:29`, 및
  `15-chat-channel.md` frontmatter `code:` 미등재)은 1라운드가 이미 식별했고
  `plan/in-progress/spec-draft-nullable-notation-followups.md:2200-2226`(대상 8개로 갱신 포함)에
  developer 자신이 아니라 이전 `--impl-prep` 턴이 planner 항목으로 등재해 둔 것을 직접 확인했다.
  자기-반증형 소정정 조건 1(developer 자신이 그 문장을 씀)이 성립하지 않아 이번 PR 에서 developer
  가 직접 spec 을 고치지 않은 처분은 타당하다.
  - 위치: `spec/conventions/secret-store.md:146`, `spec/conventions/chat-channel-adapter.md:369`,
    `spec/data-flow/14-chat-channel.md:29`, `spec/5-system/15-chat-channel.md` frontmatter `code:`
  - 제안: 코드 유지 + spec 반영은 이미 트래킹 중이므로 이번 PR 에서 추가 조치 불요.

## 코드-테스트 대조 (기능 완전성·반환값·에러 시나리오)

- `chat-channel-binder.service.spec.ts` 4케이스는 `teardownChatChannel`(`chat-channel-binder.service.ts:277-291`)의
  네 분기(`chatChannel` 없음 → early return / provider 미등록 → early return / 등록됨 → adapter
  호출 + 인자 정확성 / adapter 예외 → best-effort catch + warn 내용)를 정확히 1:1 로 커버한다.
  `has()`/`get()` 인자, `teardownChannel` 인자, warn 메시지의 trigger id·사유 문자열까지 실제
  구현 문자열(`` `TriggersService: teardownChannel 실패 (best-effort, trigger=${trigger.id}): ...` ``)과
  일치시켜 단언한다 — `resolves` 만 보는 vacuous 패턴이 아니다.
- `trigger-callback-url.spec.ts` 7케이스는 `buildTriggerCallbackUrl`(`trigger-callback-url.ts:48-57`)의
  세 분기(fallback·후행 슬래시 제거·선행 슬래시 제거)를 개별 + 동시 조합까지 커버하고, `??` 의
  현재 동작(빈 문자열은 fallback 되지 않음)을 캐너리로 고정해 의도치 않은 `||` 치환을 잡는다.
- 시그니처를 위치 인자 `(baseUrl, endpointPath)` 에서 이름 인자 객체로 바꾼 것은 1라운드 W1이
  지적한 "인자 스왑 뮤턴트가 jest 로는 안 잡힌다"는 갭을 테스트 추가가 아니라 **형태 변경**으로
  닫았다 — 두 호출부(`chat-channel-binder.service.ts:112-115`, `triggers.service.ts:1061-1064`)
  모두 이름 인자로 갱신되어 있음을 직접 확인했다.
- `triggers.service.ts` 의 세 호출부(`chatChannelBinder.setupChatChannel` ×2,
  `chatChannelBinder.teardownChatChannel` ×1)는 이동 전 private 메서드 호출과 인자·순서가
  동일하다(`a2e5b7e16` diff 대조).
- JSDoc 이 인용하는 회귀 캐너리 3종("server-issued 서명은 PATCH 에서도 재저장된다", "카드 편집
  PATCH 후에도 inboundSigningRef 가 살아남는다", "setupChannel 이 실패해도(degraded)
  inboundSigningRef 를 잃지 않는다")이 실제로 `triggers.service.spec.ts:3062,3314,3344` 에
  존재함을 확인했다 — 문서와 테스트가 어긋나지 않는다.

## 관련 spec 본문 일치 여부

- **CCH-AD-02/CCH-AD-03** (`15-chat-channel.md:54-55`): setup/teardown 자동 호출 요구사항이
  이동 전후 동일 코드로 유지됨.
- **R-CC-21**(`15-chat-channel.md:772` 이하) 의 "PATCH 는 botToken·slack/discord
  inboundSigningPlaintext 를 쓰지 않되 telegram server-issued 는 예외" 3축 분기가
  `chat-channel-binder.service.ts:130-160,197-213` 의 `storeUserSuppliedSecrets` 게이팅·
  `issuedInboundSigning` 무조건 재저장 로직과 line 단위로 일치한다.
- **§5.4.1.1** 의 provider별 회전 주체 구분(telegram=server-issued/항상 재발급,
  slack·discord=provider-issued/PATCH 차단)이 코드 주석·로직과 부합.
- 콜백 URL 형태(`/api/hooks/:endpointPath`)는 `12-webhook.md`/`15-chat-channel.md:56` 서술과
  일치하며 이동 전후 바이트 단위로 동일함을 `a2e5b7e16` diff 로 확인했다.
- SPEC-DRIFT 2건은 위 발견사항에 기재(이미 트래킹 중, 조치 불요).

## TODO/FIXME/HACK/XXX

신규 4개 소스 파일(`chat-channel-binder.service.ts`/`.spec.ts`,
`trigger-callback-url.ts`/`.spec.ts`) 및 `triggers.module.ts` 에 grep 결과 없음.

## 요약

이번 라운드는 1라운드가 지적한 WARNING 2건(인자 순서 미검증·teardown adapter 경로 미검증)을
정확히 겨냥해 닫는 diff다. 인자 순서는 테스트 추가가 아니라 이름 인자로의 시그니처 변경으로
근본적으로 없앴고(두 호출부 모두 확인), teardown 경로는 4개의 신규 단위 테스트로 실제 구현
문자열까지 단언해 커버했다 — 새 테스트를 실제로 실행해 전부 통과함을 확인했다(단, 특정 실행
조합에서 1회 일시적 실패를 관측했으나 재현 불가하고 git 상태는 깨끗해 병렬 리뷰어의 일시적
뮤테이션 관측으로 판단, INFO로만 기록). `setupChatChannel` 은 의도적으로 새 spec 에서 다시
덮지 않고 기존 `triggers.service.spec.ts` 의 공개 진입점 테스트에 위임한다는 판단도 JSDoc·
관련 캐너리 테스트 실재를 직접 확인해 타당함을 검증했다. spec 본문(CCH-AD-02/03, R-CC-21,
§5.4.1.1)과 코드는 line-level 로 일치하며, 유일한 spec 불일치(SPEC-DRIFT 2건)는 developer 권한
밖으로 이미 별도 planner 트래커에 등재되어 있어 이번 PR 을 막을 사유가 아니다. 기능 완전성·
에러 시나리오·반환값·비즈니스 로직 관점에서 CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

LOW
