# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 2건(둘 다 이 PR 이전부터 존재한 idempotency 캐시 동작의 선재 결함 — 이번 lint 정리 델타가 만든 것은 아니나, 이번 델타가 그 동작을 정면으로 다루는 타입/테스트를 추가하며 처음 표면화됨). forced whitelist(8명) 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | Idempotency 캐시 제외 조건(`statusCode >= 400`)이 Spec EIA §R8 이 명시한 범위(400 VALIDATION_ERROR 만 제외, 409/410 은 캐시 대상)보다 넓다 — 같은 `Idempotency-Key`+body 로 409/410 재요청 시 캐시 재생 대신 downstream 이 매번 재실행되어 `EIA-RL-02`(멱등 24h 재현)를 그 범위에서 위반. 2026-05-21 원본 구현(`35ff9c19b`)부터 있던 선재 결함으로 이번 델타가 만든 것은 아니지만, 이번 델타가 추가한 신규 회귀 테스트가 이 동작을 "Spec EIA §R8"이라는 부정확한 근거로 고정시켰다 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:131`(`if (statusCode >= 400) return;`), 테스트: `idempotency.interceptor.spec.ts:212` | 캐시 제외 조건을 `statusCode === 400`으로 좁혀 409/410 캐시 대상 복원. `plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그에 항목 추가 |
| 2 | testing | `idempotency.interceptor.ts`의 손상된 캐시 JSON `catch` 분기(캐시 히트 시 파싱 실패 → fallback)가 여전히 완전 미검증 상태인데, `plan/in-progress/backend-lint-gate-broken-on-main.md`는 "캐시 히트 경로 전체를 메웠다"고 실제보다 넓게 서술한다. 실패 방향은 fail-open(요청 자체는 안 실패)이라 영향은 낮지만 catch 블록이 깨져도 현재 스위트로는 못 잡음 | `idempotency.interceptor.ts` `intercept()` 내 `try { cached = JSON.parse(cachedJson) } catch {...}` 블록(88-95행), 테스트: `idempotency.interceptor.spec.ts` 전체(9건, 손상 JSON 케이스 0건) | `redis.get.mockResolvedValue('not-valid-json{')` 케이스 추가해 `next.handle()` 호출·정상 응답 흐름·재적재까지 고정. plan 문서의 "메웠다" 문구를 이 공백 반영해 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `idempotency.interceptor.spec.ts` 신규 테스트 5건에서 `new IdempotencyInterceptor(undefined, redis as never, undefined)` 생성자 호출이 동일하게 5회 인라인 반복(같은 블록의 `bodyHashOf` 헬퍼 추출과 스타일 비일관) | `idempotency.interceptor.spec.ts:165-169, 196-200, 214-218, 235-239, 269-273` | 로컬 헬퍼(`makeInterceptor`)로 추출 권장, 강제 수정 아님 |
| 2 | documentation | `idempotency.interceptor.spec.ts` 파일-레벨 docstring 이 이번 델타로 파일을 2배(139→286줄)로 늘린 신규 `describe`(캐시 히트·응답 형태 방어) 블록을 반영하지 않음(각 블록 자체 docstring은 정확해 실질 혼동 위험은 낮음) | `idempotency.interceptor.spec.ts:1-10` | 파일 최상단에 "+ 캐시 히트/응답 형태 방어(HttpResponseLike 회귀 고정)" 한 줄 추가 |
| 3 | security | admission-control 쿼리 결과가 런타임 shape 검증 없이 신뢰됨(이번 델타가 만든 위험 아님, fail-closed 방향이라 안전, plan 에 이미 하드닝 제안 유예 기록됨) | `execution-engine.service.ts:2911`(`m.query<{ id: string }[]>`) | 필수 아님. 하드닝 원하면 `Array.isArray(rows)` 가드 추가 고려(후속 세션 범위) |
| 4 | scope/documentation | 리뷰 산출물이 코드/plan diff(15파일·384줄) 대비 review/** diff(23파일·1871줄)로 약 4.9배 계속 누적 — 3라운드째 동일 패턴, CLAUDE.md 표준 워크플로에 부합해 조치 불요로 재확인됨 | `review/code/2026/08/12/11_06_12/*`, `review/code/2026/08/12/12_05_39/*` | 조치 불요. PR 설명에 "review/** 는 산출물, 기능 diff 아님" 명시 정도로 충분 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 보안 위험 없음. cross-tenant 캐너리(`workspace-reflection-canary.ts`)·idempotency 방어 가드 모두 시그니처 대조로 런타임 불변 확인 |
| requirement | LOW | WARNING 1건(idempotency 캐시 제외 범위가 Spec EIA §R8 보다 넓음) — 선재 결함, 이번 델타가 표면화 |
| scope | LOW | 스코프 이탈 없음. 신규 변경(README, spec 5건)은 직전 라운드 WARNING 의 정확한 조치. 리뷰 산출물 누적 패턴 재관찰 |
| side_effect | NONE | 로직/런타임 변경 없음(emit 바이트 비교 실증 승계). `package.json` lint 게이트 exit code 계약 변화는 의도된 것 |
| maintainability | NONE | INFO 1건(생성자 호출 반복) 외 이전 라운드 판정 그대로 유지 |
| testing | LOW | WARNING 1건(손상된 캐시 JSON catch 분기 미검증 + plan 과장 서술). 신규 테스트 5건은 mock 격리·가독성 양호 |
| documentation | NONE | INFO 2건(docstring 갭, 산출물 누적) 외 결함 없음. 직전 라운드 WARNING(README) 정확히 해소 확인 |
| dependency | NONE | 신규 패키지/버전/라이선스 변경 없음. lockfile 변경 0건 |

## 발견 없는 에이전트

dependency (완전 NONE, INFO 도 없음)

## 권장 조치사항

1. `idempotency.interceptor.ts`의 캐시 제외 조건을 `statusCode >= 400` → `statusCode === 400`으로 좁혀 409/410 캐시 대상을 복원한다(Spec EIA §R8 / EIA-RL-02 정합). `plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그에 항목 추가.
2. 손상된 캐시 JSON `catch` 분기에 대한 회귀 테스트(`redis.get.mockResolvedValue('not-valid-json{')`)를 추가하고, plan 문서의 "캐시 히트 경로 전체를 메웠다" 서술을 이 공백을 반영해 정정한다.
3. (선택) `idempotency.interceptor.spec.ts`의 반복되는 생성자 호출을 로컬 헬퍼로 추출하고, 파일 최상단 docstring에 신규 describe 블록을 한 줄 반영한다.
4. 본 PR(순수 타입 lint 정리) 자체는 위 결함들로 인해 막을 사유가 없다 — 1·2번은 후속 작업으로 분리해 백로그 처리 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency (8명)
  - **제외**: 표 (아래, 6명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명, 실행된 8명과 동일 — forced 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세 미제공) — 이 델타가 순수 타입 주석/제네릭/단언 추가로 런타임 성능 경로 무변경이라는 특성상 비관련 판단으로 추정 |
  | architecture | 상동 — 구조/모듈 경계 변경 없음 |
  | database | 상동 — 스키마/쿼리 로직 변경 없음(주석·타입만 추가) |
  | concurrency | 상동 — 동시성 제어 로직 변경 없음 |
  | api_contract | 상동 — 공개 API 시그니처/응답 계약 변경 없음 |
  | user_guide_sync | 상동 — 사용자 가시 문서 대상 변경 없음 |
