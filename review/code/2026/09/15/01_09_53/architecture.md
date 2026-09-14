# Architecture Review — trigger.config lost-update 수정 (delta: schedules cascade 락)

## 검토 범위

이번 라운드(01_09_53)의 실제 델타는 직전 아키텍처 리뷰(`review/code/2026/09/15/00_38_16`,
커밋 `3641ead21` 시점)이후 추가된 커밋 `2a87eb2f0` 하나다 — `SchedulesService.remove()` 의
trigger cascade 삭제를 `TriggersService.remove()` 와 같은 `acquireTriggerConfigLock` 으로
감싼 수정. 나머지 13개 소스 파일은 이전 라운드들에서 이미 반복 검토됐고 이번 커밋에서
변경되지 않아 재분석 대상에서 제외했다(`git show --stat 2a87eb2f0` 로 실제 변경 파일을
`schedules.service.ts`·`schedules.service.spec.ts`·`trigger-transaction-mock.ts`·
`trigger-config-lock.ts`(JSDoc 표만) 넷으로 확인). `plan/`·`review/**` 산출물은 코드가
아니라 대상에서 제외.

## 발견사항

- **[WARNING]** "락 안에서 Trigger 행을 지운다" 프리미티브가 두 모듈에 독립적으로
  인라인 구현돼 있고, 실패 시 관측성이 서로 다르다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()`
    (308-316행, `this.triggerRepository.manager.transaction(async (m) => { acquireTriggerConfigLock(...); await m.delete(Trigger, triggerId); })`)
    vs `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()`
    (1025-1039행, 동일한 `manager.transaction(async (m) => { acquireTriggerConfigLock(...); await m.remove(trigger); })`)
  - 상세: 두 메서드는 "advisory lock 을 잡고 그 안에서 Trigger 행을 지운다"는 **같은
    개념**을 각자 손으로 다시 적었다. `trigger-config-lock.ts` 는 쓰기(merge) 쪽엔
    `rewriteTriggerConfigLocked` 라는 공용 프리미티브를 이미 제공하는데(트랜잭션·락·재읽기를
    한 함수로 묶음), 삭제 쪽엔 그 대응 함수가 없어 두 호출부가 트랜잭션 열기·락 획득·
    타임아웃 옵션 전달까지 매번 복제한다. 그 결과 두 구현이 이미 갈라졌다 —
    `TriggersService.remove()` 는 트랜잭션이 실패하면 `.catch((err) => { this.logger.error(
    '...반쯤 삭제된 상태다. 수동 정리가 필요하다...'); throw err; })` 로 "BullMQ/secret/listener
    정리는 이미 끝났는데 행 삭제만 실패했다"는 운영 진단 메시지를 남기고 재던진다. 반면
    `SchedulesService` 에는 `Logger` 인스턴스 자체가 없고(`grep -n "Logger" schedules.service.ts`
    0건), `remove()` 의 동일한 트랜잭션에는 `.catch` 가 전혀 없어 같은 실패 클래스("BullMQ
    job 은 이미 제거됐는데 트리거/스케줄 행 삭제가 실패해 반쯤 삭제된 상태")가 발생해도
    아무 진단 로그 없이 예외가 그대로 위로 전파된다. 요청은 500 으로 실패하므로 응답
    관점의 정확성 문제는 아니지만, 정확히 이 클래스의 실패를 다음 사람이 로그만 보고
    진단할 수 있게 하자는 것이 형제 코드(`TriggersService.remove()`)의 명시적 설계
    의도였는데 그 의도가 두 번째 호출부로 전파되지 않았다.
  - 이 PR 은 정확히 같은 형태의 문제(하나의 개념이 클래스/모듈 경계 때문에 재사용되지
    못하고 별도 구현으로 갈라지는 것)를 직전 라운드(`00_38_16`)가 이미 `mergeIntoFreshSubKey`
    (쓰기 쪽 서브키 병합)에 대해 WARNING 으로 지적한 바 있다. 이번 델타는 그 지적이
    경고했던 바로 그 패턴이 **삭제 쪽**에서 실제로 재발한 사례다 — "삭제 경로가 둘인데
    하나만 락을 잡았다"는 이번 커밋의 버그 자체가, 이 개념을 한 곳에 정본으로 두지 않고
    호출부마다 손으로 구현하게 한 설계에서 비롯된 것이다. 헬퍼가 없으니 두 번째 삭제
    경로를 처음부터 놓쳤고, 헬퍼가 없으니 지금도 두 구현이 조용히 달라져 있다.
  - 제안: `trigger-config-lock.ts` 에 삭제용 프리미티브(예: `deleteTriggerLocked(manager,
    triggerId, { timeoutMs, onError })` 또는 최소한 트랜잭션+락+타임아웃까지만 묶고 실제
    삭제 문(`m.remove(trigger)` vs `m.delete(Trigger, id)`)은 콜백으로 받는 형태)를 추가해
    두 호출부가 공유하게 한다. 이러면 (a) 향후 세 번째 삭제 경로가 생겨도 이 프리미티브를
    쓰는 한 락을 놓칠 수 없고, (b) 실패 시 진단 로깅 정책을 한 곳에서 결정해 두 모듈이
    같은 수준의 운영 관측성을 갖는다. `TriggersService.remove()` 가 `m.remove(trigger)` 를
    쓰고 `SchedulesService.remove()` 가 `m.delete(Trigger, id)` 를 쓰는 차이(엔티티 인스턴스
    보유 여부)는 프리미티브가 삭제 문 자체를 콜백으로 위임하면 흡수된다.

- **[INFO]** "Trigger 행을 지우는 모든 경로가 config 락을 잡는다"는 불변식이 정적 가드
  없이 사람의 기억(주석)에만 의존한다 — 같은 PR 안의 자매 불변식(`save()` 래핑)은
  이미 AST 가드로 승격돼 있어 비대칭이 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
    (스캔 대상은 `save()`/`manager.save(Trigger, …)` 형태의 `endpointPath` 충돌 래핑
    불변식뿐이고, `delete`/`remove` 호출이나 config-lock 획득 여부는 스캔하지 않는다)
  - 상세: 이 PR 은 "`save()` 는 항상 `endpointPath` 충돌 래핑을 거친다"는 불변식을
    정규식이 아니라 AST 파서 기반 가드로 강제하도록 이미 확장했다(빈
    `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 배열 자체가 fitness function 이 됨). 그런데 이번
    커밋이 고친 "Trigger 행 삭제는 항상 config 락을 잡는다"는 **같은 성격의 불변식**은
    여전히 각 서비스 메서드의 JSDoc 주석으로만 안내된다. 실제로 이 불변식은 이번 PR
    내에서 이미 한 번 깨진 채로 한 라운드를 통과했다(`TriggersService.remove()` 만 락을
    잡고 `SchedulesService.remove()` 는 놓친 상태로 리뷰 한 라운드가 지나갔다) — 즉
    "리뷰어가 매번 전수를 세어야 하는" 구조적 취약점이 실제로 한 번 발현된 뒤에도, 그
    발현을 막을 자동화 장치 없이 코드로만 고쳐졌다.
  - 제안: 당장 차단 사유는 아니다(호출부가 2곳뿐이고 둘 다 지금은 올바르다). 다만
    `endpoint-path-conflict-wrap-guard.ts` 와 유사하게 "`EntityManager.delete/remove(Trigger,
    …)` 또는 `triggerRepository.delete/remove(...)` 호출 지점이 같은 함수 스코프 안에
    `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked` 호출을 동반하는가"를 스캔하는
    가벼운 정적 가드를 백로그에 추가할 만하다 — 이 저장소가 이미 같은 문제 클래스에
    그런 가드를 두 번(endpointPath 래핑, 식별자 가드) 성공적으로 적용한 선례가 있다.

## 긍정적으로 확인한 점

- `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5초)와 `acquireTriggerConfigLock` 의 `timeoutMs` 옵션을
  두 호출부가 **값**은 공유하고 있어(상수 하나를 import), 향후 이 타임아웃을 조정할 때
  두 곳이 따로 값을 들고 있어 drift 하는 문제는 이미 피해 있다 — 이번 리뷰가 지적하는
  것은 가밖의 오케스트레이션 코드(트랜잭션 열기·락 호출·에러 처리) 중복이지, 상수/타임아웃
  값의 중복이 아니다.
- `trigger-transaction-mock.ts` 에 `delete` 위임을 추가해(`m.delete(Trigger, criteria) →
  repo.delete(criteria)`) 기존 단언의 의미를 보존한 방식은, 이 PR 이 반복해 온
  "`manager.transaction` 을 도입하는 모든 호출부는 그 리포지토리를 쓰는 spec 파일의 mock
  도 함께 넓혀야 한다"는 이미 알려진 구조적 부담(00_38_16 라운드 INFO)을 이번에도 정확히
  이행한 사례다.

## 요약

이번 라운드의 유일한 실질 변경은 `SchedulesService.remove()` 의 trigger cascade 삭제를
`TriggersService.remove()` 와 동일한 advisory lock 으로 감싼 것으로, 동시성 정합성 자체는
올바르게 닫혔다. 다만 그 수정 방식이 "락 안에서 Trigger 행을 지운다"는 개념을 공용
프리미티브로 뽑지 않고 두 번째 호출부에 다시 손으로 옮겨 적는 방식이라, (1) 실패 시
진단 로깅 수준이 두 모듈 사이에 이미 갈라졌고(트리거 쪽만 "반쯤 삭제됨" 운영 메시지를
남긴다), (2) 이 불변식을 지키는 것은 여전히 사람의 기억에 의존한다 — 바로 이 PR 안에서
그 취약점이 한 번 실제로 발현(삭제 경로 하나를 놓침)된 뒤에도 정적 가드로 승격되지 않았다.
같은 PR 이 자매 불변식(`save()` 래핑)에는 이미 AST 가드를 적용해 둔 선례가 있어, 이
비대칭은 다음 세 번째 삭제 경로가 생길 때 같은 결함 클래스가 다시 재발할 여지를 남긴다.
둘 다 지금 당장 이 변경을 막을 사유는 아니며, 소규모 리팩터(공용 삭제 프리미티브 추출)로
해소 가능한 수준이다.

## 위험도

LOW
