# 부작용(Side Effect) 리뷰 — trigger-config-lost-update

## 검토 방법

`git diff origin/main...HEAD --stat` 로 전체 변경 파일(14개 codebase 파일, `+2114/-143`)을
확인했고, 프롬프트가 크기 제한으로 생략한 파일(`trigger-config-lock.ts`·
`chat-channel-binder.service.ts`·`triggers.service.ts`·`schedules.service.ts`·
`hooks.service.ts`·`trigger-transaction-mock.ts`·e2e 스펙)은 전부 `git diff origin/main...HEAD
-- <path>` 로 원문 diff 를 직접 열어 확인했다. 이 PR 은 이미 side-effect 관점만 4회
(`18_17_44`·`23_38_09`·`00_07_52`·`00_38_16`) 독립 검토됐고, 그 마지막 라운드(`00_38_16`)는
**LOW**로 마무리됐다. 그 뒤 새 커밋(`2a87eb2f0`, `SchedulesService.remove()` 의 트리거
cascade 삭제도 같은 config 락으로 감싼 수정)이 있었고, 이번 라운드는 side-effect 관점에서
**그 변경이 처음 검토되는 라운드**다.

## 저장소 뮤테이션 관측 (절차 투명성, 이슈로 집계하지 않음)

리뷰 도중 `git status --short` 확인 시 `codebase/backend/src/modules/schedules/
schedules.service.ts` 가 일시적으로 `M`(uncommitted 변경)으로 나타났고, `git diff`(unstaged)
로 그 내용을 보니 `acquireTriggerConfigLock(m, triggerId, { timeoutMs:
TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 에서 `{ timeoutMs: … }` 옵션 인자가 제거된 상태였다 —
병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 상황으로
보인다. 재확인 결과 그 변경은 곧 사라졌고(`git status --short`/`git diff` 재실행 시 clean),
현재 워킹트리는 `git diff origin/main...HEAD` 와 정확히 일치하는 정상 상태다. 이 세션이
저장소에 쓰기를 한 적은 없다(`Read`/`git diff`/`grep`/`sed -n` 만 사용). 다음 라운드
리뷰어를 위해 기록만 남긴다.

## 발견사항

- **[WARNING]** `SchedulesService.remove()` 가 새로 도입한 lock-timeout 실패 경로에, 같은 PR 이
  형제 경로(`TriggersService.remove()`)에 적용한 "반쯤 삭제된 상태" 진단 로그가 없다
  — 이미 실행된 BullMQ 부수 효과가 조용히 관측 불가능한 상태로 남는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:294-318` (`remove()`)
    대조: `codebase/backend/src/modules/triggers/triggers.service.ts:1025-1039`
    (`TriggersService.remove()` 의 `.catch` 블록)
  - 상세: `SchedulesService.remove()` 는 `scheduleRunnerService.removeJob(schedule.id)`
    (BullMQ 의 `removeJobScheduler` 호출 — 되돌릴 수 없는 외부 부수 효과)을 **먼저** 실행한
    뒤(297행), 이번 커밋(`2a87eb2f0`)이 새로 추가한 `manager.transaction(async (m) => {
    acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS });
    m.delete(Trigger, triggerId); })` 을 부른다(309-315행). 이 트랜잭션은 `.catch` 없이 그대로
    호출부에 예외를 전파한다. 반면 **구조적으로 동일한 패턴**(되돌릴 수 없는 정리를 이미
    끝낸 뒤 5초 lock-timeout 이 걸린 advisory lock 트랜잭션으로 행을 지우는 것)을 쓰는
    `TriggersService.remove()`(창: provider teardown·secret 삭제·listener 해제를 먼저 끝낸
    뒤 같은 락으로 `m.remove(trigger)`)는 그 트랜잭션에 `.catch((err) => { this.logger.error(
    "…이 트리거는 반쯤 삭제된 상태다. 수동 정리가 필요하다…"); throw err; })` 를 명시적으로
    걸어 둔다. `trigger-config-lock.ts` 의 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 자체가
    "상한을 넘기면 그 사실을 로그로 남기고 오류로 드러낸다 — 조용한 지연보다 낫다" 는 원칙을
    적어 두었는데, `SchedulesService.remove()` 는 이 원칙이 요구하는 "로그로 남긴다" 절반을
    빠뜨렸다.
    이 lock-timeout 은 이번 PR 이 스케줄 삭제 경로에 **새로 추가한** 실패 모드다(수정 전에는
    `triggerRepository.delete()` 단순 호출이라 이런 식으로 시간 초과할 일이 없었다). 그
    트랜잭션이 실패하면(동시에 같은 트리거의 config 락을 오래 쥐는 PATCH/rotate 요청이
    있을 때) `scheduleRepository.remove(schedule)`(317행)·`recordAudit`(318행)는 실행되지
    않아 schedule·trigger 행 자체는 그대로 남지만, BullMQ job scheduler 는 **이미 제거된
    상태**로 굳는다 — 사용자 관점에서는 스케줄이 "삭제되지 않았다"(여전히 조회됨)면서도
    실제로는 다시는 발사되지 않는 조용한 불일치 상태다. 예외 자체는 위로 전파되어 500 으로는
    보이지만(완전히 침묵하지는 않는다), `TriggersService.remove()` 가 갖춘 것과 같은
    "무엇이 반쯤 끝났는지" 를 알려 주는 도메인 진단 로그가 없어, 운영자가 일반 예외 스택
    트레이스만 보고 이 특정 불일치(스케줄은 살아있는데 잡 스케줄러만 사라짐)를 알아채기
    어렵다.
  - 제안: `SchedulesService.remove()` 의 트랜잭션에도 동일한 형태의 `.catch` 를 걸어
    "BullMQ job 은 이미 제거됐고 트리거 행 삭제가 실패했다" 는 진단을 로그로 남긴 뒤
    rethrow 하면, 같은 PR 안에서 두 삭제 경로의 관측 가능성이 대칭을 이룬다.

## 확인했으나 이슈 없음 (이전 라운드 대비 변경 없음 — 재확인만)

- **공개 시그니처**: 컨트롤러가 소비하는 공개 메서드(`findById`/`create`/`update`/`remove`/
  `rotateBotToken`/`revokePerTriggerToken`/`SchedulesService.update`/`remove` 등)의 파라미터·
  반환 타입 변경 없음. 신규 export(`acquireTriggerConfigLock`·`rewriteTriggerConfigLocked`·
  `triggerConfigLockKey`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`·`TRIGGER_CONFIG_LOCK_PREFIX`·
  `extractInboundSigningRef`)와 신규 private 헬퍼(`assertTriggerFound`·`mergeIntoFreshSubKey`·
  `throwTriggerNotFound`·`findByIdForUpdate`·`touchLastTriggeredAt`)는 모두 additive.
- **전역 변수**: 신규 mutable 모듈 레벨 상태 없음. `TRIGGER_CONFIG_LOCK_PREFIX`/
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 불변 상수.
- **환경 변수**: 신규 읽기/쓰기 없음(e2e 의 `process.env.E2E_BASE_URL` 은 기존 관례 재사용).
- **네트워크 호출**: 외부 provider 호출(`adapter.setupChannel`/`teardownChannel`) 횟수·순서
  불변. advisory lock 밖에 유지하는 것이 이 수정의 핵심 설계 제약(Cafe24 advisory-lock
  기각 선례 반영).
- **`SET LOCAL lock_timeout` 의 트랜잭션 전체 적용 범위**: advisory lock 하나가 아니라
  그 트랜잭션의 모든 락 대기(뒤따르는 `DELETE`/CASCADE 포함)에 걸린다는 점은 이미
  `trigger-config-lock.ts` 주석과 이전 라운드(`review/code/2026/09/14/21_18_21` side_effect
  WARNING#6)에서 지적·수용됐다 — 재확인만, 새 지적 아님.
  `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` 의 문자열 보간도
  `Math.trunc()` 로 정수만 넣게 강제하고 유일한 호출부가 모듈 상수만 넘겨 사용자 입력이
  닿는 경로가 없음을 재확인했다(`grep -rn "TRIGGER_DELETE_LOCK_TIMEOUT_MS"` 로 호출부 2곳
  — `triggers.service.ts`·`schedules.service.ts` — 모두 리터럴 상수 전달임을 확인).
- **`ChannelListenerRegistry.register()` 조건부 호출**: `chat-channel-binder.service.ts` 의
  성공 경로가 `if (wrote) { register(...) }` 로 바뀌어, 락 안 재읽기에서 트리거가 삭제된
  것을 발견하면 등록을 건너뛴다. 이벤트 발생 조건이 바뀌는 변경(점검 관점 8)이지만,
  삭제된 트리거의 유령 registry entry 를 막는 의도된 개선이며 실패 경로(`catch` 블록)는
  애초에 `register()` 를 부르지 않으므로 대칭이 깨지지 않는다.
  `TriggersService.remove()` 의 `channelListenerRegistry.unregister(trigger.id)` 는 락
  **밖**에서 이미 실행되지만, 이 함수 자체가 "미등록이면 graceful noop" 이라 앞서 지적한
  BullMQ 케이스와 달리 재시도/실패에 안전하다.
- **트랜잭션 중첩**: `rewriteTriggerConfigLocked` 를 부르는 모든 자리(binder 성공/실패,
  `normalizeNotificationSecretRef`·`revokePerTriggerToken`·`rotateBotToken`·
  `promoteRotatedNotificationSecrets`)는 호출 시점에 바깥 트랜잭션이 이미 커밋된 뒤라 독립
  트랜잭션으로 안전하게 열린다. `TriggersService.update()`(창 1) 내부에서 재귀적으로
  `manager.transaction()` 을 또 여는 자리도 없다.
- **`SchedulesService.update()` 의 트리거 컬럼 patch**: `save(trigger)` → 컬럼 한정
  `triggerRepository.update({id}, patch)` 전환. `patch` 가 `name`/`isActive` 로 한정되고
  `config` 를 건드리지 않으므로 애초에 config 락이 필요 없는 경로이고, 실제로 이 경로는
  advisory lock 을 잡지 않는다 — 의도와 구현이 일치한다.
- **`hooks.service.ts` 의 `touchLastTriggeredAt()`**: 두 호출부가 `trigger.lastTriggeredAt`
  in-memory 갱신 + 컬럼 한정 `update()` 를 동일하게 유지하고, 회귀 테스트가 `update` 호출의
  patch 키를 `['lastTriggeredAt']` 로 정확히 단언해 `config` 재유입을 막는다.
- **파일시스템**: 이번 diff 에 파일 생성·삭제 로직 변경 없음(테스트/리뷰 산출물 제외).
- **테스트 인프라(`withTransactionMock`)**: `manager.transaction` 콜백을 실제로 실행하고
  안쪽 호출을 바깥 repo mock 으로 위임하는 형태라 다른 테스트 파일의 전역 상태를
  오염시키지 않는다(파일별로 새 mock 객체 생성). `jest.mock` 의 모듈 전역 교체나
  `global`/`process.env` 변형 없음(diff 전체 grep 으로 확인).

## 요약

이 PR 은 이미 side-effect 관점만 4회 독립 검토됐고, 그 시점까지 지적된 CRITICAL 은 모두
후속 커밋으로 실제 수정됐음이 이번 라운드의 소스 대조로도 재확인된다. 새로 검토 대상이 된
변경(`2a87eb2f0`, `SchedulesService.remove()` 의 트리거 cascade 삭제에 advisory lock 추가)은
데이터 정합성 결함(고아 트리거 부활)을 정확히 닫았지만, 그 과정에서 새로 생긴 lock-timeout
실패 경로에 형제 코드(`TriggersService.remove()`)가 이미 갖춘 "반쯤 삭제된 상태" 진단 로그를
빠뜨렸다 — 이미 실행된 BullMQ 부수 효과가 실패 시 관측 가능성 없이 남는 비대칭이다(WARNING
1건). 그 외 공개 시그니처·전역 변수·환경 변수·네트워크 호출·트랜잭션 중첩·파일시스템은
모두 변경 없거나 이미 검토·수용된 의도된 설계다. 리뷰 도중 다른 병렬 리뷰어로 추정되는
일시적 워킹트리 뮤테이션을 관측했으나 자체적으로 원상 복구되어 현재 저장소 상태는 clean 하다.

## 위험도

LOW
