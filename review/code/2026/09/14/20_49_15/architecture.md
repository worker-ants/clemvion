# 아키텍처(Architecture) Review

## 검토 범위

`trigger.config` lost-update 수정의 최종 상태(누적 커밋 `567c82edb`~`889c93cd9`)를
`origin/main` 대비 전수 diff(`git diff origin/main...HEAD --stat`, 93 files)로 확인했다.
실질 프로덕션 코드 변경은 `codebase/backend/src/modules/{triggers,hooks}/**` 6개 파일 +
정적 가드(`repo-guards`) 3개 파일이며, 나머지 다수는 이전 리뷰 라운드
(`review/code/2026/09/14/{18_17_44,19_07_43,19_44_08,20_17_16}/**`)의 기산출물·plan·테스트다.
아래는 그 이전 라운드들이 이미 지적·수용한 항목(창 1 `save(trigger)` 유예, advisory lock
네임스페이스 공유, 삭제-레이스 등)은 반복하지 않고, 이번 최종 상태에서 남아 있는 아키텍처
관점의 관찰만 정리한다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 가 `Trigger` 엔티티에 하드코딩돼 있어 plan 이 예고한 후속 확장(다른 엔티티의 같은 클래스 lost-update)에 재사용이 안 된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:106-143` (특히 121행 `m.findOne(Trigger, …)`, 140행 `m.update(Trigger, …)`)
  - 상세: 함수 시그니처와 본문이 `Trigger` 타입을 직접 참조한다. `plan/in-progress/trigger-config-lost-update.md` §D 가 `hooks.service.ts`·`schedules.service.ts` 등 같은 패턴(무가드 full-entity `save()`)을 가진 다른 자리를 후속 대상으로 이미 등재해 둔 상태라, 그 작업이 착수되면 이 유틸을 그대로 재사용하지 못하고 엔티티별로 복제하거나 뒤늦게 제네릭화해야 한다. (이전 라운드 `18_17_44/architecture.md` 에서 이미 지적됐고 이번 라운드까지 변경 없이 유지됨 — 재확인 차원.)
  - 제안: 후속 착수 시점에 `rewriteEntityConfigLocked<T>(manager, entityClass, id, merge, columns)` 형태로 매개변수화. 지금 범위를 넓히라는 뜻은 아니고, 후속 plan 착수 조건에 남겨 둘 것.

- **[INFO]** 같은 `Trigger` 애그리게잇 안에 두 가지 쓰기 동시성 모델이 최종 상태까지 공존한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:572-624`(창 1 — `manager.transaction` 안에서 `acquireTriggerConfigLock` 만 잡고 `m.save(Trigger, fresh)` 로 스냅샷 통째 저장, 623행) vs `:960-963`(`remove()` — 같은 lock-only 패턴이지만 `m.remove`) vs `:1208`(`rotateBotToken` — `rewriteTriggerConfigLocked` 로 완전 위임) vs `chat-channel-binder.service.ts:266`,`:310`(binder 성공/실패 — 역시 `rewriteTriggerConfigLocked`)
  - 상세: `rewriteTriggerConfigLocked` 를 쓰는 세 자리는 "락 안에서 재읽고 서브키만 머지"로 통일됐지만, `update()`(창 1)와 `remove()` 는 `acquireTriggerConfigLock` 프리미티브만 재사용하고 읽기·쓰기는 각자 인라인으로 구현한다 — `save()`/`remove()` 계약 보존이 이유로 코드·plan에 명확히 기록돼 있어 "숨은 결함"은 아니다. 다만 이번 PR 이 `remove()` 에도 같은 lock-only 인라인 패턴을 새로 추가하면서, 결과적으로 이 애그리게잇에는 (a) lock-only 인라인 재구현이 2곳(`update`, `remove`), (b) `rewriteTriggerConfigLocked` 완전 위임이 3곳, 두 가지 스타일이 공존하는 상태로 굳어졌다. `update()` 와 `remove()` 사이에도 "advisory lock 을 잡은 트랜잭션을 손으로 연다"는 보일러플레이트가 그대로 반복된다(둘 다 `this.triggerRepository.manager.transaction(async (m) => { await acquireTriggerConfigLock(m, id); … })`).
  - 제안: 차단 사유 아님(이미 plan §D 로 추적됨). 다만 `manager.transaction(async (m) => { await acquireTriggerConfigLock(...); ... })` 골격 자체는 `save`/`remove`/`update` 세 계약 모두에서 반복되므로, 후속 작업에서 "락을 잡은 트랜잭션을 연다"는 부분만이라도 작은 헬퍼(`withTriggerConfigLock(manager, id, cb)`)로 뽑으면 `rewriteTriggerConfigLocked` 와 창 1/`remove()` 가 최소한 "락 획득" 지점에서는 같은 코드를 지나가게 할 수 있다.

- **[INFO]** 정적 가드가 엔티티 식별을 타입 체커 없이 문자열 이름 매칭으로 확장했다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:160-170` (`isManagerTriggerSave` — `first.getText(sf) === TRIGGER_ENTITY`)
  - 상세: `manager.save(Trigger, entity)` 형태를 잡기 위해 첫 인자가 텍스트로 `'Trigger'` 인 식별자인지만 본다(타입 체커 미사용, 순수 AST). 이 가드가 스캔 대상으로 삼는 `codebase/backend/src` 안에서 지금은 안전하지만(다른 `Trigger` 식별자가 이 스코프에 없다는 전제), `import { Trigger as T } from './entities/trigger.entity'` 로 별칭을 주거나 같은 이름의 다른 클래스를 같은 파일에서 쓰면 각각 false negative/false positive 로 조용히 갈릴 수 있다. 이 가드는 원래도 "이름 해석은 하지 않는다"(99-98행 주석)는 규율을 스스로 명시한 저정밀 가드이므로 새로운 종류의 위험은 아니고, 기존 정밀도 등급을 한 축(엔티티 식별) 더 넓힌 것뿐이다.
  - 제안: 조치 불요. 다만 `Trigger` 별칭 import 가 실제로 생기면 이 가드가 그 사실을 자동으로 알려주지 않으므로, `TRIGGER_ENTITY` 상수 옆에 "별칭 import 는 놓친다"는 한계를 한 줄 남겨 두면 다음 사람이 가드의 침묵을 신뢰의 근거로 오독하지 않는다.

- **[INFO]** `ChatChannelBinderService.setupChatChannel` 이 이번 PR 로 로컬 클로저 2개(`survivesWithFresh`, `buildChannel`)를 추가로 얻어 단일 메서드의 책임이 더 늘었다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:87-323` (`setupChatChannel` 전체), 특히 `209-211`(`survivesWithFresh`)·`226-241`(`buildChannel`)
  - 상세: 이 메서드는 원래도 secret 3중 쓰기·plaintext 제거·ref 보존 게이트·adapter 호출·config 조립·에러 처리를 한 함수 안에 담고 있었다(이전 라운드에서 이미 INFO 로 지적). 이번 변경은 이전 라운드가 지적한 "거의 동일한 두 클로저(`buildFallbackChannel`/`buildMergedChannel`) 중복" 을 `buildChannel(freshConfig, setupResult?)` 하나로 성공적으로 통합했지만(그 자체는 긍정적 개선), presence 게이트 재계산 로직(`survivesWithFresh`)까지 포함해 여전히 236줄짜리 메서드 안에 로컬 함수 2개 + try/catch 두 분기가 함께 존재한다. 함수 자체가 이번에 더 커진 것은 아니라 신규 결함은 아니다.
  - 제안: presence-gate 재계산 + config 조립(`survivesWithFresh`/`buildChannel`)을 모듈 레벨 순수 함수로 뽑아 `chat-channel-input-rules.ts`(이미 이 PR 이 `extractInboundSigningRef` 를 그리로 옮긴 자리)로 옮기면, 이 메서드는 I/O 오케스트레이션(secret store·adapter·DB)만 남고 순수 로직은 이미 단위 테스트가 붙은 파일로 합류한다.

- **[INFO]** 트랜잭션 mock 헬퍼가 알려진 6개 소비처 중 2곳에만 배선돼 있고, 나머지 4곳은 "그 경로를 타는 순간 깨진다"는 사실이 코드가 아니라 주석으로만 예고돼 있다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:27-40`
  - 상세: 이 파일의 docblock 은 `getRepositoryToken(Trigger)` provider 가 6개 파일에 흩어져 있고 그중 `auth-configs`·`external-interaction`·`hooks`·`schedules` 4개는 아직 트랜잭션 경로를 안 타 안전하다고 명시한다. 이는 정직한 기록이지만, 그 안전성이 "그 4개 스펙 파일이 향후 `TriggersService` 의 트랜잭션 경로를 호출하는 코드를 테스트하게 되는 순간" 이라는 외부 조건에 의존하는 잠재적 시한폭탄이다 — 그 순간이 오면 실패 메시지(`Cannot read properties of undefined (reading 'transaction')`)가 이 파일과 무관해 보여 원인 추적 비용이 든다. 프로덕션 아키텍처 문제는 아니고 테스트 인프라 결합에 관한 관찰이다.
  - 제안: 조치 불요(문서화됨, 프로덕션 영향 없음). 여유가 있으면 4개 파일에도 선제적으로 `withTransactionMock` 을 적용해 이 조건부 위험 자체를 없애는 편이 다음 사람이 같은 에러 메시지를 다시 디버깅하는 비용보다 쌀 수 있다.

## 긍정적으로 확인한 점 (참고)

- `extractInboundSigningRef` 추출(`chat-channel-input-rules.ts:247-250`)이 3곳에 복제돼 있던 동일 인라인 캐스트를 단일 진입점으로 통합했다 — DIP/DRY 개선이며, `chat-channel-binder.service.ts`·`triggers.service.ts` 양쪽이 이제 이름 있는 함수 하나에 의존한다.
- `HooksService.touchLastTriggeredAt`(`hooks.service.ts:978-984`) 추출이 두 호출부(`handleWebhook`·상호작용 ack 경로)의 복제된 5줄 주석 + 4줄 코드를 하나로 묶었다 — 이 PR 자체가 실측(뮤테이션)으로 "한쪽만 회귀 테스트를 가져 다른 쪽이 되돌려도 GREEN" 이었음을 확인한 뒤 얻은 교훈을 구조로 반영한 결과다.
- `rotateBotToken` 이 `rewriteTriggerConfigLocked` 의 반환값(`wrote`)을 관측해 삭제-경합 시 404 로 응답하도록 배선됐다(`triggers.service.ts:1224-1229`) — 이전 라운드가 "반환값이 세 호출부 어디에서도 관측되지 않는다"고 지적한 INFO 항목이 이번 최종 상태에서 절반(동기 요청 경로) 해소됐다. 나머지 절반(binder 의 best-effort 후속 경로)은 설계 문서(`trigger-config-lock.ts:96-104` 의 표)가 "그 자리는 의도적으로 감춘다"고 명시하므로 잔여 지적 대상이 아니다.
- 모듈 의존 방향은 여전히 단방향이다: `trigger-config-lock.ts` ← `chat-channel-binder.service.ts`/`triggers.service.ts`, `chat-channel-input-rules.ts` ← 같은 두 소비자. 역방향 참조나 순환은 관찰되지 않았다. 외부 HTTP 호출(adapter/secret store)을 advisory lock 트랜잭션 밖에 두는 설계 제약도 세 신규 호출부(`update`/`remove`/`rotateBotToken`/binder 양쪽) 전체에 일관되게 지켜졌다.

## 요약

최종 상태는 이전 4라운드 리뷰가 지적한 아키텍처 항목들(중복 클로저 통합, 반환값 관측 배선, 삭제-레이스 락 확장)을 대부분 코드 구조로 흡수했다 — `buildFallbackChannel`/`buildMergedChannel` 이 `buildChannel` 하나로, `rewriteTriggerConfigLocked` 반환값이 동기 요청 경로(`rotateBotToken`)에서 실제로 소비되도록, `remove()` 도 같은 advisory lock 안으로. 남은 관찰은 전부 이전에도 낮은 위험도로 등재됐거나 이번 라운드가 새로 만든 것이 아닌 후속 확장성 관찰(엔티티 하드코딩, 두 동시성 모델 공존, 정적 가드의 문자열 매칭 한계, 메서드 크기, 테스트 헬퍼 부분 적용)이며, 어느 것도 지금 이 PR 을 막을 사유가 아니다. 순환 의존·레이어 위반·SOLID 위반은 관찰되지 않았고, `trigger-config-lock.ts` 라는 신규 단일 책임 유틸리티로 "advisory lock + 락 안 재읽기 + 서브키 머지" 라는 하나의 설계를 뽑아 세 호출부가 공유하게 한 결정이 이 PR 전체의 아키텍처 핵심이며 타당하다.

## 위험도

LOW
