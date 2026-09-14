# 성능(Performance) 리뷰 — trigger-config-lost-update

## 검토 범위

`trigger.config` 동시 PATCH lost-update(특히 `chatChannel.inboundSigningRef` fail-open) 를
`pg_advisory_xact_lock` 기반 트리거 단위 직렬화 + "락 안 재읽기·머지" 패턴(`trigger-config-lock.ts`)
으로 닫는 수정. 성능 관점에서는 `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(신규),
`triggers.service.ts`, `chat-channel-binder.service.ts`, `hooks.service.ts`,
`schedules.service.ts` 5개 소스 파일을 실제로 읽고 `git diff origin/main...HEAD` 로 대조했다.
`review/`·`plan/` 산출물은 이전 라운드 리뷰 문서라 이번 관점의 리뷰 대상이 아니다.

## 발견사항

- **[WARNING]** cron 승격 스윕(`promoteRotatedNotificationSecrets`)이 반복문 안에서 행마다 새
  advisory-lock 트랜잭션을 여는 방식으로 바뀌어, 행당 DB 왕복 수가 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1385-1450` (특히
    `1438`-`1449` 의 `rewriteTriggerConfigLocked` 호출)
  - 상세: 이 메서드는 24h grace 가 지난 후보를 `getMany()` 로 한 번에 읽은 뒤 `for (const trigger of candidates)` 로 순차 처리한다(이 순차 루프 자체는 이 PR 이전부터 있던 구조다). 종전엔 반복마다 `this.triggerRepository.save(trigger)` 한 번(대략 1왕복)으로 끝났는데, 이번 PR 이후엔 `rewriteTriggerConfigLocked` 가 반복마다 `manager.transaction()` 을 새로 열어 `BEGIN → SELECT pg_advisory_xact_lock(...) → SELECT (findOne 재읽기) → UPDATE → COMMIT` 5단계를 순차로 밟는다 — 행당 DB 왕복이 대략 4~5배로 늘었다. 후보 수는 grace-period 필터로 보통 작겠지만, 상한이 코드에 없어 회전 대상이 몰리는 시기(예: 대량 시크릿 로테이션 배치, 특정 워크스페이스 대량 트리거)에는 cron 소요 시간이 그만큼 선형으로 늘어난다.
  - 제안: 후보 수가 실무에서 어느 정도인지 실측해 두고(로그·메트릭), 만약 유의미하게 커질 수 있다면 서로 다른 `trigger.id` 는 잠금 키가 겹치지 않으므로 `Promise.all`(적정 concurrency cap 포함, 예: `p-limit`)로 행 간 병렬화를 검토할 수 있다. 지금 당장 이 PR 을 막을 사유는 아니다(보안 close 가 우선순위이고 후보 규모가 작다면 무해) — 다만 다음에 이 cron 의 실제 소요 시간을 관측 가능하게(로그) 만들어 두면 회귀를 조기에 잡을 수 있다.
  - 참고: 같은 파일의 자매 cron `cleanupRotatedChatChannelTokens`(`:1464-1509`)는 `config` 를 건드리지 않고 컬럼만 갱신하므로 여전히 `this.triggerRepository.update()` 단발 호출이다(`:1500`) — 이 오버헤드가 붙지 않았다. 두 cron 사이의 이 비대칭은 의도된 것(하나는 `config` 를 고치고 하나는 컬럼만 고친다)이라 결함은 아니다.

- **[INFO]** `PATCH /api/triggers/:id`(`update()`) 핫경로의 DB 왕복 수가 advisory lock 도입으로 늘었다 — 이미 완화된, 문서화된 트레이드오프
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:539-547`(`findByIdForUpdate`), `:611-660`(창 1 트랜잭션 블록)
  - 상세: 종전 `update()` 는 `findById`(JOIN 포함, 1왕복) + `save(trigger)`(1왕복) 로 총 2왕복이었다. 지금은 `findByIdForUpdate`(JOIN 없이 가벼운 조회, 1왕복) → `BEGIN` → advisory lock 획득(1왕복) → JOIN 포함 재조회(1왕복) → `save`(1왕복) → `COMMIT`, 여기에 `chatChannel` 이 실린 PATCH 라면 `setupChatChannel` 내부의 또 다른 lock 트랜잭션 + 최종 재조회(1왕복)까지 더해진다. 다만 코드 자신이 이미 이 비용을 인지하고 있다 — `findByIdForUpdate` 를 새로 만들어 "PATCH 마다 같은 JOIN SELECT 가 두 번 도는" 문제(`:544` 주석이 인용하는 `review/code/2026/09/14/20_17_16` performance WARNING#1)를 선제적으로 닫아 두었다. PATCH 는 QPS 가 높은 엔드포인트가 아니고 잠금은 트리거 단위로 좁혀져 있어, 이 정도 왕복 증가는 lost-update(보안) 수정의 불가피한 대가로 보인다.
  - 제안: 조치 불요. 다만 이 엔드포인트가 향후 고빈도 자동화(예: 외부 시스템이 주기적으로 같은 트리거를 PATCH) 용도로 쓰이게 되면 이 라운드트립 증가가 누적될 수 있다는 점만 기록해 둔다.

- **[INFO]** 무제한 advisory lock 대기가 DB 커넥션을 점유한 채로 유지된다 — 동일 트리거 고빈도 동시 쓰기 상황에서 커넥션 풀 소모 방향
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:111-121`(`rewriteTriggerConfigLocked` JSDoc "대기에 상한이 없다"), `:39-63`(`acquireTriggerConfigLock`)
  - 상세: `manager.transaction()` 은 콜백이 끝날 때까지 커넥션 풀에서 커넥션 하나를 점유한다. `pg_advisory_xact_lock` 대기에는 `lock_timeout` 이 없으므로(삭제 경로 제외), 같은 트리거에 대한 PATCH/rotate 요청이 몰리면 그만큼의 커넥션이 대기 상태로 붙들린다. 임계 구간 자체는 "DB 왕복 두 번"으로 짧다는 것이 근거이지만, 그 짧음은 *직렬화된* 한 요청 기준이고 *대기 중인* 요청 수만큼 커넥션이 동시에 묶이는 문제는 별개다. 이미 `review/code/2026/09/14/18_17_44` concurrency WARNING#3 이 "새 공유 블로킹 자원"으로 지적·문서화했다 — 여기서는 그 결과가 구체적으로 **DB 커넥션 풀 고갈**로 이어질 수 있다는 성능 관점만 재확인한다. 실무에서 한 트리거에 대한 동시 PATCH 빈도가 낮다면(사용자가 수동으로 트리거 설정을 편집하는 흐름) 위험은 낮다.
  - 제안: 조치 불요(이미 별도 리뷰에서 수용된 트레이드오프). 다만 커넥션 풀 크기 대비 예상 동시 PATCH 트래픽을 한 번 가늠해 두면 좋다 — 풀이 작고 특정 트리거에 자동화 트래픽이 몰리는 배포 환경이라면 `SET LOCAL lock_timeout` 적용을 앞당길 신호가 된다.

- **[INFO]** advisory lock 키가 32비트 해시 공간을 두 네임스페이스(`trigger-config:*`, `exec-cap:*`)와 공유 — 우연 충돌 시 무관한 쓰기끼리 불필요하게 직렬화
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18`
  - 상세: `hashtext()` 는 임의 문자열을 32비트 정수로 압축하므로, 서로 다른 `triggerId` 문자열(또는 다른 네임스페이스의 `exec-cap:<workspaceId>`)이 같은 해시값으로 충돌하면 실제로는 무관한 두 자원의 쓰기가 하나의 advisory lock 을 두고 경쟁하게 된다. 정확성 훼손은 아니고(같은 락을 다투므로 안전) 순수하게 **과직렬화**(불필요한 대기)다. 이미 `review/consistency/2026/09/14/17_10_16` naming_collision INFO#8 로 지적·수용된 사항이라 이번 리뷰의 새 지적은 아니며, 성능 관점에서 같은 결론을 재확인하는 정도다.
  - 제안: 조치 불요(수용됨). 여유가 있으면 `pg_advisory_xact_lock(key1, key2)` 2-int 오버로드로 네임스페이스 자체를 분리하는 편이 근본적이다.

## 긍정적으로 확인한 점 (성능 관점)

- **웹훅 인입 핫패스가 오히려 가벼워졌다.** `hooks.service.ts:957-979` 의 `touchLastTriggeredAt` 은 매 인입 메시지마다 도는 자리인데, 종전 `trigger.lastTriggeredAt = new Date(); save(trigger)`(엔티티 전체 UPDATE, subscriber 훅 포함)를 `triggerRepository.update({id}, {lastTriggeredAt})`(단일 컬럼 UPDATE)로 바꿨다. 이 경로는 **락을 타지 않는다** — 설계가 의도적으로 고빈도 경로에 advisory lock 비용을 얹지 않았다(`config` 를 건드리지 않으므로 lost-update 위험이 없기 때문). 가장 자주 도는 자리가 가장 가벼워진 방향의 변경이다.
- **`findByIdForUpdate` 도입으로 PATCH 당 중복 JOIN 을 이 PR 이 스스로 제거했다** (`triggers.service.ts:526-537`) — 위 INFO 항목에서 서술한 대로, 이 PR 이 만들 뻔한 성능 회귀를 자체적으로 먼저 닫았다.
- **외부 HTTP 호출(`adapter.setupChannel`, `secrets.rotate` 등)을 advisory lock/트랜잭션 밖에 유지**하는 설계가 전 호출부(`chat-channel-binder.service.ts`, `triggers.service.ts` 의 `rotateBotToken`·cron 스윕)에 일관되게 적용됐다 — `spec/2-navigation/4-integration.md` 의 Cafe24 advisory lock 기각 선례(HTTP 를 트랜잭션 안에 묶으면 커넥션 점유 시간이 늘어난다)를 정확히 학습해 반영한 것으로, 임계 구간을 "재읽기+머지+쓰기"로 최소화한다.
- **여러 자리에서 `save(entity)`(엔티티 통째 쓰기) → 컬럼 한정 `update()` 로 전환**됐다 (`schedules.service.ts:234-246`, `triggers.service.ts` 의 `rotateNotificationSecret:1087-1090`, `cleanupRotatedChatChannelTokens` 루프의 컬럼 클리어 등) — 쓰기 페이로드와 ORM 훅(cascades/subscribers) 오버헤드가 줄어드는 방향이라 순수하게 성능에 긍정적이다.

## 관점별 확인

- **알고리즘 복잡도**: 변경 없음 — `mergeIntoFreshSubKey`(`triggers.service.ts:379-390`)는 얕은 스프레드 O(k)(k=config 키 수)로, 트리거 config 크기가 작아 무시 가능.
- **N+1 쿼리/호출**: 위 WARNING 항목(promoteRotatedNotificationSecrets)이 유일한 해당 사례. 나머지 호출부는 단일 트리거 단위 read-merge-write 로 N+1 이 아니다.
- **메모리 할당**: `rewriteTriggerConfigLocked`/`mergeIntoFreshSubKey`/`buildChannel` 모두 소규모 객체 스프레드뿐 — 대규모 데이터 적재나 누수 소지 없음.
- **캐싱**: 해당 없음(재읽기가 곧 이 수정의 핵심이라 캐시를 두면 안 되는 경로다 — 캐시했다면 lost-update 가 재발한다).
- **블로킹 I/O**: 위 INFO(무제한 lock 대기 → 커넥션 점유) 외에 새로운 동기 I/O 병목 없음.
- **불필요한 연산**: 없음 — 과도한 문자열 연결·중복 계산 패턴 미발견.
- **데이터 구조**: `Set`/plain object 사용이 용도에 맞다.
- **지연 로딩**: `findByIdForUpdate` 가 불필요한 JOIN 을 제거한 것 자체가 지연 로딩 원칙에 부합.

## 요약

이 변경의 핵심 비용은 advisory lock 도입에 따른 DB 왕복 증가이며, 이는 보안 성격의 lost-update 수정을 위한 의도되고 대부분 문서화된 트레이드오프다. `update()` PATCH 경로는 이미 자체적으로 중복 JOIN 을 제거해 왕복 증가를 최소화했고, 가장 고빈도인 웹훅 인입 경로(`touchLastTriggeredAt`)는 오히려 엔티티 전체 저장에서 컬럼 단위 갱신으로 가벼워졌으며, 외부 HTTP 호출을 락 밖에 두는 설계도 일관되다. 유일하게 새로 눈에 띄는 항목은 cron 승격 스윕(`promoteRotatedNotificationSecrets`)이 반복문 안에서 행마다 새 트랜잭션+advisory lock+재읽기를 도는 방식으로 바뀌어 행당 DB 왕복이 4~5배 늘었다는 점인데, 후보 수가 grace-period 필터로 제한되는 한 실질적 위험은 낮고 향후 병렬화 여지로 기록해 두면 충분하다. 무제한 lock 대기로 인한 커넥션 풀 점유, advisory lock 해시 네임스페이스 공유는 이미 다른 관점(concurrency·naming_collision)에서 지적·수용된 사항을 성능 각도에서 재확인한 것으로, 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
