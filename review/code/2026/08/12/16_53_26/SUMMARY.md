# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. `idempotency.interceptor.spec.ts` 의 기존(변경 안 된) `400 VALIDATION_ERROR` 테스트가 여전히 vacuous mock 을 써서 §R8 닫힌 목록에 `400` 이 잘못 추가되는 회귀를 검출하지 못하는 WARNING 1건이 위험도를 결정. 강제 포함(router_safety) 리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인 — 화이트리스트 미이행 없음.

이번 라운드는 직전 라운드(`16_29_45`)의 CRITICAL("409/410 idempotency 캐싱이 RxJS error 채널을 못 봐 프로덕션에서 도달 불가능한 dead code")을 `cacheTapped()` 를 `tap({next}) + catchError` 로 재설계해 해소한 결과를 검토한 것이다. requirement·scope·maintainability·documentation reviewer 는 독립적으로 코드 실행(`npx jest` 21/21, `eslint`/`tsc` 0 에러)·spec line-level 대조·`interaction.controller.ts`/`interaction.service.ts` 소스 대조로 CRITICAL 해소를 확인했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 기존(이번 diff 미변경) `'400 VALIDATION_ERROR 는 캐시하지 않는다'` 테스트가 성공 채널(`of()`)에 `statusCode: 400` 을 인위적으로 프리셋하는 vacuous mock 을 그대로 사용 — `interaction.service.ts` 는 실제로 `BadRequestException` 을 throw 해 error 채널(신규 `catchError`)로 흐르는데, 이 테스트는 그 경로를 전혀 행사하지 않는다. 실측: `isErrorStatusCacheable` 을 `=== 400` 도 포함하도록 오염시키는 뮤턴트를 넣어도 이 스위트의 어떤 테스트도 RED 가 되지 않는다(409/410/404 테스트 모두 통과). 현재 구현(`=== 409 \|\| === 410`)은 정확해 지금 살아있는 버그는 아니지만, 이번 PR 이 다른 4개 케이스(409/410/5xx/404)에 정착시킨 "mock 이 만드는 상태 vs 시스템이 실제로 만드는 상태" 원칙이 이 400 케이스에는 적용되지 않은 잔여 갭 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:243-253` | `makeThrowingHandler(new BadRequestException({ error: { code: 'VALIDATION_ERROR' } }))` 로 error 채널을 실제로 행사하는 테스트로 교체(또는 병행 추가)하고 `redis.set` 미호출을 단언 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | Idempotency 캐시 키(`redisKey`)가 여전히 `Idempotency-Key` 값에만 바인딩되고 execution/인증 컨텍스트로 스코프되지 않는 선재 설계 — 이번 fix 로 409/410 캐싱이 dead code 에서 실제 활성 경로로 바뀌면서, 동일 키+동일 body 를 쓰는 서로 다른 인증 요청 간 응답 재생 가능성이 이론상 위험에서 실제 활성 경로로 전환됨(익스플로잇 난이도는 여전히 낮지 않음; `InteractionGuard` 가 임의 execution 접근 자체는 차단) | `idempotency.interceptor.ts:95`(`redisKey`), `:135-140`(재throw), `:186-197`(`storeEntry` 호출) | 후속 항목으로 `redisKey` 에 `executionId`(또는 인증 scope 식별자)를 포함해 요청 컨텍스트로 캐시 격리 권고 — plan 백로그 INFO 7·8 항목에 이미 유예 기록됨 |
| 2 | security | `catchError` 가 캐시 적재하는 `err.getResponse()` 를 검증 없이 직렬화 — 현재 두 예외(`STATE_MISMATCH`/`EXECUTION_TERMINATED`)는 고정 문자열/enum 만 포함해 민감정보 노출 없음을 확인했으나, `isErrorStatusCacheable()` 은 상태코드만으로 판정하므로 향후 다른 코드 경로가 409/410 으로 diagnostic 정보를 담은 예외를 던지면 검증 없이 24h 캐시·재생 대상이 됨 | `idempotency.interceptor.ts:186-197`, `:205-225` | 조치 불요(범위 밖) — `interaction.service.ts` 의 409/410 throw 지점 변경 시 payload 에 내부 정보 미포함 재확인 |
| 3 | side_effect | 캐시 재현(cache-hit replay) 시 409/410 응답의 `requestId` 는 `GlobalExceptionFilter` 가 매번 새로 발급(`uuidv4()`) — `code`/`message`/`statusCode` 는 정확히 재현되나 완전한 바이트 동일은 아님. CHANGELOG/spec 의 "동일 응답 재현" 서술이 이 예외를 언급하지 않음(기능 결함 아님, 문서 정밀도 이슈) | `idempotency.interceptor.ts:135-140`, `http-exception.filter.ts:45,99-106` | 선택 — CHANGELOG/spec 에 "requestId 는 재현마다 새로 발급됨" 한 줄 보강 |
| 4 | side_effect / maintainability | 캐시 히트 시 `cached.responseJson` 의 `JSON.parse` 가 (a) 손상값에 대한 방어(`try/catch`)가 없고(기존 성공 재현 분기와 동일한 기존 패턴 — 새 위험 아님, 실패 시 `GlobalExceptionFilter` 가 fail-closed 로 500 마스킹) (b) 신규 에러 재현 분기와 기존 성공 재현 분기 두 곳에서 동일 문자열을 중복 파싱 | `idempotency.interceptor.ts:135-140`(신규), `:137`, `:143`(기존) | 선택 — 파싱을 두 분기 위로 한 번만 끌어올려 단일 지점화, 필요 시 두 자리 모두 방어 추가 |
| 5 | maintainability | §R8 닫힌 목록 판정이 성공(2xx) 쪽은 `cacheTapped` 내부 인라인 조건, 에러(409/410) 쪽은 `isErrorStatusCacheable` named 함수로 비대칭 팩터링 — 향후 범위 변경 시 두 군데를 봐야 함 | `idempotency.interceptor.ts:172-177` vs `:239-241` | 선택 — `isSuccessStatusCacheable(statusCode)` 를 대칭으로 추출 |
| 6 | maintainability | `intercept()` 가 손상 JSON fallback·bodyHash 충돌·에러 재현·정상 재현·캐시 미스 위임 5가지 분기를 한 메서드(~60줄)에 담아 이번 diff 로 다소 길어짐(순환 복잡도는 아직 낮음) | `idempotency.interceptor.ts:88-150` | 선택 — 캐시 히트 처리를 `private replayCached(...)` 로 추출 |
| 7 | testing | `makeThrowingHandler` 기반 error-채널 테스트들이 함께 넘기는 `makeContext({ statusCode: 202 })` 는 error 채널에서 전혀 읽히지 않는 사실상 no-op 인자인데, 각 `it` 자리에 그 이유를 설명하는 주석이 없어 다음 사람이 제거해도 되는지 헷갈릴 수 있음 | `idempotency.interceptor.spec.ts:266,292,344,373` | 선택 — 한 줄 주석으로 "res.statusCode 는 error 채널에서 무시됨(대조용)" 명시 |
| 8 | documentation | `IdempotencyInterceptor` 클래스 상단 요약 JSDoc(5개 bullet) 이 이번에 확장된 캐시 대상(에러 채널의 409/410 재현)을 요약하지 않음 — 메서드/필드 docstring 은 정확히 보완하므로 오류는 아니고 심각도 낮음 | `idempotency.interceptor.ts:49-57` | 선택 — "캐시 대상은 2xx·409·410 의 닫힌 목록(Spec EIA §R8)" bullet 한 줄 추가 |
| 9 | requirement / testing | `Idempotency-Key` e2e(실제 Nest 파이프라인: 예외 필터·`@HttpCode`·직렬화 통과) 부재는 여전하나 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 명시 등재·RESOLUTION.md 에도 사유(docker 인프라 필요) 기록 — 은폐된 갭 아님. WARNING #1 의 400 케이스 같은 mock-reality 갭을 결국 이 e2e 가 잡을 안전망이 될 것 | `plan/in-progress/backend-lint-gate-broken-on-main.md:539-545` | 선택 — 이미 plan 등재, 추가 조치 불요(가까운 후속 스프린트 권고) |
| 10 | requirement | `'410 도 캐시된다'` 테스트가 `stored.statusCode` 만 단언하고, `409` 테스트가 갖춘 `stored.responseJson`(payload) 내용 단언(`toMatchObject`) 이 없음 — `storeEntry` 가 두 상태코드에 동일 로직 적용이라 회귀 위험은 낮으나 완전한 대칭은 아님 | `idempotency.interceptor.spec.ts:286-305` | 선택, 경미 — 409 테스트와 동형으로 `stored.responseJson` payload 단언 추가 |

## SPEC-DRIFT

없음 — requirement reviewer 가 확인한 `spec/data-flow/15-external-interaction.md` 의 "⚠️ 현행 구현 갭" caveat 삭제는 spec 이 정의한 목표(§R8 닫힌 목록)를 구현이 이번에 실제로 충족했기 때문이며 SPEC-DRIFT 가 아니다(구현이 spec 을 앞서가는 사례 아님, 오히려 구현이 spec 을 따라잡음).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CRITICAL 해소 확인, 인증/인가·인젝션·시크릿 신규 위험 없음. idempotency 캐시 키가 execution 단위로 스코프 안 되는 선재 설계가 이번에 실제 활성 경로로 전환(INFO #1) |
| requirement | NONE | 코드 실행(jest 21/21, eslint/tsc 0 에러)·spec line-level 대조로 CRITICAL 해소 독립 검증. e2e 부재·410 테스트 payload 미단언만 잔여 INFO |
| scope | NONE | 핵심 3파일(source/test/CHANGELOG) 변경이 CRITICAL 재설계 단일 목적에 정확히 대응, 무관한 드라이브바이 없음. spec/plan 갱신도 권한 범위 내 |
| side_effect | LOW | 함수 시그니처·공개 인터페이스 무변경, catchError 표면이 자기 자신의 IDEMPOTENCY_KEY_CONFLICT 는 과잉 포착하지 않음 확인. requestId 재현 불일치는 문서 정밀도 이슈 |
| maintainability | NONE | 순재작업 대비 개선(storeEntry 통합, isErrorStatusCacheable 추출). 남은 것은 전부 선택적 개선 여지(JSON.parse 중복, 팩터링 비대칭, intercept() 길이) |
| testing | MEDIUM | 신규 error-채널 테스트(409/410/5xx/404)는 실제 파이프라인을 정확히 재현해 CRITICAL 해소를 검증. 다만 미변경 400 테스트가 동일 클래스의 vacuous mock 을 남겨 회귀 미검출 갭(WARNING #1) |
| documentation | NONE | CHANGELOG·구현/테스트 docstring·spec·plan 이 재설계 전체 경위(1차 실패 → 2차 성공)를 정직하게 상호 정합적으로 갱신. 클래스 상단 요약만 확장분 미반영(경미) |

## 발견 없는 에이전트

없음 — 실행된 7개 에이전트 모두 최소 1건 이상의 INFO(또는 WARNING) 를 보고함.

## 권장 조치사항

1. (WARNING 해소) `idempotency.interceptor.spec.ts` 의 `'400 VALIDATION_ERROR 는 캐시하지 않는다'` 테스트를 `makeThrowingHandler` 기반 error-채널 테스트로 교체 — `isErrorStatusCacheable` 에 `400` 이 잘못 추가되는 회귀를 실제로 검출하도록.
2. (선택, 후속) idempotency 캐시 키(`redisKey`)에 `executionId`/인증 scope 식별자를 포함시켜 요청 컨텍스트로 캐시를 격리 — 이번 fix 로 409/410 캐싱이 실제 활성 경로가 되면서 우선순위가 한 단계 상향됨.
3. (선택, 후속) `Idempotency-Key` e2e(실제 Nest 파이프라인 경유)를 가까운 스프린트에서 처리 — 이미 plan 에 등재됨, 이번 PR 을 막을 사유 아님.
4. (선택, 경미) `410 도 캐시된다` 테스트에 `stored.responseJson` payload 단언 추가, `cached.responseJson` 중복 `JSON.parse` 통합, 클래스 상단 docstring 에 에러 채널 캐시 재현 bullet 추가 — 전부 지금 당장 필요하지 않은 가독성/대칭성 개선.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원) — forced 전원 결과 확보됨(화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(이번 diff 는 인터셉터 로직 재설계로 성능 특성 변화 없다고 판단, 상세 사유 미제공) |
  | architecture | 라우터 판단(단일 클래스 내부 재설계, 아키텍처 영향 없음으로 판단, 상세 사유 미제공) |
  | dependency | 라우터 판단(신규 외부 의존성 추가 없음, 상세 사유 미제공) |
  | database | 라우터 판단(Redis 캐시 스키마 변경 없음, 상세 사유 미제공) |
  | concurrency | 라우터 판단(동시성 모델 변경 없음, 상세 사유 미제공) |
  | api_contract | 라우터 판단(공개 API 응답 계약 변경 없음 — 재현된 응답은 원본과 동일 바디, 상세 사유 미제공) |
  | user_guide_sync | 라우터 판단(사용자 대상 가이드 문서 영향 없음, 상세 사유 미제공) |
