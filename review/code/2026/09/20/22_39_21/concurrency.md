# 동시성(Concurrency) 리뷰 — 트리거 동시 DELETE 감사 중복 수정 (fresh review, 22_39_21)

## 분석 대상

- `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()`: advisory lock 취득 뒤
  `m.findOne(Trigger, { select:{id:true}, where:{id, workspaceId} })` 재조회 + `NotFoundException`
  passthrough. **이 코드는 이번 라운드(22_39_21)의 RESOLUTION 커밋들로 변경되지 않았다**
  (`git log -- .../triggers.service.ts` 상 최신 커밋은 `bb0cfbe3b`, 이번 세션의 5개 SUMMARY 커밋에는
  포함되지 않음) — 즉 이 파일에 한해서는 직전 라운드(`review/code/2026/09/20/22_07_23/concurrency.md`)의
  분석이 그대로 유효하다.
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 이번 라운드에서 신규 테스트 1건
  추가(SUMMARY#4: genuine 삭제 실패 시 `logger.error` 호출 단언).
- `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` — 이번 라운드에서 lock key 리터럴을
  `triggerConfigLockKey` import 로 교체(SUMMARY#3).
- `plan/*.md`, `CHANGELOG.md`, `review/**` — 문서·산출물, 동시성 코드 아님.

## 검증 절차

저장소 파일을 직접 열어(`Read`/`grep`) 다음을 재확인했다(뮤테이션 없음, 읽기 전용):

1. `triggers.service.ts` `remove()` 본문(1060~1121행 부근) — diff 그대로 존재. `throwTriggerNotFound()`
   가 실제로 `throw new NotFoundException(...)`(`never` 반환)임을 확인 — silent no-op 이 아니다.
2. `trigger-config-lock.ts` — `acquireTriggerConfigLock` 이 `SET LOCAL lock_timeout` → 
   `pg_advisory_xact_lock(hashtext($1))` 순으로 실행되고, `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`.
   e2e 는 1.5초만 락을 쥐어 상한과 겹치지 않게 설계됨을 재확인.
3. `Trigger` 엔티티에 `@VersionColumn` 부재 확인 — `m.remove(trigger)`(락 밖에서 로드된 stale 엔티티)
   가 optimistic-lock 충돌로 실패해 genuine-failure 로그가 오탐될 경로는 없다. `remove()`/`delete()`
   는 PK 로만 대상을 특정하므로 다른 필드의 staleness 는 삭제 자체에 영향 없음.
4. `triggers.service.spec.ts` `makeService` 헬퍼 — `freshFindOne` 콜백과 바깥 `repo.findOne` 이
   분리돼 있어 "바깥 조회==락 안 재조회" 로 뭉개지는 함정이 없음(직전 라운드 지적대로 여전히 유효).
   신규 SUMMARY#4 테스트는 `removeRejects:true` + `withRef`(유효 fresh) 조합으로 **genuine 실패**
   경로만 정확히 트리거하며, `NotFoundException` 분기와 혼동되지 않는다.
5. `trigger-delete-concurrency.e2e-spec.ts` — `locker` 커넥션이 `triggerConfigLockKey(id)` 로 advisory
   lock 을 쥐고, 프로덕션 코드(`acquireTriggerConfigLock`)와 **동일한 파라미터 바인딩·해시 입력
   문자열**을 사용함을 재확인(SUMMARY#3 수정으로 두 자리가 손으로 동기화해야 하던 드리프트 위험이
   사라졌다 — 개선). `Promise.race` 공허성 가드(1.5s) → COMMIT → 상태쌍 단언 → `finally` 의
   `ROLLBACK.catch(()=>undefined)` 는 이미 COMMIT 된 뒤에도 안전하게 no-op.

## 결론 — 이번 diff 범위에서 새로 도입된 동시성 결함 없음

레이스(advisory lock 취득과 "행이 아직 있는가" 확인의 분리)를 락 취득 **직후·부수효과 직전**에
재조회로 닫는 지점이 정확하고, `NotFoundException` 전파 경로도 트랜잭션 콜백 안에서 동기적으로
throw → TypeORM 롤백 → advisory lock(xact 스코프) 해제 → `.catch` 에서 로그 없이 재던짐으로
일관된다. 이번 라운드가 추가·수정한 것(e2e lock key import, genuine-failure 로그 단위 테스트,
CHANGELOG/plan 문서)은 모두 테스트·문서 레이어이고 락 순서·트랜잭션 경계를 바꾸지 않는다.

## 발견사항

- **[INFO]** (기존에 이미 등재·추적 중 — 재기재 목적 아님) `releaseExternal(trigger)` 는 advisory
  lock 취득 **전**, 잠금 없는 `findById` 직후 무조건 실행된다. 동시 DELETE 두 건이 겹치면 스케줄
  job 해제·chat-channel provider teardown 이 한 번씩(총 두 번) 실행된 뒤에야 락 대기열에 들어간다.
  이 PR 은 DB 행·감사 중복만 닫았고 이 외부 호출 중복은 의도적으로 남겨 뒀다(plan
  `plan/in-progress/trigger-dup-delete.md` "이 PR 이 하지 않는 것" 절 + 트래커
  `plan/in-progress/spec-draft-nullable-notation-followups.md` sweeper 항목에 크로스레퍼런스 완료).
  best-effort·실패 삼킴 전제라 500 이나 처리 중단으로 이어지지 않음은 직전 라운드가 BullMQ/teardown
  소스로 실측 완료.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 본문 중
    `await this.resourceReleaser.releaseExternal(trigger);` 호출부(락 취득보다 앞, 이번 diff 밖 기존
    코드).
  - 제안: 이미 트래커에 등재됨. 추가 조치 불요.
- **[INFO]** (기존에 이미 등재·추적 중) `SchedulesService.remove()` 자신의 스케줄 행 삭제
  (`schedules.service.ts:345` 부근, `this.scheduleRepository.remove(schedule)`)는 이 PR 이 트리거에
  적용한 것과 같은 형태의 결함(advisory lock 도 재조회 가드도 없이 트랜잭션 밖에서 삭제)을 아직
  갖고 있다 — 이 diff 범위 밖이며 트래커에 developer 후속 항목으로 신규 등재되어 있음. 재현 e2e 는
  아직 없다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()`(diff 밖, 이번
    리뷰 대상 아님).
  - 제안: 트래커 항목대로 별도 세션에서 처리. 이번 PR 의 병합을 막을 사유 아님.

## 요약

이번 fresh review(22_39_21) 는 직전 concurrency 리뷰(22_07_23) 이후 코드 레벨 변경이
`triggers.service.ts` 에는 없었고(테스트·e2e·문서만 변경), 그 이전 라운드가 검증한 "advisory lock
취득 직후 재조회로 0행 삭제(진 쪽의 조용한 성공)를 막는" 수정이 락 순서·트랜잭션 경계·예외 전파
세 축 모두에서 여전히 정확함을 저장소 파일 직접 열람으로 재확인했다. 이번 라운드의 실질 변경(e2e
lock key 를 공용 헬퍼 import 로 교체, genuine 실패 로깅을 검증하는 신규 단위 테스트)은 동시성
안전성을 낮추지 않으며, 오히려 lock key 계산의 두 자리 수동 동기화 위험을 없앴다는 점에서 개선이다.
남아 있는 두 항목(외부 provider teardown 중복 호출, `SchedulesService.remove()` 의 동형 결함)은 모두
이 diff 범위 밖이고 plan/tracker 에 이미 정확히 등재·크로스레퍼런스되어 있어 새로운 발견이 아니라
확인(INFO)으로만 기록한다.

## 위험도

LOW
