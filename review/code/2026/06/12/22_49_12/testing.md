# 테스트(Testing) 리뷰 결과

## 발견사항

### **[INFO]** `ChatChannelRateLimiterService` 단위 테스트 — 핵심 시나리오 커버리지 양호
- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.spec.ts`
- **상세**: 6개 테스트가 한도 이내/경계/초과, 첫 증가 시 EXPIRE 설정, Redis 미가용 fail-open, Redis 에러 fail-open을 커버한다. 핵심 동작 경로 전부를 포괄하고 있으며 spec CCH-NF-03/R-CC-19 요구사항과 1:1 매핑된다.
- **제안**: 없음 (현재 커버리지 적절).

### **[WARNING]** `pipeline.exec()` 반환값 `null` / 빈 배열 fail-open 경로 — 테스트에서 검증 누락
- **위치**: `chat-channel-rate-limiter.service.ts` line 61: `if (!results || results.length === 0) return true;`
- **상세**: 구현 코드에는 `pipeline.exec()`가 `null` 또는 길이 0 배열을 반환할 때 fail-open하는 분기가 있다. 현재 테스트의 `makeRedis` 헬퍼는 항상 `[[null, count]]`를 반환해 이 분기를 건드리지 않는다. Redis 에러 케이스(`exec → rejected`)는 테스트되지만, `exec → null` 또는 `exec → []` 반환은 별도 코드 경로이므로 커버리지 갭이 된다.
- **제안**: 아래 두 케이스를 추가한다.
  ```ts
  it('pipeline.exec() null 반환 → fail-open(true)', async () => {
    const redis = { pipeline: jest.fn().mockReturnValue({ incr: jest.fn(), exec: jest.fn().mockResolvedValue(null) }), expire: jest.fn() };
    const svc = new ChatChannelRateLimiterService(redis as never);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('pipeline.exec() 빈 배열 반환 → fail-open(true)', async () => {
    const redis = { pipeline: jest.fn().mockReturnValue({ incr: jest.fn(), exec: jest.fn().mockResolvedValue([]) }), expire: jest.fn() };
    const svc = new ChatChannelRateLimiterService(redis as never);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });
  ```

### **[WARNING]** `results[0]` 의 `incrErr`가 non-null일 때 throw 경로 — 테스트 미존재
- **위치**: `chat-channel-rate-limiter.service.ts` line 62–63: `const [incrErr, count] = results[0]; if (incrErr) throw incrErr;`
- **상세**: pipeline `exec()`는 성공 완료되지만 개별 커맨드 결과에 `Error`가 포함될 수 있다(`[Error, null]` 형태). 이 경로는 catch 블록으로 떨어져 fail-open이 되어야 한다. 현재 테스트는 이를 검증하지 않는다.
- **제안**:
  ```ts
  it('pipeline 내 INCR 오류([Error, null]) → fail-open(true)', async () => {
    const redis = { pipeline: jest.fn().mockReturnValue({ incr: jest.fn(), exec: jest.fn().mockResolvedValue([[new Error('INCR failed'), null]]) }), expire: jest.fn() };
    const svc = new ChatChannelRateLimiterService(redis as never);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });
  ```

### **[WARNING]** `makeRedis` 헬퍼가 `incr` mock 결과를 파이프라인에 주입하지 않아 실제 동작과 괴리
- **위치**: `chat-channel-rate-limiter.service.spec.ts` lines 49–51
- **상세**: `incr` jest.fn()은 반환값 없이 정의되어 있고, 카운트는 `exec`의 반환값에서만 오도록 mock이 구성되어 있다. 이는 ioredis pipeline의 실제 동작과 일치하는 올바른 구조이지만, `_incr` / `_exec`를 exported type으로 노출하면서도 테스트 본문에서는 이를 사용하지 않아 불필요한 노출이다. 또한 `incr` mock의 체이닝 동작(`pipeline.incr(key)` 호출 후 반환값 확인)을 검증하지 않으므로, 만약 서비스가 `pipeline.incr(key)` 호출을 실수로 누락해도 테스트가 통과할 수 있다.
- **제안**: `incr`가 올바른 key로 호출됐는지 검증하는 assertion을 하나 이상 추가한다.
  ```ts
  it('올바른 key로 INCR 호출', async () => {
    const redis = makeRedis(1);
    const svc = new ChatChannelRateLimiterService(redis as never);
    await svc.consume(TRIGGER_ID, CHAT, LIMIT);
    expect(redis._incr).toHaveBeenCalledWith(makeChatRateLimitKey(TRIGGER_ID, CHAT));
  });
  ```

### **[WARNING]** `HooksService` 통합 테스트 — rate-limit 초과 시 `triggerRepo.update` 호출 검증이 완전하지 않음
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` lines 595–600
- **상세**: 테스트는 `triggerRepo.update`가 `{ id: ... }`, `expect.objectContaining({ chatChannelHealth: 'degraded' })`로 호출됐는지를 검증하지만, `chatChannelLastError` 필드 내용은 검증하지 않는다. `markChatChannelRateLimited`는 `chatChannelLastError`에 `limitPerMinute`와 `conversationKey`를 포함한 메시지를 설정하는데, 이 내용이 올바른지 보장하지 못한다.
- **제안**: 기존 assertion을 확장하거나 별도 테스트로 `chatChannelLastError`에 rate limit 정보가 포함됐는지 검증한다.
  ```ts
  expect(triggerRepo.update).toHaveBeenCalledWith(
    { id: chatChannelTrigger.id },
    expect.objectContaining({
      chatChannelHealth: 'degraded',
      chatChannelLastError: expect.stringContaining('60/min'),
    }),
  );
  ```

### **[WARNING]** `markChatChannelRateLimited` — `trigger.chatChannelHealth === 'degraded'` 이미 설정된 경우 skip 동작 테스트 미존재
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` line 706: `if (trigger.chatChannelHealth === 'degraded') return;`
- **상세**: 이미 `degraded` 상태인 trigger에 대해 `triggerRepo.update`가 호출되지 않아야 하는(중복 write 방지) 동작이 테스트되지 않는다. 폭주 시나리오에서 성능 보호를 위한 핵심 최적화이므로 regression 위험이 있다.
- **제안**: 아래 케이스를 `hooks.service.spec.ts`에 추가한다.
  ```ts
  it('이미 degraded 상태 trigger → rate-limit 초과 시 update 호출 안 함', async () => {
    triggerRepo.findOne.mockResolvedValue({ ...chatChannelTrigger, chatChannelHealth: 'degraded' });
    // ...parseUpdate, rateLimiter 세팅...
    rateLimiter.consume.mockResolvedValueOnce(false);
    await service.handleWebhook('abc', chatInput);
    expect(triggerRepo.update).not.toHaveBeenCalled();
  });
  ```

### **[WARNING]** `markChatChannelRateLimited` — DB 갱신 실패 시 에러 swallow 동작 테스트 미존재
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` lines 718–723
- **상세**: `triggerRepo.update`가 예외를 던질 때 `logger.warn`만 호출하고 예외를 삼키며(best-effort 정책), 메서드 호출자에게는 영향이 없어야 한다. 이 동작이 검증되지 않아, 나중에 에러 handling을 수정할 때 silent regression이 발생할 수 있다.
- **제안**: `triggerRepo.update`가 reject됐을 때 `handleWebhook`이 정상 반환(`{ executionId: 'ignored' }`)하는지 테스트한다.

### **[INFO]** `redisConn`을 통한 `getClientOrNull()` 초기화 경로 — 단위 테스트 미존재
- **위치**: `chat-channel-rate-limiter.service.ts` line 41: `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`
- **상세**: 현재 단위 테스트는 `injectedRedis` 직접 주입 경로와 `null`(Redis 없음) 경로만 커버한다. `redisConn.getClientOrNull()`이 non-null client를 반환하는 경로(`injectedRedis` 없이 `redisConn`으로 초기화)는 테스트되지 않는다. 통합 테스트 또는 별도 단위 테스트가 없으면, NestJS DI 환경에서 실제 동작과 차이가 생길 수 있다.
- **제안**: `RedisConnectionProvider` mock을 주입해 `getClientOrNull()`이 Redis 인스턴스를 반환할 때 정상 동작하는지 테스트를 추가한다. INFO 수준이므로 즉각 필수는 아니나 추적 권장.

### **[INFO]** `HooksService` 통합 테스트 — `config.rateLimitPerMinute`가 명시적으로 설정된 케이스(기본값 override) 미검증
- **위치**: `hooks.service.spec.ts` line 620–624
- **상세**: 현재 테스트는 `consume(triggerId, conversationKey, 60)` (기본값)만 검증한다. `config.rateLimitPerMinute`가 설정된 경우 해당 값이 `consume`에 정확히 전달되는지 검증하는 테스트가 없다.
- **제안**: `chatChannelTrigger.config.chatChannel.rateLimitPerMinute = 30` 같이 override 설정 후 `consume`에 `30`이 전달됐는지 검증하는 테스트를 추가한다.

### **[INFO]** 테스트 격리 — `makeRedis` 헬퍼가 테스트마다 새 인스턴스 생성, 상태 공유 없음
- **위치**: `chat-channel-rate-limiter.service.spec.ts` lines 48–57
- **상세**: 각 테스트에서 `makeRedis(n)`을 호출해 독립적인 mock 인스턴스를 생성한다. describe-level shared state가 없어 테스트 간 의존성이 없다. 격리 측면에서 양호한 구조.

### **[INFO]** `hooks.service.spec.ts` — rate-limit consume mock을 describe 공유 mock으로 교체 시 기존 테스트 영향 검토 필요
- **위치**: `hooks.service.spec.ts` line 565–568
- **상세**: `ChatChannelRateLimiterService`의 default mock은 `consume: jest.fn().mockResolvedValue(true)` (한도 이내)로 설정되어 있어 기존 chat-channel 테스트들은 모두 rate-limit 미적용 상태로 실행된다. 이는 의도적으로 올바른 설계이며, rate-limit 케이스에서만 `mockResolvedValueOnce(false)`로 override한다. 기존 테스트들에 미치는 영향 없음.

## 요약

`ChatChannelRateLimiterService` 단위 테스트는 핵심 행복 경로(한도 이내·경계·초과)와 fail-open 시나리오(Redis null, Redis 에러)를 충실히 커버하며, `hooks.service.spec.ts`에는 rate-limit 초과 시 execution 미시작 + degraded 갱신, 이내 시 정상 처리 + consume 인수 전달이 검증되어 전반적인 테스트 커버리지는 양호하다. 다만 `pipeline.exec()` null/빈 배열 반환 fail-open 경로, pipeline 개별 커맨드 오류(`incrErr` non-null) 경로, 이미 `degraded` 상태 trigger에서의 중복 update 방지 동작, `markChatChannelRateLimited` DB 에러 swallow 동작 등 네 개의 코드 경로가 테스트되지 않아 회귀 취약 지점이 남아 있다. 이들 중 "이미 degraded 상태 trigger → update 호출 안 함" 케이스는 성능 보호 로직이므로 WARNING으로 분류하며 추가를 강력히 권장한다.

## 위험도

LOW
