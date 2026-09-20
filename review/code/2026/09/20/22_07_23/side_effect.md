# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 이번 수정이 막는 것은 "감사 행 중복·행 재삭제" 뿐이고, 같은 레이스에서 파생되는 "외부 자원 해제(teardown) 중복 호출"은 그대로 남는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 내 `await this.resourceReleaser.releaseExternal(trigger);` 호출 (게이트 없음, diff 밖 기존 줄이라 함수명으로 특정: `TriggersService.remove()`, 실제 파일에서 확인한 줄 번호는 1066).
  - 상세: `remove()`는 advisory lock 을 잡기 **전에**, 잠금 없는 선조회(`findById`) 결과를 기준으로 `releaseExternal(trigger)`를 무조건 실행한다(주석에도 "위 외부 해제(provider teardown 포함)는 락 밖에서 이미 끝났다"고 명시). 동시 DELETE 두 건은 각자 자신의 선조회를 통과해 각자 `releaseExternal`을 호출하므로, chat-channel 이 설정된 트리거라면 `TriggerResourceReleaserService.releaseExternalMany()` 안의 `await this.chatChannelBinder.teardownChatChannel(trigger);`(`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:166`, 직접 열어 확인)와 `this.channelListenerRegistry.unregister(trigger.id)`가 **두 번** 실행된다. 이번 diff 가 추가한 락 안 재조회(`m.findOne` → `!fresh` → `throwTriggerNotFound()`)는 그 뒤에 일어나는 `m.remove`·`recordAudit`·`releaseSecretsAfterCommit`만 두 번째 요청에서 막을 뿐, 이미 실행된 `teardownChatChannel`(provider 에 대한 외부 네트워크 호출)까지는 되돌리지 못한다. 새로 추가된 e2e(`trigger-delete-concurrency.e2e-spec.ts`)도 "chatChannel 없는 webhook 트리거 — 외부 provider 호출을 만들지 않는다"고 스스로 주석에 적으며 이 경로를 피해 간다 — 즉 이 잔여 위험이 테스트로 커버되지 않는다는 것을 작성자도 인지한 채로 스코프를 좁혔다.
  - 참고: 이 순서(외부 해제가 락보다 먼저)는 이번 diff 가 도입한 것이 아니라 기존 설계이고(`git diff origin/main`으로 확인한 실제 변경분은 락 안 재조회 15줄 + catch 분기 1줄뿐), `trigger-resource-releaser.service.ts`의 `releaseExternalForParent`/`lockParentAndListTriggerIds` JSDoc 도 워크플로/워크스페이스 삭제 경로에 대해 같은 종류의 "남는 창"을 이미 알려진 잔여로 문서화하고 있다. 다만 provider teardown 은 "best-effort 라 binder 가 삼킨다"고 되어 있어 실패 시 예외가 전파되진 않지만, provider(Slack 등) API 에 대한 **중복 호출 자체**는 여전히 발생한다.
  - 제안: (a) 이번 plan(`plan/in-progress/trigger-dup-delete.md`)의 스코프/잔여 섹션에 "외부 provider teardown 중복 호출은 닫히지 않았다"는 사실을 명시해 다음 사람이 "동시 DELETE 문제는 다 닫혔다"고 오인하지 않게 하거나, (b) `releaseExternal`을 advisory lock 안의 재조회 뒤로 옮기거나 최소 두 번째 호출을 멱등하게 만드는 후속 작업을 트래킹할 것.

- **[INFO]** 진 쪽 요청의 응답이 `204`에서 `404`로 바뀌는 것은 의도된 공개 API 동작 변경(spec 트리거 목록 §4.4 준수)이며, `.catch` 핸들러가 `NotFoundException`을 재던지기 전에 `logger.error`를 건너뛰도록 분기를 추가해 "수동 정리 필요" 오경보(false alarm)를 없앤 것도 의도된 동작이다. 신규 unit(`triggers.service.spec.ts` 4030행 부근)과 e2e(`trigger-delete-concurrency.e2e-spec.ts`)가 이 변경을 커버하고, 실패 시 `error` 로그가 호출되지 않음을 명시적으로 단언한다. `Logger.prototype.error`를 스파이한 뒤 `finally`에서 `mockRestore()`하고 있어 전역 오염 없이 정리된다 — 문제 아님, 참고용.

- **[INFO]** `remove()` 트랜잭션 콜백 안에 `m.findOne(Trigger, { select: { id: true }, ... })` 조회가 하나 추가돼 삭제 경로마다 DB 왕복이 한 번 늘었다. 삭제는 드문 관리 동작이라는 주석(`releaseExternalMany`)과 일관되게 성능상 문제는 아니다.

- 나머지 리뷰 대상(`plan/in-progress/trigger-dup-delete.md`, `review/consistency/2026/09/20/21_43_47/**`)은 문서/리뷰 산출물이며 코드 부작용 관점에서 특기할 사항이 없다.

## 요약

diff 자체(`triggers.service.ts`의 락 안 재조회 + catch 분기, 신규 unit/e2e 테스트)는 "동시 DELETE 두 건이 감사를 두 번 남기고 두 번째도 204를 받는" 문제를 정확히 겨냥해 닫고 있고, 시그니처·전역 상태·환경 변수 변경은 없다. 다만 같은 레이스 조건에서 파생되는 "외부 chat-channel provider teardown 중복 호출"은 이번 수정 범위 밖에 그대로 남아 있으며, 이는 이번 diff 가 다루는 것과 동일한 동시성 창에서 발생하는 부작용이라 side-effect 관점에서는 짚어 둘 가치가 있다(작성자도 e2e 주석에서 이 경로를 의도적으로 피해 간 것으로 보아 인지하고 있는 잔여로 보인다). 원복이 필요한 뮤테이션은 수행하지 않았다.

## 위험도

LOW
