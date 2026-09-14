# 아키텍처(Architecture) Review

## 검토 범위와 전제

이 PR 은 5라운드 이상의 리뷰-수정 사이클을 거친 누적 diff다(`git log` 상 `12ed21ff1`
"창 1 도 닫는다" → `c7a9c107e` → `369852b4f` → `889c93cd9` "삭제도 같은 락을 잡는다" →
`e5319a409` "관측 고리…"). 프롬프트에 포함된 `review/code/2026/09/14/18_17_44/*.md` 등 이전
라운드 산출물은 코드가 아니라 리뷰 히스토리이므로 아키텍처 판단 대상에서 제외했다. 실제
코드는 `codebase/backend/src/modules/triggers/{trigger-config-lock.ts, chat-channel-binder.service.ts,
triggers.service.ts, chat-channel-input-rules.ts, __test-utils__/trigger-transaction-mock.ts}`,
`codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/repo-guards/__tests__/
endpoint-path-conflict-wrap-guard.ts` 를 현재 상태 그대로 직접 Read 해 확인했다(diff 가 프롬프트
크기 제한으로 생략된 파일 포함).

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 가 여전히 `Trigger` 엔티티에 고정돼 있다 — 재사용 범위가 트리거 전용
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:127` (시그니처), `:142`(`m.findOne(Trigger, …)`), `:161`(`m.update(Trigger, …)`)
  - 상세: 이전 라운드(`review/code/2026/09/14/18_17_44` architecture INFO)에서 이미 지적된 사항이 이번 라운드에서도 그대로 유지된다. `plan/in-progress/trigger-config-lost-update.md` §D가 같은 "무가드 full-entity save" 클래스에 속하는 자리를 `src/` 전수 조사로 8곳(`rotateNotificationSecret`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`·`schedules.service.ts#update` 등) 더 나열해 뒀다. 이 유틸이 `Trigger` 하드코딩인 채로 남으면, 그 후속 항목들이 착수될 때 제네릭화 없이는 그대로 재사용할 수 없다.
  - 제안: 지금 범위를 넓힐 필요는 없으나(현재도 `plan` 에 후속 조건으로 잘 등재돼 있음), 후속 착수 시 `rewriteTriggerConfigLocked<T>(manager, entityClass, id, merge, columns)` 형태의 매개변수화를 1순위로 검토할 것을 재확인한다.

- **[INFO]** 정적 가드의 신규 매칭 조건이 식별자 **텍스트** 비교라 타입 별칭에 취약한 잠재적 사각지대
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:162-166` (`first.getText(sf) === TRIGGER_ENTITY`)
  - 상세: `manager.save(Trigger, …)` 형태를 잡기 위해 첫 인자가 리터럴 문자열 `'Trigger'` 와 일치하는 식별자인지를 본다. 이 파일의 자체 docblock(`:29-34`)이 "수신자 이름이 임의"라는 이유로 이 필드로 옮겨 왔다고 밝히는데, 인자 쪽 식별자 이름 역시 `import { Trigger as T }` 같은 별칭이 들어오면 똑같이 임의가 된다 — 현재 `src/modules/triggers/**` 전체를 확인한 결과 `Trigger` 를 별칭 없이 import 하는 것으로 그쳐(실측: `grep -rn "Trigger as " codebase/backend/src/modules/triggers/*.ts` 0건) 지금은 잠재적 위험일 뿐 실제 결함은 아니다. 다만 타입 체커를 쓰지 않는 텍스트 매칭이라, 나중에 별칭 import 가 하나 생기면 그 자리는 조용히 미탐지(가드가 "unwrapped" 를 놓치는 fail-open 방향)로 빠질 수 있다.
  - 제안: 급하지 않음. 이 가드 파일을 다시 손댈 일이 생기면 `ts.TypeChecker` 로 인자의 심볼을 해석해 엔티티 클래스 자체를 비교하는 편이 식별자 텍스트 매칭보다 별칭에 강건하다는 점을 남겨 둘 것.

- **[INFO]** 같은 `Trigger` 애그리게잇 안에서 두 가지 동시성 일관성 모델이 이번에도 공존하지만, 이번엔 실측 근거로 넓게 문서화됐다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:579-628`(`update()` — 이제 락 안에서 재읽어 저장) vs `:1028`(`rotateNotificationSecret`), `:1076`(`revokePerTriggerToken`), `:1299`, `:1330`(`promoteRotatedNotificationSecrets`) — 이들은 여전히 락 없는 `save(trigger)` 다
  - 상세: 이전 라운드에서 "창 1"(`update()`)만 예외였던 것과 달리, 이번엔 창 1도 advisory lock 경로로 들어왔다(`:581` `acquireTriggerConfigLock`). 그 결과 `chatChannel` 관련 4개 창은 전부 락+재읽기로 통일됐고, 남은 비대칭은 `notification`/`interaction` 서브키를 건드리는 별개의 4~5개 메서드로 좁혀졌다. `plan/in-progress/trigger-config-lost-update.md` §D "같은 클래스의 자리가 넷보다 많다"가 이 잔여 8곳을 실제로 세어(`config` 명시 수정 3곳 + 암묵적 동반 3곳) 후속 항목으로 명시했으므로 숨은 결함은 아니다. 다만 클래스/모듈 docblock 수준에는 이 비대칭이 드러나지 않아, `trigger-config-lock.ts` 만 읽은 다음 사람은 "trigger 의 config 쓰기는 이제 다 락을 탄다"고 오해할 수 있다는 이전 지적이 아직 유효하다.
  - 제안: `TriggersService` 클래스 상단 또는 `rotateNotificationSecret`/`revokePerTriggerToken` 메서드 주석에 "이 메서드는 `chatChannel` lost-update 수정(창 1~4) 범위 밖 — `trigger-config-lost-update.md` §D 후속" 한 줄을 남기면 코드 리더가 plan 문서까지 가지 않아도 경계를 알 수 있다.

## 이전 라운드 대비 개선점 (참고, 이슈 아님)

- `rewriteTriggerConfigLocked` 의 `Promise<boolean>` 반환값이 이제 두 호출부 모두에서 실제로 관측된다 — `chat-channel-binder.service.ts:286`(`if (wrote) { channelListenerRegistry.register(...) }`)와 `triggers.service.ts:1243`(`if (!wrote) this.assertTriggerFound(null);`). 18_17_44 라운드가 지적한 "관측되지 않는 죽은 확장 포인트"가 해소됐다.
- `acquireTriggerConfigLock` 을 별도 함수로 뽑아 창 1(`triggers.service.ts:581`)·삭제(`triggers.service.ts:970`)·`rewriteTriggerConfigLocked` 내부(`trigger-config-lock.ts:134`) 세 곳이 같은 락 획득 SQL 경로를 공유한다 — `19_07_43` 라운드가 지적한 "락 SQL 이 두 자리에 손으로 복제될 위험"이 구조적으로 닫혔다.
- `hooks.service.ts` 의 `touchLastTriggeredAt`(`:978-984`) 추출은 동일 주석+코드가 두 호출부(`handleWebhook`, chat-channel 인입)에 복제돼 있던 것을 하나의 private 메서드로 통합했다 — 이 PR 스스로가 겪은 "복제가 drift 를 부른다"(한쪽만 회귀 테스트를 가져 다른 쪽이 되돌려도 GREEN 이었던 사례)를 구조로 재발 방지한다.
- `extractInboundSigningRef`(`chat-channel-input-rules.ts:247-250`) 추출로 동일한 인라인 캐스트가 세 자리(`triggers.service.ts` 두 곳, binder 한 곳)에 복제돼 있던 것이 이름 있는 단일 함수로 좁혀졌다 — `19_07_43` maintainability WARNING#7 이 해소됐다.

## 요약

이 라운드의 순변화는 "창 1"(`TriggersService.update()`)을 advisory-lock 재읽기 경로로 편입하고, 삭제(`remove()`)에도 같은 락(단, 상한 있는 버전)을 적용하고, 웹훅 인입 hot path 의 `config` 전체 재작성을 컬럼 한정 `update` 로 좁힌 것이다. 설계 자체는 이전 라운드부터 이어진 "advisory lock + 트랜잭션 밖 외부 호출 + 락 안 재읽기-머지-쓰기"라는 단일 패턴을 그대로 확장한 것이라 새로운 아키텍처 리스크를 들여오지 않았고, 오히려 이전에 지적됐던 "반환값 미관측"·"락 SQL 손복제" 두 결함을 구조적으로 닫았다. 남은 관찰 사항(유틸리티의 `Trigger` 전용 하드코딩, `notification`/`interaction` 서브키에 대한 다른 일관성 모델의 잔존, 신규 정적 가드의 텍스트 매칭 취약점)은 전부 INFO 수준이며, 그중 가장 큰 것(모델 이원화)은 `plan` 문서가 실측과 함께 후속 범위로 명시적으로 등재해 둔 상태다. 순환 의존성은 없고(`trigger-config-lock.ts` → typeorm/`Trigger` 단방향), 두 서비스가 그 유틸리티에 단방향으로 의존하는 구조도 여전히 건전하다.

## 위험도

LOW
