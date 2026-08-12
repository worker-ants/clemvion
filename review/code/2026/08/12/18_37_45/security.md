# 보안(Security) Review

## 발견사항

- **[WARNING]** Idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않아 서로 다른 execution 간 응답 재현(cross-execution replay)이 이론상 가능 — 이번 diff 가 캐시 대상을 에러 응답(409/410)까지 넓히면서 노출 범위가 커졌다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95` (`const redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`;`), 판정 함수 `:255-257` (`isErrorStatusCacheable`)
  - 상세: `redisKey` 는 클라이언트가 보낸 `Idempotency-Key` 헤더 원문(`rawKey`)만으로 구성되고 `executionId`·인증 주체(토큰 `sub`)를 전혀 포함하지 않는다(`intercept()` 메서드, `idempotency.interceptor.ts:88-150`). 캐시 히트 판정은 `bodyHash`(요청 body 의 SHA-256, `idempotency.interceptor.ts:266-271`) 일치 여부만 추가로 보므로, 서로 다른 두 execution 의 호출자가 (a) 우연히 또는 의도적으로 같은 `Idempotency-Key` 값을 쓰고 (b) 요청 body 가 동일하면, 나중 요청자가 먼저 요청자의 캐시된 응답(상태코드+본문)을 그대로 돌려받는다. `InteractionGuard`(`interaction.guard.ts`)가 Nest 파이프라인에서 인터셉터보다 먼저 실행되어 호출자가 **자신의** execution 에 대한 유효 토큰을 갖고 있어야만 이 지점에 도달하지만, 그 토큰은 요청 대상 execution(자기 자신)만 검증할 뿐 idempotency 캐시 네임스페이스는 검증하지 않는다 — 즉 "자기 토큰으로 남의 execution 응답을 엿본다"는 인가 경계 우회가 구조적으로 가능하다. 이번 diff 이전에는 캐시 대상이 `2xx`(및 구현결함으로 인한 `3xx`)뿐이었는데, 이번 fix 로 `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 에러 응답까지 캐시 대상에 정식으로 추가되면서 같은 미스코프 문제의 노출 표면(캐시에 실리는 응답 종류)이 넓어졌다. 이 항목은 이미 직전 리뷰 라운드(`review/code/2026/08/12/16_29_45/RESOLUTION.md` INFO 7·8)에서 발견되어 "이번 PR 범위 밖" 으로 명시적으로 유예됐고, 그 문서 스스로도 "캐시 대상이 에러 응답까지 넓어졌으므로 후속 가치가 올라갔다" 고 인정하고 있다 — 신규 회귀가 아니라 기존에 알려진 설계 갭이며, 이번 PR 을 막을 필요는 없다고 판단하지만 보안 관점에서 다시 명시적으로 남긴다.
  - 제안: 캐시 키에 `context.switchToHttp().getRequest().params.executionId`(또는 `req.interaction.executionId`, 가드가 검증을 마친 뒤이므로 신뢰 가능)를 포함해 `interaction:idempotency:${executionId}:${rawKey}` 형태로 네임스페이스를 분리한다. 인증 주체(토큰 `sub`/`jti` 등)까지 묶으면 더 강한 격리가 되지만, execution 단위 스코프만으로도 이번 클래스의 cross-tenant 재현은 닫힌다. 별도 후속 작업으로 트래킹 권장(직전 라운드 INFO 7·8 승격).

- **[INFO]** 캐시된 에러 응답이 원 예외 payload 를 그대로 replay — 새로 노출되는 정보는 없음 (참고용)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:186-201`(`storeEntry` 호출), `:135-140`(재현 시 `HttpException` 재throw)
  - 상세: `cacheTapped()` 의 `catchError` 는 `err.getResponse()` 를 그대로 직렬화해 저장하고, 캐시 히트 시 동일 payload 로 재현한다. `interaction.service.ts` 가 던지는 `ConflictException`/`GoneException` payload(`{error:{code, message}}`)는 스택트레이스·내부 식별자 없이 이미 클라이언트에 직접 응답되던 내용과 동일하므로, 캐싱 자체가 새로운 정보를 추가로 노출하지는 않는다(위 WARNING 의 "누구에게" 노출되는지 문제와는 별개). `400 VALIDATION_ERROR`(필드별 상세 포함 가능)는 `isErrorStatusCacheable()`(§R8 닫힌 목록: `409`/`410`만) 이 명시적으로 제외해 캐시되지 않는다 — 새 회귀 테스트(`idempotency.interceptor.spec.ts:245-264`)로 고정됨.
  - 제안: 조치 불필요.

- **[INFO]** `MAX_KEY_LENGTH`(200자) + SHA-256 body hash — 입력 검증/DoS 방어는 적절
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:23`(`MAX_KEY_LENGTH`), `:259-264`(`readKey`), `:266-271`(`hashBody`)
  - 상세: `Idempotency-Key` 헤더 길이를 200자로 제한하고, body 는 문자열이 아니면 `JSON.stringify` 후 SHA-256 해시로 축약해 저장 — Redis 키/값 크기를 사용자 입력으로 무한정 키울 수 없다. 해시 알고리즘(SHA-256)도 이 용도(동일성 비교, 예측 방지가 목적 아님)에 적절하다.
  - 제안: 조치 불필요.

## 요약

이번 diff 의 본질은 `IdempotencyInterceptor` 의 캐시 적재 조건을 Spec EIA §R8 의 닫힌 목록(`2xx`·`409`·`410`)에 맞추고, `409`/`410` 이 RxJS error 채널로 오는 실제 파이프라인 경로 위에서 캐시가 동작하도록 `catchError` 로 재설계한 버그 수정이다. 인젝션(SQL/커맨드/경로탐색)·하드코딩 시크릿·안전하지 않은 해시(SHA-256 사용은 적절)·평문 전송 문제는 발견되지 않았고, `InteractionGuard` 가 인터셉터보다 먼저 실행되어 미인증 요청은 캐시 조회/적재 경로에 도달하지 못한다. 유일한 실질적 우려는 idempotency 캐시 키가 `executionId`/인증 주체로 스코프되지 않아 이론상 cross-execution 응답 재현이 가능하다는 기존 설계 갭인데, 이는 이미 직전 리뷰 라운드에서 발견되어 "이번 PR 범위 밖" 으로 명시적으로 유예된 항목이며 이번 diff 는 그 노출 표면(캐시되는 응답 종류)을 넓혔을 뿐 새로 만들지는 않았다. 이번 PR 자체를 막을 사유는 없으나, 후속 작업으로 캐시 키 스코핑을 execution 단위로 좁힐 것을 권고한다.

## 위험도

LOW
