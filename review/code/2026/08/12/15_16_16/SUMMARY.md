# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(fail-open 트레이드오프 확대 — spec 승인·이미 유예 완료). 4라운드째 동일 코드를 검토한 결과이며 신규 결함 없음. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | fail-open 이 `Idempotency-Key` 중복 억제 무력화 구간을 "좁은 타이밍 창"에서 "Redis 장애 지속 구간 전체"로 확대한다. GET→SET 이 원자적 CAS(`SET NX`)가 아니라 별도 호출이라(선재 구조), 장애 중에는 도착하는 모든 재요청이 무조건 캐시 미스로 판정돼 다운스트림(execution 생성 등) 중복 실행 위험이 커진다 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:67-72`(docstring), `:98-112`(신규 `catchError`), `:174-180`(기존 `cacheTapped()` SET) | 코드 변경 불요 — spec(`spec/data-flow/15-external-interaction.md`)이 명시적으로 승인한 가용성 우선 트레이드오프. `CHANGELOG.md`·클래스 docstring·`plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그(관측 지표·`SET NX EX`/in-flight dedup 검토)에 이미 문서화·추적 중. 3라운드 연속 "코드로 되돌릴 필요 없음"으로 판정 유지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/architecture/concurrency/requirement/side_effect (통합) | fail-open 설계 자체(Redis GET 실패를 캐시 미스로 강등)는 spec 이 명시한 "전 경로 fail-open — 가용성 우선"의 정확한 구현. `catchError`(107행)가 `switchMap`(113행) **앞**에 위치해 `ConflictException`(409) 검출을 삼키지 않으며, 전용 캐너리 테스트(`idempotency.interceptor.spec.ts:405-428`)로 회귀 고정됨 | `idempotency.interceptor.ts:98-113` | 조치 불요. 과거 라운드의 "순서 역전" CRITICAL 은 병렬 세션의 공유 워크트리 뮤테이션 아티팩트였음이 4라운드 연속 재확인됨 |
| 2 | requirement/security | R8 대비 캐시 제외 범위 초과(`statusCode >= 400` 전체 제외가 spec 요구 "400만 제외"보다 넓어 409·410 도 캐시에서 빠짐) — 선재 결함, 이번 diff 변경 대상 아님 | `idempotency.interceptor.ts:168`(`cacheTapped()`) | 조치 불요, 스코프 밖. `plan/in-progress/backend-lint-gate-broken-on-main.md` 로 이미 추적 중 |
| 3 | architecture/maintainability | GET/SET 두 캐시 실패 로그 조립 로직이 동일 패턴을 독립 복제(정확히 2곳). 레포 전역에 Redis fail-open 관용구가 20개 이상 파일에 개별 구현되어 공유 resilience 래퍼 부재. GET→SET 이 원자적 저장소 추상화(`IdempotencyStore`) 없이 인터셉터에 직접 배선 | `idempotency.interceptor.ts:107-112` vs `:174-180` | 조치 불요(3라운드 연속 유예, 2곳뿐이라 낮은 우선순위). 후속 아키텍처 개선 항목으로만 참고 |
| 4 | maintainability | 신규 GET fail-open 테스트의 `warnSpy` 셋업/복원 보일러플레이트가 기존 SET 테스트와 문자 그대로 중복(정확히 2곳) | `idempotency.interceptor.spec.ts:360-382` vs `:440-462` | 조치 불요. 3번째 fail-open 테스트가 생기면 헬퍼 추출 재검토 |
| 5 | testing | GET reject→캐시 미스 테스트가 `bodyHash` 만 단언(`statusCode`/`responseJson` 미단언, 다른 테스트가 커버). 비-Error reject 테스트는 `warn` 호출 자체를 단언하지 않아 GET/SET 케이스와 스타일 비대칭. `readKey`/`hashBody` 경계값 단위 테스트 부재(선재). fail-open 구간의 "동시 중복 요청" 결과를 직접 재현하는 테스트 없음 | `idempotency.interceptor.spec.ts:396-403`, `:465-480`, `:189-200` | 조치 불요, 전부 낮은 우선순위. 판별력은 이미 확보됨(뮤테이션 실측) |
| 6 | documentation | 3번째 describe 블록의 지역 docstring 이 5개 테스트를 항목별로 나열하지 않음(3라운드째 이월, 파일 헤더가 이미 요약 중이라 실질 손실 적음) | `idempotency.interceptor.spec.ts:343-353` | 필수 아님 |
| 7 | scope | `bodyHashOf` 헬퍼를 모듈 최상단으로 이동(중복 통합) 및 plan 백로그 신규 항목 추가는 원 fix 범위를 살짝 넘지만, 사전 승인된 review-fix 워크플로(CLAUDE.md 명시)의 정상 산출물 | `idempotency.interceptor.spec.ts:94`, `plan/in-progress/backend-lint-gate-broken-on-main.md:524-530` | 조치 불요 |
| 8 | scope | diff 에 직전 3회 리뷰 라운드 산출물 36개 파일이 신규 파일로 포함(코드 변경 아님, 프로젝트 규약상 정상 커밋 대상) | `review/code/2026/08/12/{14_27_02,14_50_36,15_04_25}/*` | 조치 불요, 리뷰 노이즈 참고만 |
| 9 | side_effect | 테스트의 `jest.spyOn(Logger.prototype, 'warn')` 전역 patch 는 `try/finally` 로 안전하게 격리됨 | `idempotency.interceptor.spec.ts:360, 440` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-open 은 spec 승인 트레이드오프. 인젝션·시크릿·인가 이슈 없음 |
| architecture | LOW | `catchError` 배치 정확, 레이어 경계 건전. 잔여는 전부 유예된 저강도 리팩터 기회 |
| requirement | NONE | 의도-구현 line-level 일치. 신규 요구사항 결함 없음. 16/16 테스트 통과 직접 실행 확인 |
| scope | NONE | 핵심 변경은 단일 의도에 수렴. 부수 변경은 사전 승인된 review-fix 산출물 |
| side_effect | LOW | 유일한 실질 부작용은 spec 승인된 설계 의도(500→200 fail-open) 자체 |
| maintainability | NONE | 신규 변경은 기존 테스트 보강 1건. 소규모 중복 2건은 유예 유지 |
| testing | LOW | 16/16 통과 직접 실행 확인. 신규 CRITICAL/WARNING 급 테스트 갭 없음 |
| documentation | NONE | CHANGELOG·docstring·spec 인용·plan 체크리스트 정합. 잔여 INFO 1건 저우선순위 |
| concurrency | MEDIUM | fail-open 이 중복 억제 무력화 구간을 확대(WARNING) — spec 승인, 코드 변경 불요로 재확인 |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 기록, 대부분 "조치 불요" 판정).

## 권장 조치사항

1. (참고, 급하지 않음) `plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그에 이미 등재된 Redis GET 실패율 관측 지표 알람 구현을 후속 스프린트에서 진행.
2. (참고, 급하지 않음) 여유가 될 때 GET/SET 캐시 실패 로그 조립 로직(코드)과 `warnSpy` 셋업(테스트) 중복을 공용 헬퍼로 추출 — 3번째 실패 경로가 생기기 전까지는 낮은 우선순위.
3. (참고, 스코프 밖) `IdempotencyStore`(reserve/commit) 추상화 도입 시 `SET NX EX` 원자적 선점 또는 in-flight dedup 을 함께 검토해 fail-open 구간의 중복 실행 위험을 완화할 수 있다.
4. 현재 diff 자체는 병합 차단 사유 없음 — CRITICAL 0건, 유일한 WARNING 은 spec 승인·문서화·백로그 추적이 이미 완료된 항목.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(RxJS `catchError` 삽입) 와 무관한 축으로 제외 |
  | dependency | 신규 의존성 없음(기존 `rxjs/operators` 재사용) — 제외 |
  | database | DB 스키마/쿼리 변경 없음 — 제외 |
  | api_contract | 공개 API 시그니처/스키마 변경 없음 — 제외 |
  | user_guide_sync | 사용자 대상 문서 변경 없음 — 제외 |
