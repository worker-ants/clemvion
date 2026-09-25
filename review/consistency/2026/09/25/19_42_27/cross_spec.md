# Cross-Spec 일관성 검토 — workspace-guard-followups (--impl-done)

검토 대상 diff: 8개 파일 / 291줄 (`common/constants/workspace-roles.ts` · `common/decorators/workspace.decorator.ts` ·
`modules/auth/auth.controller.ts` · `modules/executions/executions.controller.ts` ·
`modules/integrations/integrations.service.ts` · `modules/workspaces/workspaces.controller.ts` ·
`modules/workspaces/workspaces.service.ts` · `workspaces.service.spec.ts`). `spec_impact: none` 선언, scope
(`spec/**`) 델타 0개 파일. 이 PR 은 `#1399`(경로 워크스페이스 가드) 의 순수 후속 정리(reflection 헬퍼 통합·
Swagger 설명 코드 보간·`ADMIN_ROLES` 공용화·docstring 정정)이며 이전 `--impl-prep`(`review/consistency/2026/09/25/19_06_16`)
이 이미 이 5개 요구를 검토해 WARNING 1건(W1)·INFO 7건을 남겼다. 본 검토는 (a) 그 WARNING 이 실제 구현에서 지켜졌는지,
(b) 새로 병합된 코드가 다른 영역 spec(`5-system/1-auth.md`, `data-flow/12-workspace.md`, `2-navigation/9-user-profile.md`,
`2-navigation/4-integration.md §8`)과 여전히 정합한지를 코드베이스(HEAD 워크트리, 절대경로)와 직접 대조했다.

## 발견사항

- **[정보 확인 — 조치 불필요]** impl-prep W1 (부트 캐너리 "그대로 호출" 불변식)이 구현에서 지켜졌음
  - target 위치: `codebase/backend/src/common/decorators/workspace.decorator.ts` — 신규 내부 헬퍼
    `routeArgEntriesMatching`, 그 위에 얹힌 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf`
  - 대조 대상: `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증" — "`assertWorkspaceIdReflectionWorks`
    의 판별에는 `handlerConsumesWorkspaceId` 를 **그대로 호출**한다" 는 명시적 제약
  - 상세: `handlerConsumesWorkspaceId`·`workspaceParamNamesOf` 는 top-level `export function` 시그니처·이름을
    그대로 유지한 채 내부에서만 `routeArgEntriesMatching` 을 호출하도록 리팩터됐다. `workspace-reflection-canary.ts`
    를 직접 확인한 결과 여전히 이 두 함수를 import·호출한다(`handlerConsumesWorkspaceId(cls, handler)` ·
    `workspaceParamNamesOf(cls, handler)`) — 새 공용 헬퍼를 캐너리가 대신 부르는 형태가 아니다. impl-prep 이
    우려한 "캐너리가 자기 복제본을 검사하게 되는" fail-open 회귀 경로는 발생하지 않았다.
  - 제안: 없음 — 이미 안전하게 처리됨.

- **[정보 확인 — 조치 불필요]** `ADMIN_ROLES` 공용화가 값·소비처 의미를 보존함
  - target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (로컬 `ADMIN_ROLES` 제거,
    `common/constants/workspace-roles.ts` import), `workspace-roles.ts` 의 `ADMIN_ROLES = {admin, owner}` (서열
    파생)
  - 대조 대상: `spec/2-navigation/4-integration.md §8` (Organization-scope 생성·수정·삭제 등 "Admin 이상"),
    `spec/0-overview.md §6.1` ("이 `editor` 는 라우트 가드 floor 이며 Organization-scope 의 생성·수정·전환은
    Admin+")
  - 상세: `isAdmin(role)` 이 게이트하는 대상은 §8 표의 Organization-scope 오퍼레이션이며, 공용화 전/후 모두
    집합 값이 `{admin, owner}` 로 동일하다(리터럴 `new Set(['owner','admin'])` → 서열 필터 파생, 값 등가). §8
    표·§6.1 각주 어느 쪽과도 어긋나지 않는다.
  - 제안: 없음.

- **[INFO]** `5-system/1-auth.md` §Rationale 의 `ADMIN_ROLES = new Set(['owner', 'admin'])` 리터럴 인용이 현재
  구현 형태와 문구가 다름
  - target 위치: 이번 diff 자체는 아니지만, 이번 diff 가 `ADMIN_ROLES` 정의를 리터럴에서 서열 파생으로 옮기는
    작업(그 전 단계는 `#1399` 가 이미 `workspaces.service.ts` 쪽에서 완료)의 일부라 문서 표류 여부를 재확인함
  - 충돌 대상: `spec/5-system/1-auth.md` §Rationale "§3.2 '멤버 관리' 행의 Admin 열 정정 (CRU → CRUD, 2026-07-28)"
    — "`assertAdmin` 의 통과 집합은 `ADMIN_ROLES = new Set(['owner', 'admin'])` — admin 이 통과한다."
  - 상세: 이 문장은 2026-07-28 시점 실측을 근거로 남긴 **역사적 증거**(날짜가 박혀 있고 "정정 근거를 실측으로
    남긴다" 는 절 도입부)이며, 결론("admin 이 통과한다")은 지금도 참이다. 다만 리터럴 표현
    `new Set(['owner', 'admin'])` 자체는 현재 `workspace-roles.ts` 의 서열 파생 정의와 문구가 다르다 — 값은
    같지만 소스코드 인용이 stale 하다. CRITICAL/WARNING 은 아니다: (a) 이 Rationale 은 "지금 코드가 어떻게
    생겼는가" 를 서술하는 자리가 아니라 "그때 무엇을 확인해 결론을 냈는가" 의 근거 기록이고, (b) 결론 문장
    자체는 이번 diff 이후에도 유효하다.
  - 제안: 우선순위 낮음. 다음에 이 Rationale 절을 편집할 일이 생기면 리터럴 인용에 "(2026-09-25 이후 서열
    파생으로 리팩터, 값 동일)" 각주를 붙이는 정도로 충분하다 — 이번 PR 이 별도로 손댈 필요는 없다(spec_impact: none
    범위 밖).

- **[INFO]** plan 의 `--impl-done` spec 연결 목록에 남은 `redis-keys` 항목 — impl-prep INFO 재확인
  - target 위치: `plan/in-progress/workspace-guard-followups.md` 체크리스트 — `` `--impl-done`(spec 연결: `1-auth` ·
    `9-user-profile` · `3-schedule` · `2-navigation/4-integration` · `redis-keys`) ``
  - 충돌 대상: `spec/conventions/redis-keys.md`
  - 상세: 이전 `--impl-prep`(`19_06_16`)이 이미 지적한 항목이 구현 완료 후에도 그대로 남아 있다. 이번 diff
    8개 파일 중 Redis 키·워크스페이스 role 도메인이 겹치는 지점이 없고, `redis-keys.md` 본문에도 role/RBAC
    언급이 없다 — 실제 스코프와 무관해 보인다는 판단은 유지된다.
  - 제안: `--impl-done` 실행 시 이 연결을 빼거나, 의도(예: `ADMIN_ROLES` 공용화가 어떤 캐시 무효화 채널과
    엮이는지)가 있다면 명시. 차단 사유는 아니다.

## 요약

이번 diff 는 `#1399` 로 이미 spec 에 반영된 "경로 파라미터 워크스페이스도 `RolesGuard` 가 보고, 가드 거부는
코드를 싣는다" 결정(`spec/data-flow/12-workspace.md` §"경로 파라미터 워크스페이스도 가드가 본다" · §"가드
거부의 오류 코드")을 코드 레벨에서 정리하는 동작 불변 리팩터다. reflection 헬퍼 통합은 부트 캐너리의 "판별
함수를 그대로 호출" 불변식을 깨지 않고(impl-prep WARNING 이 정확히 해소됨을 확인), `ADMIN_ROLES` 공용화는
Organization-scope 권한표(`2-navigation/4-integration.md §8`)·`0-overview.md §6.1` 각주와 여전히 값이
일치하며, 403 설명 문자열의 코드 보간은 `data-flow/12-workspace.md` 의 코드 표(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/
`ADMIN_REQUIRED`/`OWNER_REQUIRED`)와 그대로 대응한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 모델·
계층 책임 6개 관점 중 어느 것도 CRITICAL/WARNING 수준의 신규 충돌을 만들지 않았다. 유일한 잔여 사항은 이미
알려진 두 INFO(§1-auth.md 의 역사적 리터럴 인용 표류, plan 의 `redis-keys` 연결 무관성)로, 둘 다 이번 병합을
막을 사유가 아니다.

## 위험도

NONE
