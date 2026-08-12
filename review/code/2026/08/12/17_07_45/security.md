# Security Review — `eia-r8-cache-scope` (idempotency 캐시 §R8 재설계)

## 발견사항

- **[INFO]** idempotency 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않은 채, 이번 변경으로
  캐시 대상이 `409`/`410` 오류 응답까지 실제로(전에는 dead code 라 발동 자체가 안 됐음) 확장됐다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95`
    (`redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`` — `executionId`/인증 주체 미포함),
    `:135-139`(캐시 히트 시 예외 재현), `:189-196`(`catchError` 적재)
  - 상세: `redisKey` 는 클라이언트가 보낸 `Idempotency-Key` 값에만 바인딩되고 URL 의
    `executionId` 나 인증 주체와 묶이지 않는다(선재 설계, 이번 diff 가 새로 만든 것은 아님).
    `InteractionGuard`/`InteractionRateLimitGuard` 는 매 요청마다 실행되므로 인증 우회 자체는
    없지만, 가드를 통과하기만 하면(예: 자신이 접근 가능한 임의 `executionId` 경로로) 동일한
    `Idempotency-Key` + 동일 `bodyHash` 조합에 대해 캐시된 응답이 그대로 재현된다. 종전에는
    `409`/`410` 캐싱 분기가 도달 불가능한 dead code 였기 때문에 이 표면은 `2xx` 응답에만
    실질적으로 걸렸는데, 이번 재설계로 `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 응답
    본문도 Redis 에 24h 보존되고 재현 대상이 됐다 — 노출 표면이 이론상 서술에서 실제 동작으로
    바뀌었다. 다만 익스플로잇하려면 공격자가 피해자의 `Idempotency-Key` 값(클라이언트가 생성하는
    난수/UUID 성격)과 동일한 `bodyHash` 를 모두 알아야 하므로 난이도는 낮지 않다. 캐시된
    `409`/`410` 본문 자체는 `interaction.service.ts` 가 고정 메시지(`STATE_MISMATCH`,
    `EXECUTION_TERMINATED`)로 던지는 구조라 현재는 민감 정보를 포함하지 않는다(해당 서비스
    코드는 이번 diff 범위 밖이라 참고로만 확인).
  - 제안: 이번 PR 범위 밖의 선재 설계이므로 즉시 조치를 요구하지는 않되, 후속 항목으로
    `redisKey` 에 `executionId`/인증 scope 를 포함하는 것을 검토. 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 관련 항목이 있는지 확인하고 없다면 등재 권장.

- **[INFO]** 캐시된 예외 payload(`err.getResponse()`)가 이제 Redis 에 24h 보존된다 — 상류
  (`interaction.service.ts`)가 향후 변경으로 예외 메시지에 민감 정보(예: 상세 diagnostic, 다른
  사용자 관련 식별자)를 섞으면 그 노출 창이 "요청 1회" 에서 "24h 재현 가능" 으로 늘어난다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:186-201`
    (`catchError` → `storeEntry` 적재), `:135-139`(재현)
  - 상세: 현재 `interaction.service.ts` 의 `ConflictException`/`GoneException` 은 고정
    코드·메시지만 담아 안전하다(`error.message` 가 client-safe 라는 주석이 인접 코드에 명시됨).
    다만 이 인터셉터가 `err.getResponse()` 를 무조건 캐시에 적재하는 구조라, 향후 그 서비스가
    debug 정보를 실수로 예외 payload 에 포함시키면 이 인터셉터가 그것을 그대로 24h 재생산하는
    증폭기 역할을 한다.
  - 제안: 즉시 조치 불요(방어 위치가 잘못된 것은 아님 — 캐시 대상 상태코드 판정은 여기, payload
    안전성은 발신 측 책임이 합리적 분업). `interaction.service.ts` 변경 시 예외 payload 에 대한
    리뷰 체크리스트 항목으로 남겨두는 정도면 충분.

- **[INFO]** `isErrorStatusCacheable()` 판정이 읽기 경로(재현, `:135`)와 쓰기 경로(적재,
  `:189`) 양쪽에 동일한 named 함수로 대칭 적용되어 있다 — 한쪽만 좁히거나 넓히는 비대칭 방어
  회귀는 관측되지 않는다. 긍정적 확인 사항으로 기록.

## 요약

이번 PR 은 `Idempotency-Key` 캐시가 `409`/`410` 을 실제로 caching/replay 하도록 RxJS
error 채널까지 포괄하는 재설계다. 인젝션(Redis 키는 client 헤더값이 그대로 문자열 결합되지만
ioredis 는 RESP 프로토콜을 쓰므로 구분자 기반 인젝션 표면이 없다), 하드코딩 시크릿, 인증 우회,
안전하지 않은 암호화(SHA-256 은 무결성 해시 용도로 적절, 캐시 조회에 쓰이는 것이지 비밀번호
해싱이 아님)와 관련해 새로 도입된 취약점은 없다. 인증/인가는 `InteractionGuard` /
`InteractionRateLimitGuard` 가 인터셉터보다 먼저 실행되므로 우회 경로가 없고, `catchError` 로
확장된 캐시 적재도 원 예외를 그대로 재throw 하여 삼키지 않는다(정보 은폐 없음). 유일하게 주목할
점은 선재 설계인 "idempotency 캐시 키가 실행/인증 컨텍스트로 스코프되지 않는다" 는 사실이
이번 변경으로 `409`/`410` 오류 응답까지 실질적으로 적용 대상이 된 것 — 다만 이는 이전 리뷰
라운드(`16_29_45`)에서 이미 INFO 로 식별·유예된 사항이고 이번 diff 가 익스플로잇 난이도를 낮추지
않았으므로 등급을 올리지 않는다.

## 위험도
LOW
