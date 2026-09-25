# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (`--impl-prep`, target: `plan/in-progress/workspace-guard-followups.md` 요구 1~5, 전부 `spec_impact: none`)

## 전체 위험도
**LOW** — 요구 1(`workspace.decorator.ts` reflection 헬퍼 통합)이 `spec/5-system/1-auth.md` 부트 캐너리 invariant 와 접점이 있어 WARNING 1건. 그 외는 정보성.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | 요구 1(reflection 골격을 공용 헬퍼로 추출)이 "부트 캐너리는 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 를 **그대로 호출**해야 한다"는 fail-closed invariant, 그리고 "부분 파손(일부 라우트만 인식 실패)은 캐너리가 못 잡는다"는 명시된 알려진 한계와 맞닿는다. 추출 방식에 따라 두 함수 중 하나가 얇은 wrapper 로 바뀌는 것 자체는 문제 없으나, 캐너리의 import/호출 대상이 바뀌거나 공용 골격에 팩토리 identity 를 뒤섞는 버그가 생기면 fail-open 회귀(cross-tenant 결함 클래스 재발)로 이어질 수 있다 | `plan/in-progress/workspace-guard-followups.md` 요구 1; `codebase/backend/src/common/decorators/workspace.decorator.ts` | `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증"; `workspace-reflection-canary.ts` | (a) `handlerConsumesWorkspaceId` 를 top-level `export function` 으로 유지하고 내부에서만 공용 헬퍼 호출; (b) 캐너리의 import/호출 대상이 리팩터 후에도 여전히 `handlerConsumesWorkspaceId` 그 자체인지 확인하는 회귀 테스트 추가; (c) 기존 `workspace.decorator.spec.ts` 의 `'두 판별은 서로의 팩토리를 세지 않는다'` GREEN 유지 + 추출된 공용 헬퍼 자체에 뮤턴트(팩토리 인자 위치 착오, `methodName` 빈 문자열, `argsMetadata` 부재) 추가. spec 수정 불필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec ↔ plan_coherence (교차 확인됨) | `--impl-done` spec 연결 목록의 `redis-keys` 가 cross_spec 은 "무관해 보인다"고 의심했으나, plan_coherence 가 `spec/conventions/redis-keys.md` 의 `code:` 글롭이 `codebase/backend/src/modules/integrations/**/*.ts` 를 포함해 요구 5 대상 파일(`integrations.service.ts`)과 실제로 매칭됨을 실측 확인 | 체크리스트 `--impl-done(spec 연결: ...)` 행 | 조치 불요 — doc-sync-matrix 글롭 매칭으로 정합 확인됨. `3-schedule` 연결도 동일하게 `workspaces.service.ts` 매칭으로 확인됨 |
| 2 | naming_collision | 요구 1 신규 헬퍼(아직 미명명)가 기존 `extract*` 계열(`extractWorkspaceId`, `extractWorkspaceParam`)과 접두어가 겹치면 "파라미터 팩토리"와 "메타데이터 조회 헬퍼"라는 다른 역할이 이름으로 구분되지 않음 | `workspace.decorator.ts` 신규 헬퍼 | `extract*` 접두어를 피하고 조회/필터 의미 접두어(예: `routeArgFactoriesMatching`) 사용 권장 (강제 아님) |
| 3 | rationale_continuity | `common/constants/workspace-roles.ts` 상단 docstring이 "두 서비스" 라고 과거형으로 못박혀 있어, 요구 5로 `integrations.service.ts` 가 세 번째 소비처로 합류한 뒤에는 오해 소지 | `workspace-roles.ts` 상단 주석 | 같은 커밋에서 "이후 `integrations.service.ts` 도 합류(2026-09-25 followups)" 한 줄 추가 (선택) |
| 4 | convention_compliance | `common/constants/workspace-roles.ts`(RBAC 판정표 SoT)가 `spec/5-system/1-auth.md` frontmatter `code:` 리스트의 어떤 glob 에도 걸리지 않음 (가드는 `workspace-roles-attachment.spec.ts` 등재로 이미 통과) | `spec/5-system/1-auth.md` frontmatter | 같은 커밋에서 `common/constants/workspace-roles.ts`(또는 `common/constants/*.ts`)를 `code:` 에 추가하면 evidence 완결성 향상 (선택, 가드 통과에는 불필요) |
| 5 | convention_compliance | `spec/2-navigation/` 영역 18개 중 17개(대상 `4-integration.md`·`9-user-profile.md` 포함)가 `## Overview` 표제 없이 시작 — 이 plan 이 만든 이탈 아니라 기존 도메인 관행 | `spec/2-navigation/{4-integration,9-user-profile}.md` | 조치 불요 — 이번 plan 범위 밖(17개 파일 규모, 별도 project-planner 턴 필요 시) |
| 6 | plan_coherence | 요구 5(`ADMIN_ROLES` 통합)는 직전 라운드 naming_collision WARNING 이 제시한 "import 또는 주석" 양자택일 중 import 한쪽만 확정 — 두 값이 실측상 동일해 정당한 재량 범위 | `plan/in-progress/workspace-guard-followups.md` 요구 5 | 갱신 불필요 |
| 7 | naming_collision | 요구 5(`ADMIN_ROLES` 통합)는 신규 식별자 충돌이 아니라 기존에 이미 존재하던 동일-이름 이중 선언(공용 상수 vs `integrations.service.ts` 로컬)을 해소하는 방향 | `integrations.service.ts:112` vs `common/constants/workspace-roles.ts:27` | 구현 시 로컬 선언 완전 제거 + import 대상 확인만 리뷰에서 체크 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 요구 1이 부트 캐너리 "그대로 호출" invariant 와 접점 (WARNING); RBAC 상수 정합 재확인, `redis-keys` 연결 의문 제기 |
| rationale_continuity | LOW | 동일 invariant 의 "부분 파손 미탐지" 블라인드스팟 보강 제안 (INFO); `ADMIN_ROLES` 통합 docstring 갱신 제안; 기각된 대안 재도입 없음 확인 |
| convention_compliance | NONE | CRITICAL/WARNING 없음; frontmatter `code:` 완결성·2-navigation Overview 관행 INFO 2건 |
| plan_coherence | NONE | 요구 1~5 전제 실측 일치, 겹칠 수 있는 인접 plan(`auth-guard-reflection-hardening` 등) 모두 이미 완료 상태로 충돌 없음, `redis-keys`/`3-schedule` 연결 근거 실측 확인 |
| naming_collision | NONE | 신규 식별자 사실상 없음(헬퍼 미명명, `ADMIN_ROLES` 는 기존 충돌 해소) |

## 권장 조치사항
1. (WARNING 해소) 요구 1 구현 시 `handlerConsumesWorkspaceId` 를 top-level export 로 유지하고, 부트 캐너리가 리팩터 후에도 그 함수를 그대로 import/호출하는지 검증하는 회귀 테스트 추가.
2. (WARNING 보강) `workspace.decorator.spec.ts` 의 `'두 판별은 서로의 팩토리를 세지 않는다'` GREEN 유지 + 추출된 공용 헬퍼 자체에 뮤턴트(팩토리 인자 착오·`methodName` 빈 문자열·`argsMetadata` 부재) 추가.
3. (선택) 신규 헬퍼 이름에 `extract*` 접두어 회피.
4. (선택) `workspace-roles.ts` 를 `spec/5-system/1-auth.md` frontmatter `code:` 에 추가.
5. (선택) `workspace-roles.ts` docstring "두 서비스" 문구에 `integrations.service.ts` 합류 사실 한 줄 추가.
