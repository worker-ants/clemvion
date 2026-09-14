# 성능(Performance) Review — trigger-config-lost-update

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 서로의 `chatChannel.inboundSigningRef` 를 되돌려
인입 서명 검증을 fail-open 시키던 결함) 수정 PR. 핵심 변경은 `trigger-config-lock.ts`(신규,
advisory lock + 락 안 재읽기 유틸 `rewriteTriggerConfigLocked`)와 그 배선(`triggers.service.ts`,
`chat-channel-binder.service.ts`, `hooks.service.ts`, `schedules.service.ts`)이다. 실제 소스
파일(`codebase/backend/src/**`, 테스트 제외)을 `Read`로 직접 열어 확인했고, `git diff
origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts` 로 정확한 변경분을
대조했다. `review/code/**`, `plan/**` 등은 이전 라운드 산출물이며 이번 리뷰의 코드 변경 대상이
아니다.

## 발견사항

- **[INFO]** 웹훅 인입 hot path 의 쓰기 폭이 줄었다 (긍정적 개선)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `touchLastTriggeredAt`(정의부,
    `private async touchLastTriggeredAt` 메서드) 및 두 호출부(`handleWebhook` 안의
    `await this.touchLastTriggeredAt(trigger);` 두 자리)
  - 상세: 종전엔 인바운드 메시지마다 `trigger.lastTriggeredAt = new Date(); await
    triggerRepository.save(trigger)` — 엔티티 전체(‌`config` JSONB 포함)를 재직렬화해 쓰는
    UPDATE 였다. 이제는 `triggerRepository.update({id}, {lastTriggeredAt})` 로 컬럼 하나만
    쓴다. 이 경로는 CHANGELOG 가 명시하듯 "인입 메시지마다" 도는, 이 PR 범위에서 가장 호출
    빈도가 높은 경로라 WAL/디스크 쓰기량과 row-lock 보유 시간 감소 효과가 다른 어떤 변경보다
    크다. 회귀 테스트(`hooks.service.spec.ts` 의 `expect(Object.keys(patch)).toEqual(['lastTriggeredAt'])`)도 이
    컬럼-한정 계약을 고정해 둔다.
  - 제안: 없음 — 순수 개선이며 유지 권장.

- **[INFO]** 스케줄 편집의 trigger 동기화도 컬럼 한정 갱신으로 축소 (긍정적)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:241-246` (`update()` 의
    `patch` 조립 + `triggerRepository.update({id: trigger.id}, patch)`)
  - 상세: `name`/`isActive` 만 바뀌는데도 매번 `config` JSONB 를 포함한 엔티티 전체를
    재기록하던 `save(trigger)` 를 두 컬럼짜리 `update()` 로 좁혔다. 스케줄 편집은 트리거
    PATCH 보다 빈도가 낮아 영향은 제한적이지만 방향은 (1)과 동일한 개선이다.
  - 제안: 없음.

- **[INFO]** lost-update 수정이 여러 동기 쓰기 경로의 DB 왕복 수를 정량적으로 늘린다 —
  의도된 트레이드오프이지만 성능 관점의 비용을 적어 둔다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-173`
    (`rewriteTriggerConfigLocked`) 및 그 호출부 7곳 — `chat-channel-binder.service.ts` 의
    `setupChatChannel` 성공 경로(`rewriteTriggerConfigLocked(...)` 첫 호출)와 실패 경로(catch
    블록의 두 번째 호출), `triggers.service.ts` 의 `normalizeNotificationSecretRef`,
    `revokePerTriggerToken`, `rotateBotToken`(6단계 trigger 컬럼 갱신), 그리고
    `promoteRotatedNotificationSecrets` 루프 내부.
  - 상세: 이 7개 호출부는 `git diff origin/main` 기준으로 전부 `triggerRepository.save(trigger)`
    (엔티티 전체를 한 번의 UPDATE 로 쓰는 단발 호출, 트랜잭션·락 없음)에서
    `manager.transaction(async (m) => { acquireTriggerConfigLock; m.findOne; m.update })` 형태로
    바뀌었다. 왕복 수로 세면 `BEGIN → SELECT pg_advisory_xact_lock(...) → SELECT ...(findOne) →
    UPDATE → COMMIT` 로, 종전의 단일 UPDATE 대비 최소 4배의 DB 왕복이다. 동기 요청 경로
    (`revokePerTriggerToken`, `rotateBotToken`, `setupChatChannel`)에서는 이 왕복이 그대로
    응답 지연에 더해진다. lost-update 를 막으려면 "락 안에서 최신 행을 재읽는다" 가 구조적으로
    필요하므로 이 비용 자체는 정당하고, `trigger-config-lock.ts` JSDoc 이 트레이드오프
    (외부 호출을 락 밖으로 뺀 것이 이 비용을 상쇄하는 설계)를 이미 상세히 근거를 남겨 뒀다.
    다만 다른 관점(concurrency/database) 리뷰가 "직렬화·블로킹 자원" 측면은 다뤘어도 "왕복
    횟수" 로 정량화한 기록은 없어 성능 관점에서 남긴다.
  - 제안: 조치 불요(근거 문서화됨). 이 엔드포인트들이 향후 고빈도 경로로 바뀔 계획이 있다면
    이 비용을 재평가할 근거로 이 수치를 참조할 것.

- **[WARNING]** cron 배치 루프(`promoteRotatedNotificationSecrets`)가 트리거당 락+재읽기
  왕복을 새로 추가했고, 여전히 트리거를 순차로 처리한다 — 백로그가 커지면 사이클 실행 시간이
  더 가파르게 늘어난다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1363-1443`
    (`promoteRotatedNotificationSecrets`)
  - 상세: `createQueryBuilder().getMany()` 로 조건(`notification_secret_v2 IS NOT NULL AND
    notification_rotated_at <= cutoff`)에 맞는 **모든** 후보를 한 번에 메모리에 적재하고
    (`take`/`limit` 없음), `for (const trigger of candidates)` 로 트리거마다 `secrets.rotate`
    (secret store 왕복) + `rewriteTriggerConfigLocked`(트랜잭션 1개 + advisory lock 획득 +
    `findOne` + `update`, 왕복 ~4회)를 **순차로 `await`** 한다. 이 루프 자체(전체 후보 적재 +
    트리거당 순차 처리)는 이 PR 이전부터 있던 형태라 새 결함은 아니지만, 이번 변경으로
    트리거 한 건당 쓰기 비용이 `save()` 단발 호출에서 락+재읽기 트랜잭션으로 늘어 **N+1 형태의
    기존 루프에 상수 배 비용이 곱해졌다**. 평시에는 24h grace 정책상 후보 수가 작겠지만, cron
    이 한동안 멈췄다 재개되거나(배포·장애) 워크스페이스/트리거 수가 늘어 회전 빈도가
    올라가면 한 사이클의 실행 시간이 선형보다 가파르게(개수 × 늘어난 상수) 증가한다. 각
    트리거는 서로 다른 advisory lock 키(`trigger-config:<다른 id>`)를 잡으므로, 트리거 간
    병렬 처리를 막는 것은 락이 아니라 이 루프의 순차 `await` 구조다.
  - 제안: 지금 막을 사유는 아니다(그레이스 기반이라 평시 후보 수가 작다). 다만 실제 운영에서
    사이클 실행 시간이 관측되면 (a) `getMany()` 에 처리량 상한(`take(N)`)을 걸어 사이클당
    처리 건수를 제한하거나, (b) 서로 다른 트리거는 락이 겹치지 않으므로
    `Promise.allSettled` 로 배치 병렬화하는 것을 후속 검토 대상으로 남길 것.

- **[INFO]** 메인 PATCH(`update()`, 창 1)의 순증가 비용은 advisory lock 획득 1회뿐 — 같은 PR
  이 "JOIN 이 PATCH 마다 두 번 도는" 기존 성능 이슈를 스스로 잡아냈다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:531-538`
    (`findByIdForUpdate`, JSDoc 에 `performance WARNING#1` 대응 명시), `:606-671`
    (`update()` 의 advisory-lock 트랜잭션 블록)
  - 상세: 사전 검증용 조회를 `findById`(항상 `relations: ['workflow']` 동반)에서
    `relations` 없는 `findByIdForUpdate` 로 분리했다 — `update()` 의 사전 검증(타입 분기 ·
    chatChannel 설정 여부 · 인증 설정)은 그 관계를 보지 않으므로, 관계 로드는 락 안에서
    수행하는 재읽기(`m.findOne(Trigger, { relations: ['workflow'] })`) 한 번으로 합쳐졌다.
    `git diff origin/main` 대조 결과 이 PR 이전에는 `findById`(JOIN 포함) 한 번 + `save`
    한 번이었고, 이 PR 이후로는 `findByIdForUpdate`(JOIN 없음) 한 번 + [advisory lock
    획득 + JOIN 포함 재읽기 + save] 한 트랜잭션이다 — 순증가는 lock 획득 SELECT 1회와
    트랜잭션 오버헤드뿐이고, JOIN 이 중복되는 일은 없다. `chatChannel` 이 실린 PATCH 는
    여기에 더해 외부 `setupChannel` HTTP 호출 + 두 번째 lock+재읽기+UPDATE 트랜잭션(binder) +
    응답용 재조회(`findOne`)가 순차로 이어져 꼬리 지연이 늘지만, 저빈도 관리용 엔드포인트라
    위험은 낮다.
  - 제안: 조치 불요. `findByIdForUpdate` 분리는 오히려 모범 사례로 남길 만하다.

- **[INFO]** advisory lock 무기한 대기가 DB 커넥션 풀을 점유한다 — 동시성 리뷰가 다룬
  트레이드오프의 처리량(throughput) 측면
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`
    (`acquireTriggerConfigLock`) — `lock_timeout` 은 삭제 경로(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`,
    `:76`)에만 적용되고 나머지 호출부는 무기한 대기.
  - 상세: `pg_advisory_xact_lock` 대기 중에는 그 요청이 쥔 DB 커넥션이 풀에 반납되지 않는다.
    이미 이 저장소의 다른 리뷰가 "대기 상한 부재"를 새로운 공유 블로킹 자원으로 지적했는데
    (동시성 WARNING#3 계열), 성능 관점에서 보태면 커넥션 풀은 **애플리케이션 전체가 공유하는
    유한 자원**이다. 특정 트리거에 몰린 재시도/동시 관리 호출(예: 클라이언트의 PATCH 재시도,
    자동화된 헬스체크가 유발하는 `rotateBotToken` 폭주)이 여러 커넥션을 동시에 대기 상태로
    묶으면, 이론적으로는 그 트리거와 무관한 다른 요청까지 풀 고갈로 지연될 수 있다. 임계
    구간이 DB 왕복 두 번으로 짧다는 근거는 타당하고 지금 이 트래픽 패턴(저빈도 관리 API)에서는
    현실적 위험이 낮다.
  - 제안: 조치 불요(근거 문서화됨). 운영 중 이 자리에서 지연·풀 고갈이 관측되면
    `lock_timeout` + 재시도/백오프를 최우선 후보로 고려할 것.

## 요약

이번 PR 의 핵심 트레이드오프는 "정확성(lost-update 방지)을 위해 몇몇 쓰기 경로의 DB 왕복을
늘린다"이며, 그 설계는 임계구간을 최소화(외부 호출을 락 밖에 두기)하고 사전 검증 조회에서
불필요한 JOIN 을 제거하는 등 세심하게 다듬어져 있다. 오히려 가장 호출 빈도가 높은 두 경로
(웹훅 인입의 `lastTriggeredAt` 갱신, 스케줄 편집의 trigger 동기화)는 `save()` 전체 저장에서
컬럼 한정 `update()` 로 바뀌어 순수한 성능 개선이다. 유일하게 새로 주목할 만한 지점은
`promoteRotatedNotificationSecrets` cron 루프인데, 기존에도 순차 처리 구조였던 루프에
트리거당 락+재읽기 트랜잭션이 추가되어 상수 비용이 커졌다 — 평시엔 문제없지만 백로그가
쌓이는 시나리오에서는 사이클 실행 시간이 더 가파르게 늘어날 수 있어 후속 관찰 대상으로 남긴다.
그 외 advisory lock 무기한 대기의 커넥션 풀 점유는 이미 다른 관점에서 다룬 트레이드오프의
처리량 측면 재확인이다. 이번 변경을 막을 성능상 사유는 없다.

## 위험도

LOW
