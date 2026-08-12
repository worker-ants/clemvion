# API 계약(API Contract) Review

## 발견사항

- **[INFO]** 캐시 재현(replay) 시 에러 응답 봉투(`{error:{code,message,requestId}}`) 형식·상태코드가
  원 예외와 정확히 일치함을 소스 추적으로 확인 — 신규 위험 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:135-140`
    (`isErrorStatusCacheable` 판정 후 `throw new HttpException(...)`)
  - 상세: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)는
    `exception instanceof HttpException` 이면 `getResponse()` 의 nested `{error:{code,message,details}}`
    형태를 그대로 인식해 `code`/`message`/`details` 를 복원한다. 재현 시 생성하는
    `new HttpException(JSON.parse(cached.responseJson), cached.statusCode)` 는 base `HttpException`
    생성자를 직접 호출하므로 원본 `ConflictException`/`GoneException` 이 `createBody` 로 만들었던
    바디 오브젝트를 그대로 보존한다 — 클라이언트가 받는 `statusCode`·`error.code`·`error.message`
    는 최초 응답과 동일하다. `requestId` 만 필터가 매 응답마다 새로 발급(`uuidv4()`)하므로 재현
    대상이 아닌데, 이는 CHANGELOG.md:26-29 가 이미 명시한 대로다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** `409`/`410` 캐시 재현에 `throw` 를 쓰는 설계가 구조적으로 필수임을 확인 — 이 API 의
  `@HttpCode` 고정 데코레이터가 성공 채널의 수동 `res.status()` 를 무시하기 때문
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:186-201`
    (`catchError` 블록), 대조: `codebase/backend/src/modules/external-interaction/interaction.controller.ts:65-66,111-112`
    (`@HttpCode(HttpStatus.ACCEPTED)` + `@UseInterceptors(IdempotencyInterceptor)`)
  - 상세: `interact`/`cancel` 두 엔드포인트 모두 `@HttpCode(202)` 로 고정돼 있어, Nest 의
    라우터 응답 처리기는 인터셉터가 성공(next) 채널에서 무엇을 하든 최종적으로 데코레이터가
    지정한 상태코드로 응답을 보낸다. 이번 fix 이전 시도(`16_29_45` CRITICAL)가 실패했던 근본
    이유도 같은 메커니즘이다 — `tap({next})` 안에서 `res.statusCode` 를 아무리 세팅해도 실제
    전송되는 상태코드는 여전히 202 였다. 이번 구현은 `409`/`410` 재현을 예외 필터 파이프라인
    (`GlobalExceptionFilter` 가 `response.status(status).json(...)` 을 직접 호출)으로 우회시켜
    이 문제를 올바르게 회피한다 — API 계약(정확한 HTTP 상태코드 전달) 관점에서 이 설계가
    맞는 방식임을 재확인했다.
  - 제안: 없음 — 확인용 기록. 다만 이 전제(고정 `@HttpCode` 가 수동 `res.status()` 를 덮어씀)는
    향후 이 인터셉터를 `@HttpCode` 미고정 엔드포인트에 재사용할 경우 성립하지 않을 수 있으므로,
    재사용 시 이 가정을 재검증할 것.

- **[INFO]** "동일 Idempotency-Key 재조회 시 동일 응답 재현" 이라는 계약 준수 주장의 최종 검증층(e2e)이
  아직 비어 있다 — 이번 diff 범위 밖으로 이미 plan 에 등재됨
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:539`
    (`- [ ] **Idempotency-Key e2e 부재**`, 체크 안 됨)
  - 상세: 이번 CRITICAL(`16_29_45`)이 발생한 근본 원인이 "인터셉터 단위 mock 이 실제 Nest
    파이프라인(예외 채널·`@HttpCode`·직렬화)을 반영하지 못했다" 는 것이었고, 2차 수정에서는
    `throwError` 기반 mock 으로 그 채널을 현실적으로 재현해 CRITICAL 을 해소했다. 다만 이는
    여전히 인터셉터를 격리한 단위 테스트이고, 컨트롤러·가드·`@HttpCode`·전역 예외 필터를 모두
    통과하는 실제 HTTP 왕복(같은 `Idempotency-Key` 로 `409`/`410` 을 두 번 요청 → 두 번째가
    바이트 단위로 동일 응답인지)을 검증하는 e2e 는 아직 0건이다. CHANGELOG 의 "이제 24h 동안
    동일 응답이 재현된다" 라는 API 계약 주장은 현재 이 단위 테스트 층위의 신뢰도에 의존한다.
    다만 이번 재설계는 실제 설치된 `@nestjs/core` 소스(`interceptors-consumer.js`/
    `router-proxy.js`)를 추적해 근거를 확보했고, 두 오답(`>= 400`, `=== 400`)을 가르는 뮤테이션
    실측까지 남겨 뒀으므로(plan:566-587) 신뢰도가 낮지는 않다.
  - 제안: 이 PR 의 스코프는 아니므로 차단 사유로 보지 않는다. 다만 이미 plan 에 등재된 항목이니
    e2e 인프라가 준비되는 대로 우선순위를 두어 처리할 것을 권고.

- **[INFO]** idempotency 캐시 키가 인증 컨텍스트/`executionId` 로 스코프되지 않는 선재 설계 —
  이번 변경으로 캐시 대상 응답 종류(2xx 전용 → `409`/`410` 오류 응답 포함)가 넓어져 노출 표면이
  다소 커짐 (security reviewer 기록과 동일 결론, API 계약의 "인증/인가" 관점에서 교차 확인)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95`
    (`redisKey = ${REDIS_KEY_PREFIX}${rawKey}` — `executionId`/인증 주체 미포함),
    캐시 대상 확장부는 `:228-241`(`isErrorStatusCacheable`)
  - 상세: `InteractionGuard` 가 먼저 인증을 검증하므로 임의 execution 접근 자체는 막히지만,
    캐시 자체는 `Idempotency-Key` 헤더 원문에만 바인딩된다. 이번 diff 는 이 캐시가 담는 응답의
    종류를 `2xx` 전용에서 `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 오류 바디까지
    넓혔으므로, 만약 서로 다른 인증 주체가 우연히 같은 `Idempotency-Key` 값과 동일 `body` 를
    사용하는 경우(공격자가 키를 추측/재사용) 재생 가능한 응답의 범위가 그만큼 넓어진다.
    이 자체는 이번 diff 가 새로 만든 아키텍처 결함이 아니라 기존 캐시 키 설계의 특성이고,
    이미 `16_29_45`/`16_53_26` 라운드에서 security reviewer 가 INFO 로 동일하게 기록했다.
  - 제안: 새 조치 불요 — 후속 항목(`redisKey`에 `executionId`/인증 scope 포함)으로 이미
    추적 중인 것으로 보이며 이번 PR 의 차단 사유가 아니다.

## 요약

이번 변경(`idempotency.interceptor.ts` 의 §R8 캐시 스코프 재설계)은 URL·페이지네이션·버전 관리에는
영향이 없고, 인증/인가 가드 체인도 그대로다. API 계약 관점의 핵심은 "동일 `Idempotency-Key` 재조회
시 `409`/`410` 이 동일한 상태코드·에러 바디로 재현되는가" 인데, `GlobalExceptionFilter` 의 nested
error shape 처리와 `@HttpCode` 고정 데코레이터의 동작 방식을 직접 추적한 결과 이번 구현
(`catchError` 로 예외 채널 포착 → 캐시 히트 시 `HttpException` 재throw)이 그 계약을 올바르게
충족하는 설계임을 확인했다. `requestId` 만 매 응답 재발급되는 것은 CHANGELOG 에 명시된 의도된
예외다. 남은 잔여 리스크는 이번 diff 범위 밖으로 이미 plan 에 등재된 두 항목 — (1) 실제 HTTP
왕복을 검증하는 e2e 부재, (2) 캐시 키가 인증/execution 스코프로 격리되지 않는 선재 설계 — 뿐이며
둘 다 이 PR 을 막을 사유는 아니다.

## 위험도

LOW
