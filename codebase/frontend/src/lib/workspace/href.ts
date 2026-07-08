/**
 * 활성 워크스페이스 slug 를 붙인 앱 내부 절대경로를 만든다 — `/w/<slug><path>`.
 *
 * URL 이 활성 워크스페이스의 **FE 라우팅 SoT** 다 (spec/2-navigation/9-user-profile.md §3).
 * 이 헬퍼가 하드코딩 절대경로를 대체해 broken-link 회귀 표면을 좁힌다.
 *
 * slug 가 없으면(아직 미해소·slug 밖 컨텍스트) bare path 를 반환한다 —
 * `(main)/[...rest]` catch-all 이 활성 slug 로 흡수하므로 링크가 깨지지 않는다.
 */
export function buildWorkspaceHref(
  slug: string | null | undefined,
  path: string,
): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return slug ? `/w/${slug}${clean}` : clean;
}
