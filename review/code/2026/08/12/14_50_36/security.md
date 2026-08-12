# 보안(Security) 코드 리뷰 — EIA idempotency fail-open fix

## 검증 방법

리뷰 중 작업 트리를 직접 열어(`git status --porcelain`, `git diff HEAD -- .../idempotency.interceptor.ts`,
`grep -n "catchError|switchMap" .../idempotency.interceptor.ts`) `catchError` 배치를 독립 재검증했다.
결과: 워킹 트리 clean, `catchError` 107행 < `switchMap` 113행 — **`catchError` 가 정확히 `switchMap`
앞**에 있다. 이전 리뷰 라운드(`review/code/2026/08/12/14_27_02/`)에서 documentation 리뷰어가 보고했던
"순서 역전" CRITICAL 은 그 세션이 이미 오탐(병렬 리뷰어의 공유 worktree 뮤테이션 잔재)으로 판정했고,
이번 재확인으로도 동일하게 확인된다 — 현재 코드에 그 결함은 없다.

## 발견사항

- **[INFO]** Redis `get()` 실패 시 fail-open이 Idempotency-Key 중복 억제를 전면 무력화한다 — spec 이 명시적으로 요구한 설계
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `catchError` 블록 (107-112행, `intercept()` 내부)
  - 상세: `from(this.redis.get(redisKey))` 뒤에 붙은 `catchError` 는 GET 예외(연결 끊김·타임아웃 등)를 무차별로 캐시 미스(`of(null)`)로 강등한다. `spec/data-flow/15-external-interaction.md` 가 "전 경로 fail-open — 가용성 우선"을 명시적으로 요구하므로 방향 자체는 spec 의도와 정확히 일치하고, 이번 diff 목적이 정확히 그 갭(런타임 reject 가 500 fail-closed 로 이어지던 결함)을 닫는 것이다. 다만 보안 관점에서 짚을 잔여 위험: Redis 가 불안정한 구간에는 같은 `Idempotency-Key` 로 반복 제출된 비멱등 다운스트림 작업(예: execution 생성 등 side-effect 가 있는 호출)이 요청 단위 재현 보장 없이 중복 실행될 수 있다 — 클라이언트의 의도적 재시도 남용이든 우발적 재전송이든, 그 구간에는 서버 측 억제 수단이 없다. 이는 코드 결함이 아니라 spec 이 승인한 트레이드오프이며, `CHANGELOG.md`·클래스 docstring(52-73행)·`plan/in-progress/backend-lint-gate-broken-on-main.md`(WARNING #1 처리 이력)에 이미 문서화·유예되어 있어 재차 등재할 필요는 없다.
  - 제안: 조치 불요(문서화 완료, 관측 지표 검토는 이미 plan 백로그에 있음). 다운스트림이 실제로 비-멱등(예: 결제·과금성 side-effect)인 경로가 있다면 그쪽 핸들러 자체에 별도의 애플리케이션 레벨 dedup(예: DB unique constraint)이 있는지 별도로 확인해 두는 편이 안전하다.

- **[INFO]** 에러 메시지를 서버 로그에만 기록 — 클라이언트 미노출
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — GET 실패 로그(108-110행, `err instanceof Error ? err.message : String(err)`), SET 실패 로그(176-179행, 기존 코드·이번 diff 로 미변경)
  - 상세: ioredis 예외의 `err.message` 를 Nest `Logger` 로만 남기고 HTTP 응답에는 노출하지 않는다. 정보 노출 취약점 아님. ioredis 일반 에러 메시지(`ECONNRESET`, `ETIMEDOUT` 등)는 통상 자격증명을 포함하지 않으나, AUTH 실패류 메시지가 드물게 연결 설정 일부를 담을 가능성은 이론상 있다 — 참고 기록 수준.
  - 제안: 조치 불요.

- **[INFO]** (선재 결함, 이번 diff 로 변경 없음) 캐시 제외 범위가 spec R8 보다 넓어 409·410 응답까지 idempotency 재현 보장에서 빠진다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `cacheTapped()` 의 `if (statusCode >= 400) return;` (168행)
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8 은 "`400 VALIDATION_ERROR` 만 캐시 제외, 2xx/409/410 은 캐시"를 요구하는데 구현은 `>= 400` 전체를 제외한다. 이번 diff 는 이 동작을 바꾸지 않고 캐너리 테스트(`idempotency.interceptor.spec.ts` 의 409 테스트)로 현재 동작만 고정했다. 신규 취약점 아님 — `cacheTapped()` docstring(139-150행)이 선재 결함으로 정직하게 문서화하고 있고 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 백로그로 추적 중이다. 보안 함의로 보면, 409 재요청이 캐시되지 않아 매번 body 비교 로직을 다시 타므로 정보 노출 확대는 없고, 재현 실패는 클라이언트가 다시 시도해야 하는 가용성 저하 정도다.
  - 제안: 조치 불요(스코프 밖, 이미 추적됨).

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩된 시크릿, 인증/인가 우회, 세션 관리, 안전하지 않은 해시 사용
(`sha256` 은 요청 body 무결성 식별용이지 비밀번호 해시가 아니므로 적절), 의존성 취약점 관련 신규 이슈는
발견되지 않았다. `readKey()`(190-194행 부근)는 헤더 값의 타입·공백·길이(`MAX_KEY_LENGTH`=200)를 검증하고,
`hashBody()`(197-201행)는 요청 바디를 SHA-256 해시로 변환해 Redis 키/값 조립에 사용하며 별도 명령
문자열 조립이 없어(ioredis 파라미터화 API 사용) Redis 인젝션 표면도 없다. `catchError` 추가로 새로
생기는 attack surface 는 없다 — 기존 Redis GET 호출의 에러 처리 경로만 바뀌었다. 테스트 파일
(`idempotency.interceptor.spec.ts`)은 순수 단위 테스트이며 프로덕션 코드와 동일한 해시 규칙을
재사용하는 헬퍼(`bodyHashOf`)만 추가됐다 — 보안 이슈 없음. `CHANGELOG.md`·`plan/in-progress/...md`·
`review/code/2026/08/12/14_27_02/*.md`(이전 리뷰 라운드 산출물 커밋분)는 서술/보고서 변경뿐이라
보안 검토 대상 코드가 아니다.

## 요약

이번 diff 의 핵심은 `IdempotencyInterceptor` 의 Redis `get()` 런타임 실패를 `catchError` 로 흡수해
캐시 미스로 강등시킴으로써, spec(`spec/data-flow/15-external-interaction.md`)이 요구하는 "전 경로
fail-open — 가용성 우선"을 완성하는 것이다. 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화 등
전형적 취약점은 신규로도 기존으로도 발견되지 않았고, `catchError` 위치(`switchMap` 앞)는 직접
재검증한 결과 정확하며 캐시 충돌(`ConflictException`) 검출을 삼키지 않는다(이전 라운드에서 다른
리뷰어가 보고한 순서 역전 CRITICAL 은 이번 재확인으로도 오탐임을 재확인). 유일하게 실질적으로
남는 보안 함의는 fail-open 설계 자체가 갖는 트레이드오프 — Redis 장애 구간 동안 Idempotency-Key
기반 중복 억제가 요청 단위로 사라져 다운스트림이 중복 실행될 수 있다는 것 — 인데, 이는 spec 이
명시적으로 승인한 정책이고 이미 CHANGELOG·docstring·plan 백로그에 문서화·유예되어 있어 INFO 로만
기록한다. 기존에 추적 중이던 409/410 캐시 제외 선재 결함도 이번 diff 로 인한 변경이 없다.

## 위험도

NONE
