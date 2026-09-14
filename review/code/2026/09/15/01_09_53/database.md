# Database Review — trigger.config lost-update 수정 (최종 라운드, 01_09_53)

## 검토 범위

이번 라운드의 실제 코드 diff(`origin/main...HEAD`)는 `CHANGELOG.md` 갱신 + 스케줄 cascade
삭제 경로에 config 락을 추가한 수정(`schedules.service.ts`)이 핵심이고, 나머지는 이전
라운드들에서 이미 반영된 `trigger-config-lock.ts` / `triggers.service.ts` /
`chat-channel-binder.service.ts` / `hooks.service.ts` 의 누적 상태다. 소스는 워킹트리에서
`Read`/`grep`/`git diff`로 직접 확인했다(뮤테이션 없음, `git status --short` 로 clean 확인).

이 changeset 은 이미 11회에 걸친 database 리뷰(`review/code/2026/09/14/18_17_44` ~
`2026/09/15/00_38_16`)를 거쳤다. 이번 라운드에서 새로 검토할 실질 변경은 그 마지막 라운드
(`00_38_16`)가 낸 **database W1**("스케줄 삭제 cascade 가 config 락 밖에 있어 삭제된 트리거가
고아로 되살아날 수 있다")의 수정 여부다.

## 발견사항

- **[INFO]** (해소 확인) `SchedulesService.remove()` 의 cascade 삭제가 이제 `TriggersService.remove()`
  와 같은 advisory lock + 5초 타임아웃을 공유한다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:308-316`
  - 상세: 종전엔 `await this.triggerRepository.delete(schedule.triggerId)` 가 락 밖에서
    실행됐다. 동시에 `TriggersService.update()`(창 1)가 같은 트리거를 `findOne` 한 **직후**
    이 삭제가 끼어들면, 창 1 의 `m.save(Trigger, target)` 은 PK 로 재조회해 행이 없으면
    **INSERT** 하므로 방금 삭제된 트리거가 고아 상태로 되살아난다 — 이것이 직전 라운드
    (`review/code/2026/09/15/00_38_16`)의 database W1 이다. 이번 diff 는 삭제를
    `this.triggerRepository.manager.transaction(async (m) => { await acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS }); await m.delete(Trigger, triggerId); })`
    로 감싸 `TriggersService.remove()`(`triggers.service.ts:1025-1039`)와 동일한 락 키
    (`trigger-config:<id>`)·동일한 5초 타임아웃 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)를
    공유하도록 바꿨다. 두 삭제 경로가 이제 같은 직렬화 지점을 지나므로 W1 이 지적한 경합
    창이 닫힌다. `schedules.service.spec.ts` 의 신규 테스트(`'삭제 — trigger 행을 config 락
    안에서 지운다'`)가 `onLock` 콜백으로 락 키(`trigger-config:trig-del`)와 `delete` 호출을
    함께 단언해, "락을 잡지 않고도 삭제만 되는" 회귀를 잡는다.
  - 제안: 없음 — 수정이 올바르게 적용되고 회귀 테스트로 고정됐다.

- **[INFO]** `scheduleRepository.remove(schedule)` 가 FK CASCADE 로 이미 지워진 행을 다시
  지우는 중복 호출이다 — 이번 diff 가 만든 것은 아니다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:314-317`
  - 상세: `Schedule.trigger` 관계는 `onDelete: 'CASCADE'` 로 선언돼 있다
    (`codebase/backend/src/modules/schedules/entities/schedule.entity.ts:28`). 즉
    `m.delete(Trigger, triggerId)` 가 커밋되는 순간 FK CASCADE 가 같은 트랜잭션 안에서
    `Schedule` 행도 함께 지운다. 그런데 바로 다음 줄의 `await this.scheduleRepository.remove(schedule)`
    는 별도 커넥션/트랜잭션으로 **이미 사라진 행**을 다시 지우려 시도한다. TypeORM 의
    `remove()` 는 영향받은 행 수를 확인하지 않으므로 에러 없이 조용한 no-op 이 되어 데이터
    정합성 문제는 없지만, 불필요한 DB 왕복이 하나 더 남는다. `git show origin/main` 대조
    결과 이 순서(트리거 삭제 → 스케줄 삭제)는 이 PR 이전부터 있던 패턴이라 신규 결함이
    아니다.
  - 제안: 차단 사유 아님. 여유가 있으면 `if (schedule.triggerId)` 분기와 무관하게 스케줄
    행 자체는 `scheduleRepository.remove()` 하나로 충분함을 문서화하거나, cascade 에
    의존한다는 사실을 주석으로 남겨 다음 사람이 "왜 두 번 지우는가"를 헷갈리지 않게 할 수
    있다.

- **[INFO]** cron 스윕 두 곳의 per-row 쓰기 비용이 `save()` 1회에서 트랜잭션+락+재조회+update
  4단계로 늘었다 — 이전 라운드에서 이미 추적된 항목, 이번 diff 로 새로 생기지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1373-1453`
    (`promoteRotatedNotificationSecrets`), `:1464-1507` (`cleanupRotatedChatChannelTokens`)
  - 상세: 두 cron 모두 `createQueryBuilder().getMany()` 로 후보 전체를 페이지네이션 없이
    메모리에 올린 뒤 `for (const trigger of candidates)` 로 순차 처리한다. 이 루프·조회
    자체는 `origin/main` 부터 있던 구조이고, 이 PR 이 바꾼 것은 순회 안의 쓰기 동사뿐이다
    (`save(trigger)` → `rewriteTriggerConfigLocked`(config 를 건드리는 승격 분기) 또는
    컬럼 한정 `update()`(v2 정리)). `rewriteTriggerConfigLocked` 경로는 트리거당
    `BEGIN → advisory lock 획득 → findOne → update → COMMIT` 5회 왕복이 되어, 종전
    `save()` 1회보다 라운드트립이 늘었다. 트리거별 advisory lock 이 필요한 설계 특성상
    배치 UPDATE 로 합치기 어렵고, 후보 집합이 24h grace 대상으로 자연히 제한되는 도메인이라
    실사용 스케일에서는 위험이 낮다. `plan/in-progress/trigger-config-lost-update.md`
    후속 백로그에 이미 등재돼 있다(이전 라운드들의 반복 확인 사항).
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 트래커에 있음). 후보 테이블이 커질 조짐이 보이면
    `LIMIT`+cursor 페이지네이션을 검토.

- **[INFO]** `rewriteTriggerConfigLocked` 의 삭제 레이스는 `findOne` 시점 것 — 여전히 완전히
  닫히지 않았지만 이번 diff 의 대상이 아님
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:162-181`
  - 상세: `!fresh` 로 존재를 확인한 뒤 `m.update(Trigger, { id: triggerId }, patch)` 를
    실행하는데, `update()` 의 반환값(affected count)을 확인하지 않는다. `findOne` 이 행을
    본 **직후** 다른 트랜잭션이 그 행을 지우면(예: `TriggersService.remove()`/
    `SchedulesService.remove()` 가 이제 같은 advisory lock 을 잡으므로 이 정확한 창은
    사실상 직렬화로 닫혔다 — 두 삭제 경로 모두 이 헬퍼가 아니라 자체 트랜잭션에서 같은
    락을 먼저 잡기 때문이다), 0-row UPDATE 가 성공(`true`)으로 보고될 수 있는 이론적
    여지가 이 함수 자체의 계약상 남아 있다. 데이터 손상은 없다(고아 UPDATE 는 무해).
    이전 라운드(`review/code/2026/09/14/18_17_44` database INFO)에서 이미 지적·수용된
    항목이며 이번 diff 가 손대지 않았다.
  - 제안: 조치 불요(이번 PR 범위 밖). 후속에서 `affected` 카운트로 좁히면 더 정확해진다.

## 관점별 확인

- **인덱스**: 이번 diff 가 바꾼 쿼리는 모두 `Trigger.id`(PK) 단일 조건 `delete`/`update`/`findOne` — 기존 PK 인덱스로 충분. 신규 인덱스 불요.
- **N+1**: `SchedulesService.remove()` 의 트리거 삭제는 여전히 단일 트리거 단위 1건이다(반복문 없음). cron 스윕 두 곳(위 INFO)만 후보별 개별 트랜잭션을 여는 배치 처리이며, 이번 diff 는 그 루프 자체를 만들지 않았다.
- **트랜잭션**: `SchedulesService.remove()` 가 `manager.transaction()` 안에서 advisory lock 획득 → `m.delete()` 를 수행하는 구조는 `TriggersService.remove()`(`triggers.service.ts:1025-1039`)와 대칭이며, `pg_advisory_xact_lock` 은 트랜잭션 종료 시 자동 해제되어 예외 경로에서도 락 누수가 없다. `lock_timeout` 도 동일 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5000`)로 두 경로가 일치한다.
- **마이그레이션 안전성**: 이번 diff 에 DDL 변경 없음 — 해당 없음.
- **스키마 설계**: 변경 없음(기존 `Schedule.trigger` FK `onDelete: 'CASCADE'` 를 그대로 활용). Trigger 삭제가 Schedule 행을 cascade 로 정리하는 기존 관계와 새 advisory lock 이 상충하지 않는다.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션 획득/해제를 관리하며, 콜백 종료(정상/예외 불문) 시 반환된다. 별도 누수 지점 없음.
- **SQL 인젝션**: 이번 diff 는 새 raw SQL 을 추가하지 않는다(`acquireTriggerConfigLock`/`rewriteTriggerConfigLocked` 재사용). 그 안의 `pg_advisory_xact_lock(hashtext($1))` 는 파라미터 바인딩을 쓰고, `SET LOCAL lock_timeout` 은 `Math.trunc` 로 정수만 문자열에 넣도록 이미 제한돼 있다(이전 라운드에서 확인된 그대로).
- **대량 데이터**: `SchedulesService.remove()` 의 변경은 단일 행 삭제라 무관. cron 스윕의 무-페이지네이션 배치 조회는 위 INFO 참조(이번 diff 신규 아님).

## 요약

이번 최종 라운드의 실질 코드 변경은 `SchedulesService.remove()` 의 트리거 cascade 삭제를
`TriggersService.remove()` 와 동일한 advisory lock(`trigger-config:<id>`) + 5초 타임아웃
안으로 옮긴 것이며, 이는 직전 라운드(`review/code/2026/09/15/00_38_16`)가 낸 database W1
(스케줄 삭제 cascade 가 락 밖에 남아 삭제된 트리거가 고아로 되살아날 수 있는 경합)을 정확히
닫는다. 트랜잭션 범위·락 키·타임아웃 상수가 형제 삭제 경로와 일치하고, 새 회귀 테스트가 락
키와 삭제 호출을 함께 단언한다. 새로 추가된 SQL 은 없으며 기존 파라미터화된 헬퍼를 재사용한다.
남은 항목(cron 스윕의 페이지네이션 부재·`rewriteTriggerConfigLocked`의 이론적 삭제 레이스·
스케줄 삭제 경로의 중복 no-op 호출)은 전부 INFO 수준이고, 이번 diff 가 새로 만든 것이
아니거나 이미 트래커에 등재돼 위험이 낮으므로 이번 변경을 막을 사유가 아니다.

## 위험도

LOW
