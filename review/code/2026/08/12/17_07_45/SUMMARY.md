# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `IdempotencyInterceptor` 의 §R8 재설계(409/410 error-채널 캐싱)를
직접 겨냥한 CRITICAL 을 낳았던 "자매 자리 누락" 패턴이 이번 최종본에도 축소된 형태로 두 곳
(테스트 커버리지) 남아 있고, 새 `catchError` 캐시-적재 경로에 `JSON.stringify` 실패 시
원래 409/410 예외를 500 으로 대체할 수 있는 무방비 지점이 하나 신설됐다. 라우터 강제 포함
(forced) 7개 reviewer 전원 결과가 확보돼 화이트리스트 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | 신규 `catchError` 캐시-적재 경로(`storeEntry`)가 `JSON.stringify(payload ?? null)` 실패에 무방비 — RxJS `catchError` 셀렉터가 throw 하면 그 새 에러가 원래 409/410 예외를 **대체**해 클라이언트가 500 을 받고, `return throwError(() => err)` 도 실행되지 못해 "응답을 기록할 뿐 삼키지 않는다"는 클래스 불변식이 깨진다. 현재 `interaction.service.ts` 4개 throw 지점은 전부 plain object 라 즉시 트리거되지는 않지만, 같은 CHANGELOG 가 바로 옆에서 고친 "부수 경로 실패가 본 응답을 왜곡" 결함과 같은 클래스가 새 표면(409/410 쪽)에 무방비로 열렸다 | `idempotency.interceptor.ts:186-201`(catchError), `:206-225`(storeEntry), `:215`(JSON.stringify) | `storeEntry` 내부 `JSON.stringify` 를 try/catch 로 감싸 실패 시 캐시 적재만 skip 하고 원래 `err` 는 그대로 재throw 하도록 분리 |
| 2 | testing | `isErrorStatusCacheable` 의 "네 경우(409/410/5xx/404) 모두 spec 에 회귀 테스트가 있다"는 docstring 주장이 5xx 방향에서는 실질적으로 거짓 — 5xx 테스트는 `HttpException` 이 아닌 순수 `Error` 를 던져 `instanceof HttpException` 가드에 막혀 `isErrorStatusCacheable` 자체가 호출되지 않는 경로로 우회 검증된다. `isErrorStatusCacheable` 을 `>= 500` 도 캐시하도록 뮤테이션해도 어떤 테스트도 못 잡는다(실제 `HttpException` 기반 5xx 케이스 0건, `grep InternalServerErrorException` 0건) | `idempotency.interceptor.ts:186-189`(HttpException 가드), `:237-241`(isErrorStatusCacheable) / `idempotency.interceptor.spec.ts:351`(5xx 테스트) | `makeThrowingHandler(new InternalServerErrorException(...))` 처럼 실제 HttpException 기반 5xx 케이스를 추가하거나, 현재 테스트 제목을 "HttpException 이 아닌 예외는 캐시 판정을 우회한다"로 좁히고 별도로 진짜 HttpException 5xx 테스트 신설 |
| 3 | testing | `409` 는 "캐시 히트 → 예외로 재현" 까지 테스트되는데(`:322`) `410` 은 "적재"만 테스트되고 재조회 시 예외로 재현되는지 검증하는 자매 테스트가 없다 — 이번 CRITICAL 을 낳았던 "자매 자리 미적용" 패턴과 같은 성격. 현재는 `isErrorStatusCacheable` 이 409·410 을 동일 경로로 처리해 위험이 낮지만, 향후 리팩터링으로 한쪽만 남아도 410 replay 쪽은 스토어 단언까지만 걸리고 실제 재throw 여부는 검증되지 않는다 | `idempotency.interceptor.spec.ts:322`(409 replay 테스트만 존재, 410 대응 테스트 파일 전체에 없음) | `'캐시된 410 은 재조회 시 예외로 재현된다'` 테스트를 409 와 동일 패턴(redis.get → 캐시 엔트리 반환 → handler.handle 미호출 → `.rejects.toMatchObject({status:410})`)으로 추가 |
| 4 | documentation | plan 완료 narrative(`backend-lint-gate-broken-on-main.md`)가 "라운드 ID 인용" 컨벤션을 확립해 놓고도, 이번 diff 에 포함된 3번째 라운드(`16_53_26`, 400 자매 케이스 누락 발견·조치)를 인용하지 않는다 — 코드 주석·review 산출물에는 근거가 남아 있지만 SoT 인 plan 문서에는 "1차 실패 → 2차 재설계 성공" 까지만 서술돼, 2차 성공 이후에도 같은 결함 클래스(mock 상태 ≠ 실제 발생 상태)가 형제 케이스에 한 번 더 남아 있었다는 이 프로젝트가 반복 강조해 온 교훈이 SoT 에서 누락된다 | `plan/in-progress/backend-lint-gate-broken-on-main.md:577-610` | 606행 뒤에 "3차(`16_53_26`)에서 자매 자리 하나를 더 놓친 것이 발견됐다 — 400 테스트만 옛 성공-채널 mock 으로 남아 있었고 `makeThrowingHandler` 로 교체해 닫았다" 문단 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / api_contract | idempotency 캐시 키(`redisKey`)가 인증 컨텍스트/`executionId` 로 스코프되지 않는 선재 설계 — 이번 재설계로 캐시 대상이 `2xx` 전용에서 `409`/`410` 오류 응답까지 실제로 확장돼(종전엔 dead code) 노출 표면이 이론상 서술에서 실제 동작으로 넓어짐. 익스플로잇하려면 공격자가 피해자의 `Idempotency-Key`+동일 `bodyHash` 를 모두 알아야 해 난이도는 낮지 않음 | `idempotency.interceptor.ts:95, :228-241` | 이번 PR 범위 밖. 후속으로 `redisKey` 에 `executionId`/인증 scope 포함 검토, plan 등재 여부 확인 권장 |
| 2 | security | 캐시된 예외 payload 가 Redis 에 24h 보존 — 현재 `interaction.service.ts` 는 고정 메시지만 담아 안전하지만, 향후 예외 payload 에 민감 정보가 섞이면 노출 창이 "1회 요청"에서 "24h 재현"으로 확대되는 증폭기 역할 | `idempotency.interceptor.ts:186-201` | 즉시 조치 불요. `interaction.service.ts` 변경 시 예외 payload 리뷰 체크리스트 항목으로 남길 것 |
| 3 | requirement | `isErrorStatusCacheable` docstring 의 "네 경우 모두 spec 에 회귀 테스트가 있다" 표현이 어색함(회귀 테스트는 spec 문서가 아니라 spec 파일에 있음) | `idempotency.interceptor.ts:237` | 선택적 wording 수정, PR 차단 사유 아님 |
| 4 | maintainability | 캐시 히트 분기에서 `JSON.parse(cached.responseJson)` 이 두 상호 배타적 분기에서 각각 호출돼 중복으로 보임(선행 라운드에서 이미 유예) | `idempotency.interceptor.ts:137, :143` | 필수 아님. 파싱 결과를 분기 위에서 한 번만 계산하도록 리팩터 가능 |
| 5 | maintainability | §R8 닫힌 목록 판정이 성공(2xx) 쪽은 인라인, 에러(409/410) 쪽은 named 함수로 비대칭 팩터링(선행 라운드에서 이미 유예) | `idempotency.interceptor.ts:177` vs `:239-241` | 필수 아님. `isSuccessStatusCacheable` 로 대칭 추출 가능 |
| 6 | maintainability | `intercept()` 가 캐시조회·hash충돌·에러재현·정상재현·미스 5갈래를 한 메서드(63줄)에 담음(선행 라운드에서 이미 유예) | `idempotency.interceptor.ts:88-150` | 필수 아님. 캐시 히트 처리 블록을 `replayCached()` 로 추출 가능 |
| 7 | maintainability | error-채널 테스트 6건(400/409/410/5xx/3xx/404)이 거의 동일한 보일러플레이트 반복 | `idempotency.interceptor.spec.ts:244-396` | 선택 사항. 케이스가 더 늘면 `it.each` 파라미터화 고려(단, 개별 사유 주석 관행과 상충 가능) |
| 8 | testing | 성공 채널 캐시 조건의 상한 경계값(`>= 300`) 이 정확히(300) 테스트되지 않고 근사값(304)만 사용 — `> 300` 오답 뮤턴트를 못 잡음. 실제로 3xx 를 내지 않는 API 라 실질 위험 낮음 | `idempotency.interceptor.ts:177` / `idempotency.interceptor.spec.ts:367` | 선택 사항. `statusCode: 300` 케이스 추가 시 다른 경계값들과 동일 정밀도 확보 |
| 9 | api_contract | `@HttpCode(202)` 고정 데코레이터가 성공 채널의 수동 `res.status()` 를 무시하는 구조적 이유로, 409/410 재현에 `throw` 설계가 필수임을 소스 추적으로 확인(이전 CRITICAL 의 근본 원인과 동일 메커니즘) | `idempotency.interceptor.ts:186-201` / `interaction.controller.ts:65-66,111-112` | 확인용. 향후 이 인터셉터를 `@HttpCode` 미고정 엔드포인트에 재사용할 경우 전제 재검증 필요 |
| 10 | api_contract | "동일 Idempotency-Key 재조회 시 동일 응답 재현" 계약의 e2e 검증층이 아직 없음(단위 mock 만) — 이미 plan 에 등재된 이번 PR 범위 밖 항목 | `plan/in-progress/backend-lint-gate-broken-on-main.md:539` | 이 PR 의 차단 사유 아님. e2e 인프라 준비되는 대로 우선순위 처리 권고 |
| 11 | documentation | 클래스 상단 요약 JSDoc 이 "캐시된 409/410 을 예외로 재현" 을 bullet 로 요약하지 않음 — 이전 라운드(`16_53_26`)에서 이미 "조치 불요"로 명시 트리아지된 항목, 재지적 불요 | `idempotency.interceptor.ts:49-71` | 없음(기결정 유지) |
| 12 | documentation / user_guide_sync | CHANGELOG·구현 docstring·spec(`data-flow/15`, `5-system/14` §R8)·plan·테스트 모듈 docstring·유저가이드(`triggers.mdx`/`.en.mdx`)·swagger jsdoc 모두 최종 상태 기준 상호 정합 확인 — user-guide 는 원래도 목표 동작을 일반 서술해 이번 수정으로 텍스트 갱신 불요, spec 캐비트 삭제만 같은 diff 안에서 이미 반영 | `CHANGELOG.md:3-29`, `idempotency.interceptor.ts:40-241`, `spec/data-flow/15-external-interaction.md:258`, `spec/5-system/14-external-interaction-api.md:1053-1058`, `codebase/frontend/.../02-nodes/triggers.mdx:291` 등 | 없음 — 확인용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 캐시 키 executionId/인증 미스코프(선재) + 캐시 payload 24h 보존 증폭기 우려, 둘 다 INFO |
| requirement | NONE | §R8 spec-구현 line-level 일치를 mutation 프로브로 재확인. docstring 문구 INFO 1건만 |
| scope | NONE | 27개 파일 전부 단일 목적(§R8 정합)으로 수렴, 무관 변경 없음 |
| side_effect | LOW | `catchError` 신설 경로의 `JSON.stringify` 무방비 실패 모드 WARNING 1건 |
| maintainability | NONE | 전부 이전 라운드에 이미 유예된 선택적 개선 + 신규 테스트 보일러플레이트 INFO |
| testing | MEDIUM | 5xx 우회 검증·410 replay 자매 테스트 누락 WARNING 2건 — 원 CRITICAL 과 같은 패턴 재발 |
| documentation | LOW | plan 완료 narrative 의 3차 라운드(`16_53_26`) 인용 누락 WARNING 1건 |
| api_contract | LOW | 캐시 재현 계약 정합 확인, e2e 부재·캐시키 스코프는 기존 plan 등재 항목 INFO |
| user_guide_sync | NONE | 매트릭스 21행 전수 대조, 실질 매칭 없음(유일 근접 행도 문서 기갱신 확인) |

## 발견 없는 에이전트

scope, user_guide_sync — 실질 발견 없음(확인·정합성 기록만).

## 권장 조치사항

1. `storeEntry` 의 `JSON.stringify(payload ?? null)` 을 try/catch 로 감싸, 직렬화 실패 시 캐시 적재만 skip 하고 원래 409/410 예외를 그대로 재throw 하도록 수정 (side_effect WARNING).
2. `isErrorStatusCacheable` 의 5xx 방향을 실제 `HttpException` 기반 케이스(예: `InternalServerErrorException`)로 검증하거나 현재 테스트 제목을 정정 (testing WARNING).
3. `410` 에 대해서도 "캐시 히트 → 예외 재현" 대칭 테스트를 409 와 동일 패턴으로 추가 (testing WARNING).
4. `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 narrative 에 3차 라운드(`16_53_26`, 400 자매 케이스 누락·조치) 인용 문단 추가 (documentation WARNING).
5. (선택) `isErrorStatusCacheable` docstring 문구 정정, `JSON.parse` 중복 제거, 성공/에러 판정 팩터링 대칭화, `intercept()` 분리, 3xx 상한 경계값(300) 테스트 추가 — 전부 INFO, 이번 PR 을 막을 사유 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음
  - **제외**: 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(구체 사유 미제공) — HTTP 캐싱 인터셉터 조건 분기/RxJS 재설계로 성능 특성 변화 낮음으로 추정 |
  | architecture | 라우터 판단(구체 사유 미제공) — 단일 인터셉터 내부 재설계, 아키텍처 경계 변경 없음으로 추정 |
  | dependency | 라우터 판단(구체 사유 미제공) — 신규 외부 의존성 추가 없음(HttpException/throwError 는 기존 프레임워크 심볼) |
  | database | 라우터 판단(구체 사유 미제공) — DB 스키마/쿼리 변경 없음, Redis 캐시만 관여 |
  | concurrency | 라우터 판단(구체 사유 미제공) — 신규 동시성 제어/락 로직 없음 |
