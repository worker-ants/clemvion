# 테스트(Testing) 리뷰

## 발견사항

### [INFO] ChatChannelRateLimiterService 단위 테스트 — 커버리지 양호
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.spec.ts`
- 상세: 9개 케이스가 핵심 경로를 충실히 커버한다. count < limit (true), count === limit (경계, true), count > limit (false), limit clamp (0/음수), Redis null (fail-open), exec null (fail-open), exec 빈 배열 (fail-open), INCR 결과 에러 (fail-open), exec reject (fail-open). 경계값·fail-open 시나리오를 모두 개별 케이스로 분리한 점이 좋다.
- 제안: 없음.

### [INFO] makeRedis 팩토리 패턴 — 테스트 격리 양호
- 위치: `chat-channel-rate-limiter.service.spec.ts` lines 18-24
- 상세: 각 it() 가 독립된 mock 인스턴스를 생성하는 팩토리 패턴을 사용해 테스트 간 상태 공유가 없다. beforeEach 없이도 격리가 보장된다.
- 제안: 없음.

### [WARNING] limit clamp 상한(600) 테스트 누락
- 위치: `chat-channel-rate-limiter.service.spec.ts` — `limit clamp` 케이스 (line 49-54)
- 상세: 하한(0/음수 → 1)은 테스트하나 상한(600 초과 → 600) 클램프는 테스트가 없다. `consume(TRIGGER_ID, CHAT, 601)` 시 내부 limit 이 600 으로 보정되는 것을 검증하지 않는다. 구현의 `Math.min(600, ...)` 경로가 테스트되지 않아 해당 부분이 제거돼도 테스트가 통과한다.
- 제안: `it('limit clamp — 600 초과 → 최대 600 으로 보정', ...)` 케이스 추가. count=600 결과 + limit=601 입력 → true 를 확인.

### [WARNING] pipeline.incr / pipeline.expire 호출 순서·체이닝 검증 부재
- 위치: `chat-channel-rate-limiter.service.spec.ts` lines 26-35
- 상세: 첫 번째 케이스에서 `incr`과 `expire`가 각각 올바른 인자로 호출됐음은 검증하나, 두 명령이 **동일 pipeline 인스턴스에서 exec 전에** 호출됐는지는 검증하지 않는다. `makeRedis`에서 `pipeline` mock 이 반환값이지만 `pipeline` 자체가 몇 번 호출됐는지, incr/expire 가 exec **이전에** 호출됐는지의 순서는 assert 하지 않는다. 이는 pipeline 분리(두 번 pipeline() 호출 등)로 원자성 설계가 깨져도 테스트가 통과함을 의미한다.
- 제안: `expect(pipeline).toHaveBeenCalledTimes(1)` 및 호출 순서(incr → expire → exec) 검증을 추가하거나, jest.fn()의 `mock.invocationCallOrder`를 활용해 exec 이전에 incr·expire 가 선행했음을 확인한다.

### [INFO] HooksService rate-limit 통합 테스트 — 4가지 핵심 시나리오 커버
- 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` lines 631-724
- 상세: (1) 초과 시 execute·interact 미호출 + degraded 갱신, (2) 이미 degraded 시 update 미호출, (3) DB 실패 시 throw 없이 ignored 반환, (4) 이내 시 정상 처리 + consume 인자 검증. 4케이스가 spec R-CC-19 의 핵심 계약을 커버한다.
- 제안: 없음.

### [WARNING] consume 인자 — config.rateLimitPerMinute override 경로 미테스트
- 위치: `hooks.service.spec.ts` — CCH-NF-03 rate-limit 이내 케이스 (lines 701-724)
- 상세: `config.rateLimitPerMinute` 가 기본값(null/undefined)인 경우만 테스트한다(`expect consume(..., 60)`). `config.rateLimitPerMinute = 30` 처럼 커스텀 값이 설정된 경우 consume 이 그 값을 전달하는지 검증하지 않는다. `hooks.service.ts` 의 `config.rateLimitPerMinute ?? CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 분기 중 왼쪽 피연산자(`??` 왼쪽)는 테스트가 없다.
- 제안: `it('CCH-NF-03 — config.rateLimitPerMinute 커스텀 값이 consume 에 전달됨', ...)` 케이스를 추가해 `chatChannelTrigger` 에 `config.rateLimitPerMinute: 30` 설정 후 `consume(..., 30)` 호출을 assert 한다.

### [INFO] 모듈 프로바이더 mock 추가 — 기존 테스트 회귀 없음
- 위치: `hooks.service.spec.ts` lines 79-83, 38-43
- 상세: `ChatChannelRateLimiterService` mock (기본 `consume → true`)과 `triggerRepo.update` mock 이 `beforeEach` providers 에 추가됐다. 기존 테스트들은 `consume` 이 항상 `true` 를 반환하므로 rate-limit 분기에 진입하지 않아 기존 케이스의 회귀 없음이 보장된다.
- 제안: 없음.

### [INFO] 테스트 가독성 — 스펙 ID 명시 및 한국어 설명
- 위치: 전 spec 파일
- 상세: `CCH-NF-03`, `R-CC-19` 같은 spec ID 가 it() 설명에 포함돼 테스트 실패 시 어느 요구사항이 깨졌는지 즉시 파악 가능하다. 의도 전달이 명확하다.
- 제안: 없음.

### [INFO] 테스트 용이성 — 의존성 주입 설계 우수
- 위치: `chat-channel-rate-limiter.service.ts` constructor
- 상세: `@Optional() @Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')` 로 Redis 를 선택적으로 주입받아 `new ChatChannelRateLimiterService(mockRedis)` 가 가능하다. NestJS DI 프레임워크 없이도 단위 테스트가 가능한 구조다. `makeRedis` 팩토리와 결합해 격리된 테스트 작성이 매우 쉽다.
- 제안: 없음.

### [WARNING] `markChatChannelRateLimited` — `warn` 로그 호출 미검증
- 위치: `hooks.service.spec.ts` — `rate-limit 초과 + degraded 갱신 DB 실패해도 throw 없이 ignored 반환` 케이스 (lines 683-699)
- 상세: DB 실패 swallow 케이스에서 반환값(`{ executionId: 'ignored' }`)만 확인하고, `logger.warn` 호출 여부를 검증하지 않는다. 실제 구현은 catch 블록에서 warn 로그를 남기는데, 로그 미발생 버그가 있어도 테스트가 통과한다. (마찬가지로 rate-limiter의 fail-open catch 경로도 logger.warn 호출 미검증)
- 제안: 운영 관찰 가능성(observability) 관련 테스트이므로 필수는 아니나, logger mock 을 주입해 `warn` 이 호출됐는지 assert 하면 regression 방지에 유효하다.

### [INFO] 테스트 격리 — 모듈 수준 beforeEach 로 각 it() 독립 인스턴스
- 위치: `hooks.service.spec.ts` lines 33-130 (beforeEach 블록)
- 상세: `Test.createTestingModule(...)` 이 `beforeEach` 에 있어 각 테스트마다 새 모듈 인스턴스가 생성된다. rate-limit mock 의 `mockResolvedValueOnce(false)` 가 다른 테스트에 누출될 수 없다. 격리 설계 양호.
- 제안: 없음.

### [INFO] `chatChannelLastError` 내용 assertion — XSS 방어 검증 포함
- 위치: `hooks.service.spec.ts` lines 651-657
- 상세: `expect(triggerRepo.update).toHaveBeenCalledWith(..., expect.objectContaining({ chatChannelLastError: expect.stringContaining('60/min') }))` 로 lastError 가 한도 정보만 포함하고 외부 입력(conversationKey 등)이 없음을 간접 검증한다. XSS 방어 관련 회귀를 잡을 수 있다.
- 제안: 보강으로 `conversationKey` 문자열이 lastError 에 **포함되지 않음**을 `expect.not.stringContaining(conversationKey)` 로 명시적으로 assert 하면 보안 속성이 더 명확해진다.

---

## 요약

테스트 품질은 전반적으로 양호하다. `ChatChannelRateLimiterService` 단위 테스트는 9가지 케이스로 fail-open·경계값·에러 경로를 충실히 커버하며, 팩토리 패턴 기반의 테스트 격리 설계가 우수하다. `HooksService` 통합 테스트도 4가지 rate-limit 시나리오(초과·이미 degraded·DB 실패·이내)를 spec ID(R-CC-19) 와 연결해 명확하게 검증한다. 주요 갭은 두 가지다: (1) `limit` 상한 클램프(600 초과) 테스트 누락 및 `config.rateLimitPerMinute` 커스텀 override 경로 미검증 — 해당 코드 경로가 제거돼도 테스트가 통과할 수 있다. (2) INCR + EXPIRE 가 동일 pipeline 인스턴스에서 exec 전에 순서대로 호출됐는지(원자성 설계 보장) 검증 부재. 이 두 항목은 WARNING 수준이며 기능 정확성보다 회귀 방어 강도에 영향을 준다.

## 위험도

LOW

STATUS: SUCCESS
