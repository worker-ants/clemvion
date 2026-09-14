# 아키텍처(Architecture) 리뷰

## 검토 범위

이번 라운드(19_44_08)는 이전 두 라운드(18_17_44 → CRITICAL/WARNING 발견, 19_07_43 →
architecture WARNING "락 획득 SQL 중복")에서 지적된 항목을 수정한 세 번째 커밋
(`567c82edb` → `12ed21ff1` → `c7a9c107e`)을 포함한 최종 상태를 본다. 실제 소스 변경은
다음 7개 파일이다: `trigger-config-lock.ts`(신규 유틸 + `acquireTriggerConfigLock` 추출),
`triggers.service.ts`(창 1), `chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`
(`extractInboundSigningRef` 추출), `hooks.service.ts`(hot path `save`→`update`),
`endpoint-path-conflict-wrap-guard.ts`(정적 가드 확장), 그리고 테스트
(`trigger-config-lock.spec.ts` 신규, `trigger-transaction-mock.ts` 신규 공용화,
`hooks.service.spec.ts`, `triggers.service.spec.ts`, 가드 spec/fixture, e2e). 코드를
직접 열어 이전 라운드의 architecture 지적이 실제로 해소됐는지 확인했다(뮤테이션 없이
Read/Grep만 사용, 저장소 변경 없음 — `git status --short` 로 무흔적 확인).

## 발견사항

- **[INFO]** (해소 확인) 19_07_43 architecture WARNING — 락 획득 SQL 중복이
  `acquireTriggerConfigLock` 추출로 닫혔다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`
    (`acquireTriggerConfigLock(manager: Pick<EntityManager, 'query'>, triggerId: string)`),
    호출부 `trigger-config-lock.ts:100`(`rewriteTriggerConfigLocked` 내부)와
    `codebase/backend/src/modules/triggers/triggers.service.ts:550`(`update()` 창 1).
  - 상세: 이전 라운드는 `SELECT pg_advisory_xact_lock(hashtext($1))` 리터럴이
    `rewriteTriggerConfigLocked` 안과 `update()` 창 1 안에 각각 독립적으로 존재해, 향후
    `lock_timeout` 을 추가할 때 한쪽만 반영될 구조적 위험을 WARNING(MEDIUM)으로 지적했다.
    지금은 그 SQL 리터럴이 프로덕션 코드 전체에서 `trigger-config-lock.ts:43` 단 한 곳에만
    존재하고(`grep -rn pg_advisory_xact_lock`로 확인 — e2e 테스트의 재현용 리터럴 1곳
    제외), 두 호출부 모두 `acquireTriggerConfigLock` 을 통해 그 한 곳을 공유한다. 인자
    타입도 `Pick<EntityManager, 'query'>` 로 필요한 최소 인터페이스만 요구해(ISP) 낮은
    수준의 프리미티브로 적절히 뽑혔다. 이 WARNING 은 **닫힌 것으로 판단**한다.
  - 제안: 없음(확인 목적).

- **[INFO]** (해소 확인) 이전 라운드 maintainability WARNING — `chat-channel-binder`
  중복 클로저·중복 인라인 캐스트가 각각 `buildChannel`/`extractInboundSigningRef` 로
  통합됐다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:226-241`
    (`buildChannel` — 성공 경로 `:271`, 실패 경로 `:308` 이 공유), `chat-channel-input-rules.ts:247-250`
    (`extractInboundSigningRef`, 호출부 `chat-channel-binder.service.ts:211`,
    `triggers.service.ts:513`·`:563`).
  - 상세: "성공/실패 두 클로저가 거의 같은 스프레드-조건을 따로 든다"(구 WARNING) 문제와
    "같은 인라인 타입 캐스트가 세 자리에 복제"(구 WARNING) 문제 둘 다, 함수 하나로 합치는
    표준적인 Extract Function 리팩터로 해소됐다. 두 지점이 이제 이름 있는 단일 정의를
    공유하므로 한쪽만 고치고 다른 쪽을 놓치는 drift 위험이 구조적으로 줄었다.
  - 제안: 없음(확인 목적).

- **[INFO]** `hooks.service.ts` 의 hot-path 수정은 과도한 락 도입 없이 적절한 추상화
  수준을 택했다 — 아키텍처 판단으로 긍정적
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:232-236` (두 호출부 동일 패턴,
    `interact()`류 두 번째 자리는 diff 게이트 `700-704` 대응 위치).
  - 상세: 이 자리는 `chatChannel` 서브키 머지가 필요 없는 단일 컬럼(`lastTriggeredAt`) 갱신이라,
    `rewriteTriggerConfigLocked`(advisory lock + 재읽기)를 끌어오지 않고 TypeORM
    `update({id}, {lastTriggeredAt})` 로 좁혔다. 이는 lost-update 방지 수단을 "필요한 자리에만"
    적용한다는 원칙에 맞고, 웹훅 인입마다 도는 hot path 에 불필요한 트랜잭션·락 오버헤드를
    들이지 않는 판단이다. 다만 이 자리가 `save()` 대신 `update()` 를 쓰는 근거("config 를
    함께 되쓰지 않기 위해")가 `trigger-config-lock.ts` 의 "왜 필요한가" 절이 서술하는 것과
    같은 클래스의 문제라는 점은 주석(라인 227-231)이 이미 명시적으로 교차 인용하고 있어,
    "왜 여기는 락을 안 쓰는가"에 대한 설명 공백은 없다.
  - 제안: 없음(강점으로 기록).

- **[INFO]** `TriggersService.update()` 의 "읽기-머지-쓰기" 는 여전히 두 가지 구현으로
  갈려 있다 — 구조적으로 불가피함이 재확인됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:548-586`(창 1, `m.save(Trigger, target)`
    사용) vs `trigger-config-lock.ts:93-130`(`rewriteTriggerConfigLocked`, `m.update(Trigger, ...)` 사용).
  - 상세: 이전 라운드 WARNING 이 요구한 것은 "락 획득" 프리미티브의 공유였지 "읽기-머지-쓰기"
    전체의 단일화가 아니었다 — 창 1 은 반환 엔티티·subscriber·`endpointPath` UNIQUE 충돌
    경로가 `save()` 시맨틱에 묶여 있어(주석에 실측 근거 명시, 6개 unit 케이스 RED) `update()`
    기반 헬퍼를 그대로 재사용할 수 없다는 사실이 이번에도 코드로 확인된다. 지금 상태는
    "공유 가능한 부분(락)은 공유하고, 진짜 다른 부분(저장 동사)은 갈라 둔다"는 적절한 경계
    설정이다 — 억지로 하나의 함수로 합치면 `merge` 콜백 시그니처가 `save`/`update` 두 시맨틱을
    분기하는 조건부 로직을 안에 갖게 되어 오히려 응집도가 낮아졌을 것이다.
  - 제안: 조치 불요. 다섯 번째 쓰기 지점이 생길 때 어느 쪽 패턴을 따를지(계약이 `save` 를
    요구하는가 `update` 로 충분한가)를 판단 기준으로 남겨 두면 된다.

- **[INFO]** `endpoint-path-conflict-wrap-guard.ts` 의 `manager.save(Trigger, …)` 탐지가
  텍스트 식별자 매칭이라, 별칭 import 에는 무력하다 — 이미 알려진 트레이드오프의 연장
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:160-166`
    (`isManagerTriggerSave` — `first.getText(sf) === TRIGGER_ENTITY`).
  - 상세: 가드는 첫 인자가 리터럴 텍스트 `"Trigger"` 인 식별자인지만 본다. `import { Trigger as T }`
    처럼 별칭을 쓰면 `m.save(T, x)` 는 스캔에서 빠진다. 다만 이 가드는 이미 "모르는 것은
    통과시키되 아는 결함은 확실히 잡는다"(파일 자체 주석, 88-89행)는 단일 파일 AST 스캐너의
    한계를 명시적으로 감수하는 설계이고, 저장소의 자매 가드(`user-entity-exposure-guard.ts` 등)와
    같은 급의 트레이드오프다. 실제 프로덕션 코드에 별칭 import 관행이 없어 지금 당장의 사각
    지대는 아니다.
  - 제안: 조치 불요. 다음에 이 저장소에서 엔티티를 별칭으로 import 하는 관행이 생기면 그때
    다시 평가.

## 긍정적으로 확인한 설계 결정 (이슈 아님)

- 세 라운드에 걸쳐 지적된 architecture/maintainability WARNING 전부(락 SQL 중복, 클로저
  중복, 타입 캐스트 중복) 가 이번 커밋에서 "공용 함수로 추출"이라는 동일한 리팩터 패턴으로
  일관되게 해소됐다 — 임기응변 패치가 아니라 구조적 수정이다.
- `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked`/`extractInboundSigningRef` 셋
  모두 순수 함수 또는 최소 인터페이스(`Pick<EntityManager, 'query'>`)를 받는 형태로 뽑혀
  있어, 이전 라운드가 이미 확인한 "인프라(락+재읽기+쓰기)와 도메인 지식의 분리"가 이번 추출
  이후에도 유지된다.
- `trigger-transaction-mock.ts` 를 `triggers.service.spec.ts` 지역 헬퍼에서
  `__test-utils__/` 공용 자리로 올린 것은, 같은 provider mock 이 6개 파일에 흩어져 있다는
  사실을 전수로 세고 나서 내린 결정이라는 근거가 파일 JSDoc 에 남아 있다 — 테스트 인프라의
  모듈 경계를 "한 파일 그렙"이 아니라 실측으로 정했다.

## 요약

이번 라운드는 새 기능이 아니라 이전 두 라운드가 낸 architecture 지적(락 획득 SQL 중복
WARNING·클로저/캐스트 중복 WARNING)에 대한 구조적 수정이며, 코드를 직접 열어 확인한 결과
둘 다 "공용 함수 추출"로 실제로 닫혔다 — SQL 리터럴은 `acquireTriggerConfigLock` 한 곳,
`chatChannel` 조립은 `buildChannel` 한 곳, `inboundSigningRef` 추출은
`extractInboundSigningRef` 한 곳으로 수렴했다. 남은 것은 `save()` 시맨틱이 필요한 창 1 과
`update()` 기반 공용 헬퍼가 여전히 갈라져 있는 상태인데, 이는 실측(6개 unit 케이스 RED)에
근거한 의도적 경계이지 미해결 중복이 아니다. 새로 추가된 hooks.service.ts 의 hot-path
수정은 필요 이상으로 락을 끌어오지 않고 컬럼 단위 `update()` 로 범위를 좁혀, 이 PR 전체가
지켜 온 "임계 구간을 최소로 유지한다"는 설계 원칙과 일관된다. 새로운 SOLID 위반, 순환
의존, 레이어 경계 붕괴, 안티패턴은 발견되지 않았다. 남은 항목은 모두 이미 알려졌거나
구조적으로 불가피함이 재확인된 INFO 수준이다.

## 위험도

LOW
