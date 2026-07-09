/**
 * 앱 내부 경로용 open-redirect 방어 정규화의 **단일 진실**.
 *
 * WHATWG URL 파서는 특수 스킴에서 `/`·`\`·tab/CR/LF 를 동등 취급하므로, 선두 슬래시/백슬래시를
 * 하나로 접고 제어문자를 제거해 protocol-relative(`//host`, `\\host`, `/\host`, `/<tab>/host`)
 * 우회를 차단한다. `buildWorkspaceHref`(링크 생성)와 `isSafeRedirectPath`(redirect 대상 검증)가
 * 모두 이 규칙을 공유해 방어 강도가 비대칭이 되지 않게 한다.
 */
export function toSafeInternalPath(path: string): string {
  return `/${String(path)
    .replace(/[\t\r\n]/g, "")
    .replace(/^[/\\]+/, "")}`;
}

/**
 * `pathname` 이 **이미 안전한 same-origin 절대경로**인지(정규화가 필요 없는지) 판정한다.
 * 로그인 후 복귀(`?redirect=`)·에러 바운더리 redirect 대상 검증용 — 정규화가 값을 바꾸면
 * (protocol-relative·백슬래시·제어문자 등) 안전하지 않다.
 */
export function isSafeInternalPath(pathname: string | null): boolean {
  return (
    typeof pathname === "string" && pathname === toSafeInternalPath(pathname)
  );
}
