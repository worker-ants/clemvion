# Database Review — trigger.config lost-update 수정 (13번째 라운드, 01_42_04)

## 검토 범위

이 changeset 은 이미 12회의 database 리뷰(`review/code/2026/09/14/18_17_44` ~
`review/code/2026/09/15/01_09_53`)를 거쳤다. 직전 라운드(`01_09_53`) 이후의 실제 코드 diff는
`6ebc760d1` 한 커밋뿐이고, 그 커밋이 `codebase/backend`에서 건드린 것은
`modules/schedules/schedules.service.ts`의 `remove()` — 트리거 행 삭제 트랜잭션에
`.catch((err) => { this.logger.error(...); throw err; })`를 추가한 것과, 대응하는
`schedules.service.spec.ts` 테스트뿐이다(+ `CHANGELOG.md`/`plan/`/`trigger-transaction-mock.ts`
JSDoc의 서술 정정). 이 추가는 **트랜잭션 경계·락 키·SQL을 전혀 바꾸지 않는다** — 실패를
삼키지 않고 로그로 드러낸 뒤 그대로 rethrow할 뿐이라, DB 관점에서 새로 검토할 표면이 없다.

나머지 파일(`trigger-config-lock.ts`/`triggers.service.ts`/`chat-channel-binder.service.ts`/
`hooks.service.ts`/e2e)은 소스를 직접 `Read`/`grep`/`git diff`로 대조했고, 이전 라운드들이
반영한 상태 그대로다. 저장소는 뮤테이션 없이 읽기만 했다 — `git status --short` 로 clean 확인.

## 발견사항

전부 이전 라운드에서 이미 지적·수용된 항목의 재확인이며, 새 CRITICAL/WARNING은 없다.

- **[INFO]** cron 스윕 두 곳의 per-row 쓰기가 `save()` 1회에서 트랜잭션+락+재조회+update 로 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `promoteRotatedNotificationSecrets`(라인 1373 부근, `for (const trigger of candidates)` 루프 내부의 `rewriteTriggerConfigLocked` 호출), `cleanupRotatedChatChannelTokens`(라인 1464 부근)
  - 상세: 두 cron 모두 `createQueryBuilder().getMany()`로 후보 전체를 페이지네이션 없이 메모리에 올린 뒤 순차 처리하는 구조 자체는 `origin/main`부터 있었다. 이 PR이 바꾼 것은 순회 안의 쓰기 동사뿐이다 — `save(trigger)`(1회 왕복) → `rewriteTriggerConfigLocked`(BEGIN → advisory lock 획득 → `findOne` → `update` → COMMIT, 트리거당 다회 왕복). 트리거별 advisory lock이 필요한 설계 특성상 배치 UPDATE로 합치기 어렵고, 후보 집합이 24h grace 대상으로 자연히 제한되는 도메인이라 실사용 스케일에서는 위험이 낮다. `plan/in-progress/trigger-config-lost-update.md` 후속 백로그에 등재돼 있다.
  - 제안: 조치 불요(이번 PR 범위 밖). 후보 테이블이 커질 조짐이 보이면 `LIMIT`+cursor 페이지네이션을 검토.

- **[INFO]** `scheduleRepository.remove(schedule)`가 FK CASCADE로 이미 지워진 행을 다시 지우는 중복 호출 — 이 PR 이 만든 것이 아님
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 말미의 `await this.scheduleRepository.remove(schedule);` (트리거 삭제 트랜잭션 블록 바로 다음 줄)
  - 상세: `Schedule.trigger`는 `onDelete: 'CASCADE'`로 선언돼 있다(`schedule.entity.ts:28`). `m.delete(Trigger, triggerId)`가 커밋되는 순간 FK CASCADE가 같은 트랜잭션 안에서 `Schedule` 행도 함께 지운다. 그런데 바로 다음 줄이 별도 트랜잭션으로 이미 사라진 행을 다시 지우려 시도한다. TypeORM의 `remove()`는 영향받은 행 수를 확인하지 않으므로 에러 없이 조용한 no-op이 되어 데이터 정합성 문제는 없지만, 불필요한 DB 왕복이 하나 더 남는다. `git diff origin/main...HEAD` 로 대조한 결과 이 순서(트리거 삭제 → 스케줄 삭제)는 이 PR 이전(`await this.triggerRepository.delete(schedule.triggerId)`)부터 있던 패턴이라 신규 결함이 아니다.
  - 제안: 차단 사유 아님. 여유가 있으면 cascade에 의존한다는 사실을 주석으로 남기거나, `scheduleRepository.remove()` 호출이 왜 여전히 필요한지(`schedule.triggerId`가 없는 고아 스케줄 케이스 등) 명시하면 다음 사람의 혼동을 줄일 수 있다.

- **[INFO]** `rewriteTriggerConfigLocked`의 삭제 레이스는 `findOne` 시점 것 — 이론적으로 남아 있으나 실질적으로 닫혀 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:147-184` (`rewriteTriggerConfigLocked`)
  - 상세: `!fresh`로 존재를 확인한 뒤 `m.update(Trigger, { id: triggerId }, patch)`를 실행하는데, `update()`의 반환값(affected count)을 확인하지 않는다. 계약상으로는 `findOne`이 행을 본 직후 다른 트랜잭션이 그 행을 지우면 0-row UPDATE가 `true`(성공)로 보고될 여지가 남는다. 다만 `TriggersService.remove()`와 `SchedulesService.remove()`(스케줄 cascade) 두 삭제 경로 모두 이제 같은 advisory lock(`trigger-config:<id>`)을 먼저 잡으므로, 이 헬퍼의 재읽기 시점과 두 삭제의 실제 삭제 시점이 같은 락으로 상호 배제된다 — 실무적으로 이 창은 사실상 직렬화로 닫혔다. 데이터 손상도 없다(고아 UPDATE는 무해).
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 여러 라운드에서 수용됨). 후속에서 `affected` 카운트로 좁히면 계약이 더 정확해진다.

- **[INFO]** 32비트 advisory lock 키 공간을 `exec-cap:*`과 `trigger-config:*` 두 네임스페이스가 공유 — 이미 별도 리뷰에서 수용됨
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18` (`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 상세: `pg_advisory_xact_lock(hashtext(...))`는 `hashtext`가 만드는 int4 공간을 두 계열이 접두 문자열만 다르게 공유한다. 우연 충돌 시 서로 다른 자원의 쓰기가 불필요하게 직렬화되는 정도(정확성 훼손 아님, 과직렬화)이며 `review/consistency/2026/09/14/17_10_16` naming_collision WARNING#2로 등재·수용됐다.
  - 제안: 조치 불요(수용됨).

## 관점별 확인

- **인덱스**: 이번 diff가 건드리는 쿼리는 전부 `Trigger.id`(PK) 단일 조건 `findOne`/`update`/`delete`다. 기존 PK 인덱스로 충분하며 신규 인덱스 불요.
- **N+1**: 단일 요청 경로(`create`/`update`/`remove`/`rotateBotToken`/`revokePerTriggerToken`/schedule `update`/`remove`)는 전부 트리거 1건 단위 read-merge-write이고 반복문 내 개별 쿼리가 없다. 유일한 배치 반복은 위에서 지적한 cron 스윕 두 곳이며, 그 루프 구조 자체는 이 PR 이전부터 있었다.
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock`(트리거 단위 advisory lock) 조합이 전 경로(`update()` 창1, `rewriteTriggerConfigLocked`, 두 `remove()` cascade)에 일관되게 적용돼 있다. 외부 HTTP 호출(`adapter.setupChannel`)은 항상 락 밖에 있어 Cafe24 advisory lock 기각 선례(커넥션 점유 장기화)를 정확히 피한다. `pg_advisory_xact_lock`은 트랜잭션 종료(커밋/롤백/예외) 시 자동 해제되므로 락 누수 경로가 없다. 삭제 경로 둘(`TriggersService.remove()`, `SchedulesService.remove()`의 cascade)만 `SET LOCAL lock_timeout`으로 5초 상한을 공유하고, 그 밖의 쓰기 경로는 의도적으로 무한 대기(임계 구간이 DB 왕복 두 번으로 유계라는 근거가 문서화돼 있음).
- **마이그레이션 안전성**: 이번 diff에 DDL 변경 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config`(JSONB)를 스냅샷으로 통째로 재구성하지 않고, 락 안에서 재읽은 최신 값 위에 서브키만 병합(`mergeIntoFreshSubKey`)하는 방식으로 일관되게 바뀌어 lost-update 근본 원인을 구조적으로 제거했다. `Schedule.trigger`의 기존 FK `onDelete: 'CASCADE'`와 신규 advisory lock이 상충하지 않는다.
- **커넥션 관리**: `manager.transaction()`이 TypeORM을 통해 커넥션 획득/해제를 관리하며 콜백 종료(정상/예외 불문) 시 반환된다. 새로 추가된 `.catch()` 로깅도 프라미스 체인 안에서만 동작해 별도 누수 지점을 만들지 않는다.
- **SQL 인젝션**: 신규 raw SQL은 `trigger-config-lock.ts`의 두 자리뿐이다 — `SELECT pg_advisory_xact_lock(hashtext($1))`(파라미터 바인딩)과 `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`(사용자 입력이 닿지 않는 모듈 상수만 호출부에서 넘기고, `Math.trunc`로 정수만 문자열에 들어가도록 제한). e2e 테스트의 raw 쿼리(`pg_advisory_xact_lock(hashtext($1))`, `SELECT config FROM trigger WHERE id = $1`, `UPDATE trigger SET config = $2::jsonb WHERE id = $1`)도 전부 파라미터 바인딩을 쓴다. 문자열 concat으로 사용자 입력을 SQL에 직접 삽입하는 자리는 없다.
- **대량 데이터**: 이번 diff의 변경은 전부 단일 행 조회/갱신/삭제이며 페이지네이션·대용량 스캔과 무관하다. cron 스윕의 무-페이지네이션 배치 조회는 위 INFO 항목 참조(이번 diff가 새로 만든 것이 아님).

## 요약

직전 라운드(`01_09_53`) 이후 유일한 코드 변경은 `SchedulesService.remove()`의 트리거 삭제
트랜잭션에 실패 시 로그를 남기는 `.catch()`를 추가한 것뿐이며, 이는 트랜잭션 경계·락·SQL을
전혀 바꾸지 않는 순수 관측성 개선이라 DB 관점에서 새로 지적할 것이 없다. 누적된 최종 상태를
기준으로도, 트랜잭션 범위·advisory lock 사용·PK 기반 조회·파라미터화된 SQL 모두 적절하고,
동시 PATCH가 `trigger.config`를 스냅샷으로 통째 덮어써 `inboundSigningRef`를 잃던 근본
결함은 "락 안에서 재읽고 서브키만 병합"하는 일관된 패턴으로 닫혀 있다. 남은 항목(cron
스윕의 배치당 DB 왕복 증가, cascade 삭제 후 스케줄 행을 다시 지우는 중복 호출, 헬퍼의
이론적 삭제 레이스, advisory lock 키 공간 공유)은 전부 INFO 수준이며 이 PR이 새로 만든
것이 아니거나 위험이 낮아 이미 트래커/별도 리뷰에 수용돼 있다. 이번 변경을 막을 사유는 없다.

## 위험도

LOW
