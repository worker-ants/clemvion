# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 7개 reviewer(전원 router_safety 강제 포함) 전부 CRITICAL 0·WARNING 0, INFO만 보고했고 개별 위험도 최고치는 LOW(side_effect, maintainability). 나머지는 NONE. forced 화이트리스트 7명 전원 결과 확보됨(누락 없음) — `documentation.md` 는 디스크에 파일이 없었으나 인라인 전문이 authoritative 하여 이번 라운드에 영속화(Write)했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/15-external-interaction.md` L308 "Redis 등 전 경로 fail-open(warn) — 가용성 우선" 서술이 실제 구현보다 넓다. 다섯 fail-open 경로 중 "기동 시 미주입(생성자 `null`)" 은 warn 을 남기지 않는다(설정 상태이지 장애가 아니므로 코드가 옳음) — 코드·CHANGELOG·docstring 3곳은 서로 일치하고 spec 본문만 더 넓게 서술 | `spec/data-flow/15-external-interaction.md:308` vs `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:63-71,106` | 코드 변경 불필요. 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md:648-663` 에 `[ ]` planner 인계 항목으로 등재됨 — project-planner 턴에서 spec 본문(`14-external-interaction-api.md` §R8 Rationale, `data-flow/15` §4/§Rationale) 갱신 |
| 2 | 구조 | `intercept()` 의 `switchMap` 콜백이 7개 분기로 늘어 두 차례("6번째 분기 추가 시 재검토") 유예된 트리거가 실제 발동함. 기능 결함 아님(조기 반환 유지, 41/41 GREEN) | `idempotency.interceptor.ts:149-217` | 조치 불요 — `resolveCacheHit()` 추출 항목이 이미 plan 백로그(`backend-lint-gate-broken-on-main.md`)에 등재돼 다음 착수 예정 |
| 3 | 보안(방어 비대칭) | `cachedPayload`(안쪽 `responseJson` 재파싱 결과)는 문법 오류만 방어되고 형태(shape) 검증은 없음(엔트리는 `isIdempotencyEntry()` 로 검증). 값 출처가 이 서비스 자신이 쓴 Redis 값이라 실질 위험은 낮음 | `idempotency.interceptor.ts` `intercept()` 내 `JSON.parse(cached.responseJson)` → `HttpException` 생성 | 조치 불요. 일관성 원하면 `typeof === 'object'` 최소 검사 추가 가능하나 이번 diff 결함 아님 |
| 4 | 보안(로그 위생) | 손상 로그에 `err.message` 를 새니타이징 없이 삽입(이론적 log-injection, 선재 패턴, 이번 diff 로 신규 표면 아님). 형태 불일치 분기(`describeShape`)는 타입 문자열만 반환하도록 제한돼 있어 오히려 로그 위생이 개선된 자리 | `idempotency.interceptor.ts` `discardCorruptEntry` 의 `this.logger.warn(...)` | 조치 불요(risk 낮음) |
| 5 | 보안(값 범위) | `isIdempotencyEntry()` 가 `statusCode` 의 타입만 검증하고 유효 HTTP 상태코드 범위는 검증하지 않음. 값 출처가 서비스 자신뿐이라 실효 위험 낮음. 직전 라운드에서도 동일 결론, plan 에 재검토 트리거 명시 | `idempotency.interceptor.ts` `isIdempotencyEntry` | 조치 불요. Redis 신뢰 경계 확장 시 재평가 |
| 6 | 부작용(의도됨) | 캐시 손상 시 응답이 `500`(예외 전파) → fail-open 정상 처리로 변경 — 이 PR 의 목적 자체이며 CHANGELOG 에 공시, 회귀 테스트로 고정 | `idempotency.interceptor.ts` `discardCorruptEntry('payload', ...)` 호출부, `CHANGELOG.md:3-25` | 없음 |
| 7 | 부작용(의도됨) | 바깥 엔트리 손상 경로가 이제 `Logger.warn` 을 남김(이전엔 조용히 강등) — 값 자체는 로그에 안 찍힘(`describeShape` 로 타입/형태만 문자열화), CHANGELOG 명시 | `idempotency.interceptor.ts:234-243`, 호출부 `:161,171-175` | 없음 |
| 8 | 스코프 | 바깥 엔트리 JSON 손상 경로에도 warn 로그가 추가된 것은 plan 항목 원 표제("내부 responseJson 손상")보다 한 칸 넓음 — 이미 3라운드 전 지적·수용·plan 제목 정정까지 완료된 사안 | `idempotency.interceptor.ts` `discardCorruptEntry('엔트리', ...)` 호출부 | 조치 불요(이미 처분·plan 반영 완료) |
| 9 | 스코프 | 클래스 docstring 의 fail-open 경로 표를 "세 경로"→"다섯 경로"로 갱신하면서, diff 와 무관하게 선재했던 "직렬화 실패" 항목 누락도 동반 정합화 — 정당한 동반 수정 | `idempotency.interceptor.ts` 클래스 docstring | 없음 |
| 10 | 테스트 격리 | diff 범위 밖 기존 테스트 2건(Redis GET 실패 fail-open)이 `Logger.warn` 콘솔 노이즈를 낸다 — 이번 PR 이 만든 것도 손댄 것도 아님. 같은 파일의 다른 6개 신규 테스트는 전부 `try/finally`+`warnSpy` 로 이미 격리됨 | `idempotency.interceptor.spec.ts` "Redis 런타임 장애 fail-open" describe 블록 내 2개 it | 조치 불요(diff 범위 밖). 다음에 이 블록을 만질 때 동일 패턴 적용 권장 |
| 11 | 유지보수성 | `it.each` fixture 8행 중 뒤 3행(타입 불일치 케이스)이 `expectedShape` 값으로 동일 문자열 `'object'` 반복 — 결함 아니라 `typeof` 특성상 자연스러운 데이터 반복 | `idempotency.interceptor.spec.ts:562-582` | 조치 불요 |
| 12 | 확인(해소) | 직전 라운드가 지적한 "`describeShape()` 가 하중 없는 헬퍼(상수 치환해도 41/41 GREEN)" 문제가 `expectedShape` 값 단언 추가로 실제 해소됨(뮤테이션 재확인) | `idempotency.interceptor.spec.ts:611-619` | 없음 |
| 13 | 확인(해소) | 4라운드에 걸쳐 지적된 문서 drift(클래스 docstring 경로 개수, CHANGELOG 자기모순, 테스트 stale 인용 주석, plan 완료 노트) 전부 실제 소스 대조로 반영 확인 | `idempotency.interceptor.ts:62-71,222-232`, `CHANGELOG.md:21-24`, `idempotency.interceptor.spec.ts:909-913`, `plan/in-progress/backend-lint-gate-broken-on-main.md:622-647` | 없음 |
| 14 | 워크플로 산출물 | `review/code/**`, `review/consistency/**` 하위 신규 파일 다수(RESOLUTION/SUMMARY/개별 reviewer md/meta.json 등)는 표준 `/ai-review`+`--impl-done` 워크플로의 정상 산출물, 실질 코드 변경은 4개 파일(`CHANGELOG.md`, `idempotency.interceptor.ts`, `.spec.ts`, plan md)에 국한 | `review/code/2026/08/12/**`, `review/code/2026/08/13/00_20_20/**`, `review/consistency/**` | 조치 불요 |
| 15 | 확인 | `isIdempotencyEntry()`/`describeShape()` 신설 헬퍼는 non-export, private/모듈 스코프로 결속돼 있음 — 공개 시그니처·환경변수·네트워크 호출·전역 변수 변경 없음. 기능 완전성(bodyHash 판정 순서, 에러/성공 채널 자매 커버리지, 캐시 키 스코프, `isErrorStatusCacheable` 닫힌 목록)도 spec 과 line-level 일치 확인 | `idempotency.interceptor.ts:234,370,381` 등 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | cachedPayload 형태 미검증·로그 위생·statusCode 범위 미검증 모두 INFO, 실효 위험 낮음. 신규 인젝션/인증우회/시크릿 없음 |
| requirement | NONE | 기능 완결(형태 가드·파싱 순서·에러/성공 자매 커버리지) line-level 확인. SPEC-DRIFT 1건(이미 planner 인계), switchMap 7분기 트리거 발동(plan 등재) |
| scope | NONE | 실질 변경 4파일에 국한, 무관한 수정 없음. 표제보다 한 칸 넓은 두 지점은 이미 처분·plan 반영 완료 |
| side_effect | LOW | 500→fail-open 전환, 엔트리 손상 warn 로그 신설 — 둘 다 의도되고 CHANGELOG 공시+테스트 고정. 신규 헬퍼 전부 private |
| maintainability | LOW | 이번 증분(테스트 파일)만 실질 변경, 프로덕션 코드 무변경. 직전 라운드 지적(하중 없는 헬퍼) 해소 확인 |
| testing | NONE | 41/41 재실행 통과. diff 범위 밖 기존 테스트 2건의 로그 노이즈만 INFO |
| documentation | NONE | 4라운드 문서 drift 전부 반영 확인(직접 소스 대조). 신규 drift 없음 |

## 발견 없는 에이전트

없음 — 7개 reviewer 모두 최소 1건 이상의 INFO(대부분 확인/재검증 성격)를 보고함. CRITICAL/WARNING 을 보고한 reviewer 는 없음.

## 권장 조치사항

1. (선택, planner 턴) `spec/data-flow/15-external-interaction.md` L308 및 `spec/5-system/14-external-interaction-api.md` §R8 Rationale 의 fail-open 경로 서술을 실제 구현(생성자 `null` 미주입은 warn 없음)에 맞춰 갱신 — 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 인계 항목으로 등재됨, developer 권한 밖.
2. (선택, 백로그) `intercept()` 의 `switchMap` 7분기 콜백을 `resolveCacheHit()` 등으로 추출 — 트리거 발동 확인됨, plan 에 이미 등재.
3. 즉시 조치 필요 항목 없음 — 이번 diff 는 4라운드에 걸친 자기 교정이 수렴된 최종 상태.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 즉 **실행된 7명 전원이 router_safety 화이트리스트에 의한 강제 포함**이며, 이번 diff 내용 자체를 근거로 router 가 자체 선택한 reviewer 는 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(사유 상세 미제공 — 이번 diff 가 프로덕션 코드를 변경하지 않거나 성능 영향 표면과 무관하다고 router 가 분류) |
  | architecture | router 판단(사유 상세 미제공) |
  | dependency | router 판단(사유 상세 미제공) |
  | database | router 판단(사유 상세 미제공) |
  | concurrency | router 판단(사유 상세 미제공) |
  | api_contract | router 판단(사유 상세 미제공) |
  | user_guide_sync | router 판단(사유 상세 미제공) |

  forced 전원(7명) 결과 확보됨 — `documentation.md` 는 디스크 파일이 없었으나 인라인 전문이 있어 이번 통합 시 영속화(Write)했으므로 누락 없음.
