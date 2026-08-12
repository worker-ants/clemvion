### 발견사항

- **[WARNING]** `Idempotency-Key` 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않는다 — 이번 diff 로 409/410 캐싱이 dead code 에서 **실제로 도달 가능한 경로**가 되면서, 선재 설계 이슈였던 이 문제의 활성 표면이 실질적으로 넓어졌다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95` (`const redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`;` — `rawKey`(=`Idempotency-Key` 헤더 원문)만으로 키를 구성, `executionId`/인증 주체 미포함), 캐시 적재부는 `:186-201`(`catchError` → `storeEntry`), `:135-140`(캐시 히트 시 재현)
  - 상세: `InteractionGuard`(`interaction.controller.ts:58`)가 인터셉터보다 먼저 실행되어 임의 execution 접근 자체는 막는다(Nest 라이프사이클상 Guard → Interceptor). 하지만 서로 다른 `executionId`(따라서 서로 다른 interaction 토큰)에 대해 유효하게 인증된 두 요청이 **우연히 또는 공격자가 의도적으로** 동일한 `Idempotency-Key` 헤더 값과 동일한 요청 `body`(→ 동일 `bodyHash`)를 사용하면, 한쪽 execution 에서 캐시된 응답(이번 diff 이후로는 `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 오류 바디까지 포함)이 다른 execution 컨텍스트의 요청자에게 그대로 재생될 수 있는 구조는 그대로다. `409 STATE_MISMATCH` 응답 바디에는 `interaction.service.ts:508` 의 `Execution is not waiting for input (current=${execution.status})` 처럼 대상 execution 의 내부 상태 enum 값이 포함돼, 다른 execution 의 상태 일부가 교차 노출될 수 있다. 익스플로잇에는 정확한 `Idempotency-Key` 값 추측/획득 + 동일 `body` 재현이 모두 필요해 난이도가 낮지 않고, 이는 이번 diff 가 새로 만든 아키텍처 결함이 아니라 기존 캐시 키 설계의 특성이다 — 다만 직전 세 라운드(`16_29_45`/`16_53_26`/`17_07_45`) 리뷰가 이미 동일하게 지적했고 세 번째 라운드부터 "이론상 위험 → 실제 활성 경로로 전환"됐다고 우선순위를 올려 기록했다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그(INFO 7·8)에 이미 등재돼 있어 은폐된 갭은 아니다.
  - 제안: 이번 PR 을 막을 사유는 아니나(스코프는 §R8 캐시 대상 정합화이지 키 스코핑 재설계가 아님), `redisKey` 에 `executionId`(또는 인증된 scope 식별자)를 포함시켜 캐시를 요청 컨텍스트로 완전히 격리하는 후속 작업의 우선순위를 실제로 올릴 것을 재확인 권고. plan 백로그 항목이 이미 존재하므로 새 항목 추가는 불필요.

- **[INFO]** 캐시 적재 실패 시 원 예외를 삼키던 잠재 결함(`storeEntry` 직렬화 실패가 `catchError` 셀렉터를 통째로 대체해 클라이언트가 500 을 받는 경로)이 `try/catch` 로 정확히 격리되어 있음을 확인 — 새 결함 아님, 검증 완료
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:214-233` (`storeEntry`, 특히 `222-233` 의 `try { entry = {...} } catch (err) { this.logger.warn(...); return; }`)
  - 상세: `catchError` 콜백(`:186-201`)이 `storeEntry`를 호출하는 자리에서 직렬화(`JSON.stringify(payload ?? null)`)가 throw 하면 그 새 에러가 원래의 409/410 예외를 대체해 "응답을 기록할 뿐 삼키지 않는다"는 불변식이 깨질 수 있었는데(직전 라운드 `17_07_45` WARNING #1), 현재 코드는 이를 `try/catch` 로 감싸 실패 시 적재만 skip 하고 원 예외(`throwError(() => err)`, `:200`)가 항상 실행되도록 고쳐 두었다. 인젝션/가용성 관점에서 이 fix 가 정확함을 소스 직접 대조로 확인.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 409/410 dead-code CRITICAL(직전 `16_29_45` 라운드)이 최종적으로 `catchError` 기반 아키텍처로 해소되어 있음을 재확인 — 인증/인가 로직에는 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:163-203`(`cacheTapped`), `interaction.controller.ts:58,65-66`(`@UseGuards(InteractionGuard, InteractionRateLimitGuard)` + `@HttpCode(202)` + `@UseInterceptors(IdempotencyInterceptor)` 순서 확인)
  - 상세: `cacheTapped()`가 `tap({next})`(2xx) 와 `catchError`(409/410 `HttpException`)를 모두 관측 범위에 넣고, 캐시 히트 시에도 409/410 은 성공 채널이 아닌 `HttpException` 재throw(`:135-140`)로 재현해 `@HttpCode(202)` 데코레이터에 의한 상태코드 왜곡을 정확히 피한다. `InteractionGuard`/`InteractionRateLimitGuard` 는 인터셉터보다 먼저 실행되므로 이번 재설계가 인증/인가 순서·범위에 손대지 않았음을 확인했다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 새로 추가된 e2e 테스트(`external-interaction.e2e-spec.ts` I-1/I-2)의 Redis 접속 정보·JWT 서명 시크릿은 하드코딩된 운영 시크릿이 아니라 기존 테스트 fixture 패턴(env var 기본값, `-do-not-use-in-prod-` 접미사가 붙은 더미 값)을 그대로 재사용한 것 — 신규 노출 아님
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:134-138`(Redis 연결, `process.env.REDIS_HOST ?? 'redis'` 등), 기존 `mintInteractionToken`/`JWT_SECRET` 상수는 이 diff 밖(pre-existing)
  - 제안: 없음.

- **[INFO]** 인젝션(SQL/XSS/커맨드/경로탐색)·암호화 약화·에러 메시지 민감정보 노출·의존성 관련 새 결함은 발견되지 않음
  - 위치: 전체 diff (`CHANGELOG.md`, `idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`, `external-interaction.e2e-spec.ts`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/data-flow/15-external-interaction.md`, `review/code/2026/08/12/{16_29_45,16_53_26,17_07_45}/**`)
  - 상세: DB 쿼리(e2e 신규 `INSERT`)는 전부 parameterized(`$1,$2,...`) — SQL 인젝션 없음. `JSON.parse`/`JSON.stringify` 는 Redis 에서 자신이 적재한 값만 역직렬화하며 외부 임의 스키마를 신뢰하지 않는다. 신규 `import`(`HttpException`, `throwError`, 테스트의 `BadRequestException`/`GoneException`/`InternalServerErrorException`/`NotFoundException`)는 표준 Nest/RxJS 심볼이며 알려진 취약 버전 고정이 없다. 문서·plan·review 산출물 파일들은 서술뿐이며 시크릿·자격증명 포함 없음.
  - 제안: 없음.

### 요약

이번 diff(3라운드 누적 최종 상태: `eia-r8-cache-scope` — 409/410 캐시 대상 확장 → dead-code CRITICAL 재설계 → 자매 케이스(400) 누락 수정 → 직렬화 실패 격리 + e2e 추가)는 `IdempotencyInterceptor`의 캐시 대상을 Spec EIA §R8 의 닫힌 목록(`2xx`·`409`·`410`)에 맞게 정합화하고 실제로 도달 가능한 RxJS error 채널까지 포괄하도록 재설계한 버그 수정이다. 소스를 직접 열어 대조한 결과 `InteractionGuard`/`InteractionRateLimitGuard` 가 인터셉터보다 먼저 실행되는 인증/인가 순서는 변경되지 않았고, 신규 SQL/인젝션·하드코딩 시크릿·암호화 약화·민감정보 노출 결함은 없으며, 직전 라운드가 지적했던 "캐시 적재 실패가 원 예외를 삼킬 수 있는" 경로도 `try/catch` 로 정확히 격리돼 있다. 유일하게 지속되는 항목은 idempotency 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않는 선재 설계이며, 이번 변경으로 409/410 캐싱이 실제 발동 경로가 되면서 그 이론상 노출 표면이 실질적으로 활성화됐다는 점 — 다만 익스플로잇 난이도(정확한 키+body 매칭 필요)와 이미 plan 백로그에 등재·추적되고 있다는 점을 감안해 이번 PR 을 막을 사유는 아니며 후속 우선순위 재확인 권고로 WARNING 처리한다.

### 위험도
LOW
