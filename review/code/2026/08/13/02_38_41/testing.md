# 테스트(Testing) Review — CCH-SE-02 chat-channel dedup

## 검증 절차 (재현)

- `npx jest chat-channel-dedup.service.spec.ts hooks.service.spec.ts` — 2 suites / 59 tests 전부 통과 (회귀 없음, 신규 테스트 포함).
- Mutation 재검증 2건 (plan 의 "6/6 사살" 주장 중 서비스-경계 1건 + 호출부-경계 1건을 독립적으로 재현):
  - `chat-channel-dedup.service.ts` 의 빈 `idempotencyKey` 가드(`if (!idempotencyKey) return true;`) 제거 → `chat-channel-dedup.service.spec.ts` 의 "빈 idempotencyKey" 테스트가 RED (`redis.set` 호출됨을 검출). 킬 확인.
  - `hooks.service.ts` 의 `if (!(await this.chatChannelDedup.claim(...))) { ...; return { executionId: 'ignored' }; }` 를 반환값을 버리는 `await this.chatChannelDedup.claim(...);` 로 치환 → `hooks.service.spec.ts` 의 CCH-SE-02 테스트가 RED (`executionId: 'ignored'` 기대와 `{ executionId: undefined, status: 'pending' }` 실제 불일치). 킬 확인.
  - 두 뮤턴트 모두 `cp` 백업 후 원복, `git diff --stat` 로 클린 상태 재확인.

## 발견사항

- **[WARNING]** 호출부의 "재도착 무시" 로그 라인이 CCH-SE-02 신규 테스트에서 검증되지 않는다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:341-343` (경고 로그 `` `chat-channel update 재도착 무시 (CCH-SE-02, trigger=${trigger.id})` ``) / `codebase/backend/src/modules/hooks/hooks.service.spec.ts:1226-1259` (신규 `it('CCH-SE-02 — 동일 update 재도착은...')` 블록, 프롬프트 게이트 기준 동일).
  - 상세: `chat-channel-dedup.service.spec.ts:71-84` 의 "Redis 에러 → fail-open + warn" 테스트는 서비스 docstring 이 명시한 원칙("로그 한 줄이 사라지는 회귀는 반환값만 봐서는 안 잡힌다")을 그대로 실천해 `warnSpy` 로 `ChatChannelDedupService` 내부 warn 을 단언한다. 그런데 같은 PR 이 `hooks.service.ts` 쪽에 새로 추가한 별도 warn(재도착 무시 알림, 운영 관측용 로그)은 호출부 테스트(`hooks.service.spec.ts:1226-1259`)에서 전혀 단언되지 않는다 — `grep '재도착 무시' hooks.service.spec.ts` 결과 0건. `hooks.service.spec.ts` 자체에 이미 `logger.warn` 내용을 단언하는 선례(예: 960-984번째 줄의 `현재 대기 표면과 맞지 않아 거부됨` 케이스)가 있어, 같은 파일 안에서 방어 하드닝이 일부 warn 에만 적용되고 자매 warn 에는 미적용된 형태다. 이 로그가 조용히 사라져도(예: 리팩터링 중 `this.logger.warn` 줄만 실수로 삭제) 반환값(`{ executionId: 'ignored' }`)과 rate-limit 미소비 단언은 여전히 GREEN 이라 못 잡는다.
  - 제안: 기존 `it` 안에 `jest.spyOn(service['logger'] 또는 (service as unknown as {logger}).logger, 'warn')` 로 `'재도착 무시'` 를 `stringContaining` 단언 한 줄만 추가하면 충분하다(다른 warn 검증 케이스와 동일 패턴 재사용).

- **[INFO]** 생성자의 `RedisConnectionProvider` 폴백 경로가 단위 테스트에서 한 번도 실행되지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39-46` (`this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`) / `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts:23-25` (`makeService` 는 `injectedRedis` 슬롯에만 값을 넣고 `redisConn` 인자는 항상 `undefined`).
  - 상세: 모든 테스트가 `new ChatChannelDedupService(redis as never, undefined)` 또는 `new ChatChannelDedupService(undefined, undefined)` 두 형태만 쓴다. `injectedRedis` 가 없고 `redisConn`(DI 로 실제 주입되는 `RedisConnectionProvider`)만 있는 3번째 분기(`redisConn?.getClientOrNull()` 가 `null` 을 반환하는 경우 포함)는 커버되지 않는다. 이 분기는 실제 프로덕션 DI 경로(테스트에서 직접 안 쓰는 `injectedRedis` 대신 `RedisConnectionProvider` 를 통해 주입되는 경로)이므로, 이론상 `??` 순서가 뒤바뀌거나 `getClientOrNull` 오타가 나도 이 스펙만으로는 못 잡는다. 다만 같은 nullish-coalescing 패턴이 `chat-channel-rate-limiter.service` 등 sibling 서비스에도 있고 그쪽도 통상 단위 테스트로 이 분기를 안 덮는 편이라 이 PR 고유의 결함은 아니다.
  - 제안: `makeService` 에 `redisConn` 목(`{ getClientOrNull: () => redis }`) 을 주입하는 테스트 1개를 추가하면 생성자 3-분기 전체가 닫힌다. 우선순위는 낮음(constructor 배선 오류는 e2e/부팅 단계에서 즉시 드러남).

- **[INFO]** 실제 ioredis 클라이언트를 상대로 한 통합/e2e 테스트가 없다 — `SET key 1 EX 30 NX` 호출은 모킹된 인터페이스로만 검증된다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts` 전체 (모킹 전용), `codebase/backend/test/chat-channel-*.e2e-spec.ts` (CCH-SE-02/dedup 관련 케이스 없음, `grep -rl 'CCH-SE-02\|dedup' test/` 결과 무관 파일 1건만).
  - 상세: 인자 순서(`key, '1', 'EX', 30, 'NX'`)는 같은 모듈의 `channel-conversation.service.ts:142`(`acquireLock`)의 실증 패턴과 동일해 사용법 자체는 신뢰할 만하다. 다만 실 Redis 응답 형태(`'OK'`/`null`)에 대한 가정은 단위 테스트 mock 이 대신할 뿐 e2e 로 재확인되지 않는다. 이 프로젝트의 다른 Redis 기반 서비스(rate-limiter, quota)도 동일하게 e2e 커버리지가 없어 이 PR 만의 결함은 아니며, 신규로 도입된 리스크도 아니다. 참고용 기록.

## 강점 (참고)

- `chat-channel-dedup.service.spec.ts` 는 fail-open(Redis 미주입/에러) · 빈 키 non-dedup · trigger 스코핑까지 경계 케이스를 빠짐없이 개별 `it` 로 분리했고, 각 주석이 "왜 이 값이어야 하는가"(TTL·NX 빠지면 영구 억제/무억제, 빈 키로 뭉치면 무관한 update 가 서로를 지운다)를 설명해 가독성·의도 전달이 좋다.
- 서비스 단위 테스트("억제 판정이 옳다")와 `hooks.service.spec.ts` 호출부 테스트("그 반환값을 실제로 쓴다")를 명시적으로 분리한 설계는 정확히 dead-field 류 회귀(반환값을 계산만 하고 안 쓰는 버그)를 잡는 올바른 레이어링이다. 실제로 반환값을 버리는 뮤턴트를 재현해 RED 확인함(위 검증 절차).
- `hooks.service.spec.ts` 의 mock 기본값(`claim: jest.fn().mockResolvedValue(true)`)이 "최초 도착" 을 기본으로 둬 기존 CCH-NF-03 등 다른 케이스들을 오염시키지 않는다 — `beforeEach` 로 매 테스트 fresh 모듈을 만들어 격리도 확보됨(59개 테스트 전부 통과로 재확인).
- `Logger.prototype.warn` spy 를 `try/finally` 로 복원하는 패턴은 다른 테스트로의 누수를 막는다.

## 요약

신설된 `ChatChannelDedupService` 와 `HooksService` 배선은 서비스 경계·호출부 경계 양쪽에서 핵심 분기(최초 도착/재도착/fail-open 2종/빈 키/trigger 스코프/rate-limit 앞단 차단/쿼터 미소비)를 잘 덮고 있으며, 독립 재현한 2건의 뮤테이션(가드 제거·반환값 폐기)이 모두 킬됨을 확인해 테스트 실효성이 높다. 다만 PR 자신이 명시한 "로그 한 줄 소실은 반환값만으론 못 잡는다" 원칙이 서비스 내부 warn 에는 적용됐지만 호출부(`hooks.service.ts`)의 자매 warn 로그에는 적용되지 않아 WARNING 1건으로 기록한다. 나머지는 생성자 폴백 분기 미검증·실 Redis 통합 테스트 부재로 모두 INFO(기존 관례와 동일해 이 PR 고유 결함 아님).

## 위험도

LOW
