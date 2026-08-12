# Code Review 통합 보고서

## 전체 위험도
**LOW** — 신규 CRITICAL/WARNING 없음. 이번 diff(멱등 캐시 키를 `<executionId>:<route>:<key>` 로 스코프하는 EIA §R8 보안 수정 + 직전 라운드(`21_02_30`) WARNING 3건 조치 + plan lifecycle 이동 + 그 라운드 리뷰 산출물 커밋)는 7개 강제(forced) reviewer 전원이 결과를 반환했고 전원 CRITICAL/WARNING 0건으로 수렴했다. 최고 위험도는 side_effect·maintainability 의 LOW(신규 부작용 아님, 정보성 재확인)이다.

**라우팅 무결성 확인**: router 가 강제 지정한 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원의 결과가 인라인 전문으로 확보되었다 — forced 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | executionId 는 `InteractionGuard` 가 토큰 검증 후 서버 측에서 합성 — 클라이언트 위조 불가. Guard→Interceptor 실행 순서(클래스 레벨 `@UseGuards` vs 메서드 레벨 `@UseInterceptors`)로 인증 우회 없이 스코프 확정 확인 | `idempotency.interceptor.ts:100`, `interaction.controller.ts:58` | 없음(확인 완료) |
| 2 | security/requirement | `req.interaction` 부재 시 전역 키로 fallback 하지 않고 캐시 자체를 skip — 원 취약점 재현 방지. spec §R8 Rationale 과 일치 | `idempotency.interceptor.ts:100-109` | 없음 |
| 3 | security/side_effect | `route` 세그먼트(`context.getHandler().name`)가 런타임 함수명 리플렉션에 의존 — minifier 도입 시 붕괴 가능. 이미 직전 라운드에서 평가·수용, e2e `IDEM-5` 가 캐너리 | `idempotency.interceptor.ts:113-119` | 조치 불필요, e2e 캐너리로 방어됨 |
| 4 | side_effect | ctx 부재 경로의 신규 `Logger.warn` — 정상 배선(Guard 필수 경유)에서는 도달 불가능해 로그 폭주 위험 없음 | `idempotency.interceptor.ts:105-108` | 조치 불필요, Guard 없는 라우트 재사용 시 재검토 |
| 5 | side_effect | 캐시 키 포맷 변경으로 배포 시점 기준 구-포맷 Redis 엔트리 고아화 — TTL(24h) 자연 소멸, CHANGELOG 에 배포 전환기 문단으로 이미 문서화 | `idempotency.interceptor.ts:121`, `CHANGELOG.md:30-32` | 추가 조치 불필요 |
| 6 | maintainability | 쌍둥이 테스트 헬퍼(`scopedKey` vs `idempotencyCacheKey`)의 인자 순서는 통일됐으나 `route` 파라미터 타입 엄격도가 다름(`string` vs `'interact'\|'cancel'` 유니온) | `idempotency.interceptor.spec.ts:81-87`, `external-interaction.e2e-spec.ts:129-135` | 급하지 않음 — 다음에 헬퍼 만질 때 공유 타입 별칭으로 통일 검토 |
| 7 | maintainability | `intercept()` 가 이번 diff 로 스코프 계산 로직이 더해져 책임이 계속 넓어짐 — 이미 직전 라운드에서 조건부(세 번째 축 추가 시 분리) 유예된 항목, 이번에 그 조건에 한 걸음 더 근접 | `idempotency.interceptor.ts` `intercept()` 91-176행 | 조치 불필요, 세 번째 축 추가 시 `resolveScopedKey()` 분리 검토 |
| 8 | testing | 유닛 "route 축" 테스트는 키 레이아웃(GET/SET 인자)만 단언, 실제 캐시 hit 반환값의 route 별 분기는 이 블록에서 미검증(mock 이 항상 미스) — e2e `IDEM-5` 가 실제 파이프라인으로 행동 단언까지 커버 | `idempotency.interceptor.spec.ts` route 축 `it` (854행 부근) | 조치 불필요, 이미 e2e 로 메워짐 |
| 9 | testing | `executionId` 빈 문자열(`''`)에 대한 유닛 테스트 없음 — `InteractionGuard` 가 항상 non-empty 값 합성하므로 실질 도달 불가능 | `idempotency.interceptor.ts:100-101` | 우선순위 낮음, 참고용 |
| 10 | requirement | `spec/5-system/4-execution-engine.md` §9.1/§9.2 Redis 키 레지스트리에 `interaction:idempotency:*` 미등재 — 이 diff 이전부터 있던 더 넓은 선재 갭, plan 문서에 별도 후속 항목으로 명시 추적 중 | 해당 없음(spec 문서) | 이미 별도 후속 항목으로 추적 중 |
| 11 | scope | route 축 확장은 엄밀히 원 지적(요청자 간 캐시 공유) 범위를 넘어서지만, 동일 취약점 클래스를 닫는 것이고 plan Rationale 에 명시적으로 정당화됨. 직전 라운드도 이 축 포함해 NONE 판정 | `idempotency.interceptor.ts` `intercept()` route 변수 산출부 | 없음 — 참고 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | broken-access-control 결함을 정확히 겨냥한 보안 수정. executionId 위조 불가, fail-closed, 인젝션 표면 없음, 하드코딩 시크릿 없음 |
| requirement | NONE | spec EIA §R8/EIA-IN-11/EIA-RL-02 와 line-level 일치. 29/29 유닛 테스트 통과 재현. SPEC-DRIFT 없음 |
| scope | NONE | 전 파일이 단일 목표(§R8)로 추적됨. 무관한 파일·불필요한 리팩토링·기능 확장·설정 변경 없음 |
| side_effect | LOW | 실질 부작용은 캐시 네임스페이스 의도적 축소뿐. 전역 상태·환경변수·네트워크 대상·공개 시그니처 변화 없음 |
| maintainability | LOW | 직전 라운드 WARNING 3건 전부 소스에서 반영 확인. 신규 INFO 2건은 즉각 조치 불요 |
| testing | NONE | 29/29 GREEN 재현. e2e IDEM-4/IDEM-5 는 판별력 있는 fixture(상태코드 실제로 갈림), 행동 단언 우선 배치 |
| documentation | NONE | 직전 라운드 유일 WARNING(모듈 docstring) 조치 확인. 주석-코드-spec-CHANGELOG 전 계층 정합 |

## 발견 없는 에이전트

- security, requirement, scope, testing, documentation — CRITICAL/WARNING 없음(NONE 위험도)

## 권장 조치사항

이번 라운드는 병합을 막을 CRITICAL/WARNING 이 없어 즉각 조치 불요. 참고용(선택적, 급하지 않음):

1. `scopedKey`(unit)와 `idempotencyCacheKey`(e2e) 헬퍼가 공유하는 `route` 파라미터 타입을 `'interact' | 'cancel'` 유니온(또는 공유 타입 별칭)으로 통일해 향후 오타 route 문자열이 컴파일 타임에 잡히도록 한다.
2. 향후 스코프 축이 하나 더(예: tokenFamily) 추가될 경우 `intercept()` 의 스코프 키 조립부를 `resolveScopedKey(req, context)` private 헬퍼로 분리한다.
3. `spec/5-system/4-execution-engine.md` §9.1/§9.2 Redis 키 레지스트리에 `interaction:idempotency:*` 계열 키 등재는 이미 별도 후속 항목으로 추적 중이므로 그 트랙에서 처리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
  - **제외**: 표 (아래, 7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원 결과 확보 확인됨 — forced 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(캐시 키 문자열 조립 1줄 변경)와 무관 |
  | architecture | router 판단상 아키텍처 구조 변경 없음 |
  | dependency | router 판단상 의존성 변경 없음 |
  | database | router 판단상 스키마/쿼리 변경 없음(DB 접근은 파라미터 바인딩 기존 패턴 유지) |
  | concurrency | router 판단상 동시성 로직 변경 없음 |
  | api_contract | router 판단상 공개 API 계약(Swagger 등) 변경 없음 |
  | user_guide_sync | router 판단상 사용자 가이드 동기화 대상 아님 |
