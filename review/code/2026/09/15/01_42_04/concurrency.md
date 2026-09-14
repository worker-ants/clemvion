# 동시성(Concurrency) 리뷰 — trigger-config-lost-update

## 개요

이 PR 은 `trigger.config` JSONB 를 통째로 재작성하는 여러 write 경로(`TriggersService.update()`,
chat-channel binder 성공/실패 경로, bot token rotation, notification secret 정규화/회전 cron 2개,
schedule 편집의 trigger 동기화, 삭제 경로 2개)가 "읽기 → (외부 호출) → in-memory 스냅샷으로
`config` 재구성 → 저장" 을 락 없이 이어 붙여 발생하던 lost update(및 그로 인한
`chatChannel.inboundSigningRef` 소실 → 인입 서명 검증 fail-open)를 트리거 단위 advisory lock
(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`) + 락 안 재읽기(`rewriteTriggerConfigLocked`)
로 닫는다. 소스(`trigger-config-lock.ts`, `triggers.service.ts`, `schedules.service.ts`,
`chat-channel-binder.service.ts`, `hooks.service.ts`)를 직접 읽고 프롬프트에서 생략된 부분까지
확인했다.

## 검증한 항목

- **락 범위/락 순서**: `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked` 의 전 호출부
  (`triggers.service.ts` 6곳, `chat-channel-binder.service.ts` 2곳, `schedules.service.ts` 1곳)를
  전수 확인 — **트랜잭션 하나당 advisory lock 하나, 트리거 하나**만 잡는다. 두 개 이상의 락을
  한 트랜잭션 안에서 잡는 경로가 없어 락 순서 역전에 의한 데드락 경로는 없다.
- **외부 호출이 임계 구간 밖에 있는가**: `rotateBotToken`(6단계 오케스트레이션),
  `chat-channel-binder.service.ts` 의 성공/실패 경로 모두 `secrets.resolve/rotate`,
  `adapter.setupChannel` 을 **락 획득 이전**에 끝내고, 락 안에서는 순수 병합 + `update` 만
  수행한다 — 확인함.
  - `update()` "창 1" 도 검증·순수 병합만 트랜잭션 안에 있고 `setupChatChannel` 은 저장 뒤에
    옴 — 확인함.
- **삭제 경로의 TOCTOU**: `TriggersService.remove()` 는 `m.remove(trigger)` 전에 같은 락을
  타임아웃(5s)과 함께 잡고, `save(entity)` 의 "행 없으면 INSERT" 위험을 닫는다.
  `SchedulesService.remove()` 의 cascade 삭제(`m.delete(Trigger, triggerId)`)도 이번 PR 에서
  같은 락으로 옮겨졌다 — 두 삭제 경로가 같은 lock key 로 상호 배제되므로 "읽었을 땐 있었는데
  저장 직전 삭제" 경합이 닫힌다.
- **presence 게이트 재계산**: `chat-channel-binder.service.ts` 의 `survivesWithFresh` 가
  요청 시작 시점 값과 락 안 재읽은 행의 ref presence 를 OR 로 합친다 — 컨테이너만 다시 읽고
  게이트 값 자체는 요청 시작 시점 것을 쓰는 재발 패턴이 아님을 확인함.
- **e2e 재현 테스트**(`trigger-config-lost-update.e2e-spec.ts`): 별도 DB 커넥션으로 advisory
  lock 을 테스트가 직접 쥐어 B 요청을 "첫 쓰기 전" 에 결정적으로 멈춰 세우고, 그 사이 A 를
  커밋시켜 세 가지 서로 다른 축(B 값 생존, A 의 ref 생존, A 의 미접촉 키 생존)을 함께 문다.
  `blockedBeforeRelease` 단언으로 "겹침이 실제로 만들어졌는가" 자체도 검증한다 — 우연한
  타이밍에 기대는 vacuous 재현이 아니다.

## 발견사항

- **[INFO]** `SchedulesService.update()` 의 trigger 컬럼 한정 갱신은 삭제와 경합해도 조용히
  무시될 수 있다 (이번 PR 범위 밖의 선재 결함).
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` 의 `update()` 메서드,
    `if (Object.keys(patch).length > 0) { await this.triggerRepository.update({ id: trigger.id }, patch); }` 자리
    (같은 파일 `remove()` 의 cascade 삭제 블록과 대조).
  - 상세: `update()` 시작부의 `findById`(스케줄 조회)와 이 `triggerRepository.update()` 사이에
    동시 `SchedulesService.remove()`(또는 `TriggersService.remove()`)가 같은 트리거 행을
    삭제하면, 이 `UPDATE ... WHERE id = trigger.id` 는 영향받은 행이 0개인 채 조용히 성공한다
    (Postgres 는 매치 0건 UPDATE 를 에러로 보지 않는다). 이어지는
    `this.scheduleRepository.save(schedule)` 도 `Schedule.trigger` 의
    `onDelete: 'CASCADE'`(같은 파일 `schedule.entity.ts`) 로 스케줄 행 자체가 이미 사라졌을
    수 있어 같은 방식으로 조용히 no-op 될 수 있다. 결과적으로 응답은 200(성공)이지만 실제로는
    아무것도 갱신되지 않은 상태가 나올 수 있다.
    이 경합은 이 PR 이 새로 만든 것이 아니라 **선재 상태**다(이전에도 `save(trigger)`/
    `save(schedule)` 를 조건 없이 불렀으므로 같은 TOCTOU 가 있었다). 이 PR 은 `config` JSONB
    lost update 만을 스코프로 명시하고 있어(CHANGELOG·JSDoc), 이 항목을 안 건드린 것 자체는
    타당한 스코프 판단으로 보인다 — 다만 "삭제 경로 둘 다 같은 락을 잡는다" 는 이번 커밋들의
    결론이 이 좁은 TOCTOU 에는 적용되지 않는다는 점은 기록해 둘 가치가 있다.
  - 제안: 별도 항목으로 트래킹(예: `plan/in-progress/trigger-config-lost-update.md` 후속 또는
    새 plan)해, 필요 시 `UpdateResult.affected`/`affected` 체크나 같은 advisory lock 재사용으로
    닫을지 판단. 지금 당장 이 PR 을 막을 사유는 아님.

- **[INFO]** `SchedulesService.remove()`: cascade 삭제(`m.delete(Trigger, triggerId)`)가
  `Schedule.trigger` 의 `onDelete: 'CASCADE'` 로 스케줄 행까지 먼저 지운 뒤, 곧바로
  `await this.scheduleRepository.remove(schedule)` 를 무조건 다시 호출한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:333` (`await this.scheduleRepository.remove(schedule);`) — 바로 위 cascade 삭제 트랜잭션 블록과 인접.
  - 상세: 정상 경로에서는 harmless no-op(매치 0건 DELETE, 에러 아님)이지만, 두 삭제가
    "왜 둘 다 필요한지" 를 코드만 봐서는 판단하기 어렵다 — cascade 가 이미 지운 행을 앱
    레벨에서 다시 지우는 중복 경로로 읽힌다. 동시성 결함은 아니고 가독성/의도 명시 이슈에
    가깝다.
  - 제안: 주석 한 줄로 "이 호출은 `schedule.triggerId` 가 없는 경우(정합성 방어) 를 위해
    남겨둔다" 또는 유사한 의도를 명시하면 다음 리뷰 라운드에서 같은 질문이 반복되지 않는다.

- **[INFO]** e2e 재현 테스트의 `SETTLE_MS = 300` 고정 대기가 최종 단언(`blockedBeforeRelease`)의
  신뢰도에 영향을 준다.
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:59` (`const SETTLE_MS = 300;`), 사용처는 `:183`, 단언은 `:231`.
  - 상세: 주석은 이 대기를 "판별이 아니라 관측 보조" 라고 명시하지만, `blockedBeforeRelease`
    가 최종 `expect(...).toBe(true)` 로 이어지므로 CI 가 느려 B 요청이 300ms 안에 advisory
    lock 대기 지점까지 못 가면(HTTP 라운드트립 + 인증/파라미터 검증까지 마친 뒤 락을 잡으러
    가는 경로) 실제 결함이 없어도 이 마지막 단언에서만 실패할 수 있다 — 재현 자체(①②③)는
    이 타이밍과 무관하게 정확하다.
  - 제안: 현 상태로도 크게 문제 삼을 정도는 아니나(로컬/CI 부하가 심하지 않다면 300ms 는
    충분히 여유롭다), flake 발생 시 이 값과 `blockedBeforeRelease` 단언이 1차 용의선상이라는
    점을 남겨 둔다.

## 요약

`trigger.config` 재작성 지점(창 1 `update()`, chat-channel setup 성공/실패, bot token
rotation, notification secret 정규화/승격 cron, chatChannel token cleanup cron, 삭제 2경로)을
트리거 단위 `pg_advisory_xact_lock` + 락 안 재읽기로 직렬화한 설계는 소스 레벨에서 확인한 결과
일관되게 적용돼 있다 — 모든 호출부가 트랜잭션당 락 하나만 잡아 락 순서 역전에 의한 데드락
경로가 없고, 외부 HTTP/secret-store 호출은 예외 없이 임계 구간 밖에서 끝난 뒤에 락에 들어가며,
삭제 경로 둘(`TriggersService.remove()` / `SchedulesService.remove()` 의 cascade)이 같은 락을
공유해 "읽었을 땐 있었는데 저장 직전 삭제" 경합을 닫는다. presence 게이트도 요청 시작 시점 값과
락 안 재읽은 값의 OR 로 재계산해 "컨테이너만 다시 읽고 게이트는 그대로" 라는 재발 패턴을
피했다. e2e 스펙은 별도 DB 커넥션으로 advisory lock 을 직접 쥐어 결정적 인터리빙을 만들고
세 가지 축(상대 PATCH 값 생존·막 확립된 ref 생존·미접촉 키 생존)을 동시에 문다 — 우연한
타이밍에 기대는 vacuous 재현이 아니다. 새로 발견한 Critical/Warning 급 동시성 결함은 없다.
다만 (1) `SchedulesService.update()` 의 트리거 컬럼 갱신은 삭제와 경합하면 조용히 no-op 될 수
있는 선재 TOCTOU(이 PR 스코프 밖, `config` 를 건드리지 않으므로 fail-open 재발은 아님)이고,
(2) cascade 삭제 뒤 남는 `scheduleRepository.remove(schedule)` 재호출은 harmless 하지만 의도가
코드에 드러나지 않으며, (3) e2e 의 고정 `SETTLE_MS` 는 미래 flake 시 1차 용의선이라는 점을
INFO 로 남긴다.

## 위험도

LOW
