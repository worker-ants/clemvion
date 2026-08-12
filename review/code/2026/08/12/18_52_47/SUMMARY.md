# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(문서화 정확도 — 최신 커밋이 추가한 테스트 모듈 docstring이 "전부(全部) warn 을 단언한다"고 서술하지만 실제로는 7건 중 4건만 해당). 기능·보안·스코프·부작용 관점에서는 전 reviewer 가 NONE~LOW 로 수렴했고, forced 7개 reviewer 전원의 결과를 확보했다(누락 없음 — 아래 "라우터 결정" 참고).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 최신 커밋(`567c1919d`)이 추가한 모듈 docstring이 "이 블록의 테스트는 전부 `Logger.prototype.warn` 을 함께 단언한다"고 서술하지만, 실제로는 `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)')` 블록의 `it` 7건 중 4건(`:553`, `:628`, `:680`, `:722`)만 `warnSpy` 를 세우고 단언하며 나머지 3건(`:583`, `:603`, `:663`)은 단언하지 않는다. "전부"라는 서술이 4/7만 참인데 7/7 인 것처럼 읽혀, 문서화된 보장이 실제 구현/테스트보다 넓다는 이 코드베이스가 반복 경계해 온 결함 클래스의 재발이다. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:21-23`(docstring) vs `:552-750`(대상 describe 블록) | "전부"를 "적재/직렬화 관련 4건" 등 정확한 부분집합으로 좁히거나, 규범적 의도였다면 "~단언한다" 대신 "~단언해야 한다" 류로 바꿔 현재 상태에 대한 오해를 없앤다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / requirement | Idempotency 캐시 키가 `Idempotency-Key` 값에만 바인딩되고 `executionId`/인증 컨텍스트로 스코프되지 않는다 — 서로 다른 인증된 요청이 동일 키+동일 body 를 쓰면 한쪽 execution 의 캐시된 409/410 응답이 다른 요청자에게 재생될 수 있는 구조가 선재. 여러 라운드에 걸쳐 이미 식별·유예되었고 plan 백로그에 우선순위 상향 근거까지 기록됨. 이번 diff 가 새로 만든 결함 아님(다만 409/410 캐싱을 dead code 에서 실제 경로로 바꿔 노출 표면은 넓어졌음). | `idempotency.interceptor.ts:95`(`redisKey = ...rawKey`) | 후속 항목으로 `redisKey` 에 execution/인증 scope 식별자 포함 권고. 이번 PR 범위 밖. |
| 2 | requirement / testing / maintainability | 캐시 엔트리 **내부** `responseJson` 필드 손상 시 무방비 — `intercept()` 의 두 자리(`:137`, `:143`)에서 `JSON.parse(cached.responseJson)` 이 그대로 throw 하면 `GlobalExceptionFilter` 가 500 으로 마스킹한다. 엔트리 **바깥** JSON 손상은 이미 try/catch 로 방어되는데 안쪽만 비대칭. 직전 라운드가 "기록하겠다"고 처분만 하고 빠뜨렸던 것을 이번 라운드 직전 커밋(`567c1919d`)이 실제로 plan 백로그에 기록 완료. fail-closed 방향이라 실질 위험 낮음. | `idempotency.interceptor.ts:137,143`; `plan/in-progress/backend-lint-gate-broken-on-main.md:561-568` | 추가 조치 불필요 — 이미 정확히 백로그에 기록됨. 착수 시 두 자리의 `JSON.parse` 를 한 번만 파싱하도록 끌어올리고 그 자리에 방어를 두는 편이 낫다(plan 서술과 일치). |
| 3 | security | 이번 delta(`567c1919d`)가 추가한 두 테스트는 `storeEntry()` 의 fail-open 시 `logger.warn` 이 실제로 남는지까지 단언하도록 보강 — 관측성 개선이며 보안 결함 아님. 코드 자체 변경 없음(테스트 전용 diff). | `idempotency.interceptor.spec.ts`("직렬화 불가 payload 여도 원 예외가 그대로 나간다" 등 2개 `it`) | 확인용 기록, 조치 불요. |
| 4 | security | 캐시된 오류 응답(409/410) payload — `interaction.service.ts` 가 던지는 예외 payload 는 고정 문자열/enum 값만 담아 민감정보 노출 없음. 캐시 손상 시에도 `GlobalExceptionFilter` 가 고정 문구로 마스킹. | `idempotency.interceptor.ts:194` | 없음 — `interaction.service.ts` 의 409/410 throw 지점 변경 시 재확인 권고. |
| 5 | security | 신규 e2e 가 Redis 접속 정보를 env var 폴백으로 구성(`REDIS_HOST`/`REDIS_PORT`), 하드코딩 시크릿 없음. | `test/external-interaction.e2e-spec.ts`(`beforeAll`) | 없음. |
| 6 | requirement | §R8 원문(spec)과 구현이 line-level 로 정확히 일치 — `>= 400`, `=== 400` 두 축약 오답을 각각 독립 뮤테이션으로 재실측(모두 해당 테스트 RED), 단위 테스트 25/25 pass 재확인. | `spec/5-system/14-external-interaction-api.md:1055-1059` ↔ `idempotency.interceptor.ts:172-201,255-257` | 없음 — 확인용 기록. |
| 7 | requirement | (회색지대, diff 범위 밖) `spec/data-flow/15-external-interaction.md` 의 mermaid 시퀀스가 idempotency 캐시 적재 주체를 `Svc`로 표기하는 것으로 보이나 실제 적재는 `IdempotencyInterceptor`(컨트롤러 레벨) — 선재 문서 서술 오류 가능성. `[SPEC-DRIFT]` 태깅 대상 아님(코드가 spec 을 앞서간 것이 아니라 단순 misattribution 가능성). | `spec/data-flow/15-external-interaction.md` | 이번 PR 범위 밖. 추후 별도 planner 턴에서 적재 주체 정정 검토. |
| 8 | scope | 72개 파일 전부가 "§R8 닫힌 목록 정합화"라는 단일 의도로 수렴 — 핵심 3파일(source/unit test/e2e) 변경은 재설계에 필요한 최소 범위, `plan/`·`spec/` 갱신도 이 fix 완료 사실과 직전 consistency-check WARNING 을 SoT 에 동기화하는 권한 범위 내 후속 기록. 무관한 리팩토링/드라이브바이/불필요한 설정 변경 없음. | 전체 diff | 없음 — 확인용 기록. |
| 9 | side_effect | 이번 라운드에서 유일하게 바뀐 런타임 관련 코드는 테스트 파일뿐(`Logger.prototype.warn` 스파이 2건 추가, `try/finally` 로 원복 보장) — 새 side effect 없음. 함수 시그니처/공개 인터페이스 무변경. | `idempotency.interceptor.spec.ts` | 없음. |
| 10 | side_effect | e2e 신규 Redis 연결·`IDEM-1~3` 는 저장소 기존 e2e 컨벤션과 동형(env-var 패턴, `beforeAll`/`afterAll` 정리, 매 실행 유일 키). 새로운 네트워크 부작용 패턴 아님. | `test/external-interaction.e2e-spec.ts:142-149` | 없음. |
| 11 | maintainability | 캐시 히트 재현 분기에서 `JSON.parse(cached.responseJson)` 이 상호 배타적인 두 분기에 한 번씩 있어 시각적으로 중복처럼 보임 — 위 INFO #2(responseJson 손상 무방비)와 함께 한 번에 해소하는 편이 낫다고 plan 에 기록됨. | `idempotency.interceptor.ts:137,143` | 필수 아님. `JSON.parse` 를 두 분기 위로 한 번만 끌어올리고 그 자리에 try/catch 손상 방어 추가 권고. |
| 12 | maintainability | "닫힌 목록" 판정이 에러 쪽(`isErrorStatusCacheable`, named 함수)과 성공 쪽(인라인 조건)으로 비대칭 팩터링됨. | `idempotency.interceptor.ts:172-177` vs `:255-257` | 필수 아님. `isSuccessStatusCacheable()` 를 대칭으로 뽑으면 정책이 코드에서도 대칭적인 두 named 함수로 드러남. |
| 13 | maintainability | `intercept()` 가 손상 fallback/body 충돌/에러 재현/정상 재현/미스 위임 등 6갈래를 한 메서드(~63줄, 중첩 최대 4단)에서 처리 — 현재는 가독성 훼손이 크지 않으나 분기가 더 늘면 버거워질 지점. | `idempotency.interceptor.ts:88-150` | 필수 아님. 캐시 히트 처리 블록을 `private replayCached(...)` 로 추출 고려. |
| 14 | maintainability | e2e 가 인터셉터의 Redis 키 prefix(`interaction:idempotency:`)를 export 되지 않은 내부 상수와 별개로 3곳(`:425,:495,:538`)에 리터럴로 하드코딩 — prefix 변경 시 컴파일러가 drift 를 못 잡고 e2e 가 거짓 실패/성공으로 이어질 수 있음. 이번 diff 로 하드코딩 지점이 3곳으로 늘어남. | `test/external-interaction.e2e-spec.ts:425,495,538` vs `idempotency.interceptor.ts:21`(`REDIS_KEY_PREFIX`, non-export) | `REDIS_KEY_PREFIX` 를 export 하고 e2e 가 import 해서 사용하면 SoT 가 하나가 됨. |
| 15 | maintainability | e2e `IDEM-1~3` 세 테스트가 워크플로/노드/execution 셋업(각 10~15줄)을 거의 그대로 반복 — 기존 파일의 다른 e2e(`G`, `G-2` 등)와 동일 스타일, 새로운 패턴 아님. | `test/external-interaction.e2e-spec.ts:376-399,452-477,519-526` | 조치 불요(기존 컨벤션과 일치). fixture 조합이 더 늘면 공용 헬퍼 고려. |
| 16 | testing | `cacheTapped` 의 성공 채널 캐시 판정 상한 경계값 `300` 자체는 미테스트(`304` 만 행사) — 기존 라운드에서 이미 "이 API 는 3xx 를 내지 않아 실질 영향 0" 으로 유예, 이번 diff 는 이 영역 무변경. | `idempotency.interceptor.ts:177`; `idempotency.interceptor.spec.ts:426-439` | 조치 불필요. |
| 17 | documentation | `plan/in-progress/backend-lint-gate-broken-on-main.md:569-571` 의 `readKey`/`hashBody` 경계값 테스트 항목이 이미 해소된 전제("클래스 docstring 에 R8 선재 결함 참조 한 줄 추가")를 여전히 인용 — 여러 라운드 전부터 낮은 심각도로 확인·유지된 상태. | `plan/in-progress/backend-lint-gate-broken-on-main.md:569-571` | 없음 — 기존 트리아지 유지. |
| 18 | documentation | CHANGELOG·구현 docstring/인라인 주석·e2e 신규 블록(`IDEM-1/2/3`)·spec 미러(`data-flow/15`)가 최종 상태 기준 서로 정합함을 직접 대조로 재확인. 새 env 변수/API 엔드포인트/README 대상 표면 변경 없음. | `CHANGELOG.md:3-29`; `idempotency.interceptor.ts:39-257`; `test/external-interaction.e2e-spec.ts:361-550`; `spec/data-flow/15-external-interaction.md:258` | 없음 — 참고용 기록. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | idempotency 캐시 키 미스코프(선재, INFO) 외 신규 취약점 없음 |
| requirement | NONE | Spec EIA §R8 과 line-level 일치, 이전 라운드 CRITICAL/WARNING 전부 조치 확인, 신규 발견 없음 |
| scope | NONE | 72개 파일 전부 단일 의도(§R8 정합화)로 수렴, 스코프 크리프 없음 |
| side_effect | LOW | 이번 라운드 실질 변경은 테스트/문서뿐, 새 side effect 없음 |
| maintainability | NONE | 구조적으로 잘 정리됨, 잔여 항목은 전부 선택적 개선 여지(INFO) |
| testing | NONE | 단위 25/25 GREEN, 뮤테이션 재검증 통과, 잔여 갭은 이미 plan 기록된 선재 항목 |
| documentation | LOW | WARNING 1건(신규 docstring "전부" 과장, 4/7만 해당) |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 1건 이상의 INFO 이상 항목을 보고했다(대부분 선재·이미 유예된 항목의 재확인).

## 권장 조치사항

1. **(WARNING, 착수 권장)** `idempotency.interceptor.spec.ts:21-23` 의 모듈 docstring "전부 warn 을 단언한다" 문장을 실제 커버리지(7건 중 4건)에 맞게 정정하거나 규범적 문장으로 변경한다.
2. **(추가 조치 불필요, 이미 plan 백로그 반영됨)** 캐시 엔트리 내부 `responseJson` 손상 무방비 — 후속 세션에서 `JSON.parse` 를 한 곳으로 끌어올리며 방어를 추가할 것(`plan/in-progress/backend-lint-gate-broken-on-main.md:561-568` 참고).
3. **(추가 조치 불필요, 이미 추적 중)** Idempotency 캐시 키를 execution/인증 컨텍스트로 스코프하는 항목은 별도 백로그로 우선순위 상향 근거와 함께 기록되어 있음 — 이번 PR 범위 밖.
4. **(선택)** `REDIS_KEY_PREFIX` 를 export 하여 e2e 가 리터럴 대신 import 해서 사용하도록 정리(SoT 일원화).
5. **(선택)** `isSuccessStatusCacheable()` named 함수 분리, `intercept()` 의 캐시 히트 처리 블록을 `replayCached()` 로 추출 — 가독성 개선용, 필수 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — forced 전원 결과 확보됨, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 제외(이번 diff 특성상 성능 영향 낮음으로 판단, 개별 사유는 manifest 에 비제공) |
  | architecture | 라우터 제외(동일) |
  | dependency | 라우터 제외(동일) |
  | database | 라우터 제외(동일) |
  | concurrency | 라우터 제외(동일) |
  | api_contract | 라우터 제외(동일) |
  | user_guide_sync | 라우터 제외(동일) |
