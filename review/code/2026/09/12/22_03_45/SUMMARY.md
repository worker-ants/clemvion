# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. `rotateBotToken` 의 `:id` UUID 파이프 누락 수정(500→400 정상화)과 이를 저장소 전수로 고정하는 AST 가드 신설이 핵심이며, 14개 reviewer 전원이 결과를 반환했고(강제 화이트리스트 `documentation, maintainability, requirement, scope, security, side_effect, testing` 포함 전원 결과 확보됨 — 누락 없음), 실질 결함은 발견되지 않았다. 남은 항목은 spec 문서가 코드를 못 따라간 SPEC-DRIFT 2건(개발자 권한 밖이라 이미 planner 항목으로 등재됨)과 non-blocking 설계 제안 1건뿐이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표에 `rotateBotToken` 이 이번 diff 로 새로 낼 수 있게 된 `400 VALIDATION_ERROR — :id가 UUID 형식이 아님` 행이 없음. 코드가 옳고(500 마스킹 버그 수정) spec 표만 낡음 | `spec/5-system/15-chat-channel.md:369-379` | 코드 유지. §5.4 표에 400 행 추가(planner 턴 필요 — developer 자기-반증형 소정정 조건 1 불충족). 이미 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C 에 등재됨 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/swagger.md` §5-4 신규 엔드포인트 체크리스트가 `@ApiParam({format:'uuid'})` 문서 축만 요구하고 `ParseUUIDPipe` 런타임 축은 언급 없음. 저장소 실측(id-형 `@Param` 136/136 이 파이프 보유)과 신규 가드는 두 축을 요구하는데 규약 문서가 그보다 좁음 | `spec/conventions/swagger.md:482-493` | 코드 유지. §5-4 체크리스트에 `ParseUUIDPipe` 항목 추가(planner 턴). 이미 같은 plan §C 에 등재됨 |
| 3 | ARCHITECTURE | UUID 경로 파라미터 "런타임 파이프 + 문서 `format`" 두 축이 합성 데코레이터가 아니라 두 개의 독립 데코레이터 + 사후 AST 가드로만 짝지어짐. "빠뜨리면 테스트가 잡는다" 구조로, "애초에 빠뜨릴 수 없다" 구조보다 약함(저장소에 `common/swagger` 합성 데코레이터 선례 있음) | `triggers.controller.ts:265,291`, `auth.controller.ts:436-440`, `param-uuid-pipe-guard.ts` | non-blocking. 후속으로 `@ApiUuidParam(name)` 같은 합성 데코레이터 도입 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API_CONTRACT / SIDE_EFFECT | `rotateBotToken` 비-UUID `:id` 응답이 500→400 으로 전환(공개 API 행위 변경) — CHANGELOG·spec 문면에 완전 공시, 유일한 프론트엔드 소비자(`chat-channel-card.tsx`)가 status 미분기 확인됨 | `triggers.controller.ts:291` | 조치 불요(이미 공시·검증 완료) |
| 2 | ARCHITECTURE / REQUIREMENT / API_CONTRACT / DATABASE | `GlobalExceptionFilter` 가 SQLSTATE 22P02 를 여전히 분류하지 않아 `@Param` 이외 경로(쿼리·바디)로 유입되는 비-UUID 는 500 마스킹 재현 가능 | `http-exception.filter.ts` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 항목 등재, 전수 조사 선행 필요해 이번 배치 범위 밖으로 의도적 defer — 재지적 불요 |
| 3 | SECURITY | 신규 `param-uuid-pipe` 가드의 `ParseUUIDPipe` 존재 판정이 텍스트 부분일치(심볼 해석 아님) — 별칭 import 시 오탐/미탐 가능하나 현재 별칭 0건, 한계가 코드 주석에 문서화됨 | `param-uuid-pipe-guard.ts` | 현행 유지 가능. 별칭 import 발생 시 타입 체커 기반으로 확장 검토 |
| 4 | PERFORMANCE | `ParseUUIDPipe` 추가는 비-UUID 를 fail-fast 400 으로 끊어 불필요한 DB 라운드트립 제거 — 성능 개선 방향 | `triggers.controller.ts:291` | 조치 불요(긍정적 변경) |
| 5 | PERFORMANCE | 신규 가드가 테스트 실행마다 컨트롤러 전체를 동기 AST 재파싱 | `param-uuid-pipe-guard.ts:192-219` | 현재 규모(35개 파일) 무시 가능. 형제 가드와 동일 패턴, 조치 불요 |
| 6 | SCOPE | `auth.controller.ts`(switchWorkspace) 문서축 보강, MCP 환경변수 오타 2건(`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`)은 표제 작업과 다른 모듈이나, 가드 baseline 확보/식별자 전수 스윕이 필연적으로 드러낸 것으로 plan·커밋 메시지에 disclose 됨 | `auth.controller.ts`, `mcp-servers{,.en}.mdx` | 조치 불요. 향후 유사 배치는 커밋 제목에 "+ 전수 가드 baseline 확보" 명시 권장 |
| 7 | SCOPE | 원 결함(파이프 1건 누락) 대비 신규 가드 인프라(~450줄) 규모가 크나, 저장소의 기존 회귀방지 가드 관례(`dto-class-name-collision` 등)에 부합 | `param-uuid-pipe-guard.ts`, `.spec.ts`, fixture | 조치 불요 |
| 8 | MAINTAINABILITY | vacuity floor 임계값(`toBeGreaterThan(30)`, `toBeGreaterThan(100)`)이 이름 없는 리터럴 — 주석이 근거를 설명하나 명명 상수 추출 여지 | `param-uuid-pipe.spec.ts:60,66` | 낮은 우선순위. `MIN_EXPECTED_CONTROLLERS` 등 상수 추출 검토 |
| 9 | MAINTAINABILITY | 실측 수치(136건, 108:28 등)가 `guard.ts`/`spec.ts`/`plan.md` 세 곳에 중복 기록되어 향후 drift 위험 | `param-uuid-pipe-guard.ts:70,148`, plan 문서 | 즉각 조치 불요. 다음 갱신 시 세 자리 동반 갱신 유의 |
| 10 | TESTING | HTTP 왕복 테스트가 auth/roles 체인 없이 파이프 축만 검증하는데 제목만 보면 인증 포함 통합테스트로 오인 소지 | `triggers.controller.spec.ts:229,245-261` | describe/헤더 주석에 "인증·인가는 범위 밖" 한 줄 추가 권장(non-blocking) |
| 11 | TESTING | 유저 가이드 식별자(에러코드·환경변수) 실재성을 세는 자동 가드가 아직 없음 | — | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 항목 등재된 기지 갭, 재지적 불요 |
| 12 | DOCUMENTATION | `param-uuid-pipe.spec.ts` 의 `--impl-prep` 지적 인용이 세션 경로 없이 게이트명만 표기 — 같은 문서 내 다른 인용과 형태 불일치 | `param-uuid-pipe.spec.ts` docstring | `(review/consistency/2026/09/12/19_34_19)` 경로 보강 권장(사소, 비차단) |
| 13 | DEPENDENCY | 신규 외부 의존성·lockfile 변경 없음 — 전부 기존 devDependencies(`@nestjs/testing`, `supertest`, `typescript` 등) 재사용 | `package.json`(변경 없음) | 조치 불요 |
| 14 | USER_GUIDE_SYNC | 유저 가이드에 이 PR 과 무관한 기존 미실재 에러코드 5종(`LLM_AUTH_ERROR` 등) 잔존 | 기존 MDX 문서(이번 diff 밖) | 이번 PR 신규 회귀 아님, plan 에 이미 항목화됨 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 방어 강화 방향, 하드코딩 시크릿/인젝션/인가 우회 없음. 가드 판정 한계는 실질 위험 없음 |
| performance | NONE | ParseUUIDPipe 는 오히려 fail-fast 성능 개선. 신규 가드 오버헤드 무시 가능 |
| architecture | LOW | 합성 데코레이터 미적용(non-blocking 제안). 22P02 미분류는 기추적 갭 |
| requirement | LOW | 500 마스킹 결함 수정 확인·형제 엔드포인트 대조 검증. spec 문서 2건 SPEC-DRIFT(이미 planner 항목 등재) |
| scope | LOW | 부수 수정(auth.controller.ts, MCP 오타) 전부 disclosed. 가드 규모는 관례 부합 |
| side_effect | LOW | 500→400 API 행위 변경은 의도됨·공시됨·소비자 영향 없음 확인 |
| maintainability | LOW | 매직넘버·수치 중복기록·인라인 주석 길이 등 경미한 스타일 이슈만 |
| testing | LOW | 뮤테이션 검증(M1~M10) 완료, vacuity floor·면제 방향 캐너리 확보. 문서화 여지만 남음 |
| documentation | LOW | 5라운드 수치 재검증 전부 일치. 인용 형식 사소한 비일관성 1건 |
| dependency | NONE | 신규 의존성 없음, 전부 기존 devDependency 재사용 |
| database | NONE | 스키마·쿼리·트랜잭션 변경 없음. 컨트롤러 파이프 추가는 DB 왕복 감소 효과 |
| concurrency | NONE | 공유 상태·락·비동기 오케스트레이션 변경 없음 |
| api_contract | LOW | 500→400 breaking 이나 CHANGELOG 공시·소비자 영향 없음 확인. 22P02 갭은 기추적 |
| user_guide_sync | NONE | backend-api-change trigger 동반 갱신 완전 충족. ERROR_KO 갭은 실사용 영향 없음 실측 확인 |

## 발견 없는 에이전트

- database — 스키마/쿼리/트랜잭션/마이그레이션/커넥션 풀 관련 코드 변경 없음
- concurrency — 공유 자원 동시 접근, 락, 비동기 오케스트레이션 요소 없음

## 권장 조치사항

1. (최우선, planner 턴) `spec/5-system/15-chat-channel.md` §5.4 표에 `rotateBotToken` 신규 400 `VALIDATION_ERROR` 행 추가, `spec/conventions/swagger.md` §5-4 체크리스트에 `ParseUUIDPipe` 런타임 축 항목 추가 — 둘 다 이미 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C 에 등재되어 있어 새 작업 아님, 다음 project-planner 턴에서 처리
2. (non-blocking, 후속 검토) `common/swagger` 계열에 `@ApiUuidParam(name)` 합성 데코레이터를 도입해 파이프+문서 축을 한 호출로 강제하는 것을 검토 — `param-uuid-pipe` 가드의 감시 범위를 줄이는 효과
3. (선택) HTTP 왕복 테스트 describe/헤더 주석에 "인증·인가는 이 스위트 범위 밖" 명시, `--impl-prep` 지적 인용에 세션 경로 보강 — 둘 다 사소하고 비차단
4. `codebase/**` 를 다시 고쳐야 하는 새 발견은 없음 — 이번 라운드로 리뷰 수렴 가능

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용. 전체 14개 reviewer 실행됨.
- **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync` (14명, 전원 success, 전원 인라인 전문 확보)
- **제외**: 없음
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |