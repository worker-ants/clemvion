# 성능(Performance) 리뷰 — trigger-config-lost-update

## 발견사항

- **[INFO]** `trigger.config` 쓰기가 단일 `UPDATE` 1왕복에서 트랜잭션+advisory lock+`SELECT`+`UPDATE` 4~5왕복으로 늘었다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:63-96` (`rewriteTriggerConfigLocked` 본문), 호출부 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:256-268`(성공 경로) · `:293-304`(catch 경로), `codebase/backend/src/modules/triggers/triggers.service.ts:1120-1130`(`rotateBotToken`)
  - 상세: 종전에는 `triggerRepository.update(...)` 한 번(1 DB 왕복)으로 끝났던 자리가, 이제 `manager.transaction()` 안에서 `BEGIN` → `pg_advisory_xact_lock(hashtext(...))` → `findOne`(SELECT) → `update` → `COMMIT` 순으로 진행된다. lost-update 방지를 위한 의도된 트레이드오프이고, 문서(JSDoc·plan)도 "외부 HTTP 호출은 락 밖" 설계로 커넥션 점유 시간을 최소화했다고 명시하여 설계 자체는 합리적이다. 다만 이 세 지점(`setupChatChannel` 성공/실패, `rotateBotToken`)은 모두 사용자 PATCH·POST 트리거이고 반복 루프 안에서 호출되지 않으므로 지연 증가는 요청당 고정 비용이며 hot path(웹훅 실제 인입 처리 경로)에는 영향이 없다.
  - 제안: 별도 조치 불필요 — 다만 이 endpoint 들의 P95 레이턴시를 옵저버빌리티에 반영해 두면 향후 회귀 감지에 도움이 된다.

- **[INFO]** 락 안 재읽기가 필요한 컬럼(`config`) 하나만이 아니라 엔티티 전체를 조회한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:75` (`const fresh = await m.findOne(Trigger, { where: { id: triggerId } });`)
  - 상세: `merge` 콜백이 필요로 하는 것은 `fresh.config` 뿐인데 `findOne` 이 `select` 제한 없이 전체 컬럼을 실어 온다. `Trigger` 행 크기가 크지 않아 실질 영향은 미미하지만, JSONB `config` 자체가 커질 수 있는 트리거라면(대형 workflow 참조·notification 설정 등) 불필요한 바이트를 왕복시키는 셈이다.
  - 제안: `select: ['id', 'config']` 로 좁히는 것을 고려할 수 있다(선택 사항, 지금 규모에서는 필수는 아님).

- **[INFO]** `create()` 경로에서 같은 트리거 행을 두 번 다시 읽는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:449-458` (`setupChatChannel` 호출 뒤 `this.triggerRepository.findOne({ where: { id: saved.id, workspaceId } })`)
  - 상세: `setupChatChannel` 내부에서 이미 `rewriteTriggerConfigLocked` 가 락 안에서 한 번 재읽었는데(위 항목), `create()` 는 응답 신선도를 위해 커밋 후 다시 한 번 `findOne` 을 부른다. 두 읽기는 서로 다른 목적(락 안 머지용 vs 응답 직렬화용)이라 하나로 합치기는 어렵고, 이 자체가 새 버그는 아니다 — 다만 이번 변경으로 "같은 요청 안에서 같은 행을 SELECT 하는 횟수"가 1회 늘었다는 점은 기록해 둔다.
  - 제안: 조치 불필요. `rewriteTriggerConfigLocked` 가 `fresh` (머지 후 결과가 아니라 머지 전 스냅샷)를 반환하지 않으므로 지금 구조상 재조회를 없애려면 함수 시그니처를 바꿔야 하고, 그 비용이 왕복 1회 절감보다 크다.

- **[INFO]** advisory lock 이 `exec-cap:*` 과 32비트 해시 공간을 공유한다 — 우연 충돌 시 무관한 트리거끼리 과직렬화될 수 있음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-23` (`TRIGGER_CONFIG_LOCK_PREFIX`, `triggerConfigLockKey`)
  - 상세: `pg_advisory_xact_lock(hashtext(...))` 는 int4 해시라 `trigger-config:<id>` 와 `exec-cap:<workspaceId>` 계열이 같은 32비트 공간을 쓴다. 충돌해도 정확성은 깨지지 않고(과직렬화만 발생) 확률도 낮지만, 순수 성능 관점에서는 드물게 무관한 두 자원이 서로를 기다리게 만드는 잠재 지연 요인이다. 이미 `plan/in-progress/trigger-config-lost-update.md` §D 및 `review/consistency/2026/09/14/17_10_16` naming_collision INFO#8 로 추적 중이라 이 리뷰에서 새 조치를 요구하지 않는다.
  - 제안: 기존 추적 항목 유지로 충분 — 중복 등재 불필요.

- **[INFO]** 신규 e2e 테스트가 최대 20초 동안 50ms 간격으로 DB 폴링한다 (프로덕션 코드 아님)
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:134-148` (`waitForWindowOneCommit`)
  - 상세: 테스트 전용 코드라 상용 성능에는 영향이 없다. CI 실행 시간에 최대 20초 대기 여지가 있으나 정상 케이스에서는 window 1 커밋이 수 ms 내에 관측되므로 실사용 시간은 짧을 것으로 보인다.
  - 제안: 조치 불필요.

## 긍정적으로 평가할 설계 포인트 (참고)

- `rewriteTriggerConfigLocked` 는 외부 provider HTTP 호출(`adapter.setupChannel`)을 advisory lock **밖**에서 끝낸 뒤에만 락을 잡는다. `spec/2-navigation/4-integration.md` 가 "lock 보유 중 HTTP 요청을 트랜잭션에 묶으면 DB 커넥션 점유 시간이 늘어난다"는 이유로 기각한 선례를 정확히 피하는 설계다. 임계 구간이 "읽기+머지+쓰기"로 짧아 커넥션·락 점유 시간이 최소화되어 있다.
- 세 호출부가 같은 lock key(`trigger-config:<id>`)를 공유해 **같은 트리거끼리만** 직렬화하고 다른 트리거는 병렬을 유지한다 — 불필요하게 넓은 락 범위를 잡지 않았다.

## 요약

이번 변경의 핵심은 lost-update 방지를 위해 `trigger.config` 쓰기 3곳(`setupChatChannel` 성공/실패, `rotateBotToken`)에 advisory lock + 락 안 재읽기를 추가한 것이다. 그 대가로 단일 `UPDATE` 왕복이 트랜잭션+락+`SELECT`+`UPDATE` 왕복으로 늘었지만, 대상 경로가 모두 사용자 트리거링 config 변경(생성/PATCH/토큰 회전)이라 반복 루프나 hot path(웹훅 실제 인입 처리)와는 무관하고 호출 빈도도 낮다. 외부 HTTP 호출을 락 밖에 두어 커넥션·락 점유 시간을 최소화한 설계는 이 저장소가 이미 한 번 기각한 대안(Cafe24 토큰 갱신)의 실패 사유를 정확히 피하고 있다. N+1 쿼리, O(n²) 문자열 연산, 불필요한 메모리 적재, 캐싱 누락 등 구조적 성능 결함은 발견되지 않았고, 위에 적은 항목들은 모두 INFO 수준(관측 기록 목적)이며 즉시 조치가 필요한 것은 없다.

## 위험도

LOW
