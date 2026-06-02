# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `close()` / `onModuleDestroy()` 에 대한 테스트 없음
- 위치: `cafe24-install-rate-limit.service.spec.ts` — `close` / `onModuleDestroy` 미테스트
- 상세: 서비스 파일에 `close()` 와 `onModuleDestroy()` 가 구현되어 있으나 단위 테스트에서 아예 커버하지 않는다. `close()` 내부 `redis.quit()` 호출 경로, quit 실패 시 예외 흡수, `redis = null` 시 early return 이 모두 미검증 상태다. `quit` mock 은 `makeRedisMock()` 에 정의되어 있으나 실제로 호출되는지 확인하는 케이스가 없다.
- 제안: `describe('close / onModuleDestroy')` 블록 추가. (a) redis 있을 때 `quit` 호출 확인, (b) `quit` 에러 시 throw 없음 확인, (c) redis 없을 때 no-op 확인.

### [INFO] `isLockedOut` — NaN 반환값 미검증 (구현은 방어함)
- 위치: `cafe24-install-rate-limit.service.spec.ts` 약 55~80행, `isLockedOut` 블록
- 상세: 구현 코드는 `Number.isFinite(count)` 검사로 `NaN`/`Infinity` 를 안전하게 처리한다. 그러나 Redis 가 비정수 문자열(`"abc"`, `""`, `"NaN"`)을 반환하는 경우의 테스트가 없어, 구현의 방어 코드가 의도대로 동작함을 검증하지 않는다. 현재 구현 기준으로는 `false`(fail-open) 가 반환되어야 한다.
- 제안: `it('non-numeric GET value → false (NaN guard)', async () => { ... })` 케이스 추가. 이 케이스는 사실상 경계값 테스트이므로 회귀 방지 가치가 있다.

### [INFO] `recordFailure` — Lua 스크립트의 EXPIRE 조건부 실행(c == 1) 검증 없음
- 위치: `cafe24-install-rate-limit.service.spec.ts` 99~106행, `recordFailure` 첫 테스트
- 상세: 현재 테스트는 `expect.stringContaining('INCR')` 으로 Lua 스크립트 존재만 확인한다. Lua 문자열 전체(`INCR ... if c == 1 then EXPIRE ... end`) 가 변경되어도 이 테스트는 통과한다. EXPIRE 절이 삭제되거나 조건이 잘못 변경되어도 탐지되지 않는다.
- 제안: `expect.stringContaining('EXPIRE')` 을 추가하거나, `expect.stringContaining('if c == 1')` 을 추가해 Lua 스크립트의 핵심 보안 로직(TTL 누락 방지)이 보존됨을 검증한다.

### [INFO] controller 테스트 — `recordFailure`의 `await` 완료 여부 간접 검증만 존재
- 위치: `third-party-oauth.controller.spec.ts` 480~840행, rate limiting 블록
- 상세: `recordFailure` 가 `await` 된 뒤에 응답이 전송되는지(순서 보장) 를 직접 검증하는 케이스가 없다. 현재 테스트는 호출 여부(`toHaveBeenCalledWith`)만 확인하므로, 만약 구현이 `await` 없이 fire-and-forget 으로 변경되어도 모든 테스트가 통과한다. 이는 보안 속성(실패 기록 누락 없음)에 해당한다.
- 제안: `recordFailure` mock 에 `jest.fn().mockImplementation(() => new Promise(resolve => setImmediate(resolve)))` 를 달고, 응답 상태 코드가 await 완료 후에 세팅됨을 검증하는 케이스를 추가하거나, 현 구조로는 fire-and-forget 변경을 감지하기 어렵다는 주석을 남겨 의도를 명시한다.

### [INFO] `makeRedisMock` 반환 타입이 `Record<string, Mock>` — 타입 안전성 미흡
- 위치: `cafe24-install-rate-limit.service.spec.ts` 5~11행
- 상세: `Record<string, Mock>` 는 임의 키를 허용해 IDE/tsc 가 오타를 잡지 못한다. `redis.evel` 등 오타가 있어도 undefined 가 아닌 타입 오류 없이 통과한다. `as never` 로 캐스팅해 생성자에 전달하는 방식은 실제 `Redis` 인터페이스 대비 누락 메서드를 감춘다.
- 제안: `{ get: Mock; eval: Mock; quit: Mock }` 인라인 타입 또는 별도 interface 를 사용하면 메서드 오타를 컴파일 타임에 잡을 수 있다. 테스트 격리에는 영향 없으나 유지보수성이 향상된다.

### [INFO] controller rate-limit 테스트 — `req.ip` 가 `undefined`인 경우 미커버
- 위치: `third-party-oauth.controller.spec.ts` rate limiting 블록 전체
- 상세: controller 코드에서 `const clientIp = req.ip;` 이후 `isLockedOut(clientIp)` 와 `recordFailure(clientIp)` 를 호출한다. 서비스 자체는 `undefined` ip 를 안전하게 처리하지만, controller 레벨에서 `req.ip` 가 `undefined` 일 때 lockout 체크가 건너뛰어지는지(fail-open) 검증하는 케이스가 없다. Proxy 환경에서 `req.ip` 가 undefined 일 수 있다.
- 제안: `{ ip: undefined, url: '...', headers: {} }` req fixture 를 이용한 케이스 추가. 서비스 레벨에서 이미 처리하므로 CRITICAL 은 아니나, controller-service 경계 통합 확인에 유용하다.

---

## 요약

전반적으로 테스트 커버리지 설계가 우수하다. `Cafe24InstallRateLimitService` 단위 테스트는 핵심 분기(null 카운터, 임계치 경계, Redis 에러 fail-open, undefined ip, Redis 미설정)를 빠짐없이 커버하며, 서비스가 의존성 주입(생성자 직접 `injectedRedis`)을 통해 테스트 용이하게 설계되어 격리도 완전하다. controller 테스트는 lockout → 429 조기 반환, enumeration 신호 기록(INVALID_TOKEN, INVALID_HMAC), 비신호 제외(REPLAY, MISSING_PARAMS, 성공)를 7케이스로 명확히 분리해 의도가 읽힌다. 발견된 항목은 모두 INFO 수준(close 미테스트, NaN 경계값, Lua 스크립트 부분 검증, await 순서 보장 미검증, req.ip undefined 경로)으로, 현재 보안 요구사항(enumeration 방어)을 직접 위협하는 커버리지 공백은 없다.

## 위험도

LOW
