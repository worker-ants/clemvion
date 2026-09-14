# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 가 `Trigger` 엔티티에 하드코딩돼 있어, 같은 lost-update 패턴이 필요한 다른 자리로 재사용이 안 된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:75` (`m.findOne(Trigger, ...)`), `:94` (`m.update(Trigger, ...)`)
  - 상세: 이 PR 이 도입한 «advisory lock 안에서 재읽어 머지 후 쓰기» 는 좋은 인프라 유틸리티지만, 함수 시그니처가 `Trigger` 타입을 직접 참조해 트리거 전용이다. 같은 PR 의 plan(`plan/in-progress/trigger-config-lost-update.md` §D "같은 클래스의 자리가 넷보다 많다")이 이미 `hooks.service.ts`·`schedules.service.ts` 등 10곳의 무가드 full-entity `save()` 를 후속 대상으로 등재해 뒀는데, 그 후속 작업이 착수되면 이 유틸을 그대로 못 쓰고 엔티티별로 복제하거나 제네릭화해야 한다.
  - 제안: 후속 착수 시점에 `rewriteTriggerConfigLocked<T>(manager, entityClass, id, merge, columns)` 형태로 엔티티를 매개변수화하는 편이, 지금 트리거 전용으로 굳혀 놓고 나중에 통째로 다시 설계하는 것보다 싸다. 지금 이 PR 범위를 넓히라는 뜻은 아니고, 후속 plan 착수 조건에 이 한 줄을 남겨 두는 것을 권고.

- **[INFO]** 같은 aggregate(`Trigger`) 안에서 두 가지 다른 동시성 일관성 전략이 공존한다 — 의도적으로 남겨진 격차
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:525` (창 1 — 그대로 둔 `save(trigger)`) vs `chat-channel-binder.service.ts:256`, `:293`, `triggers.service.ts:1120` (advisory-lock 재읽기)
  - 상세: 이번 PR 로 `chatChannel` 쓰기 3곳은 "락 안에서 최신 행을 재읽어 서브키만 머지" 로 통일됐지만, `update()` 의 `save(trigger)` (창 1) 은 여전히 `findById` 시점의 in-memory 스냅샷을 통째로 저장한다. 코드·plan 양쪽에 사유(반환 엔티티·subscriber·UNIQUE 충돌 경로가 함께 바뀌어 6개 케이스가 RED)가 명확히 기록돼 있어 "숨은 결함"은 아니지만, 모듈 수준에서 보면 같은 엔티티에 대해 서로 다른 쓰기 일관성 모델이 공존하는 상태로 이 PR 이 끝난다. `spec_impact: none` 인 plan 이지만 다음 사람이 "trigger.config 쓰기는 이제 다 락을 탄다"고 오해하지 않도록, 이 비대칭이 클래스/모듈 docblock 수준에서도 한 줄로 드러나면 더 좋다(현재는 plan 문서에만 있음).
  - 제안: `TriggersService` 클래스 상단 docblock 이나 `update()` 메서드 주석에 "chatChannel 하위 3곳은 advisory-lock 재읽기, `save(trigger)` 자체는 아직 아님 — `trigger-config-lost-update.md` §D" 한 줄을 추가해 코드 리더가 plan 문서까지 가지 않아도 알 수 있게 한다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 반환값(`Promise<boolean>`)이 세 호출부 어디에서도 관측되지 않는다
  - 위치: `chat-channel-binder.service.ts:256`(success), `:293`(catch), `triggers.service.ts:1120`(rotateBotToken) — 셋 다 `await rewriteTriggerConfigLocked(...)` 로 반환값을 버린다
  - 상세: JSDoc(`trigger-config-lock.ts:54-56`)은 "반환값을 두는 이유는 «조용히 아무것도 안 했다» 를 호출부가 관측할 수 있게 하기 위해서" 라고 명시하면서 "보통 무시하면 되지만" 이라는 단서도 같이 달아 뒀다 — 그래서 지금 상태가 계약 위반은 아니다. 다만 세 호출부 **전부**가 무시하는 상태로 병합되면, "관측할 수 있는 능력"이 실제로는 한 번도 쓰이지 않는 죽은 확장 포인트로 남는다.
  - 제안: 지금 막을 필요는 없지만, 트리거 삭제-경합이 실제 운영에서 관측되면(로그 부재로 원인 추적이 어려워지면) 이 API 가 이미 그 신호를 주게 설계돼 있다는 점을 인지하고, 최소 한 곳(예: `rotateBotToken`)에서라도 `false` 시 `logger.warn` 을 붙이는 것을 고려.

- **[INFO]** e2e 테스트가 lock key 생성 함수(`triggerConfigLockKey`)를 프로덕션 모듈에서 직접 import — 구현 세부사항에 대한 의도적 결합
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:7` (`import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock'`)
  - 상세: e2e 가 동시성 경합을 우연에 맡기지 않고 advisory lock 을 직접 쥐어 인위적으로 인터리빙을 만들기 위해 프로덕션 락 키 포맷을 그대로 재사용한다. 목적에는 부합하지만, 이 함수의 서명(`triggerId => string`)이 바뀌면 프로덕션 코드와 e2e 양쪽이 동시에 깨진다 — 일반적인 블랙박스 e2e 경계보다 한 칸 안쪽까지 들어간 결합이다. 이미 파일 상단 주석에서 "겹침을 테스트가 직접 만든다"는 설계 의도를 충분히 설명하고 있어 문제라기보다는 트레이드오프 기록 차원의 참고.
  - 제안: 별도 조치 불필요. 다만 `triggerConfigLockKey` 의 시그니처를 바꿀 때는 이 e2e 도 함께 깨진다는 점을 그 함수의 JSDoc 에 한 줄 남겨두면 향후 변경자가 놓치지 않는다.

## 요약

이번 변경은 `trigger.config` lost-update 를 막기 위해 "advisory lock 을 트랜잭션 밖 외부 호출과 분리하고, 락 안에서는 최신 행을 재읽어 서브키만 머지한다"는 하나의 설계를 `trigger-config-lock.ts` 라는 단일 책임 유틸리티로 뽑아내고, 그 위에 `chat-channel-binder.service.ts`·`triggers.service.ts` 세 쓰기 지점을 얹었다. 이 설계는 저장소에 이미 있는 선례(`execution-engine.service.ts` 의 admission advisory-lock)와 동일한 관용구를 따르고, 인프라(락+재읽기+쓰기)와 비즈니스 규칙(`inboundSigningRef` presence 게이트 재계산)을 콜백 경계로 깔끔하게 분리해 유틸리티 자체는 도메인 지식이 없는 상태를 유지한다. 순환 의존성은 없고(`trigger-config-lock.ts` → typeorm/`Trigger` 뿐), 두 서비스가 그 유틸리티에 단방향으로 의존하는 구조도 건전하다. 가장 눈에 띄는 설계 절제는 "창 1"(`update()`의 `save(trigger)`)과 다른 9곳의 무가드 `save()` 를 실측 근거(6개 테스트 RED)와 함께 명시적으로 범위 밖으로 유예한 점 — 성급한 일괄 리팩터링 대신 후속 항목으로 정직하게 등재했다. 다만 그 유예로 인해 같은 `Trigger` 애그리게잇 안에 두 가지 쓰기 일관성 모델(락 재읽기 vs 스냅샷 전체 저장)이 공존하게 되는데, 이는 코드 docblock 수준에는 드러나지 않고 plan 문서에만 기록돼 있다. 새 유틸리티가 `Trigger` 전용으로 하드코딩된 점도, 같은 plan 이 예고한 후속 확장(다른 엔티티의 lost-update 수정)에서 재설계 비용을 남긴다. 이들은 모두 차단 사유가 아니라 후속 가시성/재사용성에 관한 낮은 위험도의 관찰이다.

## 위험도
LOW
