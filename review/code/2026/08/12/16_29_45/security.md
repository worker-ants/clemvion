### 발견사항

- **[INFO]** Idempotency 캐시 키가 `Idempotency-Key` 값에만 바인딩되고 `executionId`/인증 컨텍스트로 스코프되지 않음 (이번 diff 로 새로 생긴 문제는 아니나, 이번 변경으로 캐시 대상이 2xx 전용에서 `409`/`410` 오류 응답까지 확장되어 잠재 노출 표면이 넓어짐)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:94` (`redisKey = ${REDIS_KEY_PREFIX}${rawKey}` — executionId 미포함), 캐시 대상 확장부는 `:168-172`
  - 상세: `IdempotencyInterceptor.intercept()`는 Redis 키를 `interaction:idempotency:<rawKey>`로만 구성하며, 요청이 어느 `executionId`(멀티테넌트 리소스)에 대한 것인지로 네임스페이스를 나누지 않는다. `InteractionGuard`가 먼저 JWT/opaque 토큰을 검증해 임의 execution 접근 자체는 막지만, 공격자가 **자신이 유효한 토큰을 가진 다른 execution**에 대해 요청을 보내면서 피해자가 사용한 `Idempotency-Key` 값과 `body`(따라서 `bodyHash`)를 알아맞히면, 피해자 execution 에서 캐시된 응답(예: `executionId`, `currentStatus` 등)을 자신의 인증된 요청에 대한 응답으로 재생받을 수 있는 구조다. 이번 diff는 이 캐시 대상을 `2xx`만이 아니라 `409 STATE_MISMATCH`·`410 EXECUTION_TERMINATED` 오류 응답까지 넓혀, 같은 취약 벡터로 노출될 수 있는 페이로드 종류가 늘었다.
  - 제안: 익스플로잇 난이도(정확한 body 재현 + 키 추측)가 낮지 않아 즉시 위협은 아니지만, `redisKey`에 `executionId`(또는 인증된 scope 식별자)를 포함시켜 캐시를 요청 컨텍스트로 완전히 격리하는 것을 후속 항목으로 고려할 것을 권고. 이번 PR 범위(§R8 캐시 대상 확장) 밖의 선재 설계이므로 이번 diff 를 막을 사유는 아님.

- **[INFO]** 캐시된 오류 응답(`409`/`410`)의 payload 가 24h 동안 그대로 재생됨 — 컨트롤러 응답에 내부 상세가 포함되지 않는지는 이 diff 범위(인터셉터) 밖
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:173-176` (`entry.responseJson = JSON.stringify(value ?? null)`)
  - 상세: 인터셉터 자체는 응답 payload 를 그대로 직렬화해 캐시할 뿐이며 내용을 가공하지 않는다. `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 응답 바디에 내부 diagnostic 문자열(예: 스택트레이스, DB 오류)이 실리지 않는지는 `interaction.service.ts` 쪽의 책임이며 이번 리뷰 대상 파일에는 포함되어 있지 않다.
  - 제안: 별도 확인 필요 없음 — 참고용 기록. 해당 서비스 코드 변경 시 에러 응답에 내부 정보가 없는지 재확인할 것.

- **[INFO]** 문서(CHANGELOG.md, spec `15-external-interaction.md`) 변경은 코드 동작을 서술만 하며 자체 보안 결함 없음
  - 위치: `CHANGELOG.md:3-21`, `spec/data-flow/15-external-interaction.md:258`
  - 상세: 캐시 대상이 `2xx`·`409`·`410`인 닫힌 목록임을 서술하고, 기존에 있던 "⚠️ 현행 구현 갭" 각주를 제거했다. 실제 코드(`isCacheable` 조건)와 문서 서술이 일치함을 확인했다 — drift 없음.
  - 제안: 없음.

핵심 코드 변경(`idempotency.interceptor.ts`)은 `statusCode >= 400` 단일 비교를 `(2xx) || 409 || 410`의 닫힌 목록 비교로 교체해 Spec EIA §R8과 정합시킨 버그 수정이며, 인증/인가 로직(`InteractionGuard`가 먼저 실행)에는 손대지 않았고 새로운 인젝션·하드코딩 시크릿·암호화 약화·에러 메시지 노출 문제는 발견되지 않았다. 테스트(`idempotency.interceptor.spec.ts`)도 `409`/`410`/`5xx`/`404`/`400` 각 분기를 개별 검증해 `>= 400`·`=== 400` 두 형태의 오답을 모두 회귀 방지하도록 구성되어 있다. 유일한 주의점은 idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않는 선재 설계이며, 이번 변경이 그 캐시에 담기는 응답 종류(오류 응답 포함)를 넓혔다는 점 — 그러나 이는 이번 diff가 새로 만든 취약점이 아니라 기존 아키텍처의 특성이고, 익스플로잇 난이도도 낮지 않아 이번 PR을 막을 사유는 아니다.

### 요약
`Idempotency-Key` 캐시 대상을 Spec EIA §R8이 정한 닫힌 목록(`2xx`·`409`·`410`)에 맞게 좁힌 버그 수정으로, 인증/인가·인젝션·시크릿·암호화·에러 노출 관점에서 새로 도입된 취약점은 없다. 유일하게 짚을 사항은 idempotency 캐시 키가 execution 단위로 스코프되지 않는 선재 설계이며, 이번 변경이 캐시되는 응답 종류를 넓혀 그 표면을 다소 확장했다는 점(익스플로잇 난이도는 낮음, 후속 검토 권고 수준).

### 위험도
LOW
