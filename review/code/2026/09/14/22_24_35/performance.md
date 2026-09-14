# 성능(Performance) Review — trigger-config-lost-update

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 `chatChannel.inboundSigningRef` 를 되돌려 인입
서명 검증이 fail-open 되던 결함)를 advisory lock(`pg_advisory_xact_lock`) + "락 안에서
재읽어 머지 후 쓰기" 로 닫은 변경이다. 실제 런타임 코드가 바뀐 파일을 성능 관점에서
확인했다: `trigger-config-lock.ts`(신규) · `chat-channel-binder.service.ts` ·
`triggers.service.ts` · `hooks.service.ts` · `schedules.service.ts` ·
`chat-channel-input-rules.ts`. 나머지(테스트·정적 가드·plan·CHANGELOG·이전 리뷰 산출물
커밋)는 런타임 성능과 무관해 제외했다.

## 발견사항

- **[WARNING]** cron 승격 루프가 후보 행마다 순차 트랜잭션(락 획득 + 재조회 + UPDATE)을 열어, 후보당 DB 왕복이 종전 대비 크게 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1308`(`promoteRotatedNotificationSecrets`), 락 호출은 `:1371-1379`(`rewriteTriggerConfigLocked`)
  - 상세: `git diff origin/main...HEAD` 로 대조하면 이 루프 본문(정상 케이스, `config.notification` 을 갱신하는 분기)은 종전 `await this.triggerRepository.save(trigger)` **1회 UPDATE** 였다. 이번 PR 은 그 자리를 `rewriteTriggerConfigLocked` 로 바꿨는데, 이 함수는 `manager.transaction()` 안에서 `acquireTriggerConfigLock`(advisory lock 획득 쿼리) → `m.findOne`(재조회) → `m.update` 순으로 **최소 3개 쿼리 + BEGIN/COMMIT** 을 순차로 실행한다. `candidates` 는 `.getMany()` 로 전량 메모리에 적재된 뒤(페이지네이션 없음 — 이 PR 이 만든 패턴은 아니고 기존 그대로) `for` 루프에서 **순차로**(병렬화 불가 — 같은 트랜잭션/락을 매번 새로 여는 구조) 처리된다. 즉 후보 N개에 대해 왕복 횟수가 대략 N × 1 → N × (3~4) 로 늘어난다. `config` 를 실제로 고치는 자리이므로 lock+재읽기 자체는 이 PR 의 정합성 수정에 필요한 비용이지만(`chatChannel` 필드 lost-update 재발 방지), **루프 안에서 후보마다 반복**되는 구조라 grace-period 승격 대상이 몰리는 시점(예: 장애 복구 후 backlog)에는 cron 실행 시간이 이전보다 더 크게 늘어날 수 있다. (참고: 같은 파일의 `cleanupRotatedChatChannelTokens` 루프는 이 PR 에서 `save(trigger)` → 컬럼 한정 `triggerRepository.update()` 로만 바뀌고 lock 을 타지 않아 오히려 왕복이 줄었다 — 대칭이 아니다.)
  - 제안: 당장 막을 사유는 아니다(정합성이 우선). 다만 grace-period 승격 대상 수가 실제로 커질 수 있다면, 배치 크기를 제한하거나(예: `.take(N)` + 다음 사이클로 이월), 후보를 청크로 나눠 처리하는 것을 후속으로 고려. 최소한 `promoted` 카운트와 함께 소요 시간을 로그/메트릭으로 남겨 실측 근거를 쌓아 두면 다음 튜닝이 쉬워진다.

- **[WARNING]** advisory lock 대기에 상한이 없고(삭제 경로 제외) 기본 커넥션 풀이 10인 상태에서, 같은 트리거를 겨냥한 동시 쓰기가 몰리면 풀 전체가 고갈될 수 있다 — 이 PR 이 그 패턴을 쓰는 자리를 1곳(exec-cap 선례)에서 7곳 이상으로 넓힌다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`(`acquireTriggerConfigLock` — `options.timeoutMs` 미지정 시 `lock_timeout` 없이 무한 대기), `:107-117`(JSDoc "대기에 상한이 없다" 절), 풀 설정은 `codebase/backend/src/app.module.ts:114-125`(`extra.max` 미설정 시 pg 기본값 10)
  - 상세: `manager.transaction()` 은 콜백이 끝날 때까지 풀에서 커넥션 하나를 점유한다. 삭제 경로(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)를 제외한 나머지 전부(`TriggersService.update()` 창 1, `rotateBotToken`, `revokePerTriggerToken`, `normalizeNotificationSecretRef`, `promoteRotatedNotificationSecrets` 의 config 분기, `chat-channel-binder.service.ts` 의 성공/실패 두 경로)는 `lock_timeout` 이 없어 `SELECT pg_advisory_xact_lock(...)` 이 **먼저 잡은 트랜잭션이 커밋할 때까지 무한정 대기**한다. 임계 구간 자체는 설계상 짧지만(외부 호출 없이 재읽기+UPDATE 뿐), 같은 트리거에 대해 동시 요청이 몰리면(예: 클라이언트 재시도 폭주, 통합 스크립트가 같은 트리거를 반복 PATCH) 대기 중인 요청들이 각자 풀 커넥션을 하나씩 붙잡은 채 줄을 선다 — 기본 풀 크기(10)를 넘는 동시 요청이 같은 트리거에 몰리면 **그 트리거와 무관한 다른 요청까지** 커넥션을 못 얻어 지연/타임아웃되는 풀 고갈로 번질 수 있다. 이 자체는 새 클래스의 위험이 아니라 이미 코드 주석·이전 리뷰(`review/code/2026/09/14/18_17_44` concurrency WARNING#3)가 "새 공유 블로킹 자원"으로 인지·수용한 트레이드오프이지만, 그 리뷰는 락 경합/정합성 관점이었고 여기서는 **커넥션 풀 소진**이라는 별개의 관측 축을 더한다. 또한 이 PR 로 이 락 클래스를 쓰는 쓰기 지점이 기존 1곳(`execution-engine.service.ts` 의 `exec-cap:*`)에서 트리거 도메인 안에서만 7곳 이상으로 늘어, 같은 위험을 유발할 수 있는 코드 경로 수가 늘었다.
  - 제안: 즉시 조치가 필요한 정도는 아니다(운영에서 한 트리거에 그 정도 동시성이 몰리는 경우는 드물 것으로 보임). 다만 `acquireTriggerConfigLock` 의 `timeoutMs` 옵션은 이미 파라미터로 존재하므로, 삭제 이외의 경로에도 (짧더라도) 상한을 두는 편이 "조용한 지연 대신 드러나는 오류"라는 이 PR 자신의 설계 원칙과도 일치한다. 최소한 `pg_stat_activity`/풀 대기 시간을 모니터링 대상으로 등재해 두는 것을 권고.

- **[INFO]** `TriggersService.update()` 에 `chatChannel` 이 실리는 PATCH 는 lock+재읽기 트랜잭션을 2번(창 1 + `setupChatChannel` 내부), `findOne` 을 2번 추가로 거쳐 종전보다 왕복이 늘었다 — 정합성 수정에 내재된 비용이라 판단은 유보
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:588-638`(창 1 트랜잭션), `:681-685`(chatChannel 갱신 후 재조회), `chat-channel-binder.service.ts:266-278`/`:310-321`(성공/실패 경로 각각의 `rewriteTriggerConfigLocked`)
  - 상세: 종전엔 `save(trigger)` 1회 + (chatChannel 있으면) `triggerRepository.update()` 1회 + 재조회 1회였다. 이번 PR 로는 창 1 트랜잭션(락 획득 + `findOne` w/ relations + `save`) + `setupChatChannel` 의 트랜잭션(락 획득 + `findOne` + `update`) + 마지막 재조회, 도합 쿼리 수가 대략 2~3배로 늘었다. 다만 외부 HTTP 호출(`adapter.setupChannel`)은 두 트랜잭션 **바깥**에 정확히 위치해 있어(`trigger-config-lock.ts` JSDoc 이 명시한 제약을 그대로 지킴) 락 보유 시간 자체는 늘지 않는다 — 늘어난 것은 순수 DB 왕복 횟수뿐이다. lost-update 를 막으려면 "락 안에서 최신 값을 다시 읽는" 단계가 구조적으로 필요하므로 이 증가는 기능 정합성과 맞바꾼 대가이지 설계 결함은 아니다.
  - 제안: 별도 조치 불요. 이후 이 경로의 p99 지연을 모니터링해 두면, 위 두 WARNING 항목(락 대기 상한·cron 배치)의 실제 영향 여부를 판단할 실측 근거가 된다.

- **[INFO]** (긍정적 관찰) 웹훅 인입 hot path 는 이 락 클래스를 타지 않도록 의도적으로 분리돼 있다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:973-979`(`touchLastTriggeredAt`), `codebase/backend/src/modules/schedules/schedules.service.ts:234-247`
  - 상세: `lastTriggeredAt` 갱신(모든 인입 웹훅마다 실행되는 hot path)과 schedule 의 `name`/`isActive` 갱신은 `config` 를 건드리지 않으므로 advisory lock 을 타지 않고 컬럼 한정 `update()` 로 남았다. 종전엔 둘 다 `save(trigger)`(엔티티 전체 저장)였으므로, 이 변경은 오히려 쓰기 페이로드를 줄이고 hot path 에 새 직렬화 지점을 만들지 않은 성능상 개선이다.
  - 제안: 없음 — 좋은 설계 선택으로 기록.

## 요약

이 PR 의 핵심 트레이드오프는 "정합성(lost-update/fail-open 차단)을 위해 트리거 config 쓰기 경로마다 advisory lock + 락 안 재읽기를 추가한다" 는 것이고, 그 대가로 해당 쓰기들의 DB 왕복 수가 대체로 3~4배 늘었다. 임계 구간에 외부 호출을 두지 않는 설계(Cafe24 advisory-lock 기각 선례를 정확히 학습)는 락 보유 시간을 짧게 유지해 이 대가를 합리적인 수준으로 억제한다. 다만 두 지점은 후속 관찰이 필요하다 — (1) `promoteRotatedNotificationSecrets` cron 루프가 후보마다 이 무거워진 쓰기를 순차 반복해 배치가 커지면 실행 시간이 비례 이상으로 늘어날 수 있고, (2) 삭제 이외 경로에 `lock_timeout` 이 없는 상태에서 같은 트리거에 동시 쓰기가 몰리면 (풀 기본값 10 기준) 커넥션 풀 고갈로 번질 잠재 위험이 있으며 이 PR 이 그 위험 노출 지점을 1곳에서 7곳 이상으로 넓혔다. 반대로 `lastTriggeredAt`/`schedule.name`·`isActive` 같은 고빈도 경로는 이 락을 타지 않고 오히려 컬럼 한정 갱신으로 쓰기 비용이 줄어, hot path 성능은 개선됐다. 두 WARNING 항목 모두 이번 배치를 막을 정도의 결함은 아니고, 정합성 우선순위가 명확히 근거를 가지고 문서화돼 있어 낮은 위험도로 판단한다.

## 위험도

LOW
