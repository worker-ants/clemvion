# Database Review — trigger.config lost-update 수정 (누적 diff, origin/main...HEAD)

## 검토 범위

`git diff origin/main...HEAD --stat` 기준 backend 14개 파일. 이 changeset 은 이전 여러 라운드의
`/ai-review` 지적(§창 1 미해결 · 삭제 레이스 · patch 가 스냅샷 전체였던 회귀 등)을 순차로
닫아 온 누적 결과다. 핵심 파일을 직접 열어 최종 상태를 확인했다:
`trigger-config-lock.ts`(신규) · `triggers.service.ts` · `chat-channel-binder.service.ts` ·
`schedules.service.ts` · `hooks.service.ts` · `trigger-config-lock.spec.ts` ·
`trigger-config-lost-update.e2e-spec.ts`.

## 발견사항

- **[INFO]** `SchedulesService.update()` — trigger 컬럼 갱신과 schedule 저장이 하나의 DB 트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:216-265` (`update()`)
  - 상세: 이번 PR 이 `trigger.save(trigger)` 를 `triggerRepository.update({id}, patch)` (컬럼 한정)로 바꿨다(라인 233-246, lost-update 방지 목적으로 타당). 다만 그 직후 `scheduleRepository.save(schedule)`(라인 265)가 **별도의 묵시적 오토커밋 문장**으로 실행된다. `triggerRepository.update` 가 성공한 뒤 `scheduleRepository.save` 가 실패하면(예: DB 커넥션 단절, 제약 위반) trigger 의 `name`/`isActive` 만 반영되고 schedule 행은 갱신되지 않는 부분 쓰기가 남는다. 이 갭은 이번 PR 이 새로 만든 것이 아니라 — 종전에도 `trigger.save`→`schedule.save` 두 문장이 트랜잭션 없이 순차 실행됐다 — 이번 변경은 그 갭의 성격(엔티티 통째 저장 → 컬럼 한정 갱신)만 바꿨을 뿐 원자성 여부는 그대로다.
  - 제안: 이번 배치를 막을 사유는 아니다. 여유가 있으면 두 쓰기를 `manager.transaction()` 으로 묶어 원자성을 확보할 수 있다(우선순위 낮음 — Trigger↔Schedule 동기화 실패는 기존에도 있던 리스크 클래스).

- **[INFO]** 로테이션 sweep cron(`promoteRotatedNotificationSecrets` / `cleanupRotatedChatChannelTokens`)이 후보 전체를 조회한 뒤 순차 처리한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1373-1453`, `:1464-1507`
  - 상세: `createQueryBuilder('t').where(...).andWhere(...).getMany()` 로 조건에 맞는 행을 LIMIT 없이 전부 메모리에 올린 뒤, `for (const trigger of candidates)` 루프 안에서 트리거마다 별도 트랜잭션(`rewriteTriggerConfigLocked`)을 순차 실행한다. 이 구조 자체는 이번 PR 이 도입한 것이 아니라(루프·쿼리는 `origin/main` 부터 있었음; 이번 PR 은 루프 내부의 쓰기를 `save(trigger)`→락 안 재읽기 방식으로만 바꿨다) 대량 데이터 관점에서 지적할 만하지만, 트리거별로 독립된 advisory lock + 짧은 트랜잭션이 필요한 설계상 N+1 회피가 오히려 어렵다(다른 트리거의 config 재작성과 병렬 진행되어야 하므로 배치 UPDATE 로 합칠 수 없다). 후보 수가 워크스페이스당 24h grace 대상으로 자연히 제한되는 도메인이라 실사용 스케일에서는 문제 소지가 낮다.
  - 제안: 조치 불요(사용 규모상 낮은 위험). 후보 테이블이 크게 자랄 잠재 여지가 보이면 `LIMIT`+cursor 페이지네이션을 cron 반복 호출로 추가하는 것을 고려.

- **[INFO]** 두 advisory lock 네임스페이스(`trigger-config:*`, `exec-cap:*`)가 `hashtext` 의 32비트 키 공간을 공유 — 기존에 지적·수용된 항목의 재확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18` (`TRIGGER_CONFIG_LOCK_PREFIX` JSDoc 이 스스로 명시)
  - 상세: 문자열 접두어만 다르고 `pg_advisory_xact_lock(hashtext(...))` 가 만드는 int4 공간은 같다. 우연 충돌 시 서로 다른 자원의 쓰기가 불필요하게 직렬화되는 정도(정확성 훼손 아님)이며, 코드 자체가 `redis-keys.md §4` 등재를 planner 항목으로 이미 추적 중이라고 밝힌다. 새로운 지적이 아니라 최종 상태에서도 여전히 open 임을 확인.
  - 제안: 조치 불요(추적됨).

## 관점별 확인

- **인덱스**: 이번 diff 의 신규/변경 쿼리는 전부 `Trigger.id`(PK) 단일 조건 `findOne`/`update`/`remove` 다. `promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens` 의 `WHERE notification_secret_v2 IS NOT NULL AND notification_rotated_at <= :cutoff` 류 조건절은 이번 PR 이 새로 만든 쿼리가 아니라 기존 cron 로직 그대로다. 새 인덱스 필요성 없음.
- **N+1**: 반복문 내 개별 쿼리는 위 cron sweep 뿐이고(트리거당 1 트랜잭션), 각 트랜잭션이 서로 다른 자원(트리거)에 대한 독립적 정합성 단위라 "N+1 로 합쳐야 하는" 성격이 아니다. `hooks.service.ts`/`triggers.service.ts`/`schedules.service.ts`/`chat-channel-binder.service.ts` 의 hot-path (PATCH, webhook 인입)에는 반복문 내 쿼리가 없다.
- **트랜잭션**: 핵심 설계는 `manager.transaction(async (m) => { acquireTriggerConfigLock(m, id); const fresh = await m.findOne(...); await m.update(...); })` — 락 획득 → 재읽기 → 병합 → 쓰기를 하나의 트랜잭션으로 묶어 lost-update 를 구조적으로 차단한다. `TriggersService.update()`(창 1)도 같은 락을 트랜잭션 안에서 잡고 재읽은 행을 `save` 대상으로 삼아, 종전엔 별도 이슈였던 "삭제된 트리거의 고아 부활"·"삼각 lost-update"(create 3개 창을 이 배치가 락으로 닫자 update 가 그 결과를 되돌리던 회귀)를 모두 닫았다. 삭제(`remove()`)도 같은 advisory lock 을 잡아 "읽었을 땐 있었는데 저장 직전에 삭제" 경합을 없앴고, 삭제 경로에만 5초 `lock_timeout`(`SET LOCAL`)을 둬 반쯤 삭제된 상태가 무한정 조용히 남는 것을 막는다. 외부 HTTP 호출(`adapter.setupChannel`, secret store rotate)은 모두 락 트랜잭션 **밖**에 있어 커넥션·락 보유 시간이 짧다 — 저장소의 기각된 선례(Cafe24 advisory lock, HTTP 를 트랜잭션 안에 두지 않는다)를 정확히 지킨다.
- **마이그레이션 안전성**: 이번 diff 에 DDL 변경 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config` (JSONB)를 스냅샷 통째 재구성 대신 "락 안에서 재읽은 최신 값의 하위 키 위에만 병합"(`mergeIntoFreshSubKey`)하는 방식으로 전환 — lost-update 근본 원인(스냅샷 기반 통째 덮어쓰기)을 구조적으로 제거했다. 컬럼만 바뀌는 6개 자리(`normalizeNotificationSecretRef`·`rotateNotificationSecret`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`·`hooks.service.ts` 의 `touchLastTriggeredAt`·`schedules.service.ts` 의 트리거 name/isActive 동기화)는 `repository.update()` 컬럼 한정 패치로 전환돼, "컬럼만 고치려다 엔티티 전체를 저장"하던 경로가 저장소에 더 이상 남지 않는다(`endpoint-path-conflict-wrap.spec.ts` 의 `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 가 빈 배열로 이를 정적으로 래칫).
- **커넥션 관리**: 전부 `manager.transaction()` 경유라 TypeORM 이 커넥션 획득/반환을 관리하고, `pg_advisory_xact_lock` 은 트랜잭션 종료(커밋/롤백) 시 자동 해제돼 명시적 unlock 코드 없이도 누수가 없다. e2e 스펙(`trigger-config-lost-update.e2e-spec.ts`)이 여는 두 개의 raw `pg.Client`(`db`, `lockDb`)도 `afterAll` 에서 각각 `end()` 로 정리된다.
- **SQL 인젝션**: `SELECT pg_advisory_xact_lock(hashtext($1))` 을 비롯해 e2e 의 raw 쿼리(`UPDATE trigger SET config = $2::jsonb WHERE id = $1` 등)가 전부 파라미터 바인딩을 쓴다. `acquireTriggerConfigLock` 의 `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` 만 문자열 보간인데, `options.timeoutMs` 는 사용자 입력이 닿지 않는 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5000`)뿐이고 `Math.trunc` 로 정수만 들어가게 강제돼 있어 인젝션 표면이 없다.
- **대량 데이터**: 인입 hot-path(webhook/schedule PATCH)는 모두 PK 단건 조회/갱신이라 대용량 스캔과 무관하다. cron sweep 두 곳(위 INFO 참조)만 후보 집합에 LIMIT 이 없으나, 트리거당 독립 트랜잭션이 필요한 설계 특성상 배치화가 오히려 정합성을 해치고, 실사용 스케일(24h grace 대상)에서 문제될 정도로 크지 않다.

## 요약

동시 PATCH/rotate 가 `trigger.config` 스냅샷을 통째로 되써 `inboundSigningRef` 를 잃던 lost-update 를, 트리거 단위 `pg_advisory_xact_lock` + "락 안에서 재읽고 하위 키 위에만 병합" 패턴으로 구조적으로 닫은 누적 수정이다. 처음 넷으로 잡았던 자리 외에 컬럼만 고치려다 엔티티 전체를 저장하던 일곱 자리를 추가로 찾아 컬럼 한정 `update()` 로 전환했고, 삭제 경로도 같은 락 + 5초 상한으로 정합성 구멍을 닫았다. 외부 HTTP 호출을 락 밖에 두어 커넥션·락 보유 시간을 최소화한 설계는 이 저장소가 이미 기각한 선례(Cafe24 advisory lock)를 정확히 학습해 반영했다. 파라미터화 쿼리·PK 기반 조회·트랜잭션 범위·커넥션 해제 모두 적절하며, `trigger-config-lock.spec.ts`/e2e 스펙이 헬퍼의 락 순서·재읽기·부재 처리 계약을 직접 고정한다. 남은 항목(schedules.service.ts 의 비원자적 2단계 쓰기, cron sweep 의 무제한 후보 조회, advisory lock 네임스페이스 공유)은 전부 INFO 수준이며 이번 PR 이 새로 만든 결함이 아니거나 위험이 낮아 이번 변경을 막을 사유가 아니다.

## 위험도

LOW
