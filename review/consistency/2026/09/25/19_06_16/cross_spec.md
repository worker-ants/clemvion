# Cross-Spec 일관성 검토 — workspace-guard-followups (--impl-prep)

검토 대상: `plan/in-progress/workspace-guard-followups.md` 의 5개 요구(`common/decorators/workspace.decorator.ts` 헬퍼 통합,
`workspaces.controller.ts` Swagger 설명 코드 보간, `workspaces.service.ts` `throwOwnerTransferRequired` 리터럴 정리 + docstring
정정, `integrations.service.ts` `ADMIN_ROLES` 공용화). `spec_impact: none` 선언 — 동작 불변 리팩터.

prompt 번들의 target 절이 실제 draft 문서가 아니라 `spec/` 전체 스냅샷 경로였고 대부분 파일이 예산 초과로 생략되어, 계획이 실제로
건드리는 코드 영역(`workspace.decorator.ts` · `workspaces.controller.ts` · `workspaces.service.ts` · `integrations.service.ts` ·
`common/constants/workspace-roles.ts`)과 그 SoT 로 명시된 spec(`5-system/1-auth.md`, `2-navigation/9-user-profile.md §4.2`,
`2-navigation/4-integration.md §8`, `data-flow/12-workspace.md`, `conventions/error-codes.md`, `0-overview.md §6.1`)을 저장소에서
직접 읽어 대조했다.

## 발견사항

- **[WARNING]** 헬퍼 통합(요구 1)이 부트 캐너리의 "그대로 호출" 제약과 마주친다
  - target 위치: `plan/in-progress/workspace-guard-followups.md` 요구 1 — `handlerConsumesWorkspaceId` · `workspaceParamNamesOf`
    의 "메서드명 가드 → `ROUTE_ARGS_METADATA` 조회 → 팩토리 필터" 골격을 공용 헬퍼로 추출
  - 충돌 대상: `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증 (fail-closed, 2026-08-09)"
  - 상세: 해당 spec 은 "`assertWorkspaceIdReflectionWorks` 의 판별에는 `handlerConsumesWorkspaceId` 를 **그대로 호출**한다 — 캐너리가
    reflection 을 다시 구현하면 자기 복제본을 검사하게 되어 정작 막으려던 파손을 통과시킨다" 라고 명시적으로 설계 제약을 건다.
    현재 `codebase/backend/src/common/decorators/workspace.decorator.ts` 를 읽어 보면 `handlerConsumesWorkspaceId` 와
    `workspaceParamNamesOf` 는 거의 동일한 "메서드명 → `Reflect.getMetadata(ROUTE_ARGS_METADATA, ...)` → factory 비교" 골격을
    독립적으로 반복하고 있어 요구 1 의 추출 동기 자체는 타당하다. 다만 추출 결과 두 함수 중 하나(또는 둘 다)가 내부 헬퍼의 얇은
    래퍼로 인라인되어 **exported `handlerConsumesWorkspaceId` 함수 identity·시그니처·동작이 바뀌거나, 부트 캐너리가 새 공용
    헬퍼를 대신 호출하게 되면** spec 이 명시한 "그대로 호출" 불변식이 깨진다 — 캐너리가 실제 가드 판별 로직과 다른 경로를 검사하게
    되어 리플렉션 파손을 놓치는 fail-open 회귀로 이어질 수 있다(같은 spec 절이 이 실패 방향을 "cross-tenant 결함 클래스가 그대로
    되살아난다" 로 이미 경고한 바로 그 시나리오).
  - 제안: 구현 시 (a) `handlerConsumesWorkspaceId` 를 계속 top-level `export function` 으로 유지하고 내부에서만 공용 헬퍼를
    호출하는 형태로 추출(요구 1 문구의 "두 함수는 그 위에 `some`/`map` 만 얹는다" 와 부합), (b)
    `workspace-reflection-canary.ts` 의 import·호출 대상이 리팩터 후에도 여전히 `handlerConsumesWorkspaceId` 그 자체인지
    확인하는 뮤턴트/회귀 테스트를 `--impl-done` 전에 추가. spec 수정은 불필요(설계 자체는 바뀌지 않음) — 다만 이 불변식을 지켰다는
    근거를 리뷰·커밋에 남길 것.

- **[INFO]** `--impl-done` 예정 spec 연결 목록의 `redis-keys` 가 실제 요구와 무관해 보임
  - target 위치: `plan/in-progress/workspace-guard-followups.md` 체크리스트 마지막 항목 — `` `--impl-done`(spec 연결: `1-auth` ·
    `9-user-profile` · `3-schedule` · `2-navigation/4-integration` · `redis-keys`) ``
  - 충돌 대상: `spec/conventions/redis-keys.md`
  - 상세: 5개 요구(데코레이터 헬퍼 통합·Swagger 설명 보간·owner 이양 거부 리터럴 정리·docstring 정정·`ADMIN_ROLES` 공용화)는 모두
    `RolesGuard`/워크스페이스 role 도메인이며, 저장소의 `redis-keys.md` 본문에는 `workspaceId` 세그먼트를 가진 실재 키가 없다고
    스스로 적혀 있고 role/RBAC 관련 언급이 전혀 없다 — 이번 변경 파일 중 Redis 키를 다루는 곳도 없다(전부 NestJS 데코레이터·컨트롤러
    Swagger 문자열·서비스 메서드). 연결 목록에 남아 있으면 `--impl-done` 리뷰가 무관한 파일을 target 삼거나, 반대로 실제로 갱신해야
    할 spec(예: 이번 리팩터로 새로 정정되는 `1-auth.md`/`data-flow/12-workspace.md` 서술이 있다면 그쪽)이 목록에서 빠졌는지
    헷갈리게 한다.
  - 제안: 착수 전에 `redis-keys` 연결이 트래커 원문(`spec-draft-nullable-notation-followups.md`)의 오기인지, 아니면 실제로
    `ADMIN_ROLES` 공용화가 어떤 Redis 캐시 무효화 채널(`integration:cache:invalidate` 등)의 role 판정과 연결되는지 확인하고,
    무관하면 `--impl-done` 호출 시 이 항목을 빼거나 정정.

- **[INFO]** RBAC 상수 정합성은 이미 확보돼 있음 — 새 충돌 없음 (참고용, 조치 불필요)
  - target 위치: 요구 2 (`FORBIDDEN_*_ROUTE` → `NOT_A_MEMBER.code`/`ROLE_REQUIRED.*.code` 보간), 요구 5(`ADMIN_ROLES` 공용화)
  - 대조: `spec/2-navigation/9-user-profile.md §4.2`(역할 권한 매트릭스), `spec/2-navigation/4-integration.md §8`(Personal/
    Organization 권한 규칙), `spec/5-system/1-auth.md §3.2`(리소스별 권한 매트릭스), `spec/data-flow/12-workspace.md`
    §"가드 거부의 오류 코드 (2026-09-25)", `spec/0-overview.md §6.1`("이 `editor` 는 라우트 가드 floor 이며 ... 본 행과 상보
    관계(모순 아님)")
  - 상세: 코드의 `common/constants/workspace-roles.ts` (`WORKSPACE_ROLE_LEVEL`, `ADMIN_ROLES = {admin, owner}`,
    `NOT_A_MEMBER`, `ROLE_REQUIRED`) 와 `integrations.service.ts` 의 로컬 `ADMIN_ROLES = new Set(['owner','admin'])`,
    `workspaces.controller.ts` 의 `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 문자열이 위 spec
    4곳의 역할 정의·코드 표와 전부 일치한다(#1399 가 이미 spec 을 갱신해 두었다). 요구 5 의 "값 같음" 전제, 요구 2 의 코드 보간
    대상도 실측과 어긋나지 않는다 — 이 축에서는 CRITICAL/WARNING 대상이 없다.
  - 제안: 없음(정보성 확인).

## 요약

이번 impl-prep 대상 5개 요구는 모두 `spec_impact: none` 리팩터이며, RBAC 코드·역할 서열·거부 코드 정의는 `#1399` 로 이미 spec 에
반영된 상태와 코드가 일치해 신규 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 모델 충돌은 발견되지 않았다. 유일한 실질 리스크는
요구 1(`workspace.decorator.ts` 헬퍼 통합)이 `spec/5-system/1-auth.md` 가 명시한 "부트 캐너리는 `handlerConsumesWorkspaceId` 를
그대로 호출해야 한다" 는 계층 책임 제약과 맞닿아 있다는 점으로, 추출 방식에 따라 이 불변식이 조용히 깨질 수 있어 WARNING 으로
기록했다(spec 자체를 고칠 필요는 없고 구현·테스트에서 지키면 된다). 부수적으로 `--impl-done` 예정 spec 연결 목록의 `redis-keys`
항목이 실제 변경 범위와 무관해 보여 INFO 로 남긴다.

## 위험도

LOW
