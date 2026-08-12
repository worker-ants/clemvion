### 발견사항

- **[INFO]** Idempotency 캐시 키가 `Idempotency-Key` 값에만 바인딩되고 `executionId`/인증 컨텍스트로 스코프되지 않음 — 이전 라운드들(`16_29_45`, `16_53_26`, `18_37_45` WARNING #4)에서 이미 발견·유예된 선재 설계이며 이번 라운드의 delta(commit `567c1919d` — 테스트 warn 단언 추가 + plan 백로그 기재)가 새로 만든 것은 아니다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`` — `intercept()` 내부, `readKey()`/`hashBody()` 정의부는 파일 최하단)
  - 상세: `InteractionGuard` 가 먼저 인증을 검증하므로 임의 execution 접근 자체는 막히지만, 서로 다른 인증된 요청이 동일한 `Idempotency-Key` + 동일 `body`(→ 동일 `bodyHash`)를 사용하면 한쪽 execution 에서 캐시된 `409`/`410` 응답이 다른 요청자에게 재생될 수 있는 구조는 그대로 남아 있다. `18_37_45` 라운드에서 security reviewer 가 "신규 회귀 아님, 선재·기등재" 로 명시 판정했고, `plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그에 우선순위 상향 근거가 이미 기록되어 있다.
  - 제안: 후속 항목으로 `redisKey` 에 `executionId`(또는 인증 scope 식별자)를 포함시키는 것을 권고 — 이번 PR 범위(§R8 캐시 대상 정합화) 밖이므로 이번 diff 를 막을 사유는 아님.

- **[INFO]** 이번 라운드 delta(`567c1919d`)가 추가한 두 테스트("직렬화 불가 payload" 회귀, error/success 양 채널)는 `jest.spyOn(Logger.prototype, 'warn')` 으로 fail-open 시 로그가 실제로 남는지까지 단언하도록 보강됨 — 관측성(observability) 개선이며 보안 결함 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (`직렬화 불가 payload 여도 원 예외가 그대로 나간다` / `성공 채널에서도 직렬화 불가 응답이 요청을 죽이지 않는다` 두 `it` 블록)
  - 상세: `storeEntry()` 의 `JSON.stringify` 가 `catchError` 셀렉터 안에서 throw 하면 원래의 409/410 예외를 500 으로 대체해 클라이언트에게 실제 실패 원인(멱등 충돌/종결 상태)을 숨기는 결과가 될 수 있었는데(이전 라운드 `ac8dd03ee` 에서 `try/catch` 로 이미 방어), 이번 delta 는 그 방어에 대한 회귀 테스트를 로그 단언까지 포함해 완성한 것. 코드 자체 변경 없음(테스트 전용 diff).
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 캐시된 오류 응답(`409`/`410`) payload — `interaction.service.ts` 가 던지는 `ConflictException`/`GoneException` payload 는 고정 문자열 또는 `execution.status` enum 값만 담아 민감정보 노출 없음(이전 라운드 확인 유지)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:194` (`err.getResponse()` 를 검증 없이 그대로 직렬화·캐시)
  - 상세: 인터셉터 자체는 payload 를 가공하지 않고 그대로 저장·재현할 뿐이며, 이번 diff 범위(`idempotency.interceptor.ts`/`.spec.ts`/e2e)에는 `interaction.service.ts` 변경이 포함되지 않는다. 캐시 손상(JSON 파싱 실패) 시에도 `GlobalExceptionFilter` 가 비-`HttpException` 을 고정 문구로 마스킹해 정보 노출을 방어한다(기존 컨트롤).
  - 제안: 없음 — `interaction.service.ts` 의 409/410 throw 지점을 변경할 때 응답 payload 에 내부 diagnostic 정보가 실리지 않는지 재확인할 것(참고용).

- **[INFO]** 신규 e2e 테스트가 Redis 접속 정보를 하드코딩하지 않고 env var 폴백(`process.env.REDIS_HOST ?? 'redis'`, `process.env.REDIS_PORT ?? '6379'`)으로 구성 — 하드코딩 시크릿 없음. 같은 파일의 `JWT_SECRET` 테스트 기본값(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)은 이번 diff 가 새로 추가한 것이 아니라 기존 e2e 파일에 이미 있던 값(diff 밖)이며, 이름 자체가 "do-not-use-in-prod" 로 명시된 테스트 전용 fallback이다.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (`redis = new Redis({ host: ..., port: ... })`, `beforeAll`/`afterAll`)
  - 제안: 없음.

핵심 코드 변경(`idempotency.interceptor.ts`)은 이전 라운드(`16_29_45` → `16_53_26` → `17_07_45` → `18_07_36` → `18_37_45`)를 거치며 이미 4~5차례 보안 관점 검토를 통과한 §R8 캐시 대상 정합화 재설계이고, 이번 라운드(`18_52_47`)가 다루는 실제 delta 는 테스트 파일의 warn 단언 보강과 plan 백로그 기재(`567c1919d`)뿐이라 새로운 인젝션·하드코딩 시크릿·인증/인가 우회·암호화 약화·에러 메시지 노출 문제는 없다. 유일하게 지속 관찰 중인 항목은 idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않는 선재 설계이며, 이는 여러 라운드에 걸쳐 반복 확인·유예된 기지 사항으로 이번 PR 을 막을 사유가 아니다.

### 요약
이번 delta 는 `IdempotencyInterceptor` 재설계에 대한 테스트 보강(직렬화 실패 시 warn 로그 단언)과 plan 백로그 기재뿐이며, 코드 실행 경로 변경이 없어 새로 도입된 취약점은 없다. 누적된 §R8 캐시 대상 확장(2xx·409·410) 자체도 다회 라운드에 걸쳐 인증/인가·인젝션·시크릿·암호화·에러 노출 관점에서 검증 완료됐다. 유일한 지속 관찰 항목은 idempotency 캐시 키가 execution 단위로 스코프되지 않는 선재 설계(이미 plan 백로그에 등재, 우선순위 상향 근거 기록됨)이며 이번 라운드에서 새로 발견된 사항이 아니다.

### 위험도
LOW
