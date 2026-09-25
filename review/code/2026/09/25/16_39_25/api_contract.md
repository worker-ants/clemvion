# API 계약(API Contract) 리뷰 — workspace-path-guard (2라운드)

## 컨텍스트

1라운드(`review/code/2026/09/25/16_03_32`)에서 `api_contract` 는 MEDIUM 을 보고했고
(W1 403 코드 일괄 변경 · W6 dead code · W7 Swagger 부분 갱신), 이번 diff 는 그 세 항목의
처분을 포함한 상태다. 아래를 직접 대조해 처분이 실제로 반영됐음을 확인했다 — 재지적하지 않는다.

- **W1**(87 라우트 403 `error.code` 일괄 변경): `spec/data-flow/12-workspace.md` §Rationale
  "가드 거부의 오류 코드" · CHANGELOG · FE 소비처(`NOT_A_MEMBER`/`OWNER_REQUIRED` 사용 확인,
  `workspace-store.ts`/`page.tsx:1010`)로 뒷받침됨. 응답 envelope 자체(`GlobalExceptionFilter`
  의 `{error:{code,message,requestId}}`)는 바뀌지 않고 **값만** 바뀐다 — 스키마 파손 아님.
- **W4**(역할 서열 이중 표현) 고침 확인: `common/constants/workspace-roles.ts` 신설, 가드·두
  서비스가 파생해서 쓴다.
- **W6**(`workspace-invitations.service.ts` `admin_required` dead code) 주석으로 명시 확인.
- **W3**(`removeMember` stale 주석) 취소선 정정 확인(`workspaces.service.ts`).

## 발견사항

- **[WARNING]** `@Roles()` 인자가 `string[]` 로 타입 검증되지 않아, 오탈자·미등록 역할 문자열이
  **인가를 통과시키는 방향으로** fail-open 한다 — viewer 를 포함한 모든 멤버가 통과한다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:232-236` (`assertMember` 의
    threshold 비교), 같은 파일 `:30` (`export const Roles = (...roles: string[]) => ...`),
    `codebase/backend/src/common/constants/workspace-roles.ts:16-21` (`workspaceRoleLevel` —
    "계층 밖 문자열은 0").
  - 상세: `assertMember` 는 `requiredRoles` 중 `roleLevel` 이 가장 낮은 것을 `threshold` 로 잡고
    `roleLevel(role) >= roleLevel(threshold)` 로 통과 여부를 정한다. `threshold` 문자열이
    `WORKSPACE_ROLE_LEVEL` 표 밖(오탈자 예: `'admni'`, 혹은 신규 역할 도입 중 철자 불일치)이면
    `roleLevel(threshold)` 가 **0** 이 되고, 어떤 멤버든 `roleLevel(role) >= 0` 은 항상 참이라
    **요구 역할과 무관하게 통과**한다 — 즉 `@Roles('typo')` 는 사실상 "멤버면 통과"로 조용히
    격하된다. 이 계층 판정 방식(미확인 문자열→0)은 이 PR 이전에도 `ROLE_HIERARCHY[required] || 0`
    형태로 존재했던 패턴이라 이번 diff 가 **새로 만든** 결함은 아니지만, 이 PR 은 정확히 "가드와
    서비스가 같은 표를 보게 해 divergence 를 막는다"는 목적의 역할-서열 통합 작업이라, 그 통합의
    자연스러운 마무리 지점이 바로 여기다. 현재 `@Roles(` 호출 94곳을 grep 해 보면 전부 유효한
    4개 리터럴(`viewer`/`editor`/`admin`/`owner`)이라 **오늘 당장 악용 가능한 경로는 없다**.
    신규 회귀 가드(`workspace-roles-attachment.spec.ts`)가 reflection 으로 역할 문자열을
    23곳(8 + 15) pin 하지만, 전체 94곳 중 일부만 커버해 이 gap 을 구조적으로 닫지 못한다.
    `modules/workspaces/dto/add-member.dto.ts` 에 이미 `WorkspaceRole` 리터럴 유니언 타입이
    있으므로(`export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]`) 타입 강제 비용이
    낮다.
  - 제안: `Roles` 시그니처를 `(...roles: WorkspaceRole[])` 로 좁히거나(컴파일 타임 방지),
    최소한 `workspaceRoleLevel` 이 미등록 역할 문자열을 받으면 boot-time 에 throw 하도록
    (`assertMember` 호출 전에 `requiredRoles.every(r => Object.hasOwn(WORKSPACE_ROLE_LEVEL, r))`
    단언) 런타임 방어를 추가한다. 둘 중 하나만 해도 "미확인 역할=차단" 으로 fail-closed 전환된다.

## 요약

핵심 변경(경로 파라미터 워크스페이스에 대한 `RolesGuard` 인가, `@WorkspaceParam` 도입, 403 응답
코드 전역 표준화)은 API 계약 관점에서 견고하다 — 에러 envelope 스키마는 그대로 유지한 채 값만
바뀌고, 그 변경은 spec Rationale·CHANGELOG·FE 소비처 확인으로 announce 됐다. UUID 경로
파라미터는 `ParseUUIDPipe` 내장 + 정적 가드(`param-uuid-pipe-guard`/`workspace-param-binding-guard`)
확장으로 URL 계약 일관성이 오히려 강화됐고, 비멤버 응답이 워크스페이스의 존재·유형과 무관하게
`403 NOT_A_MEMBER` 로 통일되어 기존 오라클(없음 404 · 개인/팀 403 분기)이 닫혔다(e2e 로 실측
확인). 서비스 계층의 admin/owner 사전 검사와 컨트롤러 신규 `@Roles()` 부착이 정확히 일치해
새 제약 추가가 아니라 동일 제약의 조기 집행(defense-in-depth)임도 서비스 코드로 교차 확인했다.
새로 찾은 유일한 이슈는 `@Roles()` 문자열이 컴파일 타임 검증 없이 `roleLevel` 의 "미확인=0"
폴백과 결합해 오탈자 시 fail-open 하는 잠재적 설계 공백이며, 오늘 기준 실제 악용 경로는 없다.

## 위험도

LOW
