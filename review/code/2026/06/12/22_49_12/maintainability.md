# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `makeRedis` 헬퍼에서 `_incr`/`_exec` 내부 참조가 미사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.spec.ts` — `makeRedis` 함수, 반환 객체 타입 선언 (`_incr`, `_exec`)
- 상세: `makeRedis` 내부에서 `incr`/`exec`를 지역 변수에 담아 `{ ..., _incr: incr, _exec: exec }` 형태로 반환하지만, 반환 타입 선언에서는 `_incr`/`_exec` 가 포함되지 않아(타입 캐스팅에서 제외) 실질적으로 접근 불가하다. 테스트 코드 어디서도 `_incr`/`_exec` 에 접근하지 않는다. 헬퍼 구현과 반환 타입의 의도가 불일치해 혼란을 야기한다.
- 제안: `_incr`/`_exec` 필드를 제거하거나, 반환 타입에 포함해 실제 검증에 사용한다. 현 상태는 미사용 잔여물로 가독성을 낮춘다.

### [INFO] `redis as never` 캐스팅 반복 사용 — 테스트 내 타입 회피 패턴 산재
- 위치: `chat-channel-rate-limiter.service.spec.ts` — 각 `it` 블록의 `new ChatChannelRateLimiterService(redis as never)`
- 상세: 6개 테스트 케이스 중 5곳에서 `redis as never` 캐스팅이 반복된다. `makeRedis` 반환 타입을 서비스 생성자가 기대하는 최소 인터페이스(예: `Pick<Redis, 'pipeline' | 'expire'>`)로 선언하면 `as never` 없이 안전하게 주입할 수 있다.
- 제안: `makeRedis` 반환 타입을 `Partial<Redis>` 또는 minimal mock 인터페이스로 강화해 타입 캐스팅 부채를 줄인다.

### [INFO] `LIMIT = 60` 상수와 `CHAT_RATE_LIMIT_WINDOW_SEC = 60` 수치 일치 — 우연의 일치로 오해 가능
- 위치: `chat-channel-rate-limiter.service.spec.ts` — `const LIMIT = 60`; `chat-channel-rate-limiter.service.ts` — `CHAT_RATE_LIMIT_WINDOW_SEC = 60`, `CHAT_RATE_LIMIT_DEFAULT_PER_MIN = 60`
- 상세: 테스트의 `LIMIT`(per-minute 요청 한도)과 `CHAT_RATE_LIMIT_WINDOW_SEC`(초 단위 윈도우) 및 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 이 모두 60으로 동일한 숫자다. 테스트가 `LIMIT = 60`을 독립 상수로 선언해 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 을 import하지 않으므로, 기본값이 변경될 때 테스트가 묵시적으로 깨지지 않는 구조다. 단, 60 이라는 숫자가 세 곳에 동시에 등장해 의미 구분이 필요하다 — 각 상수가 충분히 명명되어 있어 치명적이지 않으나, `LIMIT = CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 로 import해 연결하면 상수 변경 시 테스트가 의도적으로 반응하게 된다.
- 제안: 테스트 `LIMIT` 상수를 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` import로 대체하거나, 다른 값(예: `LIMIT = 5`)으로 설정해 "60이라는 우연의 일치"를 깨는 것이 테스트 독립성에 유리하다.

### [INFO] `markChatChannelRateLimited` 메서드의 `chatChannelLastError` 문자열 — 인라인 템플릿 리터럴 + `.slice(0, 1024)` 조합
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` — `markChatChannelRateLimited` 메서드
- 상세: 에러 메시지 문자열이 인라인 템플릿 리터럴로 작성되고 `.slice(0, 1024)` 가 체이닝되어 있다. 1024라는 매직 넘버가 어디서 유래하는지 (DB 컬럼 길이 제약인지, 임의 값인지) 코드 주석이 없다. 유사한 DB 갱신이 코드베이스 다른 곳에도 있다면, 이 제한값을 상수로 추출해야 변경 시 일관성이 보장된다.
- 제안: `1024`를 `CHAT_CHANNEL_LAST_ERROR_MAX_LENGTH` 등의 명명 상수로 추출하거나, 기존 코드베이스에 같은 패턴이 있다면 공통 상수를 재사용한다.

### [INFO] 중첩 없음 · 함수 길이 양호 — `consume` 메서드
- 위치: `chat-channel-rate-limiter.service.ts` — `consume` 메서드 (25라인)
- 상세: try/catch 내부의 조건 분기가 1단계이며, 함수 길이가 25라인으로 단일 책임(INCR, expire, 비교)을 명확히 수행한다. 복잡도 낮음.

### [INFO] `chatChannelRateLimiter` DI 생성자 파라미터 순서
- 위치: `hooks.service.ts` — `HooksService` 생성자, `private readonly chatChannelRateLimiter: ChatChannelRateLimiterService` 위치
- 상세: 생성자 파라미터 순서가 `channelConversationService` 다음, `interactionService` 이전으로 새로 삽입되었다. 기능적 문제는 없으나, NestJS DI 파라미터는 관련 서비스끼리 그룹화(channel 관련, execution 관련)하는 컨벤션이 있다면 `chatChannelRateLimiter` 가 `channelConversationService` 바로 다음에 위치하는 것은 자연스럽다 — 현재 배치가 적합하다.

### [INFO] `hooks.service.spec.ts` — `rateLimiter.consume` mock 접근 방식에 중복 타입 캐스팅
- 위치: `hooks.service.spec.ts` — CCH-NF-03 두 테스트 케이스, `const rateLimiter = moduleRef.get(ChatChannelRateLimiterService) as { consume: jest.Mock }`
- 상세: 두 개의 연속 테스트에서 동일한 `moduleRef.get(...) as { consume: jest.Mock }` 캐스팅이 반복된다. `beforeEach` 또는 테스트 블록 상단에서 한 번만 선언하면 중복을 제거할 수 있다.
- 제안: 두 테스트를 하나의 `describe` 블록으로 묶고 `let rateLimiter` 를 공유하거나, 각 테스트에서 개별 선언을 유지하되 위치를 `beforeEach`로 이동한다.

## 요약

신규 추가된 `ChatChannelRateLimiterService` 와 `HooksService` 변경 코드는 전반적으로 유지보수성이 양호하다. 서비스 클래스는 단일 책임, 낮은 순환 복잡도, 명확한 JSDoc, 상수 export 패턴을 준수한다. NestJS 모듈 등록·export 변경도 최소이며 일관성이 있다. 주요 지적 사항은 테스트 헬퍼의 미사용 필드(`_incr`/`_exec`), 반복적인 `as never` 타입 캐스팅, 에러 메시지 길이 제한의 매직 넘버(1024), 동일 `moduleRef.get` 캐스팅의 중복 등 코드 냄새 수준의 INFO 항목들이다. 기능 정확성이나 설계 구조에 영향을 미치는 CRITICAL·WARNING 수준의 유지보수성 문제는 없다.

## 위험도

LOW
