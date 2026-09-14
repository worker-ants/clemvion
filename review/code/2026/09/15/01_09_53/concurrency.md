# 동시성(Concurrency) 리뷰 — trigger-config-lost-update (최종 라운드, 01_09_53)

## 검토 범위

이 changeset 은 이미 12회에 걸쳐 concurrency 관점으로 검토됐다
(`review/code/2026/09/14/18_17_44` ~ `2026/09/15/00_38_16`, 모두 CRITICAL 0 로 수렴).
이번 라운드에서 실제로 새로 검토할 코드 diff는 `CHANGELOG.md` 갱신과, 마지막 라운드
(`00_38_16`)가 낸 database W1("스케줄 cascade 삭제가 config 락 밖에 있어 삭제된 트리거가
고아로 되살아날 수 있다")을 닫은 `schedules.service.ts`(`2a87eb2f0`)뿐이다. 나머지는
누적 상태 재확인이다. 소스는 워킹트리에서 `Read`/`git show <sha>`/`grep` 으로 직접
대조했다(저장소 뮤테이션 없음, 종료 시 `git status --short` 로 clean 확인).

핵심 파일을 프롬프트가 아니라 원본에서 전체 읽었다: `trigger-config-lock.ts`,
`triggers.service.ts`(전체 1618줄), `chat-channel-binder.service.ts`,
`schedules.service.ts`, `__test-utils__/trigger-transaction-mock.ts`. 또한 이번
PR 안에서 있었던 두 개의 자기 회귀(`833bb745a` → `91b816498`)를 `git show` 로 직접
대조해 최종 상태가 올바른지 확인했다.

## 발견사항

- **[INFO]** `SchedulesService.update()` 의 trigger `name`/`isActive` 컬럼 동기화가
  advisory lock 도메인 밖에 있다 — 창 1(`TriggersService.update()`)의 전체 엔티티
  저장과 경합하면 방금 커밋된 값이 좁은 창에서 되돌아갈 수 있다 (기존 추적 항목,
  이번 라운드 diff 대상 아님)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:237-250`
    (`update()`) vs `codebase/backend/src/modules/triggers/triggers.service.ts:621-670`
    (`update()` 창 1)
  - 상세: `SchedulesService.update()` 는 `trigger.name`/`trigger.isActive` 를
    `this.triggerRepository.update({ id: trigger.id }, patch)` 로 컬럼 한정 갱신한다
    (락 미참여, 단발 UPDATE 문). 반면 `TriggersService.update()` 창 1은
    `acquireTriggerConfigLock` → `m.findOne` → `Object.assign(target, defined, {config})`
    → `m.save(Trigger, target)` 순서를 스케줄 타입 트리거의 `name`/`isActive`-only PATCH
    에도 그대로 탄다. `m.findOne` 이 행을 읽은 **직후**, `SchedulesService.update()` 의
    컬럼 UPDATE 가 커밋되면, 뒤이은 `m.save(Trigger, target)` 은 `target.isActive`/
    `target.name` 이 그 커밋 이전 스냅샷 값이라 그것을 **덮어쓴다** — `isActive` 는
    실행 여부를 가르는 값이라 관측성 필드보다 영향이 크다. 이 레이스 자체는 이 PR 이
    새로 만든 것이 아니고(종전엔 양쪽 다 `save(entity)` 라 `config` 까지 포함해 더 넓게
    깨져 있었다), 이 PR 은 `config`/`inboundSigningRef` 축을 정확히 닫았을 뿐
    `name`/`isActive` 축은 의도적으로 남겼다. `plan/in-progress/trigger-config-lost-update.md`
    의 "후속(developer 범위)" 표(9라운드 W2 항목, `SchedulesService.update()` 의 trigger
    컬럼 동기화가 락 도메인 밖)에 명시적으로 등재돼 있고, 10~12라운드 concurrency/database
    리뷰가 반복 확인하며 "이 PR 스코프 밖으로 명시 이월됨" 으로 처리한 항목과 동일하다.
    창(트랜잭션 하나, 외부 호출 없음)이 매우 좁고 보안 필드가 아니라는 점에서 이번에도
    INFO 로 재확인한다.
  - 제안: 없음 — 이미 추적됨. 근본 수정은 이 write 도 `acquireTriggerConfigLock` 에
    편입하거나, 창 1 을 컬럼 단정 갱신으로 전환하는 후속 PR 에서 함께 닫을 것.

- **[WARNING]** `SchedulesService.remove()` 가 이번 라운드에 새로 도입한 lock-timeout
  실패 경로가, 이미 실행된 되돌릴 수 없는 부수 효과(BullMQ job 제거) 뒤에서 예외를
  던지면서도 그 사실을 진단 가능하게 만들지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:294-318`
    (`remove()`) — 대조: `codebase/backend/src/modules/triggers/triggers.service.ts:1025-1039`
    (`TriggersService.remove()` 의 `.catch` 블록)
  - 상세: `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5초) 는 advisory lock 대기뿐 아니라
    **트랜잭션의 모든 락 대기**에 적용되므로(`trigger-config-lock.ts` JSDoc 이 명시),
    같은 트리거에 대해 config 락을 오래 쥔 동시 PATCH/rotate 요청이 있으면
    `SchedulesService.remove()` 의 `manager.transaction(async (m) => { acquireTriggerConfigLock(...); m.delete(Trigger, triggerId); })`
    이 `55P03`(lock_timeout)으로 실패할 수 있다. 이 트랜잭션은 원자적이므로 DB 쪽은
    안전하다 — 타임아웃 시 자동 롤백돼 트리거 행은 **삭제되지 않은 채 그대로 남는다**
    (부분 삭제·고아 행 생성 같은 데이터 손상은 없다). 문제는 그 트랜잭션보다 **먼저**
    (297행) 실행된 `scheduleRunnerService.removeJob(schedule.id)`(BullMQ
    `removeJobScheduler` 호출, 되돌릴 수 없음)이 이미 커밋됐다는 점이다. 트랜잭션이
    실패하면 예외가 그대로 위로 전파돼(`.catch` 없음) `scheduleRepository.remove()`·
    `recordAudit` 는 실행되지 않고, 사용자에게는 "스케줄이 그대로 조회되는데 다시는
    발사되지 않는" 조용한 불일치가 남는다. **구조적으로 동일한 패턴**(되돌릴 수 없는
    정리를 먼저 끝낸 뒤 같은 5초 lock-timeout 트랜잭션으로 행을 지우는 것)을 쓰는
    `TriggersService.remove()` 는 그 트랜잭션에 `.catch((err) => { this.logger.error(
    "…이 트리거는 반쯤 삭제된 상태다…"); throw err; })` 를 명시적으로 걸어 "반쯤
    끝난 상태" 를 로그로 드러내는데(`trigger-config-lock.ts` 의 "상한을 넘기면 그
    사실을 로그로 남기고 오류로 드러낸다" 원칙과 일치), `SchedulesService.remove()`
    는 이 원칙의 절반(로그)을 빠뜨렸다. 이 lock-timeout 자체가 이번 diff
    (`2a87eb2f0`)가 스케줄 삭제 경로에 **새로 추가한** 실패 모드다 — 수정 전에는
    `triggerRepository.delete()` 단발 호출이라 이 방식으로 타임아웃할 일이 없었다.
    (`review/code/2026/09/15/01_09_53/side_effect.md` 가 같은 자리를 side-effect
    관점에서 이미 WARNING 으로 지적했다 — 여기서는 "이번 PR 이 새로 만든 락-대기
    실패 모드" 라는 동시성 축으로 확인차 재기재한다.)
  - 제안: `TriggersService.remove()` 와 동일한 형태의 `.catch` 를 이 트랜잭션에도 걸어
    "BullMQ job 은 제거됐지만 트리거 행 삭제는 실패했다"를 명시적으로 로그에 남긴다.

- **[INFO]** 대기 상한이 없는 락 경로(창 1·binder·`rotateBotToken`·cron 스윕 둘)가
  같은 트리거에 대한 동시 쓰기 폭주 시 커넥션 풀을 소모할 수 있다 (기존 추적 항목,
  이번 라운드 diff 대상 아님)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`
    (`acquireTriggerConfigLock`, `timeoutMs` 미지정 시 무제한 대기)
  - 상세: 삭제 경로만 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5초)를 두고, 나머지 다섯
    이상의 락 획득 자리는 대기 상한이 없다. 같은 `triggerId` 에 대한 동시 요청이
    많아지면 대기 중인 트랜잭션 각각이 커넥션 풀에서 커넥션을 하나씩 점유한 채
    블로킹되므로, 이론적으로는 기본 풀 크기(문서상 10)를 소모해 그 트리거와 무관한
    다른 요청까지 커넥션 대기로 밀릴 수 있다. `plan/in-progress/trigger-config-lost-update.md`
    의 후속 표(8라운드 W6, "삭제 외 경로의 `lock_timeout` 부재 + 기본 풀 10")에
    이미 등재돼 있고, 임계 구간이 짧다(외부 호출 없이 read+merge+write 뿐)는 근거로
    이번 PR 범위에서는 조치 불요로 처리된 항목이다. 재확인만 남긴다.
  - 제안: 없음 — 이미 추적됨. 특정 트리거에 대한 쓰기 폭주가 실측되면 `timeoutMs` 확대
    검토.

## 확인한 점 (이번 라운드에 새로 검증, 문제 없음)

- **`SchedulesService.remove()` 의 cascade 삭제 락 배선이 올바르다.** 12라운드
  database W1 이 지적한 "삭제 경로가 둘인데 하나만 락을 잡았다" 가
  `this.triggerRepository.manager.transaction(async (m) => { await acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS }); await m.delete(Trigger, triggerId); })`
  로 닫혔다(`schedules.service.ts:308-316`). `TriggersService.remove()` 와 **같은
  락 키**(`trigger-config:<id>`) · **같은 타임아웃 상수**를 공유하므로 두 삭제
  경로가 이제 같은 직렬화 지점을 지난다 — "읽었을 땐 있었는데 저장 직전에
  삭제되는" 경합(`save(entity)` 의 INSERT-on-missing 특성에 의한 고아 트리거
  되살리기)이 이 경로에서도 닫힌다. 이 두 삭제 경로가 같은 advisory lock 키를
  공유하는 것만으로 **교착(deadlock) 위험은 생기지 않는다** — 이 저장소 전체에서
  트리거당 advisory lock 은 한 트랜잭션 안에서 정확히 하나만, 항상 같은 순서
  (`SELECT pg_advisory_xact_lock(hashtext(...))` 한 줄)로 획득되고, 서로 다른
  두 자원을 역순으로 잡는 자리가 없다.
- **`rotateBotToken` 의 `chatChannel` 델타-머지 수정이 올바르게 적용됐다.**
  이 PR 안에서 있었던 자기 회귀를 `git show` 로 직접 대조했다 — 커밋
  `833bb745a` 는 `mergeIntoFreshSubKey(freshConfig, 'chatChannel', mergedChannel, mergedChannel)`
  로 `patch` 자리에 **함수 시작 시점 스냅샷 전체**(`mergedChannel`)를 넣어, 헬퍼가
  막으려던 결함(재읽은 `rateLimitPerMinute`/`uiMapping`/`languageLocale` 등을
  무조건 되돌림)을 그 자리에서 그대로 재현했다. 다음 커밋 `91b816498` 이
  `patch` 를 `{ ...(result.configUpdates ?? {}), botTokenRef, inboundSigningRef }`
  (이번 회전이 산출한 **델타**만)로 좁혀 고쳤고, 현재 워킹트리
  (`triggers.service.ts:1320-1330`)는 이 고쳐진 형태다.
- **`mergeIntoFreshSubKey` 하위 키 재읽기 패턴이 네 호출부 모두에 일관되게
  적용돼 있다** — `normalizeNotificationSecretRef`(:865-875)·
  `revokePerTriggerToken`(:1143-1155)·`promoteRotatedNotificationSecrets`(:1438-1449)·
  `rotateBotToken`(:1320-1330). 최상위 `config` 키뿐 아니라 그 하위(`notification.url`,
  `interaction.enabled`, `chatChannel.uiMapping` 등)까지 재읽은 값 위에서 병합해,
  "컨테이너만 다시 읽는 것으로는 부족하다" 는 이 PR 자신의 1라운드 교훈이 최종
  상태에서는 지켜지고 있다.
- **외부 호출은 일관되게 락 밖에 있다.** `chatChannelBinder.setupChatChannel` 의
  `adapter.setupChannel`, `rotateBotToken` 의 `adapter.setupChannel`/`secrets.rotate`,
  `SchedulesService.remove()` 의 `scheduleRunnerService.removeJob()` 모두 advisory
  lock 트랜잭션 **이전**에 완료된 뒤 그 결과만 락 안에서 병합·저장한다 — Cafe24
  advisory lock 기각 선례(HTTP 를 트랜잭션에 묶으면 커넥션 점유가 늘어난다)를
  일관되게 지켰다.
- **테스트 mock(`trigger-transaction-mock.ts`)이 `manager.transaction` 콜백을
  실제로 실행하고 `findOne`/`update`/`save`/`delete`/`remove` 를 바깥 repo mock
  으로 위임한다** — no-op 이었다면 락·재읽기 로직이 한 번도 실행되지 않고도 관련
  단언이 통과했을 것이다. JSDoc 이 적은 뮤테이션 실측(콜백 미실행 시 53개 케이스
  RED)이 이 위임의 필요성을 뒷받침한다.
- **`SET LOCAL lock_timeout` 문자열 보간에 인젝션 경로가 없다** — `Math.trunc()`
  로 정수만 허용하고, 유일한 호출부(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)는
  모듈 상수라 사용자 입력이 이 값에 닿지 않는다.

## 요약

이 changeset 은 이미 12라운드에 걸쳐 검토되며 CRITICAL 0 으로 수렴한 상태였고,
이번(13번째) 라운드의 실질 diff — 스케줄 cascade 삭제를 `TriggersService.remove()`
와 동일한 advisory lock + 5초 타임아웃 도메인에 편입한 수정(`2a87eb2f0`) — 은
정확히 의도한 경합(고아 트리거 되살리기)을 닫으며 새로운 교착·레이스를 만들지
않는다. `git show` 로 직접 대조한 이 PR 내부의 자기 회귀(`rotateBotToken` 의
스냅샷 대입 재발 → 델타-머지로 재수정)도 최종 상태에서는 올바르게 닫혀 있다.
남은 항목은 셋이다: (1) `SchedulesService.update()` 의 `name`/`isActive` 컬럼
동기화가 advisory lock 도메인 밖에 있어 창 1의 전체 엔티티 저장과 좁은 창에서
경합할 수 있음(보안 무관, 이미 plan 후속 표에 등재·이월된 항목, INFO), (2) 이번
라운드가 스케줄 삭제 경로에 새로 추가한 lock-timeout 실패 모드가 이미 실행된
BullMQ 제거 뒤에서 예외를 던지면서도 형제 함수(`TriggersService.remove()`)가
갖춘 진단 로그를 갖추지 못함(WARNING, side_effect 리뷰와 교차 확인), (3) 대기
상한 없는 락 경로들의 커넥션 풀 소모 가능성(이미 8라운드에 등재된 기존 추적
항목, INFO). 셋 다 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
