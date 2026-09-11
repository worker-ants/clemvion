# 동시성(Concurrency) 리뷰 — `impl-chat-channel-binder-t2` (2라운드, 18_42_05)

## 검토 범위 확인

이번 라운드는 직전 `/ai-review` (`review/code/2026/09/11/18_04_36`) 의 WARNING 4건에 대한
해소 커밋(`92f4b0607`, "test(triggers): 리뷰어가 짚은 두 갭을 닫는다")을 검토 대상으로 한다.
프롬프트에 diff 가 축약된 파일 2(`chat-channel-binder.service.ts`)·파일 7(`triggers.service.ts`)은
`git show 92f4b0607 -- <path>` 로 실제 변경분을 직접 대조했다. 저장소에 아무 것도 쓰지 않았다
(`git status --short` 로 판단할 변경 없음 — 읽기만 수행).

이번 커밋이 코드에 실제로 가한 변경은 다음 셋뿐이다.

1. `buildTriggerCallbackUrl(baseUrl, endpointPath)` → `buildTriggerCallbackUrl({ baseUrl, endpointPath })` — 위치 인자를 이름 인자 객체로 바꾼 시그니처 변경. 호출부 2곳(`chat-channel-binder.service.ts:112-115`, `triggers.service.ts:1061-1064`)만 그에 맞춰 갱신.
2. 신규 테스트 파일 2개(`chat-channel-binder.service.spec.ts` 117줄, `trigger-callback-url.spec.ts` 84줄) — 전부 동기 함수 또는 이미 존재하던 `async` 메서드에 대한 단위 테스트.
3. plan/review 문서 갱신(코드 아님).

`setupChatChannel`/`teardownChatChannel` 의 로직 본문(await 순서, secret store 쓰기, `triggerRepository.update` read-merge-write 패턴, adapter 호출)은 이번 커밋에서 **한 글자도 바뀌지 않았다** — `git show 92f4b0607` diff 에 그 본문이 아예 등장하지 않는다.

## 발견사항

없음. 시그니처를 위치 인자에서 이름 인자 객체로 바꾼 변경은 순수 함수(`buildTriggerCallbackUrl`, 협력자 0개)의 호출 규약만 바꿀 뿐 공유 자원·비동기 흐름·락에 아무 영향이 없다. 신규 테스트 2개는 `async/await` 를 정확히 사용한다 — `chat-channel-binder.service.spec.ts` 의 실패 경로 테스트도 `adapter.teardownChannel.mockRejectedValue(...)` 를 `await expect(...).resolves.toBeUndefined()` 로 올바르게 기다린다. 두 테스트 파일 모두 `test.concurrent` 나 `Promise.all` 류의 병렬 실행 구성을 쓰지 않고, 파일당 단일 프로세스에서 순차 실행되는 일반 `it()` 블록뿐이라 테스트 간 공유 상태 경합도 없다.

참고로 직전 라운드(`review/code/2026/09/11/18_04_36/concurrency.md`)가 INFO/LOW 로 이미 지적한 `trigger.config` 에 대한 비원자적 read-merge-write(`chat-channel-binder.service.ts` `setupChatChannel` 성공/실패 경로, DB row-lock·낙관적 버전 없음 — 동시 PATCH 시 lost-update 가능)는 **이번 커밋이 만든 것도, 이번 커밋이 건드린 것도 아니다.** 해당 코드는 이번 diff 범위 밖(본문 무변경)이고 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 후속 항목으로 등재돼 있으므로 이번 라운드에서 재등재하지 않는다.

## 요약

이번 커밋은 순수 함수 시그니처를 위치 인자에서 이름 인자로 바꾸는 형태 변경과, 기존 `async` 메서드(`setupChatChannel`/`teardownChatChannel`) 및 순수 함수(`buildTriggerCallbackUrl`)에 대한 신규 단위 테스트 추가로 구성된다. 새 lock/mutex/세마포어, 새 Promise 조합, 새 스레드풀·커넥션풀 설정은 없고, 기존 비동기 로직 본문도 전혀 수정되지 않았다. 신규 테스트의 `await`/`resolves`/`mockRejectedValue` 사용도 올바르다. 직전 라운드에서 이미 식별·유예 처리된 `trigger.config` 비원자적 쓰기 패턴은 이번 diff 의 스코프 밖이며 변경 없이 그대로다. 따라서 이번 라운드에서 동시성 관점의 신규 발견사항은 없다.

## 위험도

NONE
