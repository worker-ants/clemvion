# Database Review — trigger.config lost-update 수정 (23_38_09 라운드)

## 검토 범위

`git diff origin/main...HEAD` 기준 DB 관련 실질 변경 파일을 직접 열어 확인했다:
`trigger-config-lock.ts`(신규) · `triggers.service.ts` · `chat-channel-binder.service.ts` ·
`hooks.service.ts` · `schedules.service.ts` · `trigger-config-lost-update.e2e-spec.ts`(신규) ·
`trigger-transaction-mock.ts`(신규, 테스트 유틸) 및 관련 스펙 파일. `review/code/2026/09/14/18_17_44/`
이하의 과거 리뷰 산출물은 이번 diff 에 포함돼 있으나 리뷰 대상 코드가 아니라(이미 커밋된 리포트) 별도
분석하지 않았다.

이 라운드는 이미 다수의 이전 리뷰 라운드(`18_17_44`~`23_01_18`)를 거쳐 advisory lock + 락 안 재읽기
설계가 반복 보강된 뒤의 상태다. 아래는 그 최종 상태를 기준으로 한 재확인이다.

## 발견사항

- **[INFO]** `SchedulesService.update()` — trigger 컬럼 갱신과 schedule 저장이 여전히 하나의
  트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()` 메서드,
    `await this.triggerRepository.update({ id: trigger.id }, patch);` 호출부와 그 아래
    `await this.scheduleRepository.save(schedule);` 호출부 사이
  - 상세: 이번 PR 은 `save(trigger)` → 컬럼 한정 `update()` 로 바꿔 lost-update 를 닫았지만,
    "trigger 컬럼 update" 와 "schedule 저장"은 이번 PR 이전부터 별개의 두 왕복이었고 지금도
    그대로다. `triggerRepository.update()` 가 성공한 뒤 `scheduleRepository.save()` 가 실패하면
    (예: DB 제약 위반·커넥션 문제) trigger 의 `name`/`isActive` 는 이미 반영됐는데 schedule 의
    `cronExpression`/`timezone`/`isActive`/`parameterValues`/`nextRunAt` 은 반영되지 않는 부분
    커밋 상태가 남는다. 이번 diff 가 새로 만든 문제는 아니고(원래도 `save(trigger)` 뒤
    `save(schedule)` 순서였다), 데이터 정합성 관점에서는 이번 PR 이 "config 쓰기는 원자적으로"
    라는 규율을 다른 자리(`trigger-config-lock.ts`)에 막 세운 직후라 이 자리의 비대칭이 더
    도드라진다.
  - 제안: 급하지 않다(트리거 name/isActive 는 schedule 쪽 값에서 파생되는 값이라 스케줄 저장
    실패 시 재시도하면 자연히 다시 맞춰진다). 다만 후속 정리 시 `this.dataSource.transaction()`
    으로 두 쓰기를 같은 트랜잭션에 묶는 편이 "부분 커밋" 가능성을 원천 차단한다.

- **[INFO]** 이전 라운드(`18_17_44/database.md`)가 지적한 "삭제 레이스가 완전히 닫히지 않았다"는
  이번 상태에서 **해소된 것으로 확인**
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 의
    `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` +
    `await m.remove(trigger)` (같은 `manager.transaction()` 콜백 안)
  - 상세: `remove()` 가 이제 `rewriteTriggerConfigLocked` 계열과 **같은 advisory lock**
    (`trigger-config:<id>`)을 잡은 뒤 삭제하므로, "findOne 시점엔 있었는데 저장 직전에
    삭제되는" 경합 창이 닫혔다. 대기 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5000`)을 둔 것도
    "자원은 이미 뜯겼는데 행은 남은 반쯤 삭제 상태"가 무한정 조용히 지연되는 대신 드러나는
    오류가 되게 하는 합리적 설계다. `triggers.service.spec.ts:3911-3915` 에 이 SQL 문(`SET LOCAL
    lock_timeout = '5000ms'`)에 대한 회귀 테스트도 있다. 새로운 지적 아님 — 이전 라운드 대비
    개선을 확인하는 차원.
  - 제안: 조치 불요.

- **[INFO]** advisory lock 키 생성용 `SET LOCAL lock_timeout` 문자열 보간은 안전하지만 형태상
  주의가 필요한 자리
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:56-58`
    (`` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` ``)
  - 상세: Postgres 는 `SET` 문 파라미터에 바인드 변수를 허용하지 않아 문자열 보간이 불가피한
    자리다. 실제 호출부는 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(모듈 상수, `5000`) 하나뿐이고
    사용자 입력이 `timeoutMs` 로 들어오는 경로가 없으며, `Math.trunc`가 정수 강제까지 하고
    있어 SQL 인젝션 위험은 없다. 코드 자체 주석에도 이 근거가 이미 명시돼 있다. 다만 이
    프리미티브가 향후 다른 호출부(예: 사용자가 조절 가능한 타임아웃)로 재사용되면 이 안전
    전제가 깨진다는 점만 기록.
  - 제안: 조치 불요. 후속 호출부를 추가할 때 `timeoutMs` 가 여전히 내부 상수인지만 유지.

## 관점별 확인

- **인덱스**: 이번 diff 의 신규/변경 쿼리는 전부 `Trigger` PK(`id`)로 `findOne`/`update`/`remove` 하거나
  (`trigger-config-lock.ts`, `triggers.service.ts`, `chat-channel-binder.service.ts`,
  `hooks.service.ts` 의 `touchLastTriggeredAt`, `schedules.service.ts`), e2e 의 raw SQL(`SELECT
  config FROM trigger WHERE id = $1` 등)도 마찬가지다. 기존 PK 인덱스로 충분하며 신규 인덱스
  불요. (참고: `promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens` 의
  `createQueryBuilder().where('t.notification_secret_v2 IS NOT NULL')` 류 cron 스캔은 이번
  diff 가 손대지 않은 기존 코드라 범위 밖.)
- **N+1**: 반복문 내 개별 쿼리 패턴 없음. `rewriteTriggerConfigLocked` 는 트리거 단위 단일
  read-merge-write이고, 호출부(binder 성공/실패, `rotateBotToken`, `normalizeNotificationSecretRef`,
  `revokePerTriggerToken`)도 모두 단일 트리거에 대해 한 번씩만 호출한다.
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock` 조합이 전 호출부에 일관되게
  적용됐다. 외부 HTTP 호출(`adapter.setupChannel`)을 트랜잭션/락 **밖**에 두어 커넥션·락 보유
  시간을 최소화한 설계(`spec/2-navigation/4-integration.md` 의 Cafe24 advisory lock 기각
  선례를 정확히 반영)를 유지하고 있다. 위 `SchedulesService.update()` 건만 INFO 로 남긴다.
- **마이그레이션 안전성**: 이번 변경에 DDL 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config`(JSONB)를 스냅샷 통째 재작성 대신 "락 안에서 재읽은 최신 값
  위에 서브키만 머지"하는 방식으로 전환 — lost-update 근본 원인을 구조적으로 제거했다.
  `hooks.service.ts` 의 `touchLastTriggeredAt` 도 컬럼 한정 `update()`로 바뀌어, 인입 hot path
  에서 JSONB 컬럼을 매 웹훅마다 왕복 없이 재기록하던 부담이 사라졌다(부수적 성능 개선).
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션 획득/해제를 관리하며, 콜백
  종료(정상/예외 불문) 시 반환된다. `pg_advisory_xact_lock` 은 트랜잭션 종료 시 자동 해제되므로
  예외 경로에서도 락 누수가 없다. 별도 누수 지점 없음.
- **SQL 인젝션**: `SELECT pg_advisory_xact_lock(hashtext($1))` 및 e2e 의 모든 raw 쿼리가 파라미터
  바인딩(`$1`, `$2`)을 사용한다. 유일한 문자열 보간(`SET LOCAL lock_timeout`)은 내부 상수만
  받는 자리로 위 INFO 항목에서 다뤘다. 문자열 concat 기반 동적 SQL 없음 — 안전.
- **대량 데이터**: 이번 diff 의 변경 경로는 모두 단일 행 조회/갱신이라 페이지네이션·대용량
  스캔과 무관.

## 요약

동시 PATCH/rotate/cron 이 `trigger.config` JSONB 를 스냅샷 기반으로 통째 재작성해
`chatChannel.inboundSigningRef`(인입 서명 검증 키)를 잃던 lost-update 를, 트리거 단위
`pg_advisory_xact_lock` + "락 안에서 재읽어 서브키만 병합" 패턴으로 닫았다. 이번 라운드에서
CHANGELOG 가 예고한 "일곱 자리 추가"(notification secret 정규화·회전, per-trigger 토큰 폐기,
승격 cron 둘, chat-channel v2 정리 cron, schedule 편집 trigger 동기화, hooks 인입 hot path
둘)를 실제 소스에서 확인했고, 전부 PK 기반 조회·파라미터화 쿼리·적절한 트랜잭션 범위(외부
HTTP 호출은 락 밖)를 지키고 있다. 이전 라운드(`18_17_44`)가 지적했던 "삭제 레이스 미해결"도
`remove()` 가 같은 advisory lock 을 공유하도록 바뀌면서 해소됐다. 남은 관찰은 `schedules.service.ts`
의 trigger-update/schedule-save 두 쓰기가 여전히 하나의 트랜잭션으로 묶이지 않는다는 점(이번
PR 이전부터의 상태, 영향 낮음)과 `SET LOCAL lock_timeout` 의 문자열 보간이 안전하지만 향후
재사용 시 전제(내부 상수만)를 지켜야 한다는 점뿐이며, 둘 다 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
