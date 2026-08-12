# 부작용(Side Effect) Review — EIA §R8 idempotency 캐시 재설계 (`cacheTapped` → `tap`+`catchError`)

이번 diff 는 직전 라운드(`16_29_45`)에서 CRITICAL(409/410 캐싱이 도달 불가능한 dead code)로 반려된
1차 시도를 `catchError` 기반으로 재설계한 2차 시도다. 1차 시도(단순 조건식 교체)는 이미
`16_29_45/side_effect.md` 가 리뷰했으나, 이번 `catchError` 아키텍처는 그 리뷰가 다룬 적 없는
새 코드 형태이므로 처음부터 다시 짚었다.

## 발견사항

- **[INFO]** 캐시 재현(cache-hit replay) 시 `409`/`410` 응답의 `requestId` 는 매 재현마다 새로 생성되어 "동일 응답" 이 완전한 바이트 동일은 아니다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:135-140`(캐시 히트 시 `throw new HttpException(JSON.parse(cached.responseJson), cached.statusCode)`), `codebase/backend/src/common/filters/http-exception.filter.ts:45`(`const requestId = uuidv4();`)·`:99-106`(`errorResponse.error.requestId`)
  - 상세: `storeEntry()`(`:205-225`)가 Redis 에 적재하는 `responseJson` 은 `err.getResponse()` 의 **원본 payload**(예: `{ error: { code: 'STATE_MISMATCH', message: … } }`, `requestId` 미포함 — `requestId` 는 `GlobalExceptionFilter.catch()` 가 그 이후 단계에서 `uuidv4()` 로 매번 새로 만들어 얹는다)다. 캐시 히트 시 이 원본 payload 로 `HttpException` 을 재구성해 다시 `throw` 하면, 그 예외는 (재현이든 원본이든 동일하게) `GlobalExceptionFilter` 를 다시 통과하며 그때마다 `requestId` 가 새로 발급된다. 즉 `code`/`message`/`details`/`statusCode` 는 정확히 재현되지만 `requestId` 는 요청마다 달라진다. CHANGELOG(`같은 Idempotency-Key 로 409/410 을 받은 뒤 재요청하면 이제 24h 동안 동일 응답이 재현된다`)·spec(`data-flow/15-external-interaction.md:258`, "2xx·409·410 응답 캐시")의 "동일 응답 재현" 서술은 이 미세한 예외(요청 추적용 `requestId` 는 매번 다름)를 언급하지 않는다. 기능적 결함은 아니며(클라이언트가 `requestId` 로 idempotent 매칭을 하지 않는 한 문제 없음), 정확히는 "부작용" 이라기보다 문서 서술의 정밀도 문제에 가깝다.
  - 제안: 조치 불요(선택). 필요하면 CHANGELOG/spec 에 "요청 추적용 `requestId` 는 재현마다 새로 발급된다" 한 줄만 덧붙이면 오해 소지가 없어진다.

- **[INFO]** `catchError` 확장이 인터셉터 자신이 던지는 `IDEMPOTENCY_KEY_CONFLICT` 409 는 캐시하지 않음을 확인 — 의도대로 정확히 스코프됨.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:122-129`(같은 키+다른 body → `throw new ConflictException({ code: 'IDEMPOTENCY_KEY_CONFLICT' })`, `switchMap` 콜백 내부에서 `next.handle()` 호출 **이전**에 던져짐) vs `:163-203`(`cacheTapped()` 의 `catchError` 는 `next.handle()` 이 반환한 Observable 에만 연결됨)
  - 상세: `cacheTapped()` 가 `.pipe(this.cacheTapped(...))` 로 감싸는 대상은 오직 `next.handle()`(다운스트림 서비스 호출) 뿐이다. 같은-키·다른-body 충돌 예외는 그 이전 단계(캐시 조회 직후)에서 던져지므로 이 `catchError` 를 절대 거치지 않는다 — 따라서 "충돌했다는 사실 자체"가 실수로 24h 캐시되는 일은 없다. 새 아키텍처가 도입한 넓은 `catchError` 표면이 의도치 않게 과잉 포착하지 않는지 확인하는 차원에서 기록.
  - 제안: 없음 — 정상.

- **[INFO]** `cacheTapped()` 반환 형태가 `tap({next})` 단일 오퍼레이터에서 `(source) => source.pipe(tap(...), catchError(...))` 커스텀 오퍼레이터로 바뀌었으나 private 메서드이고 호출부 2곳(`intercept()` 내 캐시 미스 분기 두 군데, `:120`·`:147`) 모두 이 diff 안에서 함께 갱신되어 외부 영향 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:163-203`(`cacheTapped` 정의), `:118-121`·`:145-148`(두 호출부)
  - 상세: `cacheTapped` 는 클래스 밖으로 노출되지 않는 `private` 메서드이며 반환 타입(`OperatorFunction<unknown, unknown>` 계열)도 여전히 `.pipe()` 에 바로 꽂을 수 있는 형태라 타입 호환성 유지. 공개 API(`intercept(context, next)`)·생성자 시그니처는 무변경.
  - 제안: 없음.

- **[INFO]** Redis SET 이 발생하는 지점이 `tap.next`(2xx) 와 `catchError`(409/410) 두 곳으로 늘었다 — 새 쓰기 부작용이지만 이 PR 의 의도된 목적 그 자체이고, 직전 라운드 side_effect 리뷰(`16_29_45/side_effect.md` WARNING #1)가 이미 지적·완화(3xx 캐시 축소 명시 + 회귀 테스트)했던 사안의 연장.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:170-178`(`tap.next` — `2xx`), `:186-197`(`catchError` — `409`/`410`), `:205-225`(공유 `storeEntry`)
  - 상세: 두 경로 모두 SET 여부 판정을 `isErrorStatusCacheable()`(`:239-241`, 에러 쪽) / `statusCode < 200 || statusCode >= 300` 인라인 조건(`:177`, 성공 쪽)으로 각각 나눠 갖되, 실제 Redis 쓰기(`storeEntry`)는 단일 함수로 공유해 캐시 엔트리 스키마(`IdempotencyEntry`)가 두 경로에서 갈라지지 않는다. fail-open(`SET` 실패 시 `warn` 후 무시, 원 예외/응답은 항상 반환) 도 그대로 유지.
  - 제안: 없음 — 이미 의도·문서화·테스트된 변경.

- **[INFO]** 캐시 히트 시 corrupted `cached.responseJson` 에 대한 방어가 새 에러 재현 분기(`:135-140`)에는 없다 — 다만 이는 기존 성공 재현 분기(`:143`, `JSON.parse(cached.responseJson)` 무가드)에 이미 있던 것과 **동일한 기존 위험 패턴**이라 이번 diff 가 새로 만든 취약점은 아니다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:135-140`(신규), `:143`(기존)
  - 상세: `intercept()` 상위에서 `cachedJson`(Redis GET 결과 전체) 파싱은 `try/catch` 로 손상 시 신규 처리로 폴백하지만(`:113-121`), 그 안의 `cached.responseJson`(엔트리 내부 필드) 자체의 파싱 실패는 두 분기(신규 에러 재현·기존 2xx 재현) 모두 방어가 없다 — 실패하면 `SyntaxError` 가 던져지고 `GlobalExceptionFilter` 가 일반 500 으로 마스킹한다(클라이언트 정보 유출은 없음, fail-closed 방향).
  - 제안: 조치 불요(선택) — 새로 도입된 위험이 아니라 기존 패턴의 연장이므로 이번 PR 스코프에서 고칠 이유는 없음. 필요하면 별도 항목으로 두 자리 모두 함께 방어.

## 요약

핵심 변경은 `cacheTapped()` 를 `tap({next})` 단일 오퍼레이터에서 `tap({next}) + catchError` 로 확장하고, 캐시 히트 시 `409`/`410` 을 성공 채널이 아닌 예외로 재-throw 하도록 재설계한 것이다. 함수 시그니처(`intercept`, 생성자)·공개 인터페이스·전역 변수·환경 변수·파일시스템·외부 네트워크 호출에는 변화가 없고, 새로 추가된 `catchError` 표면은 인터셉터 자신이 던지는 `IDEMPOTENCY_KEY_CONFLICT` 를 실수로 포착하지 않도록 정확히 `next.handle()` 관측 범위에만 걸려 있음을 확인했다. Redis SET 빈도가 늘어나는 것(2xx 외 409/410 에서도 SET 발생)은 이 PR 의 의도된 목적이며 직전 라운드에서 이미 검토·문서화됐다. 유일하게 새로 눈에 띄는 미세한 사항은 캐시 재현된 409/410 응답의 `requestId` 가 `GlobalExceptionFilter` 에 의해 매번 새로 발급돼 "동일 응답 재현" 이 `requestId` 를 제외하고는 참이라는 점 — 기능적 결함이 아니라 문서 서술의 정밀도 수준 이슈다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
