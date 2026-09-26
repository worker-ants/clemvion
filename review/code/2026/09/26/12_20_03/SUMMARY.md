# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 순수 리팩터(`lowestRequiredRole` 추출) + Swagger 403 설명 문서 동기화(129곳) + 이를 감시하는 신규 저장소 가드로 구성된 변경이며, 8개 reviewer(강제 6명 포함) 전원이 결과를 확보했다(forced 미이행 없음). 실질 결함 없이 INFO 수준 개선 참고사항만 존재.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `lowestRequiredRole` 은 서열 밖 문자열이 섞이면 그 문자열(서열 0)이 문턱이 되어 요구가 사실상 사라짐 — 다만 이는 이번 diff 로 새로 생긴 동작이 아니라 기존 인라인 코드를 그대로 옮긴 것이며, `@Roles()` 데코레이터가 `WorkspaceRoleName[]`(컴파일 타임 유니온)만 받아 실질 도달 불가 | `codebase/backend/src/common/constants/workspace-roles.ts:38-44`, 테스트 `workspace-roles.spec.ts:35-36` | 조치 불요 — `@Roles()` 타입 제약이 느슨해지면 재검토 |
| 2 | Security | Swagger 403 설명에 가드 거부 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)가 노출됨 — 런타임 403 응답 본문에 이미 노출되던 값을 문서에 미러링한 것이라 새 정보 노출 아님 | `codebase/backend/src/common/swagger/forbidden-descriptions.ts:19,36-39` 및 각 컨트롤러 `@ApiForbiddenResponse` | 조치 불요 |
| 3 | Security | 신규 저장소 가드 테스트가 고정 nil-형 UUID 상수와 mock `WorkspacesService` 사용 — 시크릿 아니고 순수 테스트 fixture | `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts` (모델 캐너리 블록) | 조치 불요 |
| 4 | Requirement | `auth.controller.ts`(`switchWorkspace`)는 신설 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER` 대신 `${NOT_A_MEMBER.code}` 를 직접 보간한 기존 문장을 그대로 사용 — 저장소 가드 위반은 아니나 이번 PR 취지(문구 단일화)를 엄밀 적용하면 비일관 | `codebase/backend/src/modules/auth/auth.controller.ts` `switchWorkspace` 핸들러 (이 PR diff 범위 밖) | 필수 아님 — 후속 정리 PR 에서 헬퍼로 교체 고려 |
| 5 | Scope | `workspaces.controller.ts` · `integrations.controller.ts` 는 "빠진 129곳 채우기"를 넘어 기존 로컬 상수(`FORBIDDEN_MEMBER_ROUTE` 등)까지 공용 헬퍼로 교체 — plan `§방향`에 명시적으로 계획된 작업이라 스코프 이탈 아님 | `workspaces.controller.ts` (게이트 33-68), `integrations.controller.ts` (게이트 92-97) | 조치 불요(plan 근거로 이미 정당화) |
| 6 | Scope | `roles.guard.ts` 인라인 `reduce` 3줄을 `lowestRequiredRole()` 호출로 이동 — 설명 문자열 치환 작업과는 결이 다른 로직 이동이나, 신규 repo-guard 와 모델을 공유하기 위해 plan 이 사전 요구 | `codebase/backend/src/common/guards/roles.guard.ts:219-222` | 조치 불요 |
| 7 | Side Effect | 신규 repo-guard 테스트(`loadControllers`)가 `src/modules` 전 컨트롤러를 동적 `import()` 로 로드 — 형제 가드(`http-status-advertised-guard.ts`)의 정적 텍스트 스캔과 달리 모듈 코드를 실제 실행. 이번에 직접 건드린 두 파일은 import-time 부작용 없음을 확인했으나 전체 컨트롤러 의존성 그래프는 전수 감사하지 못함 | `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:69-86` (`loadControllers`) | 이미 AppModule 전체를 부트하는 e2e 가 있다면 추가 위험 낮음. 필요 시 "컨트롤러 모듈은 import-time 부작용 없음" 불변식을 컨벤션으로 명문화 고려 |
| 8 | Side Effect | `@ApiForbiddenResponse` 설명 문자열 변경은 공개 OpenAPI 문서 텍스트 변경(예: `'워크스페이스 멤버가 아님'` → `'...(NOT_A_MEMBER)'`) — 이를 단언하는 기존 spec/스냅샷은 발견되지 않아 소비자 파손 근거 없음 | 약 29개 컨트롤러의 `@ApiForbiddenResponse({ description: ... })` | 조치 불요(의도된 변경) |
| 9 | Maintainability | `integrations.controller.ts` 만 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole` import 순서가 다른 13개 컨트롤러와 반대 | `codebase/backend/src/modules/integrations/integrations.controller.ts:34-35` | 순서를 다른 파일과 통일(동작 영향 없음) |
| 10 | Maintainability | 역할 요구가 서비스 계층 추가 거부(조직 Admin·소유자 등)와 결합되는 5곳(`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등)은 공용 헬퍼(`ROLE_SHORTFALL`) 밖에서 접미 문구를 손으로 조립 — 빈도 낮아 헬퍼 일반화는 시기상조 | `integrations.controller.ts:95-97`, `workspaces.controller.ts:67`, `workflow-test-datasets.controller.ts:39` | 지금은 불필요. 유사 패턴이 한 곳 더 생기면 `forbiddenForRole(role, extra)` 형태 합성 헬퍼 고려 |
| 11 | Testing | `forbiddenForRole(role)` 이 단일 역할만 받음 — 다중 역할(`@Roles('admin','editor')`) 라우트는 호출자가 직접 `lowestRequiredRole()` 로 최저 문턱을 구해야 하고 이 책임이 타입으로 강제되지 않음(1라운드에서 이미 트리아지, 현재 전 컨트롤러가 단일 역할만 사용해 시급하지 않음으로 유예됨) | `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (`forbiddenForRole` 선언부) | 재조치 불요 — 다중 역할 호출자 등장 시 시그니처 확장 고려 |
| 12 | Testing | `integrations.controller.ts` 의 합성 403 문장(`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등) 정확한 워딩에 대한 단위 테스트 없음 — 다만 코드 누락 회귀는 저장소 가드의 전수 스캔(0 위반)이 이미 커버, 가드 설계상 포함 여부만 검증하는 의도된 범위 | `integrations.controller.ts` (해당 상수 선언부) | 조치 불요 |
| 13 | Documentation | `forbidden-descriptions.ts` 상단 7-13행 JSDoc 블록이 어떤 export 에도 매지 않는 floating 모듈 헤더 — TSDoc/TypeDoc 렌더링에서 누락될 수 있음 | `codebase/backend/src/common/swagger/forbidden-descriptions.ts:7-13` | `@module` 태그 추가 또는 아래 `FORBIDDEN_NOT_A_MEMBER` 독스트링과 통합 고려. 급하지 않음 |
| 14 | Documentation | `integrations.controller.ts` 기존 주석("거부 코드는 공유 거부 표의 `.code` 를 보간")이 여전히 참이지만, 95·97행이 이제 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole`)를 경유한다는 사실은 언급 안 함 — 다른 컨트롤러는 이번 PR 에서 갱신됨 | `integrations.controller.ts:92-94` | "공용 헬퍼 경유" 한 구절 보강해 다른 컨트롤러 서술과 맞춤. 차단 사유 아님 |
| 15 | API Contract | `forbiddenForRole()` 기본 문구는 쉼표 없이 "또는"으로 연결하는데, 서비스 판정 접미 문구를 붙이는 4개 지점(`workspaces.controller.ts:67` 등)은 쉼표+"또는"으로 연결 — 표기 불일치, 저장소 가드는 부분 문자열 포함만 보므로 CI 통과, 실제 응답 스키마엔 영향 없음 | `forbidden-descriptions.ts:38` vs `workspaces.controller.ts:67`, `integrations.controller.ts:95-97`, `workflow-test-datasets.controller.ts:39` | 급하지 않음. 후속 정리 때 접미 문구도 헬퍼로 흡수해 표기 통일 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인가 로직 회귀 없음(byte-identical 추출 확인), Swagger 노출은 런타임 미러링 |
| requirement | LOW | spec(`swagger.md` §5-4, `12-workspace.md`)-구현 line-level 일치, 신규 테스트 15+64 GREEN, INFO 1건(auth.controller.ts 헬퍼 미적용) |
| scope | NONE | 32개 파일 diff 가 plan 범위와 항목 단위로 정확히 일치, 의도 밖 변경 없음 |
| side_effect | LOW | 순수 문자열 계산 위주, 신규 repo-guard 의 동적 import 표면 확대만 참고 |
| maintainability | LOW | import 순서 불일치 1건, 복합 문구 헬퍼 밖 조립 1건 — 둘 다 경미 |
| testing | NONE | 1라운드 WARNING(서열 밖 방어 미검증) 해소 재확인, 관련 4스위트+회귀 24스위트/392테스트 전부 GREEN |
| documentation | NONE | JSDoc·spec·CHANGELOG 정합, 경미한 주석 보강 여지 2건 |
| api_contract | NONE | 엔드포인트/스키마/인증 방식 불변, 문서 텍스트만 개선, 쉼표 표기 불일치 1건 |

## 발견 없는 에이전트

없음 — 8개 에이전트 모두 최소 1건 이상의 INFO 를 보고했으나 Critical/Warning 은 전무.

## 권장 조치사항

1. (선택) `auth.controller.ts` `switchWorkspace` 의 손보간 문장을 `FORBIDDEN_NOT_A_MEMBER` 헬퍼로 통일 — 후속 정리 PR.
2. (선택) `integrations.controller.ts` import 순서를 다른 13개 컨트롤러와 통일.
3. (선택) `integrations.controller.ts`/`workspaces.controller.ts`/`workflow-test-datasets.controller.ts` 의 접미 문구(쉼표 유무 포함)를 헬퍼로 흡수해 표기 통일 — 유사 복합 패턴이 한 곳 더 생기면 우선순위 상향.
4. (선택) `forbidden-descriptions.ts` 상단 floating JSDoc 에 `@module` 태그 추가 또는 하위 독스트링과 통합.
5. (선택) `integrations.controller.ts:92-94` 주석에 "공용 헬퍼 경유" 사실 한 구절 보강.
6. (선택) 다중 역할 호출자가 실제로 필요해지면 `forbiddenForRole(roles: readonly WorkspaceRoleName[])` 형태로 확장 검토(현재는 유예 확정 상태).

위 6건 모두 병합을 막을 사유는 아니며 전부 선택적 후속 정리다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명) — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff(문서 문자열 치환 + 순수 함수 추출) 와 성능 관점 무관하다고 판단 |
  | architecture | 아키텍처 구조 변경 없음(기존 계층 구조 유지) |
  | dependency | 신규 외부 의존성 추가 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | user_guide_sync | 사용자 대상 문서(가이드) 변경 없음, OpenAPI 내부 설명 문구만 변경 |
