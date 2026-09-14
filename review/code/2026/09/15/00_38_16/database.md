# Database Review — trigger.config lost-update 수정 (2026-09-15)

## 검토 범위

`git diff --stat origin/main...HEAD -- codebase/` 기준 17개 파일. DB 관점에서 실질적인
파일은 `trigger-config-lock.ts`(신규) · `triggers.service.ts` · `chat-channel-binder.service.ts` ·
`schedules.service.ts` · `hooks.service.ts` 다섯 개이고, 나머지는 테스트/정적 가드다. 전체
파일을 `Read`/`git diff origin/main...HEAD -- <path>` 로 직접 열어 확인했다(프롬프트가 크기
제한으로 diff 를 생략한 파일들도 포함).

## 발견사항

- **[WARNING]** `SchedulesService.remove()` 가 트리거 행을 이 PR 의 advisory lock 없이 직접 `DELETE` 한다 — `TriggersService.remove()` 에서 이미 닫은 것과 **같은 클래스**의 삭제-경합이 이 두 번째 삭제 경로에는 남아 있다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:296` (`await this.triggerRepository.delete(schedule.triggerId);`, `remove()` 메서드 내부, 290행부터 시작)
  - 상세: 이번 PR 은 `TriggersService.remove()`(`DELETE /api/triggers/:id`)에 `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 를 추가해, "읽었을 땐 있었는데 저장 직전에 삭제되는" 경합을 닫았다(`triggers.service.ts:1025-1040`). 그런데 스케줄 삭제(`DELETE /api/schedules/:id` → `SchedulesService.remove()`)는 **같은 `trigger` 행을 지우는 두 번째 경로**이면서 `trigger-config-lock.ts` 의 락을 전혀 잡지 않는 맨 `repository.delete()` 호출이다. `CHANGELOG.md` 와 `plan/in-progress/trigger-config-lost-update.md` 가 열거한 "닫은 자리"(창 1~4 + 일곱 자리 + `TriggersService.remove()`)에도, "후속(developer 범위)" 백로그 표에도 이 삭제 경로는 등장하지 않는다 — 전수 열거에서 누락된 새 갭이다.
    구체적 경합: `TriggersService.update()`(창 1, `triggers.service.ts:621-669`)는 스케줄 타입 트리거라도 `name`/`isActive` 만 바꾸는 PATCH 에서도 advisory lock → `m.findOne`(존재 확인) → `Object.assign` → `m.save(Trigger, target)` 순서를 그대로 탄다. `m.findOne` 이 행을 본 **직후**, 다른 요청이 `SchedulesService.remove()` 를 통해 그 스케줄+트리거를 삭제하면(이 삭제는 advisory lock 을 기다리지 않으므로 즉시 진행·커밋된다), 뒤이은 `m.save(Trigger, target)` 은 — 이 파일 자신의 JSDoc 이 명시하듯("`save(entity)` 는 PK 로 재조회해 행이 없으면 **INSERT** 한다", `triggers.service.ts` 창 1 주석) — 방금 지워진 트리거 행을 **고아 상태로 되살린다**. `promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens` cron 이나 `rewriteTriggerConfigLocked` 를 쓰는 다른 다섯 자리도 같은 방식으로 걸린다(그쪽은 `m.update()` 뿐이라 되살아나진 않지만, 이미 삭제된 행에 대해 0-row no-op UPDATE 를 성공으로 보고한다).
    영향은 두 갈래다: (1) 이미 삭제된 스케줄의 트리거가 되살아나 `GET /api/triggers` 등에 고아 행으로 남는 데이터 정합성 문제(가장 심각), (2) 삭제된 트리거에 대한 부수 쓰기가 "성공"으로 관측되는 조용한 no-op. 스케줄 타입 트리거는 `chatChannel`/`notification`/`interaction` 을 PATCH DTO 로 바꿀 수 없어(§3 제약) 이 PR 의 핵심 보안 결함(`inboundSigningRef` fail-open)까지는 재발하지 않지만, 이 PR 이 다른 모든 자리에서 닫은 "행 재생성/유령 성공" 문제와 정확히 같은 근본 원인(락 없는 read-then-write/delete)을 이 한 자리가 그대로 갖고 있다.
  - 제안: `SchedulesService.remove()` 의 트리거 삭제도 같은 락(`acquireTriggerConfigLock(m, schedule.triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })`)으로 감싸거나, 아예 `TriggersService.remove()` 를 호출해 teardown·감사 로직까지 일원화하는 것을 검토. 최소 조치는 `manager.transaction()` 안에서 락을 잡은 뒤 `m.delete(Trigger, schedule.triggerId)` 하는 것.

- **[INFO]** advisory lock 32비트 키 공간을 `exec-cap:*` 네임스페이스와 공유 (기존 리뷰에서 이미 지적·수용됨, 재확인만)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18` (`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 상세: `pg_advisory_xact_lock(hashtext(...))` 는 `hashtext` 가 만드는 int4 공간을 `exec-cap:<workspaceId>`(execution-engine)와 접두 문자열만 다르게 공유한다. 이 파일의 JSDoc 자신도 이를 인지하고 `review/consistency/2026/09/14/17_10_16` naming_collision WARNING#2 로 planner 항목화했다고 적는다. 우연 충돌은 과직렬화(정확성 훼손 아님) 수준이라 조치 불요.

- **[INFO]** cron 스윕(`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)이 후보 전량을 `.getMany()` 로 한 번에 로드하고 행마다 별도 트랜잭션을 연다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1373-1420`(`promoteRotatedNotificationSecrets`), `:1464-`(`cleanupRotatedChatChannelTokens`)
  - 상세: 두 쿼리 모두 페이지네이션/`.take(N)` 없이 조건에 맞는 행 전체를 메모리에 올린다. 이 PR 은 각 반복의 쓰기 방식(`save`→`rewriteTriggerConfigLocked`/컬럼 한정 `update`)만 바꿨고 이 조회·반복 구조 자체는 손대지 않았다(pre-existing). 대상 테이블이 커지면 배치 실행 시간이 비례 이상으로 늘어나는 "대량 데이터" 성격의 리스크이지만, 이미 `plan/in-progress/trigger-config-lost-update.md` 후속 백로그(`promoteRotatedNotificationSecrets cron 이 후보마다 순차 트랜잭션` · `cron 스윕이 행마다 새 트랜잭션`)에 등재돼 있다. 이번 PR 을 막을 사유는 아니다.

## 관점별 확인

- **인덱스**: 이번 PR 이 추가/변경한 쿼리(`findOne`/`update`/`delete`)는 전부 PK(`id`) 필터 — 기존 PK 인덱스로 충분. cron 두 곳의 `notification_rotated_at`/`chat_channel_rotated_at` 조건절은 이 PR 이 만든 것이 아니고 인덱스 존재 여부도 diff 밖(마이그레이션 변경 0건)이라 이번 리뷰 대상 밖.
- **N+1**: 반복문 내 개별 쿼리는 cron 스윕 두 곳뿐이며 위 INFO 로 별도 기재. 신규 락 경로(`update()`/binder/`rotateBotToken`/`revokePerTriggerToken` 등) 는 모두 단일 트리거 단위 read-merge-write로 N+1 아님.
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock` 조합이 적절하다. 외부 HTTP 호출(`adapter.setupChannel`)을 트랜잭션/락 **밖**에 두어 Cafe24 advisory lock 기각 선례(`spec/2-navigation/4-integration.md`)의 반론을 정확히 반영했다. 임계 구간이 "재읽기+머지+쓰기" 뿐이라 락·커넥션 보유 시간이 짧다. 단, 위 WARNING 이 지적하듯 **트랜잭션 참여가 전수가 아니다** — `SchedulesService.remove()` 가 같은 트랜잭션 도메인 밖에서 같은 행을 지운다.
- **마이그레이션 안전성**: 이번 변경에 DDL 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config`(jsonb) 를 통째로 재구성하지 않고 재읽은 최신 값의 서브키 위에 병합하는 방식(`mergeIntoFreshSubKey`)으로 전환 — lost-update 근본 원인(스냅샷 기반 통째 덮어쓰기)을 구조적으로 제거했다. `Trigger` 에 `@VersionColumn` 이 없어 낙관적 락으로도 안 막히는 상태였다는 점을 코드 주석이 스스로 지적하며 advisory lock 을 선택한 근거로 삼은 것도 타당하다.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션 획득/해제를 관리하며 콜백 종료(정상/예외 불문) 시 반환한다. `pg_advisory_xact_lock` 은 트랜잭션 종료 시 자동 해제되므로 예외 경로에서도 락 누수가 없다. 삭제 경로에만 `SET LOCAL lock_timeout`(5s)을 걸어 "반쯤 삭제된 상태"가 무한 대기로 굳지 않게 한 설계도 적절하다. 다만 plan 문서가 자체 추적하듯, 삭제 외 6~7개 락 경로에 타임아웃이 없어 특정 트리거에 쓰기가 몰리면 커넥션 풀(기본 10) 고갈로 번질 수 있다는 점은 이미 후속 항목으로 등재돼 있다.
- **SQL 인젝션**: `pg_advisory_xact_lock(hashtext($1))` 및 e2e 의 모든 raw 쿼리가 파라미터 바인딩을 쓴다. 유일한 예외는 `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`(`trigger-config-lock.ts:56-58`) — PostgreSQL 이 이 구문에 파라미터 바인딩을 지원하지 않아 문자열 삽입이 불가피한 자리인데, `Math.trunc()` 로 정수만 문자열에 들어가게 강제하고 호출부가 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)만 넘기므로 사용자 입력이 이 경로에 닿지 않는다. 안전하다고 판단.
- **대량 데이터**: 신규/변경된 쓰기 경로는 전부 단일 행 조회/갱신이라 문제 없음. 기존 cron 스윕의 무-페이지네이션 조회는 위 INFO 참조(이번 PR 신규 아님).

## 요약

동시 PATCH 가 `trigger.config` 를 스냅샷으로 통째 덮어써 `inboundSigningRef`를 잃던 lost-update를, `pg_advisory_xact_lock` 기반 트리거 단위 직렬화 + "락 안에서 재읽고 서브키 단위로 머지" 패턴으로 닫은 설계는 견고하다. 외부 HTTP 호출을 락 밖에 두어 이 저장소의 기각된 선례(Cafe24 advisory lock)를 정확히 학습했고, 삭제 경로에만 타임아웃을 두어 "반쯤 삭제된 상태"를 드러나는 오류로 만든 점도 좋다. 다만 트리거 행을 지우는 두 경로 중 하나(`SchedulesService.remove()`)가 이 PR 이 도입한 advisory lock 에 전혀 참여하지 않아, `TriggersService.remove()`에서 이미 고친 것과 동일한 클래스의 "읽기 시점엔 있었는데 쓰기 직전에 삭제됨" 경합 — 특히 `save(entity)`의 INSERT-on-missing 특성에 의한 고아 트리거 되살리기 — 이 이 두 번째 경로를 통해 여전히 발생할 수 있다. 보안 성격의 `inboundSigningRef` fail-open 까지는 재발하지 않지만(스케줄 타입은 chatChannel 을 가질 수 없음), 데이터 정합성 문제이자 이 PR 자체가 반복적으로 강조한 "모든 자리를 닫는다"는 원칙에 어긋나는 누락이다. 그 외 인덱스·N+1·SQL 인젝션·커넥션 관리 항목은 전부 적절하며, cron 스윕의 페이지네이션 부재는 기존 상태이자 이미 트래커에 등재된 별도 항목이다.

## 위험도

MEDIUM
