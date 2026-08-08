/**
 * `RolesGuard`(`common/guards/roles.guard.ts`)와 `WorkspaceId` 데코레이터
 * (`common/decorators/workspace.decorator.ts`)가 공유하는 워크스페이스 컨텍스트
 * 해석 로직 — 단일 헬퍼로 추출해 "가드가 검증한 값"과 "핸들러가 소비하는 값"이
 * 항상 같은 경로에서 계산되도록 보장한다 (2026-08-08 ai-review ARCHITECTURE WARNING:
 * 배열-헤더 정규화가 가드에만 추가돼 두 구현이 갈라져 있었다).
 */

export interface WorkspaceContext {
  /** header-first 로 확정된 워크스페이스 ID. 둘 다 없으면 `undefined`. */
  workspaceId: string | undefined;
  /** `X-Workspace-Id` 헤더값(정규화 후). 헤더가 없으면 `undefined`. */
  headerWorkspaceId: string | undefined;
  /**
   * 헤더가 토큰 확정값(`tokenWorkspaceId`)을 덮어썼는지 — 참이면 `jwt.strategy` 가
   * 검증해 둔 멤버십을 재사용할 수 없다(`RolesGuard` 가 DB 로 재검증해야 하는 유일한 경로).
   */
  membershipUnverified: boolean;
}

/**
 * `X-Workspace-Id` 헤더에서 단일 값을 뽑는다. 중복 헤더(배열)는 **첫 값**을 쓴다
 * — `RolesGuard`·`WorkspaceId` 데코레이터가 공유하는 규칙.
 */
export function normalizeWorkspaceHeader(
  raw: string | string[] | undefined,
): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * header-first 워크스페이스 컨텍스트를 해석한다.
 * `X-Workspace-Id` 헤더가 있으면 그 값, 없으면 토큰 클레임(`tokenWorkspaceId`).
 *
 * **`AuthService.resolveTokenWorkspaceContext` 와 다른 계층이다** (2026-08-08
 * `--impl-done` naming_collision WARNING — 이름이 `Token` 유무만 달라 검색으로
 * 구분되지 않는다는 지적을 받아 `resolveRequest…` 로 개명하고 이 상호참조를 단다):
 *
 * | | 이 함수 | `resolveTokenWorkspaceContext` |
 * |---|---|---|
 * | 시점 | **요청 시점** (매 HTTP 요청) | **토큰 발급 시점** (로그인·전환·refresh) |
 * | 입력 | 요청 헤더 + 토큰 클레임 | userId (+ 대상 워크스페이스) |
 * | DB | **왕복 없음** (순수 함수) | 멤버십 조회 있음 |
 * | 산출 | 어느 워크스페이스를 쓸지 + 재검증 필요 여부 | 토큰에 서명할 활성 워크스페이스 |
 *
 * 즉 이쪽은 "이번 요청이 가리키는 곳" 을, 저쪽은 "토큰에 새길 곳" 을 정한다.
 */
export function resolveRequestWorkspaceContext(
  headers: Record<string, string | string[] | undefined>,
  tokenWorkspaceId: string | undefined,
): WorkspaceContext {
  const headerWorkspaceId = normalizeWorkspaceHeader(headers['x-workspace-id']);
  const workspaceId = headerWorkspaceId || tokenWorkspaceId;
  const membershipUnverified =
    !!headerWorkspaceId && headerWorkspaceId !== tokenWorkspaceId;

  return { workspaceId, headerWorkspaceId, membershipUnverified };
}
