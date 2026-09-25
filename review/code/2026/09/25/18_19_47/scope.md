# 변경 범위(Scope) 리뷰

## 방법

`_prompts/scope.md` 의 30개 파일 unified diff 전부를 읽고, 프롬프트 크기 제한으로 잘린 5개 파일
(`source-scan.spec.ts` · `source-scan.ts` · `workspace.decorator.spec.ts` · `roles.guard.spec.ts` ·
`auth.controller.ts` · `auth.service.ts` · `executions.controller.ts` · `workspace-invitations.service.ts` ·
`workspaces.controller.ts` · `workspaces.service.spec.ts` · `workspaces.service.ts`)은 diff 자체가
전체 변경분을 충분히 보여주므로 별도 `Read` 없이도 판단 가능했다. 추가로 plan
`plan/in-progress/workspace-path-guard-impl.md` 를 읽어 이 changeset 이 어떤 요구를 구현하는지
대조했다. 저장소 파일은 건드리지 않았다(뮤테이션 없음, `git status --short` 확인 불필요).

## 배경 판단

이 changeset 은 5라운드째 `/ai-review` 를 도는 단일 plan(`workspace-path-guard-impl.md`)의 구현이다.
plan 은 구현 요구를 8개 항목으로 명시했고(§구현 요구), 이번 changeset 의 30개 파일은 그 8개 항목
전부에 1:1 로 대응한다 — 요구 항목과 실제 diff 를 아래처럼 맞춰 보았다.

| 요구 | 대응 파일 |
| --- | --- |
| 1. `@WorkspaceParam` 데코레이터 + 가드 인식 + 부트 캐너리 | `workspace.decorator.ts/.spec.ts`, `decorators/index.ts`, `workspace-reflection-canary.ts/.spec.ts` |
| 2. 15곳을 `@WorkspaceParam` 으로, 역할 요구 부여 | `auth.controller.ts`(전환), `workspaces.controller.ts`(14곳) |
| 3. 가드 거부 코드 부여 | `roles.guard.ts/.spec.ts`, `workspace-roles.ts`(신설 — 서열·거부 표 단일화) |
| 4. 저장소 가드 `workspace-param-binding` | `workspace-param-binding-guard.ts`(신설) · `.spec.ts`(신설) · fixture(신설) |
| 5. `leaveWorkspace`·`addMemberByEmail`·`transferOwnership` 인가 선행(오라클 제거) | `workspaces.service.ts/.spec.ts` |
| 6. frontend 403 표시 판단(→ 미등재 결정) | 코드 변경 없음(결정만, plan 에 기록) — 대응 파일 없음이 맞다 |
| 7. e2e | `workspace-path-guard.e2e-spec.ts`(신설), `workspace-rbac.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`(주석만) |
| 8. docstring·swagger 갱신 | `roles.guard.ts` docstring, `workspaces.controller.ts`·`executions.controller.ts` 의 `@ApiForbiddenResponse` |

30개 파일 중 이 8개 요구 밖에 있는 파일은 없었다. `source-scan.ts`(`decoratorCallName` 공용화)와
`param-uuid-pipe-guard.ts`(`@WorkspaceParam` 을 모집단에 포함)는 새 데코레이터가 기존 저장소 가드 두 개의
AST 판별 대상이 되면서 **자연스럽게 파생되는** 변경이고, 각각 이전 리뷰 라운드(16_39_25 maintainability
WARNING, 계획 단계 실측)에서 이미 지적·계획된 항목이라 drive-by 가 아니다. `role-gate.tsx` 는 서열 표가
`roles.guard.ts` 에서 `workspace-roles.ts` 로 옮겨간 사실을 반영하는 주석 1줄 갱신뿐이다.

## 발견사항

- **[INFO]** 가드 거부 응답 포맷 변경이 새 경로(`@WorkspaceParam`) 라우트에 국한되지 않고 기존
  `@Roles()` 라우트 전체(헤더·토큰 컨텍스트 포함)에 적용됐다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` — `assertMember` 메서드(전체 파일
    컨텍스트 209~230행), 관련 docstring "거부 코드 (2026-09-25~)" 절(113~124행)
  - 상세: 종전에는 `canActivate` 가 거부 시 `false` 를 반환해 전역 필터가 기본 `FORBIDDEN` 바디를
    채웠다. 이번 변경은 전 경로에서 `ForbiddenException({ code, message })` 를 던지도록 바꿨다 —
    이는 "경로 파라미터 워크스페이스 가드" 라는 제목이 시사하는 범위보다 넓은, API 응답 바디의
    실질적 변경이다(기존 API 소비자 관점에서는 breaking 할 수 있는 변화). 다만 이는 drive-by 가
    아니라 **의도적 설계 결정**이다 — 가드 docstring 자체가 "새 경로에만 코드를 붙이면 같은 실패가
    경로에 따라 다른 본문을 내므로 전 경로를 함께 바꿨다" 고 명시하고, plan 의 구현 요구 3번이
    이 부여를 처음부터 요구 사항으로 못박았으며, `workspaces.controller.ts`/`executions.controller.ts`
    의 `@ApiForbiddenResponse` 설명도 함께 갱신됐다(요구 8). 4라운드에 걸친 `/ai-review` 가 이미 이
    설계를 검토했다(라운드별 RESOLUTION 참조). 스코프 확장이 아니라 **하나의 논리적 변경의 필연적
    귀결**로 판단해 INFO 로 낮춘다 — 다만 리뷰 소비자가 "경로 가드" 라는 제목만 보고 이 광범위한
    응답 바디 변경을 놓치지 않도록 기록해 둔다.

- **[INFO]** `workspace-invitations.service.ts` 의 `ADMIN_ROLES` 로컬 상수가 공용
  `common/constants/workspace-roles.ts` 의 export 로 교체됐다.
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` (import 추가 30행,
    로컬 `const ADMIN_ROLES = new Set(...)` 삭제)
  - 상세: 이 파일 자체는 "15곳 @WorkspaceParam 전환" 대상이 아니지만, 새로 만든 역할 서열 단일
    진실(`workspace-roles.ts`)이 가드·`workspaces.service.ts`·이 파일 세 곳에 중복돼 있던 `ADMIN_ROLES`
    를 통합하는 것이 plan 의 명시적 동기다(spec 문서 서두: "종전엔 가드의 숫자 서열과 두 서비스의
    `ADMIN_ROLES` 집합이 각자 따로 있었다"). 범위 밖 리팩토링이 아니라 이번 작업이 만든 단일
    소스를 실제로 단일화하는 필수 후속 조치다.

이 외에 의도 밖 변경, 관련 없는 파일·영역 수정, 불필요한 포맷팅/주석/임포트 변경, 과잉 기능 확장은
발견하지 못했다. `frontend/src/components/auth/role-gate.tsx` 의 1줄 주석 변경도 백엔드 서열 표
이전을 반영하는 필수 동기화이지 무관한 수정이 아니다.

## 요약

30개 파일 전부가 `plan/in-progress/workspace-path-guard-impl.md` 에 명시된 8개 구현 요구 중 정확히
하나 이상에 직접 대응했다. 가드 거부 응답 포맷을 기존 라우트까지 포함해 전면 변경한 점과 서비스
계층 `ADMIN_ROLES` 상수 통합은 diff 크기를 키우지만, 둘 다 "새 코드만 바꾸면 같은 실패가 라우트마다
다른 답을 낸다"·"서열 표가 세 곳에 흩어져 있으면 다시 갈린다" 는 저장소 자신의 근거로 뒷받침되는
필연적 동반 변경이며, plan·spec·docstring·4라운드 선행 리뷰가 모두 이 결정을 명시적으로 다뤘다.
드라이브바이 리팩토링, 무관한 파일 수정, 포맷팅 뒤섞기, 불필요한 주석/임포트 변경은 관찰되지 않았다.

## 위험도

NONE
