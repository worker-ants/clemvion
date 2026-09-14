# 아키텍처(Architecture) Review

## 검토 범위

이번 라운드(8라운드, 커밋 `a92bce095`)는 `trigger.config` lost-update 수정의 마지막 단계로,
`rewriteTriggerConfigLocked`(`codebase/backend/src/modules/triggers/trigger-config-lock.ts`)를
이미 아키텍처로 확립한 뒤 남은 일곱 개의 무가드 `save(entity)` 자리(notification secret
정규화/회전, per-trigger 토큰 폐기, 승격 cron 둘, chat-channel v2 정리 cron, schedule 편집의
trigger 동기화, 웹훅 인입 hot path 두 곳)를 같은 패턴(`config` 를 고치면 락 안 재작성, 아니면
컬럼 한정 `update`)으로 닫는다. 이전 7라운드가 이미 architecture 관점에서 핵심 설계(락 위치·
외부 호출 분리·순환 의존 부재)를 LOW 로 수렴시켜 뒀으므로, 이번 리뷰는 (a) 이번 라운드에서
새로 바뀐 자리, (b) 이전 라운드 지적이 실제로 해소됐는지 재확인에 집중했다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 가 `Trigger` 엔티티에 하드코딩돼 있다 — 계속 유효, 추적됨
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-141` (함수 시그니처가 `Trigger`/`Trigger['config']` 를 직접 참조)
  - 상세: 1라운드부터 지적된 사항이 이번 라운드에도 그대로 남아 있다. 이번 커밋으로 이 유틸리티의 소비처가 3곳→6곳으로 늘었지만(전부 `Trigger`), 제네릭화는 하지 않았다. `plan/in-progress/trigger-config-lost-update.md` §후속 표(`헬퍼가 Trigger 에 하드코딩`)에 명시적으로 등재돼 있어 의도적 유예이지 누락이 아니다.
  - 제안: 다른 엔티티에 같은 lost-update 클래스가 발견되는 시점에 `rewriteTriggerConfigLocked<T>(manager, entityClass, id, merge, columns)` 로 제네릭화. 지금 범위를 넓히라는 뜻은 아니다.

- **[INFO]** 같은 "락 안에서 재읽어 병합 후 쓰기" 개념이 두 가지 다른 구현으로 존재한다
  - 위치: 공용 구현 `trigger-config-lock.ts:136-173` (`rewriteTriggerConfigLocked`, `update()` 를 씀) vs 인라인 구현 `triggers.service.ts:588-636` (`update()` 메서드 안의 `manager.transaction` 블록, `save(Trigger, target)` 를 씀)
  - 상세: `TriggersService.update()`(창 1)는 `save()` 의 계약(반환 엔티티·subscriber·`endpointPath` UNIQUE 충돌 경로)을 보존해야 해서 공용 헬퍼를 거치지 못하고 락 획득(`acquireTriggerConfigLock`)만 공유한 채 읽기-병합-저장을 손으로 다시 적었다. `trigger-config-lock.ts:83-86` 자신이 이 사실을 "세 라운드 연속 지적된 혼동" 이라 명시하고 있어, 이미 문서화된 트레이드오프이지 숨은 결함은 아니다. 다만 구조적으로는 같은 동시성 프리미티브(lock→reread→merge)가 두 벌 존재하는 상태이고, 다음에 락 SQL 을 바꿀 일(예: `lock_timeout` 추가)이 생기면 두 자리를 각각 고쳐야 한다 — 실제로 `acquireTriggerConfigLock` 을 프리미티브로 뽑은 이유가 바로 이 위험을 줄이기 위해서였는데, 그 프리미티브를 감싼 "읽기+병합+쓰기" 절차 자체는 여전히 두 형태다.
  - 제안: 조치 불요(문서화된 트레이드오프). 다만 `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked` 의 JSDoc 어디에도 "창 1 은 이 함수를 거치지 않고 같은 락만 공유한다" 는 사실이 호출부 쪽(`triggers.service.ts:588` 부근)에는 없다 — 지금은 있지만(있음, `triggers.service.ts` 주석 확인됨) 향후 `rewriteTriggerConfigLocked` 시그니처가 바뀔 때 이 인라인 구현이 함께 검토 대상이라는 점을 그 함수의 JSDoc `@param` 근처에도 짧게 교차 참조해 두면 drift 위험이 더 줄어든다.

- **[INFO]** `withTransactionMock` 공용 테스트 헬퍼가 Trigger repo mock 을 가진 6개 spec 파일 중 2곳에만 적용됐다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:1-128` (신규), 적용된 곳 `triggers.service.spec.ts`, `triggers.web-chat.spec.ts`(`import` 확인: `triggers.web-chat.spec.ts:9`)
  - 상세: 헬퍼 자신의 JSDoc(`trigger-transaction-mock.ts` "왜 이 파일이 밖에 있나" 절)이 "나머지 4개(auth-configs·external-interaction·hooks·schedules)는 지금은 안전하지만 트랜잭션 경로를 호출하게 되는 순간 같은 오류로 깨진다" 고 스스로 명시한다. 즉 공용 유틸은 만들어졌지만 그 채택을 강제하는 장치(예: 공용 mock factory 를 거치도록 하는 규약·린트)가 없어, 다음 사람이 `hooks.service.spec.ts` 등에서 트랜잭션 경로를 새로 건드리면 같은 실패를 처음부터 다시 진단해야 한다. 실제로 이번 PR 이 `hooks.service.ts`(`touchLastTriggeredAt`)를 고쳤지만 그쪽은 `update()` 컬럼 한정이라 트랜잭션을 타지 않아 이번엔 문제가 안 됐다.
  - 제안: 조치 불요(문서로 미리 경고돼 있음). 다만 이 경고를 헬퍼 파일에만 두지 말고, 4개 미적용 파일 각각의 `getRepositoryToken(Trigger)` provider 옆에 한 줄 포인터를 남기면 실제로 그 파일을 고치는 사람이 헬퍼의 존재를 더 빨리 발견한다.

- **[INFO]** `TriggersService.update()` 가 트랜잭션/락 인라인 구현을 흡수하며 계속 커진다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:507` (`async update(...)` 시작) ~ `triggers.service.ts:636` 부근(트랜잭션 콜백 종료)
  - 상세: 검증(타입 분기·authConfig 확인)·`config` 병합·트랜잭션 경계·락 획득·재조회·저장까지 한 메서드가 책임진다. `plan/in-progress/trigger-config-lost-update.md` §후속("`update()` 가 182줄 — 트랜잭션 클로저를 `mergeAndSaveLocked(...)` 로 분리")에 이미 정확히 이 지적이 등재돼 있어 새로운 발견은 아니고, 이번 라운드가 메서드를 추가로 늘리지도 않았다(같은 자리를 재사용).
  - 제안: 조치 불요(추적됨). 후속 리팩터 시 트랜잭션 클로저를 `mergeAndSaveLocked(manager, trigger, merge)` 형태로 뽑아 검증 로직과 분리를 권고.

- **[INFO]** 정적 래칫의 엔티티 판별이 식별자 텍스트 매칭이라 타입 정보 없이 동작한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:35`(`TRIGGER_ENTITY = 'Trigger'`), `:162-166`(`isManagerTriggerSave` — 첫 인자가 식별자 `Trigger` 인지만 확인)
  - 상세: `m.save(Trigger, target)` 형태를 인식하기 위해 "첫 인자 식별자 텍스트가 `Trigger`" 인지만 본다 — import 된 엔티티 클래스인지 타입 체크하지 않는다. 스캔 범위가 `modules/triggers/**` 로 좁고(`endpoint-path-conflict-wrap.spec.ts:38` `TRIGGERS_DIR`), 실측(`grep`)으로 그 디렉터리 안에 `Trigger` 라는 이름의 비-엔티티 심볼이 없음을 확인했다 — 지금은 오탐/누락이 없다. 다만 이 술어는 "그 이름의 로컬 변수/별칭 import" 가 생기면 조용히 넓어지거나(다른 엔티티를 잘못 저장 자리로 셈) 좁아질(엔티티를 별칭으로 import 하면 누락) 수 있는 구조적으로 얇은 판별식이다.
  - 제안: 조치 불요(스캔 범위가 좁아 현재는 안전, 정밀 타입 체커 도입은 이 가드의 "blind 정규식/AST 로 충분" 이라는 기존 설계 방향과도 맞지 않는다). 다만 새 엔티티(`Schedule` 등)의 유사 lost-update 를 이 가드로 확장할 때는 이 식별자 매칭 방식이 그대로 재사용될 것이므로, 그때는 스캔 범위를 그 엔티티가 실제로 정의된 모듈로 좁히는 관례를 유지할 것.

## 이전 라운드 대비 확인한 개선

- **동시성 모델 이원화 해소**: 1라운드 architecture 리뷰가 지적했던 "같은 `Trigger` 애그리게잇 안에 락-재읽기 모델과 스냅샷-통째-저장 모델이 공존" 문제가 이번 라운드로 완전히 닫혔다. `endpoint-path-conflict-wrap.spec.ts` 의 `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 가 여섯 항목에서 **빈 배열**로 줄었고(`:59`), 기존 행을 대상으로 한 무가드 `save(entity)` 는 정적 래칫이 0건으로 고정한다. 좋은 수렴이다.
- **중복 클로저 통합**: 1라운드 maintainability 리뷰가 지적한 `buildFallbackChannel`/`buildMergedChannel` 두 클로저 중복이 이번 코드에는 단일 `buildChannel`(`chat-channel-binder.service.ts:226-241`)로 합쳐져 있다 — 재확인 결과 실제로 해소됐다.
- **인라인 캐스트 3중 복제 해소**: `extractInboundSigningRef`(`chat-channel-input-rules.ts`)로 통합돼 `triggers.service.ts`·`chat-channel-binder.service.ts` 양쪽이 같은 함수를 쓴다. 순수 함수 모듈에 위치한 것도 그 파일의 "협력자 0개는 순수 함수" 원칙과 일치한다.
- **외부 호출과 임계 구간 분리 유지**: 이번에 새로 닫힌 일곱 자리 중 외부 HTTP 호출이 낀 곳은 없다(전부 secret 정규화·컬럼 정리·schedule 동기화) — `trigger-config-lock.ts` 가 지키는 "외부 호출을 락 안에 두지 않는다" 제약을 위반할 여지 자체가 이번 변경엔 없었다. Cafe24 advisory lock 기각 사유 인용(`spec/2-navigation/4-integration.md:1444`)도 실측 확인 결과 정확하다.
- **순환 의존 없음**: `trigger-config-lock.ts` → `typeorm` + `Trigger` 엔티티뿐이고, 소비처(`chat-channel-binder.service.ts`, `triggers.service.ts`)로의 의존 방향은 단방향이다. `execution-engine.service.ts` 의 advisory-lock 선례(`:2974-2977`)도 실측 확인됨.

## 요약

이번 8라운드는 새 아키텍처를 도입하지 않고 이미 확립된 "advisory lock 안에서 재읽어 병합" 패턴을 남은 일곱 자리로 기계적으로 확장해, `Trigger` 행에 대한 무가드 full-entity `save()` 를 0건으로 만들고 정적 래칫으로 그 상태를 고정했다. 그 결과 1라운드부터 지적돼 온 "같은 애그리게잇 안 두 가지 동시성 모델 공존" 과 "중복 클로저/캐스트" 가 실제로 해소됐음을 코드 재확인으로 검증했다. 남은 항목은 전부 이전 라운드에서 이미 발견·등재되었거나 이번 라운드가 스스로 문서화한 의도적 트레이드오프(헬퍼의 `Trigger` 하드코딩, 락+재읽기 패턴의 두 구현체 공존, 테스트 헬퍼의 부분 채택, `update()` 메서드 비대화, 가드의 얕은 식별자 매칭)이며 전부 INFO 수준으로, 스캔 범위·문서화·후속 백로그가 위험을 낮게 유지한다. 차단 사유는 없다.

## 위험도

LOW
