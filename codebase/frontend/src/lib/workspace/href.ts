/**
 * 활성 워크스페이스 slug 를 붙인 앱 내부 절대경로를 만든다 — `/w/<slug><path>`.
 *
 * URL 이 활성 워크스페이스의 **FE 라우팅 SoT** 다 (spec/2-navigation/9-user-profile.md §3).
 * 이 헬퍼가 하드코딩 절대경로를 대체해 broken-link 회귀 표면을 좁힌다.
 *
 * slug 가 없으면(아직 미해소·slug 밖 컨텍스트) bare path 를 반환한다 —
 * `(main)/[...rest]` catch-all 이 활성 slug 로 흡수하므로 링크가 깨지지 않는다.
 *
 * **보안 경계**: protocol-relative(`//host` 또는 `\\host`) 입력은 same-origin 절대경로로
 * 정규화해 open-redirect 를 차단한다(아래 참조).
 */
export function buildWorkspaceHref(
  slug: string | null | undefined,
  path: string,
): string {
  // open-redirect 방어: 선두 슬래시/백슬래시를 하나로 접고 제어문자(tab/CR/LF)를 제거한다.
  // WHATWG URL 파서는 특수 스킴에서 `\`·tab/CR/LF 를 `/` 와 동등하게 취급하므로 `//`·`/\`·
  // `/<tab>/host` 형태의 우회를 함께 막는다(특히 slug 폴백 분기가 caller path 를 그대로 반환).
  // `//evil.com`·`\\evil.com` → `/evil.com`(same-origin), `/foo`·`foo` → `/foo`.
  const clean = `/${String(path)
    .replace(/[\t\r\n]/g, "")
    .replace(/^[/\\]+/, "")}`;
  return slug ? `/w/${slug}${clean}` : clean;
}
