# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `makeRedis` 반환 객체에서 `exec` 필드가 일부 테스트에서만 사용됨 — 잠재적 미사용 노출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.spec.ts` — `makeRedis` 함수, 23번 줄
- 상세: `makeRedis` 는 `{ redis, incr, expire, exec }` 를 반환하지만, `exec` jest.fn 은 어떤 테스트에서도 `expect(exec).toHaveBeenCalled()` 형태로 검증되지 않는다. `incr`/`expire` 는 첫 번째 테스트에서 호출 검증에 사용되어 의미가 있으나, `exec` 는 반환 객체에 포함돼 있음에도 불구하고 사용처가 없다. 헬퍼 시그니처가 소비자에게 "exec 도 검증 가능하다"는 신호를 주나 실제 사용되지 않아 독자에게 혼란을 준다.
- 제안: `exec` 를 반환 객체에서 제거하거나, pipeline 전체 호출 흐름을 검증하는 테스트를 추가한다.

### [INFO] `as never` 타입 캐스팅이 `makeRedis` 반환부와 `exec reject` 테스트 양쪽에서 반복
- 위치: `chat-channel-rate-limiter.service.spec.ts` 23번 줄, 86번 줄
- 상세: `{ pipeline } as never` 패턴이 두 곳에서 독립적으로 반복된다. `makeRedis` 의 반환 타입을 서비스 생성자가 최소한으로 기대하는 인터페이스(예: `{ pipeline: jest.Mock }`)로 명시하면 `as never` 없이 안전하게 사용할 수 있다. `exec reject` 테스트(79–88번 줄)는 `makeRedis` 팩토리를 사용하지 않고 inline 으로 redis 객체를 재정의하는데, 이 역시 `makeRedis` 에 `rejectWith` 옵션을 추가하면 중복을 제거할 수 있다.
- 제안: `makeRedis` 반환 타입을 `{ redis: { pipeline: jest.Mock }; incr: jest.Mock; expire: jest.Mock }` 형태의 최소 인터페이스로 강화하고, `exec reject` 시나리오도 팩토리로 통합한다.

### [INFO] 테스트 상수 `LIMIT = 60` 이 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 과 동일한 값 — 상수 변경 시 묵시적 통과 위험
- 위치: `chat-channel-rate-limiter.service.spec.ts` 14번 줄
- 상세: `const LIMIT = 60` 은 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN = 60` 과 동일한 숫자지만 import 하지 않는다. 기본 한도가 변경될 때 테스트의 `LIMIT` 은 갱신되지 않아 시나리오 의미가 변한다. 반대로 의도적으로 "임의 한도" 를 테스트하려는 것이라면 60 이 아닌 다른 값(예: 5)을 써서 `CHAT_RATE_LIMIT_WINDOW_SEC = 60` 과 시각적 구분을 명확히 하는 것이 낫다. 세 개의 서로 다른 의미(per-min 한도, 윈도우 초, 기본 한도)가 모두 60 으로 동일해 숫자 의미 구분이 어렵다.
- 제안: `LIMIT` 을 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` import 로 대체하거나, 5·10 등 구별되는 값으로 변경해 "60 이라는 우연의 일치"를 명시적으로 깨는 것을 권장한다.

### [INFO] `consume` 내 clamp 표현식이 단일 라인에 과도한 인라인 논리를 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` 57번 줄
- 상세: `Math.max(1, Math.min(600, Math.floor(limitPerMinute) || 60))` 한 줄에 상한(600), 하한(1), 기본값(60), 정수 변환이 모두 인라인으로 표현된다. 600 과 1 은 `CHAT_RATE_LIMIT_MAX_PER_MIN`, `CHAT_RATE_LIMIT_MIN_PER_MIN` 같은 상수로 추출되지 않아 상·하한이 왜 그 값인지 숫자만으로는 추론해야 한다. 주석(`// DTO 가 1–600...`)이 의도를 설명하긴 하나, 상수화가 더 자기문서적이다.
- 제안: 상한 600 을 `CHAT_RATE_LIMIT_MAX_PER_MIN = 600` 으로 추출한다(DTO `@Max(600)` 와 동일한 진실). 하한 1 은 "최소 1건" 으로 의미가 자명해 인라인 허용 가능하나 일관성을 위해 함께 추출 고려.

### [INFO] `hooks.service.spec.ts` 에서 `moduleRef.get(ChatChannelRateLimiterService) as { consume: jest.Mock }` 캐스팅이 3개 테스트 블록에서 반복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.spec.ts` — 628번, 390번, 353번 줄 근방
- 상세: CCH-NF-03 관련 테스트 4건 중 3건에서 `moduleRef.get(ChatChannelRateLimiterService) as { consume: jest.Mock }` 를 직접 선언한다. 동일 캐스팅 패턴이 반복되어 `ChatChannelRateLimiterService` mock 타입이 바뀔 경우 수정 지점이 3곳이다.
- 제안: `describe('CCH-NF-03 rate-limit', ...)` 블록을 묶고 `let rateLimiter: { consume: jest.Mock }` 를 `beforeEach` 에서 한 번만 할당한다.

### [INFO] `markChatChannelRateLimited` 의 `chatChannelLastError` 문자열에 슬라이스 제한 없음 — 길이 방어 일관성 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` 864번 줄
- 상세: `chatChannelLastError` 에 기록되는 문자열은 `Inbound rate limit exceeded (${limitPerMinute}/min)` 로 고정 길이지만, `limitPerMinute` 가 비정상적으로 큰 숫자일 경우 길이 보장이 없다. 코드베이스의 다른 `chatChannelLastError` 갱신 경로가 `.slice(0, 1024)` 같은 제한을 사용하는지 확인이 필요하다. 일관성 없는 길이 방어는 DB 컬럼 길이 초과 시 의도치 않은 에러를 유발할 수 있다.
- 제안: 코드베이스의 `chatChannelLastError` 갱신 패턴을 통일하거나, 이 경로에도 `CHAT_CHANNEL_LAST_ERROR_MAX_LENGTH` 상수를 적용해 길이를 제한한다.

### [INFO] `CHAT_CHANNEL_RATE_LIMIT_REDIS` DI 토큰 — 용도가 생성자 주석에만 기술되어 있으며 토큰 자체가 어디서도 provide 되지 않음
- 위치: `chat-channel-rate-limiter.service.ts` 36번 줄
- 상세: `@Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')` 토큰은 `ChatChannelModule`, `AppModule` 어디서도 provide 되지 않으며 테스트에서만 직접 생성자 인자로 주입된다. 문자열 리터럴 토큰이 소스에 흩어지면 오탈자 리스크가 생긴다. 현재는 `@Optional()` 로 보호되어 런타임 DI 실패는 없으나, 토큰 문자열을 export 상수로 추출하면 테스트와 서비스 간 오타 방지가 가능하다.
- 제안: `export const CHAT_CHANNEL_RATE_LIMIT_REDIS_TOKEN = 'CHAT_CHANNEL_RATE_LIMIT_REDIS'` 로 추출해 서비스 파일에서 참조한다. (낮은 우선순위 — 현재 테스트 직접 주입 경로만 있어 실질 위험 낮음.)

## 요약

`ChatChannelRateLimiterService` 는 단일 책임, 명확한 JSDoc, 낮은 순환 복잡도를 갖춰 유지보수성이 전반적으로 양호하다. `consume` 메서드(25줄)는 과도한 중첩 없이 단일 try/catch 로 구조화되어 있으며, fail-open 경로가 세 분기 모두 일관되게 `return true` 로 수렴한다. `HooksService` 의 `markChatChannelRateLimited` 메서드도 짧고 목적이 명확하며, `parseUpdate` 직후 rate-limit 단락 삽입이 기존 guard 체인 패턴을 자연스럽게 확장한다. 주목할 유지보수성 약점은 테스트 코드에 집중되어 있다: `makeRedis` 의 미사용 `exec` 필드 노출, `as never` 캐스팅 반복, 동일한 숫자(60) 에 세 가지 의미가 중첩되는 상수 설계, `moduleRef.get` 캐스팅의 중복이 그것이다. 프로덕션 코드에서는 clamp 상수화와 `chatChannelLastError` 길이 방어 일관성이 낮은 우선순위의 개선 포인트다. CRITICAL·WARNING 수준의 유지보수성 문제는 없다.

## 위험도

LOW

STATUS: SUCCESS
