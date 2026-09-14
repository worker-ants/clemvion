# 성능(Performance) Review

## 발견사항

- **[WARNING]** `update()` 가 같은 `relations: ['workflow']` JOIN 을 요청 하나당 **두 번** 실행한다 — 첫 번째 결과는 어디에도 소비되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:473`(`const trigger = await this.findById(id, workspaceId);`, `findById` 정의는 `:347-351`) 과 `:557-560`(`m.findOne(Trigger, { where: { id: trigger.id, workspaceId }, relations: ['workflow'] })`, 락 안 재읽기)
  - 상세: `findById()` 로 읽은 첫 번째 `trigger` 는 트랜잭션 진입 전 검증(`type === 'schedule'` 분기, `assertChatChannelAlreadySetUp`, `previousInboundSigningRef` 초기값, `authConfigId` 검증)에만 쓰인다 — 이 경로들은 전부 `trigger.type`/`trigger.config`/`trigger.endpointPath` 만 참조하고 `trigger.workflow` 는 참조하지 않는다(`assertChatChannelAlreadySetUp` 도 `trigger.config` 만 읽음, `chat-channel-input-rules.ts:202`). 그런데 `findById` 는 항상 `relations: ['workflow']` 로 조인해 읽는다. 이번 PR 이 advisory lock 안에서 "커밋된 최신 상태"를 다시 읽어야 하므로 **같은 조인을 가진 두 번째 `findOne`** 을 추가했는데(주석이 "`findById` 와 같은 관계를 싣는다"고 명시), 그 결과 **같은 JOIN 을 실은 SELECT 가 매 PATCH 요청마다 두 번** 실행된다. 첫 번째 호출의 `workflow` 데이터는 완전히 버려지는 낭비다.
  - 제안: 트랜잭션 진입 전 검증에는 `relations` 없는 가벼운 조회(또는 이미 로드된 컬럼만 쓰는 헬퍼)를 쓰고, `workflow` 조인은 응답 구성에 실제로 쓰이는 **락 안의 두 번째 읽기**에만 남긴다. 두 읽기 사이에 트리거가 지워질 수 있어(이미 코드가 `!fresh` 를 처리) 완전한 단일 읽기로 합치기는 어렵지만, 최소한 불필요한 JOIN 중복은 제거할 수 있다.

- **[INFO]** 트리거 config 쓰기 네 자리 모두에 advisory lock 획득용 왕복이 하나씩 추가됐다 — 개별 비용은 낮지만 새로운 직렬화 지점
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`(`acquireTriggerConfigLock` — `SELECT pg_advisory_xact_lock(hashtext($1))`), 호출부는 `triggers.service.ts:539`(`update()` 창 1), `chat-channel-binder.service.ts:266`·`:303`(성공/실패 경로), `triggers.service.ts` 의 `rotateBotToken`(`rewriteTriggerConfigLocked` 내부에서 동일 호출)
  - 상세: 락 쿼리 자체는 가벼운 단일 라운드트립이라 개별 요청 지연에 미치는 영향은 미미하다. 다만 락에 `lock_timeout` 이 없어(`trigger-config-lock.ts:77-87` 주석이 이미 인지) 같은 트리거에 대한 동시 쓰기가 몰리면 각 요청이 커넥션 풀에서 커넥션 하나를 쥔 채 무기한 대기한다 — 순수 정합성 관점(다른 리뷰의 concurrency/database WARNING)과 별개로, **커넥션 풀 고갈 → 그 트리거와 무관한 다른 요청까지 지연되는 용량(capacity) 리스크**다. 임계 구간이 "재읽기+머지+단일 UPDATE/SAVE" 로 짧게 유계돼 있어 정상 상황에서는 문제가 되지 않지만, 한 트리거에 비정상적으로 몰리는 PATCH/rotate 트래픽(예: 클라이언트 재시도 폭주)이 생기면 이 무경계 대기가 커넥션 풀 전체로 전파될 수 있다.
  - 제안: 이미 문서(JSDoc)가 "임계 구간에 외부 호출/긴 계산이 들어가면 `lock_timeout` 을 추가하라"고 예고했으므로 지금 막을 사유는 아니다. 다만 커넥션 풀 크기 대비 "같은 트리거 동시 요청 상한"을 운영 관점에서 한 번 가늠해 두면 좋다(예: rate limit 또는 짧은 `lock_timeout` + 재시도).

- **[INFO]** (긍정적) 웹훅 hot path 가 전체 엔티티 `save()` 에서 컬럼 한정 `update()` 로 바뀌어 오히려 쓰기 비용이 줄었다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:232-236`, `:700-704`
  - 상세: 종전 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);` 는 인입 메시지마다 `config`(JSONB, 잠재적으로 큼)를 포함한 엔티티 전체를 다시 쓰는 구조였다. 이번 변경은 `triggerRepository.update({ id }, { lastTriggeredAt })` 로 좁혀 매 웹훅 호출마다의 쓰기 payload/WAL 양을 줄인다. lost-update 수정을 위해 도입된 변경이지만 부수적으로 가장 빈번한 경로(인입 메시지마다 도는 hot path)의 쓰기 비용을 낮추는 방향이라 성능상 개선으로 본다. 별도 조치 불필요.

- **[INFO]** `rewriteTriggerConfigLocked` 는 매 호출마다 새 `manager.transaction()` 을 여는데, 세 호출부(binder 성공/실패, rotateBotToken) 모두 그 앞에 외부 HTTP 호출(`adapter.setupChannel`/토큰 회전)이 이미 끝난 뒤라 트랜잭션·락 보유 시간 자체는 짧다 — 설계상 문제 없음, 확인 차원의 기록
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:98-135`, 호출부 `chat-channel-binder.service.ts:266-278`(성공)·`:303-314`(실패), `triggers.service.ts` `rotateBotToken` 내 `rewriteTriggerConfigLocked` 호출
  - 상세: 외부 I/O 를 트랜잭션/락 밖에 두는 설계(Cafe24 advisory lock 기각 선례를 학습)가 그대로 지켜지고 있어, 이번 변경이 임계 구간에 블로킹 I/O 를 새로 들이지 않는다는 점을 실제 호출부에서 재확인했다. 조치 불필요.

## 요약

이번 변경의 핵심(트리거 단위 advisory lock + 락 안 재읽기-머지-쓰기)은 임계 구간을 "재읽기+머지+단일 쓰기"로 좁게 유지하고 외부 HTTP 호출을 락 밖에 둔 설계라 성능 회귀 위험이 크지 않다. 웹훅 hot path 를 전체 `save()` 에서 컬럼 한정 `update()` 로 바꾼 것은 가장 빈번한 경로의 쓰기 비용을 줄이는 부수적 개선이다. 다만 `TriggersService.update()` 는 lost-update 수정을 위해 락 안에서 트리거를 다시 읽어야 하는데, 그 재읽기가 트랜잭션 진입 **전** 검증에만 쓰이고 실제로는 소비되지 않는 `relations: ['workflow']` JOIN 을 가진 `findById()` 호출과 완전히 같은 형태로 중복 실행된다 — PATCH 요청마다 불필요한 JOIN 이 한 번 더 도는 구조다. 또한 새로 도입된 advisory lock 은 `lock_timeout` 없이 무기한 대기하므로, 한 트리거에 비정상적으로 몰리는 동시 쓰기가 생기면 커넥션 풀 고갈로 번질 수 있다는 용량 리스크가 있다(다른 reviewer 의 concurrency/database 관점과 겹치되, 여기서는 커넥션 풀 자원 소모 각도로 기록). 둘 다 이번 배치를 막을 정도는 아니고 WARNING/INFO 수준이다.

## 위험도

LOW
