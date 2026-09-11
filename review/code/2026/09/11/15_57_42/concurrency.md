# 동시성(Concurrency) 리뷰

## 발견사항

없음.

## 분석 근거

이번 changeset 은 두 커밋(`2ae81077c`, `6dc2b7d60`)의 누적 diff이며, 실행 코드 변경은
`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`(신규)·
`codebase/backend/src/modules/triggers/triggers.service.ts`(호출부 변경)뿐이다. 나머지
(`chat-channel-input-rules.spec.ts` 신규, `plan/**`, `review/**`)는 테스트 코드·문서 산출물이다.

- **`chat-channel-input-rules.ts`**: `TriggersService` private 메서드였던 6개 함수
  (`assertChatChannelInputSafe`(+overload 2) · `assertPatchCarriesNoSecrets` ·
  `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` ·
  `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`)를 module-level
  함수로 그대로 옮긴 것이다. 파일 전체를 직접 읽어 확인한 결과 전부 `async`/`await`·타이머·큐·락을
  쓰지 않는 동기 순수 함수다. 인자로 받은 DTO/`Trigger` 를 읽기만 하고, `stripChatChannelPlaintext`
  는 구조 분해(`{ ...rest }`)로 새 객체를 반환할 뿐 입력을 mutate 하지 않는다 — 공유 가변 상태가
  없다.
- **정규식 상태 공유 재확인**: `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX`
  (`codebase/packages/chat-channel-validation/src/index.ts:22,30`)는
  `/^[a-f0-9]{32}$/`, `/^[a-f0-9]{64}$/` — `g`/`y` 플래그가 없어 `.test()` 호출 간
  `lastIndex` 공유 상태(동시 요청 인터리빙 시 결과가 호출 순서에 의존하는 결함 클래스)가 발생하지
  않는다. 이번 PR 은 이 import 를 그대로 옮겼을 뿐 상수 자체를 건드리지 않았다.
- **`triggers.service.ts` 호출부**: `git diff 71feabeea 2ae81077c -- .../triggers.service.ts` 로
  직접 대조. `create()`/`update()` 안의 호출이 `this.assertChatChannelInputSafe(...)` →
  `assertChatChannelInputSafe(...)` (import) 로 수신자만 바뀌었고, 호출 순서·`await` 위치·
  트랜잭션 경계는 한 글자도 바뀌지 않았다. 두 형태 모두 같은 이벤트 루프 틱에서 동기 실행되므로
  race window 가 새로 열리거나 닫히지 않는다.
- **`chat-channel-input-rules.spec.ts`(신규)**: `describe`/`it.each` 로 구성된 순수 동기 유닛
  테스트다. 각 케이스가 `cfg()` 팩토리로 매번 새 객체를 만들어 쓰고, `describe` 블록 간·`it` 블록
  간 공유 mutable fixture 가 없다 — 병렬 테스트 실행(jest worker) 환경에서도 케이스 간 간섭이나
  flaky 소지가 없다.
- **범위 밖(T2) 확인**: 이 PR 이 옮긴 것은 T1(검증·변환, 외부 협력자 의존 0개)뿐이다.
  `setupChatChannel`/`teardownChatChannel`(secret 쓰기·DB 갱신·`SecretResolverService.rotate` 를
  쓰는 계층, 동시 PATCH lost-update 이슈가 실제로 걸려 있는 계층)은 `plan/in-progress/
  impl-chat-channel-binder.md` 에 명시된 대로 이번 diff 에 포함되지 않는다(T2 는 별도 후속). 즉
  락·TOCTOU·secret rotation grace-period 같은 진짜 동시성 표면은 이번 변경이 손대지 않았다.
- 나머지 리뷰 대상 파일(`plan/in-progress/*.md`,
  `review/code/2026/09/11/15_31_54/**`, `review/consistency/2026/09/11/14_59_33/**`)은 마크다운·
  JSON 산출물로 실행 코드가 아니며 동시성 관점에서 검토 대상이 아니다.

뮤테이션 검증: 저장소 트리는 건드리지 않았다(`Read`/`git diff`/`git show`/`grep` 만 사용).
`git status --short` 로 잔여 변경 없음 확인.

## 요약

이번 changeset 은 `chat-channel` 관련 순수 검증 함수 6개를 별도 모듈로 옮기고 테스트를 추가하는
동작 보존 리팩터로, 공유 가변 상태·비동기 흐름·락·자원 풀 어느 것도 새로 도입하거나 변경하지 않는다.
동일 changeset 을 다룬 직전 라운드(`review/code/2026/09/11/15_31_54/concurrency.md`)의 NONE 판정과
일치하며, 이번에 추가된 커밋(`6dc2b7d60`)도 소스 코드는 건드리지 않고 동기 유닛 테스트와 문서만
추가했다. 실제 secret 쓰기·DB 갱신이 있는 T2 계층(동시 PATCH lost-update 등 진짜 동시성 표면)은
이 PR 범위 밖으로 명시돼 있어 함께 검토할 대상이 아니다. 동시성 관점에서 위험 없음.

## 위험도

NONE
