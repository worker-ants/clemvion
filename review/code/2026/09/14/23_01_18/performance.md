# 성능(Performance) Review — trigger-config-lost-update

## 검토 범위

`trigger.config` lost-update 수정의 실제 런타임 경로: `trigger-config-lock.ts`(신규 유틸) ·
`triggers.service.ts` · `chat-channel-binder.service.ts` · `hooks.service.ts` ·
`schedules.service.ts`. `repo-guards/__tests__/**` · `*.spec.ts` · e2e 스펙 · `CHANGELOG.md` ·
`plan/**` · 이전 라운드 `review/code/**` 산출물은 런타임 성능과 무관해 스코프에서 제외했다
(`__tests__/endpoint-path-conflict-wrap-guard.ts` 는 정적 분석 스캐너지만 컴파일타임 도구라
동일하게 제외).

## 발견사항

- **[WARNING]** 24h grace 승격/정리 cron 스윕이 행마다 lock+transaction+refetch 를 새로 열어, 처리 대상 1건당 DB 왕복 수가 기존 대비 2~3배로 늘었고 여전히 완전 순차다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1352`(`promoteRotatedNotificationSecrets`)의 `for (const trigger of candidates)` 루프(`:1364`~`:1428`), `:1441`(`cleanupRotatedChatChannelTokens`)의 동일 패턴(`:1453`~`:1482`)
  - 상세: 종전엔 루프 한 바퀴가 `this.secrets.rotate(...)`(내부적으로 `findOne`+`update`/`insert`, 2 왕복) + `triggerRepository.save(trigger)`(대략 1 왕복)였다. 이 PR 은 `save()` 를 `rewriteTriggerConfigLocked()` 로 바꿨는데, 그 함수는 매 호출마다 **새 트랜잭션**을 열어 `BEGIN → SELECT pg_advisory_xact_lock(hashtext($1)) → SELECT trigger → UPDATE → COMMIT` 을 수행한다(`trigger-config-lock.ts:142-172`). 즉 한 행당 DB 왕복이 `secrets.rotate` 2회 + lock 획득 1회 + 재조회 1회 + UPDATE 1회 = **최소 5회**로, 기존(대략 3회) 대비 커진다. 루프 자체는 이 PR 이전부터 순차(`for...of` + `await`)였고 이번 변경이 그 구조를 바꾸진 않았지만, **행당 비용이 늘어난 채로 순차 처리 상수가 배가**되므로 스윕 전체 소요 시간은 배치 크기에 비례해 커진다. 평상시(매시간 실행, grace 24h)엔 대상 건수가 적어 체감 영향이 작겠지만, cron 이 한동안 멈췄다가 재개되거나 회전 이벤트가 몰리는 시나리오(대량 배포 직후 secret 일괄 회전 등)에서는 눈에 띄게 느려진다. 또한 이 락은 cron 문맥에서 방어해야 할 "동시 PATCH" 경합이 사실상 없는(다른 요청이 그 순간 같은 트리거를 편집 중일 확률이 낮은) 경우에도 매번 advisory lock 을 잡아, contention 이 없는 공통 경로에서조차 트랜잭션 오버헤드를 지불한다.
  - 제안: 급한 조치는 아니다(배치 크기가 보통 작고, correctness 가 우선). 다만 후속으로 (a) `Promise.all` + 소규모 동시성 제한(예: 5~10개씩)으로 서로 다른 트리거 간에는 병렬 처리하거나, (b) 후보 집합이 일정 크기(예: 50건)를 넘으면 로그로 남겨 백로그 누적을 관측 가능하게 하는 것을 고려할 만하다.

- **[INFO]** lost-update 수정 자체가 `PATCH /api/triggers/:id` 의 쓰기 경로 DB 왕복 수를 대략 2배로 늘린다 — correctness 를 위해 불가피한 비용이지만 측정해 둘 값이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:620-669`(`update()` 창 1 트랜잭션)
  - 상세: 종전엔 `findById`(관계 JOIN 포함 SELECT 1회) → in-memory 병합 → `save(trigger)`(쓰기 1회) 로 대략 2회 왕복이었다. 이번 수정은 `findByIdForUpdate`(관계 없는 SELECT 1회, 검증 전용) → 트랜잭션 안에서 `acquireTriggerConfigLock`(SELECT 1회) → `m.findOne`(관계 JOIN 포함 SELECT 1회) → `m.save`(쓰기 1회) 로 최소 4회 왕복이 된다. `chatChannel` 이 실린 PATCH 는 마지막에 응답용 재조회(`:713`)가 하나 더 붙어 종전과 동일하게 유지된다. `findByIdForUpdate` 를 관계 없이 가볍게 만들어 이중 JOIN 은 이미 피했다(주석 `:522-528`에 그 근거가 명시돼 있고 확인했다) — 그 절제는 잘 됐다. 다만 advisory lock 획득 자체가 추가 왕복 1회를 항상 더한다는 점은 문서화된 곳이 없어 적어 둔다.
  - 제안: 조치 불요(정확성 우선순위가 맞다). 이 엔드포인트가 향후 고빈도 경로가 되면 lock 획득 쿼리와 재조회를 하나의 CTE(`SELECT pg_advisory_xact_lock(...) , * FROM trigger WHERE id = ...`)로 합쳐 왕복을 1회 줄이는 여지가 있다는 정도만 참고.

- **[INFO]** `create()`/`update()` 가 notification signing secret 정규화와 chatChannel setup 을 순차로 처리할 때, 같은 트리거의 advisory lock 을 한 요청 안에서 두 번 열고 닫는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:504`(`normalizeNotificationSecretRef` 호출, 내부에서 `:864`의 `rewriteTriggerConfigLocked` 로 트랜잭션 1개), `:507-518`(`chatChannelBinder.setupChatChannel` 호출, 내부에서 `chat-channel-binder.service.ts:266` 또는 `:310`의 `rewriteTriggerConfigLocked` 로 트랜잭션 1개 더)
  - 상세: 두 조건(`notification.signing.secret` plaintext 존재 && `chatChannel` 지정)이 같은 요청에 겹치면, 같은 트리거의 `trigger-config:<id>` advisory lock 을 순서대로 두 번 획득·해제한다. 서로 겹치지 않으므로 데드락 위험은 없지만, 트랜잭션 BEGIN/COMMIT 과 lock 쿼리를 두 번 지불한다. 두 조건이 겹치는 경우는 흔치 않을 것(신규 plaintext signing secret 을 매번 보내는 것은 드묾)이라 실사용 영향은 낮다.
  - 제안: 조치 불요. 이 경로가 측정상 뜨거워지면 두 머지를 하나의 `rewriteTriggerConfigLocked` 호출로 합치는 리팩터를 고려할 수 있다(현재는 서로 다른 하위 키를 건드리므로 `merge` 콜백을 합성하면 가능).

- **[INFO]** 방금 INSERT 한 신규 트리거에도 `normalizeNotificationSecretRef` 가 advisory lock 재작성 경로를 탄다 — 무해하지만 그 트리거에 대한 동시 writer 가 존재할 수 없는 시점의 불필요한 lock 오버헤드
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:504`(`create()` 안의 `await this.normalizeNotificationSecretRef(saved)`)
  - 상세: `saved.id` 는 이 요청이 방금 만든 값이라 다른 요청이 그 id 로 PATCH 를 보낼 수 있는 시점은 응답이 나간 **이후**뿐이다. 그럼에도 `normalizeNotificationSecretRef` 는 공용 헬퍼를 그대로 재사용해 매번 advisory lock 획득 + 재조회를 거친다. 함수가 `create`/`update` 양쪽에서 재사용되는 설계상 자연스러운 결과이고, 트리거 생성 자체가 고빈도 경로가 아니라 실질 비용은 미미하다.
  - 제안: 조치 불요. 별도 "생성 전용 경로"를 만드는 비용이 이 최적화의 이득보다 크다.

## 확인했으나 새 지적으로 세지 않은 것 (다른 라운드에서 이미 다룸)

- **advisory lock 대기 상한 부재**(창 1·binder·rotate 경로) — `trigger-config-lock.ts:107-117` 의 JSDoc 이 "임계 구간이 DB 왕복 두 번으로 유계" 라는 근거와 함께 명시적으로 설계 결정을 적어 뒀고, 이전 라운드 concurrency/database 리뷰가 이미 WARNING 으로 수용했다. 성능 관점에서도 유효한 우려(락 경합 시 DB 커넥션·HTTP 요청 스레드 점유 시간 증가)지만 중복 지적하지 않는다.
- **advisory lock 32비트 키 공간 공유**(`exec-cap:*` vs `trigger-config:*`) — `database.md`(`review/code/2026/09/14/18_17_44`) INFO 로 이미 수용. 우연 충돌 시 무관한 자원의 과직렬화이지 정확성 문제는 아니다.

## 긍정적으로 확인한 점 (참고)

- `hooks.service.ts:973-979`(`touchLastTriggeredAt`)와 `schedules.service.ts:234-246`(schedule↔trigger 동기화 patch)가 `save(entity)`(엔티티 전체 재직렬화·쓰기, `config` JSONB 포함)를 컬럼 한정 `update()`로 바꿨다. `handleWebhook` 은 인입 메시지마다 도는 hot path 이므로, 이 전환은 매 웹훅 요청마다 (보통 작지 않은) `config` JSONB 컬럼 전체를 다시 쓰는 비용을 없앤 실질적 개선이다.
- `findByIdForUpdate`(`triggers.service.ts:530-537`)를 `relations` 없는 가벼운 조회로 분리해, `update()` 가 같은 JOIN SELECT 를 PATCH 마다 두 번 돌리던 것을 한 번으로 줄였다(주석에 근거 명시, 확인함).
- `rewriteTriggerConfigLocked` 의 임계 구간은 "재읽기 + 머지 + UPDATE" 뿐이고 외부 HTTP 호출(`adapter.setupChannel` 등)은 모두 락 밖에서 끝낸 뒤 호출한다 — Cafe24 advisory lock 기각 선례(커넥션 점유 시간 증가)를 정확히 피한 설계다.

## 요약

이번 PR 은 lost-update 방지를 위해 "advisory lock 안에서 재읽고 병합해 쓰는" 패턴을 도입했고, 그 대가로 관련 쓰기 경로의 DB 왕복 수가 늘었다(`update()` 대략 2배, cron 스윕 행당 대략 1.7배). 가장 눈에 띄는 항목은 24h grace cron 스윕(`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)이 행마다 새 트랜잭션+lock+재조회를 여는 것으로, 순차 루프와 결합해 배치 크기에 비례한 지연 증가를 만든다(WARNING, 급하지 않음). 반대로 인입 웹훅 hot path(`touchLastTriggeredAt`)와 schedule 동기화는 이번 PR 로 오히려 전체 엔티티 저장을 컬럼 한정 갱신으로 줄여 쓰기 비용이 낮아졌다. 외부 HTTP 호출을 락 밖에 두어 커넥션 점유 시간을 최소화한 설계도 유지되고 있다. 전반적으로 correctness 를 위한 합리적인 trade-off이며, 차단할 사유가 되는 항목은 없다.

## 위험도

LOW
