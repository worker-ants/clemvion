import { toSafeInternalPath } from "./safe-path";

/**
 * 활성 워크스페이스 slug 를 붙인 앱 내부 절대경로를 만든다 — `/w/<slug><path>`.
 *
 * URL 이 활성 워크스페이스의 **FE 라우팅 SoT** 다 (spec/2-navigation/9-user-profile.md §3).
 * 이 헬퍼가 하드코딩 절대경로를 대체해 broken-link 회귀 표면을 좁힌다.
 *
 * slug 가 없으면(아직 미해소·slug 밖 컨텍스트) bare path 를 반환한다 —
 * `(main)/[...rest]` catch-all 이 활성 slug 로 흡수하므로 링크가 깨지지 않는다.
 *
 * **보안 경계**: protocol-relative(`//host`·`\\host`) 및 제어문자 입력은 `toSafeInternalPath`
 * (open-redirect 방어 공용 정규화)로 same-origin 절대경로화된다.
 */
export function buildWorkspaceHref(
  slug: string | null | undefined,
  path: string,
): string {
  const clean = toSafeInternalPath(path);
  return slug ? `/w/${slug}${clean}` : clean;
}

/**
 * 실행 내역 경로를 만든다 — 목록 `/w/<slug>/workflows/<id>/executions`, 상세면 `.../<execId>`.
 *
 * 실행 경로는 `(main)` 라우트라 **항상 slug 를 붙여야** 하는데(에디터 canvas `/workflows/<id>` 와
 * 달리 bare 예외가 없다), 리터럴이 여러 소비처에 흩어져 한 곳이 slug 를 빠뜨리는 회귀가 있었다
 * (PR #865 rerun-modal). 경로 조립을 단일화해 그 클래스를 구조적으로 제거한다.
 * `no-restricted-syntax` lint 룰이 raw `/workflows/…/executions` 리터럴을 금지해 이 헬퍼 사용을 강제한다.
 */
export function buildExecutionHref(
  slug: string | null | undefined,
  workflowId: string,
  executionId?: string,
): string {
  const base = `/workflows/${workflowId}/executions`;
  return buildWorkspaceHref(slug, executionId ? `${base}/${executionId}` : base);
}
