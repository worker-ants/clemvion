### 발견사항

- **[INFO]** Redis `get()` 실패 시 idempotency 보호가 전면 무력화되는 fail-open — 스펙이 명시적으로 요구한 설계이나 잔여 위험을 기록
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:100` (`catchError` 블록, `intercept()` 내부)
  - 상세: `from(this.redis.get(redisKey))` 뒤에 붙은 `catchError` 는 **모든** GET 예외(타임아웃·연결 끊김·기타 런타임 오류 포함)를 무차별로 캐시 미스(`of(null)`)로 강등한다. 이는 `spec/data-flow/15-external-interaction.md` 가 명시한 "전 경로 fail-open — 가용성 우선" 요구를 정확히 구현한 것으로, 이번 diff 의 목적 자체가 이 갭(런타임 reject 가 500 으로 이어지던 fail-closed 결함)을 해소하는 것이다. 다만 이 설계의 성격상, Redis GET 을 어떤 식으로든 실패하게 만들 수 있는 조건(네트워크 불안정, Redis 부하 등)에서는 `Idempotency-Key` 재사용 보호가 요청 단위로 완전히 사라진다 — 즉 같은 키로 여러 번 보낸 비멱등 다운스트림 작업(예: 결제·주문 생성)이 Redis 가 불안정한 짧은 창(window) 동안 중복 실행될 수 있다. 이는 코드 결함이 아니라 spec 이 의도적으로 선택한 가용성 우선 트레이드오프이므로 등급을 INFO 로 둔다. 다만 fail-open 이 트리거될 때 `logger.warn` 만 남기므로, 운영에서 이 로그를 알람/모니터링에 연결해 두지 않으면 "언제부터 idempotency 보호가 사실상 꺼져 있었는지"를 사후에만 알게 된다.
  - 제안: (변경 불필요, 참고용) fail-open 발생 빈도를 관측 가능한 메트릭으로 노출하거나 알람과 연동해, Redis 불안정 구간 동안의 잠재적 중복 처리를 운영이 인지할 수 있게 하는 것을 검토. 이번 PR 스코프는 아님.

- **[INFO]** 에러 메시지를 서버 로그에 그대로 기록 — 클라이언트 노출 없음, 정보 최소화 관점의 참고
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:101-103` (`this.logger.warn(...err.message...)`, GET 실패 시), 및 기존 코드인 `idempotency.interceptor.ts:169-172` (`set()` 실패 시 동일 패턴)
  - 상세: Redis 클라이언트 예외의 `err.message` 를 그대로 서버 로그(Nest `Logger`)에 남긴다. 클라이언트 응답에는 노출되지 않으므로 정보 노출 취약점은 아니다. ioredis 의 일반적 에러 메시지(`ECONNRESET`, `ETIMEDOUT` 등)는 통상 민감정보를 포함하지 않지만, 드물게 연결 문자열 일부가 에러 메시지에 섞이는 라이브러리/설정 조합이 있을 수 있어 참고로 남긴다.
  - 제안: 현재 상태로 문제없음. 별도 조치 불필요.

- **[INFO]** (기존 선재 결함, 이번 diff 로 인한 변경 없음) idempotency 캐시 제외 조건이 spec R8 보다 넓다 — 이미 plan/캐너리 테스트로 추적 중
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:161` (`cacheTapped()` 내부 `if (statusCode >= 400) return;`)
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8 은 "`400 VALIDATION_ERROR` 만 캐시 제외, 2xx/409/410 은 캐시" 를 요구하는데 구현은 `>= 400` 전체를 제외해 409·410 이 24h 재현 대상에서 빠진다. 이번 diff 는 이 동작을 변경하지 않고 캐너리 테스트(`idempotency.interceptor.spec.ts` "409 도 캐시되지 않는다")로 현재 상태를 고정만 했다. 신규 취약점이 아니라 기존에 문서화된 선재 결함이며 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 백로그로 추적 중이다.
  - 제안: 별도 조치 불필요(이번 diff 스코프 밖, 이미 추적됨). 참고로만 기재.

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩된 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지 않은 암호화 알고리즘(`sha256` 사용은 무결성 해시 목적으로 적절 — 비밀번호 해시가 아님), 의존성 취약점 관련 새로운 이슈는 발견되지 않았다. `readKey()` 는 헤더 값의 타입·길이(≤200)를 검증하고, `hashBody()` 는 요청 바디를 SHA-256 으로 해시해 Redis 키/값 조립에 사용하며 별도 명령 조립이 없어 Redis 인젝션 표면도 없다. 테스트 파일(`idempotency.interceptor.spec.ts`)은 순수 단위 테스트로 보안 이슈 없음. plan 문서(`backend-lint-gate-broken-on-main.md`)는 서술 변경뿐이라 보안 관점 대상이 아니다.

### 요약

이번 변경은 `IdempotencyInterceptor` 에서 Redis `get()` 런타임 실패를 `catchError` 로 흡수해 캐시 미스로 강등시킴으로써, 기존에 존재하던 "Redis 런타임 장애 시 요청이 500 으로 fail-closed 되던" 결함을 spec 이 요구하는 fail-open(가용성 우선)으로 정정한다. `catchError` 의 위치가 `switchMap` 앞이라 캐시 충돌(`ConflictException`) 정상 동작은 삼켜지지 않으며, 이는 신규 캐너리 테스트로 고정되어 있다. 새로 도입된 코드 경로에서 인젝션·하드코딩된 시크릿·인가 우회·안전하지 않은 암호화 등 전형적 취약점은 발견되지 않았다. 유일하게 짚을 만한 점은 fail-open 설계 자체가 갖는 본질적 트레이드오프 — Redis 가 불안정한 구간에서는 idempotency 중복 방지가 요청 단위로 사라진다는 것 — 인데, 이는 spec 이 명시적으로 요구한 가용성 우선 정책이라 이번 diff 의 결함이 아니라 설계상 알려진 잔여 위험으로 INFO 로만 기록한다. 기존에 추적 중이던 409/410 캐시 제외 선재 결함도 이번 diff 로 인한 변경이 없으므로 별도 조치 불필요.

### 위험도

NONE
