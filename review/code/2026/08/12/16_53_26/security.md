### 발견사항

- **[INFO]** Idempotency 캐시 키가 여전히 `Idempotency-Key` 값에만 바인딩되고 execution/인증 컨텍스트로 스코프되지 않는다 — 이번 fix 로 409/410 캐싱이 **실제로 동작하게** 되면서(직전 라운드 `16_29_45` CRITICAL: 종전엔 도달 불가능한 dead code 였음), 이 선재 설계 이슈가 이론상 위험에서 실제 활성 경로로 바뀌었다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95`(`redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`` — executionId/인증 컨텍스트 미포함), 캐시 재현/적재부는 `:135-140`(`HttpException` 재throw), `:186-197`(`catchError` 에서 `storeEntry` 호출)
  - 상세: `InteractionGuard` 가 먼저 인증/인가를 검증하므로 임의 execution 접근 자체는 막힌다. 다만 서로 다른 인증된 요청이 우연히(또는 예측 가능한 클라이언트측 키 생성 규칙으로) 동일한 `Idempotency-Key` 값 + 동일 `body`(→ 동일 `bodyHash`)를 사용하면, 한쪽 execution 에서 캐시된 `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 응답이 다른 요청자에게 그대로 재생될 수 있는 구조는 그대로다. 직전 라운드 리뷰(`review/code/2026/08/12/16_29_45/security.md`)가 이를 "익스플로잇 난이도가 낮지 않다"는 이유로 INFO 로 유예했는데, 그 시점엔 해당 캐싱 분기 자체가 dead code 라 실질적으로 발동조차 하지 않았다. 이번 fix 로 그 전제가 사라졌으므로 후속 검토 우선순위를 한 단계 올려 둘 가치가 있다(단, 이번 diff 의 범위는 §R8 캐시 대상 정합화이지 키 스코핑 재설계가 아니므로 이 PR 을 막을 사유는 아니다).
  - 제안: 후속 항목으로 `redisKey` 에 `executionId`(또는 인증된 scope 식별자)를 포함시켜 캐시를 요청 컨텍스트로 격리할 것을 권고. plan 백로그(`plan/in-progress/backend-lint-gate-broken-on-main.md`)의 INFO 7·8 항목이 이미 이 유예를 기록하고 있으므로, 이번 라운드에서는 "이제 실제로 발동하는 경로가 됐다"는 한 줄만 덧붙이면 충분하다.

- **[INFO]** `catchError` 가 캐시에 적재하는 값(`err.getResponse()`)은 `interaction.service.ts` 가 던지는 예외 payload 를 검증 없이 그대로 직렬화한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:186-197`(`storeEntry(redisKey, bodyHash, statusCode, err.getResponse())`), `:205-225`(`storeEntry` 구현 — `JSON.stringify(payload ?? null)`)
  - 상세: 현재 이 경로로 캐시되는 두 예외(`interaction.service.ts` 의 `ConflictException({ error: { code: 'STATE_MISMATCH', message: ... } })`, `GoneException({ error: { code: 'EXECUTION_TERMINATED', message: ... } })`)는 고정 문자열 또는 `execution.status` enum 값만 포함해 민감정보 노출은 없음을 확인했다(`interaction.service.ts:253-259`, `:431-436`, `:478-480`, `:503-511`). 다만 `isErrorStatusCacheable()` 은 상태코드(409/410)만으로 판정하므로, 향후 다른 코드 경로가 그 상태코드로 스택트레이스·내부 diagnostic 을 담은 `HttpException` 을 던지게 되면 검증 없이 24h 캐시·재생 대상이 된다 — 이 인터셉터 자체의 책임 범위 밖이지만 향후 회귀 지점으로 남는다.
  - 제안: 조치 불요(이번 diff 범위 밖) — 다만 `interaction.service.ts` 의 409/410 throw 지점을 변경할 때는 응답 payload 에 내부 정보가 실리지 않는지 재확인할 것.

- **[INFO]** 캐시 히트 재현 경로의 `JSON.parse(cached.responseJson)`(에러/성공 두 분기 모두)이 자체 `try/catch` 없이 호출되지만, 손상된 값이 `SyntaxError` 를 던지더라도 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)가 비-`HttpException` `Error` 를 `UNHANDLED_ERROR_MESSAGE` 고정 문구로 마스킹하고 원문은 서버 로그로만 남긴다(CWE-209 대응 기존 컨트롤 확인). 새로 도입된 위험 아님 — 정보 노출 없음을 확인한 참고 기록.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`(신규 error 분기), `:143`(기존 성공 분기, 변경 없음)
  - 제안: 없음.

- **[INFO]** CHANGELOG·plan·spec(`data-flow/15-external-interaction.md`) 문서 diff 는 코드 동작 서술뿐이며 자체 보안 결함 없음. 신규로 추가된 리뷰 산출물 파일들(`review/code/2026/08/12/16_29_45/*.md`, `_retry_state.json`, `meta.json`)에도 하드코딩 시크릿·자격증명·민감 데이터는 없음(경로·타임스탬프·리뷰 텍스트만 포함).
  - 위치: `CHANGELOG.md:3-27`, `spec/data-flow/15-external-interaction.md:258`, `review/code/2026/08/12/16_29_45/**`
  - 제안: 없음.

## 종합 판단

이번 diff 의 핵심(`idempotency.interceptor.ts` 의 `cacheTapped`/`intercept` 재설계 — `tap({next})` 단독 구조를 `tap({next}) + catchError` 로 확장하고 캐시 히트 시 409/410 을 `HttpException` 으로 재throw)은 인증/인가 로직(`InteractionGuard`)에 손대지 않았고, 새로운 인젝션·하드코딩 시크릿·암호화 약화·에러 메시지 노출 문제는 발견되지 않았다. `isErrorStatusCacheable()` 이 409/410 두 값만 허용하는 닫힌 allowlist 라 캐시 적재 범위가 통제되어 있고, 캐시 손상 시의 정보 노출도 기존 `GlobalExceptionFilter` 마스킹으로 방어된다. 유일하게 지속 관찰이 필요한 항목은 idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않는 선재 설계인데, 이번 fix 로 409/410 캐싱이 dead code 에서 실제 동작 경로로 바뀌면서 그 노출 표면이 이론상 위험에서 실제 활성 경로로 전환됐다는 점만 기록해 둔다(이번 PR 을 막을 사유는 아님, 후속 우선순위 재검토 권고).

## 요약
`Idempotency-Key` 캐시 대상을 Spec EIA §R8 의 닫힌 목록(`2xx`·`409`·`410`)에 맞게 재설계하고 실제로 도달 가능한 경로(error 채널의 `catchError`)로 고친 버그 수정이며, 인증/인가·인젝션·시크릿·암호화·에러 노출 관점에서 새로 도입된 취약점은 없다. 유일한 지속 항목은 idempotency 캐시 키가 execution 단위로 스코프되지 않는 선재 설계로, 이번 fix 로 그 캐싱이 실제 발동하게 되어 노출 표면이 이론에서 실제로 전환됐다(익스플로잇 난이도는 여전히 낮지 않음).

## 위험도
LOW
