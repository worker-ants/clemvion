# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. `database` reviewer 가 신규 WARNING(스케줄 삭제 경로가 이번 PR 의 advisory lock 밖에서 트리거 행을 지워 같은 클래스의 삭제-경합이 재발할 수 있음)을 제시해 MEDIUM. 14개 reviewer(강제 포함 7개 전원 포함) 결과 전문을 모두 확보했으며 누락·미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | database | `SchedulesService.remove()` 가 트리거 행을 이 PR 의 advisory lock 없이 맨 `repository.delete()` 로 지운다. `TriggersService.remove()`/`update()`(창 1) 는 이번 PR 로 advisory lock 을 잡지만, 이 두 번째 삭제 경로는 참여하지 않아 "읽었을 땐 있었는데 저장 직전 삭제됨" 경합(`save(entity)`의 INSERT-on-missing 특성으로 고아 트리거가 되살아날 수 있음)이 남는다. 스케줄 타입 트리거는 `chatChannel` 을 가질 수 없어 보안 결함(fail-open) 자체는 재발하지 않지만 데이터 정합성 문제이며, CHANGELOG/plan 의 "닫은 자리" 전수 열거에서 누락됨 | `codebase/backend/src/modules/schedules/schedules.service.ts:296` | `acquireTriggerConfigLock(m, schedule.triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 로 감싸거나 `TriggersService.remove()` 를 호출해 teardown·락 로직을 일원화 |
| 2 | performance | cron 승격 스윕(`promoteRotatedNotificationSecrets`)이 반복문 안에서 행마다 새 `manager.transaction()`(advisory lock 포함)을 열어, 종전 1왕복(`save`)이던 것이 행당 4~5배(BEGIN→lock→재읽기→UPDATE→COMMIT) 로 늘었다. 후보 수 상한이 코드에 없어 회전 대상이 몰리면 cron 소요 시간이 선형 이상으로 증가 | `codebase/backend/src/modules/triggers/triggers.service.ts:1385-1450` | 후보 규모 실측(로그/메트릭). 유의미하게 커질 수 있다면 서로 다른 `trigger.id` 는 락 키가 겹치지 않으므로 `Promise.all`(concurrency cap 포함)로 행 간 병렬화 검토 |
| 3 | architecture | "락 안 재읽기 후 서브키에 델타를 병합한다"는 재사용 가능한 프리미티브(`mergeIntoFreshSubKey`)가 `TriggersService` 의 **private** 메서드에 갇혀 클래스 경계를 못 넘는다. `ChatChannelBinderService` 는 같은 문제(재읽은 `chatChannel` 위에 델타 얹기)를 풀어야 했는데 재사용하지 못하고 `survivesWithFresh`/`buildChannel` 이라는 별도 구현을 새로 만들어, 같은 개념이 두 파일에 다른 API 로 흩어졌다 | `triggers.service.ts:380`(정의) / `chat-channel-binder.service.ts:209,226`(별도 구현) | `mergeIntoFreshSubKey` 를 `trigger-config-lock.ts` 로 옮겨 `rewriteTriggerConfigLocked` 와 나란히 export — "컨테이너 재작성"과 "서브키 델타 병합"을 한 모듈에 정본화 |
| 4 | documentation | `rewriteTriggerConfigLocked` JSDoc 의 부재-처리 표가, 이 함수를 **전혀 호출하지 않는** `cleanupRotatedChatChannelTokens`(컬럼만 직접 `update()`, config 미접촉, 락/재읽기/skip 분기 없음)를 마치 이 함수의 호출부인 것처럼 "cron 두 곳" 으로 `promoteRotatedNotificationSecrets` 와 함께 묶었다. 같은 JSDoc 블록의 규칙(":83 — config 재작성 자리는 창1 빼고 전부 이 함수를 지난다")과 표(":139")가 서로 다른 집합을 가리키는 내적 모순 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:139` (대비 `:83`) | 표에서 `cleanup…` 을 제거하거나, 넣으려면 "이 함수를 거치지 않고 컬럼만 직접 갱신하며 삭제 경합에도 무조건 `cleaned++`함(별도 결함 아님)"으로 다른 범주임을 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency (8·9라운드 기존 수용) | 창 1(`update()`)의 전체-행 `save()`가 advisory lock 도메인 밖의 컬럼-한정 writer(`rotateNotificationSecret`·`cleanupRotatedChatChannelTokens`·`SchedulesService.update()`)의 커밋을 좁은 창에서 되돌릴 수 있다 — 이 PR 이 `config`에 대해 닫은 것과 같은 lost-update 메커니즘이 일부 컬럼에 남음. 이미 plan 에 "이 PR 로 넓히지 않는다"로 등재·수용됨 | `triggers.service.ts:621-671` vs `:1087-1093`, `:1500-1503`, `schedules.service.ts:241-246` | 후속 PR 에서 세 writer 도 락 도메인에 편입하거나 조건부 UPDATE 로 좁히기 검토 |
| 2 | performance / database | advisory lock 키(32비트 해시)가 `exec-cap:*` 네임스페이스와 공유돼 우연 충돌 시 무관한 쓰기끼리 과직렬화(정확성 훼손 아님). 이미 consistency 리뷰에서 planner 항목으로 수용됨 | `trigger-config-lock.ts:1-18` | 여유 시 `pg_advisory_xact_lock(key1, key2)` 2-int 오버로드로 네임스페이스 분리 |
| 3 | performance / concurrency | 삭제 경로를 제외한 모든 advisory lock 대기가 무제한이라, 특정 트리거에 쓰기가 몰리면 DB 커넥션이 대기 상태로 오래 점유돼 커넥션 풀 소모로 이어질 수 있음(이미 8라운드 등재) | `trigger-config-lock.ts:39-63` | 커넥션 풀 크기 대비 예상 동시 PATCH 트래픽 가늠, 필요시 `lock_timeout` 확대 적용 |
| 4 | testing | `mergeIntoFreshSubKey` 의 `fallback` 분기가 4개 호출부 중 `revokePerTriggerToken` 1곳에서만 discriminating 테스트로 커버됨 — 헬퍼 자체 뮤턴트는 잡지만 호출부별 배선(예: `rotateBotToken`/`promoteRotatedNotificationSecrets`)은 검증 안 됨 | `triggers.service.ts:380-392`(헬퍼), 호출부 `:869-874,1149-1154,1321-1330,1442-1447` | 나머지 3개 호출부에도 "재읽은 행에 하위 키 없음" 판별 fixture 1개씩 추가 |
| 5 | testing | e2e 진단용 단언(`blockedBeforeRelease`)이 고정 300ms sleep 후 단발 관측이라 CI 환경 편차에 취약할 수 있음(핵심 회귀 단언 ①②③은 advisory lock 을 테스트가 직접 쥐고 있어 결정적) | `trigger-config-lost-update.e2e-spec.ts:183-191,230-231` | 실패가 관측되면 고정 sleep 대신 `pg_stat_activity` 폴링으로 대체 검토 |
| 6 | architecture | `extractInboundSigningRef`(영속 상태 접근자)가 "입력 검증" 전용 모듈에 위치해 이름-용도 불일치 | `chat-channel-input-rules.ts:239-250` | 파일 분리 또는 상단 개요에 "입력 검증 + 영속 상태 접근자 혼재" 명시 |
| 7 | architecture / maintainability | `TriggersService` 가 트랜잭션/락 오케스트레이션까지 흡수해 God-service 경향 심화(`update()` ~180줄) — 과거 헬퍼 통합 시도가 6개 테스트를 깨뜨린 이력이 있어 즉흥적 결정은 아님 | `triggers.service.ts:606-670`(update), `:993-1039`(remove) | 다음 편집 기회에 트랜잭션 클로저를 `mergeAndSaveLocked(...)` 로 분리(plan 에 이미 등재) |
| 8 | architecture / dependency | 트리거 repo 트랜잭션 mock(`withTransactionMock`)이 트리거 repo mock 을 가진 6개 spec 파일 중 2개에만 적용됨. 나머지 4개(`auth-configs`·`external-interaction`·`hooks`·`schedules`)는 향후 `manager.transaction` 경로를 타는 순간 동일하게 깨질 수 있음(JSDoc 으로 이미 문서화된 알려진 채무) | `trigger-transaction-mock.ts:34-47` | 즉시 조치 불요 — `manager.transaction` 신규 도입 자리마다 이 헬퍼 우선 확인 |
| 9 | security | `rewriteTriggerConfigLocked` 의 락 안 재조회가 `workspaceId` 로 스코프되지 않음. 현재 4개 호출부 모두 사전에 워크스페이스 소유권을 검증한 뒤라 실질 인가 우회는 없으나, 향후 재사용 시 구조적으로 막는 장치가 없음 | `trigger-config-lock.ts` `rewriteTriggerConfigLocked` | JSDoc 에 전제 명시 또는 선택적 `workspaceId` 파라미터 추가 |
| 10 | security / database | `SET LOCAL lock_timeout` 이 파라미터 바인딩 불가로 문자열 보간되나, `Math.trunc()` 강제 변환 + 유일한 호출부가 모듈 상수만 전달해 인젝션 경로 없음 | `trigger-config-lock.ts:56-58` | 여유 시 `Number.isFinite` 가드 추가로 향후 호출부 확장 시 의도를 코드로 명시 |
| 11 | api_contract (이월) | `chatChannel` PATCH 의 극히 좁은 삭제-경합 창에서 200 + 이미 삭제된 리소스의 스냅샷 바디 반환 가능(뒤이은 GET 은 404 로 최종 일관); `DELETE` 의 5초 lock-timeout 초과가 기존 일반 500 마스킹 관례와 구분 불가 | `chat-channel-binder.service.ts` `setupChatChannel()`, `trigger-config-lock.ts` `TRIGGER_DELETE_LOCK_TIMEOUT_MS` | 다음에 이 표면을 손댈 때 재검토, 필요시 `55P03` → 409 매핑 |
| 12 | dependency | `QueryDeepPartialEntity` 를 typeorm 공개 배럴이 아닌 내부 서브패스에서 import — 이 저장소에 이미 2곳(workflows, integrations) 선례가 있어 신규 리스크는 아님 | `trigger-config-lock.ts:2` | typeorm major 업그레이드 시 이 3곳을 체크리스트에 포함 |
| 13 | database | cron 스윕(`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)이 페이지네이션 없이 후보 전량을 `.getMany()` 로 로드 — 이 PR 이전부터 있던 구조이며 plan 후속 백로그에 이미 등재 | `triggers.service.ts:1373-1420,1464-` | 대상 테이블 성장 시 `.take(N)` 배치 처리 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | rewriteTriggerConfigLocked workspaceId 미스코프(INFO), lock_timeout 문자열 보간(INFO). 핵심 수정 자체가 실재 보안 결함(fail-open) 을 닫음 |
| performance | LOW | cron 승격 스윕 행당 DB 왕복 4~5배 증가(WARNING). 웹훅 인입 hot path 는 오히려 가벼워짐 |
| architecture | LOW | mergeIntoFreshSubKey 가 private 라 ChatChannelBinderService 가 재사용 못 함(WARNING). 전반적으로 응집도 개선 방향 |
| requirement | NONE | CRITICAL/WARNING 없음. fallback 분기·부재 처리·spec ID 인용 모두 실측 확인 |
| scope | NONE | 직전 라운드 이후 유일한 커밋이 그 라운드 Warning 2건만 정확히 처리. scope creep 없음 |
| side_effect | LOW | 직전 라운드 CRITICAL(rotateBotToken 전체 스냅샷 되돌림)이 실제로 수정됨을 재확인. 신규 부작용 없음 |
| maintainability | LOW | 이번 diff(3파일)는 전부 개선 방향. 잔여 INFO 4건은 diff 범위 밖 기존 코드 |
| testing | LOW | fallback 분기 커버리지 4곳 중 1곳(INFO), e2e 진단 단언 타이밍 취약(INFO). discriminating fixture 규율은 전반적으로 잘 지켜짐 |
| documentation | LOW | rewriteTriggerConfigLocked JSDoc 표가 cleanup cron 을 잘못 포함(WARNING). 그 외 문서화 수준 이례적으로 높음 |
| dependency | NONE | package.json/lockfile 변경 0건. 신규 import 전부 기존 의존성 |
| database | **MEDIUM** | SchedulesService.remove() 가 advisory lock 밖에서 트리거 삭제 — 같은 클래스 삭제-경합 재발 가능(WARNING) |
| concurrency | LOW | 데드락 가능 조합 없음. 창1 전체-행 save 의 컬럼 되돌림 리스크는 이미 8·9라운드 수용·추적됨(INFO) |
| api_contract | LOW | 이번 라운드 신규 커밋은 API 표면 영향 없음(diff 0줄). 이월 INFO 2건만 잔존 |
| user_guide_sync | NONE | 매트릭스 22개 trigger 전부 매칭 없음 — 순수 백엔드 동시성 수정 |

## 발견 없는 에이전트

requirement, scope, dependency, user_guide_sync — CRITICAL/WARNING 없이 NONE 위험도로 종결(참고용 INFO/확인 기록만 존재).

## 권장 조치사항
1. `SchedulesService.remove()` 의 트리거 삭제를 `acquireTriggerConfigLock`(또는 `TriggersService.remove()` 위임)으로 감싸 이 PR 이 다른 모든 자리에서 닫은 것과 같은 삭제-경합 클래스를 이 경로에서도 닫는다 (database WARNING).
2. `trigger-config-lock.ts` JSDoc 의 부재-처리 표에서 `cleanupRotatedChatChannelTokens` 를 호출부 목록에서 제거하거나 별도 범주로 명시해 규칙(:83)과 표(:139)의 내적 모순을 해소한다 (documentation WARNING).
3. `mergeIntoFreshSubKey` 를 `trigger-config-lock.ts` 로 이동해 `rewriteTriggerConfigLocked` 와 함께 export, `ChatChannelBinderService` 를 포함한 미래 소비자가 재사용할 수 있게 한다 (architecture WARNING).
4. cron 승격 스윕(`promoteRotatedNotificationSecrets`)의 후보 규모를 실측하고, 필요 시 트리거 단위 병렬화를 검토한다 (performance WARNING).
5. (선택) `mergeIntoFreshSubKey` fallback 분기를 나머지 3개 호출부에도 discriminating fixture 로 커버해, 향후 리팩터가 헬퍼 호출을 인라인으로 바꿔도 보호가 유지되게 한다 (testing INFO).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재, prompt 에 별도 `routing_skip_reason` 없음). 전체 14개 reviewer 실행됨.
- **강제 포함(router_safety) 화이트리스트**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — prompt 기준 **전원 결과 확보됨**(누락·미이행 없음). 강제 리스트 미이행으로 인한 은폐된 위험 없음.
- **실행**: 전체 14명 — `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`
- **제외**: 없음 (0명)

| 제외된 reviewer | 이유 |
|------------------|------|
| (해당 없음) | — |