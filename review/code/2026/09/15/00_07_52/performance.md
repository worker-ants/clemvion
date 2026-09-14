# 성능(Performance) 리뷰 — trigger-config-lost-update (2026-09-15 00:07 라운드)

## 검토 범위

이 changeset 은 이미 세 라운드(`review/code/2026/09/14/18_17_44`, `19_07_43`, `19_44_08`)의
성능 리뷰를 거쳤다. 그 세 라운드가 이미 정량화·수용한 트레이드오프(advisory lock 도입으로
`trigger.config` 단건 쓰기가 1왕복 → 트랜잭션+lock+`SELECT`+`UPDATE` 다왕복으로 늘어난 것,
재읽기가 `select` 제한 없이 전체 컬럼을 가져오는 것, `chatChannel` 포함 PATCH 가 두 개의
lock 임계구간을 순차 통과하는 것, lock timeout 부재)는 **재등재하지 않는다** — 이번 라운드가
반영하는 신규 커밋(`bf2becd0c`·`a92bce095`·`bcba1dc5d`·`833bb745a`·`91b816498`)만 본다.
이 다섯 커밋의 실질 변경은:

1. `save(entity)` 로 config 를 통째로 되쓰던 **일곱 자리**를 추가로 닫음 — 두 갈래로 갈린다:
   - `config` 를 고치는 자리(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·
     `rotateBotToken` 델타 수정·`promoteRotatedNotificationSecrets` 정상 경로) → 락 안
     재작성(`rewriteTriggerConfigLocked`)
   - 컬럼만 고치는 자리(`rotateNotificationSecret`·`promoteRotatedNotificationSecrets` 의
     stale-v2 분기·`cleanupRotatedChatChannelTokens`·`schedules.service.ts` 의 name/isActive)
     → 컬럼 한정 `update()`
2. `hooks.service.ts` 의 `lastTriggeredAt` 갱신을 `touchLastTriggeredAt()` 헬퍼 하나로 통합
   (기능 변경 없음, 이미 19_44_08 라운드가 다룬 `save→update` 전환의 중복 제거).
3. `endpoint-path-conflict-wrap-guard.ts` 가 `manager.transaction(async (m) => m.save(...))`
   형태를 인식하도록 AST 워크 확장 (빌드/테스트 타임 정적 분석, 런타임과 무관).

## 발견사항

- **[WARNING]** cron 배치 루프 안에서 트리거 1건당 트랜잭션+advisory lock+재읽기를 도는 자리가 **처음 생겼다** — 이전 세 라운드가 "반복문 안 호출 없음"으로 명시 확인했던 전제가 이번 커밋으로 깨졌다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1385`(`for (const trigger of candidates)`) 안의 `:1438`(`rewriteTriggerConfigLocked` 호출), 후보 집합은 `:1377-1383`(`createQueryBuilder('t').where(...).getMany()`, **`LIMIT` 없음**)
  - 상세: `promoteRotatedNotificationSecrets`(NotificationSecretRotator cron, grace 24h 경과 스윕)는 `candidates` 를 무제한으로 가져온 뒤 매 행마다 순차로 `await`한다. 종전(이 PR 이전)엔 이 루프의 쓰기가 `trigger.notificationSecretV2 = null; ...; await this.triggerRepository.save(trigger)` — 로드된 엔티티에 대한 단일 `UPDATE` 왕복이었다. 이번 커밋이 그 자리를 `rewriteTriggerConfigLocked` 로 바꾸면서, 같은 행 하나당 `BEGIN → pg_advisory_xact_lock(hashtext) → SELECT(findOne) → UPDATE → COMMIT` 5단계(대략 4~5 왕복)를 추가로 지게 됐다. 19_07_43 라운드는 정확히 같은 클래스의 확장(`update()` 단건 요청 경로가 3자리→4자리로 늘 때)을 "영향 범위가 저빈도 경로에서 흔한 경로로 넓어졌다"는 이유로 WARNING 으로 올렸다 — 이번엔 그 확장 대상이 **단건 요청이 아니라 루프**라는 점에서 같은 판단 기준이 더 강하게 적용된다: 후보 수가 N 이면 이 구간의 DB 왕복이 대략 1×N → 5×N 으로 늘고, 순차 `await` 라 병렬화도 없다. lost-update 방지라는 목적 자체는 정당하고(같은 트리거의 PATCH 와 이 cron 이 실제로 경합할 수 있다), 개별 트리거의 grace 만료가 몰릴 상황(예: 대량 secret 강제 재발급 이후 24h 뒤 일괄 승격)이 아니면 후보 수가 작아 실질 영향은 낮을 가능성이 높다. 다만 이 함수엔 배치 크기 상한이 없어(`LIMIT` 미적용, 이 PR 이 새로 만든 특성은 아니다) 그 가정이 깨지면 cron 실행 시간이 선형이 아니라 "선형 × 5배 상수" 로 늘어난다.
  - 제안: 차단 사유는 아니다. 다만 (a) 이 cron 의 실행 주기·과거 후보 수 분포를 관측해 상수 배율 증가가 실질적 SLA 위험인지 확인하고, (b) 필요하면 `candidates` 에 배치 크기 상한(`take(N)`)을 두어 한 실행이 무제한으로 길어지지 않게 하는 후속 검토를 권한다. `cleanupRotatedChatChannelTokens`(같은 파일의 자매 cron, `:1476` 루프)는 `config` 를 건드리지 않아 컬럼 한정 `update()` 만 쓰므로 **이 문제와 무관**하다 — 대조를 위해 명시해 둔다.

- **[INFO]** 나머지 여섯 자리는 전부 단건 요청/단건 호출이라 기존에 이미 수용된 트레이드오프의 반복 적용일 뿐, 새 등급이 필요 없다
  - 위치: `triggers.service.ts:865`(`normalizeNotificationSecretRef`, create/update 호출부에서 요청당 1회), `:1143`(`revokePerTriggerToken`, 동기 요청), `:1307`(`rotateBotToken` — 이미 이전 라운드가 커버한 자리의 병합 로직만 델타로 교정, 왕복 수 불변), `:1400`(`rotateNotificationSecret`, 컬럼만 — 락 불요), `:1500`(`cleanupRotatedChatChannelTokens`, 컬럼만 — 락 불요), `codebase/backend/src/modules/schedules/schedules.service.ts:241`(`update`, name/isActive 컬럼만).
  - 상세: 18_17_44/19_07_43 라운드가 이미 "advisory lock 도입으로 단건 config 쓰기가 1왕복→다왕복" 트레이드오프를 LOW 로 수용했다. 이번에 늘어난 자리들은 전부 그 자리에 정확히 대응하는 단건 호출(사용자 PATCH·POST·rotate 엔드포인트, 혹은 컬럼만 건드려 락이 애초에 필요 없는 자리)이라 같은 판단이 그대로 적용된다. `mergeIntoFreshSubKey`(triggers.service.ts:602 부근, `{ ...freshConfig, [key]: { ...base, ...patch } }`)는 얕은 스프레드 두 번으로 O(설정 하위 객체 크기) 상수 비용이며 반복 호출도 아니다.
  - 제안: 없음(기록 목적).

- **[INFO]** (개선 재확인) `findByIdForUpdate` 분리로 `update()` 검증 단계의 `relations: ['workflow']` JOIN 이 한 번 줄었다 — 19_44_08 라운드가 지적하지 않았던 이전 미해결 항목이 이번 diff 로 실제로 닫혔다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:520-535`(`findByIdForUpdate`, JOIN 없는 검증용 조회), `:576`(`update()` 진입부에서 호출부 교체)
  - 상세: 종전엔 `update()` 진입부가 `findById()`(관계 `workflow` 포함)로 검증용 조회를 했고, 락 안에서 다시 `relations: ['workflow']` 로 재조회했다 — 같은 JOIN 이 PATCH 마다 두 번 돌았다. 이 diff 는 검증용 조회를 관계 없는 `findByIdForUpdate` 로 좁혀 JOIN 이 필요한 조회를 락 안의 한 번으로 줄였다. 이 함수 JSDoc 이 스스로 이 최적화의 근거로 `performance WARNING#1`(20_17_16 라운드)을 인용하고 있다 — 실측은 안 했지만 코드상 쿼리 플랜이 실제로 그렇게 바뀐 것을 확인했다.
  - 제안: 없음(긍정 확인). 다만 이 최적화가 남기는 것은 "검증 조회(관계 없음) + 락 안 재조회(관계 있음)" 2회 SELECT 이며, 이는 19_44_08 라운드가 이미 지적한 "lock-then-reread 패턴의 구조적 귀결"과 같은 클래스라 그 자체를 새 이슈로 다시 세우지 않는다.

- **[INFO]** `endpoint-path-conflict-wrap-guard.ts` AST 워크 확장은 런타임과 무관
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:108-121`(콜백 경계를 넘어가는 조건 추가), `:156-172`(`EntityManager.save(Trigger, …)` 형태 매칭 추가)
  - 상세: 빌드/테스트 타임에만 도는 정적 분석 스캐너이고, 추가된 조건은 AST 노드 순회 중 상수 시간 판별(`ts.isFunctionLike`/`ts.isCallExpression`)이라 파일당 선형 스캔이라는 기존 복잡도를 바꾸지 않는다.
  - 제안: 없음.

## 그 외 관점 (변경 없음 재확인)

- **N+1**: 위 WARNING 을 제외하면 반복문 안에서 신규로 추가된 DB/외부 호출은 없다. `promoteRotatedNotificationSecrets` 안의 `this.secrets.rotate(...)` 호출은 이 PR 이전부터 있던 루프 내 개별 호출이라 새 지적 대상이 아니다(참고용으로만 기록).
- **캐싱**: `survivesWithFresh`/`buildChannel`/`mergeIntoFreshSubKey` 는 요청마다 다른 입력의 순수 변환이라 캐싱 대상이 아니다.
- **문자열 연산/자료구조**: 이번 diff 에 O(n²) 문자열 누적이나 부적절한 자료구조 사용 없음.
- **테스트·e2e 파일**: 프로덕션 성능과 무관.

## 요약

이번 라운드가 반영하는 다섯 커밋의 핵심은 "config 를 락 없이 통째로 되쓰던" 나머지 일곱 자리를 닫은 것이다. 그중 컬럼만 건드리는 네 자리(`rotateNotificationSecret`·`promoteRotatedNotificationSecrets`의 stale-v2 분기·`cleanupRotatedChatChannelTokens`·`schedules.service.ts#update`)는 오히려 `save()`→컬럼 한정 `update()` 로 페이로드를 줄이는 개선이고, config 를 고치는 세 단건 자리(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`rotateBotToken` 델타 교정)는 이전 세 라운드가 이미 수용한 "advisory lock 도입에 따른 단건 쓰기 왕복 증가" 트레이드오프의 반복 적용이라 새 등급이 필요 없다. 유일하게 이 그림을 바꾸는 것은 `promoteRotatedNotificationSecrets` cron 루프의 정상 승격 경로가 이제 매 후보 행마다 트랜잭션+advisory lock+재읽기(약 5왕복)를 순차로 거친다는 점이다 — 이전 세 라운드가 명시적으로 "반복문 안 호출 없음"을 확인했던 전제가 이번 커밋으로 깨졌고, 후보 집합에 배치 상한(`LIMIT`)이 없어 이론적으로는 후보 수에 선형으로, 그것도 이전보다 5배 큰 상수로 cron 실행 시간이 늘 수 있다. lost-update 방지라는 목적은 정당하고 정상 운영 조건(후보 수가 적음)에서는 실질 영향이 낮을 것으로 보이지만, 배치 job 안에서 락+재읽기를 순차 반복하는 패턴 자체는 다음에 이 cron 의 후보 조건이 넓어지거나(예: grace 기간 단축) 다른 배치 job 이 같은 헬퍼를 재사용할 때 조용히 악화될 수 있는 자리라 WARNING 으로 기록한다. 그 외 알고리즘 복잡도·메모리·캐싱·블로킹 I/O·자료구조 관점에서 새로 지적할 구조적 결함은 없다.

## 위험도

LOW
