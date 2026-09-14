# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — 이번 배치가 "config 재작성 네 자리 전부를 락으로 닫았다"고 주장하지만, `concurrency` 리뷰어가 같은 `triggers.service.ts` 안에 락 없이 `save(trigger)` 로 엔티티 전체를 되쓰는 5개 함수(`normalizeNotificationSecretRef`·`rotateNotificationSecret`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`)가 여전히 남아 있음을 실측했다. 이 5곳은 이 PR 이 닫으려는 것과 **정확히 같은 클래스**(락 없이 읽은 스냅샷을 통째로 되써 동시 PATCH/웹훅 인입이 커밋한 `chatChannel.inboundSigningRef` 를 되돌림 → 인입 서명 검증 fail-open 재발)의 결함이다. 나머지 13개 관점(security·performance·architecture·requirement·scope·side_effect·maintainability·testing·documentation·dependency·database·api_contract·user_guide_sync)은 LOW 이하로, 이번 배치의 핵심 수정(advisory lock + 락 안 재읽기, 4개 쓰기 창 + 삭제 경로 + 웹훅 hot path)만 놓고 보면 견고하다고 평가했다.

**라우팅 참고**: forced(router_safety) 화이트리스트 7명(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원의 결과가 확보되었다 — forced 미이행 항목 없음. 전체 14개 reviewer 결과가 인라인 전문으로 모두 확보되었으며 "재시도 필요" 항목은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | `trigger.config` lost-update 수정이 "락 안으로 넣은 네 자리 전부"라고 주장하지만, 같은 파일에 락 없이 `save(trigger)` 로 엔티티 전체를 되쓰는 5개 함수가 남아 있어 같은 fail-open 결함이 다른 진입점으로 재현될 수 있다 | `codebase/backend/src/modules/triggers/triggers.service.ts:827`(`normalizeNotificationSecretRef`), `:1037`(`rotateNotificationSecret`), `:1085`(`revokePerTriggerToken`, `config.interaction` 직접 변경), `:1308,1339`(`promoteRotatedNotificationSecrets`, 시간당 cron), `:1390`(`cleanupRotatedChatChannelTokens`, 시간당 cron) | 5곳 모두 같은 규율로 닫는다 — `config` 를 바꾸는 자리(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·두 cron)는 `rewriteTriggerConfigLocked` 로, `config` 를 안 바꾸는 자리(`rotateNotificationSecret`)는 `touchLastTriggeredAt` 처럼 컬럼 한정 `update()` 로 전환. CHANGELOG/JSDoc 의 "네 자리 전부" 서술도 정정하고 잔여 5곳을 후속으로 명시 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | `rotateBotToken` 의 `chatChannel` 병합이 락 안에서 재읽은 `freshConfig.chatChannel` 을 필드 단위로 병합하지 않고, 락 이전 스냅샷 기반 `mergedChannel` 로 통째로 교체한다 — `botTokenRef`/`inboundSigningRef` 는 항상 강제로 다시 실어 fail-open 재발은 아니지만, 그 외 필드를 동시 PATCH 가 바꿨다면 조용히 유실된다 | `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken` 내 `mergedChannel` 구성부(~1192,1211-1216)와 `rewriteTriggerConfigLocked` 호출(~1236-1246) | `chat-channel-binder.service.ts` 의 `buildChannel(freshConfig, setupResult)` 처럼 `freshConfig.chatChannel` 을 베이스로 필요한 필드만 덮어쓰는 형태로 변경 |
| 2 | performance | advisory lock 대기에 상한이 없는 3개 경로(`update()`/`rotateBotToken`/binder)가 기본 커넥션 풀(10)과 결합해, 같은 트리거를 겨눈 동시 요청 폭주가 인스턴스 전체의 DB 커넥션 풀을 고갈시켜 무관한 워크스페이스/트리거 요청까지 정체시킬 수 있다 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39`(`acquireTriggerConfigLock`, timeoutMs 미지정 시 무한 대기), `triggers.service.ts:588,1236`, `chat-channel-binder.service.ts:266,310`; 풀 크기: `codebase/backend/src/common/config/database.config.ts:14`(기본 10) | `remove()` 처럼 `update()`/`rotateBotToken`/binder 경로에도 짧은 `lock_timeout` 기본값을 걸거나, 같은 트리거에 대한 동시 PATCH 를 애플리케이션 레벨에서 rate-limit/직렬화. 최소한 부하 테스트로 "poolMax 개수만큼 동시 PATCH 시 다른 트리거 조회가 타임아웃되지 않는다"를 회귀 캐너리로 고정 |
| 3 | testing | `remove()` 실패 시 "로그로 남긴다"(CHANGELOG·JSDoc 명시 설계 목표)의 `logger.error` 호출이 어떤 테스트로도 관측되지 않는다 — 그 호출을 지워도 기존 테스트는 GREEN | `codebase/backend/src/modules/triggers/triggers.service.ts:984-991`(`.catch` 의 `logger.error`), 대응 테스트 `triggers.service.spec.ts:3929-3948`(`throw`/감사 미기록만 단언) | 해당 테스트에 `jest.spyOn(Logger.prototype, 'error')` 추가(`rotateBotToken` 502 테스트의 `warn` spy 패턴 재사용), 메시지에 trigger id 포함 여부까지 단언 |
| 4 | architecture | production 코드가 트랜잭션 경로(`update()`/`remove()`)를 새로 타게 되면서, 같은 `Trigger` repository 를 mock 하는 6개 스펙 파일 중 4개(`auth-configs`·`external-interaction`·`hooks`·`schedules`)는 아직 `withTransactionMock` 을 쓰지 않아 "그 경로를 타는 순간 런타임 크래시"라는 암묵적 계약이 타입체크로 보장되지 않는다 | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:34-47`(JSDoc이 이 결합을 스스로 서술) | 6개 파일 전체가 공용 팩토리(`withTransactionMock`)를 기본으로 쓰도록 통일 — 최소한 나머지 4개 파일에도 예방적으로 적용 |
| 5 | maintainability | 테스트 헬퍼 안에서 `at()` 검색 로직과 동일한 술어가 그 앞에 인라인으로 한 번 더 반복된다 — 2라운드 연속 지적됐음에도 코드도 안 바뀌었고 plan 후속 표에도 등재되지 않아 재발견 위험이 있음 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3710-3721`(`ChannelListenerRegistry` 교체가 `at()` 정의 이전에 같은 술어를 인라인 중복) | `const at = ...` 선언을 위로 올려 세 provider 교체(`ChannelListenerRegistry`/`ChannelAdapterRegistry`/`SecretResolverService`) 모두 통일. 계속 유예할 것이면 최소 plan 후속 표에 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `SET LOCAL lock_timeout` 이 문자열 보간으로 구성되나 `Math.trunc()` 강제 변환 + 호출부가 모듈 상수만 넘겨 실질적 인젝션 경로 없음 | `trigger-config-lock.ts:56-58` | `SELECT set_config('lock_timeout', $1, true)` 형태로 파라미터 바인딩 전환 검토(방어적, 시급하지 않음) |
| 2 | security/database | 락 안 재조회가 `workspaceId` 없이 PK 단독 필터링 — 호출부가 이미 인가된 동일 id 만 넘겨 실질 위험 없음 | `trigger-config-lock.ts:151` | 향후 제네릭화 시 스코프 필드 있는 엔티티는 `where` 에 포함 |
| 3 | performance | `chatChannel` 포함 PATCH 한 번이 같은 트리거에 대해 advisory lock 을 두 번(별도 트랜잭션) 획득 | `triggers.service.ts:588` ↔ `chat-channel-binder.service.ts:266` | 외부 호출 배제 제약상 구조적 통합 어려움 — lock_timeout 도입 시 두 락 모두 일관 적용 |
| 4 | performance | advisory lock 키가 32-bit 해시(`hashtext`) 공간 공유 — 저확률 충돌 시 무관한 트리거끼리 불필요 직렬화 | `trigger-config-lock.ts:18,25,60` | 현재 규모에서 조치 불요, 트리거 수 급증 로드맵 시 재검토 |
| 5 | architecture | `Trigger.config` 쓰기에 락/재조회 관용구가 세 가지(창1 인라인 save, 창2~4 공유 헬퍼, 삭제 인라인 remove)로 공존 | `triggers.service.ts:588-637,977-991`, `trigger-config-lock.ts:136-173` | 후속 제네릭화(`rewriteTriggerConfigLocked<T>`) 검토 시 `remove()` 변형도 함께 흡수 |
| 6 | architecture | `rewriteTriggerConfigLocked` 가 여전히 `Trigger` 엔티티에 하드코딩(기존 지적 재확인) | `trigger-config-lock.ts:151,170` | plan §D 후속 표에 이미 등재, 조치 불요 |
| 7 | architecture | 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)의 콜백 경계 탐색이 "한 겹"을 전제 — 향후 중첩 증가 시 재발 가능 | `endpoint-path-conflict-wrap-guard.ts:108-121` | JSDoc 에 "몇 겹까지 지원" 명시 권고 |
| 8 | side_effect | `save()`→`update()` 전환이 TypeORM lifecycle 훅(`@BeforeUpdate`/`@AfterUpdate`)을 우회 — 현재 `Trigger` 에 훅 0건이라 관측 가능한 영향 없음 | `hooks.service.ts:973-980`, `trigger-config-lock.ts:170` | 향후 `Trigger` 에 lifecycle 훅 추가 시 이 이원 구조(일부 save/일부 update)를 영향 분석에 포함 |
| 9 | maintainability | `trigger-config-lock.spec.ts` 의 `makeManager` 위에 JSDoc 두 블록이 병합 없이 나란히 존재 | `trigger-config-lock.spec.ts:27-32` | 하나의 JSDoc 으로 병합(가독성) |
| 10 | maintainability | `TriggersService.update()` 가 182줄 다책임 메서드로 유지(트랜잭션 콜백 포함) — plan 후속 표에 등재된 의도적 유예 | `triggers.service.ts:507-688` | 다음 실질 편집 시 `mergeAndSaveLocked` 로 분리(이미 계획됨) |
| 11 | maintainability | `previousInboundSigningRef` 가 메서드 스코프 `let` 으로 클로저 경계를 셋 넘어 전달 — plan 후속 표에 등재된 의도적 유예 | `triggers.service.ts:553,602-603,671` | 트랜잭션 콜백 반환값으로 단방향화(급하지 않음, 이미 등재) |
| 12 | testing/database | DELETE 경로의 실제 Postgres lock-timeout(`55P03`) 계약이 e2e 로 재현되지 않음(unit mock 만 검증) | `trigger-config-lost-update.e2e-spec.ts` 전체 vs `triggers.service.spec.ts:3853-3874` | 여유 있으면 락 보유 중 DELETE 요청 → 상한 내 에러 e2e 추가 |
| 13 | dependency | 새 외부 의존성 없음 — 매니페스트/락파일 변경 0건, 신규 import 전부 기존 고정 버전 패키지 재사용 | 저장소 루트 매니페스트 (diff 미포함) | 조치 불요 |
| 14 | dependency | 트랜잭션 mock 헬퍼를 아직 안 쓰는 4개 Trigger repo mock 파일 — architecture WARNING#3 와 동일 관찰(내부 의존 결합 관점) | `trigger-transaction-mock.ts` JSDoc | architecture WARNING#3 조치와 동일 |
| 15 | api_contract | DELETE 락 타임아웃(57014) 시 일반 500 `INTERNAL_ERROR` 로 마스킹되는 좁은 엣지 케이스 — 이전 라운드 수용됨, 이번 델타로 악화 없음 | `http-exception.filter.ts` (일반 Error 분기) | 조치 불요(이미 수용) |
| 16 | scope | 웹훅 hot path(`hooks.service.ts`)·정적 가드 3파일·헬퍼 추출 3건이 원 스코프(트리거 PATCH 경합) 밖 모듈까지 확장 — 단, 같은 root cause 이거나 핵심 수정이 유발한 필연적 파급으로 CHANGELOG/plan 에 근거 명시됨 | `hooks.service.ts`, `endpoint-path-conflict-wrap-guard.ts` 등 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | CRITICAL | 락으로 안 닫힌 5개 `save(trigger)` 잔여 자리(같은 fail-open 클래스), `rotateBotToken` 필드 단위 미병합 |
| performance | MEDIUM | 무제한 락 대기 + 작은 커넥션 풀 → 자원 고갈 벡터 |
| security | LOW | fail-open 자체는 닫힘 확인. lock_timeout 문자열 보간·재조회 workspaceId 미필터는 실질 위험 낮음 |
| architecture | LOW | 락/쓰기 관용구 3종 공존, 트랜잭션-mock 암묵 계약 4파일 미반영 |
| requirement | LOW | 새 CRITICAL/WARNING 없음, 이전 라운드 지적 전부 해소 확인 |
| side_effect | LOW | lifecycle 훅 우회 특성(현재 영향 없음) 외 신규 부작용 없음 |
| maintainability | LOW | 테스트 헬퍼 중복(WARNING), 이중 JSDoc(INFO), 기존 유예 항목 재확인 |
| testing | LOW | `remove()` 로깅 보증 미검증(WARNING), DELETE lock-timeout e2e 부재(INFO) |
| database | LOW | 이전 WARNING(감사 미기록 테스트 부재) 해소 확인, 신규 위험 없음 |
| documentation | NONE | 이전 WARNING 2건 모두 해소 확인, 문서-코드 일치 |
| dependency | NONE | 신규 외부 의존성 없음 |
| scope | NONE | 스코프 확장 전부 근거 문서화됨 |
| api_contract | NONE | 컨트롤러/DTO/라우트 diff 0건 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 매칭 없음 |

## 발견 없는 에이전트

documentation, dependency, scope, api_contract, user_guide_sync — 실질 CRITICAL/WARNING 발견 없음(INFO 참고 사항만 존재, 위 표에 포함).

## 권장 조치사항

1. **(최우선, CRITICAL)** `triggers.service.ts` 의 5개 잔여 무보호 `save(trigger)` 자리(`normalizeNotificationSecretRef`·`rotateNotificationSecret`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`)에 advisory lock + 락 안 재읽기(또는 컬럼 한정 `update()`)를 적용해 이 PR 이 닫으려는 fail-open 결함 클래스를 완전히 봉쇄한다. CHANGELOG/JSDoc 의 "네 자리 전부" 서술도 함께 정정한다.
2. `rotateBotToken` 의 `chatChannel` 병합을 `buildChannel` 패턴처럼 필드 단위 병합으로 전환해 동시 PATCH 가 바꾼 부가 필드 유실을 막는다.
3. `update()`/`rotateBotToken`/binder 경로에 짧은 `lock_timeout` 을 도입하거나 동시 PATCH 를 rate-limit 해 커넥션 풀 고갈 벡터를 차단한다.
4. `remove()` 의 `logger.error` 호출을 spy 로 검증하는 테스트를 추가한다.
5. 나머지 4개 Trigger repo mock 스펙 파일에 `withTransactionMock` 을 예방적으로 적용한다.
6. 테스트 헬퍼의 `at()` 인라인 중복(maintainability WARNING#5)을 정리하거나 최소한 plan 후속 표에 등재한다.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 미이행 없음.
- **제외**: 없음(0명).