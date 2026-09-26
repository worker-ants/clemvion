# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 2건(둘 다 테스트 커버리지 갭이며 즉각적 결함은 아님). forced 화이트리스트(maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 리뷰어 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `guardRejectionCodes` 의 "서열 밖 문자열이 문턱" 방어 분기(`Object.hasOwn` 가드)를 실행하는 테스트가 없다 — 이 가드를 지워도 테스트가 안 죽는다. `threshold`가 `'constructor'` 같은 프로토타입 체인 문자열이면 `ROLE_REQUIRED[threshold]` 직접 인덱싱 시 `Object.prototype.constructor`(truthy)가 걸려 `rejection.code`(`undefined`)가 codes 에 섞이는 결함으로 이어질 수 있다 | `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:137-139` (`guardRejectionCodes`) | `ForbiddenFixtureController`에 `@Roles('editor', 'constructor')` 류 서열 밖 문자열 라우트를 추가하고, `guardRejectionCodes`가 `['NOT_A_MEMBER']`만 반환함(역할 코드 미혼입)을 단언하는 케이스 추가 |
| 2 | Maintainability | PR 자신의 DRY 취지와 반대로, 동일한 복합 거부 문구 리터럴이 두 컨트롤러 파일에서 각 2회씩 그대로 복제됨 — 이전엔 로컬 상수 하나로 공유되던 자리. `integrations.controller.ts`/`triggers.controller.ts`는 같은 상황을 모듈 상수로 추출해 이 패턴을 피했다 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts:223,274` (``${forbiddenForRole('owner')}, 또는 개인 워크스페이스``), `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:99,119` (``${forbiddenForRole('editor')}, 또는 데이터셋 소유자가 아님(FORBIDDEN — 서비스 판정)``) | 각 파일에 `FORBIDDEN_OWNER_OR_PERSONAL` / `FORBIDDEN_EDITOR_OR_NOT_OWNER` 형태의 모듈 상수로 추출해 두 사용처가 참조하게 한다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Architecture/Testing | `guardRejectionCodes` 모델이 `RolesGuard.canActivate` 분기를 손으로 옮겨 적은 것이라, fixture 에 없는 라우트 모양(예: `@Roles()`+`@WorkspaceParam()` 동시 사용 — 실제로 `workspaces.controller.ts`에서 가장 흔한 조합)이나 워크스페이스 컨텍스트 없는 `@Roles()` 라우트에서는 모델과 실제 가드가 소리 없이 갈릴 여지가 있다. 저자도 spec 파일 헤더에 이 갭을 일부 문서화함 | `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts` (`guardRejectionCodes`), `forbidden-response-codes.spec.ts` 모델 캐너리 절 | 향후 `RolesGuard` 분기 변경 시 fixture 컨트롤러에 해당 모양(특히 `@Roles`+`@WorkspaceParam` 조합, 서열 밖 문자열)을 함께 추가하는 관례 권장. 이번 diff 범위 밖이라 즉시 조치 불요 |
| 2 | Architecture | `forbiddenForRole(role: WorkspaceRoleName)`가 단일 역할만 받아, 다중 역할(`@Roles('admin','editor')`) 조합 시 호출자가 직접 `lowestRequiredRole()`로 최저 문턱을 구해 넘겨야 한다 — 이 책임이 타입으로 강제되지 않고 CI 가드가 사후에만 잡는다(대조군 `multiDescribedAsAdmin`이 바로 이 오용을 겨냥) | `codebase/backend/src/common/swagger/forbidden-descriptions.ts:36-39` | `forbiddenForRole(roles: readonly WorkspaceRoleName[])`로 넓혀 내부에서 `lowestRequiredRole` 호출하도록 하면 오용 클래스를 API 설계로 봉쇄 가능. 현재 전 컨트롤러가 단일 역할만 사용해 시급하지 않음 |
| 3 | Architecture | Swagger 문구용 `ROLE_SHORTFALL`과 런타임 메시지용 `ROLE_REQUIRED[role].message`가 같은 의미의 문구를 별도 테이블로 유지 — 코드(`.code`)는 완전히 단일화됐으나 사람이 읽는 문구 표현은 두 곳에 손으로 남아 드리프트 가능성 존재 | `forbidden-descriptions.ts:22-28` vs `workspace-roles.ts:72-82` | 조치 불요(의도된 톤 분리로 보임). 향후 역할 문구 변경 시 두 테이블 동시 검토 필요성만 상호 참조 주석으로 남기면 좋음 |
| 4 | Maintainability/Testing/Requirement | `lowestRequiredRole`이 `Array.prototype.reduce`를 초기값 없이 호출해 빈 배열 입력 시 `TypeError`를 던진다. JSDoc에 "비어 있지 않아야 한다" 전제가 명시돼 있고 현재 두 호출부 모두 `length===0` 체크 후에만 호출해 실제 위반 경로는 없음(확인 완료) | `codebase/backend/src/common/constants/workspace-roles.ts:36-42` | 필수는 아니나 `expect(() => lowestRequiredRole([])).toThrow()` 테스트 추가 또는 함수 내 명시적 assert로 향후 호출자 실수를 더 빨리 드러낼 수 있음 |
| 5 | Documentation | `lowestRequiredRole`의 매개변수 타입이 `readonly string[]`(넓음)인데 JSDoc은 "`@Roles`가 `WorkspaceRoleName`만 받아 컴파일에서 막힌다"고만 설명 — 실제로는 reflection 소비처(`guardRejectionCodes`)가 타입 소거된 문자열을 넘기기 때문에 넓혔다는 이유가 JSDoc에 없음 | `codebase/backend/src/common/constants/workspace-roles.ts:27-36` | JSDoc에 "reflection 소비처가 타입 소거된 문자열을 넘기므로 시그니처를 넓혔다" 한 문장 추가(선택 사항, 결함 아님) |
| 6 | Maintainability | 신설 저장소 가드가 nestjs/swagger가 export하지 않는 메타데이터 키 문자열(`'swagger/apiResponse'` 등)을 손으로 옮겨 적음 — 매직 스트링이나 기존 형제 가드(`http-status-advertised`)와 동일 관례로 이미 문서화됨 | `forbidden-response-codes-guard.ts` `SWAGGER_API_RESPONSE` 등 상수 선언부 | 조치 불요, 참고용 기록 |
| 7 | Security/Side Effect | 403 응답 설명(129곳)에 내부 거부 코드가 노출되나, 이미 응답 바디(`{code,message}`)로 노출되던 값이라 신규 정보 노출이 아님. OpenAPI 문서 문구 자체는 대량으로(129곳) 바뀌며 이는 저장소 밖 API 문서 소비자(SDK doc 등)에게는 인터페이스 변경이지만 이번 PR의 명시된 목적임 | `forbidden-descriptions.ts` 전체 및 소비 30개 컨트롤러 | 조치 불요. 배포 노트/CHANGELOG 이미 반영됨(`e3b6437f2`) |
| 8 | Side Effect | 신설 저장소 가드가 테스트 시점에 `src/modules` 전체 컨트롤러를 동적 `import()`함 — 기존 자매 가드(`http-status-advertised`)와 동일 패턴이며 `__tests__/`는 프로덕션 빌드(`tsconfig.build.json` exclude) 밖 | `forbidden-response-codes-guard.ts` `loadControllers` | 조치 불요(기존 관례 준수) |
| 9 | Scope | `lowestRequiredRole` 추출(`roles.guard.ts`→`workspace-roles.ts`), `workflow-test-datasets.controller.ts`의 문구 자체 변경, import 순서 사소한 불일치, 로컬 상수(`FORBIDDEN_MEMBER_ROUTE` 등) 제거 — 전부 표본 검토 결과 PR 목적("403 설명이 가드 거부 코드를 전부 싣는다")과 정확히 부합, 범위 이탈 아님 | 다수 컨트롤러 파일 diff | 조치 불요 |
| 10 | Requirement | spec(`spec/conventions/swagger.md` §5-4, `spec/data-flow/12-workspace.md`)과 구현이 line-level로 일치. `integrations.controller.ts`의 문구 변경도 의도된 결함 수정(NOT_A_MEMBER 코드 누락 보완)이며 전수 스캔(위반 0건)으로 실측 검증됨 | 해당 spec 파일 vs `forbidden-descriptions.ts` | 조치 불요 |
| 11 | Architecture (기존 코드, 이번 diff 무관) | `common/constants` 스펙 테스트가 `modules/` DTO를 역참조(레이어 방향 역전) — 이번 PR이 만들거나 악화시키지 않은 기존 상태 | `codebase/backend/src/common/constants/workspace-roles.spec.ts:9` | 이번 PR 범위 밖, 별도 정리 대상으로만 기록 |
| 12 | API Contract | 129곳 변경은 전부 문서(OpenAPI description) 치환이며 HTTP 상태 코드·응답 스키마·라우트·인가 로직 등 런타임 API 계약은 변경 없음. 신설 reflection 가드가 오히려 에러 응답 문서 일관성을 강화(129/157건 코드 누락 → 0건) | 29개 컨트롤러 전수, `forbidden-response-codes-guard.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임 인가 로직 불변, 신규 정보 노출 없음, production 빌드 제외 확인 |
| architecture | LOW | 모델 부분 재구현(모델 캐너리로 완화), `forbiddenForRole` 단일-역할 API, 문구 이중 테이블 — 전부 INFO |
| requirement | LOW | 129곳 수정 spec과 line-level 일치, 995 테스트 PASS, tsc 에러 0 — 발견 전부 INFO |
| scope | NONE | 24개 컨트롤러 표본 전수 PR 목적 하나로 수렴, 범위 이탈 없음 |
| side_effect | NONE | 순수 문자열/모듈-로드-시 평가, 전역상태·FS·env·네트워크 부작용 없음 |
| maintainability | LOW | WARNING 1건(복합 문구 리터럴 미추출 중복) + 사소한 INFO |
| testing | LOW | WARNING 1건(서열 밖 문자열 방어 분기 미검증) + 모델 캐너리 커버리지 갭 INFO |
| documentation | NONE | JSDoc/CHANGELOG/spec 상호참조 모두 정합, 사소한 설명 공백 INFO 1건 |
| api_contract | NONE | 런타임 계약 불변, 문서 일관성 개선 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원 최소 1건 이상의 INFO/WARNING 기록(치명적 결함은 전무).

## 권장 조치사항

1. `guardRejectionCodes`의 서열 밖 문자열 방어 분기(`Object.hasOwn`)를 검증하는 회귀 테스트 추가 (WARNING #1, testing).
2. `workspaces.controller.ts`·`workflow-test-datasets.controller.ts`의 중복된 복합 거부 문구 리터럴을 모듈 상수로 추출 (WARNING #2, maintainability).
3. (선택) 모델 캐너리 fixture에 `@Roles()`+`@WorkspaceParam()` 동시 사용 라우트 및 서열 밖 문자열 라우트를 추가해 실제 가장 흔한 라우트 모양까지 커버 (INFO #1).
4. (선택) `lowestRequiredRole` 빈 배열 입력에 대한 실패 테스트 추가, JSDoc에 넓은 매개변수 타입 이유 명시 (INFO #4, #5).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff는 성능 영향 경로(핫패스 로직 변경) 없음으로 분류 |
  | dependency | router 판단 — 신규/변경 외부 의존성 없음으로 분류 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음으로 분류 |
  | concurrency | router 판단 — 동시성/레이스 관련 코드 변경 없음으로 분류 |
  | user_guide_sync | router 판단 — 사용자 가이드 동기화 대상 아님으로 분류 |
