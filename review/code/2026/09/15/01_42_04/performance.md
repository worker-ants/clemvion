# 성능(Performance) 리뷰 — trigger-config lost-update 수정

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 `chatChannel.inboundSigningRef` 를 되돌려
fail-open 을 재현하던 결함)를 advisory lock(`pg_advisory_xact_lock`) + "락 안에서 재읽고
머지" 패턴으로 닫은 변경이다. 핵심 파일을 `git diff origin/main...HEAD` 로 직접 열어
확인했다: `trigger-config-lock.ts`(신규) · `triggers.service.ts` · `chat-channel-binder.service.ts`
· `schedules.service.ts` · `hooks.service.ts`. 나머지(`chat-channel-input-rules.ts` 의
`extractInboundSigningRef`, 테스트 파일, repo-guard 정적 가드, `review/`·`plan/` 산출물)는
런타임 성능에 영향이 없거나 트리비얼한 헬퍼라 개별 항목으로 다루지 않는다.

## 발견사항

- **[INFO]** cron 루프 안에서 트리거당 트랜잭션+advisory lock+재읽기가 순차 실행된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1385`(`for (const trigger of candidates)`), `:1438`(`rewriteTriggerConfigLocked` 호출) — `promoteRotatedNotificationSecrets`
  - 상세: 종전엔 후보 트리거마다 `save(trigger)` 한 번(사실상 UPDATE 1회)이었다. 이번 변경으로 `config.notification` 을 건드리는 이 경로만 `rewriteTriggerConfigLocked` 를 타게 되어, 후보 하나당 `BEGIN → SELECT pg_advisory_xact_lock(...) → SELECT (findOne) → UPDATE → COMMIT` 로 라운드트립이 약 4~5배 늘었다. 루프 자체는 `for...of` + `await` 로 순차 실행(병렬화 없음)이라 이 PR 이전부터 있던 특성이지만, 이번 PR 이 트리거 1건당 비용을 늘렸다. grace 기간(24h)이 지난 후보만 대상이라 배치 크기가 보통 작겠지만, 시크릿 로테이션이 몰리는 시점(대량 트리거 생성 직후 24h 뒤 등)에는 cron 1회 실행 시간이 눈에 띄게 늘어날 수 있다. 자매 함수 `cleanupRotatedChatChannelTokens`(`:1476`)는 `config` 를 건드리지 않아 평범한 `triggerRepository.update()` 그대로라 이 비용이 없다 — 비대칭이지만 의도된 것(전자만 `config.notification.signing` 을 재구성해야 함)으로 보인다.
  - 제안: 배치 크기가 실측으로 커지면(수백~수천 건/시간) `Promise.all`(동시성 상한 포함) 로 병렬화하거나, 같은 워크스페이스가 아닌 서로 다른 트리거는 락 네임스페이스가 겹치지 않으므로 동시 실행 자체는 안전하다는 점을 활용해 배치 동시성을 올리는 것을 검토. 지금 배치 크기에서는 차단 사유 아님.

- **[INFO]** 트리거 config 를 건드리는 모든 쓰기 경로가 "라운드트립 1회(UPDATE)" 에서 "라운드트립 4~5회(BEGIN·lock·findOne·UPDATE·COMMIT)" 로 늘었다 — 의도된 정합성-지연 트레이드오프
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:147-183`(`rewriteTriggerConfigLocked`), 호출부 `triggers.service.ts:623`(update 창1, 인라인)·`:865`(`normalizeNotificationSecretRef`)·`:1143`(`revokePerTriggerToken`)·`:1307`(`rotateBotToken`), `chat-channel-binder.service.ts`(`setupChatChannel` 성공/실패 경로)
  - 상세: 이전엔 요청 시작 시점 스냅샷으로 `save`/`update` 한 번이면 끝났다. 지금은 매 쓰기가 advisory lock 획득(`SELECT pg_advisory_xact_lock`) + 재읽기(`findOne`)를 추가로 거친다. `create`/`update`/`rotateBotToken`/`revokePerTriggerToken` 은 모두 사용자 요청 단위 API 엔드포인트라 반복문 안에 있지 않으므로 N+1 은 아니고, 단일 요청당 고정 상수 배(≈4~5x) 라운드트립 증가다. QPS 가 낮은 관리성 엔드포인트라 실무 영향은 작다고 판단되며, 외부 HTTP 호출(`adapter.setupChannel`)은 임계 구간 밖에 있어 락 보유 시간 자체는 짧게 유지된다(설계 의도대로).
  - 제안: 차단 사유 아님(정합성 버그 수정이 목적이고 트레이드오프가 JSDoc·CHANGELOG 에 명시돼 있다). 다만 이 엔드포인트들이 향후 고빈도 경로로 승격되면(예: 프런트가 PATCH 를 debounce 없이 폭넓게 호출) 라운드트립 증가가 누적될 수 있다는 점만 후속 관찰 포인트로 남긴다.

- **[INFO]** advisory lock 대기에 상한이 없다 — 같은 트리거를 겨냥한 동시 쓰기가 몰리면 요청 스레드/커넥션이 순차 대기로 묶인다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `acquireTriggerConfigLock`(`timeoutMs` 미지정 시 `SET LOCAL lock_timeout` 생략), `rewriteTriggerConfigLocked` 의 모든 호출부(삭제 경로 두 곳 제외)
  - 상세: 문서화된 설계 의도(무한 대기가 정답, 삭제만 5초 상한)를 이해했고 이의는 없다. 다만 성능 관점에서, 같은 `triggerId` 에 대한 PATCH/rotate 가 짧은 시간에 여러 건 겹치면(예: 클라이언트 재시도 폭주, 잘못 구성된 폴링) 요청이 큐잉되어 커넥션 풀을 점유한 채 대기하는 시간이 늘어난다 — 임계 구간이 DB 왕복 두 번으로 유계라는 전제가 깨지면(예: 향후 `merge` 콜백에 무거운 계산이 들어가면) 이 대기가 커넥션 풀 고갈로 번질 수 있다.
  - 제안: 차단 사유 아님. `trigger-config-lock.ts` JSDoc 이 이미 "임계 구간에 외부 호출/긴 계산을 들이면 그때 `lock_timeout` 을 추가하라"고 명시해 뒀으므로 현재 상태로 충분. 커넥션 풀 크기 대비 동일 트리거 동시 PATCH 빈도만 모니터링 대상으로 남겨 둘 만하다.

## 긍정적으로 확인한 점 (참고)

- `hooks.service.ts` 의 `touchLastTriggeredAt`(신규 private 메서드, 웹훅 인입마다 호출되는 hot path)이 `save(trigger)`(엔티티 전체 직렬화+쓰기) 대신 `triggerRepository.update({id}, {lastTriggeredAt})`(컬럼 한정)로 바뀌었다 — 이 PR 이 손댄 파일 중 가장 호출 빈도가 높은 경로에서 오히려 쓰기 비용이 줄었다.
- `triggers.service.ts` 의 `findByIdForUpdate`(신규, `update()` 전용)가 `relations: ['workflow']` JOIN 을 생략해, 검증용 조회와 락 안 재조회에서 같은 JOIN SELECT 가 두 번 도는 것을 막았다(`review/code/2026/09/14/20_17_16` performance WARNING#1 대응 — 이번 diff 안에서 이미 해소됨).
- `mergeIntoFreshSubKey`/`buildChannel`/`survivesWithFresh` 등 신규 헬퍼는 얕은 스프레드(`{ ...a, ...b }`)만 사용해 config 크기에 선형(O(k), k=서브객체 키 수)이며 반복문·중첩 정량자 없음 — 알고리즘 복잡도 문제 없음.
- 신규 쿼리(`findOne`/`update`/advisory lock)는 전부 PK(`id`)로 필터링되어 인덱스 이슈 없음. `manager.transaction()` 은 TypeORM 이 커넥션 획득/해제를 관리해 락 누수·커넥션 누수 없음.

## 요약

이번 변경은 정합성(lost-update/fail-open) 수정이 목적이며, 그 대가로 `trigger.config` 를 쓰는 모든 경로에 advisory lock 획득 + 재읽기라는 고정 상수 배의 라운드트립을 추가했다. 대부분 저빈도 관리 엔드포인트(단건 요청)라 N+1 이나 반복문 안 DB 호출 같은 스케일링 문제는 없으며, 유일하게 순차 for-loop 안에서 실행되는 `promoteRotatedNotificationSecrets`(시간당 cron)만 트리거당 비용이 눈에 띄게 늘었지만 24h grace 필터로 배치 크기가 제한돼 있어 당장 문제 될 정도는 아니다. 반대로 가장 빈번한 경로(`hooks.service.ts` 웹훅 인입의 `lastTriggeredAt` 갱신)는 `save`→`update` 전환으로 오히려 개선됐고, `update()` 의 중복 JOIN 도 이번 diff 자체가 제거했다. 알고리즘 복잡도·메모리 할당·데이터 구조 선택에는 문제가 없다. 차단할 성능 이슈는 없다.

## 위험도

LOW
