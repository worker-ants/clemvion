# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 PR 의 핵심 수정(§R8 409/410 캐싱 조건 교체)이 실제 프로덕션 트래픽에서는 도달 불가능한 dead code 라는 결함을 `requirement`·`testing` 두 reviewer 가 독립적으로 발견. CHANGELOG·plan·spec 문서가 "해소됐다" 고 서술하는 결함이 실제로는 그대로 남아 있다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / testing | 신규 `409`/`410` 캐싱 분기가 실제 트래픽에서 절대 실행되지 않는 dead code. 실제 `STATE_MISMATCH`(409)/`EXECUTION_TERMINATED`(410)는 `interaction.service.ts`에서 `ConflictException`/`GoneException`으로 **throw** 되는데, `cacheTapped()`가 반환하는 `tap({ next })`는 error 콜백이 없어 RxJS error notification 에서 `next` 콜백(신규 `isCacheable` 로직 포함)이 전혀 실행되지 않는다. 추가로 NestJS `router-execution-context.js`의 `setStatus`는 핸들러 실행 **이전**에 `@HttpCode()` 데코레이터 값(202)으로 `res.statusCode`를 선고정한다. 신규 회귀 테스트 2건(`409 는 캐시된다`, `410 도 캐시된다`)은 `makeCallHandler({ error: ... })`로 **성공(next) 채널**에 값을 흘리고 `statusCode`를 인위적으로 프리셋하는 비현실적 mock을 써서 GREEN 이 됐을 뿐, 실제 예외 기반 경로는 한 번도 실행하지 않는다. `external-interaction.e2e-spec.ts`에도 `Idempotency-Key` 헤더를 쓰는 테스트가 0건이라 이 결함이 e2e 로도 검증되지 않았다. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:156-190`(`cacheTapped`, `isCacheable` 167-172); `interaction.service.ts:253,431`(GoneException), `:478,505`(ConflictException); `idempotency.interceptor.spec.ts:234-265`(신규 mock 테스트) | `cacheTapped`/`intercept()`를 `catchError`(또는 `tap`의 `error` 콜백)로 확장해 던져진 `HttpException`에서 status/response를 뽑아 캐시에 적재 후 원 예외를 재throw 하도록 재설계. 실패-채널 mock 헬퍼(`throwError(() => new ConflictException(...))`)로 "현재는 캐시 SET 이 발생하지 않는다"를 먼저 캐너리로 고정한 뒤 수정. `Idempotency-Key` 헤더를 쓰는 e2e 테스트로 실제 파이프라인 재현 검증 추가. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | requirement | 위 CRITICAL 로 인해 CHANGELOG 의 클라이언트 영향 서술("같은 `Idempotency-Key`로 409/410을 받은 뒤 재요청하면 이제 24h 동안 동일 응답이 재현된다")이 사실과 다름(검증되지 않은/틀렸을 가능성이 높은 주장). | `CHANGELOG.md:19` | 위 CRITICAL 해소 후 갱신, 또는 그전까지 이 문단 되돌리기. |
| 3 | requirement | plan 체크리스트의 "완료" 마킹이 시기상조 — 근거로 든 뮤테이션 표는 실제 호출 경로(예외 throw)를 재현하지 못하는 단위 테스트 내부에서만 유효. | `plan/in-progress/backend-lint-gate-broken-on-main.md:542`(체크박스), `:570-583`(완료 서술) | CRITICAL 해소 전까지 체크박스 되돌리거나 "단위 테스트만 통과, 예외 경로 미검증" 경고 추가. e2e 검증 후 재승격. |
| 4 | requirement | spec 문서의 "⚠️ 현행 구현 갭" caveat 삭제가 시기상조 — 증상(409/410 미재현)은 CRITICAL 로 인해 여전히 참(원인만 조건식→인터셉터 아키텍처로 바뀜). 코드가 spec 요구를 아직 못 채운 것이지 spec 이 낡은 게 아니므로 SPEC-DRIFT 아님. | `spec/data-flow/15-external-interaction.md:258` | CRITICAL 해소 전까지 caveat 복원/갱신하거나 "구현 검증 필요"로 표기. |
| 5 | side_effect / testing | 캐시 대상 조건이 `statusCode >= 400`(제외, 즉 200-399 전부 캐시)에서 `(2xx)｜409｜410`으로 바뀌며 **3xx(300-399) 가 조용히 캐시 대상에서 빠짐**. CHANGELOG·docstring·plan 뮤테이션 표 어디에도 이 축소가 언급되지 않고, 회귀 테스트(3xx 케이스)도 전무 — `< 300`→`<= 300` 뮤턴트가 검출되지 않는다. 실측상 이 모듈 컨트롤러가 3xx 를 반환하지 않아 현재 실질 영향은 0. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168-171` | `statusCode: 304` 등 3xx 케이스로 "더 이상 캐시되지 않는다" 회귀 테스트 추가 + docstring/CHANGELOG 에 의도적 축소임을 한 줄 명시. |
| 6 | documentation | 테스트 파일 모듈 docstring 이 이번 fix 로 더 이상 사실이 아닌 문장("Spec EIA §R8 과 어긋난 현재 캐시 제외 범위를 고정하는 캐너리")을 그대로 남김 — 개별 `it` 제목·본문은 전부 정합 동작으로 뒤집혔는데 상단 요약만 옛 상태(위반 고정)로 오독 유발. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-13` | "Spec EIA §R8 캐시 대상(2xx·409·410 닫힌 목록)을 고정하는 회귀 테스트를 담는다"로 갱신. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 7 | security | idempotency 캐시 키가 `Idempotency-Key` 값에만 바인딩되고 `executionId`/인증 컨텍스트로 스코프되지 않음(선재 설계). 이번 변경으로 캐시 대상이 409/410 오류 응답까지 확장돼 잠재 노출 표면이 다소 넓어짐(익스플로잇 난이도는 낮지 않음). | `idempotency.interceptor.ts:94`(redisKey 구성), `:168-172` | 후속 항목으로 `redisKey`에 execution/인증 scope 포함 고려. 이번 PR 범위 밖. |
| 8 | security | 캐시된 409/410 payload 에 내부 diagnostic 이 포함되지 않는지는 `interaction.service.ts` 책임이며 이번 리뷰 대상 파일 밖. | `idempotency.interceptor.ts:173-176` | 해당 서비스 코드 변경 시 재확인. |
| 9 | requirement | `isCacheable` 범위가 `< 400`(1xx/2xx/3xx)에서 `2xx`만으로 좁아진 변경이 CHANGELOG/plan 에 명시 안 됨(§5 와 동일 사실, requirement 관점 기록). | `idempotency.interceptor.ts:169` | 의도된 변경이면 docstring/CHANGELOG 한 줄 추가(경미). |
| 10 | requirement | `410 도 캐시된다` 테스트가 `redis.set` 호출 여부만 단언하고 저장된 `statusCode` 값은 검증 안 함(`409` 테스트는 검증). | `idempotency.interceptor.spec.ts:254-265` | `stored.statusCode).toBe(410)` 단언 추가(선택). |
| 11 | testing | `'401·404 같은 다른 4xx 도 캐시하지 않는다'` 테스트 제목이 401·404 둘 다 커버한다 주장하지만 실제로는 404 요청 하나만 행사. | `idempotency.interceptor.spec.ts:282-294` | 제목을 "404" 단독으로 좁히거나 401 케이스도 별도 행사. |
| 12 | maintainability | `isCacheable` 판정이 인라인 익명 로직 — 이 프로젝트의 "이름 있는 단일 출처" 관행과 다름. 소비처가 한 곳뿐이라 심각하지 않음. | `idempotency.interceptor.ts:168-171` | 선택: `isCacheableStatus(statusCode)` named export 로 추출. |
| 13 | 문서 일관성 확인 | CHANGELOG·구현 docstring·spec(`data-flow/15`)·plan 체크리스트가 서로 정합하게 갱신됨을 확인(단, WARNING #6 제외). | `CHANGELOG.md:3-21`, `idempotency.interceptor.ts:39-190`, `spec/data-flow/15-external-interaction.md:257-258`, `plan/in-progress/backend-lint-gate-broken-on-main.md:542-583` | 해당 없음. |
| 14 | maintainability | 신규 테스트 4건이 셋업 4줄을 반복 — 파일 기존 컨벤션과 일치, 문제 아님. 케이스가 더 늘면 `it.each` 파라미터화 고려. | `idempotency.interceptor.spec.ts:234-293` | 선택. |
| 15 | maintainability | `cacheTapped` JSDoc(15줄)이 길지만 두 오답(`>=400`,`===400`)의 근거를 코드 옆에 남기는 이 저장소 컨벤션과 일치 — 감점 요소 아님. | `idempotency.interceptor.ts:141-155` | 없음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 캐시 키가 executionId 로 미스코프(선재), 이번 변경으로 노출 표면 소폭 확장 |
| requirement | CRITICAL | §R8 409/410 캐싱이 dead code — CHANGELOG/plan/spec 이 "해소됐다"고 서술하나 실제 미해소 |
| scope | NONE | 5개 파일 모두 "§R8 캐시 스코프 정합화" 단일 의도에 정확히 대응, 무관 변경 없음 |
| side_effect | LOW | 3xx 캐시 대상 조용한 축소(무테스트/무문서), 나머지는 의도된 문서화된 부작용 |
| maintainability | NONE | 조건식 짧고 명확, JSDoc·테스트 정합. isCacheable named 함수 추출은 선택 사항 |
| testing | CRITICAL | requirement 와 동일 root cause(dead code) 를 독립 재확인 — mock 이 실제 예외 경로 미반영 |
| documentation | LOW | 테스트 파일 모듈 docstring 이 fix 전 상태("위반 고정 캐너리") 그대로 남음 |

## 발견 없는 에이전트

- (해당 없음 — 전 reviewer 가 최소 INFO 이상 발견사항을 보고함. `scope`/`maintainability` 는 위험도 NONE 이나 각각 확인 사항/개선 제안을 기록함.)

## 권장 조치사항
1. **(최우선)** `cacheTapped`/`intercept()`를 예외(error notification) 경로까지 포괄하도록 재설계 — `catchError`로 `HttpException.getStatus()` 기반 캐싱 후 원 예외 재throw. 이것 없이는 이번 PR 의 실질 효과가 없다.
2. 재설계 후 실패-채널 mock(`throwError`)과 `Idempotency-Key` 헤더를 쓰는 e2e 테스트를 추가해 실제 파이프라인에서 409/410 캐시 재현을 검증.
3. #1 해소 전까지 CHANGELOG 클라이언트 영향 서술, plan 체크리스트 완료 마킹, spec "선재 갭" caveat 삭제를 되돌리거나 "검증 필요" 로 표기.
4. 3xx 캐시 대상 축소를 CHANGELOG/docstring 에 명시하고 회귀 테스트 1건 추가.
5. 테스트 파일 모듈 docstring(11-13행)을 새 캐너리 서술로 갱신.
6. (선택) `isCacheable` named 함수 추출, `410` 테스트 statusCode 값 단언 추가, `401·404` 테스트 제목/커버리지 일치.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — **전원 forced, 전원 결과 확보 확인됨** (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(조건식 3줄 교체) 와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관 |
  | database | router 판단상 이번 diff 와 무관 |
  | concurrency | router 판단상 이번 diff 와 무관 |
  | api_contract | router 판단상 이번 diff 와 무관 |
  | user_guide_sync | router 판단상 이번 diff 와 무관 |
