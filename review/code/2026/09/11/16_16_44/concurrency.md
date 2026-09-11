# 동시성(Concurrency) 리뷰

## 검토 범위

이번 changeset(`origin/main...HEAD`, 커밋 `2ae81077c`·`6dc2b7d60`·`81d2a8c18`)의 실제 코드 변경은
`codebase/backend/src/modules/triggers/` 하위 3개 파일뿐이다:

- `chat-channel-input-rules.ts` (신규) — `TriggersService` 의 private 메서드 6개
  (`assertChatChannelInputSafe`(+overload) · `assertPatchCarriesNoSecrets` ·
  `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` ·
  `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`)를
  module-level 함수로 그대로 옮긴 것.
- `triggers.service.ts` — 위 6개 메서드 정의 삭제, `this.X(...)` 호출을 import 된 함수 호출로 치환.
  본문·호출 순서·인자는 변경 없음(`git diff` 로 직접 대조).
- `chat-channel-input-rules.spec.ts` (신규) — 이동된 함수들에 대한 단위 테스트. `async`/`await`/
  `Promise`/`setTimeout` 어느 것도 쓰지 않는 순수 동기 테스트다(`grep` 확인, 매치 0건).

나머지 리뷰 대상 파일(`plan/**`, `review/consistency/**`, 이전 라운드 산출물 `review/code/2026/09/11/15_31_54/**`,
`review/code/2026/09/11/15_57_42/**`)은 마크다운 산출물로 실행 코드가 아니다.

## 발견사항

없음.

## 분석 근거

- 이동된 6개 함수는 전부 `async`/`await`·타이머·큐·락을 쓰지 않는 **동기 순수 함수**다. 인자로
  받은 DTO/`Trigger` 를 읽기만 하며, `stripChatChannelPlaintext` 는 구조 분해(`{ ...rest }`)로
  **새 객체를 반환**할 뿐 입력을 mutate 하지 않는다 — 공유 가변 상태(모듈 스코프 변수·클래스
  필드·캐시)가 전혀 없다. 함수를 클래스 메서드에서 module-level 함수로 옮겨도 `this` 바인딩에
  의존하던 상태가 없었으므로(추출 전 `this.*` 참조 0건, 커밋 메시지·이전 라운드 산출물이 실측
  근거로 제시) 동시 호출 간 상태 공유·경쟁 조건 위험이 새로 생기거나 없어지지 않는다.
- `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX`(`@workflow/chat-channel-validation`)를
  직접 열어 확인 — `/^[a-f0-9]{32}$/`, `/^[a-f0-9]{64}$/` 로 `g`/`y` 플래그가 없다. 따라서 `.test()`
  호출 간 `lastIndex` 공유 상태 문제(동시 요청이 같은 정규식 리터럴을 인터리빙 호출할 때 결과가
  호출 순서에 의존하는 전형적 결함)가 발생하지 않는다. 이 상수는 이번 PR 이 새로 도입한 것이
  아니라 기존 import 를 그대로 옮긴 것이다.
- `triggers.service.ts` 의 실제 호출 지점(`create()`/`update()`/`setupChatChannel` 본문,
  `catch` 블록)을 diff 로 직접 대조 — `await` 순서·트랜잭션 경계·에러 처리 흐름이 추출 전후로
  한 글자도 바뀌지 않았다. 바뀐 것은 수신자(`this.X(...)` vs 모듈 함수 `X(...)`)뿐이고, 두 형태
  모두 동일한 이벤트 루프 틱에서 동기 실행된다. 새 async 경로·Promise 체인·타이머는 추가되지
  않았다.
- `git diff 2ae81077c..HEAD` 로 후속 두 커밋(`6dc2b7d60`, `81d2a8c18`)을 확인 — `triggers.service.ts`
  는 이 두 커밋에서 전혀 건드리지 않았고, `chat-channel-input-rules.ts` 변경은 docstring 코멘트
  6줄 추가뿐이다(`translateSetupChannelError` 의 "discord verify_key 불일치는 502" 캐너리 설명).
  실행 로직 변경 없음.
- 실제 secret 쓰기·DB 갱신이 있는 `setupChatChannel`/`teardownChatChannel`/`rotateChatChannelBotToken`
  계층(동시 PATCH lost-update, secret rotation grace-period 등 진짜 동시성 표면이 걸려 있는 계층)은
  `triggers.service.ts` diff 에서 호출부 치환(수신자만 변경) 외에는 손대지 않았다 — plan 문서
  (`plan/in-progress/impl-chat-channel-binder.md`)도 이 계층(T2)을 별도 후속 범위로 명시한다.

뮤테이션 검증: 저장소 트리는 건드리지 않았다(`Read`/`Bash grep`/`git diff` 만 사용).
`git status --short` 결과 잔여물 없음.

## 요약

이번 changeset 은 `chat-channel` 입력 검증/정화용 순수 함수 6개를 `TriggersService` 클래스
밖으로 뽑아내는 기계적 리팩터이며, 뒤이은 두 커밋도 그 함수들에 대한 동기 단위 테스트 추가와
docstring 보강뿐이다. `async`/`await`, 공유 가변 상태, 락, 타이머, 커넥션/스레드 풀, 정규식
`lastIndex` 공유 어느 것도 새로 도입되거나 변경되지 않았다. 실제 동시성 표면(secret rotation,
동시 PATCH)이 걸린 계층은 이 changeset 범위 밖이다. 동시성 관점에서 위험 없음.

## 위험도

NONE
