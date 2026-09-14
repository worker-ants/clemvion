# 성능(Performance) Review

## 검토 범위

`trigger.config` lost-update 수정(advisory lock + 락 안 재읽기-머지-쓰기)의 최신 라운드 diff.
실제 런타임 성능에 영향을 주는 파일은 `trigger-config-lock.ts`(신규) · `chat-channel-binder.service.ts` ·
`triggers.service.ts` · `hooks.service.ts` 넷이고, 나머지(테스트·`plan/`·`review/`·repo-guard AST
스캐너)는 빌드/테스트 타임에만 실행되거나 문서라 런타임 hot path 와 무관해 이 관점에서는 검토
대상에서 제외했다.

## 발견사항

- **[INFO]** (해결 확인) 이전 라운드 WARNING — `update()` 의 중복 `relations: ['workflow']` JOIN — 이번 diff 에서 실제로 닫혔다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:467-489`(신규 `findByIdForUpdate`, JOIN 없는 `{ id, workspaceId }` 조회) vs 락 안의 `m.findOne(Trigger, { where: { id: trigger.id, workspaceId }, relations: ['workflow'] })`(update 트랜잭션 콜백 내부)
  - 상세: `review/code/2026/09/14/20_17_16/performance.md` WARNING#1 이 지적한 "PATCH 마다 같은 JOIN 이 두 번 실행되고 첫 번째 결과는 버려진다" 문제를, 이번 라운드는 트랜잭션 진입 전 검증 전용의 `findByIdForUpdate`(관계 없음)를 신설해 닫았다. `findByIdForUpdate` 의 JSDoc 도 이 WARNING 번호를 직접 인용하며 근거를 남겨 뒀다. 락 안의 `findOne` 만 `relations: ['workflow']` 를 실어 응답 구성에 실제로 쓰이므로, 이제 PATCH 요청당 JOIN 이 있는 SELECT 는 한 번뿐이다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** trigger.config 쓰기 경로 전부에 advisory-lock 획득 왕복이 추가돼 PATCH/rotate 요청당 DB 라운드트립 수가 늘었다 (설계상 의도된 비용, 새로운 사실 아님)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`(`acquireTriggerConfigLock`), 호출부 `triggers.service.ts` `update()` 창 1(트랜잭션 콜백 내 `acquireTriggerConfigLock` → `m.findOne` → `m.save`), `chat-channel-binder.service.ts:243-322`(`setupChatChannel` 성공/실패 경로가 각각 `rewriteTriggerConfigLocked` 를 부름 — 내부에서 lock 획득 + `m.findOne` + `m.update`), `triggers.service.ts` `rotateBotToken`(같은 헬퍼)
  - 상세: `chatChannel` 이 실린 PATCH 하나가 이제 (a) `findByIdForUpdate`(검증용, 1회) → (b) 창 1 트랜잭션(lock 획득 + `findOne`+JOIN + `save`, 3회) → (c) `setupChatChannel` 의 `rewriteTriggerConfigLocked`(lock 획득 + `findOne` + `update`, 3회, 별도 트랜잭션) → (d) 응답용 재조회(`findOne`+JOIN, 1회) 순으로 최소 8회의 DB 왕복을 만든다. 종전에는 `findById`(JOIN, 1회) + `save`(1회) + binder 의 단일 `update`(1회) + 재조회(1회)로 4회였다 — 대략 2배다. 임계 구간(재읽기+머지+단일 쓰기)이 짧고 락 자체가 가벼운 쿼리(`hashtext` 해시 + advisory lock)라 개별 요청 지연에 미치는 절대적 영향은 작지만, 트리거 설정 변경은 웹훅 인입만큼 빈번하지 않은 관리 작업이라는 전제 위에서 받아들일 만한 트레이드오프다. 이 비용은 lost-update 를 닫기 위한 구조적 요구(락 안에서 커밋된 최신 상태를 다시 읽어야 함)에서 나오는 것이지 구현 실수가 아니다.
  - 제안: 지금 막을 사유는 아니다. 다만 트리거 설정 변경 API 에 대량 동시 요청(예: 자동화 스크립트의 일괄 PATCH)이 몰리는 경로가 생기면, 이 왕복 수 증가와 아래 lock_timeout 부재가 함께 작용해 지연이 누적될 수 있다는 점을 용량 계획에 반영.

- **[INFO]** (carried, 미해결) advisory lock 에 `lock_timeout` 이 없어 같은 트리거에 대한 비정상적 동시 쓰기가 몰리면 커넥션 풀 고갈로 번질 수 있다 — 기존 라운드에서 이미 지적·문서화·수용된 리스크, 신규 아님
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`(`acquireTriggerConfigLock`, `SET LOCAL lock_timeout` 없음), JSDoc 77-87행("대기에 상한이 없다")이 이 트레이드오프를 스스로 명시
  - 상세: `review/code/2026/09/14/20_17_16/performance.md` INFO 항목과 동일한 리스크다. 이번 라운드에서 `remove()`(삭제)도 같은 락을 잡도록 확장돼(`triggers.service.ts` `remove()` 내 `manager.transaction(async (m) => { acquireTriggerConfigLock(m, id); await m.remove(trigger); })`) 같은 트리거를 두고 경쟁하는 요청 종류가 PATCH·rotate·삭제 셋으로 늘었지만, 삭제는 빈도가 낮아 리스크의 크기 자체를 바꾸지는 않는다. 임계 구간에 외부 호출이 없어 보유 시간이 "DB 왕복 두 번"으로 유계라는 근거가 이 무경계 대기를 감당 가능하게 만든다는 설계 문서의 주장은 코드상 사실과 일치한다(모든 호출부에서 외부 HTTP 는 락 진입 전에 끝나 있음을 확인).
  - 제안: 조치 불요(이미 추적됨, JSDoc 이 향후 임계구간 확장 시 `lock_timeout` 추가를 예고). 재확인 차원의 기록.

- **[INFO]** (긍정적, carried) 웹훅 hot path 가 전체 엔티티 `save()` 에서 컬럼 한정 `update()` 로 바뀌어 가장 빈번한 경로의 쓰기 비용이 줄었다 — 이번 라운드에서 두 호출부가 공유 헬퍼로 통합되며 유지됨
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:975-984`(신규 `touchLastTriggeredAt` — `triggerRepository.update({ id }, { lastTriggeredAt })`), 호출부 `:227`, `:686`
  - 상세: 종전 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);` 는 인입 메시지마다 `config`(JSONB, 잠재적으로 큼)를 포함한 엔티티 전체를 다시 썼다. 이번 라운드는 두 호출부(webhook 즉시 실행 경로 · interaction ack 경로)가 중복 구현하던 것을 `touchLastTriggeredAt` 한 곳으로 합치면서, 컬럼 한정 `update()` 를 그대로 유지했다 — 웹훅마다의 쓰기 payload/WAL 양이 줄어든 상태가 이번 리팩터로도 보존된다. lost-update 방지가 목적이지만 부수적으로 hot path 쓰기 비용을 낮추는 방향이라 성능상 개선으로 평가.
  - 제안: 없음.

- **[INFO]** `rewriteTriggerConfigLocked` 는 호출마다 `manager.transaction()` 을 새로 여는데, 세 호출부(binder 성공/실패, `rotateBotToken`) 모두 외부 HTTP 호출이 이미 끝난 뒤라 트랜잭션·락 보유 시간이 짧다 — 이번 라운드에도 유지, 새로운 위반 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:106-143`, 호출부 `chat-channel-binder.service.ts:266-278`(성공)·`:310-321`(실패), `triggers.service.ts` `rotateBotToken` 내 호출
  - 상세: `chat-channel-binder.service.ts` 를 재확인한 결과 `adapter.setupChannel` 호출(외부 HTTP)이 `try` 블록 안에서 먼저 완료된 뒤에만 `rewriteTriggerConfigLocked` 가 불린다(성공 경로 244→266, 실패 경로도 catch 진입 시점엔 이미 HTTP 시도가 끝나 있음). 임계 구간에 블로킹 I/O 가 들어가지 않는다는 설계 전제가 실제 호출 순서와 일치한다.
  - 제안: 없음 — 확인 목적의 기록.

## 알고리즘/자료구조/캐싱 관점 별도 확인

- 반복문 내 DB 호출(N+1) 패턴 없음 — 모든 쓰기는 단일 트리거 단위(`WHERE id = $1`)이고 배치/목록 처리 코드는 이번 diff 에 없다.
- `mergeExternalConfig`/`stripInlineAuthKeys`/`extractInboundSigningRef` 는 모두 트리거 하나의 작은 JSON 객체(`config`)에 대한 O(1)~O(작은 상수) 스프레드/속성 접근이며, 문자열 누적이나 중첩 루프 없음.
- 캐싱 필요성 없음 — 락 안에서 매번 "커밋된 최신 상태"를 다시 읽는 것이 이 수정의 정합성 요구사항 자체이므로, 여기에 캐시를 두면 이 PR 이 막으려는 lost-update 가 재발한다. 캐시 미도입은 올바른 설계 선택.
- `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 의 AST 워크(`cur = cur.parent` 상향 탐색, `ts.isFunctionLike` 경계 판정)는 빌드/테스트 시점에만 도는 정적 분석 코드라 런타임 성능과 무관 — 별도 검토 생략.

## 요약

이번 라운드는 이전 성능 리뷰(20_17_16)가 지적한 유일한 WARNING(`update()`의 중복 JOIN SELECT)을 `findByIdForUpdate` 신설로 정확히 닫았고, 웹훅 hot path 의 컬럼 한정 `update()` 개선도 두 호출부 통합 리팩터를 거치며 그대로 보존됐다. 새로 도입/확장된 부분(삭제 경로도 같은 advisory lock 을 잡도록 확장)은 반복문·N+1·캐시 부재 같은 신규 성능 결함을 만들지 않았고, 외부 HTTP 호출을 락/트랜잭션 밖에 두는 설계 원칙도 실제 호출 순서로 재확인된다. 남은 항목은 전부 이 PR 의 정합성 요구(락 안에서 재읽기)에서 구조적으로 따라오는, 이미 문서화·수용된 트레이드오프 — PATCH/rotate 요청당 DB 왕복 수 증가(대략 2배)와 `lock_timeout` 부재로 인한 이론적 커넥션 풀 고갈 리스크 — 로, 트리거 설정 변경이 웹훅 인입만큼 빈번하지 않다는 전제 위에서 이번 배치를 막을 사유가 아니다.

## 위험도

LOW
