# 아키텍처(Architecture) Review

## 검토 범위

`plan/in-progress/trigger-config-lost-update.md` 후속 라운드. 이전 라운드(`review/code/2026/09/14/18_17_44` 등, 10회 이상)에서 지적된 아키텍처 관점 항목 중 다수가 이번 diff 로 해소된 상태를 확인했다(§긍정적으로 해소된 항목 참조). 이번 검토는 그 위에서 **새로 남거나 새로 생긴** 구조적 관찰에 집중한다. 코드 파일은 `trigger-config-lock.ts`(전문), `triggers.service.ts`/`chat-channel-binder.service.ts`(origin/main 대비 전체 diff), `hooks.service.ts`, `schedules.service.ts`, `chat-channel-input-rules.ts`, `__test-utils__/trigger-transaction-mock.ts`, `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 를 직접 읽었다. `review/**` 하위는 이전 라운드 산출물이 커밋에 포함된 것으로, 코드가 아니라 문서이므로 별도 항목화하지 않는다.

## 발견사항

- **[INFO]** 같은 급의 lost-update 방지 로직인데 하나만 순수 함수+전용 테스트로, 다른 하나는 클래스 사물 메서드로 남아 추출 규율이 비대칭이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:380`(`mergeIntoFreshSubKey`) vs `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:247`(`extractInboundSigningRef`)
  - 상세: `mergeIntoFreshSubKey`(줄 380-391)는 `this` 를 전혀 참조하지 않는 순수 함수(입력 `freshConfig`/`key`/`patch`/`fallback` → 출력 `Record<string, unknown>`)인데 `TriggersService` 의 `private` 메서드로 남아 있다. 반면 같은 PR 이 정확히 같은 이유("세 자리에 복제된 인라인 캐스트를 하나로 모은다")로 도입한 자매 함수 `extractInboundSigningRef` 는 모듈 레벨 `export function` 으로 뽑혀 `chat-channel-input-rules.spec.ts` 에 `it.each` 7케이스 전용 테스트를 갖는다. `mergeIntoFreshSubKey` 는 CHANGELOG/plan 이 "1라운드에 직접 적어 놓고 7라운드에 그대로 반복했다"고 자평한 바로 그 결함 클래스(하위 키 스냅샷 되돌림)를 막는 유일한 방벽인데, 전용 단위 테스트 없이 4개 호출부(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`rotateBotToken`·`promoteRotatedNotificationSecrets`)를 통한 간접 커버리지만 갖는다. `TriggersService` 인스턴스화(무거운 DI mock)를 거치지 않고는 이 병합 규칙 자체를 독립적으로 검증할 방법이 없다.
  - 제안: `mergeIntoFreshSubKey` 를 `extractInboundSigningRef` 와 같은 파일 또는 `trigger-config-lock.ts` 로 옮겨 모듈 레벨 순수 함수로 export 하고, 이 규칙만 겨누는 `it.each` 단위 테스트(하위 키 없음/객체 아님/patch 충돌 등)를 붙인다. 인스턴스 메서드로 유지할 이유(캡슐화가 필요한 상태)가 없다.

- **[INFO]** 락+재읽기+머지+쓰기 골격이 재사용 함수 한 벌과 인라인 사본 한 벌, 두 형태로 공존한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-173`(`rewriteTriggerConfigLocked`, `m.update` 사용) vs `codebase/backend/src/modules/triggers/triggers.service.ts:621-651`(`update()` 내 인라인 `manager.transaction` 블록, `m.save` 사용)
  - 상세: 두 창(2·3·4)은 `rewriteTriggerConfigLocked` 를 공유하지만, 창 1(`update()`)은 `save(entity)` 계약을 보존해야 한다는 이유로 같은 구조(트랜잭션 진입 → `acquireTriggerConfigLock` → `findOne` 재읽기 → 병합 → 쓰기)를 손으로 다시 적었다. 낮은 수준 프리미티브(`acquireTriggerConfigLock`)는 공유되지만, 그 위의 오케스트레이션 골격은 두 자리에 있다. `trigger-config-lock.ts` JSDoc 이 이 비대칭을 스스로 명시하고("이 함수를 쓰는 곳은 창 2·3·4다... 세 라운드 연속 지적된 혼동이라 여기 못박는다") 이전 6개 테스트 RED 실측을 근거로 남겼으므로 숨은 결함은 아니다. 다만 향후 이 골격에 변경(예: 재시도, 텔레메트리, 추가 불변식 검사)이 필요해지면 두 자리 모두 손으로 맞춰야 하는 구조적 비용은 남는다.
  - 제안: 지금 막을 사유는 아니다. 다음에 이 골격을 건드릴 일이 생기면, `save`/`update` 를 전략 함수로 주입받는 공통 템플릿(`withFreshConfig(manager, id, (fresh) => ({patch, persist: (target) => manager.save/update(...)}))` 류)으로 통합하는 것을 후속 검토 대상으로 남겨 둔다.

- **[INFO]** 제네릭 병합 유틸리티가 타입 소거 경계를 만들고, 호출부가 그 경계를 이중 캐스트로 넘는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1329`(`mergedChannel as unknown as Record<string, unknown>`)
  - 상세: `mergeIntoFreshSubKey`/`rewriteTriggerConfigLocked` 는 의도적으로 `Record<string, unknown>` 위에서 동작한다(엔티티 비특정, 재사용성 확보). 그 대가로 `ChatChannelConfig` 처럼 구체 타입을 가진 값(`mergedChannel`)을 넘길 때 `as unknown as Record<string, unknown>` 이중 캐스트가 필요하다 — 정확히 이 PR 이 고치는 "하위 키가 스냅샷으로 되돌아간다"는 버그가 발생했던 지점(§CHANGELOG의 `mergedChannel` patch 오용 사례)과 같은 자리다. `trigger-config-lock.ts` 자체도 같은 캐스트를 JSDoc 에서 "이 캐스트가 무엇을 잃게 하는가"로 명시하며 컴파일러가 `merge`/`patch` 반환 모양을 더 이상 검증하지 않는다는 점을 인정한다. 새 결함은 아니고 리스크도 낮지만(단위 테스트가 이 정확한 회귀를 캐너리로 고정했다), 제네릭 유틸리티의 구조적 비용이 타입 안전성 쪽으로 전가된 지점이라는 점은 기록해 둘 가치가 있다.
  - 제안: 조치 불요. 이 유틸리티를 제네릭화(`rewriteTriggerConfigLocked<T>`)할 기회가 오면 `merge`/`patch` 시그니처에 해당 서브키 타입을 파라미터화해 이 캐스트를 줄일 수 있다.

- **[INFO]** 정적 가드의 신규 분기가 식별자 텍스트 매칭이라 타입 별칭에는 맹점이 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:35`(`TRIGGER_ENTITY = 'Trigger'`), `:163-166`(`isManagerTriggerSave`)
  - 상세: `manager.save(Trigger, ...)` 형태를 가리기 위해 첫 인자가 `ts.isIdentifier` 이고 텍스트가 정확히 `'Trigger'` 인지로 판별한다. TS 타입 체커를 쓰지 않는 텍스트 매칭이라, `import { Trigger as TriggerEntity } from ...` 처럼 별칭 import 되면(현재 코드베이스엔 없음) 이 술어가 조용히 `false` 를 내 미탐지로 이어진다. 다만 이 가드는 `endpoint_path` 충돌 래핑 유무만 보는 좁은 스코프의 정적 래칫이고, 프로젝트 컨벤션(정적 가드는 "무지해서 안전"한 blind 형태가 정밀 파서보다 낫다)과 일치하는 선택이며, 실패 방향도 fail-open(놓친 자리는 다음 사람이 발견) 이 아니라 이미 `EXPECTED_WRAPPED_TRIGGER_SAVES`/`EXPECTED_UNWRAPPED_TRIGGER_SAVES` 두 목록이 전수 스캔 결과와 정확히 일치해야 통과하는 구조라 즉시 위험은 낮다.
  - 제안: 조치 불요. `Trigger` import 에 별칭이 생기는 순간(현재 없음) 이 판별식이 놓친다는 점을 `TRIGGER_ENTITY` 주석에 한 줄 남겨 두면 다음 사람이 원인을 더 빨리 찾는다.

## 긍정적으로 해소된 항목 (이전 라운드 대비)

- `review/code/2026/09/14/18_17_44/architecture.md` 가 지적한 "같은 `Trigger` 애그리게잇 안에 두 가지 쓰기 일관성 모델(락 재읽기 vs 스냅샷 전체 저장)이 공존"은 이번 diff 로 창 1(`update()`)도 같은 advisory lock 트랜잭션 안에서 재읽은 행을 저장 대상으로 삼도록 바뀌어(`triggers.service.ts:621-651`) 실질적으로 해소됐다. 저장 동사(`save` vs `update`)는 여전히 다르지만(위 두 번째 항목 참조), "락 밖에서 스냅샷을 통째로 쓰는" 경로 자체는 이제 없다.
- 같은 라운드의 maintainability WARNING("`buildFallbackChannel`/`buildMergedChannel` 두 클로저가 거의 동일한 스프레드-조건을 반복")은 `chat-channel-binder.service.ts` 에서 단일 `buildChannel` 클로저로 통합돼 해소됐다.
- `chat-channel-input-rules.ts` 에 흩어져 있던 세 자리 인라인 캐스트(`{ chatChannel?: { inboundSigningRef?: string } }`)가 `extractInboundSigningRef` 로 통합돼 drift 위험이 줄었다.
- `hooks.service.ts` 의 두 호출부(webhook / interaction ack)에 복제돼 있던 "`lastTriggeredAt` 만 갱신"이 `touchLastTriggeredAt` 사물 메서드 하나로 통합됐고, `config` 를 다루지 않는 컬럼 전용 갱신이라 `trigger-config-lock.ts` 를 끌어오지 않은 것도(모듈 간 불필요한 결합 회피) 적절하다.

## 요약

이번 라운드는 여러 차례의 리뷰-수정 순환을 거치며 아키텍처 관점에서 이전에 지적된 항목(창 1/창 2-4 간 동시성 모델 불일치, chat-channel-binder 의 클로저 중복, chat-channel-input-rules 의 캐스트 중복)을 실질적으로 해소했다. 새로 도입된 `mergeIntoFreshSubKey`·`assertTriggerFound`·`findByIdForUpdate`·`throwTriggerNotFound` 는 `TriggersService` 내부의 반복되던 문구·캐스트·패턴을 한 곳으로 모아 응집도를 높였다. 다만 정확히 같은 급의 lost-update 방지 로직인 `mergeIntoFreshSubKey` 가 자매 함수 `extractInboundSigningRef` 와 달리 순수 함수로 추출되지 않고 클래스 사물 메서드에 머물러 전용 단위 테스트 없이 간접 커버리지만 갖는 점, 그리고 락+재읽기+머지 골격이 재사용 함수(창 2-4)와 인라인 사본(창 1) 두 형태로 남아 있는 점은 문서화·근거가 충분한 의도된 트레이드오프이지만 향후 유지보수 비용으로 남는다. 두 항목 모두 이번 배치를 막을 사유는 아니며, 나머지 관찰(제네릭 병합의 타입 소거, 정적 가드의 식별자 텍스트 매칭)도 낮은 위험도의 기록 목적 항목이다.

## 위험도

LOW
