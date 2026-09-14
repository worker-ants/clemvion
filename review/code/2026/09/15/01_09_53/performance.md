# 성능(Performance) Review — trigger-config-lost-update

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 `inboundSigningRef` 를 되돌려 인입 서명 검증이
fail-open 되는 경합)를 advisory lock(`pg_advisory_xact_lock`) + 락 안 재읽기-머지 패턴으로
막는 수정이다. 실제 런타임 코드 변경 대상은 `trigger-config-lock.ts`(신규),
`chat-channel-binder.service.ts`, `triggers.service.ts`, `schedules.service.ts`,
`hooks.service.ts`, `chat-channel-input-rules.ts` 6개 파일이며, 그 외 리뷰 대상으로 열거된
파일 다수(`review/code/2026/09/14/**`, `plan/**`)는 이전 라운드 리뷰 산출물/트래커 문서로
런타임 성능과 무관해 이 리뷰 범위에서 제외했다. 저장소를 mutate 하지 않고 `Read`/`grep` 으로만
확인했다(`git status --short` 잔여 없음).

## 발견사항

- **[INFO]** 쓰기 경로마다 advisory lock 획득 + 재읽기가 추가돼 라운드트립이 대략 2배로 늘었다 — 의도된 트레이드오프, 이미 문서화·리뷰됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:621-670`(`update()` 창 1), `:1143-1155`(`revokePerTriggerToken`), `:1307-1337`(`rotateBotToken`), `:865-875`(`normalizeNotificationSecretRef`); `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266-321`(`setupChatChannel` 성공/실패 두 경로)
  - 상세: `rewriteTriggerConfigLocked`(`codebase/backend/src/modules/triggers/trigger-config-lock.ts:147-184`)는 매 호출마다 새 트랜잭션을 열어 (1) `SELECT pg_advisory_xact_lock(hashtext($1))`, (2) `m.findOne`(재읽기), (3) `m.update`/`m.save` 세 번의 DB 왕복을 만든다. 종전 코드는 대부분 요청 시작 시점 스냅샷으로 `save()`/`update()` 한 번만 호출했으므로, 이번 PR 로 각 쓰기 경로의 DB 왕복 수가 대략 2배(락 1회 + 재읽기 1회 추가)로 늘었다. `update()` 는 여기에 더해 사전 검증용 `findByIdForUpdate` 조회까지 있어 총 4회 왕복(검증 조회 → 락 → 재읽기 → save)이다.
  - 근거: `trigger-config-lock.ts:118-121`JSDoc 이 "그래도 새 공유 블로킹 자원인 것은 맞다"고 스스로 적어 두었고, `review/code/2026/09/14/18_17_44` concurrency WARNING#3 및 database.md 가 트랜잭션/락 설계를 LOW 위험으로 이미 평가했다. 임계 구간이 「재읽기+머지+UPDATE」(DB 왕복 두 번)로 짧고 외부 HTTP 호출은 락 밖에 있어(Cafe24 advisory lock 기각 선례를 정확히 피함) 지연 상한이 낮다. 정합성(lost-update/fail-open 방지)을 위한 필수 비용이라 이번 배치를 막을 사유는 아니다.
  - 제안: 조치 불요(수용). 다만 이 라운드트립 증가가 `update()`/`rotateBotToken` 같은 사용자-대면 PATCH 엔드포인트의 p99 지연에 미치는 영향을 프로덕션 모니터링 지표(예: 엔드포인트별 DB 왕복 시간)로 추적해 두면, 트리거당 동시 PATCH 빈도가 높은 워크스페이스에서 락 대기(무상한, `lock_timeout` 없음)로 인한 tail latency 증가를 조기에 포착할 수 있다.

- **[INFO]** 배치 cron 두 곳이 후보 행마다 순차적으로 새 트랜잭션(락+재읽기)을 열어 — 반복문 내 DB 호출이 이번 PR 로 3배 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1373-1453`(`promoteRotatedNotificationSecrets`, 특히 `1385` `for (const trigger of candidates)` 와 `1438` `rewriteTriggerConfigLocked` 호출), `:1464-1507`(`cleanupRotatedChatChannelTokens`, `1476` 루프와 `1500` `triggerRepository.update`)
  - 상세: 두 cron 모두 `candidates` 를 한 번에 `getMany()` 로 적재한 뒤(이 부분은 N+1 아님, 배치 조회) `for...of` 루프 안에서 행마다 `await` 로 순차 처리한다. 종전엔 행마다 외부 호출(`secrets.rotate`/`resolve`, provider revoke) + `save`/`update` 한 번이었는데, 이번 PR 이 `promoteRotatedNotificationSecrets` 의 쓰기(`:1438-1449`)를 `rewriteTriggerConfigLocked` 로 바꾸면서 행마다 트랜잭션 시작 + advisory lock 획득 + `findOne` 재읽기 + `update` 네 왕복(기존엔 `save` 한 번)이 됐다. `cleanupRotatedChatChannelTokens` 는 `config` 를 안 건드리므로 (`:1497-1503`) 컬럼 한정 `update()` 그대로라 이 문제에서는 자유롭다.
  - 영향: 알고리즘 자체는 여전히 O(n)(n=grace 경과 후보 수)이고 병렬화 없는 순차 루프는 이번 PR 이전부터 있던 설계라 이 PR 이 새로 도입한 패턴은 아니다. 다만 후보 수가 커지면(cron 주기가 밀려 백로그가 쌓이는 경우 등) 왕복 수가 늘어난 만큼 cron 전체 소요 시간이 비례해서 늘어난다 — 트리거별 advisory lock 이라 서로 다른 트리거끼리는 이론상 병렬화 가능하지만 현재 구현은 여전히 완전 순차다.
  - 제안: 후보 수가 실무에서 작다면(24h 내 회전된 secret 수는 자연히 제한적) 조치 불요. 백로그가 누적될 수 있는 운영 시나리오가 있다면, 트리거별 락이 독립적이므로 `Promise.all`(동시성 상한을 둔 배치, 예: `p-limit`)로 병렬화하는 것을 고려할 수 있다 — 단, 여기서 병렬화는 순수 성능 개선이고 이번 PR 의 정합성 수정 자체와는 독립적인 후속 항목으로 취급해도 된다.

- **[정보/긍정]** `update()` 검증용 조회가 불필요한 JOIN 을 뺀 것으로 확인됨 — 이전 라운드에서 지적된 성능 WARNING 이 실제로 해소됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:531-538`(`findByIdForUpdate`), `:546`(`update()` 호출부)
  - 상세: `findByIdForUpdate` 는 `relations: ['workflow']` 없이 PK 로만 조회한다. JSDoc(`:531-537`)이 명시하듯, `update()` 의 사전 검증(타입 분기·chatChannel 설정 여부·인증 설정)은 그 관계를 보지 않고, 저장·응답에 쓰이는 엔티티는 락 안에서 `relations: ['workflow']` 로 다시 읽으므로(`:630-633`) 여기서 조인을 또 하면 PATCH 마다 같은 JOIN SELECT 가 두 번 도는 것을 `/ai-review review/code/2026/09/14/20_17_16` performance WARNING#1 이 지적했고, 이번 코드가 그 지적대로 가벼운 조회로 분리돼 있다.
  - 제안: 조치 불요(이미 반영 확인).

- **[정보/긍정]** 웹훅 인입 hot path 의 `lastTriggeredAt` 갱신이 전체 엔티티 저장에서 단일 컬럼 `update()` 로 축소됨
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:973-979`(`touchLastTriggeredAt`), 호출부 `:227`, `:686`
  - 상세: 종전엔 매 인입 웹훅/interaction ack 마다 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);` 로 엔티티 전체(큰 JSONB `config` 포함)를 다시 썼다. 이 함수는 이제 `update({id}, {lastTriggeredAt})` 한 컬럼만 갱신한다 — 이 경로는 "인입 메시지마다 돈다"고 주석이 명시하는 고빈도 경로라, 쓰기 페이로드 축소가 실질적인 처리량 개선이다. 부수적으로 이것이 곧 이번 PR 의 핵심 결함(전체 저장이 동시 PATCH 의 `config` 갱신을 지운다)을 웹훅 경로에서 없애는 수정이기도 하다.
  - 제안: 조치 불요(긍정적 변경 확인).

- **[INFO]** advisory lock 은 대부분 경로에서 대기 상한이 없다(`lock_timeout` 미설정) — 이미 알려진 트레이드오프
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`(`acquireTriggerConfigLock`), `:111-121`(JSDoc "대기에 상한이 없다")
  - 상세: 삭제 경로(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`, `triggers.service.ts:1027-1029`, `schedules.service.ts:311-313`)만 5초 상한을 두고, 나머지 쓰기 경로(update/rotateBotToken/binder/revokePerTriggerToken/normalizeNotificationSecretRef/cron 승격)는 무한 대기다. 같은 트리거에 대한 PATCH 폭주(예: UI 이중 클릭, 재시도 루프, 버그가 있는 클라이언트)가 있으면 뒤따르는 요청들이 큐잉되어 지연이 누적될 수 있다. JSDoc 이 "임계 구간이 DB 왕복 두 번으로 유계"라는 근거를 스스로 실측 없이 설계 근거로만 제시하고 있어(향후 임계 구간에 외부 호출/긴 계산이 들어가는 변경을 할 때 이 근거가 깨진다는 경고도 같은 JSDoc 에 있음), 순수 성능 관점에서는 "새 공유 블로킹 자원"이라는 자체 평가가 정확하다.
  - 제안: 조치 불요(이미 개념적으로 인지·문서화·수용됨, concurrency 리뷰가 WARNING#3 으로 이미 다룸). 트리거별 PATCH 동시성이 실제로 높은 사용 패턴이 확인되면 다른 쓰기 경로에도 `lock_timeout` 도입을 검토할 근거가 된다.

## 확인했으나 문제 없음

- 알고리즘 복잡도: 모든 변경된 함수가 O(1)(트리거 1건 단위) 또는 이미 존재하던 O(n) cron 순회이며, 새로 O(n²) 패턴(문자열 누적, 중첩 루프)이 도입된 곳은 없다.
- 메모리 할당: `rewriteTriggerConfigLocked` 의 머지 클로저들은 얕은 스프레드(`{...freshConfig, [key]: {...}}`)만 사용하며 대규모 컬렉션 적재나 불필요한 깊은 복사는 없다.
- 데이터 구조: 트리거 단위 처리에 맞게 단일 행 조회/갱신을 쓰고 있어 자료구조 선택에 문제 없음.
- 지연 로딩: `findByIdForUpdate` 사례처럼 필요 없는 관계(JOIN)를 걷어낸 방향으로 가고 있어 이 관점에서 퇴행 없음.
- `schedules.service.ts:308-316`(cascade 삭제)의 신규 트랜잭션은 단일 행 삭제 + 락 한 번뿐이라 별도 성능 이슈 없음.

## 요약

이번 변경은 `trigger.config` lost-update 를 트리거 단위 advisory lock + 락 안 재읽기-머지로 닫는 동시성/정합성 수정이며, 정합성을 위해 각 쓰기 경로의 DB 왕복 수를 대략 2배(락 획득 + 재읽기 추가)로 늘리는 트레이드오프를 명시적으로 감수하고 있다. 임계 구간이 짧고(외부 HTTP 호출은 락 밖) 대부분 트리거 단위 저빈도 쓰기(PATCH/rotate)라 이 비용은 합리적이며, 이미 별도 concurrency/database 리뷰가 이 설계를 LOW 위험으로 평가했다. 순수 성능 관점에서 새로 짚을 것은 두 cron 배치(`promoteRotatedNotificationSecrets`, `cleanupRotatedChatChannelTokens`)의 순차 루프가 이번 PR 로 행당 왕복 수가 늘었다는 점(여전히 O(n), 병렬화되지 않은 순차 처리)과, 대부분 경로에 락 대기 상한이 없어 트리거별 PATCH 폭주 시 지연이 누적될 수 있다는 점인데, 둘 다 후속 모니터링/최적화 대상일 뿐 이번 배치를 막을 사유는 아니다. 반대로 `findByIdForUpdate` 의 불필요 JOIN 제거와 `touchLastTriggeredAt` 의 컬럼 한정 갱신(웹훅 hot path)은 순수한 성능 개선으로 확인됐다.

## 위험도

LOW
