### 발견사항

- **[INFO]** Redis `get()` fail-open이 `Idempotency-Key` 기반 중복 억제를 전면 무력화한다 — spec 이 명시적으로 요구한 설계
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-112` (`catchError` 블록, `intercept()` 내부)
  - 상세: `from(this.redis.get(redisKey))` 뒤에 붙은 `catchError`(107행)는 GET 예외(연결 끊김·타임아웃 등)를 무차별로 캐시 미스(`of(null)`)로 강등한다. `spec/data-flow/15-external-interaction.md`가 "Redis … 전 경로 fail-open (warn) — 가용성 우선"을 명시적으로 요구하므로 방향 자체는 spec 의도와 정확히 일치하고, 이번 diff의 목적이 바로 이 갭(런타임 reject가 500 fail-closed로 이어지던 결함)을 닫는 것이다. 다만 보안 관점에서 짚을 잔여 위험: Redis가 불안정한 구간에는 같은 `Idempotency-Key`로 반복 제출된 비멱등 다운스트림 작업(예: execution 생성 등 side-effect가 있는 호출)이 요청 단위 재현 보장 없이 중복 실행될 수 있다 — 클라이언트의 의도적 재시도 남용이든 우발적 재전송이든, 그 구간에는 서버 측 억제 수단이 없다. 이는 코드 결함이 아니라 spec이 승인한 트레이드오프이며, `CHANGELOG.md`·클래스 docstring(`idempotency.interceptor.ts:61-72`)·`plan/in-progress/backend-lint-gate-broken-on-main.md`(WARNING #1 처리 이력)에 이미 문서화·유예되어 있다.
  - 제안: 조치 불요(문서화·백로그 등재 완료, 관측 지표 검토는 이미 plan 백로그에 있음). 다운스트림 중 실제로 비멱등(결제·과금성 side-effect)인 경로가 있다면 그쪽 핸들러 자체에 DB unique constraint 등 애플리케이션 레벨 dedup이 있는지 별도로 확인해 두는 편이 안전하다.

- **[INFO]** 에러 메시지를 서버 로그에만 기록 — 클라이언트 미노출, 정보 노출 취약점 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-111` (신규 GET 실패 로그, `err instanceof Error ? err.message : String(err)`), `:174-180` (기존 SET 실패 로그, 이번 diff로 미변경, 동일 패턴)
  - 상세: ioredis 예외의 `err.message`를 Nest `Logger`로만 남기고 HTTP 응답에는 노출하지 않는다. ioredis 일반 에러 메시지(`ECONNRESET`, `ETIMEDOUT` 등)는 통상 자격증명을 포함하지 않으나, 드물게 연결 설정 일부가 에러 메시지에 섞이는 라이브러리/설정 조합이 있을 수 있어 참고로 남긴다.
  - 제안: 조치 불요.

- **[INFO]** (선재 결함, 이번 diff로 변경 없음) idempotency 캐시 제외 범위가 spec R8보다 넓어 409·410 응답까지 재현 보장에서 빠진다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168` (`cacheTapped()`의 `if (statusCode >= 400) return;`)
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8은 "`400 VALIDATION_ERROR`만 캐시 제외, 2xx/409/410은 캐시"를 요구하는데 구현은 `>= 400` 전체를 제외한다. 이번 diff는 이 동작을 바꾸지 않았고, `cacheTapped()` docstring(`:144-156`)이 이미 선재 결함으로 정직하게 문서화하며 `idempotency.interceptor.spec.ts`의 409 캐너리 테스트가 현재 동작을 고정한다. `plan/in-progress/backend-lint-gate-broken-on-main.md`에 백로그로 추적 중. 보안 함의는 정보 노출 확대가 아니라 재현 실패(가용성 저하) 수준.
  - 제안: 조치 불요(스코프 밖, 이미 추적됨).

- **[없음 — 확인 결과 문제 없음]** `catchError` 삽입 위치가 정확함(`switchMap` 앞) — `ConflictException` 검출 삼킴 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98-113` (`from(this.redis.get(redisKey)).pipe(catchError(...), switchMap(...))`)
  - 상세: 워크트리를 직접 `Read`해 재검증했다 — `catchError`가 107행, `switchMap`이 113행으로, 신규 `catchError`가 `from(get())` 직후·`switchMap` **앞**에 정확히 위치한다. RxJS의 `catchError`는 자신보다 상류(upstream)에서 발생한 에러만 잡으므로, `switchMap` 내부(캐시 충돌 시 던지는 `ConflictException`, 정상 동작)의 에러는 삼키지 않는다. 이 배치가 뒤집히면 멱등성 충돌 검출(핵심 보안/데이터 무결성 보장)이 조용히 죽는데, `idempotency.interceptor.spec.ts:405-428`("catchError 위치 캐너리")가 이를 회귀 테스트로 고정해 둔다. 과거 라운드(`14_27_02`)의 documentation 리뷰어가 보고한 "순서 역전" CRITICAL은 병렬 리뷰 세션의 공유 워크트리 뮤테이션 아티팩트였음이 이미 재검증됐고(`14_50_36`, `15_04_25` 두 라운드에서도 독립 재확인), 이번 라운드의 직접 확인으로도 동일하게 정상 순서임을 확인했다.

- **[없음 — 확인 결과 문제 없음]** 인젝션·하드코딩된 시크릿·인증/인가·암호화·의존성
  - `readKey()`(`:189-194`)는 헤더 값의 타입·공백·길이(`MAX_KEY_LENGTH`=200)를 검증한다. `hashBody()`(`:196-201`)는 요청 바디를 SHA-256 해시로 변환해 Redis 키/값 조립에 사용하며, 문자열 명령 조립 없이 ioredis 파라미터화 API(`get`/`set`)만 사용하므로 Redis 인젝션 표면이 없다. `sha256` 사용은 요청 body 무결성 식별(비밀번호 해시 아님) 목적으로 적절하다. 인증/인가 로직 변경 없음, 하드코딩된 시크릿 없음, 새 의존성 추가 없음(`catchError`는 기존에 이미 사용 중인 `rxjs/operators`에서 import만 추가). `catchError` 추가로 새로 생기는 attack surface는 없다 — 기존 Redis GET 호출의 에러 처리 경로만 바뀌었다.
  - `idempotency.interceptor.spec.ts`는 순수 단위 테스트, `CHANGELOG.md`/`plan/in-progress/backend-lint-gate-broken-on-main.md`/`review/code/2026/08/12/{14_27_02,14_50_36,15_04_25}/*.md`(이전 리뷰 라운드 산출물 커밋분)는 서술·보고서 변경뿐이라 보안 검토 대상 코드가 아니다. `meta.json`/`_retry_state.json`에 박힌 워크트리 절대경로는 로컬 파일시스템 메타데이터일 뿐 시크릿이 아니다.

### 요약

이번 diff의 핵심은 `IdempotencyInterceptor.intercept()`에서 Redis `get()` 런타임 실패를 `catchError`로 흡수해 캐시 미스로 강등시킴으로써, `spec/data-flow/15-external-interaction.md`가 요구하는 "전 경로 fail-open — 가용성 우선"을 완성하는 것이다. 워크트리를 직접 열어 재검증한 결과 `catchError`(107행)는 `switchMap`(113행) 앞에 정확히 위치해 캐시 충돌 시 던지는 `ConflictException` 검출을 삼키지 않으며, 전용 캐너리 테스트로 회귀가 방지된다. 인젝션·하드코딩된 시크릿·인가 우회·안전하지 않은 암호화 등 전형적 취약점은 신규로도 기존으로도 발견되지 않았다. 유일하게 실질적으로 남는 보안 함의는 fail-open 설계 자체가 갖는 트레이드오프 — Redis 장애 구간 동안 `Idempotency-Key` 기반 중복 억제가 요청 단위로 사라져 다운스트림이 중복 실행될 수 있다는 것 — 인데, 이는 spec이 명시적으로 승인한 정책이고 이미 `CHANGELOG.md`·클래스 docstring·plan 백로그에 문서화·유예되어 있어 INFO로만 기록한다. 기존에 추적 중이던 409/410 캐시 제외 선재 결함(R8 초과)도 이번 diff로 인한 변경이 없다. 이 결론은 동일 변경에 대한 세 차례의 독립 리뷰 라운드(`14_27_02`, `14_50_36`, `15_04_25`)와도 일치한다.

### 위험도

NONE
