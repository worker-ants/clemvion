# Database Review — trigger.config lost-update 마무리 배치

## 검토 범위

핵심 파일을 직접 열어 확인했다: `trigger-config-lock.ts`(신규 lock+재읽기 유틸),
`chat-channel-binder.service.ts`, `triggers.service.ts`(`update`/`remove`/`rotateBotToken`/
`normalizeNotificationSecretRef`/`rotateNotificationSecret`/`revokePerTriggerToken`/
`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`), `schedules.service.ts`
의 trigger 동기화, `hooks.service.ts`의 `touchLastTriggeredAt`, 그리고 신규
`trigger-config-lock.spec.ts` / e2e-spec. 이전 다섯 라운드(`18_17_44`~`20_49_15`)의
database.md 가 이미 상세히 다뤘으므로, 이번 라운드는 CHANGELOG 가 새로 주장하는
**"일곱 군데 더 있었다 … 그 결과 컬럼만 고치려던 자리가 의도치 않게 엔티티 전체를
저장하던 경로는 한 곳도 남지 않는다"** 는 문장을 실측으로 검증하는 데 집중했다.

## 발견사항

- **[INFO]** (검증 완료, 문제 아님) CHANGELOG 의 "일곱 자리 전부 닫혔다" 주장을 소스 레벨로 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `normalizeNotificationSecretRef`(829행, `rewriteTriggerConfigLocked` 사용), `rotateNotificationSecret`(1062행, 컬럼 한정 `update`), `revokePerTriggerToken`(1114행, `rewriteTriggerConfigLocked`), `promoteRotatedNotificationSecrets`(1352행, 두 분기 모두 `update`/`rewriteTriggerConfigLocked`), `cleanupRotatedChatChannelTokens`(1441행, 컬럼 한정 `update`); `codebase/backend/src/modules/schedules/schedules.service.ts` `update()`(컬럼 한정 `update`); `codebase/backend/src/modules/hooks/hooks.service.ts` `touchLastTriggeredAt`(973행)
  - 상세: `grep -n "\.save("` 로 `triggers.service.ts` 전체를 훑은 결과 남은 `.save(` 호출은 `create()`(491행, 신규 INSERT라 경합 대상 아님)와 `update()`(668행, advisory lock 안에서 재읽은 최신 행을 저장 — 이 PR 이 의도적으로 남긴 "창 1")뿐이다. `endpoint-path-conflict-wrap.spec.ts` 의 회귀 래칫(`EXPECTED_UNWRAPPED_TRIGGER_SAVES = []`)도 현재 GREEN 임을 `npx jest src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts` 로 직접 실행해 확인했다(7/7 통과). CHANGELOG 의 서술과 코드가 일치한다.
  - 제안: 조치 불요 — 검증 결과 기록.

- **[참고, 이슈로 집계하지 않음]** 리뷰 도중 `triggers.service.ts` 에 대한 병렬 뮤테이션을 관측했다
  - 상세: 검증 중 `grep`/`git diff` 결과가 두 차례 서로 다른 상태를 보였다. 한 번은 `cleanupRotatedChatChannelTokens` 의 `save()` 호출이 되살아난 것처럼 보였고(그래서 위 회귀 래칫 테스트가 일시적으로 RED 였다), 곧이어 `git diff HEAD`가 `{ chatChannelTokenV2: null, chatChannelRotatedAt: null, config: trigger.config }` 형태의 미커밋 수정(아마 다른 리뷰어의 뮤테이션 실험 — "컬럼 한정 update 에 config 를 섞으면 어느 테스트가 잡는가"를 실측하는 중으로 보인다)을 잠깐 보여줬다. 병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 상황 그대로다. 재확인(`git status --short`, `git diff HEAD --stat`) 결과 현재는 클린 상태이고 `triggers.service.ts` 는 HEAD 와 완전히 일치한다. 이 보고서에 적힌 모든 라인 번호·인용은 이 클린 상태 기준이다. 다음 라운드 리뷰어를 위해 기록만 남긴다 — 저장소에 잔여 이상 상태는 없다.

- **[INFO]** cron 스윕 두 개(`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)의 후보 조회가 `notification_rotated_at`/`chat_channel_rotated_at` 에 인덱스 없이 `WHERE ... IS NOT NULL AND ... <= :cutoff` 를 건다 — 이 PR 의 변경 범위 밖(pre-existing)
  - 위치: `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:104-155` (컬럼 정의, `@Index` 없음), 호출부는 `triggers.service.ts:1356-1362`, `:1445-1451`
  - 상세: 이 PR 이 건드린 것은 두 메서드의 **쓰기 부분**(락 재읽기/컬럼 한정 갱신으로 전환)뿐이고, 후보를 뽑는 `createQueryBuilder` 조회 자체는 이번 diff 에 없다 — 신규 결함이 아니다. 다만 두 컬럼 모두 대부분의 행에서 `NULL`(24h grace 동안만 non-null)이므로, `trigger` 테이블이 커지면 매시간 cron 이 전체 테이블을 순차 스캔하게 된다.
  - 제안: 이번 배치를 막을 사유는 아니다. 트래픽이 커지면 `WHERE notification_secret_v2 IS NOT NULL`류의 partial index 를 추가하는 것을 후속 항목으로 고려할 수 있다(신규 인덱스 마이그레이션은 `CREATE INDEX CONCURRENTLY` 로 무중단 처리).

## 관점별 확인

- **인덱스**: 이번 diff 가 추가/변경한 쿼리(`m.findOne(Trigger, {where:{id}})`, `m.update(Trigger, {id}, patch)`)는 모두 PK 조회 — 기존 PK 인덱스로 충분. 위 cron 스윕 인덱스 부재는 pre-existing 이라 이번 변경의 책임 밖.
- **N+1**: 반복문(`for (const trigger of candidates)`)이 있는 두 cron 스윕은 트리거당 `rewriteTriggerConfigLocked`(트랜잭션 1개) 또는 `update()`(쿼리 1개)를 부르는 배치 처리다 — 후보 집합을 미리 배치로 가져온 뒤 순회하는 구조라 반복문 안에서 추가 SELECT 를 만들지 않는다(N+1 아님, 원래부터 그런 구조이고 이 PR 은 순회 안의 쓰기 동사만 바꿨다).
- **트랜잭션**: `rewriteTriggerConfigLocked`/`update()`/`remove()` 모두 `manager.transaction()` 안에서 advisory lock 획득 → 재읽기 → 쓰기 순서를 지킨다. 외부 HTTP 호출(`adapter.setupChannel`, `secrets.rotate`)은 전부 락 진입 **이전**에 끝나 있어 임계 구간이 "재읽기+머지+UPDATE" 로 짧다 — Cafe24 advisory lock 기각 선례(HTTP를 트랜잭션에 묶으면 커넥션 점유 시간 증가)를 정확히 피했다.
- **마이그레이션 안전성**: 이번 변경에 DDL 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config`(JSONB) 를 스냅샷 통째 덮어쓰기 대신 "락 안에서 재읽은 최신 값 위에 서브키만 머지"로 바꾼 것이 lost-update 근본 원인을 구조적으로 제거한다. 컬럼(`chatChannelHealth`/`notificationSecretV2`/`chatChannelTokenV2` 등)과 JSONB 서브키의 책임 분리도 일관되게 유지된다.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 획득/해제를 관리하고, 콜백이 던져도(`.catch((err) => this.rethrowEndpointPathConflict(err))`, `remove()`의 에러 로깅+재던짐) 트랜잭션이 정상적으로 롤백·반환된다. e2e 테스트도 `db`/`lockDb` 두 커넥션을 `beforeAll`에서 열고 `afterAll`에서 `.end()` 로 닫는다 — 누수 없음.
- **SQL 인젝션**: `pg_advisory_xact_lock(hashtext($1))`, e2e 의 `UPDATE trigger SET config = $2::jsonb WHERE id = $1`, `SELECT config FROM trigger WHERE id = $1` 모두 파라미터 바인딩. 유일하게 파라미터 바인딩이 안 되는 자리는 `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`(Postgres 문법상 `SET LOCAL` 은 바인드 파라미터를 못 받음)인데, 호출부가 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5000`)만 넘기고 사용자 입력이 닿는 경로가 없으며 `Math.trunc` 로 숫자만 문자열에 들어가도록 방어했다 — 안전.
- **대량 데이터**: 이번 diff 의 신규/변경 쓰기 경로는 전부 단일 행 조회/갱신이다. 두 cron 스윕의 배치 조회는 pre-existing 이고 페이지네이션 없이 `getMany()` 전체를 메모리에 올리지만, 이 역시 이번 diff 가 만든 패턴이 아니라 위 INFO 항목으로만 기록한다.

## 요약

이번 라운드는 이전 다섯 라운드가 지적했던 "config 를 다시 쓰는 자리가 넷보다 많다"는 문제에 대해, CHANGELOG 가 주장하는 "남은 일곱 자리까지 전부 닫았다"는 서술을 소스 코드 직접 열람 + 정적 가드 테스트 실행으로 검증했고 실제로 일치함을 확인했다. `triggers.service.ts` 에 남은 유일한 무가드 `save(entity)` 는 신규 INSERT(`create`)와 이미 advisory lock 안에서 재읽은 최신 행을 저장하는 `update()`(창 1, 의도적으로 유예) 둘뿐이며, 그 외 일곱 자리(notification 정규화/회전, per-trigger 토큰 폐기, 승격 cron 두 분기, chat-channel v2 정리 cron, schedule 편집 동기화, hooks 인입 hot path)는 전부 `rewriteTriggerConfigLocked` 또는 컬럼 한정 `update()`로 전환되어 있다. 락·트랜잭션·파라미터화 쿼리·커넥션 해제 모두 적절하다. 검증 도중 다른 병렬 리뷰어의 일시적 워킹트리 뮤테이션을 관측했으나 재확인 시점에는 저장소가 클린했다(위 "참고" 항목에 기록). 남은 지적(cron 스윕의 인덱스 부재)은 이 PR 이전부터 있던 조건이라 이번 변경을 막을 사유가 아니다.

## 위험도

LOW
