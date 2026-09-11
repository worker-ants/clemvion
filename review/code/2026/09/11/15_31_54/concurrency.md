# 동시성(Concurrency) 리뷰

## 발견사항

없음.

## 분석 근거

이번 변경은 `TriggersService` 안에 있던 **의존성 0개**의 순수 검증/변환 함수 6개
(`assertChatChannelInputSafe`, `assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`,
`stripChatChannelPlaintext`, `assertInboundSigningPlaintextByProvider`,
`translateSetupChannelError`)를 신규 파일
`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 로 옮기고,
`codebase/backend/src/modules/triggers/triggers.service.ts` 의 호출부를
`this.X(...)` → `X(...)` 로 바꾼 **기계적 추출(pure move)** 이다. 확인한 사항:

- 이동된 6개 함수 모두 `async`/`await`·타이머·큐·락을 쓰지 않는 동기 순수 함수다. 인자로 받은
  DTO/`Trigger` 를 읽기만 하며, `stripChatChannelPlaintext` 는 구조 분해(`{ ...rest }`)로 **새
  객체를 반환**할 뿐 입력을 mutate 하지 않는다 — 공유 가변 상태가 없다.
- `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX` (`@workflow/chat-channel-validation`)
  는 `g`/`y` 플래그가 없는 `/^[a-f0-9]{32}$/`, `/^[a-f0-9]{64}$/` 리터럴이라 `.test()` 호출 간
  `lastIndex` 공유 상태 문제(동시 요청 인터리빙 시 결과가 호출 순서에 의존하는 전형적 결함)가
  발생하지 않음을 소스에서 직접 확인했다 (`codebase/packages/chat-channel-validation/src/index.ts:22,30`).
  이 상수는 이번 PR 이 새로 도입한 것이 아니라 기존 import 를 그대로 옮긴 것이다.
- `triggers.service.ts` 의 실제 호출 지점(`create()`/`update()`/`setupChatChannel` catch 블록)을
  직접 읽어 `await` 순서·트랜잭션 경계·에러 처리 흐름이 추출 전후로 **한 글자도 바뀌지 않았음**을
  확인했다 — 바뀐 것은 수신자(`this.` vs 모듈 함수)뿐이고, 두 형태 모두 동일한 이벤트 루프 틱에서
  동기 실행된다. 새 async 경로·Promise 체인·타이머는 추가되지 않았다.
- `plan/in-progress/impl-chat-channel-binder.md` 에 명시된 이 PR 의 유일한 주장도 "동작 보존"이며,
  T2(`setupChatChannel`/`teardownChatChannel` 등 secret 쓰기·DB 갱신을 포함한 협력자 계층, 동시
  PATCH lost-update 이슈가 실제로 걸려 있는 계층)는 **이번 PR 범위에 포함되지 않는다** — 별도
  후속 커밋(T2)에서 다룰 예정으로 명시돼 있다. 즉 락·TOCTOU·secret rotation grace-period 같은
  진짜 동시성 표면은 이번 diff 가 손대지 않았다.
- 나머지 리뷰 대상(`plan/in-progress/impl-chat-channel-binder.md`,
  `review/consistency/2026/09/11/14_59_33/*`)은 마크다운 산출물로 실행 코드가 아니다.

뮤테이션 검증: 저장소 트리는 건드리지 않았다(`Read`/`grep` 만 사용). `git status --short` 확인 불필요.

## 요약

이번 변경은 `chat-channel` 관련 순수 검증 함수 6개를 별도 모듈로 옮기는 리팩터로, 공유 가변 상태·비동기 흐름·락·자원 풀 어느 것도 새로 도입하거나 변경하지 않는다. 실제 secret 쓰기·DB 갱신이 있는 `setupChatChannel`/`teardownChatChannel` 계층(동시 PATCH lost-update 등 실제 동시성 표면)은 이번 PR 범위 밖(후속 T2)으로 명시돼 있어 함께 검토할 대상이 아니다. 동시성 관점에서 위험 없음.

## 위험도

NONE
