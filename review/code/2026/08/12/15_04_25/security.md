### 검증 방법

작업 트리를 직접 열어(`Read`) `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 의 현재 커밋 상태를 재확인했다. `git status --porcelain -- codebase/backend/src/modules/external-interaction/` → 변경 없음(clean). `catchError` 는 107행, `switchMap` 은 113행 — **`catchError` 가 `switchMap` 앞**에 정확히 위치한다. 과거 두 라운드(`14_27_02`, `14_50_36`)에서 documentation 리뷰어가 "순서 역전" CRITICAL 을 보고했던 것은 병렬 리뷰 세션의 공유 워크트리 뮤테이션 아티팩트였음이 이미 재검증됐고, 이번 독립 재확인에서도 동일하게 정상 순서를 확인했다 — 코드 결함 아님.

### 발견사항

- **[INFO]** Redis `get()` fail-open이 Idempotency-Key 기반 중복 억제를 전면 무력화한다 — spec 이 명시적으로 요구한 설계
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98-112` (`catchError` 블록, `intercept()` 내부)
  - 상세: `from(this.redis.get(redisKey))` 뒤의 `catchError` 가 GET 예외(연결 끊김·타임아웃 등)를 무차별로 캐시 미스(`of(null)`)로 강등한다. `spec/data-flow/15-external-interaction.md` 가 "전 경로 fail-open — 가용성 우선"을 명시적으로 요구하므로 방향은 spec 의도와 일치한다. 다만 Redis 가 불안정한 구간에는 같은 `Idempotency-Key` 로 반복 제출된 비멱등 다운스트림 작업(예: execution 생성)이 요청 단위 재현 보장 없이 중복 실행될 수 있다 — 이 구간에는 서버 측 억제 수단이 없다. 이는 코드 결함이 아니라 spec 이 승인한 트레이드오프이며, `CHANGELOG.md`·클래스 docstring(51-73행)·`plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이미 문서화·유예되어 있다.
  - 제안: 조치 불요(문서화·백로그 등재 완료). 다운스트림이 실제로 비멱등(결제·과금성 side-effect)인 경로가 있다면 그쪽 핸들러 자체에 DB unique constraint 등 애플리케이션 레벨 dedup 이 있는지 별도 확인 권장.

- **[INFO]** 에러 메시지를 서버 로그에만 기록 — 클라이언트 미노출, 정보 노출 취약점 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-111` (GET 실패, `err instanceof Error ? err.message : String(err)`), `:174-180` (SET 실패, 기존 코드·이번 diff 로 미변경)
  - 상세: ioredis 예외의 `err.message` 를 Nest `Logger` 로만 남기고 HTTP 응답에는 노출하지 않는다. ioredis 일반 에러 메시지(`ECONNRESET`, `ETIMEDOUT` 등)는 통상 자격증명을 포함하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** (선재 결함, 이번 diff 로 변경 없음) 캐시 제외 범위가 spec R8 보다 넓어 409·410 응답까지 idempotency 재현 보장에서 빠진다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168` (`cacheTapped()` 의 `if (statusCode >= 400) return;`)
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8 은 "`400 VALIDATION_ERROR` 만 캐시 제외"를 요구하는데 구현은 `>= 400` 전체를 제외한다. 이번 diff 는 이 동작을 바꾸지 않았고 `cacheTapped()` docstring(144-156행)이 이미 선재 결함으로 정직하게 문서화하며 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 백로그로 추적 중이다. 보안 함의로는 정보 노출 확대가 아니라 재현 실패(가용성 저하) 수준.
  - 제안: 조치 불요(스코프 밖, 이미 추적됨).

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩된 시크릿, 인증/인가 우회, 세션 관리 문제, 안전하지 않은 암호화(`sha256` 은 요청 body 무결성 식별용이지 비밀번호 해시가 아니므로 적절), 의존성 취약점 관련 신규 이슈는 발견되지 않았다. `readKey()`(189-194행)는 헤더 값의 타입·공백·길이(`MAX_KEY_LENGTH`=200)를 검증하고, `hashBody()`(196-201행)는 요청 바디를 SHA-256 해시로 변환해 Redis 키/값 조립에 사용하며 문자열 명령 조립이 없어(ioredis 파라미터화 API) Redis 인젝션 표면도 없다. `catchError` 추가로 새로 생기는 attack surface 는 없다 — 기존 Redis GET 호출의 에러 처리 경로만 바뀌었다. 테스트 파일(`idempotency.interceptor.spec.ts`)은 순수 단위 테스트로 보안 이슈 없음. `CHANGELOG.md`, plan 문서, 이전 리뷰 라운드(`14_27_02`, `14_50_36`) 산출물 커밋분은 서술/보고서 변경뿐이라 보안 검토 대상 코드가 아니며, 워크트리 절대경로가 `meta.json`/`_retry_state.json` 에 박혀 있는 것은 시크릿이 아니라 로컬 파일시스템 경로 메타데이터라 노출 취약점이 아니다.

### 요약

이번 변경(및 그 뒤를 이은 두 리뷰 라운드의 처분 반영)의 핵심은 `IdempotencyInterceptor` 의 Redis `get()` 런타임 실패를 `catchError` 로 흡수해 캐시 미스로 강등시킴으로써 spec 이 요구하는 "전 경로 fail-open — 가용성 우선" 을 완성하는 것이다. 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화 등 전형적 취약점은 신규·기존 모두 발견되지 않았다. `catchError` 삽입 위치(`from(get()).pipe(` 직후·`switchMap` 앞, 소스 107행/113행)를 직접 재검증한 결과 정확하며, 캐시 충돌 시 던지는 `ConflictException` 검출을 삼키지 않는다 — 과거 라운드에서 보고된 순서 역전 CRITICAL 은 공유 워크트리 뮤테이션 아티팩트였고 이번 재확인으로도 재현되지 않는다(현재 코드에 그 결함 없음). 유일하게 실질적으로 남는 보안 함의는 fail-open 설계 자체의 트레이드오프 — Redis 장애 구간 동안 Idempotency-Key 기반 중복 억제가 요청 단위로 사라져 다운스트림이 중복 실행될 수 있다는 것 — 인데, 이는 spec 이 명시적으로 승인한 정책이고 이미 CHANGELOG·클래스 docstring·plan 백로그에 문서화·유예되어 있어 INFO 로만 기록한다. 기존에 추적 중이던 409/410 캐시 제외 선재 결함(R8 초과)도 이번 diff 로 인한 변경이 없다.

### 위험도

NONE
