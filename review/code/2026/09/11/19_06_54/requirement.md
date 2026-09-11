# 요구사항(Requirement) 리뷰 — `impl-chat-channel-binder-t2` (3라운드)

## 검토 범위 및 방법

`origin/main..HEAD` 는 4개 커밋(`ba634a4b0` T1 잔여 → `a2e5b7e16` T2 이동 → `7e9aaa736` 후속
등재 → `92f4b0607`/`8f43b1f56` 리뷰 W1/W2 fix)으로 구성되며, 1라운드(`18_04_36`)·2라운드
(`18_42_05`)의 requirement 리뷰가 이미 CRITICAL 0 · WARNING 0(requirement 관점)을 냈다. 이번
3라운드는 (a) 프롬프트가 크기 제한으로 diff 를 생략한 핵심 파일(`chat-channel-binder.service.ts`,
`triggers.service.ts`)을 `Read` 로 직접 원문 대조, (b) 관련 spec 본문(`spec/5-system/15-chat-channel.md`
CCH-AD-02/03·R-CC-21·§5.4.1.1)과 코드를 line 단위 재대조, (c) 신규 테스트 2파일 및 `triggers`
모듈 전체를 실제 실행, (d) 직전 2라운드 RESOLUTION.md 의 W1~W3 fix 가 소스에 실제 반영됐는지
확인하는 데 집중했다.

- `npx jest chat-channel-binder.service.spec.ts trigger-callback-url.spec.ts` → 2 suites, 11
  passed.
- `npx jest src/modules/triggers` (모듈 전체 9 suites) → 257 passed, 1 skipped, 258 total
  (plan 체크리스트가 주장하는 수치와 일치).
- `git diff origin/main -- triggers.service.ts` 전문 대조 — `setupChatChannel`/`teardownChatChannel`
  본문이 `chat-channel-binder.service.ts` 로 **문자 그대로** 이동했고, 호출부 3곳(`create`/`update`/
  `remove`)의 인자·순서·조건이 이동 전후 동일함을 확인.

## 발견사항

- **[INFO]** (프로세스 관측, 코드 결함 아님) 리뷰 도중 `git status --short` 에서
  `codebase/backend/src/modules/triggers/triggers.service.ts` 가 미커밋 상태로 잡혔다 —
  `remove()` 안의 `await this.chatChannelBinder.teardownChatChannel(trigger);` 줄이
  `// MUTATED-OUT: await this.chatChannelBinder.teardownChatChannel(trigger);` 로 치환돼 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`remove()` 본문,
    `channelListenerRegistry.unregister` 직전 줄)
  - 상세: 세션 시작 시점(본 리뷰 최초 `git status` 확인 시)에는 없었고, 리뷰 도중 재확인에서
    나타났다 — 이 리뷰(requirement)가 만든 변경이 아니며, `MUTATED-OUT:` 주석 형태로 보아 같은
    병렬 fan-out 의 다른 reviewer 가 뮤테이션 검증을 진행 중인 것으로 판단된다(1·2라운드
    SUMMARY 에도 동일 클래스의 관측이 각 1건씩 기록돼 있다 — 3회째 재발).
  - 제안: 이 리뷰 관점에서는 조치 불요(원인 제공자가 아니므로 `git checkout`/`restore` 로
    되돌리지 않았다 — 다른 reviewer 의 진행 중 작업을 건드리지 말라는 규약 준수). 최종 SUMMARY
    통합 시 이 파일이 커밋 전 원상 복구됐는지 재확인 필요.

- **[INFO]** `ChatChannelBinderService` 클래스 JSDoc 이 아직 존재하지 않는 `plan/complete/`
  경로를 가리킨다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:18`
    (`` `TriggersService` 에서 그대로 옮겨왔다 (동작 보존, `plan/complete/impl-chat-channel-binder-t2.md`). ``)
  - 상세: 현재 이 plan 은 `plan/in-progress/impl-chat-channel-binder-t2.md` 에 있다. 이미
    1라운드(`18_04_36` W4)가 지적했고, plan 체크리스트에 "이동 후 `plan/complete/...` 실재 확인"
    항목이 **마무리 커밋 전용**으로 남아 있다(현재 미체크, 의도적) — 새로운 결함이 아니라 이미
    추적 중인 known-temporary 상태다.
  - 제안: 조치 불요(트래킹됨) — push 전 마무리 커밋에서 plan 이동 여부를 확인할 것.

## spec 본문 대조 (spec fidelity)

`spec/5-system/15-chat-channel.md` 를 SoT 로 놓고 line-level 대조했다:

- **CCH-AD-02**(`§3.1`, line 54) / **CCH-AD-03**(line 55): setup/teardown 자동 호출 요구가
  `chat-channel-binder.service.ts` 의 `setupChatChannel`/`teardownChatChannel` 에 그대로 있고,
  호출 시점(`create`/`update`/`remove`)도 이동 전후 동일.
- **R-CC-21**(line 772 이하) 및 **§5.4.1.1**(line 421-445) 의 "PATCH 는 `botToken`·slack/discord
  `inboundSigningPlaintext` 를 쓰지 않되 telegram server-issued 서명은 매 `setupChannel` 마다
  무조건 재저장" 3축 분기가 `setupChatChannel` 의 `storeUserSuppliedSecrets` 게이팅(쓰기 ①·②)과
  `result.issuedInboundSigning` 무조건 재저장(쓰기 ③, `storeUserSuppliedSecrets` 로 게이팅하지
  **않음** — 코드 주석이 그 이유까지 명시)에 정확히 대응한다.
- `inboundSigningRefSurvives` 술어(`providerIssuedStored || Boolean(preservedInboundSigningRef)`)는
  §5.4.1.1 이 요구하는 "ref 는 새로 썼거나 이미 있었으면 보존, 없던 트리거에 새로 붙이지 않는다"
  는 fail-open/fail-closed 경계와 line 단위로 일치 — 성공 경로(`mergedChannel`)·실패 경로
  (`fallbackConfig`) 양쪽 모두 같은 술어를 재사용해 대칭을 유지한다.
- `buildTriggerCallbackUrl` 의 URL 형태(`{baseUrl}/api/hooks/{endpointPath}`)는 이동 전
  `buildCallbackUrl` 과 `git diff` 로 바이트 단위 동일함을 확인 — spec 상 콜백 URL 계약에
  영향 없음.
- 이 스코프에서 새로운 spec 불일치는 발견하지 못했다. 이전 라운드가 식별한 SPEC-DRIFT 2건
  (`secret-store.md`/`chat-channel-adapter.md`/`data-flow/14-chat-channel.md` 가 `setupChatChannel`
  소유를 `TriggersService` 현재형으로 서술 — 및 `15-chat-channel.md` frontmatter `code:` 미등재)은
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 항목으로 실재
  등재됨을 직접 열어 재확인했다(grep: `TriggersService:` 로그 리터럴 후속·`rotate-bot-token`
  OpenAPI 갭 항목도 동일 파일에 존재). developer 권한 밖(`spec/` 쓰기)이라 이번 PR 에서 직접
  고치지 않은 처분은 자기-반증형 소정정 조건 1(그 문장을 developer 자신이 쓰지 않음)에도 부합한다.

## 기능 완전성 · 엣지 케이스 · 반환값

- `setupChatChannel`: adapter 미등록(early return, void) / `endpointPath` 부재(400
  `CHAT_CHANNEL_ENDPOINT_REQUIRED`) / 성공(healthy, ref 갱신, listener register) / 실패
  (degraded, ref 보존, listener 미등록) 네 경로 모두 이동 전과 동일한 값·상태 전이를 유지함을
  `triggers.service.spec.ts` (canary 3종: "server-issued 서명은 PATCH 에서도 재저장된다" ·
  "카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다" · "setupChannel 이 실패해도
  inboundSigningRef 를 잃지 않는다")로 재확인.
- `teardownChatChannel`: `chatChannel` 없음 / provider 미등록 / 정상 호출 / adapter 예외
  (best-effort catch, warn 내용까지 단언) 네 분기 전부 신규 `chat-channel-binder.service.spec.ts`
  가 직접 커버 — 1라운드 W2 가 지적한 "adapter 실제 호출·catch 두 줄이 스위트 전체에서 한 번도
  실행되지 않는다"는 갭이 실측으로 닫혔음을 직접 실행해 확인(GREEN, 4/4).
- `buildTriggerCallbackUrl`: fallback(`undefined`→dev 기본값) · 빈 문자열(`??` 의 통과 동작,
  의도적 캐너리) · 후행/선행 슬래시 단독·동시 제거 · 하위 경로 보존까지 7케이스로 분기를
  전수 커버 — 직접 실행해 GREEN 확인.
- 이름 인자로의 시그니처 변경(`{ baseUrl, endpointPath }`)은 2라운드가 지적한 "위치 인자 스왑이
  jest 로 안 잡힌다"는 갭을 테스트 추가가 아니라 형태 변경으로 근본 제거했고, 두 호출부
  (`chat-channel-binder.service.ts:112-115`, `triggers.service.ts:1061-1064`) 모두 갱신을 확인.
  round 2 가 추가로 지적한 "`rotateBotToken` describe 의 `ConfigService` mock 이 키를 무시해
  config 키 스왑을 못 가른다"(W1)도 `8f43b1f56` 에서 키 인식형 mock + 값 단언으로 닫혔고, 뮤턴트
  (`'app.url'`→`'frontend.url'`) RED 전환을 커밋 메시지로 실측 근거와 함께 남겼다.

## TODO/FIXME/HACK/XXX

신규/변경 파일(`chat-channel-binder.service.ts`, `chat-channel-binder.service.spec.ts`,
`trigger-callback-url.ts`, `trigger-callback-url.spec.ts`, `triggers.module.ts`) grep 결과 0건.

## 요약

이 변경은 `TriggersService` 의 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 을
새 `ChatChannelBinderService`·`buildTriggerCallbackUrl` 로 옮기는 동작 보존 리팩터이며, 3라운드에
걸친 반복 리뷰(1·2라운드가 지적한 인자 순서·config 키 스왑·teardown 미검증 경로)가 전부 테스트
추가가 아니라 근본 원인(시그니처 형태·mock 판별력·커버리지 공백)을 겨냥해 닫혔음을 직접 코드
읽기와 테스트 실행으로 재확인했다. spec `15-chat-channel.md` 의 CCH-AD-02/03·R-CC-21·§5.4.1.1
과 코드는 line-level 로 일치하고, 새로 발견된 요구사항 불일치나 미완성 로직(TODO 등)은 없다.
유일한 두 관찰(JSDoc 이 가리키는 `plan/complete/` 경로 미존재, 리뷰 중 관측된 병렬 reviewer
뮤테이션 흔적)은 모두 이 diff 의 코드 결함이 아니라 각각 마무리 단계에서 해소될 예정인
tracked item과 프로세스 아티팩트다.

## 위험도

NONE
