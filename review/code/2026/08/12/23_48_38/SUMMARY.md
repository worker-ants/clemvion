# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나, 이 PR 이 없애려는 것과 동형인 결함(캐시 손상 → 처리되지 않은 크래시)이 좁은 sub-case("null" JSON) 에 여전히 남아 있고(testing), 같은 diff 안에서 CHANGELOG 와 클래스 docstring 표가 서로 모순되는 문서 결함(documentation)이 발견됨. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `cachedJson` 이 문법적으로는 유효한 JSON 이지만 객체가 아닌 값(특히 `"null"`)일 때 `discardCorruptEntry` 의 catch(JSON 문법 오류만 포착)를 우회해 바로 다음 줄 `cached.bodyHash` 접근에서 처리되지 않은 `TypeError` 로 크래시한다. 이 예외는 `GlobalExceptionFilter` 가 500 으로 마스킹 — 이 PR 이 명시적으로 없애려는 바로 그 실패 형태가 좁은 틈으로 재현된다(로컬 probe 로 실측: `TypeError: Cannot read properties of null (reading 'bodyHash')`). 다른 비객체 값(`"[]"`,`"42"`,`'"str"'`)은 오토박싱으로 `undefined`가 되어 크래시하지 않고 409로 fail-safe 하지만 `null` 만 유일하게 실제로 죽는다. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:157-167` | `discardCorruptEntry` 진입 조건에 `cached === null \|\| typeof cached !== 'object'` 가드 추가(권장), 또는 최소한 `redis.get.mockResolvedValue('null')` 회귀 테스트로 현재 동작을 고정하고 plan 백로그에 "선재 갭"으로 등재 |
| 2 | Documentation | `CHANGELOG.md` 신규 항목이 "이 클래스의 fail-open 다섯 경로(생성자 `null` 포함) 모두 warn 을 남긴다"라고 서술하지만, 같은 diff 가 신설한 클래스 docstring 표(`idempotency.interceptor.ts:65-71`)는 정반대로 "경로 1(생성자 `null`)은 warn 대상 아님 — 넷만 warn"이라 명시한다. 실제 코드(`:105-108`)에도 이 분기엔 `logger.warn` 호출이 없다(파일 전체 `logger.warn` 5곳 중 어디에도 해당 없음). 같은 세션이 이미 두 라운드에 걸쳐 "경로 개수를 정확히 세는" 문제를 지적·수정했는데, 이번엔 새로 쓴 CHANGELOG 문서 자체 내부에서 자기모순이 재발했다. | `CHANGELOG.md:17-19` vs `idempotency.interceptor.ts:62-78` | CHANGELOG 문구를 "GET 실패·SET 실패·직렬화 실패·엔트리/payload 손상 네 경로가 warn 을 남긴다(생성자 시점 미주입은 장애가 아니라 설정 상태)"로 정정하거나 "생성자 null" 을 목록에서 제외해 개수를 맞춘다 |
| 3 | Testing / Side-effect | 이번 diff 가 기존 테스트에 신규로 추가한 `warnSpy = jest.spyOn(Logger.prototype, 'warn')`(라인 512)가 `try/finally` 로 보호되지 않아, 테스트 본문 중 `expect` 가 실패하면 `mockRestore()`(라인 539)가 실행되지 않고 `Logger.prototype.warn` mock 이 같은 파일의 뒤 테스트로 새어나갈 수 있다. 같은 diff 가 바로 옆에 추가한 신규 테스트 3건은 이미 `try { … } finally { warnSpy.mockRestore(); }` 패턴을 따르는데 이 자리만 빠졌다(`jest.config.ts` 에 `restoreMocks`/`afterEach` 안전망도 없음, 확인됨). 실행 영향은 낮음(새어나간 spy 는 로그 노이즈만 억제, assertion 로직엔 영향 없음). | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:512-539` | `try { … } finally { warnSpy.mockRestore(); }` 로 형제 테스트 3개와 동형화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 손상된 캐시 파싱 실패 메시지가 새니타이징 없이 로그에 삽입(이론적 log injection/forging) — 이 값은 서비스 자신이 쓴 Redis 데이터라 신뢰 경계를 새로 확장하지 않음(직전 라운드에서도 조치 불요로 유예). 동일 패턴이 GET 실패·직렬화 실패·SET 실패 로깅에도 기존부터 존재 | `idempotency.interceptor.ts:225`(+145, 308, 316) | 조치 불요, 원하면 구조화 로깅으로 전환 |
| 2 | Security | `JSON.parse` 결과를 런타임 스키마 검증 없이 타입 단언으로 캐스팅 — 이 값도 서비스 자신이 쓴 캐시라 외부 입력 신규 유입 지점 아님 | `idempotency.interceptor.ts:159, 183` | 조치 불요(기존 관례), 강화 시 zod 등으로 별도 후속 |
| 3 | Security (긍정) | 이번 변경이 정보 노출 표면을 오히려 줄인다 — 종전엔 손상된 `responseJson` 이 맨몸 `JSON.parse` 로 500 마스킹됐으나 이제 `discardCorruptEntry` 로 구조화 fail-open 처리 | `idempotency.interceptor.ts:149-201` | 없음 |
| 4 | Security (긍정) | `bodyHash` 판정이 payload 파싱보다 먼저 순서라 캐시 손상으로 409 충돌 검출(멱등성 계약)을 우회할 수 없다 — 회귀 테스트로 순서 고정 확인 | `idempotency.interceptor.ts:167-186` | 없음 |
| 5 | Architecture (긍정) | `discardCorruptEntry` 로의 통합은 정석적 Extract Method — 두 손상 경로의 동작·가시성을 한 곳에서 통제, 향후 세 번째 손상 지점에도 확장 지점 마련(OCP) | `idempotency.interceptor.ts:219-228` | 없음 |
| 6 | Architecture / Maintainability | `discardCorruptEntry<T>` 제네릭이 현재 두 호출부 모두 `T=Observable<unknown>`로만 인스턴스화되어 단형성(2라운드 연속 유예됨). `switchMap` 콜백이 6갈래 분기를 한 클로저에서 처리해 복잡도가 파일 내 다른 메서드보다 높음(2라운드 연속 유예됨) | `idempotency.interceptor.ts:149-228` | 조치 불요 — 세 번째 호출부/6번째 분기가 추가되는 시점에 재검토 |
| 7 | Maintainability | 에러 메시지 포맷팅 삼항식(`err instanceof Error ? err.message : String(err)`)이 파일 안에서 4곳 반복 | `idempotency.interceptor.ts:145, 225, 308, 316` | `formatErr(err)` 파일-로컬 헬퍼 추출 검토(즉시 조치 불요, 1줄 표현식) |
| 8 | Maintainability | `discardCorruptEntry` 의 판별 파라미터(`what: '엔트리' \| 'payload'`)가 로그 문구용 한국어 리터럴을 겸함 — 현재는 무해 | `idempotency.interceptor.ts:220` | 향후 로직 분기 조건으로 쓰이게 되면 내부 식별자와 표시 문구를 분리 |
| 9 | Maintainability | 신규 테스트 2건(200/409 케이스)이 구조적으로 거의 동형이나, 주석이 "재현 분기가 다시 갈릴 회귀에 대비한 의도적 캐너리"임을 명시 | `idempotency.interceptor.spec.ts:566, 636` | 조치 불요 — 의도가 문서화된 중복 |
| 10 | Requirement / Scope | 직전 라운드의 INFO(엔트리 warn 추가가 plan 표제보다 넓다)에 대해 plan 이 "수용 — 표제를 넓게 적는 편이 낫다"고 적었으나 실제 체크박스 제목은 여전히 좁은 원제로 남아 있음. 기능·spec 정합성 영향 없음 | `plan/in-progress/backend-lint-gate-broken-on-main.md:610` | 다음 plan 수정 시 제목 확장(급하지 않음) |
| 11 | Scope | 클래스 docstring 표를 다섯 경로로 갱신하면서 이번 diff 가 만들지 않은 선재 누락(직렬화 실패 경로)도 함께 채워짐 — 저자가 커밋 메시지/CHANGELOG 에 명시적으로 기록한 정당한 동반 수정 | `idempotency.interceptor.ts:62-71` | 조치 불요 |
| 12 | Side-effect (긍정) | `res.status(cached.statusCode)` 호출이 payload 파싱 성공 이후로 이동 — 종전엔 파싱 실패 시 "부분적으로 mutate 된 응답 객체"가 남는 부작용이 있었으나 이번 변경으로 제거됨 | `idempotency.interceptor.ts:199-200` | 조치 불요 |
| 13 | Side-effect | `discardCorruptEntry` 의 엔트리 손상 경로가 신규로 warn 로그를 emit — 의도된 관측성 개선(CHANGELOG/plan 명시). Redis 가 지속적으로 손상 값을 반환하는 장애 시나리오에서 요청마다 warn 이 찍혀 로그 볼륨 증가 가능 | `idempotency.interceptor.ts:219-228` | 로그 기반 알림 임계값 운용 시 참고 |
| 14 | Testing (긍정) | 회귀 방지가 견고함 — `npx jest idempotency.interceptor.spec.ts` 33/33 통과 실측, 뮤테이션(payload warn 제거)이 2건에서 모두 사살됨을 코드 대조로 확인, `bodyHash` 판정 순서를 겨냥한 캐너리 테스트가 plan 에 실측 경위까지 기록됨 | `idempotency.interceptor.spec.ts` 전반 | 없음 |
| 15 | Security / Scope | `review/code/2026/08/12/{23_24_08,23_36_13}/**` 22개 신규 파일은 이전 두 `/ai-review` 라운드의 정규 산출물(`review/code/<Y>/<M>/<D>/<hh_mm_ss>/` 저장 규약 준수) — 스코프 이탈·평가 대상 아님 | `review/code/2026/08/12/{23_24_08,23_36_13}/*` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 인젝션/인증우회 없음, fail-open 개선이 노출 표면 오히려 축소, bodyHash 순서가 409 우회 방지 |
| architecture | NONE | Extract Method 리팩터로 구조 개선, 제네릭/복잡도는 기존 2라운드 유예 유지 |
| requirement | LOW | 기능 완전 구현·spec(EIA R8) 정합, plan 문서 미이행 1건만 잔존(기능 영향 없음) |
| scope | NONE | 단일 결함(캐시 엔트리 파싱 방어)에 결속된 changeset, 확장분 전부 문서화·선행 수용됨 |
| side_effect | LOW | 응답 mutate 시점 개선(긍정), warnSpy try/finally 누락 1건(#3와 동일 사안) |
| maintainability | LOW | 심각한 이슈 없음, 스타일 관찰 4건(전부 기존 라운드 유예) |
| testing | MEDIUM | `"null"` JSON 이 방어를 우회해 처리되지 않은 크래시로 500 마스킹 재현(#1) |
| documentation | WARNING(문서정확성) | CHANGELOG 가 같은 diff 의 클래스 docstring 표와 자기모순(#2), 그 외 이전 라운드 지적 전부 반영 확인 |

## 발견 없는 에이전트

없음 — 8개 forced/ran 에이전트 전원이 최소 1건 이상의 발견(주로 INFO)을 보고함.

## 권장 조치사항

1. **(최우선)** `discardCorruptEntry` 진입 조건에 `cached === null || typeof cached !== 'object'` 가드를 추가해 "null" JSON 캐시 엔트리로 인한 처리되지 않은 `TypeError` 크래시를 없앤다(`idempotency.interceptor.ts:157-167`). 최소한 `redis.get.mockResolvedValue('null')` 회귀 테스트로 현재 동작을 고정하고 plan 백로그에 등재.
2. `CHANGELOG.md:17-19` 를 정정 — "생성자 `null`" 을 warn 경로 목록에서 제외하거나 문구를 "네 경로가 warn" 으로 바꿔 같은 diff 의 클래스 docstring 표(`idempotency.interceptor.ts:65-71`)와 일치시킨다.
3. `idempotency.interceptor.spec.ts:512-539` 의 `warnSpy` 를 `try { … } finally { warnSpy.mockRestore(); }` 로 감싸 형제 테스트 3개와 동형화한다.
4. (선택, 급하지 않음) plan 체크박스 제목(`plan/in-progress/backend-lint-gate-broken-on-main.md:610`)을 "손상 처리 전체"로 넓혀 이전 라운드의 "수용" 처분을 실제로 반영한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**:

    | 제외된 reviewer | 이유 |
    |------------------|------|
    | performance | 라우터 판단 — 해당 없음(본 diff 는 성능 특성 변경 없음). 상세 사유는 `_routing_decision.json` 참고 |
    | dependency | 라우터 판단 — 의존성 변경 없음 |
    | database | 라우터 판단 — 스키마/쿼리 변경 없음 |
    | concurrency | 라우터 판단 — 동시성 제어 로직 변경 없음 |
    | api_contract | 라우터 판단 — 공개 API 계약 변경 없음(`intercept()` 시그니처 무변경) |
    | user_guide_sync | 라우터 판단 — 사용자 가이드 대상 변경 없음 |

  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음.
