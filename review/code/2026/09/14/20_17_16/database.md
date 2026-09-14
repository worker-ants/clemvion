# 데이터베이스(Database) 리뷰

## 발견사항

- **[WARNING]** `TriggersService.remove()` 가 이번에 도입된 `trigger-config:<id>` advisory lock 프로토콜에 참여하지 않는다 — 삭제와 config 재작성 사이에 좁은 레이스가 남는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` 함수 (`async remove(id: string, workspaceId: string, userId: string)`, `this.triggerRepository.remove(trigger)` 호출 자리) — advisory lock 획득 호출이 없음.
  - 상세: 이번 PR 은 `trigger.config` 를 다시 쓰는 네 자리(`update()`, `chat-channel-binder.service.ts` 의 setup 성공/실패 경로, `rotateBotToken()`)를 전부 `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 로 직렬화하고, 락 안에서 재읽은 행이 없으면(`!fresh`) 쓰기를 스킵해 "삭제된 트리거의 부활(orphan revival)"을 막았다. 그런데 `remove()` 는 이 프로토콜에 참여하지 않는다 — advisory lock 은 세션이 명시적으로 같은 키를 잡으려 할 때만 상대를 블록하므로, `remove()` 의 `DELETE`(TypeORM `repository.remove(trigger)`)는 다른 창이 락을 들고 "읽기→머지→쓰기" 구간을 실행 중이어도 블록 없이 끼어들 수 있다. 네 창의 `!fresh` 가드는 "락을 잡고 재읽을 때 이미 삭제되어 있던" 경우만 잡을 뿐, "재읽은 뒤 자신의 `save`/`update` 직전에 `remove()` 가 끼어들어 커밋되는" 경우는 막지 못한다(각 창의 재읽기와 최종 쓰기 사이에 이렇다 할 지연은 없지만, `save()`/`update()` 자체가 별도의 왕복이라 이론상 창이 0 은 아니다). 이 경로가 실현되면 `remove()` 가 이미 마친 `teardownChatChannel`·`secrets.deleteByPrefix`·BullMQ 해제·CASCADE 삭제를 되돌리지 못한 채 행이 다시 INSERT 되어 고아 상태로 되살아난다.
  - 참고: `plan/in-progress/trigger-config-lost-update.md` §D "후속(developer 범위)" 표에 `remove() 가 같은 락을 안 잡는다`가 이미 등재돼 있고, "데이터 손상 없음은 창 1 의 `!fresh` 처리를 넣은 뒤에야 참이 됐다"는 단서와 함께 **의도적으로 이번 PR 범위 밖으로 defer** 되어 있다. 즉 이미 인지·기록된 갭이며 새로 발견한 결함은 아니다. 다만 이 리뷰 시점 기준으로 여전히 살아 있는 갭이라 SUMMARY 판정을 위해 명시한다.
  - 제안: 후속 작업에서 `remove()` 도 트리거 조회 후 `acquireTriggerConfigLock` 을 잡고(또는 `manager.transaction` 안에서 재조회 후 삭제) 같은 lock key 로 직렬화하면 이 창이 완전히 닫힌다. 급하지 않다면 plan 의 후속 표에 남겨 두는 현재 처분도 합리적이다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 반환값(트리거 삭제로 쓰기 스킵 시 `false`)을 세 호출부(binder 성공/실패 경로, `rotateBotToken`)가 전부 무시한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`rewriteTriggerConfigLocked(...)` 두 호출), `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken()` 의 `rewriteTriggerConfigLocked(...)` 호출.
  - 상세: 함수 JSDoc 은 "호출부가 «조용히 아무것도 안 했다» 를 관측할 수 있게" 반환값을 둔다고 명시하는데, 실제 호출부는 이를 버린다. 삭제 레이스로 쓰기가 스킵돼도 `setupChatChannel`/`rotateBotToken` 은 이어서 `channelListenerRegistry.register`·`recordAudit` 등을 정상 진행해, "설정/회전됨" 감사 기록이 실제로는 반영되지 않은 상태로 남을 수 있다. 데이터 손상은 아니지만 감사 로그 정합성 문제다.
  - 참고: plan §D 후속 표에 이미 등재("`rewriteTriggerConfigLocked` 반환값을 세 호출부가 무시")되어 있다.
  - 제안: 급하지 않은 후속으로 두되, 반환값이 `false` 인 경우 감사 기록에 "no-op" 신호를 남기거나 로깅만이라도 추가.

- **[INFO]** advisory lock 에 `lock_timeout` 이 없어 같은 트리거에 대한 동시 요청은 앞선 트랜잭션이 커밋할 때까지 무한 대기한다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `acquireTriggerConfigLock()`.
  - 상세: 임계 구간이 "DB 왕복 두 번"으로 유계라는 설계 근거(외부 HTTP 호출을 락 밖으로 뺀 것)가 코드 주석·plan 양쪽에 명시돼 있고, 이는 합리적인 트레이드오프다. 다만 컨텐션이 예상보다 심해지거나 향후 누군가 임계 구간 안에 느린 작업을 추가하면, 실패가 드러나는 오류가 아니라 조용한 지연(커넥션 풀 점유 증가)으로 나타난다는 점은 운영 관점에서 유의할 사항이다.
  - 제안: 이미 코드 주석이 "임계 구간을 넓히는 변경 시 `SET LOCAL lock_timeout` 을 함께 넣으라"고 명시했으므로 추가 조치 불요 — 향후 회귀 감시용으로만 기록.

- **[INFO]** advisory lock 키가 32비트 `hashtext()` 해시 공간을 `execution-engine.service.ts` 의 `exec-cap:<workspaceId>` 와 전역으로 공유한다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `TRIGGER_CONFIG_LOCK_PREFIX` / `triggerConfigLockKey()`.
  - 상세: 해시 충돌 시 서로 다른 도메인의 락이 우연히 같은 정수로 매핑돼 불필요하게 직렬화될 수 있다(정확성 문제는 아니고 과직렬화뿐이라 무해하지만, 문서화가 안 돼 있다는 점은 이미 plan 에서 planner 범위 후속 — `redis-keys.md §4` 등재 — 으로 등재돼 있다).
  - 제안: 이미 planner 후속 항목으로 등재됨. 추가 조치 불요.

## 트랜잭션·잠금 설계 평가 (참고용, 결함 아님)

`rewriteTriggerConfigLocked` / `TriggersService.update()` 의 창 1 은 모두 "advisory lock 획득 → 락 안에서 최신 행 재조회 → 그 위에 머지 → 컬럼/엔티티 쓰기"의 일관된 패턴을 따르고, 외부 HTTP 호출(어댑터 setup, secret rotate)은 명시적으로 락 밖에 위치시켜 DB 커넥션·락 보유 시간을 짧게 유지한다. 이는 저장소 내 기존 선례(Cafe24 통합 토큰 갱신에서 advisory lock 을 기각했던 사유)를 정확히 반영한 설계다. `pg_advisory_xact_lock` 파라미터는 `$1` 로 바인딩돼 SQL 인젝션 위험이 없다. `hooks.service.ts` 의 웹훅 인입 hot path 두 곳을 `save(entity)` 전체 저장에서 컬럼 한정 `update()` 로 바꾼 것도 인입 메시지마다 도는 hot path 에서 불필요한 lost-update 노출면을 정확히 줄인 변경이다. 스키마 변경·인덱스 변경·대량 데이터 페이지네이션과 관련된 코드는 이번 diff 에 없다.

## 요약

이번 변경은 동시 PATCH/설정/회전 요청이 `trigger.config` 를 서로 덮어써 인입 웹훅 서명 검증이 fail-open 으로 되돌아가던 lost-update 결함을, 트리거 단위 Postgres advisory lock + 락 안 재조회 패턴으로 닫는 데이터베이스 동시성 수정이다. 트랜잭션 경계, 외부 호출을 락 밖으로 격리한 설계, 파라미터화된 락 SQL, 컬럼 한정 UPDATE 로의 전환 모두 타당하다. 유일하게 남는 실질적 갭은 `TriggersService.remove()` 가 같은 락 프로토콜에 참여하지 않아 삭제와 config 재작성 사이에 좁은 레이스가 이론적으로 남는다는 점인데, 이는 이미 plan 에 후속 항목으로 명시적으로 등재·defer 된 상태이며 이번 PR 범위의 `!fresh` 가드 도입으로 데이터 손상 가능성 자체는 크게 줄어들었다. 신규 스키마 변경이나 마이그레이션, N+1, 인덱스 이슈는 없다.

## 위험도

LOW
